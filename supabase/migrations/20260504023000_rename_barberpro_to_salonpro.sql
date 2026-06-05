begin;

do $$
begin
  if to_regclass('public.barbershops') is not null and to_regclass('public.salons') is null then
    alter table public.barbershops rename to salons;
  end if;

  if to_regclass('public.barbers') is not null and to_regclass('public.stylists') is null then
    alter table public.barbers rename to stylists;
  end if;
end $$;

do $$
declare
  rename_item record;
begin
  for rename_item in
    select *
    from (
      values
        ('branches', 'barbershop_id', 'salon_id'),
        ('profiles', 'barbershop_id', 'salon_id'),
        ('stylists', 'barbershop_id', 'salon_id'),
        ('clients', 'barbershop_id', 'salon_id'),
        ('clients', 'favorite_barber_id', 'favorite_stylist_id'),
        ('clients', 'favorite_barber_name', 'favorite_stylist_name'),
        ('services', 'barbershop_id', 'salon_id'),
        ('appointments', 'barber_id', 'stylist_id'),
        ('appointments', 'barber_name', 'stylist_name'),
        ('appointments', 'barbershop_id', 'salon_id'),
        ('sales', 'barbershop_id', 'salon_id'),
        ('sale_items', 'barbershop_id', 'salon_id'),
        ('cash_sessions', 'barbershop_id', 'salon_id'),
        ('cash_movements', 'barbershop_id', 'salon_id'),
        ('expenses', 'barbershop_id', 'salon_id'),
        ('pos_sales', 'barbershop_id', 'salon_id')
    ) as renames(table_name, old_column, new_column)
  loop
    if to_regclass(format('public.%I', rename_item.table_name)) is not null
      and exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = rename_item.table_name
          and column_name = rename_item.old_column
      )
      and not exists (
        select 1
        from information_schema.columns
        where table_schema = 'public'
          and table_name = rename_item.table_name
          and column_name = rename_item.new_column
      )
    then
      execute format(
        'alter table public.%I rename column %I to %I',
        rename_item.table_name,
        rename_item.old_column,
        rename_item.new_column
      );
    end if;
  end loop;
end $$;

do $$
declare
  rename_item record;
begin
  for rename_item in
    select *
    from (
      values
        ('idx_branches_barbershop_name', 'idx_branches_salon_name'),
        ('idx_profiles_barbershop_id', 'idx_profiles_salon_id'),
        ('idx_clients_barbershop_id', 'idx_clients_salon_id'),
        ('idx_barbers_barbershop_id', 'idx_stylists_salon_id'),
        ('idx_barbers_branch_id', 'idx_stylists_branch_id'),
        ('idx_services_barbershop_id', 'idx_services_salon_id'),
        ('idx_appointments_barbershop_id', 'idx_appointments_salon_id'),
        ('idx_pos_sales_barbershop_created_at', 'idx_pos_sales_salon_created_at')
    ) as renames(old_name, new_name)
  loop
    if to_regclass(format('public.%I', rename_item.old_name)) is not null
      and to_regclass(format('public.%I', rename_item.new_name)) is null
    then
      execute format('alter index public.%I rename to %I', rename_item.old_name, rename_item.new_name);
    end if;
  end loop;
end $$;

do $$
declare
  rename_item record;
