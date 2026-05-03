import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton, StatusPill } from "@/components/PageHeader";

const TYPES = ["damage", "return", "count", "transfer_in", "transfer_out"] as const;

export default function StockAdjustments() {
  const { t, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ product_id: "", type: "damage", qty: 1, reason: "" });

  const load = async () => {
    const [a, p] = await Promise.all([
      supabase.from("stock_adjustments").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("id,name,stock").order("name"),
    ]);
    setItems(a.data ?? []); setProducts(p.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const prod = products.find(p => p.id === form.product_id);
    if (!prod) return toast({ title: "Select product", variant: "destructive" });
    const { error } = await supabase.from("stock_adjustments").insert({
      ...form, type: form.type as any, product_name: prod.name, created_by: user!.id,
    } as any);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setForm({ product_id: "", type: "damage", qty: 1, reason: "" });
    setOpen(false); load();
  };

  const tone = (tp: string) => tp === "damage" || tp === "transfer_out" ? "destructive" : tp === "return" || tp === "transfer_in" ? "success" : "info";

  return (
    <div>
      <PageHeader title={t("stockAdjustments")} subtitle={t("stockAdjSubtitle")}
        actions={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />{t("addAdjustment")}</PrimaryButton>} />

      <SurfaceCard className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">{t("date")}</th>
                <th className="pb-6 font-bold">{t("products")}</th>
                <th className="pb-6 font-bold">{t("type")}</th>
                <th className="pb-6 font-bold">{t("qty")}</th>
                <th className="pb-6 font-bold">{t("reason")}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {items.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {items.map(i => (
                <tr key={i.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4">{new Date(i.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                  <td className="py-4 font-semibold">{i.product_name}</td>
                  <td className="py-4"><StatusPill tone={tone(i.type) as any}>{t(i.type === "transfer_in" ? "transferIn" : i.type === "transfer_out" ? "transferOut" : i.type as any)}</StatusPill></td>
                  <td className="py-4 font-bold">{i.qty}</td>
                  <td className="py-4 text-muted-foreground">{i.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>{t("addAdjustment")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("products")}</Label>
              <select value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} className="w-full h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                <option value="">—</option>
                {products.map(p => <option key={p.id} value={p.id}>{p.name} (stock: {p.stock})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("type")}</Label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                  {TYPES.map(tp => <option key={tp} value={tp}>{t(tp === "transfer_in" ? "transferIn" : tp === "transfer_out" ? "transferOut" : tp as any)}</option>)}
                </select>
              </div>
              <div><Label>{t("qty")}</Label><Input type="number" value={form.qty} onChange={e => setForm({ ...form, qty: +e.target.value })} /></div>
            </div>
            <div><Label>{t("reason")}</Label><Input value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} /></div>
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
