# Kagu Emlak

## What it is
Multi-tenant SaaS for Turkish real-estate agencies (emlak offices): property portfolio
management (tapu fields, photos, maps), a lightweight CRM for leads with
preference-based property matching, tenant & rent-payment tracking with leases,
and a wizard that generates client-ready contract/receipt PDFs (Turkish + Arabic RTL).
A needs-attention dashboard surfaces overdue rent, expiring leases, and silent leads.

## Audience
Turkish emlak agents and office owners. Daily-use work tool, heavily mobile
(agents in the field), desktop in the office. Roles: owner, agent, super-admin.
UI language is entirely Turkish.

## Register
product — design serves the tool. The one brand-register surface is the public
landing page (`src/components/marketing/LandingPage.tsx`) and legal/auth pages.

## Platform
web

## Scene
An agent stands in a sunlit apartment with a client, phone in hand, pulling up
the portfolio between conversations; the office owner reviews overdue rent on a
desktop at 9am under office fluorescents. Light theme is the default; dark is
an explicit choice.

## Brand
- Name: **Kagu** — the kagu is an ash-grey bird ("ghost of the forest") with a
  striking orange-red bill and legs. The identity follows the bird: cool
  silver-grey/graphite neutrals + one saturated red-orange accent.
- Palette family: Terracotta + Slate (warm rust accent against cool grey).
  One accent, locked page-wide. No gold, no ivory/cream, no purple gradients.
- Type: Geist (display + body, weight-driven hierarchy) + Geist Mono for
  numerals/data (tabular-nums). Noto Sans Arabic for RTL contract output.
- Motion: restrained product motion (press feedback, drawer/sheet springs,
  skeletons); landing page gets entrance/scroll reveals. Reduced-motion honored.

## Constraints
- Turkish copy voice everywhere; sentence case.
- Preserve: route slugs, nav labels, form field names, theme localStorage key
  (`kagu-theme`), auth/db/RLS logic, Leaflet + PDF generation logic,
  focus traps, 44px touch targets, iOS-zoom guards.
- Theming is centralized: daisyUI 5 theme blocks in `src/app/globals.css`
  (`estate` light default, `estate-dark` opt-in).