begin
  for rename_item in
    select *
    from (
      values
        ('salons', 'barbershops_pkey', 'salons_pkey'),
        ('salons', 'barbershops_slug_key', 'salons_slug_key'),
        ('branches', 'branches_barbershop_id_fkey', 'branches_salon_id_fkey'),
        ('profiles', 'profiles_barbershop_id_fkey', 'profiles_salon_id_fkey'),
        ('stylists', 'barbers_pkey', 'stylists_pkey'),
        ('stylists', 'barbers_barbershop_id_fkey', 'stylists_salon_id_fkey'),
        ('stylists', 'barbers_branch_id_fkey', 'stylists_branch_id_fkey'),
        ('clients', 'clients_barbershop_id_fkey', 'clients_salon_id_fkey'),
        ('clients', 'clients_favorite_barber_id_fkey', 'clients_favorite_stylist_id_fkey'),
        ('services', 'services_barbershop_id_fkey', 'services_salon_id_fkey'),
        ('appointments', 'appointments_barbershop_id_fkey', 'appointments_salon_id_fkey'),
        ('appointments', 'appointments_barber_id_fkey', 'appointments_stylist_id_fkey'),
        ('sales', 'sales_barbershop_id_fkey', 'sales_salon_id_fkey'),
        ('sale_items', 'sale_items_barbershop_id_fkey', 'sale_items_salon_id_fkey'),
        ('cash_sessions', 'cash_sessions_barbershop_id_fkey', 'cash_sessions_salon_id_fkey'),
        ('cash_movements', 'cash_movements_barbershop_id_fkey', 'cash_movements_salon_id_fkey'),
        ('expenses', 'expenses_barbershop_id_fkey', 'expenses_salon_id_fkey'),
        ('pos_sales', 'pos_sales_barbershop_id_fkey', 'pos_sales_salon_id_fkey')
    ) as renames(table_name, old_name, new_name)
  loop
    if to_regclass(format('public.%I', rename_item.table_name)) is not null
      and exists (
        select 1
        from pg_constraint
        where conrelid = to_regclass(format('public.%I', rename_item.table_name))
          and conname = rename_item.old_name
      )
      and not exists (
        select 1
        from pg_constraint
        where conrelid = to_regclass(format('public.%I', rename_item.table_name))
          and conname = rename_item.new_name
      )
    then
      execute format(
        'alter table public.%I rename constraint %I to %I',
        rename_item.table_name,
        rename_item.old_name,
        rename_item.new_name
      );
    end if;
  end loop;
end $$;

do $$
begin
  if to_regclass('public.salons') is not null then
    execute 'drop trigger if exists trg_barbershops_updated_at on public.salons';
    execute 'drop trigger if exists trg_salons_updated_at on public.salons';
    execute 'create trigger trg_salons_updated_at before update on public.salons for each row execute function public.set_updated_at()';
  end if;

  if to_regclass('public.stylists') is not null then
    execute 'drop trigger if exists trg_barbers_updated_at on public.stylists';
    execute 'drop trigger if exists trg_stylists_updated_at on public.stylists';
    execute 'create trigger trg_stylists_updated_at before update on public.stylists for each row execute function public.set_updated_at()';
  end if;
end $$;

alter table if exists public.stylists drop constraint if exists barbers_payment_mode_check;
alter table if exists public.stylists drop constraint if exists stylists_payment_mode_check;
alter table if exists public.stylists
  add constraint stylists_payment_mode_check
  check (payment_mode in ('salario', 'porcentaje', 'mixto'));

alter table if exists public.services drop constraint if exists services_category_check;

update public.services
set category = case
  when category = 'Cortes' then 'Cabello'
  when category = 'Barba' then 'Uñas'
  else category
end
where category in ('Cortes', 'Barba');

update public.services
set name = case
  when lower(name) in ('corte clásico', 'corte clasico') then 'Corte y brushing'
  when lower(name) = 'perfilado barba' then 'Manicure spa'
  when lower(name) = 'combo master' then 'Paquete Belleza Total'
  when lower(name) = 'corte gratis por fidelidad' then 'Servicio gratis por fidelidad'
  else name
end
where lower(name) in ('corte clásico', 'corte clasico', 'perfilado barba', 'combo master', 'corte gratis por fidelidad');

alter table if exists public.services
  add constraint services_category_check
  check (category in ('Cabello', 'Color', 'Uñas', 'Tratamiento', 'Producto', 'Combo', 'Promocion'));

update public.appointments
set status = 'en_servicio'
where status = 'en_corte';

