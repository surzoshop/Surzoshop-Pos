ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS has_warranty boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS warranty_months integer;

ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS warranty_months integer,
  ADD COLUMN IF NOT EXISTS warranty_until date;

CREATE INDEX IF NOT EXISTS idx_sale_items_warranty_until ON public.sale_items(warranty_until) WHERE warranty_until IS NOT NULL;