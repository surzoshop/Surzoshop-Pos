-- ============================================================
-- COMPLETE DATABASE SCHEMA (Easy Kisti Shop)
-- Generated: 2026-07-07T07:07:31Z
-- Source: consolidated Supabase migrations
-- Usage: Run this on a fresh Supabase project (SQL Editor)
-- ============================================================


-- ============================================================
-- Migration: 20260503052859_d3c9135a-9f73-43cd-ad4c-e48643a4c75c.sql
-- ============================================================
-- ROLES
CREATE TYPE public.app_role AS ENUM ('admin', 'cashier');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "Users view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PROFILES
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own profile" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- TIMESTAMP TRIGGER FN
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- AUTO PROFILE + FIRST USER = ADMIN
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  user_count INT;
BEGIN
  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email));

  SELECT COUNT(*) INTO user_count FROM auth.users;
  IF user_count = 1 THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'cashier');
  END IF;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- CATEGORIES
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read categories" ON public.categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage categories" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- PRODUCTS
CREATE TABLE public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  barcode TEXT UNIQUE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  price NUMERIC(12,2) NOT NULL DEFAULT 0,
  cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  stock INTEGER NOT NULL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_products_barcode ON public.products(barcode);
CREATE INDEX idx_products_name ON public.products(name);
CREATE POLICY "Auth read products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage products" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_products_updated BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- CUSTOMERS
CREATE TABLE public.customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  nid TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_customers_phone ON public.customers(phone);
CREATE POLICY "Auth read customers" ON public.customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin update customers" ON public.customers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete customers" ON public.customers FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- SALES
CREATE TYPE public.payment_type AS ENUM ('cash','installment');
CREATE TYPE public.sale_status AS ENUM ('completed','partial','cancelled');

CREATE SEQUENCE public.invoice_seq START 1000;

CREATE TABLE public.sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_no TEXT NOT NULL UNIQUE DEFAULT ('INV-' || nextval('public.invoice_seq')::text),
  customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  due NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_type payment_type NOT NULL DEFAULT 'cash',
  status sale_status NOT NULL DEFAULT 'completed',
  notes TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_sales_created_at ON public.sales(created_at DESC);
