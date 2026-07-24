
-- Add customer behavior remark & rating on payment entries
DO $$ BEGIN
  CREATE TYPE public.customer_rating AS ENUM ('good', 'neutral', 'bad');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.installment_payments
  ADD COLUMN IF NOT EXISTS remark text,
  ADD COLUMN IF NOT EXISTS rating public.customer_rating;

ALTER TABLE public.cash_book
  ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS remark text,
  ADD COLUMN IF NOT EXISTS rating public.customer_rating;

CREATE INDEX IF NOT EXISTS idx_cash_book_customer_id ON public.cash_book(customer_id);
CREATE INDEX IF NOT EXISTS idx_installment_payments_rating ON public.installment_payments(rating);
