begin;

alter table if exists public.cash_sessions
  add column if not exists status text not null default 'open',
  add column if not exists expected_cash_amount numeric(12,2) not null default 0,
  add column if not exists counted_cash_amount numeric(12,2),
  add column if not exists difference_amount numeric(12,2),
  add column if not exists notes text;

alter table if exists public.cash_sessions drop constraint if exists cash_sessions_status_check;
alter table if exists public.cash_sessions
  add constraint cash_sessions_status_check check (status in ('open', 'closed'));

update public.cash_sessions
set status = case when closed_at is null then 'open' else 'closed' end
where status is null;

alter table if exists public.cash_movements
  add column if not exists movement_kind text not null default 'manual',
  add column if not exists payment_method text not null default 'cash',
  add column if not exists reference_type text,
  add column if not exists reference_id uuid;

alter table if exists public.cash_movements drop constraint if exists cash_movements_type_check;
alter table if exists public.cash_movements
  add constraint cash_movements_type_check check (type in ('in', 'out'));

alter table if exists public.cash_movements drop constraint if exists cash_movements_payment_method_check;
alter table if exists public.cash_movements
  add constraint cash_movements_payment_method_check check (payment_method in ('cash', 'card', 'transfer', 'mixed', 'other'));

alter table if exists public.cash_movements drop constraint if exists cash_movements_kind_check;
alter table if exists public.cash_movements
  add constraint cash_movements_kind_check check (movement_kind in ('opening', 'sale', 'manual', 'closing_adjustment'));

alter table if exists public.pos_sales
  add column if not exists cash_session_id uuid references public.cash_sessions(id) on delete set null,
  add column if not exists payment_method text not null default 'cash';

alter table if exists public.pos_sales drop constraint if exists pos_sales_payment_method_check;
alter table if exists public.pos_sales
  add constraint pos_sales_payment_method_check check (payment_method in ('cash', 'card', 'transfer', 'mixed', 'other'));

create index if not exists idx_cash_sessions_branch_status on public.cash_sessions (branch_id, status, opened_at desc);
create index if not exists idx_cash_movements_session_created_at on public.cash_movements (cash_session_id, created_at desc);
create index if not exists idx_pos_sales_cash_session_id on public.pos_sales (cash_session_id);

create unique index if not exists idx_cash_sessions_one_open_per_branch
  on public.cash_sessions (salon_id, branch_id)
  where status = 'open' and closed_at is null;