CREATE POLICY "Auth read sales" ON public.sales FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create sales" ON public.sales FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admin update sales" ON public.sales FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete sales" ON public.sales FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- SALE ITEMS
CREATE TABLE public.sale_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id),
  product_name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price NUMERIC(12,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read sale_items" ON public.sale_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create sale_items" ON public.sale_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage sale_items" ON public.sale_items FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- STOCK DECREMENT TRIGGER
CREATE OR REPLACE FUNCTION public.decrement_stock()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock = stock - NEW.qty WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER trg_decrement_stock AFTER INSERT ON public.sale_items FOR EACH ROW EXECUTE FUNCTION public.decrement_stock();

-- INSTALLMENTS
CREATE TYPE public.installment_status AS ENUM ('pending','paid','overdue');

CREATE TABLE public.installments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id UUID NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  installment_no INTEGER NOT NULL,
  due_date DATE NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  status installment_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_installments_due_date ON public.installments(due_date);
CREATE POLICY "Auth read installments" ON public.installments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create installments" ON public.installments FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth update installments" ON public.installments FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admin delete installments" ON public.installments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- INSTALLMENT PAYMENTS
CREATE TABLE public.installment_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  installment_id UUID NOT NULL REFERENCES public.installments(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  received_by UUID REFERENCES auth.users(id),
  note TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.installment_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read inst_payments" ON public.installment_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create inst_payments" ON public.installment_payments FOR INSERT TO authenticated WITH CHECK (auth.uid() = received_by);
CREATE POLICY "Admin delete inst_payments" ON public.installment_payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin'));

-- AUTO-UPDATE INSTALLMENT + SALE ON PAYMENT
CREATE OR REPLACE FUNCTION public.apply_installment_payment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_sale_id UUID;
  v_amount NUMERIC;
  v_paid NUMERIC;
BEGIN
  UPDATE public.installments
  SET paid_amount = paid_amount + NEW.amount,
      status = CASE WHEN paid_amount + NEW.amount >= amount THEN 'paid'::installment_status ELSE status END
  WHERE id = NEW.installment_id
  RETURNING sale_id INTO v_sale_id;

  UPDATE public.sales
  SET paid = paid + NEW.amount,
      due = GREATEST(due - NEW.amount, 0),
      status = CASE WHEN due - NEW.amount <= 0 THEN 'completed'::sale_status ELSE 'partial'::sale_status END
  WHERE id = v_sale_id;

  RETURN NEW;
END; $$;
CREATE TRIGGER trg_apply_inst_payment AFTER INSERT ON public.installment_payments FOR EACH ROW EXECUTE FUNCTION public.apply_installment_payment();

-- ============================================================
-- Migration: 20260503060728_84d6818d-8779-4b74-ac41-312f1623e81b.sql
-- ============================================================

-- ============ EXTEND CUSTOMERS WITH KYC ============
ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS photo_url text,
  ADD COLUMN IF NOT EXISTS nid_front_url text,
  ADD COLUMN IF NOT EXISTS nid_back_url text,
  ADD COLUMN IF NOT EXISTS present_address text,
  ADD COLUMN IF NOT EXISTS permanent_address text,
  ADD COLUMN IF NOT EXISTS occupation text,
  ADD COLUMN IF NOT EXISTS monthly_income numeric;

-- ============ GUARANTORS ============
CREATE TABLE IF NOT EXISTS public.guarantors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE CASCADE,
  sale_id uuid,
  name text NOT NULL,
  nid text,
  phone text,
  address text,
  relation text,
  photo_url text,
  nid_front_url text,
  nid_back_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.guarantors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read guarantors" ON public.guarantors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create guarantors" ON public.guarantors FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin update guarantors" ON public.guarantors FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete guarantors" ON public.guarantors FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE TRIGGER guarantors_updated BEFORE UPDATE ON public.guarantors FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ EXTEND SALES WITH LOAN TERMS ============
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS down_payment numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS interest_rate numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tenure_months integer,
  ADD COLUMN IF NOT EXISTS emi_amount numeric,
  ADD COLUMN IF NOT EXISTS late_fee_per_day numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS agreement_url text,
  ADD COLUMN IF NOT EXISTS guarantor_id uuid REFERENCES public.guarantors(id);

-- ============ SUPPLIERS ============
CREATE TABLE IF NOT EXISTS public.suppliers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  address text,
  contact_person text,
  opening_balance numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read suppliers" ON public.suppliers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER suppliers_updated BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PURCHASES ============
CREATE SEQUENCE IF NOT EXISTS purchase_seq START 1000;
CREATE TABLE IF NOT EXISTS public.purchases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no text NOT NULL DEFAULT ('PUR-'|| nextval('purchase_seq')::text),
  supplier_id uuid REFERENCES public.suppliers(id),
  subtotal numeric NOT NULL DEFAULT 0,
  discount numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  due numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read purchases" ON public.purchases FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create purchases" ON public.purchases FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admin update purchases" ON public.purchases FOR UPDATE TO authenticated USING (has_role(auth.uid(),'admin'));
CREATE POLICY "Admin delete purchases" ON public.purchases FOR DELETE TO authenticated USING (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.purchase_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL REFERENCES public.purchases(id) ON DELETE CASCADE,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  qty integer NOT NULL,
  unit_cost numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read pitems" ON public.purchase_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create pitems" ON public.purchase_items FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage pitems" ON public.purchase_items FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- Auto-increment stock on purchase_items insert
CREATE OR REPLACE FUNCTION public.increment_stock_on_purchase()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.products SET stock = stock + NEW.qty, cost = NEW.unit_cost WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;
CREATE TRIGGER purchase_items_stock AFTER INSERT ON public.purchase_items FOR EACH ROW EXECUTE FUNCTION public.increment_stock_on_purchase();

-- ============ EXPENSES ============
CREATE TABLE IF NOT EXISTS public.expense_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read ecat" ON public.expense_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage ecat" ON public.expense_categories FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE TABLE IF NOT EXISTS public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.expense_categories(id),
  title text NOT NULL,
  amount numeric NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  payment_method text DEFAULT 'cash',
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read expenses" ON public.expenses FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create expenses" ON public.expenses FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admin manage expenses" ON public.expenses FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ STOCK ADJUSTMENTS ============
DO $$ BEGIN
  CREATE TYPE adjustment_type AS ENUM ('damage','return','count','transfer_in','transfer_out');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.stock_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  type adjustment_type NOT NULL,
  qty integer NOT NULL,
  reason text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.stock_adjustments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read sadj" ON public.stock_adjustments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth create sadj" ON public.stock_adjustments FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admin manage sadj" ON public.stock_adjustments FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.apply_stock_adjustment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.type IN ('damage','transfer_out') THEN
    UPDATE public.products SET stock = GREATEST(stock - NEW.qty,0) WHERE id = NEW.product_id;
  ELSIF NEW.type IN ('return','transfer_in') THEN
    UPDATE public.products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
  ELSIF NEW.type = 'count' THEN
    UPDATE public.products SET stock = NEW.qty WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stock_adj_apply AFTER INSERT ON public.stock_adjustments FOR EACH ROW EXECUTE FUNCTION public.apply_stock_adjustment();

-- ============ STAFF & ATTENDANCE ============
CREATE TABLE IF NOT EXISTS public.staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  nid text,
  address text,
  position text,
  salary numeric NOT NULL DEFAULT 0,
  joined_at date DEFAULT CURRENT_DATE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.staff ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read staff" ON public.staff FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage staff" ON public.staff FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$ BEGIN
  CREATE TYPE attendance_status AS ENUM ('present','absent','leave','half_day');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  status attendance_status NOT NULL DEFAULT 'present',
  check_in time,
  check_out time,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(staff_id, date)
);
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth read attendance" ON public.attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage attendance" ON public.attendance FOR ALL TO authenticated USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- ============ STORAGE BUCKET FOR DOCS ============
INSERT INTO storage.buckets (id, name, public) VALUES ('kyc-docs','kyc-docs', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Auth read kyc" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'kyc-docs');
CREATE POLICY "Auth upload kyc" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'kyc-docs');
CREATE POLICY "Admin delete kyc" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'kyc-docs' AND has_role(auth.uid(),'admin'));


-- ============================================================
-- Migration: 20260503063426_86a7a620-7e3a-4ee2-8c99-6b5bf06e525f.sql
-- ============================================================

ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'staff';


-- ============================================================
-- Migration: 20260503063537_2e162dad-5604-4df7-9edf-ac27598972d6.sql
-- ============================================================

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


-- ============================================================
-- Migration: 20260503134023_b7f55041-a44f-4917-9383-176b8edd27be.sql
-- ============================================================

-- Public storage bucket for product images
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg','image/png','image/webp'];

-- Public read
create policy "Public read product-images"
on storage.objects for select
using (bucket_id = 'product-images');

-- Admin upload
create policy "Admin insert product-images"
on storage.objects for insert
to authenticated
with check (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'::app_role));

-- Admin update
create policy "Admin update product-images"
on storage.objects for update
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'::app_role));

-- Admin delete
create policy "Admin delete product-images"
on storage.objects for delete
to authenticated
using (bucket_id = 'product-images' and public.has_role(auth.uid(), 'admin'::app_role));


-- ============================================================
-- Migration: 20260503135119_eb795bf1-afa2-4423-a264-c7691f0f17f4.sql
-- ============================================================

-- Fix is_super_admin to only match super_admin role
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'super_admin')
$function$;

-- Categories
DROP POLICY IF EXISTS "Auth read categories" ON public.categories;
CREATE POLICY "Shop read categories" ON public.categories
  FOR SELECT TO authenticated
  USING ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id));

