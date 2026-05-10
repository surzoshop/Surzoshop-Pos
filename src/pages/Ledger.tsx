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
  ListFilter, CalendarDays, History,
} from "lucide-react";
import { Link } from "react-router-dom";
import { todayBD, addDaysBDStr, firstOfMonthBD, prevMonthRangeBD, fmtDateBD } from "@/lib/datetime";

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

const today = () => todayBD();
const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD")}`;

function rangeDates(r: RangeKey): { from: string; to: string } {
  const to = todayBD();
  if (r === "today")     return { from: to, to };
  if (r === "7d")        return { from: addDaysBDStr(to, -6), to };
  if (r === "30d")       return { from: addDaysBDStr(to, -29), to };
  if (r === "thisMonth") return { from: firstOfMonthBD(), to };
  if (r === "lastMonth") return prevMonthRangeBD();
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
  const [salesAgg, setSalesAgg] = useState<{ date: string; total: number; paid: number; party: string | null }[]>([]);
  const [purchasesAgg, setPurchasesAgg] = useState<{ date: string; total: number; paid: number; party: string | null }[]>([]);
  const [expensesAgg, setExpensesAgg] = useState<{ date: string; total: number; title: string; method: string }[]>([]);
  const [instPayAgg, setInstPayAgg] = useState<{ date: string; amount: number }[]>([]);
  const [profitAgg, setProfitAgg] = useState<{ date: string; profit: number }[]>([]);
  const [purchaseCostAgg, setPurchaseCostAgg] = useState<{ date: string; total: number }[]>([]);
  const [loading, setLoading] = useState(true);

  // Top section state
  const [topRange, setTopRange] = useState<RangeKey>("30d");
  const [topFrom, setTopFrom] = useState("");
  const [topTo, setTopTo] = useState("");
  const [topSearch, setTopSearch] = useState("");

  // Tabs
  const [tab, setTab] = useState<TabKey>("ledger");
  const [account, setAccount] = useState<AccountKey>("account");

  // Lower table section state
  const [lowRange, setLowRange] = useState<RangeKey>("30d");
  const [lowFrom, setLowFrom] = useState("");
  const [lowTo, setLowTo] = useState("");
  const [lowSearch, setLowSearch] = useState("");
  const [rowFilter, setRowFilter] = useState<RowFilter>("all");
  const [view, setView] = useState<ViewMode>("detailed");

  const [dialog, setDialog] = useState<null | "deposit" | "withdraw">(null);

  useEffect(() => {
    const r = rangeDates(topRange);
    setTopFrom(r.from === "2000-01-01" ? "" : r.from);
    setTopTo(r.from === "2000-01-01" ? "" : r.to);
  }, [topRange]);
  useEffect(() => {
    const r = rangeDates(lowRange);
    setLowFrom(r.from === "2000-01-01" ? "" : r.from);
    setLowTo(r.from === "2000-01-01" ? "" : r.to);
  }, [lowRange]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("cash_book" as any).select("*")
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
    if (currentShop) q = q.eq("shop_id", currentShop.id);

    let sq = supabase.from("sales").select("id,created_at,total,paid,customers(name)").order("created_at", { ascending: false });
    if (currentShop) sq = sq.eq("shop_id", currentShop.id);

    let pq = supabase.from("purchases").select("created_at,total,paid,suppliers(name)").order("created_at", { ascending: false });
    if (currentShop) pq = pq.eq("shop_id", currentShop.id);

    let eq_ = supabase.from("expenses").select("expense_date,amount,title,payment_method").order("expense_date", { ascending: false });
    if (currentShop) eq_ = eq_.eq("shop_id", currentShop.id);

    let ipq = supabase.from("installment_payments")
      .select("paid_at,amount,installments!inner(sale_id)")
      .order("paid_at", { ascending: false });
    if (currentShop) ipq = ipq.eq("shop_id", currentShop.id);

    // Profit calculation: sale_items joined with sales (date) and products (cost)
    let siq = supabase.from("sale_items").select("qty,unit_price,subtotal,sales!inner(created_at,discount,total,id),products(cost)");
    if (currentShop) siq = siq.eq("shop_id", currentShop.id);

    // Purchase cost (live): purchase_items joined with products(cost) — uses CURRENT product cost
    let piq = supabase.from("purchase_items").select("qty,created_at,purchases!inner(created_at),products(cost)");
    if (currentShop) piq = piq.eq("shop_id", currentShop.id);

    const [{ data, error }, { data: sd }, { data: pd }, { data: ed }, { data: ipd }, { data: sid }, { data: pid }] = await Promise.all([q, sq, pq, eq_, ipq, siq, piq]);
    if (error) toast.error(error.message);
    setEntries((data ?? []) as any);
    // Map: sale_id -> total installment_payments amount (these are added to sales.paid by trigger)
    const instBySale = new Map<string, number>();
    (ipd ?? []).forEach((p: any) => {
      const sid_ = p.installments?.sale_id;
      if (!sid_) return;
      instBySale.set(sid_, (instBySale.get(sid_) ?? 0) + Number(p.amount || 0));
    });
    setSalesAgg((sd ?? []).map((s: any) => ({
      date: String(s.created_at).slice(0, 10),
      total: Number(s.total || 0),
      // Initial cash received at sale time only — exclude installment payments (counted separately by paid_at)
      paid: Math.max(0, Number(s.paid || 0) - (instBySale.get(s.id) ?? 0)),
      party: s.customers?.name ?? null,
    })));
    setPurchasesAgg((pd ?? []).map((p: any) => ({
      date: String(p.created_at).slice(0, 10),
      total: Number(p.total || 0),
      paid: Number(p.paid || 0),
      party: p.suppliers?.name ?? null,
    })));
    setExpensesAgg((ed ?? []).map((e: any) => ({
      date: String(e.expense_date).slice(0, 10),
      total: Number(e.amount || 0),
      title: e.title ?? "খরচ",
      method: e.payment_method ?? "cash",
    })));
    setInstPayAgg((ipd ?? []).map((p: any) => ({
      date: String(p.paid_at).slice(0, 10),
      amount: Number(p.amount || 0),
    })));

    // Aggregate profit per sale, then bucket by date
    const perSale = new Map<string, { date: string; revenue: number; cost: number; discount: number; total: number }>();
    (sid ?? []).forEach((row: any) => {
      const sale = row.sales;
      if (!sale) return;
      const key = sale.id;
      const cur = perSale.get(key) ?? {
        date: String(sale.created_at).slice(0, 10),
        revenue: 0,
        cost: 0,
        discount: Number(sale.discount || 0),
        total: Number(sale.total || 0),
      };
      cur.revenue += Number(row.subtotal || 0);
      cur.cost    += Number(row.products?.cost || 0) * Number(row.qty || 0);
      perSale.set(key, cur);
    });
    const profitByDate = new Map<string, number>();
    perSale.forEach(s => {
      // Profit = sale total (after discount) − cost of goods sold
      const profit = s.total - s.cost;
      profitByDate.set(s.date, (profitByDate.get(s.date) ?? 0) + profit);
    });
    setProfitAgg(Array.from(profitByDate.entries()).map(([date, profit]) => ({ date, profit })));

    // Aggregate live purchase cost (qty × current product.cost) by date
    const pcByDate = new Map<string, number>();
    (pid ?? []).forEach((row: any) => {
      const date = String(row.purchases?.created_at ?? row.created_at).slice(0, 10);
      const amt = Number(row.qty || 0) * Number(row.products?.cost || 0);
      pcByDate.set(date, (pcByDate.get(date) ?? 0) + amt);
    });
    setPurchaseCostAgg(Array.from(pcByDate.entries()).map(([date, total]) => ({ date, total })));

    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentShop?.id]);

  // Convert sales/purchases/expenses into synthetic ledger entries so all tabs show real DB data
  const synthEntries: Entry[] = useMemo(() => {
    // বিক্রয় থেকে আসলে প্রাপ্ত নগদ (paid) — বাকি/কিস্তি অংশ এখানে আয় হিসেবে গণ্য নয়
    const sales: Entry[] = salesAgg
      .filter(s => s.paid > 0)
      .map((s, i) => ({
        id: `sale-${i}-${s.date}`,
        entry_date: s.date,
        entry_type: "deposit",
        amount: s.paid,
        category: "Sales / বিক্রয় (প্রাপ্ত)",
        payment_method: "cash",
        reference_no: null,
        party_name: s.party,
        notes: null,
        created_at: s.date,
      }));
    // ক্রয়ে আসলে যত নগদ পরিশোধিত (paid) — বাকি অংশ খরচ হিসেবে গণ্য নয়
    const purchases: Entry[] = purchasesAgg
      .filter(p => p.paid > 0)
      .map((p, i) => ({
        id: `pur-${i}-${p.date}`,
        entry_date: p.date,
        entry_type: "withdraw",
        amount: p.paid,
        category: "Purchase / স্টক ক্রয় (পরিশোধিত)",
        payment_method: "cash",
        reference_no: null,
        party_name: p.party,
        notes: null,
        created_at: p.date,
      }));
    const expenseRows: Entry[] = expensesAgg.map((x, i) => ({
      id: `exp-${i}-${x.date}`,
      entry_date: x.date,
      entry_type: "withdraw",
      amount: x.total,
      category: `Expense / ${x.title}`,
      payment_method: x.method || "cash",
      reference_no: null,
      party_name: null,
      notes: null,
      created_at: x.date,
    }));
    const instRows: Entry[] = instPayAgg
      .filter(p => p.amount > 0)
      .map((p, i) => ({
        id: `inst-${i}-${p.date}`,
        entry_date: p.date,
        entry_type: "deposit",
        amount: p.amount,
        category: "Installment / কিস্তি আদায়",
        payment_method: "cash",
        reference_no: null,
        party_name: null,
        notes: null,
        created_at: p.date,
      }));
    return [...entries, ...sales, ...purchases, ...expenseRows, ...instRows];
  }, [entries, salesAgg, purchasesAgg, expensesAgg, instPayAgg]);

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

  const inRange = (d: string) => (!topFrom || d >= topFrom) && (!topTo || d <= topTo);

  // 6 mini stat cards (top row) — REAL DB data
  const miniStats = useMemo(() => {
    // মোট বিক্রয় (invoice amount — সম্পূর্ণ বিক্রয়মূল্য, বাকি সহ)
    const salesTotal = salesAgg.filter(s => inRange(s.date)).reduce((s, x) => s + x.total, 0);
    // আসলে যত টাকা পেয়েছেন বিক্রয় থেকে: ডাউন পেমেন্ট/অগ্রিম/পূর্ণ নগদ (sales.paid)
    const salesPaid  = salesAgg.filter(s => inRange(s.date)).reduce((s, x) => s + x.paid, 0);
    // কিস্তি/বাকি আদায় হিসেবে পরে যত পেয়েছেন
    const instPaid   = instPayAgg.filter(p => inRange(p.date)).reduce((s, p) => s + p.amount, 0);

    // মোট আয় = প্রকৃত লাভ (বিক্রয়মূল্য − পণ্যের ক্রয়মূল্য)
    const profit = profitAgg.filter(p => inRange(p.date)).reduce((s, p) => s + p.profit, 0);
    const income = profit;

    // মোট খরচ: শুধুমাত্র খরচ এন্ট্রি পেজ থেকে (cash_book জমা/উত্তোলন বাদ, পণ্য ক্রয় বাদ)
    const realExpense = expensesAgg.filter(x => inRange(x.date)).reduce((s, x) => s + x.total, 0);
    const expense = realExpense;

    // স্টক ক্রয়মূল্য = প্রকৃত স্টক ক্রয় ইনভয়েসের মোট মূল্য (purchases টেবিল থেকে)
    const stockBuy = purchasesAgg.filter(p => inRange(p.date)).reduce((s, p) => s + Number(p.total || 0), 0);

    // ক্যাশ ইন/আউট (নগদ পেমেন্ট মাত্র)
    const cashbookIn = entries.filter(e => e.entry_type === "deposit" && (e.payment_method ?? "cash") === "cash" && inRange(e.entry_date))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const cashbookOut = entries.filter(e => e.entry_type === "withdraw" && (e.payment_method ?? "cash") === "cash" && inRange(e.entry_date))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenseCash = expensesAgg.filter(x => inRange(x.date) && (x.method || "cash") === "cash").reduce((s, x) => s + x.total, 0);

    // নগদ আয় = বিক্রয় থেকে প্রাপ্ত নগদ + কিস্তি আদায় + ম্যানুয়াল নগদ জমা
    const cashIn = salesPaid + instPaid + cashbookIn;
    // নগদ খরচ = শুধু খরচ + ম্যানুয়াল নগদ উত্তোলন (স্টক ক্রয়মূল্য বাদ — তা আলাদা কার্ডে)
    const cashOut = cashbookOut + expenseCash;

    // নগদ ব্যালেন্স = নগদ আয় − নগদ খরচ (খরচ না থাকলে পুরো আয়ই ব্যালেন্স)
    const cashBalance = cashIn - cashOut;
    const cashTxnTotal = cashIn + cashOut;

    // মোট আয় = বিক্রয় থেকে আসলে প্রাপ্ত নগদ = ডাউন পেমেন্ট + সম্পূর্ণ পরিশোধিত নগদ + কিস্তি আদায়
    const totalIncome = salesPaid + instPaid;

    return [
      { key: "sales"    as TabKey, label: "নগদ আয়",              value: totalIncome,  icon: ArrowDownToLine, tone: "income",   hint: "বিক্রয় থেকে প্রাপ্ত নগদ = ডাউন পেমেন্ট + সম্পূর্ণ পরিশোধিত + কিস্তি আদায়" },
      { key: "expense"  as TabKey, label: "মোট খরচ",             value: expense,      icon: ArrowUpFromLine, tone: "expense",  hint: "শুধুমাত্র খরচ এন্ট্রি পেজ থেকে (জমা/উত্তোলনের কোনো প্রভাব নেই)" },
      { key: "ledger"   as TabKey, label: "নগদ ব্যালেন্স",        value: cashBalance,  icon: Coins,           tone: "balance",  hint: "মোট আয় − মোট খরচ (স্টক ক্রয়মূল্য বাদ; খরচ না থাকলে পুরো আয়ই ব্যালেন্স)" },
      { key: "income"   as TabKey, label: "বিক্রয় থেকে মোট লাভ", value: income,       icon: TrendingUp,      tone: "income",   hint: "প্রকৃত লাভ = বিক্রয়মূল্য (ছাড় বাদে) − পণ্যের ক্রয়মূল্য" },
      { key: "purchase" as TabKey, label: "স্টক ক্রয়মূল্য",         value: stockBuy,     icon: ShoppingBag,     tone: "purchase", hint: "ক্রয় ইনভয়েসের মোট মূল্য (যত টাকার স্টক ক্রয় করেছেন)" },
      { key: "sales"    as TabKey, label: "মোট বিক্রয় (ইনভয়েস)", value: salesTotal,   icon: Receipt,         tone: "sales",    hint: "বিক্রয় ইনভয়েসের মোট (বাকি সহ)" },
    ];
  }, [entries, salesAgg, purchasesAgg, expensesAgg, instPayAgg, profitAgg, purchaseCostAgg, topFrom, topTo]);

  // 3 big totals (under account tabs) — based on lower range + tab + account filter
  const lowerFiltered = useMemo(() => synthEntries.filter(e => {
    if (lowFrom && e.entry_date < lowFrom) return false;
    if (lowTo   && e.entry_date > lowTo)   return false;

    const catLow = (e.category ?? "").toLowerCase();
    const isSales    = catLow.includes("sales")    || catLow.includes("বিক্রয়");
    const isPurchase = catLow.includes("purchase") || catLow.includes("ক্রয়");
    const isExpense  = catLow.startsWith("expense") || (e.entry_type === "withdraw" && !isPurchase);

    if (tab === "income"   && e.entry_type !== "deposit") return false;
    if (tab === "expense"  && (!isExpense || isPurchase)) return false;
    if (tab === "cash"     && (e.payment_method ?? "cash") !== "cash") return false;
    if (tab === "sales"    && !isSales) return false;
    if (tab === "purchase" && !isPurchase) return false;

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
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-foreground truncate">{TAB_META[tab].title}</h1>
          <p className="text-xs text-muted-foreground">{TAB_META[tab].subtitle}</p>
        </div>
        <div className="grid grid-cols-3 sm:flex gap-2 w-full sm:w-auto">
          <Button onClick={() => setDialog("deposit")}
            className="w-full sm:w-auto bg-primary hover:bg-primary/90 text-primary-foreground shadow-md">
            <ArrowDownCircle className="h-4 w-4" /> জমা
          </Button>
          <Button onClick={() => setDialog("withdraw")}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white shadow-md">
            <ArrowUpCircle className="h-4 w-4" /> উত্তোলন
          </Button>
          <Button asChild variant="outline" className="w-full sm:w-auto shadow-sm">
            <Link to="/cashbook-history"><History className="h-4 w-4" /> হিস্ট্রি</Link>
          </Button>
        </div>
      </div>

      {/* Top filter card */}
      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="খুঁজুন..." value={topSearch} onChange={e => setTopSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="-mx-1 px-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max">
              <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
              {RANGE_CHIPS.map(c => (
                <button key={c.key} onClick={() => setTopRange(c.key)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold border-2 transition-all whitespace-nowrap ${
                    topRange === c.key
                      ? "bg-primary text-primary-foreground border-primary shadow"
                      : "bg-background text-foreground/80 border-border hover:border-primary/50 hover:text-primary"
                  }`}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-bold text-muted-foreground sm:hidden">শুরু</Label>
              <Input type="date" value={topFrom} onChange={e => setTopFrom(e.target.value)} className="w-full sm:w-[150px] h-11 sm:h-10 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-bold text-muted-foreground sm:hidden">শেষ</Label>
              <Input type="date" value={topTo}   onChange={e => setTopTo(e.target.value)}   className="w-full sm:w-[150px] h-11 sm:h-10 text-sm" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 6 mini stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-3">
        {miniStats.map((s, i) => (
          <MiniStat key={i} {...s} active={tab === s.key} onClick={() => setTab(s.key)} />
        ))}
      </div>

      {/* Tabs row */}
      <div className="grid grid-cols-3 sm:flex sm:flex-wrap sm:justify-center gap-1.5 p-1.5 rounded-2xl bg-muted/40 border border-border/60">
        {TABS.map(t => {
          const active = tab === t.key;
          return (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`inline-flex items-center justify-center gap-1.5 sm:gap-2 px-2 sm:px-5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all duration-200 ${
                active
                  ? "bg-background shadow-md text-primary scale-[1.03]"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/60"
              }`}>
              <t.icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span className="truncate">{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Account sub-tabs (only for লেজার) */}
      {tab === "ledger" && (
        <div className="grid grid-cols-4 sm:flex sm:flex-wrap sm:justify-center gap-2">
          {ACCOUNT_TABS.map(a => {
            const active = account === a.key;
            return (
              <button key={a.key} onClick={() => setAccount(a.key)}
                className={`px-2 sm:px-5 py-2 rounded-full text-xs sm:text-sm font-bold border-2 transition-all duration-200 truncate ${
                  active
                    ? "bg-primary text-primary-foreground border-primary shadow-md sm:scale-105"
                    : "bg-background text-foreground/80 border-border hover:border-primary/60 hover:text-primary hover:-translate-y-0.5"
                }`}>{a.label}</button>
            );
          })}
        </div>
      )}

      {/* 3 totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <BigStat label={`মোট জমা (${TAB_META[tab].rangeChip})`} value={fmt(totals.cr)}      icon={<ArrowDownToLine className="h-5 w-5" />} accent="emerald" hint={`নীচের তারিখ-পরিসর + "${TAB_META[tab].title}" ট্যাবে প্রদর্শিত সকল আয়/জমার যোগফল`} />
        <BigStat label={`মোট খরচ (${TAB_META[tab].rangeChip})`} value={fmt(totals.dr)}      icon={<ArrowUpFromLine className="h-5 w-5" />} accent="rose"    hint={`নীচের তারিখ-পরিসর + "${TAB_META[tab].title}" ট্যাবে প্রদর্শিত সকল খরচ/উত্তোলনের যোগফল`} />
        <BigStat label="নীট ব্যালেন্স (এই তালিকার)" value={fmt(totals.balance)} icon={<BookOpen className="h-5 w-5" />}        accent="indigo"  hint="মোট জমা − মোট খরচ (শুধু এই তালিকায় যা দেখাচ্ছে)। ⚠️ এটা হাতে নগদ নয় — উপরের 'নগদ ব্যালেন্স' কার্ডে হাতে অবশিষ্ট নগদ দেখুন।" />
      </div>

      {/* Lower filter row */}
      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="-mx-1 px-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max">
              <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
              {RANGE_CHIPS.map(c => (
                <button key={c.key} onClick={() => setLowRange(c.key)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-xs sm:text-sm font-bold border-2 transition-all whitespace-nowrap ${
                    lowRange === c.key
                      ? "bg-primary text-primary-foreground border-primary shadow"
                      : "bg-background text-foreground/80 border-border hover:border-primary/50 hover:text-primary"
                  }`}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-bold text-muted-foreground sm:hidden">শুরু</Label>
              <Input type="date" value={lowFrom} onChange={e => setLowFrom(e.target.value)} className="w-full sm:w-[150px] h-11 sm:h-10 text-sm" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-bold text-muted-foreground sm:hidden">শেষ</Label>
              <Input type="date" value={lowTo}   onChange={e => setLowTo(e.target.value)}   className="w-full sm:w-[150px] h-11 sm:h-10 text-sm" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[160px]">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="খুঁজুন..." value={lowSearch} onChange={e => setLowSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => window.print()} className="flex-1 sm:flex-none">
              <FileText className="h-4 w-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => exportCsv(lowerFiltered)} className="flex-1 sm:flex-none">
              <Download className="h-4 w-4" /> CSV
            </Button>
          </div>
          <div className="-mx-1 px-1 overflow-x-auto scrollbar-hide">
            <div className="flex items-center gap-2 min-w-max">
              <ListFilter className="h-5 w-5 text-muted-foreground shrink-0" />
              {ROW_FILTERS.map(f => (
                <button key={f.key} onClick={() => setRowFilter(f.key)}
                  className={`px-3 sm:px-4 py-1.5 rounded-full text-xs sm:text-sm font-bold border-2 transition-all whitespace-nowrap ${
                    rowFilter === f.key
                      ? "bg-primary text-primary-foreground border-primary shadow"
                      : "bg-background text-foreground/80 border-border hover:border-primary/50 hover:text-primary"
                  }`}>{f.label}</button>
              ))}
            </div>
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
          {/* Mobile card view */}
          <div className="sm:hidden divide-y divide-border/40">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">লোড হচ্ছে...</div>
            ) : view === "detailed" ? (
              detailedRows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</div>
              ) : detailedRows.map(({ e, cr, dr, balance }) => (
                <div key={e.id} className="p-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${e.entry_type === "deposit" ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"}`}>
                        {e.entry_type === "deposit" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate">{e.category ?? "-"}</div>
                        <div className="text-[11px] text-muted-foreground truncate">{e.entry_date}{e.party_name ? ` • ${e.party_name}` : ""}</div>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-sm ${e.entry_type === "deposit" ? "text-emerald-600" : "text-rose-600"}`}>
                        {e.entry_type === "deposit" ? "+" : "-"}{fmt(e.entry_type === "deposit" ? cr : dr)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">ব্যাল: {fmt(balance)}</div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              dailyRows.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</div>
              ) : dailyRows.map(([date, v]) => (
                <div key={date} className="p-3 hover:bg-muted/30">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-sm">{date}</div>
                    <div className="font-black text-sm">{fmt(v.cr - v.dr)}</div>
                  </div>
                  <div className="flex justify-between text-[11px] mt-1">
                    <span className="text-emerald-600 font-bold">জমা: {fmt(v.cr)}</span>
                    <span className="text-rose-600 font-bold">উত্তোলন: {fmt(v.dr)}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop / tablet table view */}
          <div className="hidden sm:block overflow-x-auto">
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

function MiniStat({ label, value, icon: Icon, tone, active, onClick, hint }: any) {
  const tones: Record<string, { border: string; bg: string; icon: string; text: string; activeBg: string }> = {
    income:   { border: "border-emerald-500/60", bg: "bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/40 dark:to-emerald-900/20", icon: "text-white bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300", activeBg: "ring-2 ring-emerald-500" },
    expense:  { border: "border-rose-500/60",    bg: "bg-gradient-to-br from-rose-50 to-rose-100/50 dark:from-rose-950/40 dark:to-rose-900/20",          icon: "text-white bg-rose-500",    text: "text-rose-700 dark:text-rose-300",    activeBg: "ring-2 ring-rose-500" },
    balance:  { border: "border-primary/60",     bg: "bg-gradient-to-br from-primary/5 to-primary/15",                                                    icon: "text-primary-foreground bg-primary", text: "text-primary",            activeBg: "ring-2 ring-primary" },
    cash:     { border: "border-sky-500/60",     bg: "bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-950/40 dark:to-sky-900/20",              icon: "text-white bg-sky-500",     text: "text-sky-700 dark:text-sky-300",      activeBg: "ring-2 ring-sky-500" },
    sales:    { border: "border-amber-500/60",   bg: "bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/40 dark:to-amber-900/20",      icon: "text-white bg-amber-500",   text: "text-amber-700 dark:text-amber-300",  activeBg: "ring-2 ring-amber-500" },
    purchase: { border: "border-violet-500/60",  bg: "bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/40 dark:to-violet-900/20",  icon: "text-white bg-violet-500",  text: "text-violet-700 dark:text-violet-300", activeBg: "ring-2 ring-violet-500" },
  };
  const t = tones[tone] ?? tones.balance;
  return (
    <button onClick={onClick}
      className={`group relative text-left rounded-2xl p-4 border-2 ${t.border} ${t.bg} transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:scale-[1.02] ${
        active ? `${t.activeBg} shadow-lg scale-[1.02]` : "shadow-sm"
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className={`text-xs font-bold ${t.text} leading-tight break-words`}>{label}</div>
        <div className={`h-9 w-9 rounded-xl grid place-items-center shadow-md ${t.icon} transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <div className="mt-2 text-xl font-black text-foreground truncate">{`৳${Number(value || 0).toLocaleString("bn-BD")}`}</div>
      {hint && <div className="mt-1 text-[10px] sm:text-[11px] text-muted-foreground leading-tight line-clamp-2">{hint}</div>}
    </button>
  );
}

function BigStat({ label, value, icon, accent, hint }: any) {
  const accents: Record<string, { ic: string; border: string }> = {
    emerald: { ic: "text-emerald-600 bg-emerald-500/10", border: "border-emerald-500/40" },
    rose:    { ic: "text-rose-600 bg-rose-500/10",       border: "border-rose-500/40" },
    indigo:  { ic: "text-primary bg-primary/10",         border: "border-primary/40" },
  };
  const a = accents[accent] ?? accents.indigo;
  return (
    <Card className={`border-2 ${a.border} hover:shadow-md transition-all`}>
      <CardContent className="p-3 sm:p-5 flex items-center gap-3">
        <div className={`h-10 w-10 sm:h-12 sm:w-12 rounded-xl grid place-items-center shrink-0 ${a.ic}`}>{icon}</div>
        <div className="min-w-0">
          <p className="text-[11px] sm:text-xs text-muted-foreground font-bold">{label}</p>
          <p className="text-lg sm:text-2xl font-black text-foreground truncate">{value}</p>
          {hint && <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 leading-tight">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function EntryDialog({ open, type, onOpenChange, onSaved, userId, shopId }: any) {
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState("");
  const [accountKind, setAccountKind] = useState<"customer" | "supplier" | "owner" | "cash" | "general">("general");
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
    const finalMethod = accountKind === "cash" ? "cash" : method;
    const { error } = await supabase.from("cash_book" as any).insert({
      shop_id: shopId, entry_date: date, entry_type: type, amount: amt,
      category: finalCategory, party_name: party || null, payment_method: finalMethod,
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
      <DialogContent className="max-w-lg w-[calc(100vw-1rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6 rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            {isDeposit
              ? <ArrowDownCircle className="h-5 w-5 text-emerald-600" />
              : <ArrowUpCircle className="h-5 w-5 text-rose-600" />}
            {isDeposit ? "নতুন জমা" : "নতুন উত্তোলন"}
          </DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-2">
          <div><Label>তারিখ</Label><Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-11 sm:h-10" /></div>
          <div><Label>পরিমাণ (৳)</Label><Input type="number" inputMode="decimal" placeholder="0" value={amount} onChange={e => setAmount(e.target.value)} className="h-11 sm:h-10" /></div>
          <div>
            <Label>অ্যাকাউন্ট</Label>
            <Select value={accountKind} onValueChange={(v: any) => setAccountKind(v)}>
              <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="general">সাধারণ</SelectItem>
                <SelectItem value="cash">নগদ ব্যালেন্স</SelectItem>
                <SelectItem value="customer">কাস্টমার</SelectItem>
                <SelectItem value="supplier">সাপ্লায়ার</SelectItem>
                <SelectItem value="owner">ওনার</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>পেমেন্ট মাধ্যম</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger className="h-11 sm:h-10"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cash">নগদ</SelectItem>
                <SelectItem value="bkash">বিকাশ</SelectItem>
                <SelectItem value="nagad">নগদ (Nagad)</SelectItem>
                <SelectItem value="rocket">রকেট</SelectItem>
                <SelectItem value="bank">ব্যাংক</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="sm:col-span-2"><Label>ক্যাটাগরি</Label><Input placeholder={isDeposit ? "যেমন: বিক্রয়, ভাড়া আদায়" : "যেমন: ভাড়া, বিদ্যুৎ বিল"} value={category} onChange={e => setCategory(e.target.value)} className="h-11 sm:h-10" /></div>
          <div className="sm:col-span-2"><Label>পার্টি / ব্যক্তির নাম</Label><Input value={party} onChange={e => setParty(e.target.value)} className="h-11 sm:h-10" /></div>
          <div className="sm:col-span-2"><Label>রেফারেন্স নং</Label><Input value={ref} onChange={e => setRef(e.target.value)} className="h-11 sm:h-10" /></div>
          <div className="sm:col-span-2"><Label>নোট</Label><Textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 sticky bottom-0 bg-background pt-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto h-11 sm:h-10">বাতিল</Button>
          <Button onClick={save} disabled={saving}
            className={`w-full sm:w-auto h-11 sm:h-10 ${isDeposit ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}`}>
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
