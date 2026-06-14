
CREATE TABLE public.telegram_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  chat_id BIGINT NOT NULL UNIQUE,
  username TEXT,
  first_name TEXT,
  link_code TEXT,
  notify_all BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_subscribers TO authenticated;
GRANT ALL ON public.telegram_subscribers TO service_role;

ALTER TABLE public.telegram_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own telegram subscription"
ON public.telegram_subscribers FOR SELECT TO authenticated
USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE POLICY "Users manage own telegram subscription"
ON public.telegram_subscribers FOR ALL TO authenticated
USING (auth.uid() = user_id OR public.is_super_admin(auth.uid()))
WITH CHECK (auth.uid() = user_id OR public.is_super_admin(auth.uid()));

CREATE TABLE public.telegram_link_codes (
  code TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  used BOOLEAN NOT NULL DEFAULT false
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.telegram_link_codes TO authenticated;
GRANT ALL ON public.telegram_link_codes TO service_role;

ALTER TABLE public.telegram_link_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own link codes"
ON public.telegram_link_codes FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_telegram_subscribers_updated_at
BEFORE UPDATE ON public.telegram_subscribers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