-- Guarantors
DROP POLICY IF EXISTS "Auth read guarantors" ON public.guarantors;
CREATE POLICY "Shop read guarantors" ON public.guarantors
  FOR SELECT TO authenticated
  USING ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id));

-- Installment payments
DROP POLICY IF EXISTS "Auth read inst_payments" ON public.installment_payments;
CREATE POLICY "Shop read inst_payments" ON public.installment_payments
  FOR SELECT TO authenticated
  USING ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id));

-- Sale items
DROP POLICY IF EXISTS "Auth read sale_items" ON public.sale_items;
CREATE POLICY "Shop read sale_items" ON public.sale_items
  FOR SELECT TO authenticated
  USING ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id));

-- Purchase items
DROP POLICY IF EXISTS "Auth read pitems" ON public.purchase_items;
CREATE POLICY "Shop read pitems" ON public.purchase_items
  FOR SELECT TO authenticated
  USING ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id));

-- Expense categories
DROP POLICY IF EXISTS "Auth read ecat" ON public.expense_categories;
CREATE POLICY "Shop read ecat" ON public.expense_categories
  FOR SELECT TO authenticated
  USING ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id));

-- KYC storage: scope by first folder = shop_id
DROP POLICY IF EXISTS "Auth read kyc" ON storage.objects;
CREATE POLICY "Shop read kyc" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'kyc-docs'
    AND public.user_can_access_shop(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS "Auth upload kyc" ON storage.objects;
CREATE POLICY "Shop upload kyc" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'kyc-docs'
    AND public.user_can_access_shop(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );


-- ============================================================
-- Migration: 20260503135218_d5f57db7-02a6-447d-9590-d268d0557c4c.sql
-- ============================================================
DROP POLICY IF EXISTS "Public read product-images" ON storage.objects;

-- ============================================================
-- Migration: 20260503135629_1813bc28-b7ef-47da-a8ac-4e8886705b0e.sql
-- ============================================================

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_in_shop(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.user_can_access_shop(uuid, uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.decrement_stock() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_installment_payment() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_stock_on_purchase() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_stock_adjustment() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, public, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_in_shop(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.user_can_access_shop(uuid, uuid) TO authenticated;


-- ============================================================
-- Migration: 20260504061613_d8c7c00e-e71e-44ee-956b-ae037ef5fedd.sql
-- ============================================================
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_warranty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_months integer;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS warranty_until date;

CREATE INDEX IF NOT EXISTS idx_sale_items_warranty_until ON public.sale_items(warranty_until) WHERE warranty_until IS NOT NULL;

-- ============================================================
-- Migration: 20260504105312_d5b059b5-4259-4478-a1ca-c5a293c532ab.sql
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS public.barcode_serial_seq START WITH 1000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_barcode_serial()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.barcode_serial_seq');
$$;

GRANT EXECUTE ON FUNCTION public.next_barcode_serial() TO authenticated;

-- ============================================================
-- Migration: 20260506161555_fc0fbaf9-064c-465c-bd5f-2ef91cdda4b7.sql
-- ============================================================

-- 1. Low stock threshold on products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS low_stock_threshold integer NOT NULL DEFAULT 5;

-- 2. sales_returns
CREATE TABLE IF NOT EXISTS public.sales_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL,
  shop_id uuid,
  return_no text NOT NULL DEFAULT ('RET-' || to_char(now(),'YYMMDDHH24MISS')),
  reason text,
  refund_amount numeric NOT NULL DEFAULT 0,
  total_amount numeric NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.sales_return_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  return_id uuid NOT NULL REFERENCES public.sales_returns(id) ON DELETE CASCADE,
  shop_id uuid,
  product_id uuid NOT NULL,
  product_name text NOT NULL,
  qty integer NOT NULL,
  unit_price numeric NOT NULL,
  subtotal numeric NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.sales_returns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_return_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop read returns" ON public.sales_returns FOR SELECT TO authenticated
  USING (shop_id IS NULL OR user_can_access_shop(auth.uid(), shop_id));
CREATE POLICY "Auth create returns" ON public.sales_returns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admin manage returns" ON public.sales_returns FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE POLICY "Shop read return_items" ON public.sales_return_items FOR SELECT TO authenticated
  USING (shop_id IS NULL OR user_can_access_shop(auth.uid(), shop_id));
CREATE POLICY "Auth create return_items" ON public.sales_return_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admin manage return_items" ON public.sales_return_items FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

-- restock on return item
CREATE OR REPLACE FUNCTION public.restock_on_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.products SET stock = stock + NEW.qty WHERE id = NEW.product_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_restock_on_return ON public.sales_return_items;
CREATE TRIGGER trg_restock_on_return AFTER INSERT ON public.sales_return_items
FOR EACH ROW EXECUTE FUNCTION public.restock_on_return();

-- 3. purchase_payments
CREATE TABLE IF NOT EXISTS public.purchase_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id uuid NOT NULL,
  shop_id uuid,
  amount numeric NOT NULL,
  payment_method text DEFAULT 'cash',
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);
ALTER TABLE public.purchase_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop read pp" ON public.purchase_payments FOR SELECT TO authenticated
  USING (shop_id IS NULL OR user_can_access_shop(auth.uid(), shop_id));
CREATE POLICY "Auth create pp" ON public.purchase_payments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admin manage pp" ON public.purchase_payments FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.apply_purchase_payment()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  UPDATE public.purchases
  SET paid = paid + NEW.amount,
      due  = GREATEST(due - NEW.amount, 0)
  WHERE id = NEW.purchase_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_apply_purchase_payment ON public.purchase_payments;
CREATE TRIGGER trg_apply_purchase_payment AFTER INSERT ON public.purchase_payments
FOR EACH ROW EXECUTE FUNCTION public.apply_purchase_payment();


-- ============================================================
-- Migration: 20260506165034_63577cda-84e4-4b89-be5a-a4abc6b33134.sql
-- ============================================================
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

-- ============================================================
-- Migration: 20260507170637_8115e795-fecf-4dc2-a50e-897174f94faf.sql
-- ============================================================
-- 1) user_roles: prevent admin self-escalation to super_admin
DROP POLICY IF EXISTS "Admins manage roles" ON public.user_roles;

CREATE POLICY "Super admins manage super_admin role"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.is_super_admin(auth.uid()))
WITH CHECK (public.is_super_admin(auth.uid()));

CREATE POLICY "Admins manage non-super roles"
ON public.user_roles
AS PERMISSIVE
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role)
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND role <> 'super_admin'::app_role);

