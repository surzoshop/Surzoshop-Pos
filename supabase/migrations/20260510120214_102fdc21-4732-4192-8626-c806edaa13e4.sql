
-- Allow admin to update/delete installment payments
CREATE POLICY "Admin update inst_payments" ON public.installment_payments
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- (DELETE policy already exists as "Admin delete inst_payments")

-- Reverse/adjust on UPDATE
CREATE OR REPLACE FUNCTION public.adjust_installment_payment_on_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_delta NUMERIC;
  v_inst_amount NUMERIC;
  v_new_paid NUMERIC;
BEGIN
  v_delta := NEW.amount - OLD.amount;
  IF v_delta = 0 THEN RETURN NEW; END IF;

  UPDATE public.installments
  SET paid_amount = paid_amount + v_delta
  WHERE id = NEW.installment_id
  RETURNING sale_id, amount, paid_amount INTO v_sale_id, v_inst_amount, v_new_paid;

  UPDATE public.installments
  SET status = CASE WHEN v_new_paid >= v_inst_amount THEN 'paid'::installment_status ELSE 'pending'::installment_status END
  WHERE id = NEW.installment_id;

  UPDATE public.sales
  SET paid = paid + v_delta,
      due = GREATEST(due - v_delta, 0),
      status = CASE WHEN due - v_delta <= 0 THEN 'completed'::sale_status ELSE 'partial'::sale_status END
  WHERE id = v_sale_id;

  RETURN NEW;
END; $$;

CREATE TRIGGER trg_adjust_installment_payment_update
AFTER UPDATE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.adjust_installment_payment_on_update();

-- Reverse on DELETE
CREATE OR REPLACE FUNCTION public.reverse_installment_payment_on_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale_id UUID;
  v_inst_amount NUMERIC;
  v_new_paid NUMERIC;
BEGIN
  UPDATE public.installments
  SET paid_amount = GREATEST(paid_amount - OLD.amount, 0)
  WHERE id = OLD.installment_id
  RETURNING sale_id, amount, paid_amount INTO v_sale_id, v_inst_amount, v_new_paid;

  UPDATE public.installments
  SET status = CASE WHEN v_new_paid >= v_inst_amount THEN 'paid'::installment_status ELSE 'pending'::installment_status END
  WHERE id = OLD.installment_id;

  UPDATE public.sales
  SET paid = GREATEST(paid - OLD.amount, 0),
      due = due + OLD.amount,
      status = 'partial'::sale_status
  WHERE id = v_sale_id;

  RETURN OLD;
END; $$;

CREATE TRIGGER trg_reverse_installment_payment_delete
AFTER DELETE ON public.installment_payments
FOR EACH ROW EXECUTE FUNCTION public.reverse_installment_payment_on_delete();