update public.appointments
set service_name = case
  when lower(service_name) in ('corte clásico', 'corte clasico') then 'Corte y brushing'
  when lower(service_name) = 'perfilado barba' then 'Manicure spa'
  when lower(service_name) = 'combo master' then 'Paquete Belleza Total'
  when lower(service_name) = 'corte gratis por fidelidad' then 'Servicio gratis por fidelidad'
  else service_name
end
where lower(service_name) in ('corte clásico', 'corte clasico', 'perfilado barba', 'combo master', 'corte gratis por fidelidad');

with stylist_names as (
  select *
  from (
    values
      ('Juan "El Master"', 'Sofía Color', 'Sofía Valeria Martínez López', 'SC'),
      ('Luis "Barbas"', 'Camila Nails', 'Camila Alejandra García Reyes', 'CN'),
      ('Mario "Fade"', 'Valeria Glow', 'Valeria Fernanda Hernández Ruiz', 'VG'),
      ('Alex "Tijeras"', 'Isabella Studio', 'Isabella Mariana Torres Silva', 'IS'),
      ('Pedro "Style"', 'Lucía Bridal', 'Lucía Antonella Castillo Vega', 'LB'),
      ('Dani "Clipper"', 'Daniela Spa', 'Daniela Elena Morales Soto', 'DS')
  ) as names(old_name, new_name, new_full_name, new_avatar)
)
update public.stylists s
set
  name = stylist_names.new_name,
  full_name = stylist_names.new_full_name,
  avatar = stylist_names.new_avatar
from stylist_names
where s.name = stylist_names.old_name;

with stylist_names as (
  select *
  from (
    values
      ('Juan "El Master"', 'Sofía Color'),
      ('Luis "Barbas"', 'Camila Nails'),
      ('Mario "Fade"', 'Valeria Glow'),
      ('Alex "Tijeras"', 'Isabella Studio'),
      ('Pedro "Style"', 'Lucía Bridal'),
      ('Dani "Clipper"', 'Daniela Spa')
  ) as names(old_name, new_name)
)
update public.appointments a
set stylist_name = stylist_names.new_name
from stylist_names
where a.stylist_name = stylist_names.old_name;

with stylist_names as (
  select *
  from (
    values
      ('Juan "El Master"', 'Sofía Color'),
      ('Luis "Barbas"', 'Camila Nails'),
      ('Mario "Fade"', 'Valeria Glow'),
      ('Alex "Tijeras"', 'Isabella Studio'),
      ('Pedro "Style"', 'Lucía Bridal'),
      ('Dani "Clipper"', 'Daniela Spa')
  ) as names(old_name, new_name)
)
update public.clients c
set favorite_stylist_name = stylist_names.new_name
from stylist_names
where c.favorite_stylist_name = stylist_names.old_name;

update public.salons
set
  name = case
    when lower(name) like '%barber%' or lower(name) like '%barbería%' or lower(name) like '%barberia%' then 'SalonPro'
    else name
  end,
  slug = case
    when lower(slug) like '%barber%' or lower(slug) like '%barberia%' then 'salonpro'
    else slug
  end
where lower(name) like '%barber%'
  or lower(name) like '%barbería%'
  or lower(name) like '%barberia%'
  or lower(slug) like '%barber%'
  or lower(slug) like '%barberia%';

update public.pos_sales
set items = replace(
  replace(
    replace(
      replace(
        replace(
          replace(items::text, 'Corte Clásico', 'Corte y brushing'),
          'Perfilado Barba',
          'Manicure spa'
        ),
        'Combo Master',
        'Paquete Belleza Total'
      ),
      'Corte gratis por fidelidad',
      'Servicio gratis por fidelidad'
    ),
    'Cortes',
    'Cabello'
  ),
  'Barba',
  'Uñas'
)::jsonb
where items::text similar to '%(Corte Clásico|Perfilado Barba|Combo Master|Corte gratis por fidelidad|Cortes|Barba)%';

