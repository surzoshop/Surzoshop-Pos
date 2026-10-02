import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton, StatusPill } from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SalesReturns() {
  const { t, lang, fmt } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [returns, setReturns] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [invSearch, setInvSearch] = useState("");
  const [sale, setSale] = useState<any>(null);
  const [saleItems, setSaleItems] = useState<any[]>([]);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [reason, setReason] = useState("");
  const [returnedQty, setReturnedQty] = useState<Record<string, number>>({});
  const [refund, setRefund] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () => supabase.from("sales_returns").select("*, sales(invoice_no, customers(name))").order("created_at", { ascending: false }).limit(200)
    .then(({ data }) => setReturns(data ?? []));
  useEffect(() => { load(); }, []);

  const findSale = async () => {
    if (!invSearch.trim()) return;
    const { data } = await supabase.from("sales").select("*, customers(name), sale_items(*)").ilike("invoice_no", `%${invSearch.trim()}%`).limit(1).maybeSingle();
    if (!data) return toast({ title: "চালান পাওয়া যায়নি", variant: "destructive" });
    if (data.status === "cancelled") return toast({ title: "এই চালান আগেই সম্পূর্ণ ফেরত হয়েছে", variant: "destructive" });
    // Already-returned qty per product (prevents double return / double restock)
    const { data: prev } = await supabase.from("sales_return_items").select("product_id, qty, sales_returns!inner(sale_id)").eq("sales_returns.sale_id", data.id);
    const rq: Record<string, number> = {};
    (prev ?? []).forEach((r: any) => { rq[r.product_id] = (rq[r.product_id] || 0) + Number(r.qty); });
    setReturnedQty(rq); setRefund(null);
    setSale(data); setSaleItems(data.sale_items ?? []);
    const init: Record<string, number> = {}; (data.sale_items ?? []).forEach((it: any) => init[it.id] = 0);
    setRetQty(init);
  };

  const maxQty = (it: any) => Math.max(0, Number(it.qty) - (returnedQty[it.product_id] || 0));
  const itemsValue = saleItems.reduce((a, it) => a + (retQty[it.id] || 0) * Number(it.unit_price), 0);
  // Full return = every remaining unit is being returned → whole sale (incl. extra charge) is reversed
  const isFull = saleItems.length > 0 && saleItems.every(it => (retQty[it.id] || 0) >= maxQty(it)) && saleItems.some(it => maxQty(it) > 0);
  const returnValue = sale ? (isFull ? Number(sale.total) : Math.min(itemsValue, Number(sale.total))) : 0;
  // Customer only gets back what they over-paid for the remaining goods
  const suggestedRefund = sale ? Math.max(0, Math.min(Number(sale.paid), Number(sale.paid) - (Number(sale.total) - returnValue))) : 0;
  const totalRefund = refund ?? suggestedRefund;
  const newDue = sale ? Math.max(0, (Number(sale.total) - returnValue) - (Number(sale.paid) - totalRefund)) : 0;

  const submitReturn = async () => {
    const items = saleItems.filter(it => (retQty[it.id] || 0) > 0);
    if (!items.length) return toast({ title: "কমপক্ষে একটি পণ্য নির্বাচন করুন", variant: "destructive" });
    if (saving) return;
    if (totalRefund > Number(sale.paid)) return toast({ title: "ফেরত টাকা গ্রাহকের পরিশোধিত টাকার বেশি হতে পারে না", variant: "destructive" });
    setSaving(true);
    const { data: ret, error } = await supabase.from("sales_returns").insert({
      sale_id: sale.id, shop_id: sale.shop_id, reason,
      total_amount: returnValue, refund_amount: totalRefund, created_by: user!.id,
    }).select().single();
    if (error) { setSaving(false); return toast({ title: error.message, variant: "destructive" }); }
    const rows = items.map(it => ({
      return_id: ret.id, shop_id: sale.shop_id, product_id: it.product_id, product_name: it.product_name,
      qty: retQty[it.id], unit_price: Number(it.unit_price), subtotal: retQty[it.id] * Number(it.unit_price),
    }));
    const { error: e2 } = await supabase.from("sales_return_items").insert(rows);
    setSaving(false);
    if (e2) return toast({ title: e2.message, variant: "destructive" });
    logActivity({
      action: "sale.return",
      entity_type: "sales_return",
      entity_id: ret.id,
      shop_id: sale.shop_id ?? null,
      meta: { invoice_no: sale.invoice_no, amount: totalRefund, note: reason || undefined },
    });
    toast({ title: "ফেরত সংরক্ষিত ✓" });
    setOpen(false); setSale(null); setSaleItems([]); setInvSearch(""); setReason(""); load();
  };

  return (
    <div>
      <PageHeader title="বিক্রয় ফেরত" subtitle="বিক্রয় ফেরত ব্যবস্থাপনা ও স্টক restock।"
        actions={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />নতুন ফেরত</PrimaryButton>} />

      <SurfaceCard className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">ফেরত নং</th>
                <th className="pb-6 font-bold">{t("date")}</th>
                <th className="pb-6 font-bold">{t("invoice")}</th>
                <th className="pb-6 font-bold">{t("customer")}</th>
                <th className="pb-6 font-bold">{t("reason")}</th>
                <th className="pb-6 font-bold text-right">পরিমাণ</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {returns.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4 font-bold">{r.return_no}</td>
                  <td className="py-4">{new Date(r.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</td>
                  <td className="py-4">{r.sales?.invoice_no ?? "—"}</td>
                  <td className="py-4">{r.sales?.customers?.name ?? "—"}</td>
                  <td className="py-4 text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="py-4 text-right font-bold text-destructive">{fmt(Number(r.refund_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSale(null); setSaleItems([]); setInvSearch(""); } }}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>নতুন বিক্রয় ফেরত</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input placeholder="চালান নং (e.g. INV-1001)" value={invSearch} onChange={e => setInvSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && findSale()} />
              <Button onClick={findSale}>খুঁজুন</Button>
            </div>
            {sale && (
              <>
                <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3 text-sm flex justify-between">
                  <span><b>{sale.invoice_no}</b> · {sale.customers?.name ?? "—"}</span>
                  <StatusPill tone="info">{fmt(Number(sale.total))}</StatusPill>
                </div>
                <div className="space-y-2">
                  <Label>ফেরতযোগ্য পণ্য</Label>
                  {saleItems.map(it => (
                    <div key={it.id} className="grid grid-cols-12 gap-2 items-center bg-[hsl(var(--surface-container-low))] rounded-lg px-3 py-2 text-sm">
                      <span className="col-span-6 truncate">{it.product_name}</span>
                      <span className="col-span-2 text-muted-foreground text-xs">বিক্রি: {it.qty}{returnedQty[it.product_id] ? ` · ফেরত: ${returnedQty[it.product_id]}` : ""}</span>
                      <span className="col-span-2 text-muted-foreground text-xs">{fmt(Number(it.unit_price))}</span>
                      <Input className="col-span-2 h-9" type="number" min={0} max={maxQty(it)} disabled={maxQty(it) === 0}
                        value={retQty[it.id] ?? 0}
                        onChange={e => { setRefund(null); setRetQty({ ...retQty, [it.id]: Math.min(maxQty(it), Math.max(0, +e.target.value)) }); }} />
                    </div>
                  ))}
                </div>
                <div><Label>{t("reason")}</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="ত্রুটিপূর্ণ / size mismatch ইত্যাদি" /></div>
                <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-4 space-y-2 text-sm">
                  <div className="flex justify-between"><span>ফেরত পণ্যের মূল্য {isFull && "(সম্পূর্ণ ফেরত)"}</span><b>{fmt(returnValue)}</b></div>
                  <div className="flex justify-between"><span>গ্রাহক পরিশোধ করেছিলেন</span><b>{fmt(Number(sale.paid))}</b></div>
                  <div className="flex justify-between items-center gap-3">
                    <Label className="font-bold">গ্রাহককে নগদ ফেরত</Label>
                    <Input className="w-36 h-9 text-right" type="number" min={0} max={Number(sale.paid)} value={totalRefund}
                      onChange={e => setRefund(Math.max(0, +e.target.value))} />
                  </div>
                  <div className="flex justify-between"><span>ফেরতের পর বাকি</span><b>{fmt(newDue)}</b></div>
                  {sale.payment_type === "installment" && <p className="text-xs text-muted-foreground">{newDue <= 0 ? "অপরিশোধিত সব কিস্তি বাতিল হবে।" : "শেষের অপরিশোধিত কিস্তি থেকে বাকি কমানো হবে।"} নগদ ফেরত হিসাব ব্যবস্থাপনায় উত্তোলন হিসেবে যুক্ত হবে।</p>}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={submitReturn} disabled={!sale || itemsValue <= 0 || saving} className="gradient-primary"><RotateCcw className="h-4 w-4" />ফেরত নিশ্চিত</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
