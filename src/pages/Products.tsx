import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { PageHeader, StatusPill, SurfaceCard, PrimaryButton } from "@/components/PageHeader";

export default function Products() {
  const { t, fmt } = useT();
  const { role } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const isAdmin = role === "admin";

  const empty = { name: "", sku: "", barcode: "", price: 0, cost: 0, stock: 0, unit: "pcs" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const { data } = await supabase.from("products").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const startEdit = (p: any) => { setEditing(p); setForm(p); setOpen(true); };
  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };

  const save = async () => {
    const payload = { ...form, price: Number(form.price), cost: Number(form.cost), stock: Number(form.stock),
      sku: form.sku || null, barcode: form.barcode || null };
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setOpen(false); load();
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  const filtered = items.filter(p =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.includes(search) || p.sku?.toLowerCase().includes(search.toLowerCase())
  );

  const totalValue = filtered.reduce((a, p) => a + Number(p.price) * Number(p.stock), 0);
  const lowCount = filtered.filter(p => p.stock <= 5).length;

  return (
    <div>
      <PageHeader
        title={t("productsInventory")}
        subtitle={t("productsSubtitle")}
        actions={isAdmin && <PrimaryButton onClick={startNew}><Plus className="h-5 w-5" />{t("addProduct")}</PrimaryButton>}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <MiniStat icon={<Package className="h-6 w-6 text-primary" />} bg="bg-primary/10"
          label={t("totalProducts")} value={items.length.toString()} />
        <MiniStat icon={<Package className="h-6 w-6 text-info" />} bg="bg-info/10"
          label={t("totalRevenue")} value={fmt(totalValue)} />
        <MiniStat icon={<Package className="h-6 w-6 text-[hsl(var(--secondary-foreground))]" />} bg="bg-secondary/30"
          label={t("lowStock")} value={`${lowCount} ${t("productsLow")}`} />
      </div>

      <SurfaceCard className="p-6">
        {/* Search bar */}
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("productSearch")}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">{t("name")}</th>
                <th className="pb-6 font-bold">{t("barcode")}</th>
                <th className="pb-6 font-bold">{t("price")}</th>
                <th className="pb-6 font-bold">{t("stock")}</th>
                {isAdmin && <th className="pb-6 font-bold text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[hsl(var(--surface-container-low))] transition-colors">
                  <td className="py-4 font-semibold text-foreground">{p.name}</td>
                  <td className="py-4 text-muted-foreground">{p.barcode || "—"}</td>
                  <td className="py-4 font-bold text-primary">{fmt(p.price)}</td>
                  <td className="py-4">
                    {p.stock === 0 ? <StatusPill tone="destructive">{t("outOfStock")}</StatusPill>
                      : p.stock <= 5 ? <StatusPill tone="warning">{p.stock} {p.unit}</StatusPill>
                      : <span className="text-foreground font-medium">{p.stock} {p.unit}</span>}
                  </td>
                  {isAdmin && (
                    <td className="py-4 text-right">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>{editing ? t("editProduct") : t("addProduct")}</DialogTitle></DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2"><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>{t("barcode")}</Label><Input value={form.barcode ?? ""} onChange={e => setForm({ ...form, barcode: e.target.value })} /></div>
            <div><Label>{t("sku")}</Label><Input value={form.sku ?? ""} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
            <div><Label>{t("price")}</Label><Input type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            <div><Label>{t("cost")}</Label><Input type="number" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
            <div><Label>{t("stock")}</Label><Input type="number" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
            <div><Label>{t("unit")}</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} /></div>
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

function MiniStat({ icon, bg, label, value }: any) {
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
