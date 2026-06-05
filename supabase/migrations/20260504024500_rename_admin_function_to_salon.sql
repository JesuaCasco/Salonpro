begin;

create or replace function public.is_salon_admin_user()
returns boolean
language sql
security definer
set search_path = public
as $$
  select public.has_role('super_admin') or public.has_role('admin');
$$;

grant execute on function public.is_salon_admin_user() to authenticated;

drop function if exists public.is_shop_admin_user();

notify pgrst, 'reload schema';

commit;
