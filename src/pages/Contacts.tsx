import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, RefreshCw, Phone, Mail, MapPin,
  User, Truck, UserCog, MessageCircle, Users, Briefcase, Copy, ChevronRight,
} from "lucide-react";
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

const TAB_META: Record<TabKey, { label: string; icon: typeof User; tone: string; ringTone: string }> = {
  customer: { label: "কাস্টমার", icon: User, tone: "bg-blue-500/10 text-blue-600", ringTone: "ring-blue-500/30" },
  supplier: { label: "সাপ্লায়ার", icon: Truck, tone: "bg-amber-500/10 text-amber-600", ringTone: "ring-amber-500/30" },
  staff:    { label: "কর্মচারী", icon: Briefcase, tone: "bg-emerald-500/10 text-emerald-600", ringTone: "ring-emerald-500/30" },
};

const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500",
  "bg-rose-500", "bg-violet-500", "bg-cyan-500", "bg-fuchsia-500", "bg-orange-500",
];
const colorFor = (s: string) => AVATAR_COLORS[(s?.charCodeAt(0) || 0) % AVATAR_COLORS.length];

export default function Contacts() {
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [tab, setTab] = useState<TabKey>("customer");
  const [search, setSearch] = useState("");
  const [counts, setCounts] = useState({ customer: 0, supplier: 0, staff: 0 });
  const [rows, setRows] = useState<ContactRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<ContactRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", position: "" });

  const loadCounts = async () => {
    const [c, s, st] = await Promise.all([
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("suppliers").select("id", { count: "exact", head: true }),
      supabase.from("staff").select("id", { count: "exact", head: true }),
    ]);
    setCounts({ customer: c.count ?? 0, supplier: s.count ?? 0, staff: st.count ?? 0 });
  };

  const load = async () => {
    setLoading(true);
    let data: ContactRow[] = [];
    if (tab === "customer") {
      const r = await supabase.from("customers").select("id,name,phone,address").order("name");
      data = (r.data ?? []).map(d => ({ ...d, type: "customer" as const }));
    } else if (tab === "supplier") {
      const r = await supabase.from("suppliers").select("id,name,phone,email,address,contact_person").order("name");
      data = (r.data ?? []).map(d => ({ ...d, type: "supplier" as const }));
    } else {
      const r = await supabase.from("staff").select("id,name,phone,address,position").order("name");
      data = (r.data ?? []).map(d => ({ ...d, type: "staff" as const }));
    }
    setRows(data);
    setSelected(prev => data.find(d => d.id === prev?.id) ?? data[0] ?? null);
    setLoading(false);
  };

  useEffect(() => { loadCounts(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const filtered = useMemo(() => rows.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search)
  ), [rows, search]);

  // Group alphabetically
  const grouped = useMemo(() => {
    const map = new Map<string, ContactRow[]>();
    for (const r of filtered) {
      const k = (r.name?.[0] || "#").toUpperCase();
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(r);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  const addLabel = `${TAB_META[tab].label} যুক্ত করুন`;

  const save = async () => {
    if (!form.name.trim()) return toast({ title: "নাম দিন", variant: "destructive" });
    const table = tab === "customer" ? "customers" : tab === "supplier" ? "suppliers" : "staff";
    const payload: any = { name: form.name, phone: form.phone || null, address: form.address || null };
    if (tab === "supplier") payload.email = form.email || null;
    if (tab === "staff") payload.position = form.position || null;
    const { error } = await supabase.from(table as any).insert(payload);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "সংরক্ষণ হয়েছে" });
    setForm({ name: "", phone: "", email: "", address: "", position: "" });
    setOpen(false);
    loadCounts();
    load();
  };

  const copy = (txt?: string | null) => {
    if (!txt) return;
    navigator.clipboard.writeText(txt);
    toast({ title: "কপি হয়েছে", description: txt });
  };

  return (
    <div>
      <PageHeader
        title="যোগাযোগ"
        subtitle="কাস্টমার, সাপ্লায়ার ও কর্মচারীর সকল যোগাযোগ এক জায়গায়"
        actions={isAdmin ? (
          <Button onClick={() => setOpen(true)} className="bg-foreground text-background hover:bg-foreground/90 font-bold">
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        ) : undefined}
      />

      {/* Stat tabs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        {(Object.keys(TAB_META) as TabKey[]).map(k => {
          const meta = TAB_META[k];
          const Icon = meta.icon;
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`group text-left rounded-2xl border p-4 transition-all ${
                active
                  ? "bg-foreground text-background border-foreground shadow-md"
                  : "bg-[hsl(var(--surface-container-lowest))] border-[hsl(var(--surface-container-high))] hover:border-foreground/40"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`h-11 w-11 rounded-xl flex items-center justify-center ${active ? "bg-background/10" : meta.tone}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <ChevronRight className={`h-4 w-4 transition-transform ${active ? "translate-x-0.5" : "opacity-40"}`} />
              </div>
              <div className="mt-3 text-2xl font-black tracking-tight">{counts[k]}</div>
              <div className={`text-xs font-bold mt-0.5 ${active ? "text-background/80" : "text-muted-foreground"}`}>
                {meta.label}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-5">
        {/* Left list */}
        <div className="bg-[hsl(var(--surface-container-lowest))] rounded-2xl border border-[hsl(var(--surface-container-high))] flex flex-col overflow-hidden h-[calc(100vh-320px)] min-h-[520px]">
          <div className="p-3 flex gap-2 border-b border-[hsl(var(--surface-container-high))]">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`${TAB_META[tab].label} খোঁজ করুন...`}
                className="w-full h-10 pl-9 pr-3 rounded-xl bg-[hsl(var(--surface-container-low))] border border-transparent focus:border-foreground/30 focus:outline-none text-sm font-medium"
              />
            </div>
            <button
              onClick={() => { load(); loadCounts(); }}
              className="h-10 w-10 inline-flex items-center justify-center rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))]"
              aria-label="Refresh"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="p-3 space-y-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl animate-pulse">
                    <div className="h-11 w-11 rounded-full bg-[hsl(var(--surface-container-high))]" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-2/3 bg-[hsl(var(--surface-container-high))] rounded" />
                      <div className="h-2 w-1/3 bg-[hsl(var(--surface-container-high))] rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : grouped.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center px-6 py-16">
                <Users className="h-12 w-12 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-bold text-foreground">কোন কন্টাক্ট নেই</p>
                <p className="text-xs text-muted-foreground mt-1">নতুন {TAB_META[tab].label} যুক্ত করুন</p>
              </div>
            ) : (
              <div className="py-2">
                {grouped.map(([letter, items]) => (
                  <div key={letter}>
                    <div className="sticky top-0 z-[1] px-4 py-1.5 text-[11px] font-black text-muted-foreground bg-[hsl(var(--surface-container-lowest))]/95 backdrop-blur uppercase tracking-wider">
                      {letter}
                    </div>
                    {items.map(r => {
                      const active = selected?.id === r.id;
                      return (
                        <button
                          key={r.id}
                          onClick={() => setSelected(r)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 mx-2 my-0.5 rounded-xl text-left transition-all ${
                            active
                              ? "bg-foreground text-background"
                              : "hover:bg-[hsl(var(--surface-container-low))]"
                          }`}
                          style={{ width: "calc(100% - 16px)" }}
                        >
                          <div className={`h-11 w-11 rounded-full ${colorFor(r.name)} text-white flex items-center justify-center font-black shrink-0 shadow-sm`}>
                            {r.name?.charAt(0)?.toUpperCase() || "?"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`font-bold text-sm truncate ${active ? "text-background" : "text-foreground"}`}>
                              {r.name}
                            </div>
                            <div className={`text-xs truncate font-medium ${active ? "text-background/70" : "text-muted-foreground"}`}>
                              {r.phone || "ফোন নেই"}
                            </div>
                          </div>
                          {r.phone && (
                            <Phone className={`h-3.5 w-3.5 shrink-0 ${active ? "text-background/60" : "text-muted-foreground"}`} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 border-t border-[hsl(var(--surface-container-high))] text-xs font-bold text-muted-foreground">
            মোট: {filtered.length} জন
          </div>
        </div>

        {/* Right detail */}
        <div className="bg-[hsl(var(--surface-container-lowest))] rounded-2xl border border-[hsl(var(--surface-container-high))] overflow-hidden">
          {!selected ? (
            <div className="h-full min-h-[520px] flex flex-col items-center justify-center text-muted-foreground p-10">
              <div className="h-20 w-20 rounded-full bg-[hsl(var(--surface-container-low))] flex items-center justify-center mb-4">
                <User className="h-9 w-9 opacity-40" />
              </div>
              <p className="font-bold text-foreground">কোন কন্টাক্ট সিলেক্ট করেননি</p>
              <p className="text-xs mt-1">বাম পাশ থেকে একটি কন্টাক্ট বাছাই করুন</p>
            </div>
          ) : (
            <div>
              {/* Header band */}
              <div className="relative">
                <div className="h-28 bg-gradient-to-br from-foreground to-foreground/70" />
                <div className="px-6 md:px-8 pb-6 -mt-12">
                  <div className="flex items-end gap-4">
                    <div className={`h-24 w-24 rounded-2xl ${colorFor(selected.name)} text-white flex items-center justify-center text-3xl font-black shadow-xl ring-4 ring-[hsl(var(--surface-container-lowest))]`}>
                      {selected.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <h2 className="text-2xl font-black text-foreground truncate">{selected.name}</h2>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5">
                        <span className={`inline-flex items-center gap-1.5 text-[11px] font-black px-2.5 py-1 rounded-full ${TAB_META[selected.type].tone}`}>
                          {(() => { const I = TAB_META[selected.type].icon; return <I className="h-3 w-3" />; })()}
                          {TAB_META[selected.type].label}
                        </span>
                        {selected.position && (
                          <span className="text-[11px] font-bold text-muted-foreground">• {selected.position}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Quick actions */}
                  {selected.phone && (
                    <div className="flex flex-wrap gap-2 mt-5">
                      <a href={`tel:${selected.phone}`} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-foreground text-background text-sm font-bold hover:bg-foreground/90">
                        <Phone className="h-4 w-4" /> কল করুন
                      </a>
                      <a href={`sms:${selected.phone}`} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[hsl(var(--surface-container-low))] text-foreground text-sm font-bold hover:bg-[hsl(var(--surface-container-high))]">
                        <MessageCircle className="h-4 w-4" /> SMS
                      </a>
                      <a
                        href={`https://wa.me/${selected.phone.replace(/[^\d]/g, "")}`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-emerald-500/10 text-emerald-600 text-sm font-bold hover:bg-emerald-500/20"
                      >
                        <MessageCircle className="h-4 w-4" /> WhatsApp
                      </a>
                      {selected.email && (
                        <a href={`mailto:${selected.email}`} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-[hsl(var(--surface-container-low))] text-foreground text-sm font-bold hover:bg-[hsl(var(--surface-container-high))]">
                          <Mail className="h-4 w-4" /> ইমেইল
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Details */}
              <div className="px-6 md:px-8 pb-8">
                <div className="text-[11px] font-black uppercase tracking-wider text-muted-foreground mb-3">
                  যোগাযোগের তথ্য
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <DetailRow icon={<Phone className="h-4 w-4" />} label="ফোন নম্বর" value={selected.phone} onCopy={() => copy(selected.phone)} />
                  {selected.type === "supplier" && (
                    <>
                      <DetailRow icon={<Mail className="h-4 w-4" />} label="ইমেইল" value={selected.email} onCopy={() => copy(selected.email)} />
                      <DetailRow icon={<User className="h-4 w-4" />} label="যোগাযোগকারী" value={selected.contact_person} />
                    </>
                  )}
                  {selected.type === "staff" && (
                    <DetailRow icon={<UserCog className="h-4 w-4" />} label="পদবী" value={selected.position} />
                  )}
                  <DetailRow icon={<MapPin className="h-4 w-4" />} label="ঠিকানা" value={selected.address} className="md:col-span-2" />
                </div>
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
            <div><Label>নাম *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>ফোন</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            {tab === "supplier" && (
              <div><Label>ইমেইল</Label><Input value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            )}
            {tab === "staff" && (
              <div><Label>পদবী</Label><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
            )}
            <div><Label>ঠিকানা</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={save} className="bg-foreground text-background hover:bg-foreground/90 font-bold">সংরক্ষণ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({
  icon, label, value, className = "", onCopy,
}: { icon: React.ReactNode; label: string; value?: string | null; className?: string; onCopy?: () => void }) {
  return (
    <div className={`group flex items-start gap-3 p-4 rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))]/60 transition-colors ${className}`}>
      <div className="h-10 w-10 rounded-xl bg-background text-foreground flex items-center justify-center shrink-0 border border-[hsl(var(--surface-container-high))]">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">{label}</div>
        <div className="text-sm font-bold text-foreground mt-1 break-words">{value || "—"}</div>
      </div>
      {value && onCopy && (
        <button onClick={onCopy} className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-lg hover:bg-background flex items-center justify-center" aria-label="Copy">
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
