
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
