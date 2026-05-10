
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
