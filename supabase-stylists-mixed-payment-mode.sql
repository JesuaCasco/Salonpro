begin;

update public.stylists
set payment_mode = 'salario'
where payment_mode is null
   or btrim(payment_mode) = '';

alter table public.stylists
drop constraint if exists stylists_payment_mode_check;

alter table public.stylists
add constraint stylists_payment_mode_check
check (payment_mode in ('salario', 'porcentaje', 'mixto'));

commit;