-- 2) Shop-scope INSERT policies
DROP POLICY IF EXISTS "Auth create customers" ON public.customers;
CREATE POLICY "Auth create customers"
ON public.customers FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id)));

DROP POLICY IF EXISTS "Auth create installments" ON public.installments;
CREATE POLICY "Auth create installments"
ON public.installments FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id)));

DROP POLICY IF EXISTS "Auth create guarantors" ON public.guarantors;
CREATE POLICY "Auth create guarantors"
ON public.guarantors FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id)));

DROP POLICY IF EXISTS "Auth create sale_items" ON public.sale_items;
CREATE POLICY "Auth create sale_items"
ON public.sale_items FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id)));

DROP POLICY IF EXISTS "Auth create pitems" ON public.purchase_items;
CREATE POLICY "Auth create pitems"
ON public.purchase_items FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL AND (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id)));

-- 3) installments UPDATE shop scope
DROP POLICY IF EXISTS "Auth update installments" ON public.installments;
CREATE POLICY "Auth update installments"
ON public.installments FOR UPDATE TO authenticated
USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id))
WITH CHECK (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

-- ============================================================
-- Migration: 20260507181848_8adc23f8-e419-4786-9acd-c881729c743f.sql
-- ============================================================
DELETE FROM sale_items WHERE sale_id = '740ef95c-d59b-4af3-bf7a-f6ae8a03cfef';
DELETE FROM sales WHERE id = '740ef95c-d59b-4af3-bf7a-f6ae8a03cfef';
UPDATE products SET stock = stock + 1 WHERE id = '423ac85d-7963-4f77-a5cb-b9949036e8d9';

-- ============================================================
-- Migration: 20260507184737_a0a11dc3-23d2-446c-8c6f-336bb0a69f85.sql
-- ============================================================
ALTER TABLE public.customers ADD COLUMN IF NOT EXISTS alt_phone text;

-- ============================================================
-- Migration: 20260508182022_5011f7be-37db-4b4e-8eff-fa0a1e90c39f.sql
-- ============================================================
CREATE OR REPLACE FUNCTION public.recompute_purchase_totals(_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
  FROM public.purchase_items WHERE purchase_id = _purchase_id;

  SELECT COALESCE(discount, 0) INTO v_discount
  FROM public.purchases WHERE id = _purchase_id;

  v_total := GREATEST(v_subtotal - v_discount, 0);

  UPDATE public.purchases
  SET subtotal = v_subtotal, total = v_total, paid = v_total, due = 0
  WHERE id = _purchase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_purchase_history_from_product_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.cost IS DISTINCT FROM OLD.cost OR NEW.name IS DISTINCT FROM OLD.name) THEN
    UPDATE public.purchase_items
    SET unit_cost = NEW.cost,
        subtotal = qty * NEW.cost,
        product_name = NEW.name
    WHERE product_id = NEW.id;

    FOR r IN SELECT DISTINCT purchase_id FROM public.purchase_items WHERE product_id = NEW.id LOOP
      PERFORM public.recompute_purchase_totals(r.purchase_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_purchase_history_from_product_cost ON public.products;
CREATE TRIGGER trg_sync_purchase_history_from_product_cost
AFTER UPDATE OF cost, name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_purchase_history_from_product_cost();

CREATE OR REPLACE FUNCTION public.sync_product_cost_after_purchase_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_id uuid;
  r record;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.purchase_items
    SET unit_cost = NEW.unit_cost,
        subtotal = qty * NEW.unit_cost,
        product_name = NEW.product_name
    WHERE product_id = NEW.product_id AND id <> NEW.id;

    UPDATE public.products
    SET cost = NEW.unit_cost,
        name = COALESCE(NULLIF(NEW.product_name, ''), name)
    WHERE id = NEW.product_id
      AND (cost IS DISTINCT FROM NEW.unit_cost OR name IS DISTINCT FROM COALESCE(NULLIF(NEW.product_name, ''), name));
  END IF;

  FOR r IN SELECT DISTINCT purchase_id FROM public.purchase_items WHERE product_id = v_product_id LOOP
    PERFORM public.recompute_purchase_totals(r.purchase_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_cost_after_purchase_item_change ON public.purchase_items;
CREATE TRIGGER trg_sync_product_cost_after_purchase_item_change
AFTER INSERT OR UPDATE OF unit_cost, qty, subtotal, product_name OR DELETE ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_cost_after_purchase_item_change();

-- Backfill: sync existing purchase_items with current product cost, then recompute totals
UPDATE public.purchase_items pi
SET unit_cost = p.cost,
    subtotal = pi.qty * p.cost,
    product_name = p.name
FROM public.products p
WHERE pi.product_id = p.id
  AND (pi.unit_cost IS DISTINCT FROM p.cost OR pi.product_name IS DISTINCT FROM p.name);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT id FROM public.purchases LOOP
    PERFORM public.recompute_purchase_totals(r.id);
  END LOOP;
END $$;

-- ============================================================
-- Migration: 20260509111031_3be06f7f-adce-4e78-b9d1-fff1d817547b.sql
-- ============================================================

-- installment_payments
DROP POLICY IF EXISTS "Auth create inst_payments" ON public.installment_payments;
CREATE POLICY "Auth create inst_payments" ON public.installment_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = received_by
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- sales
DROP POLICY IF EXISTS "Auth create sales" ON public.sales;
CREATE POLICY "Auth create sales" ON public.sales
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- purchases
DROP POLICY IF EXISTS "Auth create purchases" ON public.purchases;
CREATE POLICY "Auth create purchases" ON public.purchases
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- cash_book
DROP POLICY IF EXISTS "Auth create cashbook" ON public.cash_book;
CREATE POLICY "Auth create cashbook" ON public.cash_book
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- purchase_payments
DROP POLICY IF EXISTS "Auth create pp" ON public.purchase_payments;
CREATE POLICY "Auth create pp" ON public.purchase_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- stock_adjustments
DROP POLICY IF EXISTS "Auth create sadj" ON public.stock_adjustments;
CREATE POLICY "Auth create sadj" ON public.stock_adjustments
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- sales_returns
DROP POLICY IF EXISTS "Auth create returns" ON public.sales_returns;
CREATE POLICY "Auth create returns" ON public.sales_returns
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = created_by
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- sales_return_items
DROP POLICY IF EXISTS "Auth create return_items" ON public.sales_return_items;
CREATE POLICY "Auth create return_items" ON public.sales_return_items
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
  );

-- user_roles: prevent admins from granting admin/super_admin
DROP POLICY IF EXISTS "Admins manage non-super roles" ON public.user_roles;
CREATE POLICY "Admins manage non-super roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') AND role NOT IN ('super_admin'::app_role, 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin') AND role NOT IN ('super_admin'::app_role, 'admin'::app_role));


-- ============================================================
-- Migration: 20260509112522_16babf9f-33e8-422b-a686-6d2e19bf8edb.sql
-- ============================================================
update public.sale_items si
set
  unit_price = round(((si.subtotal * ((s.total + s.discount) / item_totals.item_subtotal)) / nullif(si.qty, 0))::numeric, 2),
  subtotal = round((si.subtotal * ((s.total + s.discount) / item_totals.item_subtotal))::numeric, 2)
from public.sales s
join (
  select sale_id, sum(subtotal) as item_subtotal
  from public.sale_items
  group by sale_id
) item_totals on item_totals.sale_id = s.id
where si.sale_id = s.id
  and item_totals.item_subtotal > 0
  and abs(item_totals.item_subtotal - (s.total + s.discount)) > 0.009;

-- ============================================================
-- Migration: 20260510055333_3b2622f4-a463-4763-9078-ac4119fcf524.sql
-- ============================================================

-- 1) installment_payments INSERT
DROP POLICY IF EXISTS "Auth create inst_payments" ON public.installment_payments;
CREATE POLICY "Auth create inst_payments"
ON public.installment_payments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = received_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 2) sales INSERT
DROP POLICY IF EXISTS "Auth create sales" ON public.sales;
CREATE POLICY "Auth create sales"
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 3) purchases INSERT
DROP POLICY IF EXISTS "Auth create purchases" ON public.purchases;
CREATE POLICY "Auth create purchases"
ON public.purchases
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 4) cash_book INSERT
DROP POLICY IF EXISTS "Auth create cash_book" ON public.cash_book;
CREATE POLICY "Auth create cash_book"
ON public.cash_book
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 5) purchase_payments INSERT
DROP POLICY IF EXISTS "Auth create purchase_payments" ON public.purchase_payments;
CREATE POLICY "Auth create purchase_payments"
ON public.purchase_payments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 6) stock_adjustments INSERT
DROP POLICY IF EXISTS "Auth create stock_adjustments" ON public.stock_adjustments;
CREATE POLICY "Auth create stock_adjustments"
ON public.stock_adjustments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 7) sales_returns INSERT
DROP POLICY IF EXISTS "Auth create sales_returns" ON public.sales_returns;
CREATE POLICY "Auth create sales_returns"
ON public.sales_returns
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 8) sales_return_items INSERT
DROP POLICY IF EXISTS "Auth create return_items" ON public.sales_return_items;
CREATE POLICY "Auth create return_items"
ON public.sales_return_items
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() IS NOT NULL
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

