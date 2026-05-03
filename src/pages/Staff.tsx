import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, UserCog } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton } from "@/components/PageHeader";

export default function Staff() {
  const { t, fmt } = useT();
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", nid: "", address: "", position: "", salary: 0 });

  const load = async () => {
    const { data } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    const { error } = await supabase.from("staff").insert(form);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setForm({ name: "", phone: "", nid: "", address: "", position: "", salary: 0 });
    setOpen(false); load();
  };
  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    await supabase.from("staff").delete().eq("id", id); load();
  };

  return (
    <div>
      <PageHeader title={t("staff")} subtitle={t("staffSubtitle")}
        actions={isAdmin ? <PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />{t("addStaff")}</PrimaryButton> : undefined} />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.length === 0 && <div className="col-span-full text-center text-muted-foreground py-16">{t("noResults")}</div>}
        {items.map(s => (
          <SurfaceCard key={s.id} className="p-6 transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center"><UserCog className="h-6 w-6" /></div>
              {isAdmin && <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => del(s.id)}><Trash2 className="h-4 w-4" /></Button>}
            </div>
            <h3 className="font-bold text-lg">{s.name}</h3>
            <p className="text-sm text-muted-foreground">{s.position}</p>
            <div className="mt-3 pt-3 border-t border-[hsl(var(--surface-container-high))] flex justify-between text-sm">
              <span className="text-muted-foreground">{t("salary")}</span>
              <span className="font-bold">{fmt(Number(s.salary))}</span>
            </div>
            {s.phone && <p className="text-xs text-muted-foreground mt-2">{s.phone}</p>}
          </SurfaceCard>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>{t("addStaff")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("position")}</Label><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
              <div><Label>{t("salary")}</Label><Input type="number" value={form.salary} onChange={e => setForm({ ...form, salary: +e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>{t("nid")}</Label><Input value={form.nid} onChange={e => setForm({ ...form, nid: e.target.value })} /></div>
            </div>
            <div><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
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
