
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
