
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
