-- Allow staff login accounts to be created without immediate shop assignment.
-- Existing shop assignment behavior is preserved when shop_id is provided.

create or replace function public.is_super_admin(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = _user_id
      and role in ('super_admin'::app_role, 'admin'::app_role)
  )
$$;