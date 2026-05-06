import { useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown,
  Search, Calendar as CalendarIcon, FileText, Download, BookOpen,
  Receipt, ShoppingBag, Coins, ArrowDownToLine, ArrowUpFromLine,
  ListFilter, CalendarDays,
} from "lucide-react";

type Entry = {
  id: string;
  entry_date: string;
  entry_type: "deposit" | "withdraw";
  amount: number;
  category: string | null;
  payment_method: string | null;
  reference_no: string | null;
  party_name: string | null;
  notes: string | null;
  created_at: string;
};

type TabKey = "ledger" | "income" | "expense" | "cash" | "sales" | "purchase";
type AccountKey = "account" | "customer" | "supplier" | "owner";
type RangeKey = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "lifetime";
type RowFilter = "all" | "income" | "expense" | "deposit" | "withdraw";
type ViewMode = "detailed" | "daily";

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD")}`;

function rangeDates(r: RangeKey): { from: string; to: string } {
  const t = new Date(); const to = t.toISOString().slice(0, 10);
  const d = new Date(t);
  if (r === "today")     return { from: to, to };
  if (r === "7d")        { d.setDate(d.getDate() - 6);  return { from: d.toISOString().slice(0, 10), to }; }
  if (r === "30d")       { d.setDate(d.getDate() - 29); return { from: d.toISOString().slice(0, 10), to }; }
  if (r === "thisMonth") { d.setDate(1); return { from: d.toISOString().slice(0, 10), to }; }
  if (r === "lastMonth") {
    const a = new Date(t.getFullYear(), t.getMonth() - 1, 1);
    const b = new Date(t.getFullYear(), t.getMonth(), 0);
    return { from: a.toISOString().slice(0, 10), to: b.toISOString().slice(0, 10) };
  }
  return { from: "2000-01-01", to };
}

const TABS: { key: TabKey; label: string; icon: any }[] = [
  { key: "ledger",   label: "লেজার",   icon: BookOpen },
  { key: "income",   label: "আয়",      icon: TrendingUp },
  { key: "expense",  label: "খরচ",     icon: TrendingDown },
  { key: "cash",     label: "ক্যাশ",   icon: Coins },
  { key: "sales",    label: "বিক্রয়", icon: Receipt },
  { key: "purchase", label: "ক্রয়",    icon: ShoppingBag },
];

const TAB_META: Record<TabKey, { title: string; subtitle: string; entryLabel: string; rangeChip: string }> = {
  ledger:   { title: "হিসেব লেজার",     subtitle: "সকল লেনদেনের সম্পূর্ণ লেজার",          entryLabel: "লেনদেন",   rangeChip: "সকল" },
  income:   { title: "আয়ের লেজার",      subtitle: "সকল আয়/জমা লেনদেনের তালিকা",          entryLabel: "আয়",        rangeChip: "আয়" },
  expense:  { title: "খরচের লেজার",     subtitle: "সকল খরচ/উত্তোলন লেনদেনের তালিকা",     entryLabel: "খরচ",       rangeChip: "খরচ" },
  cash:     { title: "ক্যাশ লেজার",     subtitle: "শুধুমাত্র নগদ পেমেন্টের লেনদেন",       entryLabel: "ক্যাশ",     rangeChip: "ক্যাশ" },
  sales:    { title: "বিক্রয় লেজার",    subtitle: "বিক্রয় সংক্রান্ত সকল লেনদেন",          entryLabel: "বিক্রয়",   rangeChip: "বিক্রয়" },
  purchase: { title: "ক্রয় লেজার",      subtitle: "ক্রয়/স্টক সংক্রান্ত সকল লেনদেন",       entryLabel: "ক্রয়",      rangeChip: "ক্রয়" },
};

const ACCOUNT_TABS: { key: AccountKey; label: string }[] = [
  { key: "account",  label: "অ্যাকাউন্ট" },
  { key: "customer", label: "কাস্টমার" },
  { key: "supplier", label: "সাপ্লায়ার" },
  { key: "owner",    label: "ওনার" },
];

