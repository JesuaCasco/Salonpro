-- Permite registrar pagos de nomina como salidas formales de caja.

alter table if exists public.cash_movements
  drop constraint if exists cash_movements_kind_check;

alter table if exists public.cash_movements
  add constraint cash_movements_kind_check
  check (movement_kind in ('opening', 'sale', 'manual', 'closing_adjustment', 'payroll_payment'));
