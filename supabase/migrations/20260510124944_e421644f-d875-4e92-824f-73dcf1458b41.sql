ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS credit_extra numeric NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS installment_extra numeric NOT NULL DEFAULT 0;