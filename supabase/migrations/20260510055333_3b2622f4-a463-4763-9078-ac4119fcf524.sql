
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