const RANGE_CHIPS: { key: RangeKey; label: string }[] = [
  { key: "today",     label: "আজ" },
  { key: "7d",        label: "৭ দিন" },
  { key: "30d",       label: "৩০ দিন" },
  { key: "thisMonth", label: "এই মাস" },
  { key: "lastMonth", label: "গত মাস" },
  { key: "lifetime",  label: "লাইফটাইম" },
];

const ROW_FILTERS: { key: RowFilter; label: string }[] = [
  { key: "all",      label: "সব" },
  { key: "income",   label: "আয়" },
  { key: "expense",  label: "খরচ" },
  { key: "deposit",  label: "জমা" },
  { key: "withdraw", label: "উত্তোলন" },
];

export default function Ledger() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [salesAgg, setSalesAgg] = useState<{ date: string; total: number; party: string | null }[]>([]);
  const [purchasesAgg, setPurchasesAgg] = useState<{ date: string; total: number; party: string | null }[]>([]);
  const [loading, setLoading] = useState(true);

  // Top section state
  const [topRange, setTopRange] = useState<RangeKey>("today");
  const [topFrom, setTopFrom] = useState("");
  const [topTo, setTopTo] = useState("");
  const [topSearch, setTopSearch] = useState("");

  // Tabs
  const [tab, setTab] = useState<TabKey>("ledger");
  const [account, setAccount] = useState<AccountKey>("account");

  // Lower table section state
  const [lowRange, setLowRange] = useState<RangeKey>("today");
  const [lowFrom, setLowFrom] = useState("");
  const [lowTo, setLowTo] = useState("");
  const [lowSearch, setLowSearch] = useState("");
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [view, setView] = useState<ViewMode>("detailed");

  const [dialog, setDialog] = useState<null | "deposit" | "withdraw">(null);

  useEffect(() => {
    const r = rangeDates(topRange);
    if (topRange !== "lifetime") { setTopFrom(r.from); setTopTo(r.to); }
  }, [topRange]);
  useEffect(() => {
    const r = rangeDates(lowRange);
    if (lowRange !== "lifetime") { setLowFrom(r.from); setLowTo(r.to); }
  }, [lowRange]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("cash_book" as any).select("*")
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
    if (currentShop) q = q.eq("shop_id", currentShop.id);

    let sq = supabase.from("sales").select("created_at,total,customers(name)").order("created_at", { ascending: false });
    if (currentShop) sq = sq.eq("shop_id", currentShop.id);

    let pq = supabase.from("purchases").select("created_at,total,suppliers(name)").order("created_at", { ascending: false });
    if (currentShop) pq = pq.eq("shop_id", currentShop.id);

    const [{ data, error }, { data: sd }, { data: pd }] = await Promise.all([q, sq, pq]);
    if (error) toast.error(error.message);
    setEntries((data ?? []) as any);
    setSalesAgg((sd ?? []).map((s: any) => ({
      date: String(s.created_at).slice(0, 10),
      total: Number(s.total || 0),
      party: s.customers?.name ?? null,
    })));
    setPurchasesAgg((pd ?? []).map((p: any) => ({
      date: String(p.created_at).slice(0, 10),
      total: Number(p.total || 0),
      party: p.suppliers?.name ?? null,
    })));
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentShop?.id]);

  // Convert sales/purchases into synthetic ledger entries so all tabs show real DB data
  const synthEntries: Entry[] = useMemo(() => {
    const sales: Entry[] = salesAgg.map((s, i) => ({
      id: `sale-${i}-${s.date}`,
      entry_date: s.date,
      entry_type: "deposit",
      amount: s.total,
      category: "Sales / বিক্রয়",
      payment_method: "cash",
      reference_no: null,
      party_name: s.party,
      notes: null,
      created_at: s.date,
    }));
    const purchases: Entry[] = purchasesAgg.map((p, i) => ({
      id: `pur-${i}-${p.date}`,
      entry_date: p.date,
      entry_type: "withdraw",
      amount: p.total,
      category: "Purchase / ক্রয়",
      payment_method: "cash",
      reference_no: null,
      party_name: p.party,
      notes: null,
      created_at: p.date,
    }));
    return [...entries, ...sales, ...purchases];
  }, [entries, salesAgg, purchasesAgg]);

  // Apply top range to compute summary cards
  const topRangeFiltered = useMemo(() => synthEntries.filter(e => {
    if (topFrom && e.entry_date < topFrom) return false;
    if (topTo   && e.entry_date > topTo)   return false;
    if (topSearch) {
      const q = topSearch.toLowerCase();
      return (e.category ?? "").toLowerCase().includes(q)
        || (e.notes ?? "").toLowerCase().includes(q)
        || String(e.amount).includes(q);
    }
    return true;
  }), [synthEntries, topFrom, topTo, topSearch]);

  // 6 mini stat cards (top row) — REAL DB data
  const miniStats = useMemo(() => {
    const sumWhere = (fn: (e: Entry) => boolean) =>
      topRangeFiltered.filter(fn).reduce((s, e) => s + Number(e.amount || 0), 0);
    const cat = (e: Entry, k: string) => (e.category ?? "").toLowerCase().includes(k);
    const income  = sumWhere(e => e.entry_type === "deposit");
    const expense = sumWhere(e => e.entry_type === "withdraw");
    return [
      { key: "income"   as TabKey, label: "মোট আয়",       value: income,                                     icon: ArrowDownToLine, tone: "income" },
      { key: "expense"  as TabKey, label: "মোট খরচ",      value: expense,                                    icon: ArrowUpFromLine, tone: "expense" },
      { key: "ledger"   as TabKey, label: "নগদ ব্যালেন্স", value: income - expense,                          icon: Coins,           tone: "balance" },
      { key: "cash"     as TabKey, label: "ক্যাশ লেনদেন",  value: sumWhere(e => (e.payment_method ?? "cash") === "cash"), icon: Wallet, tone: "cash" },
      { key: "sales"    as TabKey, label: "মোট বিক্রয়",    value: sumWhere(e => cat(e, "sales")    || cat(e, "বিক্রয়")), icon: Receipt,    tone: "sales" },
      { key: "purchase" as TabKey, label: "মোট ক্রয়",      value: sumWhere(e => cat(e, "purchase") || cat(e, "ক্রয়")),    icon: ShoppingBag, tone: "purchase" },
    ];
  }, [topRangeFiltered]);

  // 3 big totals (under account tabs) — based on lower range + tab + account filter
  const lowerFiltered = useMemo(() => synthEntries.filter(e => {
    if (lowFrom && e.entry_date < lowFrom) return false;
    if (lowTo   && e.entry_date > lowTo)   return false;

    if (tab === "income"  && e.entry_type !== "deposit")  return false;
    if (tab === "expense" && e.entry_type !== "withdraw") return false;
    if (tab === "cash"    && (e.payment_method ?? "cash") !== "cash") return false;
    if (tab === "sales"    && !((e.category ?? "").toLowerCase().includes("sales")    || (e.category ?? "").includes("বিক্রয়"))) return false;
    if (tab === "purchase" && !((e.category ?? "").toLowerCase().includes("purchase") || (e.category ?? "").includes("ক্রয়")))    return false;

    if (tab === "ledger" && account !== "account") {
      const cat = (e.category ?? "").toLowerCase();
      const isSales    = cat.includes("sales")    || cat.includes("বিক্রয়");
      const isPurchase = cat.includes("purchase") || cat.includes("ক্রয়");
      const ownerKw    = ["owner", "মালিক", "ওনার"];
      if (account === "customer" && !isSales  && !ownerKw.every(k => false) && !cat.includes("customer") && !cat.includes("কাস্টমার") && !cat.includes("ক্রেতা")) return false;
      if (account === "supplier" && !isPurchase && !cat.includes("supplier") && !cat.includes("সাপ্লায়ার") && !cat.includes("সরবরাহ")) return false;
      if (account === "owner"    && !ownerKw.some(k => cat.includes(k.toLowerCase()))) return false;
    }

    if (rowFilter === "income"   && e.entry_type !== "deposit")  return false;
    if (rowFilter === "expense"  && e.entry_type !== "withdraw") return false;
    if (rowFilter === "deposit"  && e.entry_type !== "deposit")  return false;
    if (rowFilter === "withdraw" && e.entry_type !== "withdraw") return false;

    if (lowSearch) {
      const q = lowSearch.toLowerCase();
      return (e.party_name ?? "").toLowerCase().includes(q)
        || (e.category ?? "").toLowerCase().includes(q)
        || (e.notes ?? "").toLowerCase().includes(q)
        || (e.reference_no ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [synthEntries, lowFrom, lowTo, tab, account, rowFilter, lowSearch]);

  const totals = useMemo(() => {
    const cr = lowerFiltered.filter(e => e.entry_type === "deposit") .reduce((s, e) => s + Number(e.amount || 0), 0);
    const dr = lowerFiltered.filter(e => e.entry_type === "withdraw").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { cr, dr, balance: cr - dr };
  }, [lowerFiltered]);

  // Daily aggregation
  const dailyRows = useMemo(() => {
    const map = new Map<string, { cr: number; dr: number }>();
    lowerFiltered.forEach(e => {
      const cur = map.get(e.entry_date) ?? { cr: 0, dr: 0 };
      if (e.entry_type === "deposit") cur.cr += Number(e.amount || 0);
      else cur.dr += Number(e.amount || 0);
      map.set(e.entry_date, cur);
    });
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [lowerFiltered]);

  // Running balance for detailed
  const detailedRows = useMemo(() => {
    let bal = 0;
    const asc = [...lowerFiltered].sort((a, b) =>
      a.entry_date.localeCompare(b.entry_date) || a.created_at.localeCompare(b.created_at)
    );
    const out = asc.map(e => {
      const cr = e.entry_type === "deposit"  ? Number(e.amount || 0) : 0;
      const dr = e.entry_type === "withdraw" ? Number(e.amount || 0) : 0;
      bal = bal + cr - dr;
      return { e, cr, dr, balance: bal };
    });
    return out.reverse();
  }, [lowerFiltered]);

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black text-foreground">{TAB_META[tab].title}</h1>
          <p className="text-xs text-muted-foreground">{TAB_META[tab].subtitle}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDialog("deposit")}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
            <ArrowDownCircle className="h-4 w-4" /> জমা
          </Button>
          <Button onClick={() => setDialog("withdraw")}
            className="bg-rose-600 hover:bg-rose-700 text-white shadow-md">
            <ArrowUpCircle className="h-4 w-4" /> উত্তোলন
          </Button>
        </div>
      </div>

      {/* Top filter card: search + range chips + date range */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="ক্যাটাগরি, নোট বা পরিমাণ দিয়ে খুঁজুন..." value={topSearch} onChange={e => setTopSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            {RANGE_CHIPS.map(c => (
              <button key={c.key} onClick={() => setTopRange(c.key)}
                className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                  topRange === c.key
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : "bg-background text-foreground/80 border-border hover:border-primary/50 hover:text-primary"
                }`}>{c.label}</button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Input type="date" value={topFrom} onChange={e => { setTopFrom(e.target.value); }} className="w-[150px]" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={topTo} onChange={e => { setTopTo(e.target.value); }} className="w-[150px]" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6 mini stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {miniStats.map((s, i) => (
          <MiniStat key={i} {...s} active={tab === s.key} onClick={() => setTab(s.key)} />
        ))}
      </div>

      {/* Tabs row: লেজার / আয় / খরচ / ক্যাশ / বিক্রয় / ক্রয় (page switch) */}
      <div className="flex flex-wrap gap-1.5 p-1.5 rounded-2xl bg-muted/40 w-fit mx-auto border border-border/60">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-bold transition-all duration-200 ${
                active
                  ? "bg-background shadow-md text-primary scale-105"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}>
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* Account sub-tabs (only for লেজার) */}
      {tab === "ledger" && (
        <div className="flex flex-wrap gap-2 justify-center">
          {ACCOUNT_TABS.map(a => {
            const active = account === a.key;
            return (
              <button key={a.key} onClick={() => setAccount(a.key)}
                className={`px-5 py-2 rounded-full text-sm font-bold border-2 transition-all duration-200 ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md scale-105"
                    : "bg-background text-foreground/80 border-border hover:border-primary/60 hover:text-primary hover:-translate-y-0.5"
                }`}>{a.label}</button>
            );
          })}
        </div>
      )}

      {/* 3 totals cards: মোট জমা (Cr) / মোট খরচ (Dr) / নীট ব্যালেন্স */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <BigStat label="মোট জমা (Cr)" value={fmt(totals.cr)}      icon={<ArrowDownToLine className="h-5 w-5" />} accent="emerald" />
        <BigStat label="মোট খরচ (Dr)" value={fmt(totals.dr)}      icon={<ArrowUpFromLine className="h-5 w-5" />} accent="rose" />
        <BigStat label="নীট ব্যালেন্স"  value={fmt(totals.balance)} icon={<BookOpen className="h-5 w-5" />}        accent="indigo" />
      </div>

      {/* Lower filter row: range chips + dates + search + row filters + export */}
      <Card className="border-border/60">
        <CardContent className="p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            {RANGE_CHIPS.map(c => (
              <button key={c.key} onClick={() => setLowRange(c.key)}
                className={`px-4 py-2 rounded-full text-sm font-bold border-2 transition-all ${
                  lowRange === c.key
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : "bg-background text-foreground/80 border-border hover:border-primary/50 hover:text-primary"
                }`}>{c.label}</button>
            ))}
            <div className="flex items-center gap-2 ml-auto">
              <Input type="date" value={lowFrom} onChange={e => setLowFrom(e.target.value)} className="w-[150px]" />
              <span className="text-muted-foreground">—</span>
              <Input type="date" value={lowTo} onChange={e => setLowTo(e.target.value)} className="w-[150px]" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="খুঁজুন..." value={lowSearch} onChange={e => setLowSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(lowerFiltered)}>
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ListFilter className="h-5 w-5 text-muted-foreground" />
            {ROW_FILTERS.map(f => (
              <button key={f.key} onClick={() => setRowFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-sm font-bold border-2 transition-all ${
                  rowFilter === f.key
                    ? "bg-primary text-primary-foreground border-primary shadow"
                    : "bg-background text-foreground/80 border-border hover:border-primary/50 hover:text-primary"
                }`}>{f.label}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Ledger table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-border/60">
            <h3 className="font-bold text-foreground inline-flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> {TAB_META[tab].title}
            </h3>
            <div className="flex items-center gap-2">
              <div className="inline-flex bg-muted/40 rounded-full p-1">
                <button onClick={() => setView("detailed")}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${view === "detailed" ? "bg-background shadow" : "text-muted-foreground"}`}>
                  বিস্তারিত
                </button>
                <button onClick={() => setView("daily")}
                  className={`px-3 py-1 text-xs font-bold rounded-full ${view === "daily" ? "bg-background shadow" : "text-muted-foreground"}`}>
                  দৈনিক
                </button>
              </div>
              <span className="text-xs text-muted-foreground">{lowerFiltered.length} টি এন্ট্রি</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            {view === "detailed" ? (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left p-3">তারিখ</th>
                    <th className="text-left p-3">ধরন</th>
                    <th className="text-left p-3">বিবরণ</th>
                    <th className="text-right p-3">ডেবিট (-)</th>
                    <th className="text-right p-3">ক্রেডিট (+)</th>
                    <th className="text-right p-3">ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
                  ) : detailedRows.length === 0 ? (
                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>
                  ) : detailedRows.map(({ e, cr, dr, balance }) => (
                    <tr key={e.id} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{e.entry_date}</td>
                      <td className="p-3">
                        {e.entry_type === "deposit"
                          ? <span className="text-emerald-600 font-bold">জমা</span>
                          : <span className="text-rose-600 font-bold">উত্তোলন</span>}
                      </td>
                      <td className="p-3">
                        <div className="font-medium">{e.category ?? "-"}</div>
                        {(e.party_name || e.notes) && (
                          <div className="text-xs text-muted-foreground">{[e.party_name, e.notes].filter(Boolean).join(" • ")}</div>
                        )}
                      </td>
                      <td className="p-3 text-right font-bold text-rose-600">{dr > 0 ? fmt(dr) : "-"}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{cr > 0 ? fmt(cr) : "-"}</td>
                      <td className="p-3 text-right font-bold">{fmt(balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-muted-foreground text-xs">
                  <tr>
                    <th className="text-left p-3">তারিখ</th>
                    <th className="text-right p-3">মোট জমা</th>
                    <th className="text-right p-3">মোট উত্তোলন</th>
                    <th className="text-right p-3">নীট</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
                  ) : dailyRows.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>
                  ) : dailyRows.map(([date, v]) => (
                    <tr key={date} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{date}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{fmt(v.cr)}</td>
                      <td className="p-3 text-right font-bold text-rose-600">{fmt(v.dr)}</td>
                      <td className="p-3 text-right font-bold">{fmt(v.cr - v.dr)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </CardContent>
      </Card>

      <EntryDialog
        open={dialog !== null}
        type={dialog ?? "deposit"}
        onOpenChange={(o) => !o && setDialog(null)}
        onSaved={() => { setDialog(null); load(); }}
        userId={user?.id ?? null}
        shopId={currentShop?.id ?? null}
      />
    </div>
  );
}

function MiniStat({ label, value, icon: Icon, tone, active, onClick }: any) {
  const tones: Record<string, { ring: string; icon: string; bar: string }> = {
    income:   { ring: "ring-emerald-500/40", icon: "text-emerald-600 bg-emerald-500/10", bar: "bg-emerald-500" },
    expense:  { ring: "ring-rose-500/40",    icon: "text-rose-600 bg-rose-500/10",       bar: "bg-rose-500" },
    balance:  { ring: "ring-primary/40",     icon: "text-primary bg-primary/10",         bar: "bg-primary" },
    cash:     { ring: "ring-sky-500/40",     icon: "text-sky-600 bg-sky-500/10",         bar: "bg-sky-500" },
    sales:    { ring: "ring-amber-500/40",   icon: "text-amber-600 bg-amber-500/10",     bar: "bg-amber-500" },
    purchase: { ring: "ring-violet-500/40",  icon: "text-violet-600 bg-violet-500/10",   bar: "bg-violet-500" },
  };
  const t = tones[tone] ?? tones.balance;
  return (
    <button onClick={onClick}
      className={`group relative text-left rounded-xl p-3 bg-card border border-border/60 transition-all hover:shadow-md hover:-translate-y-0.5 ${
        active ? `ring-2 ${t.ring} shadow-md` : ""
      }`}>
      <span className={`absolute left-0 top-3 bottom-3 w-1 rounded-r ${t.bar} ${active ? "opacity-100" : "opacity-60"}`} />
      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="text-[11px] font-bold text-muted-foreground truncate">{label}</div>
        <div className={`h-7 w-7 rounded-lg grid place-items-center ${t.icon}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-1 pl-2 text-lg font-black text-foreground truncate">{`৳${Number(value || 0).toLocaleString("bn-BD")}`}</div>
    </button>
  );
}

function BigStat({ label, value, icon, accent }: any) {
  const accents: Record<string, string> = {
    emerald: "text-emerald-600", rose: "text-rose-600", indigo: "text-indigo-600",
  };
  return (
    <Card className="border-border/60">
      <CardContent className="p-5 flex items-center gap-3">
        <div className={`h-10 w-10 rounded-xl bg-muted grid place-items-center ${accents[accent]}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-black text-foreground truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function EntryDialog({ open, type, onOpenChange, onSaved, userId, shopId }: any) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [accountKind, setAccountKind] = useState<"customer" | "supplier" | "owner" | "general">("general");
  const [category, setCategory] = useState("");
  const [party, setParty] = useState("");
  const [method, setMethod] = useState("cash");
  const [ref, setRef] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(today()); setAmount(""); setAccountKind("general"); setCategory("");
      setParty(""); setMethod("cash"); setRef(""); setNotes("");
    }
  }, [open]);

  const save = async () => {
    if (!userId) { toast.error("লগইন প্রয়োজন"); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    setSaving(true);
    const finalCategory = accountKind !== "general"
      ? `${accountKind}${category ? " - " + category : ""}`
      : (category || null);
    const { error } = await supabase.from("cash_book" as any).insert({
      shop_id: shopId, entry_date: date, entry_type: type, amount: amt,
      category: finalCategory, party_name: party || null, payment_method: method,
      reference_no: ref || null, notes: notes || null, created_by: userId,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(type === "deposit" ? "জমা সংরক্ষিত" : "উত্তোলন সংরক্ষিত");
    onSaved();
  };

  const isDeposit = type === "deposit";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDeposit
              ? <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
              : <ArrowUpCircle className="h-5 w-5 text-rose-600" />}
            {isDeposit ? "নতুন জমা" : "নতুন উত্তোলন"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div><Label>তারিখ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} /></div>
          <div><Label>পরিমাণ (৳)</Label><Input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div>
            <Label>অ্যাকাউন্ট</Label>
            <Select value={accountKind} onValueChange={(v: any) => setAccountKind(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">সাধারণ</SelectItem>
                <SelectItem value="customer">কাস্টমার</SelectItem>
                <SelectItem value="supplier">সাপ্লায়ার</SelectItem>
                <SelectItem value="owner">ওনার</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>পেমেন্ট মাধ্যম</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">নগদ</SelectItem>
                <SelectItem value="bkash">বিকাশ</SelectItem>
                <SelectItem value="nagad">নগদ (Nagad)</SelectItem>
                <SelectItem value="rocket">রকেট</SelectItem>
                <SelectItem value="bank">ব্যাংক</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-2"><Label>ক্যাটাগরি</Label><Input placeholder={isDeposit ? "যেমন: বিক্রয়, ভাড়া আদায়" : "যেমন: ভাড়া, বিদ্যুৎ বিল"} value={category} onChange={e => setCategory(e.target.value)} /></div>
          <div className="col-span-2"><Label>পার্টি / ব্যক্তির নাম</Label><Input value={party} onChange={e => setParty(e.target.value)} /></div>
          <div className="col-span-2"><Label>রেফারেন্স নং</Label><Input value={ref} onChange={e => setRef(e.target.value)} /></div>
          <div className="col-span-2"><Label>নোট</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={save} disabled={saving}
            className={isDeposit ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}>
            {saving ? "সংরক্ষণ..." : "সংরক্ষণ করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function exportCsv(rows: Entry[]) {
  const head = ["তারিখ", "ধরন", "ক্যাটাগরি", "পার্টি", "পেমেন্ট", "রেফ", "জমা", "উত্তোলন", "নোট"];
  const lines = [head.join(",")];
  rows.forEach(e => {
    lines.push([
      e.entry_date, e.entry_type === "deposit" ? "জমা" : "উত্তোলন",
      e.category ?? "", e.party_name ?? "",
      e.payment_method ?? "", e.reference_no ?? "",
      e.entry_type === "deposit" ? e.amount : "",
      e.entry_type === "withdraw" ? e.amount : "",
      (e.notes ?? "").replace(/,/g, " "),
    ].join(","));
  });
  const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `ledger-${today()}.csv`; a.click();
  URL.revokeObjectURL(url);
}
