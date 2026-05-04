create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.roles (
  role_name text primary key,
  description text,
  created_at timestamptz not null default now()
);

create table if not exists public.barbershops (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  owner_email text,
  phone text,
  city text,
  plan text not null default 'starter',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  name text not null,
  code text,
  city text,
  address text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  full_name text,
  barbershop_id uuid references public.barbershops(id) on delete set null,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role_name text not null references public.roles(role_name) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role_name)
);

create table if not exists public.barbers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  full_name text,
  cedula text,
  phone text,
  email text,
  payment_mode text not null default 'salario',
  salary numeric(12,2) not null default 0,
  commission numeric(12,2) not null default 0,
  payment_frequency text not null default 'Quincenal',
  level text not null default 'Junior',
  color text,
  bg text,
  shadow text,
  avatar text,
  is_active boolean not null default true,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint barbers_payment_mode_check check (payment_mode in ('salario', 'porcentaje', 'mixto'))
);

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  notes text,
  points integer not null default 0,
  completed_visits integer not null default 0,
  total_spent numeric(12,2) not null default 0,
  last_visit_at date,
  favorite_barber_id uuid references public.barbers(id) on delete set null,
  favorite_barber_name text,
  favorite_service_name text,
  stats_updated_at timestamptz,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null,
  price numeric(12,2) not null default 0,
  applies_to text,
  discount_type text,
  discount_value numeric(12,2) not null default 0,
  target_service_ids jsonb not null default '[]'::jsonb,
  is_optional boolean not null default true,
  is_active boolean not null default true,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_category_check check (category in ('Cortes', 'Barba', 'Producto', 'Combo', 'Promocion')),
  constraint services_applies_to_check check (applies_to is null or applies_to in ('General')),
  constraint services_discount_type_check check (discount_type is null or discount_type in ('percentage', 'fixed'))
);

