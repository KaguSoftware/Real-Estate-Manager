-- =============================================================================
-- 0023_dashboard_stats.sql — server-side dashboard aggregation
--
-- Replaces the client's four full-table selects (properties, leases, leads,
-- payments — reduced in JS) with a single RPC that returns every number the
-- dashboard and the "Portföy sağlığı" panel need as one JSONB document.
--
-- SECURITY INVOKER: every inner SELECT runs under the caller's RLS policies
-- (team-scoped, see 0010), so the function can never leak another team's rows.
-- The explicit team_id = public.user_team_id() predicates are there for the
-- planner (they hit the idx_*_team indexes) — RLS remains the security boundary.
--
-- Run after 0022. Idempotent: safe to re-run.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB
LANGUAGE sql
SECURITY INVOKER
STABLE
SET search_path = ''
AS $$
WITH me AS (
  SELECT public.user_team_id() AS team_id
),
props AS (
  SELECT id, status, listing_type, address_line
  FROM public.properties
  WHERE team_id = (SELECT team_id FROM me)
),
prop_status AS (
  SELECT
    count(*) FILTER (WHERE status = 'vacant')   AS vacant,
    count(*) FILTER (WHERE status = 'occupied') AS occupied,
    count(*) FILTER (WHERE status = 'sold')     AS sold
  FROM props
),
prop_listing AS (
  SELECT
    count(*) FILTER (WHERE listing_type = 'for_rent') AS for_rent,
    count(*) FILTER (WHERE listing_type = 'for_sale') AS for_sale
  FROM props
),
active_leases AS (
  SELECT id, property_id, monthly_rent, COALESCE(NULLIF(currency, ''), 'TRY') AS cur, end_date
  FROM public.leases
  WHERE team_id = (SELECT team_id FROM me) AND status = 'active'
),
-- All team payments joined to their lease (for currency + property + status).
pays AS (
  SELECT
    p.lease_id,
    p.amount_due,
    p.amount_paid,
    p.period_start,
    p.period_end,
    COALESCE(NULLIF(l.currency, ''), 'TRY') AS cur,
    l.property_id,
    l.status AS lease_status
  FROM public.payments p
  JOIN public.leases l ON l.id = p.lease_id
  WHERE p.team_id = (SELECT team_id FROM me)
),
rent_by_cur AS (
  SELECT COALESCE(jsonb_object_agg(cur, total), '{}'::jsonb) AS j
  FROM (
    SELECT cur, sum(COALESCE(monthly_rent, 0)) AS total
    FROM active_leases GROUP BY cur
  ) s
),
-- Outstanding balance (due − paid) on ACTIVE leases; positive balances only
-- (matches the previous JS reduction).
outstanding_by_cur AS (
  SELECT COALESCE(jsonb_object_agg(cur, total), '{}'::jsonb) AS j
  FROM (
    SELECT cur, sum(amount_due - amount_paid) AS total
    FROM pays
    WHERE lease_status = 'active'
    GROUP BY cur
    HAVING sum(amount_due - amount_paid) > 0
  ) s
),
-- Current calendar month's collection on active leases, keyed by currency.
collection_month AS (
  SELECT COALESCE(
           jsonb_object_agg(cur, jsonb_build_object('due', due, 'paid', paid)),
           '{}'::jsonb
         ) AS j
  FROM (
    SELECT cur, sum(amount_due) AS due, sum(amount_paid) AS paid
    FROM pays
    WHERE lease_status = 'active'
      AND period_start >= date_trunc('month', CURRENT_DATE)::date
      AND period_start <  (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::date
    GROUP BY cur
  ) s
),
-- Overdue: the period has ended and it is not fully paid (any lease).
overdue AS (
  SELECT
    count(*) AS cnt,
    COALESCE(
      (SELECT jsonb_object_agg(cur, total)
       FROM (
         SELECT cur, sum(amount_due - amount_paid) AS total
         FROM pays
         WHERE period_end < CURRENT_DATE AND amount_paid < amount_due
         GROUP BY cur
       ) x),
      '{}'::jsonb
    ) AS total_by_cur
  FROM pays
  WHERE period_end < CURRENT_DATE AND amount_paid < amount_due
),
lease_counts AS (
  SELECT
    count(*) AS active_count,
    count(*) FILTER (
      WHERE end_date IS NOT NULL
        AND end_date >= CURRENT_DATE
        AND end_date <  CURRENT_DATE + INTERVAL '90 days'
    ) AS expiring_90d
  FROM active_leases
),
lead_stats AS (
  SELECT
    count(*) AS total,
    count(*) FILTER (WHERE last_call_at IS NULL) AS no_activity,
    '{"new":0,"called_rejected":0,"follow_up":0,"interested":0,"closed":0}'::jsonb
      || COALESCE(
           (SELECT jsonb_object_agg(status, n)
            FROM (SELECT status, count(*) AS n
                  FROM public.leads
                  WHERE team_id = (SELECT team_id FROM me)
                  GROUP BY status) g),
           '{}'::jsonb
         ) AS by_status
  FROM public.leads
  WHERE team_id = (SELECT team_id FROM me)
),
-- Per-property health for rentals: active-lease end date + overdue count.
-- Worst offenders first, capped at 50 rows.
health AS (
  SELECT COALESCE(jsonb_agg(row ORDER BY overdue_count DESC, lease_end ASC NULLS LAST), '[]'::jsonb) AS j
  FROM (
    SELECT
      od.overdue_count,
      al.end_date AS lease_end,
      jsonb_build_object(
        'id',             pr.id,
        'address_line',   pr.address_line,
        'status',         pr.status,
        'lease_end_date', al.end_date,
        'overdue_count',  od.overdue_count
      ) AS row
    FROM props pr
    LEFT JOIN active_leases al ON al.property_id = pr.id
    LEFT JOIN LATERAL (
      SELECT count(*) AS overdue_count
      FROM pays p
      WHERE p.property_id = pr.id
        AND p.period_end < CURRENT_DATE
        AND p.amount_paid < p.amount_due
    ) od ON true
    WHERE pr.listing_type = 'for_rent'
    ORDER BY od.overdue_count DESC, al.end_date ASC NULLS LAST
    LIMIT 50
  ) s
)
SELECT jsonb_build_object(
  -- existing DashboardStats fields ------------------------------------------
  'properties', jsonb_build_object(
    'vacant',   ps.vacant,
    'occupied', ps.occupied,
    'sold',     ps.sold
  ),
  'monthlyRentByCurrency',  (SELECT j FROM rent_by_cur),
  'outstandingByCurrency',  (SELECT j FROM outstanding_by_cur),
  'leadsByStatus',          ls.by_status,
  'totalLeads',             ls.total,
  'occupancyRate',          CASE WHEN ps.occupied + ps.vacant > 0
                                 THEN round(ps.occupied::numeric / (ps.occupied + ps.vacant), 4)
                                 ELSE NULL END,
  'collectionThisMonth',    (SELECT j FROM collection_month),
  -- new fields ---------------------------------------------------------------
  'propertiesByListingType', jsonb_build_object(
    'for_rent', pl.for_rent,
    'for_sale', pl.for_sale
  ),
  'activeLeases',            lc.active_count,
  'leasesExpiringSoon',      lc.expiring_90d,
  'overdue', jsonb_build_object(
    'count',           ov.cnt,
    'totalByCurrency', ov.total_by_cur
  ),
  'leadsWithNoActivity',     ls.no_activity,
  'propertyHealth',          (SELECT j FROM health)
)
FROM prop_status ps, prop_listing pl, lease_counts lc, lead_stats ls, overdue ov;
$$;

REVOKE ALL ON FUNCTION public.get_dashboard_stats() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_dashboard_stats() TO authenticated;