create or replace function public.open_cash_session_atomic(
  p_salon_id uuid,
  p_branch_id uuid,
  p_opened_by uuid,
  p_opening_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_movement public.cash_movements%rowtype;
  v_opening_amount numeric(12,2) := greatest(coalesce(p_opening_amount, 0), 0);
begin
  insert into public.cash_sessions (
    salon_id,
    branch_id,
    opened_by,
    opening_amount,
    expected_cash_amount,
    status,
    notes
  )
  values (
    p_salon_id,
    p_branch_id,
    p_opened_by,
    v_opening_amount,
    v_opening_amount,
    'open',
    p_notes
  )
  returning * into v_session;

  insert into public.cash_movements (
    cash_session_id,
    salon_id,
    branch_id,
    type,
    movement_kind,
    payment_method,
    amount,
    notes,
    reference_type,
    reference_id,
    created_by
  )
  values (
    v_session.id,
    p_salon_id,
    p_branch_id,
    'in',
    'opening',
    'cash',
    v_opening_amount,
    coalesce(p_notes, 'Apertura de caja'),
    'cash_session',
    v_session.id,
    p_opened_by
  )
  returning * into v_movement;

  return jsonb_build_object(
    'session', to_jsonb(v_session),
    'movement', to_jsonb(v_movement)
  );
exception
  when unique_violation then
    raise exception 'Ya hay una caja abierta para esta sucursal.';
end;
$$;

create or replace function public.register_pos_sale_atomic(
  p_sale_id uuid,
  p_salon_id uuid,
  p_branch_id uuid,
  p_cash_session_id uuid,
  p_payment_method text,
  p_raw_subtotal numeric,
  p_discount_total numeric,
  p_subtotal numeric,
  p_product_total numeric,
  p_service_total numeric,
  p_items jsonb,
  p_promotion_id text default null,
  p_promotion_name text default null,
  p_discount_label text default null,
  p_notes text default null,
  p_created_by uuid default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_sale public.pos_sales%rowtype;
  v_movement public.cash_movements%rowtype;
  v_payment_method text := coalesce(nullif(p_payment_method, ''), 'cash');
begin
  select *
  into v_session
  from public.cash_sessions
  where id = p_cash_session_id
    and salon_id = p_salon_id
    and branch_id = p_branch_id
    and status = 'open'
    and closed_at is null
  for update;

  if not found then
    raise exception 'La caja seleccionada no está abierta o no pertenece a esta sucursal.';
  end if;

  insert into public.pos_sales (
    id,
    salon_id,
    branch_id,
    cash_session_id,
    payment_method,
    raw_subtotal,
    discount_total,
    subtotal,
    product_total,
    service_total,
    items,
    promotion_id,
    promotion_name,
    discount_label,
    notes,
    created_by
  )
  values (
    coalesce(p_sale_id, gen_random_uuid()),
    p_salon_id,
    p_branch_id,
    v_session.id,
    v_payment_method,
    coalesce(p_raw_subtotal, p_subtotal, 0),
    coalesce(p_discount_total, 0),
    coalesce(p_subtotal, 0),
    coalesce(p_product_total, 0),
    coalesce(p_service_total, 0),
    coalesce(p_items, '[]'::jsonb),
    p_promotion_id,
    p_promotion_name,
    p_discount_label,
    p_notes,
    p_created_by
  )
  returning * into v_sale;

  if v_payment_method = 'cash' then
    insert into public.cash_movements (
      cash_session_id,
      salon_id,
      branch_id,
      type,
      movement_kind,
      payment_method,
      amount,
      notes,
      reference_type,
      reference_id,
      created_by
    )
    values (
      v_session.id,
      p_salon_id,
      p_branch_id,
      'in',
      'sale',
      'cash',
      coalesce(v_sale.subtotal, 0),
      'Venta POS #' || coalesce(v_sale.ticket_number::text, '0'),
      'pos_sale',
      v_sale.id,
      p_created_by
    )
    returning * into v_movement;
  end if;

  return jsonb_build_object(
    'sale', to_jsonb(v_sale),
    'movement', case when v_movement.id is null then null else to_jsonb(v_movement) end
  );
end;
$$;

create or replace function public.cancel_pos_sale_atomic(
  p_sale_id uuid,
  p_salon_id uuid,
  p_branch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_sale public.pos_sales%rowtype;
  v_session public.cash_sessions%rowtype;
begin
  select *
  into v_sale
  from public.pos_sales
  where id = p_sale_id
    and salon_id = p_salon_id
    and branch_id = p_branch_id
  for update;

  if not found then
    raise exception 'No se encontró la venta para cancelar.';
  end if;

  if v_sale.cash_session_id is not null then
    select *
    into v_session
    from public.cash_sessions
    where id = v_sale.cash_session_id
      and salon_id = p_salon_id
      and branch_id = p_branch_id
    for update;

    if not found or v_session.status <> 'open' or v_session.closed_at is not null then
      raise exception 'No se puede cancelar una venta de una caja cerrada.';
    end if;
  end if;

  delete from public.cash_movements
  where reference_type = 'pos_sale'
    and reference_id = v_sale.id
    and cash_session_id = v_sale.cash_session_id;

  delete from public.pos_sales
  where id = v_sale.id;

  return to_jsonb(v_sale);
end;
$$;

create or replace function public.close_cash_session_atomic(
  p_cash_session_id uuid,
  p_salon_id uuid,
  p_branch_id uuid,
  p_closed_by uuid,
  p_counted_cash_amount numeric,
  p_notes text default null
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_session public.cash_sessions%rowtype;
  v_expected_cash numeric(12,2);
  v_counted_cash numeric(12,2) := greatest(coalesce(p_counted_cash_amount, 0), 0);
begin
  select coalesce(sum(
    case
      when payment_method <> 'cash' then 0
      when type = 'out' then -amount
      else amount
    end
  ), 0)
  into v_expected_cash
  from public.cash_movements
  where cash_session_id = p_cash_session_id;

  update public.cash_sessions
  set
    closed_by = p_closed_by,
    closed_at = now(),
    closing_amount = v_counted_cash,
    counted_cash_amount = v_counted_cash,
    expected_cash_amount = v_expected_cash,
    difference_amount = v_counted_cash - v_expected_cash,
    status = 'closed',
    notes = p_notes
  where id = p_cash_session_id
    and salon_id = p_salon_id
    and branch_id = p_branch_id
    and status = 'open'
    and closed_at is null
  returning * into v_session;

  if not found then
    raise exception 'No hay una caja abierta para cerrar.';
  end if;

  return to_jsonb(v_session);
end;
$$;

create or replace function public.cancel_cash_movement_atomic(
  p_movement_id uuid,
  p_salon_id uuid,
  p_branch_id uuid
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_movement public.cash_movements%rowtype;
  v_session public.cash_sessions%rowtype;
begin
  select *
  into v_movement
  from public.cash_movements
  where id = p_movement_id
    and salon_id = p_salon_id
    and branch_id = p_branch_id
    and movement_kind = 'manual'
  for update;

  if not found then
    raise exception 'No se encontró el movimiento manual para anular.';
  end if;

  select *
  into v_session
  from public.cash_sessions
  where id = v_movement.cash_session_id
    and salon_id = p_salon_id
    and branch_id = p_branch_id
  for update;

  if not found or v_session.status <> 'open' or v_session.closed_at is not null then
    raise exception 'No se puede anular un movimiento de una caja cerrada.';
  end if;

  delete from public.cash_movements
  where id = v_movement.id;

  return to_jsonb(v_movement);
end;
$$;

notify pgrst, 'reload schema';

commit;