-- 9) user_roles privilege escalation fix
DROP POLICY IF EXISTS "Admins manage non-super roles" ON public.user_roles;
CREATE POLICY "Admins manage non-super roles"
ON public.user_roles
FOR ALL
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role NOT IN ('super_admin'::app_role, 'admin'::app_role)
)
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  AND role NOT IN ('super_admin'::app_role, 'admin'::app_role)
);


-- ============================================================
-- Migration: 20260510062705_24de32b6-e21d-4202-b222-36fcb4ddb3ee.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.staff_activity_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID,
  user_id UUID,
  shop_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id UUID,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sal_staff_created ON public.staff_activity_logs (staff_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sal_user_created  ON public.staff_activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sal_shop_created  ON public.staff_activity_logs (shop_id, created_at DESC);

ALTER TABLE public.staff_activity_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth insert own activity"
ON public.staff_activity_logs
FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admin read all activity"
ON public.staff_activity_logs
FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.is_super_admin(auth.uid()));

CREATE POLICY "Self read own activity"
ON public.staff_activity_logs
FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admin manage activity"
ON public.staff_activity_logs
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));


-- ============================================================
-- Migration: 20260510091402_5676b119-f53f-4ec2-94a0-ff255aa0b675.sql
-- ============================================================
CREATE POLICY "Admins create shops"
ON public.shops FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins update own shops"
ON public.shops FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ============================================================
-- Migration: 20260510092244_2944dd31-d242-4df3-93f4-d85cf5b38609.sql
-- ============================================================
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