create table if not exists public.service_combo_items (
  combo_service_id uuid not null references public.services(id) on delete cascade,
  item_service_id uuid not null references public.services(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (combo_service_id, item_service_id)
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid references public.clients(id) on delete set null,
  barber_id uuid references public.barbers(id) on delete set null,
  barber_name text,
  service_id uuid references public.services(id) on delete set null,
  service_name text,
  price numeric(10,2) not null default 0,
  gross_amount numeric(10,2) not null default 0,
  discount_amount numeric(10,2) not null default 0,
  promotion_name text,
  appointment_date date not null,
  appointment_time time not null,
  duration_minutes integer not null default 30,
  type text not null default 'reserva',
  status text not null default 'confirmada',
  cancellation_reason text,
  check_in_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  cancelled_at timestamptz,
  reminder_sent_at timestamptz,
  client_confirmed_at timestamptz,
  is_paid boolean not null default false,
  rating integer,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_history (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid references public.appointments(id) on delete cascade,
  action text,
  details jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sales (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.sale_items (
  id uuid primary key default gen_random_uuid(),
  sale_id uuid references public.sales(id) on delete cascade,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  description text,
  quantity integer not null default 1,
  price numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.cash_sessions (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  opened_by uuid references public.profiles(id) on delete set null,
  closed_by uuid references public.profiles(id) on delete set null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  opening_amount numeric(12,2) not null default 0,
  closing_amount numeric(12,2)
);

create table if not exists public.cash_movements (
  id uuid primary key default gen_random_uuid(),
  cash_session_id uuid references public.cash_sessions(id) on delete cascade,
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  type text,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  barbershop_id uuid references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  category text,
  amount numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.pos_sales (
  id uuid primary key default gen_random_uuid(),
  ticket_number bigint generated always as identity unique,
  barbershop_id uuid not null references public.barbershops(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  raw_subtotal numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  subtotal numeric(12,2) not null default 0,
  product_total numeric(12,2) not null default 0,
  service_total numeric(12,2) not null default 0,
  items jsonb not null default '[]'::jsonb,
  promotion_id text,
  promotion_name text,
  discount_label text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists idx_branches_barbershop_name on public.branches (barbershop_id, lower(name));
create index if not exists idx_profiles_barbershop_id on public.profiles (barbershop_id);
create index if not exists idx_profiles_branch_id on public.profiles (branch_id);
create index if not exists idx_user_roles_user_id on public.user_roles (user_id);
create index if not exists idx_clients_barbershop_id on public.clients (barbershop_id);
create index if not exists idx_clients_branch_id on public.clients (branch_id);
create index if not exists idx_barbers_barbershop_id on public.barbers (barbershop_id);
create index if not exists idx_barbers_branch_id on public.barbers (branch_id);
create index if not exists idx_services_barbershop_id on public.services (barbershop_id);
create index if not exists idx_services_branch_id on public.services (branch_id);
create index if not exists idx_appointments_barbershop_id on public.appointments (barbershop_id);
create index if not exists idx_appointments_branch_id on public.appointments (branch_id);
create index if not exists idx_appointments_client_status_date on public.appointments (client_id, status, appointment_date desc, appointment_time desc);
create index if not exists idx_pos_sales_barbershop_created_at on public.pos_sales (barbershop_id, created_at desc);
create index if not exists idx_pos_sales_branch_created_at on public.pos_sales (branch_id, created_at desc);

drop trigger if exists trg_barbershops_updated_at on public.barbershops;
create trigger trg_barbershops_updated_at before update on public.barbershops for each row execute function public.set_updated_at();
drop trigger if exists trg_branches_updated_at on public.branches;
create trigger trg_branches_updated_at before update on public.branches for each row execute function public.set_updated_at();
drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
drop trigger if exists trg_clients_updated_at on public.clients;
create trigger trg_clients_updated_at before update on public.clients for each row execute function public.set_updated_at();
drop trigger if exists trg_barbers_updated_at on public.barbers;
create trigger trg_barbers_updated_at before update on public.barbers for each row execute function public.set_updated_at();
drop trigger if exists trg_services_updated_at on public.services;
create trigger trg_services_updated_at before update on public.services for each row execute function public.set_updated_at();
drop trigger if exists trg_appointments_updated_at on public.appointments;
create trigger trg_appointments_updated_at before update on public.appointments for each row execute function public.set_updated_at();

insert into public.roles (role_name, description)
values
  ('super_admin', 'Control total de la plataforma SalonPro'),
  ('admin', 'Administra un salon y su configuracion'),
  ('cashier', 'Opera agenda, clientes y caja')
on conflict (role_name) do update
set description = excluded.description;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email)
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(public.profiles.full_name, excluded.full_name);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_create_profile on auth.users;
create trigger on_auth_user_created_create_profile
after insert on auth.users
for each row execute function public.handle_new_auth_user();

create or replace function public.has_role(target_role text)
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role_name = target_role
  );
$$;

create or replace function public.is_super_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_role('super_admin');
$$;

create or replace function public.is_shop_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_role('super_admin') or public.has_role('admin');
$$;

create or replace function public.current_barbershop_id()
returns uuid
language sql
security definer
set search_path = public
as $$
  select barbershop_id
  from public.profiles
  where id = auth.uid();
$$;

create or replace function public.can_access_barbershop(target_barbershop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or (
      target_barbershop_id is not null
      and target_barbershop_id = public.current_barbershop_id()
    );
$$;

create or replace function public.can_manage_branch(target_barbershop_id uuid)
returns boolean
language sql
security definer
set search_path = public
as $$
  select
    public.is_super_admin_user()
    or (
      target_barbershop_id is not null
      and public.has_role('admin')
      and target_barbershop_id = public.current_barbershop_id()
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
          and target_profile.barbershop_id = public.current_barbershop_id()
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
      a.barber_id,
      coalesce(nullif(trim(a.barber_name), ''), nullif(trim(b.name), ''), nullif(trim(b.full_name), '')) as barber_display_name,
      nullif(trim(a.service_name), '') as service_name,
      coalesce(a.price, 0)::numeric(12, 2) as price,
      a.appointment_date,
      a.appointment_time
    from public.appointments a
    left join public.barbers b on b.id = a.barber_id
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
  favorite_barber as (
    select barber_id, barber_display_name
    from completed_appointments
    where barber_id is not null or barber_display_name is not null
    group by barber_id, barber_display_name
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
    favorite_barber_id = (select favorite_barber.barber_id from favorite_barber),
    favorite_barber_name = (select favorite_barber.barber_display_name from favorite_barber),
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

grant usage on schema public to anon, authenticated;
grant select on public.roles to authenticated;
grant select, insert, update, delete on
  public.barbershops,
  public.branches,
  public.profiles,
  public.user_roles,
  public.clients,
  public.barbers,
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
grant execute on function public.is_shop_admin_user() to authenticated;
grant execute on function public.current_barbershop_id() to authenticated;
grant execute on function public.can_access_barbershop(uuid) to authenticated;
grant execute on function public.can_manage_branch(uuid) to authenticated;
grant execute on function public.can_manage_role_for_user(uuid, text) to authenticated;

alter table public.roles enable row level security;
alter table public.barbershops enable row level security;
alter table public.branches enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.clients enable row level security;
alter table public.barbers enable row level security;
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

drop policy if exists barbershops_select on public.barbershops;
create policy barbershops_select on public.barbershops for select to authenticated
using (public.is_super_admin_user() or id = public.current_barbershop_id());

drop policy if exists barbershops_manage on public.barbershops;
create policy barbershops_manage on public.barbershops for all to authenticated
using (public.is_super_admin_user())
with check (public.is_super_admin_user());

drop policy if exists branches_scoped_read on public.branches;
create policy branches_scoped_read on public.branches for select to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists branches_manage_all on public.branches;
create policy branches_manage_all on public.branches for all to authenticated
using (public.can_manage_branch(barbershop_id))
with check (public.can_manage_branch(barbershop_id));

drop policy if exists profiles_scoped_read on public.profiles;
create policy profiles_scoped_read on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_super_admin_user()
  or public.can_access_barbershop(barbershop_id)
);

drop policy if exists profiles_scoped_update on public.profiles;
create policy profiles_scoped_update on public.profiles for update to authenticated
using (
  public.is_super_admin_user()
  or (public.has_role('admin') and public.can_access_barbershop(barbershop_id))
)
with check (
  public.is_super_admin_user()
  or (public.has_role('admin') and public.can_access_barbershop(barbershop_id))
);

drop policy if exists user_roles_scoped_read on public.user_roles;
create policy user_roles_scoped_read on public.user_roles for select to authenticated
using (
  user_id = auth.uid()
  or public.is_super_admin_user()
  or exists (
    select 1
    from public.profiles target_profile
    where target_profile.id = user_roles.user_id
      and public.can_access_barbershop(target_profile.barbershop_id)
  )
);

drop policy if exists user_roles_manage_insert on public.user_roles;
create policy user_roles_manage_insert on public.user_roles for insert to authenticated
with check (public.can_manage_role_for_user(user_id, role_name));

drop policy if exists user_roles_manage_delete on public.user_roles;
create policy user_roles_manage_delete on public.user_roles for delete to authenticated
using (public.can_manage_role_for_user(user_id, role_name));

drop policy if exists clients_scoped_all on public.clients;
create policy clients_scoped_all on public.clients for all to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists barbers_scoped_read on public.barbers;
create policy barbers_scoped_read on public.barbers for select to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists barbers_manage_all on public.barbers;
create policy barbers_manage_all on public.barbers for all to authenticated
using (public.can_manage_branch(barbershop_id))
with check (public.can_manage_branch(barbershop_id));

drop policy if exists services_scoped_read on public.services;
create policy services_scoped_read on public.services for select to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists services_manage_all on public.services;
create policy services_manage_all on public.services for all to authenticated
using (public.can_manage_branch(barbershop_id))
with check (public.can_manage_branch(barbershop_id));

drop policy if exists service_combo_items_scoped_all on public.service_combo_items;
create policy service_combo_items_scoped_all on public.service_combo_items for all to authenticated
using (
  exists (
    select 1
    from public.services combo_service
    where combo_service.id = service_combo_items.combo_service_id
      and public.can_access_barbershop(combo_service.barbershop_id)
  )
)
with check (
  exists (
    select 1
    from public.services combo_service
    where combo_service.id = service_combo_items.combo_service_id
      and public.can_manage_branch(combo_service.barbershop_id)
  )
  and exists (
    select 1
    from public.services item_service
    join public.services combo_service on combo_service.id = service_combo_items.combo_service_id
    where item_service.id = service_combo_items.item_service_id
      and item_service.barbershop_id = combo_service.barbershop_id
  )
);

drop policy if exists appointments_scoped_all on public.appointments;
create policy appointments_scoped_all on public.appointments for all to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists appointment_history_scoped_all on public.appointment_history;
create policy appointment_history_scoped_all on public.appointment_history for all to authenticated
using (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_history.appointment_id
      and public.can_access_barbershop(a.barbershop_id)
  )
)
with check (
  exists (
    select 1 from public.appointments a
    where a.id = appointment_history.appointment_id
      and public.can_access_barbershop(a.barbershop_id)
  )
);

drop policy if exists sales_scoped_all on public.sales;
create policy sales_scoped_all on public.sales for all to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists sale_items_scoped_all on public.sale_items;
create policy sale_items_scoped_all on public.sale_items for all to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists cash_sessions_scoped_all on public.cash_sessions;
create policy cash_sessions_scoped_all on public.cash_sessions for all to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists cash_movements_scoped_all on public.cash_movements;
create policy cash_movements_scoped_all on public.cash_movements for all to authenticated
using (public.can_access_barbershop(barbershop_id))
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists expenses_scoped_all on public.expenses;
create policy expenses_scoped_all on public.expenses for all to authenticated
using (public.can_manage_branch(barbershop_id))
with check (public.can_manage_branch(barbershop_id));

drop policy if exists pos_sales_read_scoped on public.pos_sales;
create policy pos_sales_read_scoped on public.pos_sales for select to authenticated
using (public.can_access_barbershop(barbershop_id));

drop policy if exists pos_sales_insert_scoped on public.pos_sales;
create policy pos_sales_insert_scoped on public.pos_sales for insert to authenticated
with check (public.can_access_barbershop(barbershop_id));

drop policy if exists pos_sales_delete_scoped on public.pos_sales;
create policy pos_sales_delete_scoped on public.pos_sales for delete to authenticated
using (public.can_manage_branch(barbershop_id));

notify pgrst, 'reload schema';
