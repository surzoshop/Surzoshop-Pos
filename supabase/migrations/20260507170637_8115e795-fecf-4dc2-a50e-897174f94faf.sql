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