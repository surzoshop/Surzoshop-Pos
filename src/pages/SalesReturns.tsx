import { useEffect, useState, useRef } from "react";
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
  const [deduction, setDeduction] = useState<number>(0);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  const load = async () => {
    try {
      const { data, error } = await supabase
        .from("sales_returns")
        .select("*, sales(invoice_no, customers(name))")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        console.warn("Retrying sales_returns without join:", error.message);
        const { data: fallback } = await supabase
          .from("sales_returns")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(200);
        setReturns(fallback ?? []);
      } else {
        setReturns(data ?? []);
      }
    } catch (err: any) {
      console.error("Failed to load returns:", err);
    }
  };
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
    setReturnedQty(rq); 
    setRefund(null); 
    setDeduction(0);
    setSale(data); 
    setSaleItems(data.sale_items ?? []);
    const init: Record<string, number> = {}; (data.sale_items ?? []).forEach((it: any) => init[it.id] = 0);
    setRetQty(init);
  };

  const maxQty = (it: any) => Math.max(0, Number(it.qty) - (returnedQty[it.product_id] || 0));
  const itemsValue = saleItems.reduce((a, it) => a + (retQty[it.id] || 0) * Number(it.unit_price), 0);
  // Full return = every remaining unit is being returned → whole sale (incl. extra charge) is reversed
  const isFull = saleItems.length > 0 && saleItems.every(it => (retQty[it.id] || 0) >= maxQty(it)) && saleItems.some(it => maxQty(it) > 0);
  const returnValue = sale ? (isFull ? Number(sale.total) : Math.min(itemsValue, Number(sale.total))) : 0;
  
  // Gross suggested refund (before deduction)
  const grossSuggestedRefund = sale ? Math.max(0, Math.min(Number(sale.paid), Number(sale.paid) - (Number(sale.total) - returnValue))) : 0;
  
  // Net suggested refund after deduction
  const netSuggestedRefund = Math.max(0, grossSuggestedRefund - Number(deduction || 0));
  const totalRefund = refund !== null ? refund : netSuggestedRefund;
  const newDue = sale ? Math.max(0, (Number(sale.total) - returnValue) - (Number(sale.paid) - totalRefund)) : 0;

  const handleDeductionChange = (val: number) => {
    const d = Math.max(0, Math.min(grossSuggestedRefund, val));
    setDeduction(d);
    setRefund(Math.max(0, grossSuggestedRefund - d));
  };

  const handleRefundChange = (val: number) => {
    const r = Math.max(0, Math.min(Number(sale?.paid || 0), val));
    setRefund(r);
    setDeduction(Math.max(0, grossSuggestedRefund - r));
  };

  const submitReturn = async () => {
    const items = saleItems.filter(it => (retQty[it.id] || 0) > 0);
    if (!items.length) return toast({ title: "কমপক্ষে একটি পণ্য নির্বাচন করুন", variant: "destructive" });
    if (saving || savingRef.current) return;
    if (totalRefund > Number(sale.paid)) return toast({ title: "ফেরত টাকা গ্রাহকের পরিশোধিত টাকার বেশি হতে পারে না", variant: "destructive" });
    savingRef.current = true;
    setSaving(true);
    
    try {
      const fullReason = deduction > 0
        ? (reason ? `${reason} (দোকান কর্তন: ৳${deduction})` : `পণ্য ফেরত (দোকান কর্তন: ৳${deduction})`)
        : (reason || "গ্রাহক বিক্রয় ফেরত");

      const { data: ret, error } = await supabase.from("sales_returns").insert({
        sale_id: sale.id, shop_id: sale.shop_id, reason: fullReason,
        total_amount: returnValue, refund_amount: totalRefund, deduction_amount: deduction, created_by: user!.id,
        invoice_no: sale.invoice_no,
        customer_name: sale.customers?.name ?? null,
        customer_id: sale.customer_id ?? null,
      } as any).select().single();
      if (error) { return toast({ title: error.message, variant: "destructive" }); }
      const rows = items.map(it => ({
        return_id: ret.id, shop_id: sale.shop_id, product_id: it.product_id, product_name: it.product_name,
        qty: retQty[it.id], unit_price: Number(it.unit_price), subtotal: retQty[it.id] * Number(it.unit_price),
      }));
      const { error: e2 } = await supabase.from("sales_return_items").insert(rows);
      if (e2) return toast({ title: e2.message, variant: "destructive" });
      logActivity({
        action: "sale.return",
        entity_type: "sales_return",
        entity_id: ret.id,
        shop_id: sale.shop_id ?? null,
        meta: { invoice_no: sale.invoice_no, amount: totalRefund, note: fullReason || undefined },
      });
      toast({ title: "ফেরত সংরক্ষিত ✓" });
      setOpen(false); setSale(null); setSaleItems([]); setInvSearch(""); setReason(""); setDeduction(0); load();
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
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
                <th className="pb-6 font-bold text-amber-600 dark:text-amber-400">দোকান কর্তন</th>
                <th className="pb-6 font-bold text-right">নগদ ফেরত</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {returns.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {returns.map(r => (
                <tr key={r.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4 font-bold">{r.return_no}</td>
                  <td className="py-4">{new Date(r.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</td>
                  <td className="py-4">{r.sales?.invoice_no || r.invoice_no || "—"}</td>
                  <td className="py-4">{r.sales?.customers?.name || r.customer_name || "—"}</td>
                  <td className="py-4 text-muted-foreground">{r.reason ?? "—"}</td>
                  <td className="py-4 text-xs font-semibold text-amber-600 dark:text-amber-400">
                    {Number(r.deduction_amount) > 0 ? fmt(Number(r.deduction_amount)) : "—"}
                  </td>
                  <td className="py-4 text-right font-bold text-destructive">{fmt(Number(r.refund_amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setSale(null); setSaleItems([]); setInvSearch(""); setDeduction(0); } }}>
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
                
                <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-4 space-y-3 text-sm border border-border/50">
                  <div className="flex justify-between">
                    <span>ফেরত পণ্যের মোট মূল্য {isFull && "(সম্পূর্ণ ফেরত)"}</span>
                    <b>{fmt(returnValue)}</b>
                  </div>
                  <div className="flex justify-between">
                    <span>{sale.payment_type === "installment" ? "গ্রাহকের ডাউন পেমেন্ট / পরিশোধিত নগদ" : "গ্রাহক পরিশোধ করেছিলেন"}</span>
                    <b className="text-primary">{fmt(Number(sale.paid))}</b>
                  </div>

                  {/* কর্তন / সার্ভিস ফি ইনপুট */}
                  <div className="p-3 rounded-lg bg-background/80 border border-border space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <Label className="font-bold text-foreground text-xs sm:text-sm">দোকান কর্তন / ব্যবহার ফি (কাটা টাকা)</Label>
                        <p className="text-[11px] text-muted-foreground">দিন হিসেবে বা ব্যবহারের জন্য ডাউন পেমেন্ট থেকে যত টাকা কেটে দোকানে রাখতে চান</p>
                      </div>
                      <div className="relative w-36">
                        <Input 
                          className="h-9 text-right pr-7 font-bold text-amber-600 dark:text-amber-400" 
                          type="number" 
                          min={0} 
                          max={grossSuggestedRefund} 
                          value={deduction || ""} 
                          placeholder="0"
                          onChange={e => handleDeductionChange(+e.target.value)} 
                        />
                        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">৳</span>
                      </div>
                    </div>
                  </div>

                  {/* গ্রাহককে প্রকৃত ক্যাশ ফেরত */}
                  <div className="flex justify-between items-center gap-3">
                    <div>
                      <Label className="font-bold text-xs sm:text-sm">গ্রাহককে নগদ ফেরত (ক্যাশ উত্তোলন)</Label>
                      <p className="text-[11px] text-muted-foreground">এই পরিমাণ টাকা ক্যাশ বুক থেকে উত্তোলন হয়ে কাস্টমারকে দেওয়া হবে</p>
                    </div>
                    <div className="relative w-36">
                      <Input 
                        className="h-9 text-right pr-7 font-bold text-destructive" 
                        type="number" 
                        min={0} 
                        max={Number(sale.paid)} 
                        value={totalRefund}
                        onChange={e => handleRefundChange(+e.target.value)} 
                      />
                      <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-bold">৳</span>
                    </div>
                  </div>

                  {/* দোকানে থাকা নিট লাভ / আয় */}
                  {deduction > 0 && (
                    <div className="flex justify-between text-xs py-1.5 px-3 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-semibold border border-emerald-500/20">
                      <span>দোকানে রক্ষিত আয় (কর্তন বাবদ লাভ):</span>
                      <span className="font-bold">+{fmt(deduction)}</span>
                    </div>
                  )}

                  <div className="flex justify-between">
                    <span>ফেরতের পর অবশিষ্ট বাকি</span>
                    <b>{fmt(newDue)}</b>
                  </div>

                  {sale.payment_type === "installment" && (
                    <div className="p-2.5 rounded-lg bg-primary/10 border border-primary/20 text-xs text-foreground space-y-1">
                      <p className="font-semibold text-primary">💡 কিস্তি ও হিসাব সমন্বয়:</p>
                      <p>গ্রাহকের ডাউন পেমেন্ট {fmt(Number(sale.paid))} টাকার মধ্য থেকে {fmt(totalRefund)} টাকা ফেরত দেওয়া হলে শুধুমাত্র সেই পরিমাণ টাকা ক্যাশ বুক থেকে উত্তোলন হবে।</p>
                      {deduction > 0 && <p className="text-emerald-600 font-medium">কর্তনকৃত {fmt(deduction)} টাকা দোকানে আয় হিসেবে সংরক্ষিত থাকবে।</p>}
                      <p className="text-muted-foreground">{newDue <= 0 ? "বাকি সব অপরিশোধিত কিস্তি বাতিল হয়ে চালানটি সমন্বয় হবে।" : "বাকি কিস্তিগুলোর সাথে সমন্বয় করা হবে।"}</p>
                    </div>
                  )}
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
