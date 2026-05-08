import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

  const load = () => supabase.from("sales_returns").select("*, sales(invoice_no, customers(name))").order("created_at", { ascending: false }).limit(200)
    .then(({ data }) => setReturns(data ?? []));
  useEffect(() => { load(); }, []);

  const findSale = async () => {
    if (!invSearch.trim()) return;
    const { data } = await supabase.from("sales").select("*, customers(name), sale_items(*)").ilike("invoice_no", `%${invSearch.trim()}%`).limit(1).maybeSingle();
    if (!data) return toast({ title: "চালান পাওয়া যায়নি", variant: "destructive" });
    setSale(data); setSaleItems(data.sale_items ?? []);
    const init: Record<string, number> = {}; (data.sale_items ?? []).forEach((it: any) => init[it.id] = 0);
    setRetQty(init);
  };

  const totalRefund = saleItems.reduce((a, it) => a + (retQty[it.id] || 0) * Number(it.unit_price), 0);

  const submitReturn = async () => {
    const items = saleItems.filter(it => (retQty[it.id] || 0) > 0);
    if (!items.length) return toast({ title: "কমপক্ষে একটি পণ্য নির্বাচন করুন", variant: "destructive" });
    const { data: ret, error } = await supabase.from("sales_returns").insert({
      sale_id: sale.id, shop_id: sale.shop_id, reason,
      total_amount: totalRefund, refund_amount: totalRefund, created_by: user!.id,
    }).select().single();
    if (error) return toast({ title: error.message, variant: "destructive" });
    const rows = items.map(it => ({
      return_id: ret.id, shop_id: sale.shop_id, product_id: it.product_id, product_name: it.product_name,
      qty: retQty[it.id], unit_price: Number(it.unit_price), subtotal: retQty[it.id] * Number(it.unit_price),
    }));
    const { error: e2 } = await supabase.from("sales_return_items").insert(rows);
    if (e2) return toast({ title: e2.message, variant: "destructive" });
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
                      <span className="col-span-2 text-muted-foreground text-xs">বিক্রি: {it.qty}</span>
                      <span className="col-span-2 text-muted-foreground text-xs">{fmt(Number(it.unit_price))}</span>
                      <Input className="col-span-2 h-9" type="number" min={0} max={it.qty}
                        value={retQty[it.id] ?? 0}
                        onChange={e => setRetQty({ ...retQty, [it.id]: Math.min(it.qty, Math.max(0, +e.target.value)) })} />
                    </div>
                  ))}
                </div>
                <div><Label>{t("reason")}</Label><Input value={reason} onChange={e => setReason(e.target.value)} placeholder="ত্রুটিপূর্ণ / size mismatch ইত্যাদি" /></div>
                <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-4 flex justify-between items-center">
                  <span className="font-bold">মোট ফেরত পরিমাণ</span>
                  <span className="text-xl font-black text-destructive">{fmt(totalRefund)}</span>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={submitReturn} disabled={!sale || totalRefund <= 0} className="gradient-primary"><RotateCcw className="h-4 w-4" />ফেরত নিশ্চিত</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
