import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search, RefreshCw, Phone, Mail, MapPin, User, Truck, UserCog, MessageCircle } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type TabKey = "customer" | "supplier" | "staff";

interface ContactRow {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  position?: string | null;
  contact_person?: string | null;
  type: TabKey;
}

export default function Contacts() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [tab, setTab] = useState<TabKey>("customer");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "" });

  const load = async () => {
    setLoading(true);
    let data: any[] = [];
    if (tab === "customer") {
      const r = await supabase.from("customers").select("id,name,phone,address").order("created_at", { ascending: false });
      data = (r.data ?? []).map(d => ({ ...d, type: "customer" as const }));
    } else if (tab === "supplier") {
      const r = await supabase.from("suppliers").select("id,name,phone,email,address,contact_person").order("created_at", { ascending: false });
      data = (r.data ?? []).map(d => ({ ...d, type: "supplier" as const }));
    } else {
      const r = await supabase.from("staff").select("id,name,phone,address,position").order("created_at", { ascending: false });
      data = (r.data ?? []).map(d => ({ ...d, type: "staff" as const }));
    }
    setRows(data);
    setSelected(null);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const filtered = rows.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search)
  );

  const tabs: { key: TabKey; label: string }[] = [
    { key: "customer", label: "কাস্টমার" },
    { key: "supplier", label: "সাপ্লায়ার" },
    { key: "staff", label: "কর্মচারী" },
  ];

  const addLabel =
    tab === "customer" ? "কাস্টমার যুক্ত করুন" :
    tab === "supplier" ? "সাপ্লায়ার যুক্ত করুন" : "কর্মচারী যুক্ত করুন";

  const save = async () => {
    if (!form.name.trim()) return toast({ title: "নাম দিন", variant: "destructive" });
    const table = tab === "customer" ? "customers" : tab === "supplier" ? "suppliers" : "staff";
    const payload: any = { name: form.name, phone: form.phone || null, address: form.address || null };
    if (tab === "supplier") payload.email = form.email || null;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setForm({ name: "", phone: "", email: "", address: "" });
    setOpen(false);
    load();
  };

  const Icon = ({ type }: { type: TabKey }) =>
    type === "customer" ? <User className="h-5 w-5" /> :
    type === "supplier" ? <Truck className="h-5 w-5" /> : <UserCog className="h-5 w-5" />;

  return (
    <div>
      <PageHeader
        title="যোগাযোগ"
        subtitle="কাস্টমার, সাপ্লায়ার ও কর্মচারীর যোগাযোগ তথ্য"
        actions={isAdmin ? (
          <Button onClick={() => setOpen(true)} className="bg-foreground text-background hover:bg-foreground/90">
            <Plus className="h-4 w-4" /> যুক্ত করুন
          </Button>
        ) : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-6">
        {/* Left list */}
        <div className="bg-[hsl(var(--surface-container-lowest))] rounded-2xl border border-[hsl(var(--surface-container-high))] flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="flex gap-1 px-4 pt-4 border-b border-[hsl(var(--surface-container-high))]">
            {tabs.map(tb => (
              <button
                key={tb.key}
                onClick={() => setTab(tb.key)}
                className={`px-3 py-2 text-sm font-bold transition-colors border-b-2 -mb-px ${
                  tab === tb.key
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tb.label}
              </button>
            ))}
          </div>

          {/* Search + refresh */}
          <div className="p-3 flex gap-2 border-b border-[hsl(var(--surface-container-high))]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="কন্টাক্ট খোঁজ করুন"
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-[hsl(var(--surface-container-low))] border border-[hsl(var(--surface-container-high))] focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
              />
            </div>
            <button
              onClick={load}
              className="h-10 w-10 inline-flex items-center justify-center rounded-lg border border-[hsl(var(--surface-container-high))] hover:bg-[hsl(var(--surface-container-low))]"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto min-h-[300px]">
            {filtered.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted-foreground py-16">
                কোন কন্টাক্ট পাওয়া যায়নি
              </div>
            ) : (
              <ul className="divide-y divide-[hsl(var(--surface-container-high))]">
                {filtered.map(r => (
                  <li key={r.id}>
                    <button
                      onClick={() => setSelected(r)}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[hsl(var(--surface-container-low))] transition-colors ${
                        selected?.id === r.id ? "bg-[hsl(var(--surface-container-low))]" : ""
                      }`}
                    >
                      <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold shrink-0">
                        {r.name?.charAt(0)?.toUpperCase() || "?"}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-sm text-foreground truncate">{r.name}</div>
                        <div className="text-xs text-muted-foreground truncate">{r.phone || "—"}</div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {isAdmin && (
            <div className="p-3 border-t border-[hsl(var(--surface-container-high))]">
              <Button onClick={() => setOpen(true)} className="w-full bg-foreground text-background hover:bg-foreground/90 font-bold">
                {addLabel}
              </Button>
            </div>
          )}
        </div>

        {/* Right detail */}
        <div className="bg-[hsl(var(--surface-container-lowest))] rounded-2xl border border-[hsl(var(--surface-container-high))] min-h-[480px]">
          {!selected ? (
            <div className="h-full flex items-center justify-center text-muted-foreground py-20">
              কোন কন্টাক্ট সিলেক্ট করেননি
            </div>
          ) : (
            <div className="p-6 md:p-8">
              <div className="flex items-center gap-4 pb-6 border-b border-[hsl(var(--surface-container-high))]">
                <div className="h-16 w-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl">
                  {selected.name?.charAt(0)?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-xl font-black text-foreground">{selected.name}</h3>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                    <Icon type={selected.type} />
                    <span className="capitalize">
                      {selected.type === "customer" ? "কাস্টমার" : selected.type === "supplier" ? "সাপ্লায়ার" : "কর্মচারী"}
                    </span>
                    {selected.position && <span>• {selected.position}</span>}
                  </div>
                </div>
                {selected.phone && (
                  <div className="hidden sm:flex gap-2">
                    <a href={`tel:${selected.phone}`} className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20" aria-label="Call">
                      <Phone className="h-4 w-4" />
                    </a>
                    <a href={`sms:${selected.phone}`} className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20" aria-label="SMS">
                      <MessageCircle className="h-4 w-4" />
                    </a>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                <DetailRow icon={<Phone className="h-4 w-4" />} label="ফোন" value={selected.phone} />
                {selected.type === "supplier" && (
                  <>
                    <DetailRow icon={<Mail className="h-4 w-4" />} label="ইমেইল" value={selected.email} />
                    <DetailRow icon={<User className="h-4 w-4" />} label="যোগাযোগকারী" value={selected.contact_person} />
                  </>
                )}
                {selected.type === "staff" && (
                  <DetailRow icon={<UserCog className="h-4 w-4" />} label="পদবী" value={selected.position} />
                )}
                <DetailRow icon={<MapPin className="h-4 w-4" />} label="ঠিকানা" value={selected.address} className="md:col-span-2" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{addLabel}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>নাম</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>ফোন</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            {tab === "supplier" && (
              <div><Label>ইমেইল</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            )}
            <div><Label>ঠিকানা</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={save} className="bg-foreground text-background hover:bg-foreground/90">সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ icon, label, value, className = "" }: { icon: React.ReactNode; label: string; value?: string | null; className?: string }) {
  return (
    <div className={`flex items-start gap-3 p-4 rounded-xl bg-[hsl(var(--surface-container-low))] ${className}`}>
      <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</div>
        <div className="text-sm font-semibold text-foreground mt-0.5 break-words">{value || "—"}</div>
      </div>
    </div>
  );
}
