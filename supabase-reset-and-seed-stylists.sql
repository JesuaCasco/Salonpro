-- Limpia los datos operativos de un salón concreto
-- y vuelve a sembrar el staff base con sucursal asignada.
--
-- Antes de correrlo:
-- 1. Asegúrate de que el salón exista.
-- 2. Asegúrate de que las sucursales también existan.
-- 3. Cambia los nombres de salón y sucursal si en tu base usan otros.

begin;

do $$
declare
  v_salon_id uuid;
  v_branch_plaza uuid;
  v_branch_metro uuid;
begin
  select id
  into v_salon_id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1;

  if v_salon_id is null then
    raise exception 'No existe el salón "Salón 1".';
  end if;

  select id
  into v_branch_plaza
  from public.branches
  where salon_id = v_salon_id
    and lower(name) = lower('Plaza Inter')
  limit 1;

  if v_branch_plaza is null then
    raise exception 'No existe la sucursal "Plaza Inter" para "Salón 1".';
  end if;

  select id
  into v_branch_metro
  from public.branches
  where salon_id = v_salon_id
    and lower(name) = lower('Metrocentro')
  limit 1;

  if v_branch_metro is null then
    raise exception 'No existe la sucursal "Metrocentro" para "Salón 1".';
  end if;
end $$;

-- 1) Limpieza operativa del salón objetivo
with target_shop as (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
),
target_sales as (
  select id
  from public.sales
  where salon_id = (select id from target_shop)
),
target_appointments as (
  select id
  from public.appointments
  where salon_id = (select id from target_shop)
)
delete from public.sale_items
where sale_id in (select id from target_sales);

with target_shop as (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
),
target_appointments as (
  select id
  from public.appointments
  where salon_id = (select id from target_shop)
)
delete from public.appointment_history
where appointment_id in (select id from target_appointments);

delete from public.cash_movements
where salon_id = (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
);

delete from public.sales
where salon_id = (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
);

delete from public.cash_sessions
where salon_id = (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
);

delete from public.expenses
where salon_id = (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
);

delete from public.appointments
where salon_id = (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
);

delete from public.clients
where salon_id = (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
);

delete from public.stylists
where salon_id = (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
);

-- 2) Inserción de estilistas base por sucursal
with target_shop as (
  select id
  from public.salons
  where lower(name) = lower('Salón 1')
  limit 1
),
seed as (
  select *
  from (
    values
      (
        'Sofía Color',
        'Sofía Valeria Martínez López',
        '001-150890-1001A',
        '8889-4455',
        'SC',
        'border-indigo-500',
        'bg-indigo-600',
        'shadow-indigo-500/50',
        'salario',
        18000::numeric,
        0::numeric,
        'Quincenal',
        'Senior',
        'Plaza Inter'
      ),
      (
        'Camila Nails',
        'Camila Alejandra García Reyes',
        '001-120591-1002B',
        '8890-5522',
        'CN',
        'border-amber-500',
        'bg-amber-600',
        'shadow-amber-500/50',
        'salario',
        16000::numeric,
        0::numeric,
        'Mensual',
        'Junior',
        'Metrocentro'
      ),
      (
        'Valeria Glow',
        'Valeria Fernanda Hernández Ruiz',
        '001-190694-1003C',
        '8891-6611',
        'VG',
        'border-emerald-500',
        'bg-emerald-600',
        'shadow-emerald-500/50',
        'porcentaje',
        0::numeric,
        12::numeric,
        'Semanal',
        'Junior',
        'Metrocentro'
      ),
      (
        'Isabella Studio',
        'Isabella Mariana Torres Silva',
        '001-080492-1004D',
        '8892-7733',
        'IS',
        'border-rose-500',
        'bg-rose-600',
        'shadow-rose-500/50',
        'salario',
        15500::numeric,
        0::numeric,
        'Mensual',
        'Junior',
        'Plaza Inter'
      ),
      (
        'Lucía Bridal',
        'Lucía Antonella Castillo Vega',
        '001-140693-1005E',
        '8893-8844',
        'LB',
        'border-violet-500',
        'bg-violet-600',
        'shadow-violet-500/50',
        'salario',
        17000::numeric,
        0::numeric,
        'Quincenal',
        'Medium',
        'Metrocentro'
      ),
      (
        'Daniela Spa',
        'Daniela Elena Morales Soto',
        '001-250795-1006F',
        '8894-9955',
        'DS',
        'border-cyan-500',
        'bg-cyan-600',
        'shadow-cyan-500/50',
        'porcentaje',
        0::numeric,
        15::numeric,
        'Diario',
        'Senior',
        'Plaza Inter'
      )
  ) as seeded(
    name,
    full_name,
    cedula,
    phone,
    avatar,
    color,
    bg,
    shadow,
    payment_mode,
    salary,
    commission,
    payment_frequency,
    level,
    branch_name
  )
)
insert into public.stylists (
  id,
  name,
  full_name,
  cedula,
  phone,
  payment_mode,
  salary,
  commission,
  payment_frequency,
  level,
  color,
  bg,
  shadow,
  avatar,
  is_active,
  salon_id,
  branch_id
)
select
  gen_random_uuid(),
  seed.name,
  seed.full_name,
  seed.cedula,
  seed.phone,
  seed.payment_mode,
  seed.salary,
  seed.commission,
  seed.payment_frequency,
  seed.level,
  seed.color,
  seed.bg,
  seed.shadow,
  seed.avatar,
  true,
  target_shop.id,
  branches.id
from seed
cross join target_shop
join public.branches
  on branches.salon_id = target_shop.id
 and lower(branches.name) = lower(seed.branch_name);

commit;

-- Confirmación rápida
select
  b.name as estilista,
  b.full_name,
  b.phone,
  b.payment_mode,
  b.commission,
  bs.name as salon,
  br.name as sucursal
from public.stylists b
left join public.salons bs on bs.id = b.salon_id
left join public.branches br on br.id = b.branch_id
where lower(bs.name) = lower('Salón 1')
order by br.name, b.name;
