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
  User, Truck, UserCog, MessageCircle, Users, Briefcase, Copy, ChevronRight, ArrowLeft,
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

const TAB_META: Record<TabKey, { label: string; icon: typeof User; tone: string }> = {
  customer: { label: "কাস্টমার", icon: User, tone: "bg-info/10 text-info" },
  supplier: { label: "সাপ্লায়ার", icon: Truck, tone: "bg-secondary/30 text-[hsl(var(--secondary-foreground))]" },
  staff:    { label: "কর্মচারী", icon: Briefcase, tone: "bg-primary/10 text-primary" },
};

const AVATAR_GRADIENTS = [
  "from-emerald-500 to-teal-600",
  "from-sky-500 to-indigo-600",
  "from-amber-500 to-orange-600",
  "from-rose-500 to-pink-600",
  "from-violet-500 to-fuchsia-600",
  "from-cyan-500 to-blue-600",
  "from-lime-500 to-green-600",
  "from-orange-500 to-red-500",
];
const gradFor = (s: string) => AVATAR_GRADIENTS[(s?.charCodeAt(0) || 0) % AVATAR_GRADIENTS.length];

// Format phone for wa.me — assume BD if 11 digits starting with 0
const waNumber = (phone?: string | null) => {
  if (!phone) return null;
  const digits = phone.replace(/[^\d]/g, "");
  if (!digits) return null;
  if (digits.startsWith("880")) return digits;
  if (digits.startsWith("0") && digits.length === 11) return "88" + digits;
  if (digits.length === 10) return "880" + digits;
  return digits;
};
const waLink = (phone?: string | null, msg?: string) => {
  const n = waNumber(phone);
  if (!n) return null;
  return `https://wa.me/${n}${msg ? `?text=${encodeURIComponent(msg)}` : ""}`;
};

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
    setSelected(prev => data.find(d => d.id === prev?.id) ?? null);
    setLoading(false);
  };

  useEffect(() => { loadCounts(); }, []);
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [tab]);

  const filtered = useMemo(() => rows.filter(r =>
    !search || r.name?.toLowerCase().includes(search.toLowerCase()) || r.phone?.includes(search)
  ), [rows, search]);

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

  const openWhatsApp = (phone?: string | null, name?: string) => {
    const link = waLink(phone, name ? `আসসালামু আলাইকুম ${name},` : undefined);
    if (!link) {
      toast({ title: "ফোন নম্বর নেই", description: "WhatsApp খুলতে নম্বর প্রয়োজন", variant: "destructive" });
      return;
    }
    window.open(link, "_blank", "noreferrer");
  };

  return (
    <div className="font-bn">
      <PageHeader
        title="যোগাযোগ"
        subtitle="কাস্টমার, সাপ্লায়ার ও কর্মচারীর সকল যোগাযোগ এক জায়গায়"
        actions={isAdmin ? (
          <Button onClick={() => setOpen(true)} className="gradient-primary text-primary-foreground hover:brightness-110 font-bold shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)]">
            <Plus className="h-4 w-4" /> {addLabel}
          </Button>
        ) : undefined}
      />

      {/* Stat tabs */}
      <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-5">
        {(Object.keys(TAB_META) as TabKey[]).map(k => {
          const meta = TAB_META[k];
          const Icon = meta.icon;
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => { setTab(k); setSelected(null); }}
              className={`group text-left rounded-2xl p-3 sm:p-4 transition-all min-h-[88px] ${
                active
                  ? "gradient-primary text-primary-foreground shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)]"
                  : "bg-card hover:shadow-md hover:-translate-y-0.5"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className={`h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center ${active ? "bg-white/20" : meta.tone}`}>
                  <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                </div>
                <ChevronRight className={`h-4 w-4 ${active ? "translate-x-0.5" : "opacity-30"}`} />
              </div>
              <div className="mt-2 sm:mt-3 text-xl sm:text-2xl font-black tracking-tight">{counts[k]}</div>
              <div className={`text-[11px] sm:text-xs font-bold mt-0.5 ${active ? "text-primary-foreground/85" : "text-muted-foreground"}`}>
                {meta.label}
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 lg:gap-5">
        {/* Left list */}
        <div className={`bg-card rounded-2xl flex flex-col overflow-hidden h-[calc(100vh-300px)] min-h-[480px] shadow-sm ${selected ? "hidden lg:flex" : "flex"}`}>
          <div className="p-3 flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`${TAB_META[tab].label} খোঁজ করুন...`}
                className="w-full h-11 pl-9 pr-3 rounded-xl bg-[hsl(var(--surface-container-low))] focus:ring-2 focus:ring-primary/30 focus:outline-none text-sm font-medium"
              />
            </div>
            <button
              onClick={() => { load(); loadCounts(); }}
              className="h-11 w-11 inline-flex items-center justify-center rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container-high))] active:scale-95 transition-all"
              aria-label="রিফ্রেশ"
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
                <div className="h-16 w-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Users className="h-8 w-8" />
                </div>
                <p className="text-sm font-bold text-foreground">কোন কন্টাক্ট নেই</p>
                <p className="text-xs text-muted-foreground mt-1">নতুন {TAB_META[tab].label} যুক্ত করুন</p>
              </div>
            ) : (
              <div className="py-2">
                {grouped.map(([letter, items]) => (
                  <div key={letter}>
                    <div className="sticky top-0 z-[1] px-4 py-1.5 text-[11px] font-black text-primary bg-card/95 backdrop-blur uppercase tracking-wider">
                      {letter}
                    </div>
                    {items.map(r => {
                      const active = selected?.id === r.id;
                      const wa = waLink(r.phone);
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center gap-2 px-2 py-1.5 mx-2 my-0.5 rounded-xl transition-all ${
                            active
                              ? "bg-primary/10 ring-1 ring-primary/30"
                              : "hover:bg-[hsl(var(--surface-container-low))]"
                          }`}
                        >
                          <button
                            onClick={() => setSelected(r)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left p-1"
                          >
                            <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${gradFor(r.name)} text-white flex items-center justify-center font-black shrink-0 shadow-sm`}>
                              {r.name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className={`font-bold text-sm truncate ${active ? "text-primary" : "text-foreground"}`}>
                                {r.name}
                              </div>
                              <div className="text-xs truncate font-medium text-muted-foreground">
                                {r.phone || "ফোন নেই"}
                              </div>
                            </div>
                          </button>
                          {r.phone && (
                            <>
                              <a href={`tel:${r.phone}`} aria-label="কল করুন"
                                 className="h-9 w-9 rounded-lg bg-info/10 text-info hover:bg-info/20 active:scale-95 inline-flex items-center justify-center transition-all">
                                <Phone className="h-4 w-4" />
                              </a>
                              {wa && (
                                <a href={wa} target="_blank" rel="noreferrer" aria-label="WhatsApp"
                                   className="h-9 w-9 rounded-lg bg-emerald-500/15 text-emerald-600 hover:bg-emerald-500/25 active:scale-95 inline-flex items-center justify-center transition-all">
                                  <MessageCircle className="h-4 w-4" />
                                </a>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-2.5 text-xs font-bold text-muted-foreground bg-[hsl(var(--surface-container-low))]">
            মোট: {filtered.length} জন
          </div>
        </div>

        {/* Right detail */}
        <div className={`bg-card rounded-2xl overflow-hidden shadow-sm ${selected ? "block" : "hidden lg:block"}`}>
          {!selected ? (
            <div className="h-full min-h-[480px] flex flex-col items-center justify-center text-muted-foreground p-10">
              <div className="h-20 w-20 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-4">
                <User className="h-9 w-9" />
              </div>
              <p className="font-bold text-foreground">কোন কন্টাক্ট সিলেক্ট করেননি</p>
              <p className="text-xs mt-1">বাম পাশ থেকে একটি কন্টাক্ট বাছাই করুন</p>
            </div>
          ) : (
            <div>
              {/* Mobile back button */}
              <div className="lg:hidden p-3">
                <button onClick={() => setSelected(null)}
                        className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline">
                  <ArrowLeft className="h-4 w-4" /> তালিকায় ফিরে যান
                </button>
              </div>

              {/* Header band — soft brand gradient (no black) */}
              <div className="relative">
                <div className="h-28 bg-gradient-to-br from-primary/15 via-primary/10 to-secondary/30" />
                <div className="px-5 sm:px-8 pb-6 -mt-12">
                  <div className="flex items-end gap-4">
                    <div className={`h-20 w-20 sm:h-24 sm:w-24 rounded-2xl bg-gradient-to-br ${gradFor(selected.name)} text-white flex items-center justify-center text-2xl sm:text-3xl font-black shadow-xl ring-4 ring-card`}>
                      {selected.name?.charAt(0)?.toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0 pb-1">
                      <h2 className="text-xl sm:text-2xl font-black text-foreground truncate">{selected.name}</h2>
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
                  <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-2 mt-5">
                    {selected.phone ? (
                      <>
                        <a href={`tel:${selected.phone}`}
                           className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl gradient-primary text-primary-foreground text-sm font-bold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)] active:scale-95 transition-all">
                          <Phone className="h-4 w-4" /> কল
                        </a>
                        <button
                          onClick={() => openWhatsApp(selected.phone, selected.name)}
                          className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-emerald-500 text-white text-sm font-bold shadow-[0_8px_20px_-8px_rgb(16_185_129/0.5)] hover:bg-emerald-600 active:scale-95 transition-all">
                          <MessageCircle className="h-4 w-4" /> WhatsApp
                        </button>
                        <a href={`sms:${selected.phone}`}
                           className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[hsl(var(--surface-container-low))] text-foreground text-sm font-bold hover:bg-[hsl(var(--surface-container-high))] active:scale-95 transition-all">
                          <MessageCircle className="h-4 w-4" /> SMS
                        </a>
                        {selected.email && (
                          <a href={`mailto:${selected.email}`}
                             className="inline-flex items-center justify-center gap-2 h-11 px-4 rounded-xl bg-[hsl(var(--surface-container-low))] text-foreground text-sm font-bold hover:bg-[hsl(var(--surface-container-high))] active:scale-95 transition-all">
                            <Mail className="h-4 w-4" /> ইমেইল
                          </a>
                        )}
                      </>
                    ) : (
                      <div className="col-span-2 text-xs font-medium text-muted-foreground bg-[hsl(var(--surface-container-low))] rounded-xl px-4 py-3">
                        ফোন নম্বর যোগ করলে কল ও WhatsApp ব্যবহার করতে পারবেন।
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="px-5 sm:px-8 pb-8">
                <div className="text-[11px] font-black uppercase tracking-wider text-primary mb-3">
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
        <DialogContent className="font-bn">
          <DialogHeader><DialogTitle>{addLabel}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>নাম *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>ফোন (WhatsApp নম্বর)</Label><Input inputMode="tel" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} placeholder="01XXXXXXXXX" /></div>
            {tab === "supplier" && (
              <div><Label>ইমেইল</Label><Input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} /></div>
            )}
            {tab === "staff" && (
              <div><Label>পদবী</Label><Input value={form.position} onChange={e => setForm({ ...form, position: e.target.value })} /></div>
            )}
            <div><Label>ঠিকানা</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>বাতিল</Button>
            <Button onClick={save} className="gradient-primary text-primary-foreground hover:brightness-110 font-bold">সংরক্ষণ</Button>
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
    <div className={`group flex items-start gap-3 p-4 rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container))] transition-colors ${className}`}>
      <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-black">{label}</div>
        <div className="text-sm font-bold text-foreground mt-1 break-words">{value || "—"}</div>
      </div>
      {value && onCopy && (
        <button onClick={onCopy} className="opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8 rounded-lg hover:bg-card flex items-center justify-center" aria-label="কপি করুন">
          <Copy className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
