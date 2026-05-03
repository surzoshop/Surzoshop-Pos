import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, Phone, MapPin } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton } from "@/components/PageHeader";

export default function Customers() {
  const { t } = useT();
  const { role } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({
    name: "", phone: "", address: "", nid: "",
    present_address: "", permanent_address: "", occupation: "", monthly_income: 0,
  });
  const isAdmin = role === "admin";

  const load = async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!form.name) return toast({ title: "Name required", variant: "destructive" });
    const payload = { ...form, monthly_income: form.monthly_income || null };
    const { error } = await supabase.from("customers").insert(payload);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setForm({ name: "", phone: "", address: "", nid: "", present_address: "", permanent_address: "", occupation: "", monthly_income: 0 });
    setOpen(false); load();
  };
  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  const filtered = items.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  return (
    <div>
      <PageHeader
        title={t("customers")}
        subtitle={t("customersSubtitle")}
        actions={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />{t("addCustomer")}</PrimaryButton>}
      />

      <SurfaceCard className="p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("search")}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-16">{t("noResults")}</div>
        )}
        {filtered.map(c => (
          <SurfaceCard key={c.id} className="p-6 transition-all hover:-translate-y-1">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-lg">
                {c.name.charAt(0).toUpperCase()}
              </div>
              {isAdmin && (
                <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={() => del(c.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
            <h3 className="font-bold text-foreground text-lg">{c.name}</h3>
            {c.phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Phone className="h-4 w-4" /> {c.phone}
              </div>
            )}
            {c.address && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground mt-1">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0" /> <span className="truncate">{c.address}</span>
              </div>
            )}
          </SurfaceCard>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("addCustomer")} — {t("kyc")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("nid")}</Label><Input value={form.nid} onChange={e => setForm({ ...form, nid: e.target.value })} /></div>
              <div><Label>{t("occupation")}</Label><Input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} /></div>
            </div>
            <div><Label>{t("monthlyIncome")}</Label><Input type="number" value={form.monthly_income} onChange={e => setForm({ ...form, monthly_income: +e.target.value })} /></div>
            <div><Label>{t("presentAddress")}</Label><Input value={form.present_address} onChange={e => setForm({ ...form, present_address: e.target.value })} /></div>
            <div><Label>{t("permanentAddress")}</Label><Input value={form.permanent_address} onChange={e => setForm({ ...form, permanent_address: e.target.value })} /></div>
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
