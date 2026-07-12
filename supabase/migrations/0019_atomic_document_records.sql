-- Atomic record creation for the document wizard. Previously the client
-- created tenant → (guarantor) → lease/sale → property status as separate
-- requests; a mid-sequence failure left orphans (e.g. a tenant with no
-- lease). Each function below runs in a single transaction, so either every
-- record lands or none do.
--
-- SECURITY INVOKER on purpose: all inserts/updates run as the calling user,
-- so the existing RLS policies (team membership + team_is_writable) stay
-- authoritative.

create or replace function public.create_rental_records(
	p_team_id uuid,
	p_property_id uuid,
	p_tenant jsonb,
	p_guarantor jsonb, -- null when there is no kefil
	p_lease jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_tenant_id uuid;
	v_guarantor_id uuid;
	v_lease_id uuid;
begin
	insert into public.tenants (team_id, created_by, full_name, email, phone, national_id)
	values (
		p_team_id, auth.uid(),
		p_tenant->>'full_name',
		nullif(p_tenant->>'email', ''),
		nullif(p_tenant->>'phone', ''),
		nullif(p_tenant->>'national_id', '')
	)
	returning id into v_tenant_id;

	if p_guarantor is not null then
		insert into public.tenants (team_id, created_by, full_name, email, phone, national_id, notes)
		values (
			p_team_id, auth.uid(),
			p_guarantor->>'full_name',
			nullif(p_guarantor->>'email', ''),
			nullif(p_guarantor->>'phone', ''),
			nullif(p_guarantor->>'national_id', ''),
			'Kefil (guarantor)'
		)
		returning id into v_guarantor_id;
	end if;

	insert into public.leases (
		team_id, created_by, property_id, tenant_id, guarantor_id,
		term, start_date, end_date, monthly_rent, deposit, currency,
		payment_day, payment_method, bank_account,
		util_electricity, util_water, util_gas, util_internet, util_aidat,
		subletting_allowed, rent_increase_note, inventory,
		condition_notes, special_conditions
	)
	values (
		p_team_id, auth.uid(), p_property_id, v_tenant_id, v_guarantor_id,
		p_lease->>'term',
		(p_lease->>'start_date')::date,
		(p_lease->>'end_date')::date,
		(p_lease->>'monthly_rent')::numeric,
		coalesce((p_lease->>'deposit')::numeric, 0),
		coalesce(p_lease->>'currency', 'TRY'),
		(p_lease->>'payment_day')::int,
		nullif(p_lease->>'payment_method', ''),
		nullif(p_lease->>'bank_account', ''),
		coalesce(p_lease->>'util_electricity', 'tenant'),
		coalesce(p_lease->>'util_water', 'tenant'),
		coalesce(p_lease->>'util_gas', 'tenant'),
		coalesce(p_lease->>'util_internet', 'tenant'),
		coalesce(p_lease->>'util_aidat', 'tenant'),
		coalesce((p_lease->>'subletting_allowed')::boolean, false),
		nullif(p_lease->>'rent_increase_note', ''),
		coalesce(p_lease->'inventory', '[]'::jsonb),
		nullif(p_lease->>'condition_notes', ''),
		nullif(p_lease->>'special_conditions', '')
	)
	returning id into v_lease_id;

	update public.properties set status = 'occupied' where id = p_property_id;
	if not found then
		raise exception 'property % not found or not writable', p_property_id;
	end if;

	return jsonb_build_object(
		'tenant_id', v_tenant_id,
		'guarantor_id', v_guarantor_id,
		'lease_id', v_lease_id
	);
end;
$$;

create or replace function public.create_sales_records(
	p_team_id uuid,
	p_property_id uuid,
	p_buyer jsonb,
	p_sale jsonb
) returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
	v_buyer_id uuid;
	v_sale_id uuid;
begin
	-- Buyers reuse public.tenants (schema fits).
	insert into public.tenants (team_id, created_by, full_name, email, phone, national_id)
	values (
		p_team_id, auth.uid(),
		p_buyer->>'full_name',
		nullif(p_buyer->>'email', ''),
		nullif(p_buyer->>'phone', ''),
		nullif(p_buyer->>'national_id', '')
	)
	returning id into v_buyer_id;

	insert into public.sales (
		team_id, created_by, property_id, buyer_id,
		sale_price, currency, sale_date, target_close_date,
		deposit_amount, penalty_amount, validity_days, tax_responsibility,
		buyer_commission_rate, seller_commission_rate, special_conditions
	)
	values (
		p_team_id, auth.uid(), p_property_id, v_buyer_id,
		(p_sale->>'sale_price')::numeric,
		coalesce(p_sale->>'currency', 'TRY'),
		(p_sale->>'sale_date')::date,
		(p_sale->>'target_close_date')::date,
		(p_sale->>'deposit_amount')::numeric,
		(p_sale->>'penalty_amount')::numeric,
		(p_sale->>'validity_days')::int,
		coalesce(p_sale->>'tax_responsibility', 'legal'),
		(p_sale->>'buyer_commission_rate')::numeric,
		(p_sale->>'seller_commission_rate')::numeric,
		nullif(p_sale->>'special_conditions', '')
	)
	returning id into v_sale_id;

	update public.properties set status = 'sold' where id = p_property_id;
	if not found then
		raise exception 'property % not found or not writable', p_property_id;
	end if;

	return jsonb_build_object('buyer_id', v_buyer_id, 'sale_id', v_sale_id);
end;
$$;

grant execute on function public.create_rental_records(uuid, uuid, jsonb, jsonb, jsonb) to authenticated;
grant execute on function public.create_sales_records(uuid, uuid, jsonb, jsonb) to authenticated;
