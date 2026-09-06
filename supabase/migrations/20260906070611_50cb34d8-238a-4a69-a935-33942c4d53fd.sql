CREATE POLICY "Shop members update sales"
ON public.sales
FOR UPDATE
TO authenticated
USING (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id))
WITH CHECK (shop_id IS NULL OR public.user_can_access_shop(auth.uid(), shop_id));