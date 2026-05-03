
-- Shops table
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  owner_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.shop_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  staff_id UUID,
  display_name TEXT,
  email TEXT,
  permissions JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, shop_id)
);
ALTER TABLE public.shop_users ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('super_admin','admin'))
$$;

CREATE OR REPLACE FUNCTION public.user_in_shop(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.shop_users WHERE user_id = _user_id AND shop_id = _shop_id AND is_active = true)
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_shop(_user_id UUID, _shop_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_super_admin(_user_id) OR public.user_in_shop(_user_id, _shop_id)
$$;

DROP POLICY IF EXISTS "Super admin manage shops" ON public.shops;
CREATE POLICY "Super admin manage shops" ON public.shops FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Members read shops" ON public.shops;
CREATE POLICY "Members read shops" ON public.shops FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR public.user_in_shop(auth.uid(), id));

DROP POLICY IF EXISTS "Super admin manage shop_users" ON public.shop_users;
CREATE POLICY "Super admin manage shop_users" ON public.shop_users FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()));
DROP POLICY IF EXISTS "Users view own shop_users" ON public.shop_users;
CREATE POLICY "Users view own shop_users" ON public.shop_users FOR SELECT TO authenticated
  USING (public.is_super_admin(auth.uid()) OR user_id = auth.uid());

ALTER TABLE public.products            ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.customers           ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.suppliers           ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.sales               ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.sale_items          ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.purchases           ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.purchase_items      ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.expenses            ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.expense_categories  ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.stock_adjustments   ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.staff               ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.attendance          ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.installments        ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.installment_payments ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.guarantors          ADD COLUMN IF NOT EXISTS shop_id UUID;
ALTER TABLE public.categories          ADD COLUMN IF NOT EXISTS shop_id UUID;

CREATE INDEX IF NOT EXISTS idx_products_shop ON public.products(shop_id);
CREATE INDEX IF NOT EXISTS idx_customers_shop ON public.customers(shop_id);
CREATE INDEX IF NOT EXISTS idx_sales_shop ON public.sales(shop_id);
CREATE INDEX IF NOT EXISTS idx_purchases_shop ON public.purchases(shop_id);
CREATE INDEX IF NOT EXISTS idx_expenses_shop ON public.expenses(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_users_user ON public.shop_users(user_id);
CREATE INDEX IF NOT EXISTS idx_shop_users_shop ON public.shop_users(shop_id);

-- Update read policies to enforce shop scoping
DROP POLICY IF EXISTS "Auth read products" ON public.products;
CREATE POLICY "Shop read products" ON public.products FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read customers" ON public.customers;
CREATE POLICY "Shop read customers" ON public.customers FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read suppliers" ON public.suppliers;
CREATE POLICY "Shop read suppliers" ON public.suppliers FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read sales" ON public.sales;
CREATE POLICY "Shop read sales" ON public.sales FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read purchases" ON public.purchases;
CREATE POLICY "Shop read purchases" ON public.purchases FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read expenses" ON public.expenses;
CREATE POLICY "Shop read expenses" ON public.expenses FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read staff" ON public.staff;
CREATE POLICY "Shop read staff" ON public.staff FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read attendance" ON public.attendance;
CREATE POLICY "Shop read attendance" ON public.attendance FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read installments" ON public.installments;
CREATE POLICY "Shop read installments" ON public.installments FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP POLICY IF EXISTS "Auth read sadj" ON public.stock_adjustments;
CREATE POLICY "Shop read sadj" ON public.stock_adjustments FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

DROP TRIGGER IF EXISTS trg_shops_updated ON public.shops;
CREATE TRIGGER trg_shops_updated BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_shop_users_updated ON public.shop_users;
CREATE TRIGGER trg_shop_users_updated BEFORE UPDATE ON public.shop_users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
