begin;

alter table if exists public.salons
  add column if not exists open_time time not null default '08:00',
  add column if not exists close_time time not null default '18:00';

alter table if exists public.salons
  drop constraint if exists salons_business_hours_check;

alter table if exists public.salons
  add constraint salons_business_hours_check
  check (close_time > open_time);

notify pgrst, 'reload schema';

commit;
