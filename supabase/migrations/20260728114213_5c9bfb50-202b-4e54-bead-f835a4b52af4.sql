ALTER TABLE public.products ADD COLUMN IF NOT EXISTS supplier_voucher text;
CREATE INDEX IF NOT EXISTS idx_products_supplier_voucher ON public.products (supplier_voucher);