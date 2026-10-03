CREATE OR REPLACE FUNCTION public.admin_delete_installment(_installment_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_sale uuid; v_amt numeric;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'শুধু এডমিন কিস্তি মুছতে পারবেন';
  END IF;
  SELECT sale_id, amount INTO v_sale, v_amt FROM public.installments WHERE id = _installment_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'কিস্তি পাওয়া যায়নি'; END IF;
  -- reverse payments (trigger adjusts sales.paid / due)
  DELETE FROM public.installment_payments WHERE installment_id = _installment_id;
  DELETE FROM public.installments WHERE id = _installment_id;
  UPDATE public.sales s SET
    total = GREATEST(s.total - v_amt, 0),
    due = GREATEST(GREATEST(s.total - v_amt, 0) - s.paid, 0),
    status = CASE WHEN GREATEST(GREATEST(s.total - v_amt, 0) - s.paid, 0) <= 0 THEN 'completed'::sale_status ELSE 'partial'::sale_status END
  WHERE s.id = v_sale;
END $$;

CREATE OR REPLACE FUNCTION public.admin_delete_installment_plan(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'super_admin')) THEN
    RAISE EXCEPTION 'শুধু এডমিন কিস্তি মুছতে পারবেন';
  END IF;
  PERFORM 1 FROM public.sales WHERE id = _sale_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'বিক্রয় পাওয়া যায়নি'; END IF;
  DELETE FROM public.installment_payments WHERE installment_id IN (SELECT id FROM public.installments WHERE sale_id = _sale_id);
  DELETE FROM public.installments WHERE sale_id = _sale_id;
  -- keep only what was actually collected (down payment); nothing remains due
  UPDATE public.sales SET total = paid, due = 0, status = 'completed'::sale_status WHERE id = _sale_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.admin_delete_installment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_delete_installment_plan(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_delete_installment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_delete_installment_plan(uuid) TO authenticated;