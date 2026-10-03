CREATE OR REPLACE FUNCTION public.purge_installments_on_cancel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
    DELETE FROM public.installments i WHERE i.sale_id = NEW.id AND COALESCE(i.paid_amount,0) <= 0
      AND NOT EXISTS (SELECT 1 FROM public.installment_payments p WHERE p.installment_id = i.id);
    UPDATE public.installments SET amount = paid_amount, status = 'paid'
      WHERE sale_id = NEW.id AND paid_amount < amount;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.purge_installments_on_cancel() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS trg_purge_installments_on_cancel ON public.sales;
CREATE TRIGGER trg_purge_installments_on_cancel AFTER UPDATE OF status ON public.sales
FOR EACH ROW EXECUTE FUNCTION public.purge_installments_on_cancel();