-- ============================================================
-- Migration: 20260510094620_5e200d0a-866f-45f9-a7d8-d7e5af0718cf.sql
-- ============================================================
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

-- ============================================================
-- Migration: 20260510095252_93df14e5-cfc8-461c-ac30-eb4561c33aa3.sql
-- ============================================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;

INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Avatar public read" ON storage.objects;
CREATE POLICY "Avatar public read" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');

DROP POLICY IF EXISTS "Avatar user upload" ON storage.objects;
CREATE POLICY "Avatar user upload" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatar user update" ON storage.objects;
CREATE POLICY "Avatar user update" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Avatar user delete" ON storage.objects;
CREATE POLICY "Avatar user delete" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- ============================================================
-- Migration: 20260510120214_102fdc21-4732-4192-8626-c806edaa13e4.sql
-- ============================================================

-- Allow admin to update/delete installment payments
CREATE POLICY "Admin update inst_payments" ON public.installment_payments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- (DELETE policy already exists as "Admin delete inst_payments")

-- Reverse/adjust on UPDATE
CREATE OR REPLACE FUNCTION public.adjust_installment_payment_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_delta NUMERIC;
  v_inst_amount NUMERIC;
  v_new_paid NUMERIC;
BEGIN
  v_delta := NEW.amount - OLD.amount;
  IF v_delta = 0 THEN RETURN NEW; END IF;

  UPDATE public.installments
  SET paid_amount = paid_amount + v_delta
  WHERE id = NEW.installment_id
  RETURNING sale_id, amount, paid_amount INTO v_sale_id, v_inst_amount, v_new_paid;

  UPDATE public.installments
  SET status = CASE WHEN v_new_paid >= v_inst_amount THEN 'paid'::installment_status ELSE 'pending'::installment_status END
  WHERE id = NEW.installment_id;

  UPDATE public.sales
  SET paid = paid + v_delta,
      due = GREATEST(due - v_delta, 0),
      status = CASE WHEN due - v_delta <= 0 THEN 'completed'::sale_status ELSE 'partial'::sale_status END
  WHERE id = v_sale_id;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_adjust_installment_payment_update
