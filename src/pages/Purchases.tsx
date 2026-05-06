import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ShoppingBag, Calendar, FileText, Receipt, Search, Eye, Wallet, ArrowLeft, Building2, Package, DollarSign, StickyNote, Printer, Save, ImagePlus, CheckCircle2, X } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton, StatusPill } from "@/components/PageHeader";

export default function Purchases() {
  const { t, fmt, lang } = useT();
  const { user, role } = useAuth();
  const { currentShop } = useShop();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [viewBill, setViewBill] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmt, setPayAmt] = useState(0);

  // form state
  const [supplierId, setSupplierId] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  // quick row
  const [qPid, setQPid] = useState(""); const [qQty, setQQty] = useState(1); const [qCost, setQCost] = useState(0);
  const [qSearch, setQSearch] = useState("");

  const load = async () => {
    const [p, s, pr] = await Promise.all([
      supabase.from("purchases").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("products").select("id,name,cost,barcode,sku").order("name"),
    ]);
    setPurchases(p.data ?? []); setSuppliers(s.data ?? []); setProducts(pr.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const subtotal = items.reduce((a, b) => a + b.subtotal, 0);
  const total = Math.max(subtotal - discount, 0);
  const due = Math.max(total - paid, 0);

  const productMatches = useMemo(() =>
    !qSearch ? products.slice(0, 8) : products.filter(p =>
      p.name.toLowerCase().includes(qSearch.toLowerCase()) ||
      p.barcode?.toLowerCase().includes(qSearch.toLowerCase()) ||
      p.sku?.toLowerCase().includes(qSearch.toLowerCase())
    ).slice(0, 8), [qSearch, products]);

  const addItem = () => {
    const prod = products.find(p => p.id === qPid);
    if (!prod || qQty <= 0) return toast({ title: "পণ্য ও পরিমাণ দিন", variant: "destructive" });
    setItems([...items, { product_id: prod.id, product_name: prod.name, qty: qQty, unit_cost: qCost, subtotal: qQty * qCost }]);
    setQPid(""); setQQty(1); setQCost(0); setQSearch("");
  };

  const resetForm = () => { setItems([]); setPaid(0); setDiscount(0); setSupplierId(""); setNotes(""); };

  const save = async () => {
    if (items.length === 0) return toast({ title: "কমপক্ষে একটি পণ্য যোগ করুন", variant: "destructive" });
    const { data, error } = await supabase.from("purchases").insert({
      supplier_id: supplierId || null, subtotal, discount, total, paid, due,
      notes: notes || null, created_by: user!.id, shop_id: currentShop?.id ?? null,
    }).select().single();
    if (error) return toast({ title: error.message, variant: "destructive" });
    const rows = items.map(i => ({ ...i, purchase_id: data.id, shop_id: currentShop?.id ?? null }));
    const { error: e2 } = await supabase.from("purchase_items").insert(rows);
    if (e2) return toast({ title: e2.message, variant: "destructive" });
    setOpen(false); resetForm(); load();
    toast({ title: "ক্রয় সংরক্ষিত ✓" });
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    await supabase.from("purchases").delete().eq("id", id);
    load();
  };

  const viewItems = async (p: any) => {
    const { data } = await supabase.from("purchase_items").select("*").eq("purchase_id", p.id);
    setViewBill({ ...p, items: data ?? [] });
  };

  const submitPayment = async () => {
    if (!payTarget || payAmt <= 0) return;
    const { error } = await supabase.from("purchase_payments").insert({
      purchase_id: payTarget.id, amount: payAmt, payment_method: "cash",
      created_by: user!.id, shop_id: currentShop?.id ?? null,
    });
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "পরিশোধ সংরক্ষিত ✓" });
    setPayOpen(false); setPayTarget(null); setPayAmt(0); load();
  };

  const filtered = purchases.filter(p =>
    !search || p.bill_no?.toLowerCase().includes(search.toLowerCase()) ||
    p.suppliers?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPurchase = filtered.reduce((a, p) => a + Number(p.total), 0);
  const totalDueAll = filtered.reduce((a, p) => a + Number(p.due), 0);

  return (
    <div>
      <PageHeader
        title="ক্রয় / স্টক এন্ট্রি" subtitle="পণ্য ক্রয় বিল ও স্টক ইন রেকর্ড।"
        actions={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />নতুন ক্রয়</PrimaryButton>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Stat icon={<ShoppingBag className="h-6 w-6 text-info" />} bg="bg-info/10" label="মোট বিল" value={filtered.length.toString()} />
        <Stat icon={<Receipt className="h-6 w-6 text-primary" />} bg="bg-primary/10" label="মোট ক্রয়" value={fmt(totalPurchase)} />
        <Stat icon={<Wallet className="h-6 w-6 text-destructive" />} bg="bg-destructive/10" label="মোট বকেয়া" value={fmt(totalDueAll)} />
      </div>

      <SurfaceCard className="p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="বিল নং বা সরবরাহকারী খুঁজুন..."
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">Bill #</th>
                <th className="pb-6 font-bold">{t("date")}</th>
                <th className="pb-6 font-bold">{t("suppliers")}</th>
                <th className="pb-6 font-bold">{t("total")}</th>
                <th className="pb-6 font-bold">{t("paid")}</th>
                <th className="pb-6 font-bold">{t("due")}</th>
                <th className="pb-6 font-bold text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4 font-bold">{p.bill_no}</td>
                  <td className="py-4">{new Date(p.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                  <td className="py-4">{p.suppliers?.name ?? "—"}</td>
                  <td className="py-4 font-bold text-primary">{fmt(Number(p.total))}</td>
                  <td className="py-4">{fmt(Number(p.paid))}</td>
                  <td className="py-4"><StatusPill tone={Number(p.due) > 0 ? "warning" : "success"}>{fmt(Number(p.due))}</StatusPill></td>
                  <td className="py-4 text-right">
                    <div className="inline-flex gap-1">
                      <button onClick={() => viewItems(p)} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Eye className="h-4 w-4" /></button>
                      {Number(p.due) > 0 && (
                        <button onClick={() => { setPayTarget(p); setPayAmt(Number(p.due)); setPayOpen(true); }}
                          className="px-2 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20">পরিশোধ</button>
                      )}
                      {isAdmin && <button onClick={() => del(p.id)} className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* === New Purchase Dialog (Bongo-style invoice form) === */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />নতুন ক্রয় বিল</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-[hsl(var(--surface-container-low))] rounded-xl p-4">
            <div>
              <Label className="text-xs flex items-center gap-1"><Receipt className="h-3.5 w-3.5" />Bill No</Label>
              <Input value="(auto)" disabled className="mt-1 bg-background/50" />
            </div>
            <div>
              <Label className="text-xs flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />তারিখ</Label>
              <Input type="date" value={billDate} onChange={e => setBillDate(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-xs">সরবরাহকারী</Label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)}
                className="w-full h-10 mt-1 rounded-md bg-background px-3 text-sm border border-input">
                <option value="">— সরবরাহকারী —</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          </div>

          {/* Quick add row */}
          <div className="border border-dashed border-[hsl(var(--surface-container-high))] rounded-xl p-4 mt-4">
            <Label className="text-xs uppercase tracking-wider text-muted-foreground">পণ্য যোগ করুন (Barcode / Name)</Label>
            <div className="grid grid-cols-12 gap-2 mt-2 items-start">
              <div className="col-span-12 md:col-span-5 relative">
                <Input placeholder="পণ্য বা বারকোড স্ক্যান..." value={qSearch}
                  onChange={e => { setQSearch(e.target.value); setQPid(""); }} />
                {qSearch && !qPid && (
                  <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))] rounded-lg max-h-56 overflow-y-auto shadow-lg">
                    {productMatches.map(p => (
                      <button key={p.id} type="button"
                        onClick={() => { setQPid(p.id); setQCost(Number(p.cost)); setQSearch(p.name); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted/60 flex justify-between">
                        <span>{p.name}</span>
                        <span className="text-xs text-muted-foreground">{fmt(Number(p.cost))}</span>
                      </button>
                    ))}
                    {productMatches.length === 0 && <div className="px-3 py-2 text-sm text-muted-foreground">কোন পণ্য নেই</div>}
                  </div>
                )}
              </div>
              <Input className="col-span-4 md:col-span-2" type="number" placeholder="পরিমাণ" value={qQty} onChange={e => setQQty(+e.target.value)} />
              <Input className="col-span-4 md:col-span-3" type="number" placeholder="ক্রয়মূল্য" value={qCost} onChange={e => setQCost(+e.target.value)} />
              <Button className="col-span-4 md:col-span-2 gradient-primary" onClick={addItem}><Plus className="h-4 w-4" />যোগ</Button>
            </div>
          </div>

          {/* Items list */}
          {items.length > 0 && (
            <div className="mt-4 bg-[hsl(var(--surface-container-low))] rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-[hsl(var(--surface-container))] text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr><th className="text-left p-3">পণ্য</th><th className="text-right p-3">পরিমাণ</th><th className="text-right p-3">ক্রয়মূল্য</th><th className="text-right p-3">মোট</th><th className="p-3"></th></tr>
                </thead>
                <tbody>
                  {items.map((i, idx) => (
                    <tr key={idx} className="border-t border-[hsl(var(--surface-container-high))]/40">
                      <td className="p-3 font-semibold">{i.product_name}</td>
                      <td className="p-3 text-right">{i.qty}</td>
                      <td className="p-3 text-right">{fmt(i.unit_cost)}</td>
                      <td className="p-3 text-right font-bold text-primary">{fmt(i.subtotal)}</td>
                      <td className="p-3 text-right">
                        <button onClick={() => setItems(items.filter((_, x) => x !== idx))} className="text-destructive hover:bg-destructive/10 p-1 rounded">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Bottom: notes + summary */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div className="space-y-3">
              <div><Label className="text-xs">নোট</Label><Input value={notes} onChange={e => setNotes(e.target.value)} placeholder="ঐচ্ছিক" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">{t("discount")}</Label><Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} /></div>
                <div><Label className="text-xs">{t("paid")}</Label><Input type="number" value={paid} onChange={e => setPaid(+e.target.value)} /></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("subtotal")}</span><span className="font-semibold">{fmt(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("discount")}</span><span>-{fmt(discount)}</span></div>
              <div className="border-t border-primary/20 pt-2 flex justify-between text-lg font-black"><span>{t("total")}</span><span className="text-primary">{fmt(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("paid")}</span><span>{fmt(paid)}</span></div>
              <div className="flex justify-between text-destructive font-bold"><span>{t("due")}</span><span>{fmt(due)}</span></div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save} className="gradient-primary">{t("save")} ({fmt(total)})</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View bill */}
      <Dialog open={!!viewBill} onOpenChange={(v) => !v && setViewBill(null)}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-2xl">
          <DialogHeader><DialogTitle>{viewBill?.bill_no}</DialogTitle></DialogHeader>
          {viewBill && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {new Date(viewBill.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")} · {viewBill.suppliers?.name ?? "—"}
              </div>
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[hsl(var(--surface-container-high))]">
                  <tr><th className="text-left pb-2">পণ্য</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Cost</th><th className="text-right pb-2">Total</th></tr>
                </thead>
                <tbody>
                  {viewBill.items.map((it: any) => (
                    <tr key={it.id} className="border-b border-[hsl(var(--surface-container-high))]/40">
                      <td className="py-2 font-medium">{it.product_name}</td>
                      <td className="py-2 text-right">{it.qty}</td>
                      <td className="py-2 text-right">{fmt(Number(it.unit_cost))}</td>
                      <td className="py-2 text-right font-bold">{fmt(Number(it.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>{t("subtotal")}</span><span>{fmt(Number(viewBill.subtotal))}</span></div>
                <div className="flex justify-between"><span>{t("discount")}</span><span>-{fmt(Number(viewBill.discount))}</span></div>
                <div className="flex justify-between font-black"><span>{t("total")}</span><span>{fmt(Number(viewBill.total))}</span></div>
                <div className="flex justify-between text-primary"><span>{t("paid")}</span><span>{fmt(Number(viewBill.paid))}</span></div>
                <div className="flex justify-between text-destructive"><span>{t("due")}</span><span>{fmt(Number(viewBill.due))}</span></div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>বকেয়া পরিশোধ — {payTarget?.bill_no}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-[hsl(var(--surface-container-low))] rounded-lg p-3 text-sm flex justify-between">
              <span>মোট বকেয়া</span><b className="text-destructive">{fmt(Number(payTarget?.due ?? 0))}</b>
            </div>
            <div><Label>পরিশোধ পরিমাণ</Label><Input type="number" value={payAmt} onChange={e => setPayAmt(+e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{t("cancel")}</Button>
            <Button onClick={submitPayment} className="gradient-primary">{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, bg, label, value }: any) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-6 rounded-2xl flex items-center gap-4 transition-all hover:-translate-y-1">
      <div className={`p-3 ${bg} rounded-xl`}>{icon}</div>
      <div>
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <h3 className="text-xl font-bold text-foreground mt-0.5">{value}</h3>
      </div>
    </div>
  );
}
