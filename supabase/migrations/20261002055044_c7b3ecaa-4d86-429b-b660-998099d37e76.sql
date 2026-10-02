CREATE TABLE IF NOT EXISTS public.telegram_dedupe (key text PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now());
GRANT ALL ON public.telegram_dedupe TO service_role;
ALTER TABLE public.telegram_dedupe ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.apply_sale_return()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  s public.sales%ROWTYPE;
  v_new_total numeric; v_net_paid numeric; v_new_due numeric; v_cut numeric; r record; v_inv text; v_cust text;
BEGIN
  SELECT * INTO s FROM public.sales WHERE id = NEW.sale_id FOR UPDATE;
  IF NOT FOUND THEN RETURN NEW; END IF;

  v_new_total := GREATEST(s.total - COALESCE(NEW.total_amount,0), 0);
  v_net_paid  := GREATEST(s.paid - COALESCE(NEW.refund_amount,0), 0);
  v_new_due   := GREATEST(v_new_total - v_net_paid, 0);
  v_cut       := GREATEST(s.due - v_new_due, 0);

  IF v_new_due <= 0 THEN
    DELETE FROM public.installments WHERE sale_id = s.id AND COALESCE(paid_amount,0) <= 0
      AND NOT EXISTS (SELECT 1 FROM public.installment_payments p WHERE p.installment_id = installments.id);
    UPDATE public.installments SET amount = paid_amount, status = 'paid'
      WHERE sale_id = s.id AND paid_amount < amount;
  ELSE
    FOR r IN SELECT id, amount, paid_amount FROM public.installments
             WHERE sale_id = s.id AND paid_amount < amount ORDER BY installment_no DESC LOOP
      EXIT WHEN v_cut <= 0;
      IF (r.amount - r.paid_amount) <= v_cut THEN
        v_cut := v_cut - (r.amount - r.paid_amount);
        IF r.paid_amount <= 0 THEN DELETE FROM public.installments WHERE id = r.id;
        ELSE UPDATE public.installments SET amount = paid_amount, status='paid' WHERE id = r.id; END IF;
      ELSE
        UPDATE public.installments SET amount = amount - v_cut WHERE id = r.id; v_cut := 0;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.sales SET total = v_new_total, due = v_new_due,
    status = CASE WHEN v_new_total <= 0 THEN 'cancelled'::sale_status
                  WHEN v_new_due <= 0 THEN 'completed'::sale_status ELSE 'partial'::sale_status END
  WHERE id = s.id;

  IF COALESCE(NEW.refund_amount,0) > 0 THEN
    SELECT name INTO v_cust FROM public.customers WHERE id = s.customer_id;
    INSERT INTO public.cash_book (shop_id, entry_date, entry_type, amount, category, payment_method, reference_no, party_name, notes, created_by, customer_id)
    VALUES (s.shop_id, (now() AT TIME ZONE 'Asia/Dhaka')::date, 'withdraw', NEW.refund_amount, 'বিক্রয় ফেরত', 'cash',
            NEW.return_no, v_cust, 'ফেরত ' || COALESCE(NEW.return_no,'') || ' · ' || s.invoice_no, NEW.created_by, s.customer_id);
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_sale_return ON public.sales_returns;
CREATE TRIGGER trg_apply_sale_return AFTER INSERT ON public.sales_returns FOR EACH ROW EXECUTE FUNCTION public.apply_sale_return();