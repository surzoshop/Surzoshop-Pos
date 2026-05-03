import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";

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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold">{t("products")}</h1>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild><Button onClick={startNew}><Plus className="h-4 w-4 mr-1" />{t("addProduct")}</Button></DialogTrigger>
            <DialogContent>
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
                <Button onClick={save}>{t("save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-3">{t("name")}</th>
                <th className="p-3">{t("barcode")}</th>
                <th className="p-3 text-right">{t("price")}</th>
                <th className="p-3 text-right">{t("stock")}</th>
                {isAdmin && <th className="p-3 text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-medium">{p.name}</td>
                  <td className="p-3 text-muted-foreground">{p.barcode || "-"}</td>
                  <td className="p-3 text-right">{fmt(p.price)}</td>
                  <td className="p-3 text-right">
                    <span className={`inline-flex items-center gap-1 ${p.stock <= 5 ? "text-destructive" : ""}`}>
                      {p.stock <= 5 && <AlertTriangle className="h-3 w-3" />}{p.stock}
                    </span>
                  </td>
                  {isAdmin && (
                    <td className="p-3 text-right">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