AFTER UPDATE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.adjust_installment_payment_on_update();

-- Reverse on DELETE
CREATE OR REPLACE FUNCTION public.reverse_installment_payment_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_inst_amount NUMERIC;
  v_new_paid NUMERIC;
BEGIN
  UPDATE public.installments
  SET paid_amount = GREATEST(paid_amount - OLD.amount, 0)
  WHERE id = OLD.installment_id
  RETURNING sale_id, amount, paid_amount INTO v_sale_id, v_inst_amount, v_new_paid;

  UPDATE public.installments
  SET status = CASE WHEN v_new_paid >= v_inst_amount THEN 'paid'::installment_status ELSE 'pending'::installment_status END
  WHERE id = OLD.installment_id;

  UPDATE public.sales
  SET paid = GREATEST(paid - OLD.amount, 0),
      due = due + OLD.amount,
      status = 'partial'::sale_status
  WHERE id = v_sale_id;

  RETURN OLD;
END; $$;

CREATE TRIGGER trg_reverse_installment_payment_delete
AFTER DELETE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.reverse_installment_payment_on_delete();


-- ============================================================
-- Migration: 20260510124944_e421644f-d875-4e92-824f-73dcf1458b41.sql
-- ============================================================
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS credit_extra numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_extra numeric NOT NULL DEFAULT 0;

