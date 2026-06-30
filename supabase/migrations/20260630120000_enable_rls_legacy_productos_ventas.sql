-- Cierra tablas legacy que no usa SalonPro actualmente.
-- Sin politicas, RLS bloquea acceso desde anon/authenticated y elimina el aviso del Advisor.

do $$
begin
  if to_regclass('public.productos') is not null then
    alter table public.productos enable row level security;
    comment on table public.productos is 'Legacy product table. RLS enabled intentionally without public policies.';
  end if;

  if to_regclass('public.ventas') is not null then
    alter table public.ventas enable row level security;
    comment on table public.ventas is 'Legacy sales table. RLS enabled intentionally without public policies.';
  end if;
end $$;
