update public.sale_items si
set
  unit_price = round(((si.subtotal * ((s.total + s.discount) / item_totals.item_subtotal)) / nullif(si.qty, 0))::numeric, 2),
  subtotal = round((si.subtotal * ((s.total + s.discount) / item_totals.item_subtotal))::numeric, 2)
from public.sales s
join (
  select sale_id, sum(subtotal) as item_subtotal
  from public.sale_items
  group by sale_id
) item_totals on item_totals.sale_id = s.id
where si.sale_id = s.id
  and item_totals.item_subtotal > 0
  and abs(item_totals.item_subtotal - (s.total + s.discount)) > 0.009;