import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity, ShoppingCart, Receipt, ClipboardList, LogIn, Users, Package,
  CalendarCheck, Wallet, Warehouse, RotateCcw, ShoppingBag, Truck, Pencil,
  Trash2, Plus, RefreshCw, Filter, Clock, User as UserIcon, Search, Download,
  Store, BookOpen, ShieldCheck,
} from "lucide-react";

type Log = {
  id: string;
  user_id: string;
  staff_id: string | null;
  shop_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  meta: any;
  created_at: string;
};

const ACTION_META: Record<string, { label: string; icon: any; tone: string; cat: string }> = {
  // sales
  "sale.create":          { label: "নতুন বিক্রয়",          icon: ShoppingCart, tone: "text-emerald-600 bg-emerald-500/10",   cat: "sale" },
  "sale.update":          { label: "বিক্রয় সম্পাদনা",       icon: Pencil,       tone: "text-emerald-700 bg-emerald-500/10",   cat: "sale" },
  "sale.delete":          { label: "বিক্রয় মুছে ফেলা",      icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "sale" },
  "sale.return":          { label: "বিক্রয় ফেরত",          icon: RotateCcw,    tone: "text-rose-600 bg-rose-500/10",         cat: "sale" },
  // installments
  "installment.pay":      { label: "কিস্তি পরিশোধ",         icon: Wallet,       tone: "text-amber-600 bg-amber-500/10",       cat: "installment" },
  "installment.edit":     { label: "কিস্তি পেমেন্ট edit",   icon: Pencil,       tone: "text-amber-700 bg-amber-500/10",       cat: "installment" },
  "installment.delete":   { label: "কিস্তি পেমেন্ট মুছা",   icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "installment" },
  "installment.create":   { label: "নতুন কিস্তি বিক্রয়",    icon: Plus,         tone: "text-amber-600 bg-amber-500/10",       cat: "installment" },
  // products
  "product.create":       { label: "নতুন পণ্য",            icon: Package,      tone: "text-fuchsia-600 bg-fuchsia-500/10",   cat: "product" },
  "product.update":       { label: "পণ্য সম্পাদনা",         icon: Pencil,       tone: "text-fuchsia-700 bg-fuchsia-500/10",   cat: "product" },
  "product.delete":       { label: "পণ্য মুছে ফেলা",        icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "product" },
  "category.create":      { label: "নতুন ক্যাটাগরি",        icon: Plus,         tone: "text-teal-600 bg-teal-500/10",         cat: "product" },
  "category.update":      { label: "ক্যাটাগরি সম্পাদনা",    icon: Pencil,       tone: "text-teal-700 bg-teal-500/10",         cat: "product" },
  "category.delete":      { label: "ক্যাটাগরি মুছা",        icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "product" },
  // customers
  "customer.create":      { label: "নতুন কাস্টমার",         icon: Users,        tone: "text-sky-600 bg-sky-500/10",           cat: "customer" },
  "customer.update":      { label: "কাস্টমার সম্পাদনা",      icon: Pencil,       tone: "text-sky-700 bg-sky-500/10",           cat: "customer" },
  "customer.delete":      { label: "কাস্টমার মুছা",          icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "customer" },
  // suppliers
  "supplier.create":      { label: "নতুন সরবরাহকারী",       icon: Truck,        tone: "text-orange-600 bg-orange-500/10",     cat: "supplier" },
  "supplier.update":      { label: "সরবরাহকারী সম্পাদনা",    icon: Pencil,       tone: "text-orange-700 bg-orange-500/10",     cat: "supplier" },
  "supplier.delete":      { label: "সরবরাহকারী মুছা",        icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "supplier" },
  // purchases
  "purchase.create":      { label: "নতুন ক্রয়",             icon: ShoppingBag,  tone: "text-fuchsia-600 bg-fuchsia-500/10",   cat: "purchase" },
  "purchase.update":      { label: "ক্রয় সম্পাদনা",          icon: Pencil,       tone: "text-fuchsia-700 bg-fuchsia-500/10",   cat: "purchase" },
  "purchase.delete":      { label: "ক্রয় মুছা",              icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "purchase" },
  "purchase.pay":         { label: "ক্রয় পেমেন্ট",           icon: Wallet,       tone: "text-fuchsia-600 bg-fuchsia-500/10",   cat: "purchase" },
  // expenses
  "expense.create":       { label: "নতুন খরচ",             icon: ClipboardList, tone: "text-amber-600 bg-amber-500/10",      cat: "expense" },
  "expense.update":       { label: "খরচ সম্পাদনা",          icon: Pencil,       tone: "text-amber-700 bg-amber-500/10",       cat: "expense" },
  "expense.delete":       { label: "খরচ মুছা",              icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "expense" },
  // stock
  "stock.adjustment":     { label: "স্টক সমন্বয়",            icon: Warehouse,    tone: "text-blue-600 bg-blue-500/10",         cat: "stock" },
  // attendance / staff
  "attendance.create":    { label: "হাজিরা",                icon: CalendarCheck, tone: "text-indigo-600 bg-indigo-500/10",    cat: "staff" },
  "staff.create":         { label: "নতুন স্টাফ",             icon: Plus,         tone: "text-pink-600 bg-pink-500/10",         cat: "staff" },
  "staff.update":         { label: "স্টাফ সম্পাদনা",          icon: Pencil,       tone: "text-pink-700 bg-pink-500/10",         cat: "staff" },
  "staff.delete":         { label: "স্টাফ মুছা",              icon: Trash2,       tone: "text-rose-600 bg-rose-500/10",         cat: "staff" },
  // ledger / cashbook
  "cashbook.create":      { label: "ক্যাশবুক এন্ট্রি",        icon: BookOpen,     tone: "text-indigo-600 bg-indigo-500/10",     cat: "ledger" },
  // shops
  "shop.create":          { label: "নতুন দোকান",            icon: Store,        tone: "text-fuchsia-600 bg-fuchsia-500/10",   cat: "shop" },
  "shop.update":          { label: "দোকান সম্পাদনা",         icon: Pencil,       tone: "text-fuchsia-700 bg-fuchsia-500/10",   cat: "shop" },
  // auth
  "auth.login":           { label: "Login",                icon: LogIn,        tone: "text-slate-600 bg-slate-500/10",        cat: "auth" },
  "auth.logout":          { label: "Logout",               icon: LogIn,        tone: "text-slate-600 bg-slate-500/10",        cat: "auth" },
  // warranty
  "warranty.create":      { label: "নতুন ওয়ারেন্টি",         icon: ShieldCheck,  tone: "text-lime-600 bg-lime-500/10",         cat: "warranty" },
};

