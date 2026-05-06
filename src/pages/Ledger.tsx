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
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";
import {
  ArrowDownCircle, ArrowUpCircle, Wallet, TrendingUp, TrendingDown,
  Search, Calendar as CalendarIcon, Printer, Download, BookOpen,
  Plus, Receipt, ShoppingCart, ShoppingBag, Coins,
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
type AccountKey = "all" | "customer" | "supplier" | "owner";

const today = () => new Date().toISOString().slice(0, 10);
const firstOfMonth = () => { const d = new Date(); d.setDate(1); return d.toISOString().slice(0, 10); };
const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD")}`;

const TABS: { key: TabKey; label: string; icon: any; tone: string }[] = [
  { key: "ledger",   label: "লেজার",   icon: BookOpen,     tone: "indigo"  },
  { key: "income",   label: "আয়",      icon: TrendingUp,   tone: "emerald" },
  { key: "expense",  label: "খরচ",     icon: TrendingDown, tone: "rose"    },
  { key: "cash",     label: "ক্যাশ",   icon: Coins,        tone: "amber"   },
  { key: "sales",    label: "বিক্রয়", icon: Receipt,      tone: "violet"  },
  { key: "purchase", label: "ক্রয়",    icon: ShoppingBag,  tone: "fuchsia" },
];

export default function Ledger() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState(firstOfMonth());
  const [to, setTo] = useState(today());
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<TabKey>("ledger");
  const [account, setAccount] = useState<AccountKey>("all");
  const [dialog, setDialog] = useState<null | "deposit" | "withdraw">(null);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("cash_book" as any).select("*")
      .gte("entry_date", from).lte("entry_date", to)
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
    if (currentShop) q = q.eq("shop_id", currentShop.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setEntries((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [from, to, currentShop?.id]);

  // Filter by tab + account + search
  const filtered = useMemo(() => {
    return entries.filter(e => {
      // Tab filter
      if (tab === "income"  && e.entry_type !== "deposit")  return false;
      if (tab === "expense" && e.entry_type !== "withdraw") return false;
      if (tab === "cash"    && (e.payment_method ?? "cash") !== "cash") return false;
      if (tab === "sales"    && (e.category ?? "").toLowerCase() !== "sales"    && (e.category ?? "") !== "বিক্রয়") return false;
      if (tab === "purchase" && (e.category ?? "").toLowerCase() !== "purchase" && (e.category ?? "") !== "ক্রয়")    return false;

      // Account filter (party_kind stored as a hint in notes prefix or category) — simple heuristic on category prefix
      if (account !== "all") {
        const cat = (e.category ?? "").toLowerCase();
        const map = { customer: ["customer", "কাস্টমার", "ক্রেতা"], supplier: ["supplier", "সাপ্লায়ার", "সরবরাহ"], owner: ["owner", "মালিক"] } as const;
        if (!map[account].some(k => cat.includes(k.toLowerCase()))) return false;
      }

      if (search) {
        const q = search.toLowerCase();
        return (e.party_name ?? "").toLowerCase().includes(q)
          || (e.category ?? "").toLowerCase().includes(q)
          || (e.notes ?? "").toLowerCase().includes(q)
          || (e.reference_no ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [entries, tab, account, search]);

  const totals = useMemo(() => {
    const deposit  = entries.filter(e => e.entry_type === "deposit") .reduce((s, e) => s + Number(e.amount || 0), 0);
    const withdraw = entries.filter(e => e.entry_type === "withdraw").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { deposit, withdraw, balance: deposit - withdraw };
  }, [entries]);

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-primary/70 grid place-items-center text-primary-foreground shadow-lg shadow-primary/30">
            <BookOpen className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">হিসাব ব্যবস্থাপনা</h1>
            <p className="text-xs text-muted-foreground">জমা খরচ এন্ট্রি ও সম্পূর্ণ লেজার</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setDialog("deposit")}
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 hover:brightness-110 text-white shadow-lg shadow-emerald-500/30">
            <Plus className="h-4 w-4" /> আয় যোগ
          </Button>
          <Button onClick={() => setDialog("withdraw")}
            className="bg-gradient-to-r from-rose-500 to-rose-600 hover:brightness-110 text-white shadow-lg shadow-rose-500/30">
            <Plus className="h-4 w-4" /> খরচ যোগ
          </Button>
        </div>
      </div>

      {/* Summary cards — মোট আয় / মোট খরচ / নগদ ব্যালেন্স */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <SummaryCard
          icon={<TrendingUp className="h-5 w-5" />}
          label="মোট আয়" value={fmt(totals.deposit)}
          gradient="from-emerald-400 to-emerald-600"
        />
        <SummaryCard
          icon={<TrendingDown className="h-5 w-5" />}
          label="মোট খরচ" value={fmt(totals.withdraw)}
          gradient="from-rose-400 to-rose-600"
        />
        <SummaryCard
          icon={<Wallet className="h-5 w-5" />}
          label="নগদ ব্যালেন্স" value={fmt(totals.balance)}
          gradient="from-indigo-400 to-indigo-600"
        />
      </div>

      {/* Tab pills — লেজার / আয় / খরচ / ক্যাশ / বিক্রয় / ক্রয় */}
      <Card className="border-border/60">
        <CardContent className="p-3">
          <div className="flex flex-wrap gap-2">
            {TABS.map(t => {
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`group inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                    active
                      ? `bg-gradient-to-r from-${t.tone}-500 to-${t.tone}-600 text-white shadow-lg shadow-${t.tone}-500/30`
                      : "bg-muted/60 text-foreground/70 hover:bg-muted"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Filters: account + dates + search */}
      <Card className="border-border/60">
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground mb-1 block">অ্যাকাউন্ট</Label>
            <Select value={account} onValueChange={(v: any) => setAccount(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">সব অ্যাকাউন্ট</SelectItem>
                <SelectItem value="customer">কাস্টমার</SelectItem>
                <SelectItem value="supplier">সাপ্লায়ার</SelectItem>
                <SelectItem value="owner">মালিক</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground mb-1 block">শুরুর তারিখ</Label>
            <div className="relative">
              <CalendarIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground mb-1 block">শেষ তারিখ</Label>
            <div className="relative">
              <CalendarIcon className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="pl-9" />
            </div>
          </div>
          <div className="md:col-span-3">
            <Label className="text-xs text-muted-foreground mb-1 block">খুঁজুন</Label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="পার্টি / নোট / রেফারেন্স" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="flex items-center justify-between p-4 border-b border-border/60">
            <h3 className="font-bold text-foreground">লেনদেনসমূহ <span className="text-muted-foreground font-normal text-sm">({filtered.length})</span></h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /> প্রিন্ট</Button>
              <Button size="sm" variant="outline" onClick={() => exportCsv(filtered)}><Download className="h-4 w-4" /> CSV</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase">
                <tr>
                  <th className="text-left p-3">তারিখ</th>
                  <th className="text-left p-3">ধরন</th>
                  <th className="text-left p-3">ক্যাটাগরি</th>
                  <th className="text-left p-3">পার্টি</th>
                  <th className="text-left p-3">পেমেন্ট</th>
                  <th className="text-left p-3">রেফ.</th>
                  <th className="text-right p-3">আয় (+)</th>
                  <th className="text-right p-3">খরচ (-)</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>
                ) : filtered.map(e => (
                  <tr key={e.id} className="border-t border-border/40 hover:bg-muted/30">
                    <td className="p-3 whitespace-nowrap">{e.entry_date}</td>
                    <td className="p-3">
                      {e.entry_type === "deposit"
                        ? <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30">আয়</Badge>
                        : <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/30">খরচ</Badge>}
                    </td>
                    <td className="p-3">{e.category ?? "-"}</td>
                    <td className="p-3">{e.party_name ?? "-"}</td>
                    <td className="p-3 capitalize">{e.payment_method ?? "-"}</td>
                    <td className="p-3 text-muted-foreground">{e.reference_no ?? "-"}</td>
                    <td className="p-3 text-right font-bold text-emerald-600">{e.entry_type === "deposit"  ? fmt(Number(e.amount)) : "-"}</td>
                    <td className="p-3 text-right font-bold text-rose-600">{e.entry_type === "withdraw" ? fmt(Number(e.amount)) : "-"}</td>
                  </tr>
                ))}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-muted/40 font-bold">
                  <tr className="border-t border-border">
                    <td className="p-3" colSpan={6}>সর্বমোট</td>
                    <td className="p-3 text-right text-emerald-700">{fmt(filtered.filter(e => e.entry_type === "deposit") .reduce((s, e) => s + Number(e.amount), 0))}</td>
                    <td className="p-3 text-right text-rose-700">{fmt(filtered.filter(e => e.entry_type === "withdraw").reduce((s, e) => s + Number(e.amount), 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
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

function SummaryCard({ icon, label, value, gradient }: any) {
  return (
    <Card className="relative overflow-hidden border-border/60">
      <div className={`absolute inset-0 opacity-10 bg-gradient-to-br ${gradient}`} />
      <CardContent className="p-5 relative flex items-center gap-4">
        <div className={`h-12 w-12 rounded-xl bg-gradient-to-br ${gradient} text-white grid place-items-center shadow-lg`}>
          {icon}
        </div>
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
      setDate(today()); setAmount(""); setAccountKind("general"); setCategory(""); setParty("");
      setMethod("cash"); setRef(""); setNotes("");
    }
  }, [open]);

  const save = async () => {
    if (!userId) { toast.error("লগইন প্রয়োজন"); return; }
    const amt = Number(amount);
    if (!amt || amt <= 0) { toast.error("সঠিক পরিমাণ দিন"); return; }
    setSaving(true);
    // store account kind as a prefix in category so account filter works
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
    toast.success(type === "deposit" ? "আয় সংরক্ষিত" : "খরচ সংরক্ষিত");
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
            {isDeposit ? "নতুন আয় এন্ট্রি" : "নতুন খরচ এন্ট্রি"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3 py-2">
          <div className="col-span-1">
            <Label>তারিখ</Label>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="col-span-1">
            <Label>পরিমাণ (৳)</Label>
            <Input type="number" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
          <div className="col-span-1">
            <Label>অ্যাকাউন্ট</Label>
            <Select value={accountKind} onValueChange={(v: any) => setAccountKind(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">সাধারণ</SelectItem>
                <SelectItem value="customer">কাস্টমার</SelectItem>
                <SelectItem value="supplier">সাপ্লায়ার</SelectItem>
                <SelectItem value="owner">মালিক</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
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
          <div className="col-span-2">
            <Label>ক্যাটাগরি</Label>
            <Input placeholder={isDeposit ? "যেমন: বিক্রয়, ভাড়া আদায়" : "যেমন: ভাড়া, বিদ্যুৎ বিল"} value={category} onChange={e => setCategory(e.target.value)} />
          </div>
          <div className="col-span-2">
            <Label>পার্টি / ব্যক্তির নাম</Label>
            <Input value={party} onChange={e => setParty(e.target.value)} />
          </div>
          <div className="col-span-1">
            <Label>রেফারেন্স নং</Label>
            <Input value={ref} onChange={e => setRef(e.target.value)} />
          </div>
          <div className="col-span-1" />
          <div className="col-span-2">
            <Label>নোট</Label>
            <Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>বাতিল</Button>
          <Button onClick={save} disabled={saving}
            className={isDeposit
              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
              : "bg-rose-600 hover:bg-rose-700 text-white"}>
            {saving ? "সংরক্ষণ..." : "সংরক্ষণ করুন"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function exportCsv(rows: Entry[]) {
  const head = ["তারিখ", "ধরন", "ক্যাটাগরি", "পার্টি", "পেমেন্ট", "রেফ", "আয়", "খরচ", "নোট"];
  const lines = [head.join(",")];
  rows.forEach(e => {
    lines.push([
      e.entry_date, e.entry_type === "deposit" ? "আয়" : "খরচ",
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
