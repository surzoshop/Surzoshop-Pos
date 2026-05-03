import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Wallet } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton } from "@/components/PageHeader";

export default function Expenses() {
  const { t, fmt, lang } = useT();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", amount: 0, category_id: "", expense_date: new Date().toISOString().slice(0, 10), payment_method: "cash", notes: "" });
  const [newCat, setNewCat] = useState("");

  const load = async () => {
    const [e, c] = await Promise.all([
      supabase.from("expenses").select("*, expense_categories(name)").order("expense_date", { ascending: false }),
      supabase.from("expense_categories").select("*").order("name"),
    ]);
    setItems(e.data ?? []); setCats(c.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.title || form.amount <= 0) return toast({ title: "Title & amount required", variant: "destructive" });
    const { error } = await supabase.from("expenses").insert({ ...form, category_id: form.category_id || null, created_by: user!.id });
    if (error) return toast({ title: error.message, variant: "destructive" });
    setForm({ title: "", amount: 0, category_id: "", expense_date: new Date().toISOString().slice(0, 10), payment_method: "cash", notes: "" });
    setOpen(false); load();
  };

  const addCat = async () => {
    if (!newCat) return;
    await supabase.from("expense_categories").insert({ name: newCat });
    setNewCat(""); load();
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    await supabase.from("expenses").delete().eq("id", id); load();
  };

  const todayTotal = items.filter(i => i.expense_date === new Date().toISOString().slice(0, 10)).reduce((a, b) => a + Number(b.amount), 0);
  const monthTotal = items.filter(i => i.expense_date.slice(0, 7) === new Date().toISOString().slice(0, 7)).reduce((a, b) => a + Number(b.amount), 0);

  return (
    <div>
      <PageHeader title={t("expenses")} subtitle={t("expensesSubtitle")}
        actions={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />{t("addExpense")}</PrimaryButton>} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <SurfaceCard className="p-6">
          <div className="p-3 bg-destructive/10 rounded-xl w-fit mb-3"><Wallet className="h-5 w-5 text-destructive" /></div>
          <p className="text-sm text-muted-foreground">{t("filterToday")}</p>
          <h3 className="text-2xl font-bold">{fmt(todayTotal)}</h3>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <div className="p-3 bg-secondary/30 rounded-xl w-fit mb-3"><Wallet className="h-5 w-5 text-[hsl(var(--secondary-foreground))]" /></div>
          <p className="text-sm text-muted-foreground">{t("filterMonth")}</p>
          <h3 className="text-2xl font-bold">{fmt(monthTotal)}</h3>
        </SurfaceCard>
        <SurfaceCard className="p-6">
          <p className="text-sm text-muted-foreground mb-2">{t("category")}</p>
          <div className="flex gap-2">
            <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder={t("add") + " " + t("category")} />
            {isAdmin && <Button onClick={addCat}>{t("add")}</Button>}
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">{t("date")}</th>
                <th className="pb-6 font-bold">{t("title")}</th>
                <th className="pb-6 font-bold">{t("category")}</th>
                <th className="pb-6 font-bold">{t("paymentMethod")}</th>
                <th className="pb-6 font-bold">{t("amount")}</th>
                <th className="pb-6 font-bold text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {items.length === 0 && <tr><td colSpan={6} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {items.map(i => (
                <tr key={i.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4">{new Date(i.expense_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                  <td className="py-4 font-semibold">{i.title}</td>
                  <td className="py-4 text-muted-foreground">{i.expense_categories?.name ?? "—"}</td>
                  <td className="py-4 capitalize">{i.payment_method}</td>
                  <td className="py-4 font-bold text-destructive">{fmt(Number(i.amount))}</td>
                  <td className="py-4 text-right">
                    {isAdmin && <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => del(i.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>{t("addExpense")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("title")}</Label><Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("amount")}</Label><Input type="number" value={form.amount} onChange={e => setForm({ ...form, amount: +e.target.value })} /></div>
              <div><Label>{t("expenseDate")}</Label><Input type="date" value={form.expense_date} onChange={e => setForm({ ...form, expense_date: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("category")}</Label>
                <select value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })} className="w-full h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                  <option value="">—</option>
                  {cats.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label>{t("paymentMethod")}</Label>
                <select value={form.payment_method} onChange={e => setForm({ ...form, payment_method: e.target.value })} className="w-full h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                  <option value="cash">Cash</option><option value="bank">Bank</option><option value="bkash">bKash</option><option value="nagad">Nagad</option>
                </select>
              </div>
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
