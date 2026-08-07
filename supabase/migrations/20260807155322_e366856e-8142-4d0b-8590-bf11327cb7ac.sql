CREATE TABLE public.daily_closings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  close_date date NOT NULL,
  sales_cash numeric NOT NULL DEFAULT 0,
  expense_total numeric NOT NULL DEFAULT 0,
  carry_forward numeric NOT NULL DEFAULT 0,
  closing_amount numeric NOT NULL DEFAULT 0,
  notes text,
  closed_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX daily_closings_shop_date_uidx
  ON public.daily_closings (COALESCE(shop_id, '00000000-0000-0000-0000-000000000000'::uuid), close_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.daily_closings TO authenticated;
GRANT ALL ON public.daily_closings TO service_role;

ALTER TABLE public.daily_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Shop members can view daily closings"
  ON public.daily_closings FOR SELECT TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

CREATE POLICY "Shop members can create daily closings"
  ON public.daily_closings FOR INSERT TO authenticated
  WITH CHECK (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

CREATE POLICY "Shop members can update daily closings"
  ON public.daily_closings FOR UPDATE TO authenticated
  USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id))
  WITH CHECK (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));

CREATE POLICY "Admins can delete daily closings"
  ON public.daily_closings FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_super_admin(auth.uid()));

CREATE TRIGGER trg_daily_closings_updated
  BEFORE UPDATE ON public.daily_closings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();