-- ============================================================
-- Migration: 20260512130424_dba2293e-d4f1-42de-aa28-b2133955f9e2.sql
-- ============================================================

-- Make kyc-docs bucket public so customer photos & NID images can be displayed via getPublicUrl
UPDATE storage.buckets SET public = true WHERE id = 'kyc-docs';

-- Drop old restrictive policies that required shop-uuid folder structure
DROP POLICY IF EXISTS "Shop upload kyc" ON storage.objects;
DROP POLICY IF EXISTS "Shop read kyc" ON storage.objects;
DROP POLICY IF EXISTS "Admin delete kyc" ON storage.objects;

-- New policies: any authenticated user in the system can upload/read/update/delete kyc-docs files
CREATE POLICY "Authenticated upload kyc"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'kyc-docs');

CREATE POLICY "Public read kyc"
ON storage.objects FOR SELECT
USING (bucket_id = 'kyc-docs');

CREATE POLICY "Authenticated update kyc"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-docs');

CREATE POLICY "Authenticated delete kyc"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'kyc-docs');


-- ============================================================
-- Migration: 20260513052110_ce8b0afd-10a8-438d-b058-770bcc738bed.sql
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================
-- Migration: 20260513052238_4bfd5785-3fc2-45d6-866d-ad75939958ba.sql
-- ============================================================
-- Remove any existing job with the same name to avoid duplicates
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'keep-alive-every-3-days';

-- Schedule keep-alive to run every 3 days at 3:00 AM UTC
SELECT cron.schedule(
  'keep-alive-every-3-days',
  '0 3 */3 * *',
  $$
  SELECT net.http_post(
    url := 'https://fxjjqjqnuryixsonnkzx.supabase.co/functions/v1/keep-alive',
    headers := '{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ4ampxanFudXJ5aXhzb25ua3p4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc3ODUzMzksImV4cCI6MjA5MzM2MTMzOX0.WtWTplXUJ61t9hTWskg5_EBmO0GkZp3XPpBGfEXJEZc"}'::jsonb,
    body := jsonb_build_object('triggered_at', now())
  ) AS request_id;
  $$
);

-- ============================================================
-- Migration: 20260611053738_7f811f5f-69bb-4a71-8df9-2aa146748bd3.sql
-- ============================================================
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS extra_charge numeric NOT NULL DEFAULT 0;

-- ============================================================
-- Migration: 20260614152557_878f74fe-062a-471a-8adc-4d8df4a44e1c.sql
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'super_admin'::app_role
  )
$$;

DROP POLICY IF EXISTS "Auth create expenses" ON public.expenses;
CREATE POLICY "Auth create expenses" ON public.expenses
FOR INSERT TO authenticated
WITH CHECK (
  auth.uid() = created_by
  AND ((shop_id IS NULL) OR public.user_can_access_shop(auth.uid(), shop_id))
);

DROP POLICY IF EXISTS "Users view own roles" ON public.user_roles;
CREATE POLICY "Users view own roles" ON public.user_roles
FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Public read kyc" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated update kyc" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated delete kyc" ON storage.objects;

CREATE POLICY "Authenticated read kyc" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'kyc-docs');

CREATE POLICY "Owner update kyc" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'kyc-docs' AND (owner = auth.uid() OR public.is_super_admin(auth.uid())))
WITH CHECK (bucket_id = 'kyc-docs');

CREATE POLICY "Owner delete kyc" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'kyc-docs' AND (owner = auth.uid() OR public.is_super_admin(auth.uid())));


-- ============================================================
-- Migration: 20260614175253_e5d6642d-7e13-4ce8-b65c-31a59d8903a9.sql
-- ============================================================

CREATE TABLE public.telegram_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  link_code TEXT,
  notify_all BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_subscribers TO authenticated;
GRANT ALL ON public.telegram_subscribers TO service_role;

ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own telegram subscription"
ON public.telegram_subscribers FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users manage own telegram subscription"
ON public.telegram_subscribers FOR ALL TO authenticated
USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE TABLE public.telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used BOOLEAN NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own link codes"
ON public.telegram_link_codes FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_telegram_subscribers_updated_at
BEFORE UPDATE ON public.telegram_subscribers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

