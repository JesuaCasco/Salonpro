begin;

alter table if exists public.appointments
  add column if not exists paid_at timestamptz;

create table if not exists public.payroll_payments (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  stylist_id uuid references public.stylists(id) on delete set null,
  payment_scope text not null default 'individual',
  period_start date,
  period_end date,
  payment_date timestamptz not null default now(),
  payment_method text not null default 'cash',
  base_amount numeric(12,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  total_amount numeric(12,2) not null default 0,
  services_count integer not null default 0,
  sales_total numeric(12,2) not null default 0,
  commission_rate numeric(6,2) not null default 0,
  notes text,
  status text not null default 'paid',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint payroll_payments_scope_check check (payment_scope in ('individual', 'batch')),
  constraint payroll_payments_method_check check (payment_method in ('cash', 'card', 'transfer', 'mixed', 'other')),
  constraint payroll_payments_status_check check (status in ('paid', 'void'))
);

create table if not exists public.payroll_payment_items (
  id uuid primary key default gen_random_uuid(),
  payroll_payment_id uuid not null references public.payroll_payments(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  stylist_id uuid references public.stylists(id) on delete set null,
  service_name text,
  service_amount numeric(12,2) not null default 0,
  commission_rate numeric(6,2) not null default 0,
  commission_amount numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_payroll_payments_salon_date on public.payroll_payments (salon_id, payment_date desc);
create index if not exists idx_payroll_payments_branch_date on public.payroll_payments (branch_id, payment_date desc);
create index if not exists idx_payroll_payments_stylist_date on public.payroll_payments (stylist_id, payment_date desc);
create index if not exists idx_payroll_payment_items_payment on public.payroll_payment_items (payroll_payment_id);
create index if not exists idx_payroll_payment_items_appointment on public.payroll_payment_items (appointment_id);

drop trigger if exists trg_payroll_payments_updated_at on public.payroll_payments;
create trigger trg_payroll_payments_updated_at
before update on public.payroll_payments
for each row execute function public.set_updated_at();

alter table public.payroll_payments enable row level security;
alter table public.payroll_payment_items enable row level security;

drop policy if exists payroll_payments_scoped_all on public.payroll_payments;
create policy payroll_payments_scoped_all on public.payroll_payments for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

drop policy if exists payroll_payment_items_scoped_all on public.payroll_payment_items;
create policy payroll_payment_items_scoped_all on public.payroll_payment_items for all to authenticated
using (
  exists (
    select 1
    from public.payroll_payments p
    where p.id = payroll_payment_id
      and public.can_manage_branch(p.salon_id)
  )
)
with check (
  exists (
    select 1
    from public.payroll_payments p
    where p.id = payroll_payment_id
      and public.can_manage_branch(p.salon_id)
  )
);

notify pgrst, 'reload schema';

commit;
