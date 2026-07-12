-- Custom brand colors: replace the preset-palette picker with three
-- user-chosen colors (main, accent 1, accent 2). The old brand_palette
-- column stays for now so a rollback loses nothing; new code reads only
-- the three color columns.

alter table public.teams drop constraint if exists teams_brand_palette_check;

alter table public.teams
	add column if not exists brand_color_main text not null default '#1e242e',
	add column if not exists brand_color_accent1 text not null default '#b74427',
	add column if not exists brand_color_accent2 text not null default '#8b929e';

alter table public.teams add constraint teams_brand_colors_hex_check check (
	brand_color_main ~* '^#[0-9a-f]{6}$'
	and brand_color_accent1 ~* '^#[0-9a-f]{6}$'
	and brand_color_accent2 ~* '^#[0-9a-f]{6}$'
);

-- Backfill from the previously selected preset (primary / accent / muted
-- values mirror BRAND_PALETTES in src/lib/pdf/branding.ts).
update public.teams set
	brand_color_main = v.main,
	brand_color_accent1 = v.accent1,
	brand_color_accent2 = v.accent2
from (values
	('kagu',     '#1e242e', '#b74427', '#8b929e'),
	('slate',    '#0f172a', '#6366f1', '#94a3b8'),
	('avera',    '#051526', '#b11211', '#9d9f9e'),
	('emerald',  '#064e3b', '#f59e0b', '#6ee7b7'),
	('indigo',   '#312e81', '#e11d48', '#a5b4fc'),
	('burgundy', '#5c0a1e', '#b45309', '#d4a5b0')
) as v(palette_id, main, accent1, accent2)
where public.teams.brand_palette = v.palette_id;