update public.sale_items
set description = case
  when lower(description) in ('corte clásico', 'corte clasico') then 'Corte y brushing'
  when lower(description) = 'perfilado barba' then 'Manicure spa'
  when lower(description) = 'combo master' then 'Paquete Belleza Total'
  when lower(description) = 'corte gratis por fidelidad' then 'Servicio gratis por fidelidad'
  else description
end
where lower(description) in ('corte clásico', 'corte clasico', 'perfilado barba', 'combo master', 'corte gratis por fidelidad');

insert into public.roles (role_name, description)
values
  ('super_admin', 'Control total de la plataforma SalonPro'),
  ('admin', 'Administra un salón y su configuración'),
  ('cashier', 'Opera agenda, clientes y caja')
on conflict (role_name) do update
set description = excluded.description;

drop policy if exists barbershops_select on public.salons;
drop policy if exists salons_select on public.salons;
drop policy if exists barbershops_manage on public.salons;
drop policy if exists salons_manage on public.salons;
drop policy if exists branches_scoped_read on public.branches;
drop policy if exists branches_manage_all on public.branches;
drop policy if exists profiles_scoped_read on public.profiles;
drop policy if exists profiles_scoped_update on public.profiles;
drop policy if exists user_roles_scoped_read on public.user_roles;
drop policy if exists user_roles_manage_insert on public.user_roles;
drop policy if exists user_roles_manage_delete on public.user_roles;
drop policy if exists clients_scoped_all on public.clients;
drop policy if exists barbers_scoped_read on public.stylists;
drop policy if exists stylists_scoped_read on public.stylists;
drop policy if exists barbers_manage_all on public.stylists;
drop policy if exists stylists_manage_all on public.stylists;
drop policy if exists services_scoped_read on public.services;
drop policy if exists services_manage_all on public.services;
drop policy if exists service_combo_items_scoped_all on public.service_combo_items;
drop policy if exists appointments_scoped_all on public.appointments;
drop policy if exists appointment_history_scoped_all on public.appointment_history;
drop policy if exists sales_scoped_all on public.sales;
drop policy if exists sale_items_scoped_all on public.sale_items;
drop policy if exists cash_sessions_scoped_all on public.cash_sessions;
drop policy if exists cash_movements_scoped_all on public.cash_movements;
drop policy if exists expenses_scoped_all on public.expenses;
drop policy if exists pos_sales_read_scoped on public.pos_sales;
drop policy if exists pos_sales_insert_scoped on public.pos_sales;
drop policy if exists pos_sales_delete_scoped on public.pos_sales;