function metaFor(action: string) {
  return ACTION_META[action] ?? { label: action, icon: Activity, tone: "text-muted-foreground bg-muted", cat: "other" };
}

const CATEGORIES = [
  { value: "all",          label: "সব" },
  { value: "sale",         label: "বিক্রয়" },
  { value: "installment",  label: "কিস্তি" },
  { value: "product",      label: "পণ্য" },
  { value: "customer",     label: "কাস্টমার" },
  { value: "supplier",     label: "সরবরাহকারী" },
  { value: "purchase",     label: "ক্রয়" },
  { value: "expense",      label: "খরচ" },
  { value: "stock",        label: "স্টক" },
  { value: "staff",        label: "স্টাফ" },
  { value: "ledger",       label: "হিসাব" },
  { value: "shop",         label: "দোকান" },
  { value: "auth",         label: "Login/Logout" },
  { value: "other",        label: "অন্যান্য" },
];

function isoLocal(d: Date) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

function fmtTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
}

function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "এইমাত্র";
  if (m < 60) return `${m} মিনিট আগে`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ঘন্টা আগে`;
  const d = Math.floor(h / 24);
  return `${d} দিন আগে`;
}

export default function ActivityLogs() {
  const { fmt } = useT();
  const [logs, setLogs] = useState<Log[]>([]);
  const [profiles, setProfiles] = useState<Record<string, { name: string }>>({});
  const [shops, setShops] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState("all");
  const [userId, setUserId] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [from, setFrom] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 30); return isoLocal(d); });
  const [to, setTo] = useState(() => isoLocal(new Date()));

  const load = async () => {
    setLoading(true);
    const fromIso = new Date(`${from}T00:00:00`).toISOString();
    const toIso = new Date(`${to}T23:59:59`).toISOString();
    const { data } = await supabase
      .from("staff_activity_logs" as any)
      .select("*")
      .gte("created_at", fromIso)
      .lte("created_at", toIso)
      .order("created_at", { ascending: false })
      .limit(1000);
    const rows = (data ?? []) as unknown as Log[];
    setLogs(rows);

    // Resolve user names
    const userIds = Array.from(new Set(rows.map(r => r.user_id).filter(Boolean)));
    if (userIds.length) {
      const { data: profs } = await supabase.from("profiles").select("user_id, full_name").in("user_id", userIds);
      const map: Record<string, { name: string }> = {};
      (profs ?? []).forEach((p: any) => { map[p.user_id] = { name: p.full_name || "Unknown" }; });
      setProfiles(map);
    }
    const shopIds = Array.from(new Set(rows.map(r => r.shop_id).filter(Boolean))) as string[];
    if (shopIds.length) {
      const { data: sh } = await supabase.from("shops").select("id, name").in("id", shopIds);
      const sm: Record<string, string> = {};
      (sh ?? []).forEach((s: any) => { sm[s.id] = s.name; });
      setShops(sm);
    }
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to]);

  const filtered = useMemo(() => {
    let arr = logs;
    if (cat !== "all") arr = arr.filter(l => metaFor(l.action).cat === cat);
    if (userId !== "all") arr = arr.filter(l => l.user_id === userId);
    if (search.trim()) {
      const q = search.toLowerCase();
      arr = arr.filter(l => {
        const name = profiles[l.user_id]?.name?.toLowerCase() ?? "";
        return JSON.stringify(l).toLowerCase().includes(q) || name.includes(q);
      });
    }
    return arr;
  }, [logs, cat, userId, search, profiles]);

  const grouped = useMemo(() => {
    const g: Record<string, Log[]> = {};
    filtered.forEach(l => {
      const day = new Date(l.created_at).toLocaleDateString("bn-BD", { dateStyle: "full" });
      (g[day] ||= []).push(l);
    });
    return Object.entries(g);
  }, [filtered]);

  const stats = useMemo(() => {
    const total = filtered.length;
    const byCat: Record<string, number> = {};
    filtered.forEach(l => { const c = metaFor(l.action).cat; byCat[c] = (byCat[c] || 0) + 1; });
    const uniqueUsers = new Set(filtered.map(l => l.user_id)).size;
    return { total, byCat, uniqueUsers };
  }, [filtered]);

  const uniqueUsers = useMemo(() => {
    const ids = Array.from(new Set(logs.map(l => l.user_id).filter(Boolean)));
    return ids.map(id => ({ id, name: profiles[id]?.name ?? id.slice(0, 8) }));
  }, [logs, profiles]);

  const exportCsv = () => {
    const head = ["Time","User","Action","Entity","Shop","Meta"];
    const rows = filtered.map(l => [
      fmtTime(l.created_at),
      profiles[l.user_id]?.name ?? l.user_id,
      metaFor(l.action).label,
      l.entity_type ?? "",
      l.shop_id ? (shops[l.shop_id] ?? "") : "",
      JSON.stringify(l.meta ?? {}),
    ]);
    const csv = [head, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `activity-logs-${from}_${to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <PageHeader
        title="বিস্তারিত Activity Log"
        subtitle="অ্যাডমিন ও স্টাফদের সমস্ত কার্যকলাপ এক জায়গায়"
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-1.5 ${loading ? "animate-spin" : ""}`} />Refresh
            </Button>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4 mr-1.5" />CSV
            </Button>
          </div>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
        <StatBox label="মোট Activity" value={String(stats.total)} icon={Activity} tone="text-primary bg-primary/10" />
        <StatBox label="বিক্রয়" value={String(stats.byCat.sale || 0)} icon={ShoppingCart} tone="text-emerald-600 bg-emerald-500/10" />
        <StatBox label="কিস্তি" value={String(stats.byCat.installment || 0)} icon={Wallet} tone="text-amber-600 bg-amber-500/10" />
        <StatBox label="ইউনিক User" value={String(stats.uniqueUsers)} icon={UserIcon} tone="text-sky-600 bg-sky-500/10" />
      </div>

      {/* Filters */}
      <SurfaceCard className="p-4 mb-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">শুরু</label>
            <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">শেষ</label>
            <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="mt-1" />
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">ব্যবহারকারী</label>
            <Select value={userId} onValueChange={setUserId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="সব" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব ব্যবহারকারী</SelectItem>
                {uniqueUsers.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">খুঁজুন</label>
            <div className="relative mt-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="action, invoice, নাম..." className="pl-8" />
            </div>
          </div>
        </div>

        <Tabs value={cat} onValueChange={setCat}>
          <TabsList className="flex-wrap h-auto">
            {CATEGORIES.map(c => (
              <TabsTrigger key={c.value} value={c.value} className="text-xs">
                {c.label}
                {c.value !== "all" && stats.byCat[c.value] ? (
                  <span className="ml-1.5 text-[10px] opacity-70">({stats.byCat[c.value]})</span>
                ) : null}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </SurfaceCard>

      {/* Logs */}
      {loading ? (
        <SurfaceCard className="p-10 text-center text-muted-foreground">লোড হচ্ছে...</SurfaceCard>
      ) : grouped.length === 0 ? (
        <SurfaceCard className="p-10 text-center text-muted-foreground">
          <Activity className="h-10 w-10 mx-auto mb-2 opacity-30" />
          কোনো activity পাওয়া যায়নি
        </SurfaceCard>
      ) : (
        <div className="space-y-4">
          {grouped.map(([day, items]) => (
            <div key={day}>
              <div className="flex items-center gap-2 mb-2 px-1">
                <CalendarCheck className="h-3.5 w-3.5 text-muted-foreground" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{day}</h4>
                <span className="text-[10px] text-muted-foreground">• {items.length} activity</span>
              </div>
              <SurfaceCard className="p-2 sm:p-3">
                <ul className="divide-y divide-[hsl(var(--border))]">
                  {items.map(l => {
                    const m = metaFor(l.action);
                    const Icon = m.icon;
                    const userName = profiles[l.user_id]?.name ?? l.user_id.slice(0, 8);
                    const shopName = l.shop_id ? shops[l.shop_id] : null;
                    return (
                      <li key={l.id} className="flex items-start gap-3 px-2 py-3 hover:bg-muted/30 rounded-lg transition-colors">
                        <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${m.tone}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <p className="text-sm font-bold">{m.label}</p>
                            <span className="text-[11px] text-muted-foreground">•</span>
                            <span className="text-[12px] font-semibold text-primary">{userName}</span>
                            {shopName && (
                              <>
                                <span className="text-[11px] text-muted-foreground">•</span>
                                <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1">
                                  <Store className="h-3 w-3" />{shopName}
                                </span>
                              </>
                            )}
                          </div>
                          {l.meta && Object.keys(l.meta).length > 0 && (
                            <p className="text-[11px] text-muted-foreground mt-0.5 break-words">
                              {l.meta.invoice_no && <span>Invoice: <b className="text-foreground/80">{l.meta.invoice_no}</b> • </span>}
                              {typeof l.meta.amount !== "undefined" && <span>পরিমাণ: <b className="text-foreground/80">{fmt(Number(l.meta.amount))}</b> • </span>}
                              {l.meta.name && <span>{l.meta.name} • </span>}
                              {l.meta.title && <span>{l.meta.title} • </span>}
                              {l.meta.product_name && <span>পণ্য: <b className="text-foreground/80">{l.meta.product_name}</b> • </span>}
                              {l.meta.customer_name && <span>কাস্টমার: <b className="text-foreground/80">{l.meta.customer_name}</b> • </span>}
                              {typeof l.meta.qty !== "undefined" && <span>Qty: {l.meta.qty} • </span>}
                              {l.meta.type && <span>Type: {l.meta.type} • </span>}
                              {l.meta.note && <span>{l.meta.note}</span>}
                            </p>
                          )}
                          {l.entity_type && (
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                              {l.entity_type}{l.entity_id ? ` • ${l.entity_id.slice(0, 8)}` : ""}
                            </p>
                          )}
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] text-muted-foreground whitespace-nowrap inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />{relTime(l.created_at)}
                          </p>
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{fmtTime(l.created_at)}</p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </SurfaceCard>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, icon: Icon, tone }: { label: string; value: string; icon: any; tone: string }) {
  return (
    <SurfaceCard className="p-3 flex items-center gap-3">
      <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tone}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-xl font-black">{value}</p>
      </div>
    </SurfaceCard>
  );
}
