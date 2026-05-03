
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
