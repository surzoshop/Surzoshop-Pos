CREATE OR REPLACE FUNCTION public.recompute_purchase_totals(_purchase_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_total numeric := 0;
BEGIN
  SELECT COALESCE(SUM(subtotal), 0) INTO v_subtotal
  FROM public.purchase_items WHERE purchase_id = _purchase_id;

  SELECT COALESCE(discount, 0) INTO v_discount
  FROM public.purchases WHERE id = _purchase_id;

  v_total := GREATEST(v_subtotal - v_discount, 0);

  UPDATE public.purchases
  SET subtotal = v_subtotal, total = v_total, paid = v_total, due = 0
  WHERE id = _purchase_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_purchase_history_from_product_cost()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r record;
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW.cost IS DISTINCT FROM OLD.cost OR NEW.name IS DISTINCT FROM OLD.name) THEN
    UPDATE public.purchase_items
    SET unit_cost = NEW.cost,
        subtotal = qty * NEW.cost,
        product_name = NEW.name
    WHERE product_id = NEW.id;

    FOR r IN SELECT DISTINCT purchase_id FROM public.purchase_items WHERE product_id = NEW.id LOOP
      PERFORM public.recompute_purchase_totals(r.purchase_id);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_purchase_history_from_product_cost ON public.products;
CREATE TRIGGER trg_sync_purchase_history_from_product_cost
AFTER UPDATE OF cost, name ON public.products
FOR EACH ROW
EXECUTE FUNCTION public.sync_purchase_history_from_product_cost();

CREATE OR REPLACE FUNCTION public.sync_product_cost_after_purchase_item_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_product_id uuid;
  r record;
BEGIN
  v_product_id := COALESCE(NEW.product_id, OLD.product_id);

  IF TG_OP IN ('INSERT', 'UPDATE') THEN
    UPDATE public.purchase_items
    SET unit_cost = NEW.unit_cost,
        subtotal = qty * NEW.unit_cost,
        product_name = NEW.product_name
    WHERE product_id = NEW.product_id AND id <> NEW.id;

    UPDATE public.products
    SET cost = NEW.unit_cost,
        name = COALESCE(NULLIF(NEW.product_name, ''), name)
    WHERE id = NEW.product_id
      AND (cost IS DISTINCT FROM NEW.unit_cost OR name IS DISTINCT FROM COALESCE(NULLIF(NEW.product_name, ''), name));
  END IF;

  FOR r IN SELECT DISTINCT purchase_id FROM public.purchase_items WHERE product_id = v_product_id LOOP
    PERFORM public.recompute_purchase_totals(r.purchase_id);
  END LOOP;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_product_cost_after_purchase_item_change ON public.purchase_items;
CREATE TRIGGER trg_sync_product_cost_after_purchase_item_change
AFTER INSERT OR UPDATE OF unit_cost, qty, subtotal, product_name OR DELETE ON public.purchase_items
FOR EACH ROW
EXECUTE FUNCTION public.sync_product_cost_after_purchase_item_change();

-- Backfill: sync existing purchase_items with current product cost, then recompute totals
UPDATE public.purchase_items pi
SET unit_cost = p.cost,
    subtotal = pi.qty * p.cost,
    product_name = p.name
FROM public.products p
WHERE pi.product_id = p.id
  AND (pi.unit_cost IS DISTINCT FROM p.cost OR pi.product_name IS DISTINCT FROM p.name);

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT DISTINCT id FROM public.purchases LOOP
    PERFORM public.recompute_purchase_totals(r.id);
  END LOOP;
END $$;