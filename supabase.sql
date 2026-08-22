-- Esquema opcional para conectar la tienda a Supabase sin cambiar el frontend visual.
-- 1) Ejecutar en SQL Editor.
-- 2) Crear un usuario administrador en Authentication.
-- 3) Cargar URL + anon key en config.js.

create table if not exists public.store_settings (
  id bigint primary key generated always as identity,
  key text unique not null,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id text primary key,
  name text not null,
  category text not null,
  price numeric not null default 0,
  transfer_price numeric not null default 0,
  cash_price numeric not null default 0,
  image text not null default '',
  badge text not null default '',
  featured boolean not null default false,
  description text not null default '',
  variants text not null default '',
  sort_order integer not null default 0,
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.store_settings enable row level security;
alter table public.products enable row level security;

create policy "public read settings" on public.store_settings for select using (true);
create policy "public read active products" on public.products for select using (active = true);
create policy "authenticated manage settings" on public.store_settings for all to authenticated using (true) with check (true);
create policy "authenticated manage products" on public.products for all to authenticated using (true) with check (true);
