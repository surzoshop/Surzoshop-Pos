CREATE SEQUENCE IF NOT EXISTS public.barcode_serial_seq START WITH 1000 INCREMENT BY 1;

CREATE OR REPLACE FUNCTION public.next_barcode_serial()
RETURNS BIGINT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT nextval('public.barcode_serial_seq');
$$;

GRANT EXECUTE ON FUNCTION public.next_barcode_serial() TO authenticated;