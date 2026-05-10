create table if not exists public.staff_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique,
  staff_id uuid,
  login_identifier text,
  permissions jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.staff_access enable row level security;

create index if not exists idx_staff_access_user_id on public.staff_access(user_id);
create index if not exists idx_staff_access_staff_id on public.staff_access(staff_id);

create trigger trg_staff_access_updated
before update on public.staff_access
for each row execute function public.update_updated_at_column();

drop policy if exists "Admins manage staff_access" on public.staff_access;
create policy "Admins manage staff_access"
on public.staff_access
for all
to authenticated
using (public.is_super_admin(auth.uid()))
with check (public.is_super_admin(auth.uid()));

drop policy if exists "Users view own staff_access" on public.staff_access;
create policy "Users view own staff_access"
on public.staff_access
for select
to authenticated
using (user_id = auth.uid() or public.is_super_admin(auth.uid()));

create or replace function public.sync_staff_access_to_all_shops()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.is_active then
    insert into public.shop_users (user_id, shop_id, staff_id, display_name, email, permissions, is_active)
    select
      new.user_id,
      s.id,
      new.staff_id,
      coalesce(st.name, p.full_name, new.login_identifier),
      new.login_identifier,
      coalesce(new.permissions, '{}'::jsonb),
      true
    from public.shops s
    left join public.staff st on st.id = new.staff_id
    left join public.profiles p on p.user_id = new.user_id
    where s.is_active = true
    on conflict (user_id, shop_id) do update
      set staff_id = excluded.staff_id,
          display_name = excluded.display_name,
          email = excluded.email,
          permissions = excluded.permissions,
          is_active = true,
          updated_at = now();
  else
    update public.shop_users
    set is_active = false, updated_at = now()
    where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_staff_access_to_all_shops on public.staff_access;
create trigger trg_sync_staff_access_to_all_shops
after insert or update of permissions, is_active, staff_id, login_identifier on public.staff_access
for each row execute function public.sync_staff_access_to_all_shops();

create or replace function public.attach_staff_access_to_new_shop()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.shop_users (user_id, shop_id, staff_id, display_name, email, permissions, is_active)
  select
    sa.user_id,
    new.id,
    sa.staff_id,
    coalesce(st.name, p.full_name, sa.login_identifier),
    sa.login_identifier,
    coalesce(sa.permissions, '{}'::jsonb),
    true
  from public.staff_access sa
  left join public.staff st on st.id = sa.staff_id
  left join public.profiles p on p.user_id = sa.user_id
  where sa.is_active = true
  on conflict (user_id, shop_id) do update
    set staff_id = excluded.staff_id,
        display_name = excluded.display_name,
        email = excluded.email,
        permissions = excluded.permissions,
        is_active = true,
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_attach_staff_access_to_new_shop on public.shops;
create trigger trg_attach_staff_access_to_new_shop
after insert on public.shops
for each row execute function public.attach_staff_access_to_new_shop();

insert into public.staff_access (user_id, staff_id, login_identifier, permissions, is_active)
select
  u.id,
  s.id,
  s.phone,
  '{"dashboard": true, "pos": true, "sales": true, "customers": true, "installments": true, "products": true, "warranty": true}'::jsonb,
  coalesce(s.is_active, true)
from public.staff s
join auth.users u on lower(u.email) = lower(regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') || '@staff.local')
on conflict (user_id) do update
  set staff_id = excluded.staff_id,
      login_identifier = excluded.login_identifier,
      permissions = case when public.staff_access.permissions = '{}'::jsonb then excluded.permissions else public.staff_access.permissions end,
      is_active = excluded.is_active,
      updated_at = now();