begin;

update public.services
set category = 'Tratamientos'
where category = 'Tratamiento';

update public.services
set category = 'Cabello'
where category = 'Color';

alter table if exists public.services drop constraint if exists services_category_check;

alter table if exists public.services
  add constraint services_category_check
  check (category in ('Cabello', 'Tratamientos', 'Facial', U&'U\00F1as', 'Producto', 'Combo', 'Promocion'));

notify pgrst, 'reload schema';

commit;
