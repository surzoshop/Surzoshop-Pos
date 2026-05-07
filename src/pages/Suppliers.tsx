import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, Phone, MapPin, Truck, Pencil, Mail, User, Info } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton } from "@/components/PageHeader";

type Form = { name: string; phone: string; email: string; address: string; contact_person: string; opening_balance: number };
const empty: Form = { name: "", phone: "", email: "", address: "", contact_person: "", opening_balance: 0 };

export default function Suppliers() {
  const { t, fmt } = useT();
  const { role } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<Form>(empty);
  const isAdmin = role === "admin";

  const load = async () => {
    const { data } = await supabase.from("suppliers").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setEditId(null); setForm(empty); setOpen(true); };
  const openEdit = (s: any) => {
    setEditId(s.id);
    setForm({
      name: s.name ?? "", phone: s.phone ?? "", email: s.email ?? "",
      address: s.address ?? "", contact_person: s.contact_person ?? "",
      opening_balance: Number(s.opening_balance ?? 0),
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name) return toast({ title: "নাম আবশ্যক", variant: "destructive" });
    const payload = { ...form, opening_balance: Number(form.opening_balance) || 0 };
    const { error } = editId
      ? await supabase.from("suppliers").update(payload).eq("id", editId)
      : await supabase.from("suppliers").insert(payload);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: editId ? "আপডেট হয়েছে ✓" : "যোগ হয়েছে ✓" });
    setForm(empty); setEditId(null); setOpen(false); load();
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  const filtered = items.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  return (
    <div>
      <PageHeader
        title={t("suppliers")}
        subtitle={t("suppliersSubtitle")}
        actions={isAdmin ? <PrimaryButton onClick={openNew}><Plus className="h-5 w-5" />{t("addSupplier")}</PrimaryButton> : undefined}
      />

      <SurfaceCard className="p-4 sm:p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t("search") + " — নাম বা ফোন"}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {filtered.length === 0 && <div className="col-span-full text-center text-muted-foreground py-16">{t("noResults")}</div>}
        {filtered.map(s => (
          <SurfaceCard key={s.id} className="p-5 transition-all hover:-translate-y-1 hover:shadow-lg group">
            <div className="flex items-start justify-between mb-4">
              <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 text-primary flex items-center justify-center ring-1 ring-primary/20">
                <Truck className="h-6 w-6" />
              </div>
              {isAdmin && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-primary/10 text-primary"
                    onClick={() => openEdit(s)} title="সম্পাদনা">
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-lg hover:bg-destructive/10 text-destructive"
                    onClick={() => del(s.id)} title="মুছুন">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            <h3 className="font-bold text-foreground text-lg leading-tight">{s.name}</h3>
            {s.contact_person && <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{s.contact_person}</p>}
            <div className="mt-3 space-y-1.5">
              {s.phone && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Phone className="h-4 w-4 shrink-0" /> {s.phone}</div>}
              {s.email && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Mail className="h-4 w-4 shrink-0" /> <span className="truncate">{s.email}</span></div>}
              {s.address && <div className="flex items-start gap-2 text-sm text-muted-foreground"><MapPin className="h-4 w-4 mt-0.5 shrink-0" /> <span className="truncate">{s.address}</span></div>}
            </div>
            {Number(s.opening_balance) > 0 && (
              <div className="mt-4 pt-3 border-t border-[hsl(var(--surface-container-high))] flex justify-between text-sm">
                <span className="text-muted-foreground">প্রারম্ভিক বকেয়া</span>
                <span className="font-bold text-destructive">{fmt(Number(s.opening_balance))}</span>
              </div>
            )}
            {isAdmin && (
              <div className="mt-4 sm:hidden flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1" onClick={() => openEdit(s)}><Pencil className="h-3.5 w-3.5" />সম্পাদনা</Button>
                <Button size="sm" variant="outline" className="text-destructive border-destructive/30" onClick={() => del(s.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            )}
          </SurfaceCard>
        ))}
      </div>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditId(null); setForm(empty); } }}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "সরবরাহকারী সম্পাদনা" : t("addSupplier")}</DialogTitle>
            <DialogDescription>সরবরাহকারীর সম্পূর্ণ যোগাযোগ ও আর্থিক তথ্য পূরণ করুন।</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>নাম <span className="text-destructive">*</span></Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="যেমনঃ রহিম এন্টারপ্রাইজ" />
            </div>
            <div>
              <Label>যোগাযোগের ব্যক্তি</Label>
              <Input value={form.contact_person} onChange={e => setForm({ ...form, contact_person: e.target.value })} placeholder="যেমনঃ মোঃ করিম" />
              <p className="text-[11px] text-muted-foreground mt-1">প্রতিষ্ঠানের পক্ষ থেকে যিনি যোগাযোগ রাখেন।</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
              <div><Label>{t("email")}</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" /></div>
            </div>
            <div><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="দোকান/অফিসের ঠিকানা" /></div>
            <div>
              <Label>প্রারম্ভিক বকেয়া (৳)</Label>
              <Input type="number" value={form.opening_balance} onChange={e => setForm({ ...form, opening_balance: +e.target.value })} placeholder="0" />
              <p className="text-[11px] text-muted-foreground mt-1 flex items-start gap-1">
                <Info className="h-3 w-3 mt-0.5 shrink-0" />
                আগে থেকে এই সরবরাহকারীর কাছে আপনার যত টাকা বকেয়া আছে — সেটা এখানে দিন। নতুন হলে ০ রাখুন।
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={save} className="gradient-primary">{editId ? "আপডেট" : t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
