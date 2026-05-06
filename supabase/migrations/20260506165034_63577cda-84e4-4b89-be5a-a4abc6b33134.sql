create table if not exists public.cash_book (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid,
  entry_date date not null default current_date,
  entry_type text not null check (entry_type in ('deposit','withdraw')),
  amount numeric not null default 0,
  category text,
  payment_method text default 'cash',
  reference_no text,
  party_name text,
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

alter table public.cash_book enable row level security;

create policy "Shop read cashbook" on public.cash_book
  for select to authenticated
  using (shop_id is null or public.user_can_access_shop(auth.uid(), shop_id));

create policy "Auth create cashbook" on public.cash_book
  for insert to authenticated
  with check (auth.uid() = created_by);

create policy "Admin manage cashbook" on public.cash_book
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role))
  with check (public.has_role(auth.uid(), 'admin'::app_role));

create index if not exists cash_book_shop_date_idx on public.cash_book(shop_id, entry_date desc);