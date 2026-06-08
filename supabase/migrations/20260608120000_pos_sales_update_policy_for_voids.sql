begin;

drop policy if exists pos_sales_update_scoped on public.pos_sales;
create policy pos_sales_update_scoped on public.pos_sales for update to authenticated
using (public.can_manage_branch(salon_id))
with check (public.can_manage_branch(salon_id));

notify pgrst, 'reload schema';

commit;
