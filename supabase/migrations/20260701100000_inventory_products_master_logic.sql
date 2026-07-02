begin;

alter table if exists public.inventory_items
  add column if not exists product_name text,
  add column if not exists product_category text not null default 'Otros',
  add column if not exists usage_type text not null default 'retail',
  add column if not exists sale_price numeric(12,2) not null default 0,
  add column if not exists notes text;

alter table if exists public.inventory_items drop constraint if exists inventory_items_usage_type_check;
alter table if exists public.inventory_items
  add constraint inventory_items_usage_type_check
  check (usage_type in ('retail', 'internal', 'both'));

alter table if exists public.inventory_items drop constraint if exists inventory_items_sale_price_check;
alter table if exists public.inventory_items
  add constraint inventory_items_sale_price_check
  check (sale_price >= 0);

update public.inventory_items ii
set
  product_name = coalesce(nullif(ii.product_name, ''), s.name),
  product_category = coalesce(nullif(ii.product_category, ''), 'Reventa'),
  usage_type = case
    when ii.usage_type in ('retail', 'internal', 'both') then ii.usage_type
    else 'retail'
  end,
  sale_price = case
    when coalesce(ii.sale_price, 0) > 0 then ii.sale_price
    else coalesce(s.price, 0)
  end
from public.services s
where s.id = ii.service_id;

update public.inventory_items
set product_name = coalesce(nullif(product_name, ''), 'Producto sin nombre')
where product_name is null or btrim(product_name) = '';

create index if not exists idx_inventory_items_usage_type on public.inventory_items (usage_type);
create index if not exists idx_inventory_items_product_category on public.inventory_items (product_category);
create index if not exists idx_inventory_items_product_name on public.inventory_items (lower(product_name));

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
    product_name,
    product_category,
    usage_type,
    sale_price,
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
    s.name,
    'Reventa',
    'retail',
    coalesce(s.price, 0),
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

notify pgrst, 'reload schema';

commit;
