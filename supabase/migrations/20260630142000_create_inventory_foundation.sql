begin;

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  service_id uuid references public.services(id) on delete cascade,
  sku text,
  barcode text,
  unit_name text not null default 'unidad',
  track_stock boolean not null default true,
  min_stock numeric(12,2) not null default 0,
  max_stock numeric(12,2),
  cost_price numeric(12,2) not null default 0,
  current_stock numeric(12,2) not null default 0,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_items_stock_nonnegative check (current_stock >= 0),
  constraint inventory_items_min_stock_nonnegative check (min_stock >= 0),
  constraint inventory_items_max_stock_check check (max_stock is null or max_stock >= min_stock),
  constraint inventory_items_cost_nonnegative check (cost_price >= 0)
);

create unique index if not exists idx_inventory_items_service_branch_unique
  on public.inventory_items (service_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where service_id is not null;

create unique index if not exists idx_inventory_items_sku_branch_unique
  on public.inventory_items (salon_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(sku))
  where sku is not null and btrim(sku) <> '';

create index if not exists idx_inventory_items_salon_branch on public.inventory_items (salon_id, branch_id);
create index if not exists idx_inventory_items_service_id on public.inventory_items (service_id);

drop trigger if exists trg_inventory_items_updated_at on public.inventory_items;
create trigger trg_inventory_items_updated_at
before update on public.inventory_items
for each row execute function public.set_updated_at();

create table if not exists public.inventory_suppliers (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  name text not null,
  phone text,
  email text,
  contact_name text,
  notes text,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_inventory_suppliers_name_branch_unique
  on public.inventory_suppliers (salon_id, coalesce(branch_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

drop trigger if exists trg_inventory_suppliers_updated_at on public.inventory_suppliers;
create trigger trg_inventory_suppliers_updated_at
before update on public.inventory_suppliers
for each row execute function public.set_updated_at();

create table if not exists public.inventory_purchases (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  supplier_id uuid references public.inventory_suppliers(id) on delete set null,
  purchase_number bigint generated always as identity unique,
  purchase_date timestamptz not null default now(),
  status text not null default 'received',
  subtotal numeric(12,2) not null default 0,
  tax_total numeric(12,2) not null default 0,
  discount_total numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_purchases_status_check check (status in ('draft', 'received', 'cancelled'))
);

create index if not exists idx_inventory_purchases_salon_date on public.inventory_purchases (salon_id, purchase_date desc);
create index if not exists idx_inventory_purchases_branch_date on public.inventory_purchases (branch_id, purchase_date desc);

drop trigger if exists trg_inventory_purchases_updated_at on public.inventory_purchases;
create trigger trg_inventory_purchases_updated_at
before update on public.inventory_purchases
for each row execute function public.set_updated_at();

create table if not exists public.inventory_purchase_items (
  id uuid primary key default gen_random_uuid(),
  purchase_id uuid not null references public.inventory_purchases(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2) not null default 0,
  total_cost numeric(12,2) generated always as (quantity * unit_cost) stored,
  created_at timestamptz not null default now(),
  constraint inventory_purchase_items_quantity_check check (quantity > 0),
  constraint inventory_purchase_items_cost_check check (unit_cost >= 0)
);

create index if not exists idx_inventory_purchase_items_purchase on public.inventory_purchase_items (purchase_id);
create index if not exists idx_inventory_purchase_items_item on public.inventory_purchase_items (inventory_item_id);

create table if not exists public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  service_id uuid references public.services(id) on delete set null,
  movement_type text not null,
  reason text not null default 'manual_adjustment',
  quantity numeric(12,2) not null,
  unit_cost numeric(12,2),
  unit_price numeric(12,2),
  previous_stock numeric(12,2) not null default 0,
  new_stock numeric(12,2) not null default 0,
  reference_type text,
  reference_id uuid,
  cash_session_id uuid references public.cash_sessions(id) on delete set null,
  pos_sale_id uuid references public.pos_sales(id) on delete set null,
  purchase_id uuid references public.inventory_purchases(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint inventory_movements_type_check check (movement_type in ('in', 'out', 'adjustment')),
  constraint inventory_movements_reason_check check (reason in ('initial_stock', 'purchase', 'sale', 'service_use', 'manual_adjustment', 'stock_count', 'return', 'loss', 'void_sale', 'correction')),
  constraint inventory_movements_quantity_positive check (quantity > 0)
);

create index if not exists idx_inventory_movements_item_created on public.inventory_movements (inventory_item_id, created_at desc);
create index if not exists idx_inventory_movements_salon_created on public.inventory_movements (salon_id, created_at desc);
create index if not exists idx_inventory_movements_branch_created on public.inventory_movements (branch_id, created_at desc);
create index if not exists idx_inventory_movements_reference on public.inventory_movements (reference_type, reference_id);
create index if not exists idx_inventory_movements_pos_sale on public.inventory_movements (pos_sale_id);

create table if not exists public.inventory_stock_counts (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  count_number bigint generated always as identity unique,
  counted_at timestamptz not null default now(),
  status text not null default 'draft',
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  approved_by uuid references public.profiles(id) on delete set null,
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint inventory_stock_counts_status_check check (status in ('draft', 'approved', 'cancelled'))
);

create index if not exists idx_inventory_stock_counts_salon_date on public.inventory_stock_counts (salon_id, counted_at desc);
create index if not exists idx_inventory_stock_counts_branch_date on public.inventory_stock_counts (branch_id, counted_at desc);

drop trigger if exists trg_inventory_stock_counts_updated_at on public.inventory_stock_counts;
create trigger trg_inventory_stock_counts_updated_at
before update on public.inventory_stock_counts
for each row execute function public.set_updated_at();

create table if not exists public.inventory_stock_count_items (
  id uuid primary key default gen_random_uuid(),
  stock_count_id uuid not null references public.inventory_stock_counts(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  system_stock numeric(12,2) not null default 0,
  counted_stock numeric(12,2) not null default 0,
  difference numeric(12,2) generated always as (counted_stock - system_stock) stored,
  notes text,
  created_at timestamptz not null default now(),
  unique (stock_count_id, inventory_item_id)
);

create index if not exists idx_inventory_stock_count_items_count on public.inventory_stock_count_items (stock_count_id);
create index if not exists idx_inventory_stock_count_items_item on public.inventory_stock_count_items (inventory_item_id);

create table if not exists public.service_product_usage (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.salons(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  service_id uuid not null references public.services(id) on delete cascade,
  inventory_item_id uuid not null references public.inventory_items(id) on delete restrict,
  quantity numeric(12,2) not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint service_product_usage_quantity_check check (quantity > 0)
);

create unique index if not exists idx_service_product_usage_unique
  on public.service_product_usage (service_id, inventory_item_id)
  where is_active = true;

create index if not exists idx_service_product_usage_service on public.service_product_usage (service_id);
create index if not exists idx_service_product_usage_item on public.service_product_usage (inventory_item_id);

drop trigger if exists trg_service_product_usage_updated_at on public.service_product_usage;
create trigger trg_service_product_usage_updated_at
before update on public.service_product_usage
for each row execute function public.set_updated_at();

create or replace function public.ensure_inventory_items_for_products(
  p_salon_id uuid,
  p_branch_id uuid default null,
  p_created_by uuid default null
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_inserted integer := 0;
begin
  insert into public.inventory_items (
    salon_id,
    branch_id,
    service_id,
    unit_name,
    track_stock,
    cost_price,
    current_stock,
    created_by,
    updated_by
  )
  select
    s.salon_id,
    coalesce(s.branch_id, p_branch_id),
    s.id,
    'unidad',
    true,
    0,
    0,
    p_created_by,
    p_created_by
  from public.services s
  where s.salon_id = p_salon_id
    and s.category = 'Producto'
    and s.is_active = true
    and (p_branch_id is null or s.branch_id is null or s.branch_id = p_branch_id)
    and not exists (
      select 1
      from public.inventory_items ii
      where ii.service_id = s.id
        and coalesce(ii.branch_id, '00000000-0000-0000-0000-000000000000'::uuid) =
            coalesce(coalesce(s.branch_id, p_branch_id), '00000000-0000-0000-0000-000000000000'::uuid)
    );

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

create or replace function public.register_inventory_movement_atomic(
  p_inventory_item_id uuid,
  p_movement_type text,
  p_reason text,
  p_quantity numeric,
  p_unit_cost numeric default null,
  p_unit_price numeric default null,
  p_reference_type text default null,
  p_reference_id uuid default null,
  p_cash_session_id uuid default null,
  p_pos_sale_id uuid default null,
  p_purchase_id uuid default null,
  p_notes text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_item public.inventory_items%rowtype;
  v_previous_stock numeric(12,2);
  v_new_stock numeric(12,2);
  v_quantity numeric(12,2) := coalesce(p_quantity, 0);
  v_movement public.inventory_movements%rowtype;
begin
  if v_quantity <= 0 then
    raise exception 'La cantidad del movimiento debe ser mayor que cero.';
  end if;

  select *
  into v_item
  from public.inventory_items
  where id = p_inventory_item_id
    and is_active = true
  for update;

  if not found then
    raise exception 'No se encontro el producto de inventario.';
  end if;

  v_previous_stock := coalesce(v_item.current_stock, 0);
  v_new_stock := case
    when p_movement_type = 'in' then v_previous_stock + v_quantity
    when p_movement_type = 'out' then v_previous_stock - v_quantity
    when p_movement_type = 'adjustment' then v_quantity
    else null
  end;

  if v_new_stock is null then
    raise exception 'Tipo de movimiento de inventario no valido.';
  end if;

  if v_new_stock < 0 then
    raise exception 'No hay suficiente stock para realizar este movimiento.';
  end if;

  update public.inventory_items
  set
    current_stock = v_new_stock,
    cost_price = coalesce(p_unit_cost, cost_price),
    updated_by = p_created_by,
    updated_at = now()
  where id = v_item.id;

  insert into public.inventory_movements (
    salon_id,
    branch_id,
    inventory_item_id,
    service_id,
    movement_type,
    reason,
    quantity,
    unit_cost,
    unit_price,
    previous_stock,
    new_stock,
    reference_type,
    reference_id,
    cash_session_id,
    pos_sale_id,
    purchase_id,
    notes,
    metadata,
    created_by
  )
  values (
    v_item.salon_id,
    v_item.branch_id,
    v_item.id,
    v_item.service_id,
    p_movement_type,
    p_reason,
    v_quantity,
    p_unit_cost,
    p_unit_price,
    v_previous_stock,
    v_new_stock,
    p_reference_type,
    p_reference_id,
    p_cash_session_id,
    p_pos_sale_id,
    p_purchase_id,
    p_notes,
    coalesce(p_metadata, '{}'::jsonb),
    p_created_by
  )
  returning * into v_movement;

  return jsonb_build_object(
    'item', to_jsonb(v_item) || jsonb_build_object('current_stock', v_new_stock),
    'movement', to_jsonb(v_movement)
  );
end;
$$;

alter table public.inventory_items enable row level security;
alter table public.inventory_suppliers enable row level security;
alter table public.inventory_purchases enable row level security;
alter table public.inventory_purchase_items enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.inventory_stock_counts enable row level security;
alter table public.inventory_stock_count_items enable row level security;
alter table public.service_product_usage enable row level security;

drop policy if exists inventory_items_read_scoped on public.inventory_items;
create policy inventory_items_read_scoped on public.inventory_items for select to authenticated
using (public.can_access_salon(salon_id));

drop policy if exists inventory_items_manage_scoped on public.inventory_items;
create policy inventory_items_manage_scoped on public.inventory_items for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

drop policy if exists inventory_suppliers_read_scoped on public.inventory_suppliers;
create policy inventory_suppliers_read_scoped on public.inventory_suppliers for select to authenticated
using (public.can_access_salon(salon_id));

drop policy if exists inventory_suppliers_manage_scoped on public.inventory_suppliers;
create policy inventory_suppliers_manage_scoped on public.inventory_suppliers for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

drop policy if exists inventory_purchases_read_scoped on public.inventory_purchases;
create policy inventory_purchases_read_scoped on public.inventory_purchases for select to authenticated
using (public.can_access_salon(salon_id));

drop policy if exists inventory_purchases_manage_scoped on public.inventory_purchases;
create policy inventory_purchases_manage_scoped on public.inventory_purchases for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

drop policy if exists inventory_purchase_items_read_scoped on public.inventory_purchase_items;
create policy inventory_purchase_items_read_scoped on public.inventory_purchase_items for select to authenticated
using (
  exists (
    select 1
    from public.inventory_purchases p
    where p.id = inventory_purchase_items.purchase_id
      and public.can_access_salon(p.salon_id)
  )
);

drop policy if exists inventory_purchase_items_manage_scoped on public.inventory_purchase_items;
create policy inventory_purchase_items_manage_scoped on public.inventory_purchase_items for all to authenticated
using (
  exists (
    select 1
    from public.inventory_purchases p
    where p.id = inventory_purchase_items.purchase_id
      and public.can_manage_branch(p.salon_id)
  )
)
with check (
  exists (
    select 1
    from public.inventory_purchases p
    where p.id = inventory_purchase_items.purchase_id
      and public.can_manage_branch(p.salon_id)
  )
);

drop policy if exists inventory_movements_read_scoped on public.inventory_movements;
create policy inventory_movements_read_scoped on public.inventory_movements for select to authenticated
using (public.can_access_salon(salon_id));

drop policy if exists inventory_movements_manage_scoped on public.inventory_movements;
create policy inventory_movements_manage_scoped on public.inventory_movements for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

drop policy if exists inventory_stock_counts_read_scoped on public.inventory_stock_counts;
create policy inventory_stock_counts_read_scoped on public.inventory_stock_counts for select to authenticated
using (public.can_access_salon(salon_id));

drop policy if exists inventory_stock_counts_manage_scoped on public.inventory_stock_counts;
create policy inventory_stock_counts_manage_scoped on public.inventory_stock_counts for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

drop policy if exists inventory_stock_count_items_read_scoped on public.inventory_stock_count_items;
create policy inventory_stock_count_items_read_scoped on public.inventory_stock_count_items for select to authenticated
using (
  exists (
    select 1
    from public.inventory_stock_counts c
    where c.id = inventory_stock_count_items.stock_count_id
      and public.can_access_salon(c.salon_id)
  )
);

drop policy if exists inventory_stock_count_items_manage_scoped on public.inventory_stock_count_items;
create policy inventory_stock_count_items_manage_scoped on public.inventory_stock_count_items for all to authenticated
using (
  exists (
    select 1
    from public.inventory_stock_counts c
    where c.id = inventory_stock_count_items.stock_count_id
      and public.can_manage_branch(c.salon_id)
  )
)
with check (
  exists (
    select 1
    from public.inventory_stock_counts c
    where c.id = inventory_stock_count_items.stock_count_id
      and public.can_manage_branch(c.salon_id)
  )
);

drop policy if exists service_product_usage_read_scoped on public.service_product_usage;
create policy service_product_usage_read_scoped on public.service_product_usage for select to authenticated
using (public.can_access_salon(salon_id));

drop policy if exists service_product_usage_manage_scoped on public.service_product_usage;
create policy service_product_usage_manage_scoped on public.service_product_usage for all to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

grant execute on function public.ensure_inventory_items_for_products(uuid, uuid, uuid) to authenticated;
grant execute on function public.register_inventory_movement_atomic(uuid, text, text, numeric, numeric, numeric, text, uuid, uuid, uuid, uuid, text, jsonb, uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
