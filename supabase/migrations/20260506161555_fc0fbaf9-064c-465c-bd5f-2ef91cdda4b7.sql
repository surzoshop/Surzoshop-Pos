
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
