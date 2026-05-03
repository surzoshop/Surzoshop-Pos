import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton, StatusPill } from "@/components/PageHeader";

export default function Purchases() {
  const { t, fmt, lang } = useT();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [paid, setPaid] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [items, setItems] = useState<any[]>([]);
  const [pid, setPid] = useState(""); const [qty, setQty] = useState(1); const [cost, setCost] = useState(0);

  const load = async () => {
    const [p, s, pr] = await Promise.all([
      supabase.from("purchases").select("*, suppliers(name)").order("created_at", { ascending: false }),
      supabase.from("suppliers").select("id,name").order("name"),
      supabase.from("products").select("id,name,cost").order("name"),
    ]);
    setPurchases(p.data ?? []); setSuppliers(s.data ?? []); setProducts(pr.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const subtotal = items.reduce((a, b) => a + b.subtotal, 0);
  const total = Math.max(subtotal - discount, 0);
  const due = Math.max(total - paid, 0);

  const addItem = () => {
    const prod = products.find(p => p.id === pid);
    if (!prod || qty <= 0) return;
    setItems([...items, { product_id: prod.id, product_name: prod.name, qty, unit_cost: cost, subtotal: qty * cost }]);
    setPid(""); setQty(1); setCost(0);
  };

  const save = async () => {
    if (items.length === 0) return toast({ title: "Add items", variant: "destructive" });
    const { data, error } = await supabase.from("purchases").insert({
      supplier_id: supplierId || null, subtotal, discount, total, paid, due, created_by: user!.id,
    }).select().single();
    if (error) return toast({ title: error.message, variant: "destructive" });
    const rows = items.map(i => ({ ...i, purchase_id: data.id }));
    const { error: e2 } = await supabase.from("purchase_items").insert(rows);
    if (e2) return toast({ title: e2.message, variant: "destructive" });
    setOpen(false); setItems([]); setPaid(0); setDiscount(0); setSupplierId(""); load();
    toast({ title: t("save") + " ✓" });
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    await supabase.from("purchases").delete().eq("id", id);
    load();
  };

  return (
    <div>
      <PageHeader
        title={t("purchases")} subtitle={t("purchasesSubtitle")}
        actions={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />{t("addPurchase")}</PrimaryButton>}
      />

      <SurfaceCard className="p-6">
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
              {purchases.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {purchases.map(p => (
                <tr key={p.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4 font-semibold">{p.bill_no}</td>
                  <td className="py-4">{new Date(p.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                  <td className="py-4">{p.suppliers?.name ?? "—"}</td>
                  <td className="py-4 font-bold">{fmt(Number(p.total))}</td>
                  <td className="py-4">{fmt(Number(p.paid))}</td>
                  <td className="py-4"><StatusPill tone={Number(p.due) > 0 ? "warning" : "success"}>{fmt(Number(p.due))}</StatusPill></td>
                  <td className="py-4 text-right">
                    {isAdmin && <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("addPurchase")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("suppliers")}</Label>
              <select value={supplierId} onChange={e => setSupplierId(e.target.value)} className="w-full h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                <option value="">—</option>
                {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="border-t border-[hsl(var(--surface-container-high))] pt-3">
              <Label className="mb-2 block">{t("items")}</Label>
              <div className="grid grid-cols-12 gap-2 mb-2">
                <select value={pid} onChange={e => { setPid(e.target.value); const p = products.find(x => x.id === e.target.value); if (p) setCost(Number(p.cost)); }}
                  className="col-span-5 h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                  <option value="">{t("products")}</option>
                  {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
                <Input className="col-span-2" type="number" placeholder={t("qty")} value={qty} onChange={e => setQty(+e.target.value)} />
                <Input className="col-span-3" type="number" placeholder={t("cost")} value={cost} onChange={e => setCost(+e.target.value)} />
                <Button className="col-span-2" onClick={addItem}>{t("add")}</Button>
              </div>
              {items.map((i, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm bg-[hsl(var(--surface-container-low))] rounded-lg px-3 py-2 mb-1">
                  <span>{i.product_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{i.qty} × {fmt(i.unit_cost)}</span>
                    <span className="font-bold">{fmt(i.subtotal)}</span>
                    <button onClick={() => setItems(items.filter((_, x) => x !== idx))} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("discount")}</Label><Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} /></div>
              <div><Label>{t("paid")}</Label><Input type="number" value={paid} onChange={e => setPaid(+e.target.value)} /></div>
            </div>

            <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-4 space-y-1 text-sm">
              <div className="flex justify-between"><span>{t("subtotal")}</span><span>{fmt(subtotal)}</span></div>
              <div className="flex justify-between font-bold"><span>{t("total")}</span><span>{fmt(total)}</span></div>
              <div className="flex justify-between text-destructive"><span>{t("due")}</span><span>{fmt(due)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save} className="gradient-primary">{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