create or replace function public.current_salon_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select salon_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.can_access_salon(target_salon_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or (
      target_salon_id is not null
      and target_salon_id = public.current_salon_id()
    );
$$;

create or replace function public.is_salon_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_role('super_admin') or public.has_role('admin');
$$;

drop function if exists public.is_shop_admin_user();

drop function if exists public.can_manage_branch(uuid);

create or replace function public.can_manage_branch(target_salon_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or (
      target_salon_id is not null
      and public.has_role('admin')
      and target_salon_id = public.current_salon_id()
    );
$$;

create or replace function public.can_manage_role_for_user(target_user_id uuid, desired_role text default null)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or (
      public.has_role('admin')
      and desired_role is distinct from 'super_admin'
      and exists (
        select 1
        from public.profiles target_profile
        where target_profile.id = target_user_id
          and target_profile.salon_id = public.current_salon_id()
      )
    );
$$;

create or replace function public.refresh_client_insights(target_client_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_client_id is null then
    return;
  end if;

  with completed_appointments as (
    select
      a.client_id,
      a.stylist_id,
      coalesce(nullif(trim(a.stylist_name), ''), nullif(trim(s.name), ''), nullif(trim(s.full_name), '')) as stylist_display_name,
      nullif(trim(a.service_name), '') as service_name,
      coalesce(a.price, 0)::numeric(12, 2) as price,
      a.appointment_date,
      a.appointment_time
    from public.appointments a
    left join public.stylists s on s.id = a.stylist_id
    where a.client_id = target_client_id
      and a.status = 'finalizada'
  ),
  summary as (
    select
      count(*)::integer as completed_visits,
      coalesce(sum(price), 0)::numeric(12, 2) as total_spent,
      max(appointment_date) as last_visit_at
    from completed_appointments
  ),
  favorite_stylist as (
    select stylist_id, stylist_display_name
    from completed_appointments
    where stylist_id is not null or stylist_display_name is not null
    group by stylist_id, stylist_display_name
    order by count(*) desc, max(appointment_date) desc, max(appointment_time) desc
    limit 1
  ),
  favorite_service as (
    select service_name
    from completed_appointments
    where service_name is not null
    group by service_name
    order by count(*) desc, max(appointment_date) desc, max(appointment_time) desc
    limit 1
  )
  update public.clients c
  set
    completed_visits = coalesce((select summary.completed_visits from summary), 0),
    total_spent = coalesce((select summary.total_spent from summary), 0),
    last_visit_at = (select summary.last_visit_at from summary),
    favorite_stylist_id = (select favorite_stylist.stylist_id from favorite_stylist),
    favorite_stylist_name = (select favorite_stylist.stylist_display_name from favorite_stylist),
    favorite_service_name = (select favorite_service.service_name from favorite_service),
    stats_updated_at = now()
  where c.id = target_client_id;
end;
$$;

create or replace function public.refresh_client_insights_from_appointments()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform public.refresh_client_insights(old.client_id);
    return old;
  end if;

  if tg_op = 'UPDATE' and old.client_id is distinct from new.client_id and old.client_id is not null then
    perform public.refresh_client_insights(old.client_id);
  end if;

  if new.client_id is not null then
    perform public.refresh_client_insights(new.client_id);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_refresh_client_insights_on_appointments on public.appointments;
create trigger trg_refresh_client_insights_on_appointments
after insert or update or delete on public.appointments
for each row execute function public.refresh_client_insights_from_appointments();

drop function if exists public.can_access_barbershop(uuid);
drop function if exists public.current_barbershop_id();

grant usage on schema public to anon, authenticated;
grant select on public.roles to authenticated;
grant select, insert, update, delete on
  public.salons,
  public.branches,
  public.profiles,
  public.user_roles,
  public.clients,
  public.stylists,
  public.services,
  public.service_combo_items,
  public.appointments,
  public.appointment_history,
  public.sales,
  public.sale_items,
  public.cash_sessions,
  public.cash_movements,
  public.expenses,
  public.pos_sales
to authenticated;
grant usage, select on all sequences in schema public to authenticated;

grant execute on function public.has_role(text) to authenticated;
grant execute on function public.is_super_admin_user() to authenticated;
grant execute on function public.is_salon_admin_user() to authenticated;
grant execute on function public.current_salon_id() to authenticated;
grant execute on function public.can_access_salon(uuid) to authenticated;
grant execute on function public.can_manage_branch(uuid) to authenticated;
grant execute on function public.can_manage_role_for_user(uuid, text) to authenticated;
grant execute on function public.refresh_client_insights(uuid) to authenticated;

alter table public.roles enable row level security;
alter table public.salons enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.stylists enable row level security;
alter table public.services enable row level security;
alter table public.service_combo_items enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_history enable row level security;
alter table public.sales enable row level security;
alter table public.sale_items enable row level security;
alter table public.cash_sessions enable row level security;
alter table public.cash_movements enable row level security;
alter table public.expenses enable row level security;
alter table public.pos_sales enable row level security;

drop policy if exists roles_authenticated_read on public.roles;
create policy roles_authenticated_read on public.roles for select to authenticated using (true);

create policy salons_select on public.salons for select to authenticated
using (public.is_super_admin_user() or id = public.current_salon_id());

create policy salons_manage on public.salons for all to authenticated
using (public.is_super_admin_user())
with check (public.is_super_admin_user());

create policy branches_scoped_read on public.branches for select to authenticated
using (public.can_access_salon(salon_id));

create policy branches_manage_all on public.branches for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

create policy profiles_scoped_read on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_super_admin_user()
  or public.can_access_salon(salon_id)
);

create policy profiles_scoped_update on public.profiles for update to authenticated
using (
  public.is_super_admin_user()
  or (public.has_role('admin') and public.can_access_salon(salon_id))
)
with check (
  public.is_super_admin_user()
  or (public.has_role('admin') and public.can_access_salon(salon_id))
);

create policy user_roles_scoped_read on public.user_roles for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin_user()
  or exists (
    select 1
    from public.profiles target_profile
    where target_profile.id = user_roles.user_id
      and public.can_access_salon(target_profile.salon_id)
  )
);

create policy user_roles_manage_insert on public.user_roles for insert to authenticated
with check (public.can_manage_role_for_user(user_id, role_name));

create policy user_roles_manage_delete on public.user_roles for delete to authenticated
using (public.can_manage_role_for_user(user_id, role_name));

create policy clients_scoped_all on public.clients for all to authenticated
using (public.can_access_salon(salon_id))
with check (public.can_access_salon(salon_id));

create policy stylists_scoped_read on public.stylists for select to authenticated
using (public.can_access_salon(salon_id));

create policy stylists_manage_all on public.stylists for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

create policy services_scoped_read on public.services for select to authenticated
using (public.can_access_salon(salon_id));

create policy services_manage_all on public.services for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

create policy service_combo_items_scoped_all on public.service_combo_items for all to authenticated
using (
  exists (
    select 1
    from public.services combo_service
    where combo_service.id = service_combo_items.combo_service_id
      and public.can_access_salon(combo_service.salon_id)
  )
)
with check (
  exists (
    select 1
    from public.services combo_service
    where combo_service.id = service_combo_items.combo_service_id
      and public.can_manage_branch(combo_service.salon_id)
  )
  and exists (
    select 1
    from public.services item_service
    join public.services combo_service on combo_service.id = service_combo_items.combo_service_id
    where item_service.id = service_combo_items.item_service_id
      and item_service.salon_id = combo_service.salon_id
  )
);

create policy appointments_scoped_all on public.appointments for all to authenticated
using (public.can_access_salon(salon_id))
with check (public.can_access_salon(salon_id));

create policy appointment_history_scoped_all on public.appointment_history for all to authenticated
using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_history.appointment_id
      and public.can_access_salon(a.salon_id)
  )
)
with check (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_history.appointment_id
      and public.can_access_salon(a.salon_id)
  )
);

create policy sales_scoped_all on public.sales for all to authenticated
using (public.can_access_salon(salon_id))
with check (public.can_access_salon(salon_id));

create policy sale_items_scoped_all on public.sale_items for all to authenticated
using (public.can_access_salon(salon_id))
with check (public.can_access_salon(salon_id));

create policy cash_sessions_scoped_all on public.cash_sessions for all to authenticated
using (public.can_access_salon(salon_id))
with check (public.can_access_salon(salon_id));

create policy cash_movements_scoped_all on public.cash_movements for all to authenticated
using (public.can_access_salon(salon_id))
with check (public.can_access_salon(salon_id));

create policy expenses_scoped_all on public.expenses for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

create policy pos_sales_read_scoped on public.pos_sales for select to authenticated
using (public.can_access_salon(salon_id));

create policy pos_sales_insert_scoped on public.pos_sales for insert to authenticated
with check (public.can_access_salon(salon_id));

create policy pos_sales_delete_scoped on public.pos_sales for delete to authenticated
using (public.can_manage_branch(salon_id));

notify pgrst, 'reload schema';

commit;
