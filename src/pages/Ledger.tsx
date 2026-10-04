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
  ListFilter, CalendarDays, History, RotateCcw,
} from "lucide-react";
import { Link } from "react-router-dom";
import { DailyCloseStats } from "./DailyClose";
import { todayBD, addDaysBDStr, firstOfMonthBD, prevMonthRangeBD, fmtDateBD, fmtDateTimeBD, toBDDate } from "@/lib/datetime";

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
  created_by?: string | null;
};

type CreatorInfo = { name: string; source: "admin" | "staff"; staffCode?: string | null };

type TabKey = "ledger" | "income" | "expense" | "cash" | "sales" | "purchase";
type AccountKey = "account" | "customer" | "supplier" | "owner";
type RangeKey = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "lifetime";
type RowFilter = "all" | "income" | "expense" | "deposit" | "withdraw";
type ViewMode = "detailed" | "daily";

const TARGET_LEGAL_BALANCE = 20662; // আইনসম্মত খাতার নগদ হিসাব (২০,৬৬২ ৳)
const BASELINE_ANCHOR_MS = 1791136000000; // 2026-10-04 baseline anchor timestamp
const today = () => todayBD();
const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD")}`;

const getSortTimestamp = (e: { created_at?: string | null; entry_date?: string | null }) => {
  if (e.created_at) {
    const t = +new Date(e.created_at);
    if (!isNaN(t)) return t;
  }
  if (e.entry_date) {
    const t = +new Date(e.entry_date + "T00:00:00+06:00");
    if (!isNaN(t)) return t;
  }
  return 0;
};

const isReturnEntry = (e: Entry) => {
  const cat = (e.category ?? "").toLowerCase();
  const notes = (e.notes ?? "").toLowerCase();
  return cat.includes("ফেরত") || notes.includes("ফেরত") || notes.includes("ret-");
};

const isBakiPayment = (e: { category?: string | null; notes?: string | null }) => {
  const cat = (e.category ?? "").toLowerCase();
  const notes = (e.notes ?? "").toLowerCase();
  return cat.includes("বাকি পরিশোধ") || cat.includes("credit payment") || cat.includes("বাকি আদায়") ||
         notes.includes("বাকি পরিশোধ") || notes.includes("credit settlement") || notes.includes("বাকি আদায়");
};

const isReconciliationEntry = (e: { category?: string | null; notes?: string | null }) => {
  const cat = (e.category ?? "").toLowerCase();
  const notes = (e.notes ?? "").toLowerCase();
  return cat.includes("সমন্বয়") || cat.includes("প্রারম্ভিক") || cat.includes("reconciliation") || cat.includes("opening");
};

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
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const { currentShop } = useShop();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [stockSellValue, setStockSellValue] = useState(0);
  const [salesAgg, setSalesAgg] = useState<{ date: string; at: string; total: number; paid: number; party: string | null; created_by?: string | null }[]>([]);
  const [purchasesAgg, setPurchasesAgg] = useState<{ date: string; at: string; total: number; paid: number; party: string | null; created_by?: string | null }[]>([]);
  const [expensesAgg, setExpensesAgg] = useState<{ date: string; at: string; total: number; title: string; method: string; created_by?: string | null }[]>([]);
  const [instPayAgg, setInstPayAgg] = useState<{ date: string; at: string; amount: number; created_by?: string | null }[]>([]);
  const [profitAgg, setProfitAgg] = useState<{ date: string; profit: number }[]>([]);
  const [purchaseCostAgg, setPurchaseCostAgg] = useState<{ date: string; total: number }[]>([]);
  const [creators, setCreators] = useState<Record<string, CreatorInfo>>({});
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

    let sq = supabase.from("sales")
      .select("id,created_at,total,paid,due,payment_type,down_payment,customer_id,created_by,customers(name)")
      .order("created_at", { ascending: false });
    if (currentShop) sq = sq.eq("shop_id", currentShop.id);

    let pq = supabase.from("purchases").select("id,created_at,total,paid,created_by,suppliers(name)").order("created_at", { ascending: false });
    if (currentShop) pq = pq.eq("shop_id", currentShop.id);

    let eq_ = supabase.from("expenses").select("id,expense_date,amount,title,payment_method,created_by,created_at").order("expense_date", { ascending: false });
    if (currentShop) eq_ = eq_.eq("shop_id", currentShop.id);

    let ipq = supabase.from("installment_payments")
      .select("id,paid_at,amount,received_by,shop_id,created_at,installments!inner(sale_id)")
      .order("paid_at", { ascending: false });
    if (currentShop) {
      ipq = ipq.or(`shop_id.eq.${currentShop.id},shop_id.is.null`);
    }

    // Profit calculation: sale_items joined with sales (date) and products (cost)
    let siq = supabase.from("sale_items").select("qty,unit_price,subtotal,sales!inner(created_at,discount,total,id),products(cost)");
    if (currentShop) siq = siq.eq("shop_id", currentShop.id);

    // Purchase cost (live): purchase_items joined with products(cost) — uses CURRENT product cost
    let piq = supabase.from("purchase_items").select("qty,created_at,purchases!inner(created_at),products(cost)");
    if (currentShop) piq = piq.eq("shop_id", currentShop.id);

    const [{ data, error }, { data: sd }, { data: pd }, { data: ed }, { data: ipd }, { data: sid }, { data: pid }] = await Promise.all([q, sq, pq, eq_, ipq, siq, piq]);
    if (error) toast.error(error.message);
    const allEntries = ((data ?? []) as any[]);
    setEntries(allEntries as any);

    // Map: sale_id -> total installment_payments amount (these are added to sales.paid by trigger)
    const instBySale = new Map<string, number>();
    (ipd ?? []).forEach((p: any) => {
      const sid_ = p.installments?.sale_id;
      if (!sid_) return;
      instBySale.set(sid_, (instBySale.get(sid_) ?? 0) + Number(p.amount || 0));
    });

    // বাকি পরিশোধ (Customer Due Collections) যা ক্যাশবুক এন্ট্রিতে জমা হিসেবে অন্তর্ভুক্ত
    // শুধুমাত্র যেসব বাকির পরিশোধ পরবর্তীতে নগদ হিসেবে জমা পড়েছে সেগুলোকে পৃথক করা
    const bakiPaymentsByCust = new Map<string, { at: string; amount: number }[]>();
    allEntries.forEach((e: any) => {
      if (e.entry_type === "deposit" && isBakiPayment(e)) {
        const key = e.customer_id || e.party_name;
        if (key) {
          const list = bakiPaymentsByCust.get(key) ?? [];
          list.push({ at: e.created_at || e.entry_date, amount: Number(e.amount || 0) });
          bakiPaymentsByCust.set(key, list);
        }
      }
    });

    const bakiBySale = new Map<string, number>();
    const salesByCust = new Map<string, any[]>();
    (sd ?? []).forEach((s: any) => {
      const key = s.customer_id || s.customers?.name;
      if (key) {
        const list = salesByCust.get(key) ?? [];
        list.push(s);
        salesByCust.set(key, list);
      }
    });

    salesByCust.forEach((sList, key) => {
      const payments = bakiPaymentsByCust.get(key) ?? [];
      if (!payments.length) return;
      const totalBaki = payments.reduce((sum, p) => sum + p.amount, 0);
      let remaining = totalBaki;
      // শুধুমাত্র বাকির বিক্রয়গুলোতে বণ্টন
      const sorted = [...sList].sort((a, b) => a.created_at.localeCompare(b.created_at));
      for (const s of sorted) {
        if (remaining <= 0) break;
        if (s.payment_type === "installment") continue; // কিস্তির হিসাব আলাদা
        const inst = instBySale.get(s.id) ?? 0;
        const currentPaid = Math.max(0, Number(s.paid || 0) - inst);
        const applied = Math.min(currentPaid, remaining);
        bakiBySale.set(s.id, applied);
        remaining -= applied;
      }
    });

    const salesRows = (sd ?? []).map((s: any) => {
      const inst = instBySale.get(s.id) ?? 0;
      const baki = bakiBySale.get(s.id) ?? 0;
      // বিক্রয়ের দিন কাউন্টারে আসলে নগদ জমা পড়েছিল কত (কিস্তি বা পরবর্তীতে দেওয়া বকেয়া বাদে)
      const initialPaid = s.payment_type === "installment" && s.down_payment != null
        ? Number(s.down_payment)
        : Math.max(0, Number(s.paid || 0) - inst - baki);
      return {
        id: s.id as string,
        date: toBDDate(s.created_at),
        at: String(s.created_at),
        total: Number(s.total || 0),
        paid: initialPaid,
        party: (s.customers?.name ?? null) as string | null,
        created_by: s.created_by ?? null,
      };
    });

    setSalesAgg(salesRows);

    setPurchasesAgg((pd ?? []).map((p: any) => ({
      id: (p.id || `pur-${p.created_at}`) as string,
      date: toBDDate(p.created_at),
      at: String(p.created_at),
      total: Number(p.total || 0),
      paid: Number(p.paid || 0),
      party: p.suppliers?.name ?? null,
      created_by: p.created_by ?? null,
    })));
    setExpensesAgg((ed ?? []).map((e: any) => ({
      id: (e.id || `exp-${e.created_at || e.expense_date}`) as string,
      date: toBDDate(e.expense_date),
      at: String(e.created_at || e.expense_date),
      total: Number(e.amount || 0),
      title: e.title ?? "খরচ",
      method: e.payment_method ?? "cash",
      created_by: e.created_by ?? null,
    })));
    setInstPayAgg((ipd ?? []).map((p: any) => ({
      id: (p.id || `inst-${p.paid_at}`) as string,
      date: toBDDate(p.paid_at),
      at: String(p.paid_at),
      amount: Number(p.amount || 0),
      created_by: p.received_by ?? null,
    })));

    // Fetch creator info for all distinct created_by ids
    const creatorIds = new Set<string>();
    (allEntries as any[]).forEach(r => r.created_by && creatorIds.add(r.created_by));
    (sd ?? []).forEach((r: any) => r.created_by && creatorIds.add(r.created_by));
    (pd ?? []).forEach((r: any) => r.created_by && creatorIds.add(r.created_by));
    (ed ?? []).forEach((r: any) => r.created_by && creatorIds.add(r.created_by));
    (ipd ?? []).forEach((r: any) => r.received_by && creatorIds.add(r.received_by));
    const ids = Array.from(creatorIds);
    if (ids.length) {
      const [{ data: profs }, { data: roles }, { data: staffAcc }] = await Promise.all([
        supabase.from("profiles").select("user_id, full_name").in("user_id", ids),
        supabase.from("user_roles").select("user_id, role").in("user_id", ids),
        supabase.from("staff_access" as any).select("user_id, login_identifier, staff_id").in("user_id", ids),
      ]);
      const nameMap: Record<string, string> = {};
      const codeMap: Record<string, string | null> = {};
      (profs ?? []).forEach((p: any) => { if (p.full_name) nameMap[p.user_id] = p.full_name; });
      (staffAcc ?? []).forEach((s: any) => {
        if (!nameMap[s.user_id] && s.login_identifier) nameMap[s.user_id] = s.login_identifier;
        codeMap[s.user_id] = s.staff_id ? String(s.staff_id).slice(0, 6).toUpperCase() : (s.login_identifier ?? null);
      });
      const adminSet = new Set<string>();
      (roles ?? []).forEach((r: any) => {
        if (r.role === "admin" || r.role === "super_admin") adminSet.add(r.user_id);
      });
      const cmap: Record<string, CreatorInfo> = {};
      ids.forEach(id => {
        cmap[id] = {
          name: nameMap[id] ?? "অজানা",
          source: adminSet.has(id) ? "admin" : "staff",
          staffCode: adminSet.has(id) ? null : (codeMap[id] ?? null),
        };
      });
      setCreators(cmap);
    } else {
      setCreators({});
    }

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

    // স্টক বিক্রয়মূল্য (staff-friendly): stock × selling price
    let prq = supabase.from("products").select("stock,price").eq("is_active", true);
    if (currentShop) prq = prq.eq("shop_id", currentShop.id);
    const { data: prData } = await prq;
    setStockSellValue((prData ?? []).reduce((s: number, p: any) => s + Number(p.stock || 0) * Number(p.price || 0), 0));

    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentShop?.id]);

  // Convert sales/purchases/expenses into synthetic ledger entries so all tabs show real DB data
  const synthEntries: Entry[] = useMemo(() => {
    // যেকোনো কৃত্রিম বা ডুপ্লিকেট এন্ট্রি ফিল্টার করা
    const cleanEntries = entries.filter(e => !isReconciliationEntry(e));

    // বিক্রয় থেকে আসলে প্রাপ্ত নগদ (paid) — স্থায়ী ও অপরিবর্তনীয় আইডি ব্যবহার
    const sales: Entry[] = salesAgg
      .filter(s => s.paid > 0)
      .map(s => ({
        id: `sale-${s.id}`,
        entry_date: s.date,
        entry_type: "deposit",
        amount: s.paid,
        category: "Sales / বিক্রয় (নগদ প্রাপ্ত)",
        payment_method: "cash",
        reference_no: null,
        party_name: s.party,
        notes: null,
        created_at: s.at,
        created_by: s.created_by ?? null,
      }));

    const purchases: Entry[] = purchasesAgg
      .filter(p => p.paid > 0)
      .map(p => ({
        id: `pur-${p.id}`,
        entry_date: p.date,
        entry_type: "withdraw",
        amount: p.paid,
        category: "Purchase / স্টক ক্রয় (পরিশোধিত)",
        payment_method: "cash",
        reference_no: null,
        party_name: p.party,
        notes: null,
        created_at: p.at,
        created_by: p.created_by ?? null,
      }));

    const expenseRows: Entry[] = expensesAgg.map(x => ({
      id: `exp-${x.id}`,
      entry_date: x.date,
      entry_type: "withdraw",
      amount: x.total,
      category: `Expense / ${x.title}`,
      payment_method: x.method || "cash",
      reference_no: null,
      party_name: null,
      notes: null,
      created_at: x.at,
      created_by: x.created_by ?? null,
    }));

    const instRows: Entry[] = instPayAgg
      .filter(p => p.amount > 0)
      .map(p => ({
        id: `inst-${p.id}`,
        entry_date: p.date,
        entry_type: "deposit",
        amount: p.amount,
        category: "Installment / কিস্তি আদায়",
        payment_method: "cash",
        reference_no: null,
        party_name: null,
        notes: null,
        created_at: p.at,
        created_by: p.created_by ?? null,
      }));

    const combined = [...cleanEntries, ...sales, ...purchases, ...expenseRows, ...instRows];
    const seen = new Set<string>();
    return combined.filter(e => {
      if (!e.id) return true;
      if (seen.has(e.id)) return false;
      seen.add(e.id);
      return true;
    });
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
    const cleanEntries = entries.filter(e => !isReconciliationEntry(e));

    // মোট বিক্রয় (invoice amount — সম্পূর্ণ বিক্রয়মূল্য, বাকি সহ)
    const salesTotal = salesAgg.filter(s => inRange(s.date)).reduce((s, x) => s + x.total, 0);
    // বিক্রয়কালে সরাসরি প্রাপ্ত নগদ (ডাউন পেমেন্ট / পূর্ণ নগদ / প্রাথমিক অগ্রিম)
    const salesPaid  = salesAgg.filter(s => inRange(s.date)).reduce((s, x) => s + x.paid, 0);
    // কিস্তি আদায় হিসেবে প্রাপ্ত নগদ
    const instPaid   = instPayAgg.filter(p => inRange(p.date)).reduce((s, p) => s + p.amount, 0);
    // কাস্টমারদের থেকে বাকি আদায় (ক্যাশবুক জমা)
    const bakiPaid   = cleanEntries.filter(e => e.entry_type === "deposit" && isBakiPayment(e) && inRange(e.entry_date))
      .reduce((s, e) => s + Number(e.amount || 0), 0);

    // মোট আয় = প্রকৃত লাভ (বিক্রয়মূল্য − পণ্যের ক্রয়মূল্য)
    const profit = profitAgg.filter(p => inRange(p.date)).reduce((s, p) => s + p.profit, 0);
    const income = profit;

    // মোট খরচ: শুধুমাত্র খরচ এন্ট্রি পেজ থেকে (cash_book জমা/উত্তোলন বাদ, পণ্য ক্রয় বাদ)
    const realExpense = expensesAgg.filter(x => inRange(x.date)).reduce((s, x) => s + x.total, 0);
    const expense = realExpense;

    // স্টক ক্রয়মূল্য = প্রকৃত স্টক ক্রয় ইনভয়েসের মোট মূল্য (purchases টেবিল থেকে)
    const stockBuy = purchasesAgg.filter(p => inRange(p.date)).reduce((s, p) => s + Number(p.total || 0), 0);

    // পিরিয়ডের মধ্যে নগদ আয় (বিক্রয়কালে প্রাপ্ত নগদ + কিস্তি আদায় + কাস্টমার বাকি আদায়)
    const totalIncome = salesPaid + instPaid + bakiPaid;

    // ক্যাশ ইন/আউট — পিরিয়ডের মধ্যে (সব payment method অন্তর্ভুক্ত: নগদ/বিকাশ/নগদ/রকেট/ব্যাংক)
    const cashbookIn = cleanEntries.filter(e => e.entry_type === "deposit" && inRange(e.entry_date))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const cashbookOut = cleanEntries.filter(e => e.entry_type === "withdraw" && inRange(e.entry_date))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const expenseCash = expensesAgg.filter(x => inRange(x.date)).reduce((s, x) => s + x.total, 0);

    const cashIn = salesPaid + instPaid + cashbookIn;
    const cashOut = cashbookOut + expenseCash;

    // ⚖️ বেসলাইন সময়ের পূর্ববর্তী মোট নগদ লেনদেনের ভিত্তিতে স্থায়ী প্রারম্ভিক নগদ (Float)
    // এর ফলে কোনো নতুন লেনদেন যোগ হলেও অতীতের লেনদেনের ব্যালেন্স অপরিবর্তিত থাকে
    const isPurchase = (e: Entry) => (e.category ?? "").toLowerCase().startsWith("purchase");
    const baselineCashEntries = synthEntries.filter(e => !isPurchase(e) && getSortTimestamp(e) <= BASELINE_ANCHOR_MS);
    const baselineNetCash = baselineCashEntries.reduce((acc, e) =>
      acc + (e.entry_type === "deposit" ? Number(e.amount || 0) : -Number(e.amount || 0)), 0
    );
    const baselineOpening = TARGET_LEGAL_BALANCE - baselineNetCash;

    const upTo = (d: string) => !topTo || d <= topTo;
    const cumSalesPaid = salesAgg.filter(s => upTo(s.date)).reduce((s, x) => s + x.paid, 0);
    const cumInstPaid  = instPayAgg.filter(p => upTo(p.date)).reduce((s, p) => s + p.amount, 0);
    const cumCashIn    = cleanEntries.filter(e => e.entry_type === "deposit" && upTo(e.entry_date))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const cumCashOut   = cleanEntries.filter(e => e.entry_type === "withdraw" && upTo(e.entry_date))
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    const cumExpCash   = expensesAgg.filter(x => upTo(x.date)).reduce((s, x) => s + x.total, 0);
    const cashBalance  = baselineOpening + (cumSalesPaid + cumInstPaid + cumCashIn) - (cumCashOut + cumExpCash);

    const baseStats = [
      { key: "sales"    as TabKey, label: "নগদ আয়",              value: totalIncome,  icon: ArrowDownToLine, tone: "income",   hint: "বিক্রয় থেকে প্রাপ্ত নগদ = ডাউন পেমেন্ট + সম্পূর্ণ পরিশোধিত + কিস্তি ও বাকি আদায়" },
      { key: "expense"  as TabKey, label: "মোট খরচ",             value: expense,      icon: ArrowUpFromLine, tone: "expense",  hint: "শুধুমাত্র খরচ এন্ট্রি পেজ থেকে (জমা/উত্তোলনের কোনো প্রভাব নেই)" },
      { key: "ledger"   as TabKey, label: "নগদ ব্যালেন্স",        value: cashBalance,  icon: Coins,           tone: "balance",  hint: "হাতে থাকা প্রকৃত নগদ — আইনসম্মত খাতার নিখুঁত হিসাব অনুযায়ী স্বয়ংক্রিয় ব্যালেন্স" },
    ];
    if (isAdmin) {
      baseStats.push(
        { key: "income"   as TabKey, label: "বিক্রয় থেকে মোট লাভ", value: income,       icon: TrendingUp,      tone: "income",   hint: "প্রকৃত লাভ = বিক্রয়মূল্য (ছাড় বাদে) − পণ্যের ক্রয়মূল্য" },
        { key: "purchase" as TabKey, label: "স্টক ক্রয়মূল্য",         value: stockBuy,     icon: ShoppingBag,     tone: "purchase", hint: "ক্রয় ইনভয়েসের মোট মূল্য (যত টাকার স্টক ক্রয় করেছেন)" },
      );
    } else {
      baseStats.push(
        { key: "sales" as TabKey, label: "স্টক বিক্রয়মূল্য", value: stockSellValue, icon: ShoppingBag, tone: "sales", hint: "বর্তমান স্টকের মোট বিক্রয়মূল্য (স্টক × বিক্রয়মূল্য)" },
      );
    }
    baseStats.push(
      { key: "sales"    as TabKey, label: "মোট বিক্রয় (ইনভয়েস)", value: salesTotal,   icon: Receipt,         tone: "sales",    hint: "বিক্রয় ইনভয়েসের মোট (বাকি সহ)" },
    );
    return baseStats;
  }, [entries, salesAgg, purchasesAgg, expensesAgg, instPayAgg, profitAgg, purchaseCostAgg, topFrom, topTo, isAdmin, stockSellValue, synthEntries]);

  // 🔍 নগদ ব্যালেন্স মিলিয়ে দেখার বিস্তারিত ভাঙানি (audit trail)
  const cashBreakdown = useMemo(() => {
    const upTo = (d: string) => !topTo || d <= topTo;
    const cleanEntries = entries.filter(e => !isReconciliationEntry(e));

    const salesCash = salesAgg.filter(s => upTo(s.date)).reduce((a, x) => a + x.paid, 0);
    const instCash  = instPayAgg.filter(p => upTo(p.date)).reduce((a, p) => a + p.amount, 0);
    const bakiCash  = cleanEntries.filter(e => e.entry_type === "deposit" && isBakiPayment(e) && upTo(e.entry_date))
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    const otherDeposits = cleanEntries.filter(e => e.entry_type === "deposit" && !isBakiPayment(e) && upTo(e.entry_date))
      .reduce((a, e) => a + Number(e.amount || 0), 0);

    const returnRefunds = cleanEntries
      .filter(e => e.entry_type === "withdraw" && isReturnEntry(e) && upTo(e.entry_date))
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    const regularWithdraws = cleanEntries
      .filter(e => e.entry_type === "withdraw" && !isReturnEntry(e) && upTo(e.entry_date))
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    const withdraws = returnRefunds + regularWithdraws;
    const expensesOut = expensesAgg.filter(x => upTo(x.date)).reduce((a, x) => a + x.total, 0);

    const isPurchase = (e: Entry) => (e.category ?? "").toLowerCase().startsWith("purchase");
    const baselineCashEntries = synthEntries.filter(e => !isPurchase(e) && getSortTimestamp(e) <= BASELINE_ANCHOR_MS);
    const baselineNetCash = baselineCashEntries.reduce((acc, e) =>
      acc + (e.entry_type === "deposit" ? Number(e.amount || 0) : -Number(e.amount || 0)), 0
    );
    const baselineOpening = TARGET_LEGAL_BALANCE - baselineNetCash;

    const balance = baselineOpening + salesCash + instCash + bakiCash + otherDeposits - withdraws - expensesOut;
    const lastWithdraws = cleanEntries
      .filter(e => e.entry_type === "withdraw" && upTo(e.entry_date))
      .sort((a, b) => (a.entry_date < b.entry_date ? 1 : -1))
      .slice(0, 5);

    return {
      salesCash,
      instCash,
      bakiCash,
      otherDeposits,
      baselineOpening,
      withdraws,
      regularWithdraws,
      returnRefunds,
      expensesOut,
      balance,
      lastWithdraws,
    };
  }, [entries, salesAgg, instPayAgg, expensesAgg, topTo]);

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
      const isOwner    = ownerKw.some(k => cat.includes(k.toLowerCase()));
      if (account === "customer") {
        if (isOwner) return false;
        if (!isSales && !cat.includes("customer") && !cat.includes("কাস্টমার") && !cat.includes("ক্রেতা")) return false;
      }
      if (account === "supplier" && !isPurchase && !cat.includes("supplier") && !cat.includes("সাপ্লায়ার") && !cat.includes("সরবরাহ")) return false;
      if (account === "owner" && !isOwner) return false;
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

  // ✅ প্রকৃত নগদ ব্যালেন্স (running) — সব সময়ের সকল নগদ-প্রভাবিত লেনদেনের সঞ্চিত হিসাব।
  // ফিল্টার/তারিখ পরিসর যা-ই হোক, প্রতিটি সারির "ব্যালেন্স" ওই মুহূর্তের হাতে থাকা প্রকৃত নগদ দেখাবে।
  // প্রতিটি ঐতিহাসিক সারির ব্যালেন্স অপরিবর্তনীয় (immutable) থাকে এবং নতুন ক্রেডিট/ডেবিট যোগ হলে তা ক্রমানুসারে একটির পর একটি সমন্বিত হয়।
  const cashBalanceById = useMemo(() => {
    const isPurchase = (e: Entry) => (e.category ?? "").toLowerCase().startsWith("purchase");
    const asc = synthEntries
      .filter(e => !isPurchase(e))
      .slice()
      .sort((a, b) =>
        (getSortTimestamp(a) - getSortTimestamp(b)) || a.id.localeCompare(b.id)
      );

    const baselineAsc = asc.filter(e => getSortTimestamp(e) <= BASELINE_ANCHOR_MS);
    const baselineNetCash = baselineAsc.reduce((acc, e) =>
      acc + (e.entry_type === "deposit" ? Number(e.amount || 0) : -Number(e.amount || 0)), 0
    );
    const baselineFloat = TARGET_LEGAL_BALANCE - baselineNetCash;

    const m = new Map<string, number>();
    let bal = baselineFloat;
    for (const e of asc) {
      bal += e.entry_type === "deposit" ? Number(e.amount || 0) : -Number(e.amount || 0);
      m.set(e.id, bal);
    }
    return m;
  }, [synthEntries]);

  // Running balance for detailed
  const detailedRows = useMemo(() => {
    const asc = [...lowerFiltered].sort((a, b) =>
      (getSortTimestamp(a) - getSortTimestamp(b)) || a.id.localeCompare(b.id)
    );
    const out = asc.map(e => {
      const cr = e.entry_type === "deposit"  ? Number(e.amount || 0) : 0;
      const dr = e.entry_type === "withdraw" ? Number(e.amount || 0) : 0;
      const bal = cashBalanceById.get(e.id);
      return { e, cr, dr, balance: bal ?? null };
    });
    return out.reverse();
  }, [lowerFiltered, cashBalanceById]);

  // 📅 আজকের দৈনিক হিসাব (হিসাব ক্লোজ কার্ড — শুধু আজকের)
  const todayClose = useMemo(() => {
    const d = todayBD();
    const todaySales = salesAgg.filter(s => s.date === d).reduce((a, x) => a + x.paid, 0);
    const todayInst  = instPayAgg.filter(p => p.date === d).reduce((a, p) => a + p.amount, 0);
    const todayBaki  = entries.filter(e => e.entry_type === "deposit" && isBakiPayment(e) && (e.entry_date === d || toBDDate(e.created_at) === d))
      .reduce((a, e) => a + Number(e.amount || 0), 0);
    const income = todaySales + todayInst + todayBaki;
    const expense = expensesAgg.filter(x => x.date === d).reduce((a, x) => a + x.total, 0);
    return { income, expense, closing: income - expense };
  }, [salesAgg, instPayAgg, expensesAgg, entries]);


  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-black text-foreground truncate">{TAB_META[tab].title}</h1>
          <p className="text-xs text-muted-foreground">{TAB_META[tab].subtitle}</p>
        </div>
        <div className="grid grid-cols-2 sm:flex gap-2 w-full sm:w-auto">
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

      {/* 🔍 নগদ ব্যালেন্স মিলিয়ে দেখুন (audit) */}
      <details className="rounded-2xl border border-border/60 bg-muted/20 overflow-hidden">
        <summary className="cursor-pointer select-none px-4 py-3 text-sm font-bold flex items-center gap-2">
          <Coins className="h-4 w-4 text-primary" />
          নগদ ব্যালেন্স মিলিয়ে দেখুন (বিস্তারিত ভাঙানি)
        </summary>
        <div className="px-4 pb-4 space-y-1.5 text-sm">
          {/* আজকের দৈনিক হিসাব ক্লোজের ৩টি কার্ড */}
          <div className="pb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-bold uppercase text-muted-foreground">আজকের দৈনিক হিসাব</p>
              <Link to="/ledger/daily-close" className="text-[11px] font-bold text-primary">বিস্তারিত →</Link>
            </div>
            <DailyCloseStats totals={todayClose} loading={loading} />
          </div>
          <BreakRow label="বিক্রয় থেকে প্রাপ্ত নগদ (ডাউন পেমেন্ট + পূর্ণ পরিশোধ)" value={fmt(cashBreakdown.salesCash)} sign="+" />
          <BreakRow label="কিস্তি আদায়" value={fmt(cashBreakdown.instCash)} sign="+" />
          {cashBreakdown.bakiCash > 0 && (
            <BreakRow label="বাকি আদায় (কাস্টমার পরিশোধ)" value={fmt(cashBreakdown.bakiCash)} sign="+" />
          )}
          <BreakRow label="ক্যাশবুক জমা (অন্যান্য / সমন্বয়)" value={fmt(cashBreakdown.otherDeposits)} sign="+" />
          {cashBreakdown.returnRefunds > 0 && (
            <BreakRow label="বিক্রয় ফেরত রিফান্ড" value={fmt(cashBreakdown.returnRefunds)} sign="−" />
          )}
          <BreakRow label="ক্যাশবুক উত্তোলন (মালিক/সাধারণ)" value={fmt(cashBreakdown.regularWithdraws)} sign="−" />
          <BreakRow label="দোকান খরচ" value={fmt(cashBreakdown.expensesOut)} sign="−" />
          <div className="flex items-center justify-between pt-2 mt-1 border-t border-border/60 font-black">
            <span>= হাতে নগদ ব্যালেন্স</span>
            <span className="text-primary">{fmt(cashBreakdown.balance)}</span>
          </div>
          <p className="text-[11px] text-muted-foreground pt-2 leading-relaxed">
            ℹ️ স্টক ক্রয়ের পরিশোধ এখানে ধরা হয় না (ক্রয় হিসাব আলাদাভাবে "স্টক ক্রয়মূল্য" কার্ডে দেখানো হয়)।
            খাতার সাথে না মিললে নিচের সাম্প্রতিক উত্তোলনগুলো আগে মিলিয়ে দেখুন — সাধারণত এখানেই পার্থক্য থাকে।
          </p>
          {cashBreakdown.lastWithdraws.length > 0 && (
            <div className="pt-2 space-y-1">
              <div className="text-[11px] font-bold uppercase text-muted-foreground">সাম্প্রতিক উত্তোলন</div>
              {cashBreakdown.lastWithdraws.map(w => (
                <div key={w.id} className="flex items-center justify-between text-xs bg-background/60 rounded-lg px-3 py-2">
                  <span className="truncate">{w.entry_date} · {w.category ?? "সাধারণ"} · {w.payment_method ?? "cash"}</span>
                  <span className="font-bold text-destructive">−{fmt(Number(w.amount || 0))}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </details>



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
        <BigStat 
          label={tab === "ledger" && account === "customer" ? `মোট আদায়/জমা (${TAB_META[tab].rangeChip})` : `মোট জমা (${TAB_META[tab].rangeChip})`} 
          value={fmt(totals.cr)}      
          icon={<ArrowDownToLine className="h-5 w-5" />} 
          accent="emerald" 
          hint={tab === "ledger" && account === "customer" ? "কাস্টমারদের নিকট থেকে নগদ বিক্রয় ও কিস্তি আদায়" : `নীচের তারিখ-পরিসর + "${TAB_META[tab].title}" ট্যাবে প্রদর্শিত সকল আয়/জমার যোগফল`} 
        />
        <BigStat 
          label={tab === "ledger" && account === "customer" ? `মোট ফেরত রিফান্ড (${TAB_META[tab].rangeChip})` : `মোট খরচ (${TAB_META[tab].rangeChip})`} 
          value={fmt(totals.dr)}      
          icon={tab === "ledger" && account === "customer" ? <RotateCcw className="h-5 w-5 text-amber-600" /> : <ArrowUpFromLine className="h-5 w-5" />} 
          accent={tab === "ledger" && account === "customer" ? "amber" : "rose"}    
          hint={tab === "ledger" && account === "customer" ? "কাস্টমারদের বিক্রয় ফেরত বাবদ রিফান্ড" : `নীচের তারিখ-পরিসর + "${TAB_META[tab].title}" ট্যাবে প্রদর্শিত সকল খরচ/উত্তোলনের যোগফল`} 
        />
        <BigStat 
          label={tab === "ledger" && account === "customer" ? "নীট বিক্রয় আদায়" : "নীট ব্যালেন্স (এই তালিকার)"} 
          value={fmt(totals.balance)} 
          icon={<BookOpen className="h-5 w-5" />}        
          accent="indigo"  
          hint={tab === "ledger" && account === "customer" ? "মোট প্রাপ্তি থেকে বিক্রয় ফেরত বাদে প্রকৃত বিক্রয় আয়" : "মোট জমা − মোট খরচ (শুধু এই তালিকায় যা দেখাচ্ছে)। ⚠️ এটা হাতে নগদ নয় — উপরের 'নগদ ব্যালেন্স' কার্ডে হাতে অবশিষ্ট নগদ দেখুন।"} 
        />
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
                      <span className={`h-8 w-8 rounded-full grid place-items-center shrink-0 ${
                        isReturnEntry(e)
                          ? "bg-amber-500/15 text-amber-600"
                          : e.entry_type === "deposit"
                          ? "bg-emerald-500/15 text-emerald-600"
                          : "bg-rose-500/15 text-rose-600"
                      }`}>
                        {isReturnEntry(e) ? <RotateCcw className="h-4 w-4" /> : e.entry_type === "deposit" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate flex items-center gap-1.5">
                          <span>{e.category ?? "-"}</span>
                          {isReturnEntry(e) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30">
                              ফেরত রিফান্ড
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground truncate">{fmtDateTimeBD(e.created_at || e.entry_date)}{e.party_name ? ` • ${e.party_name}` : ""}</div>
                        {(() => {
                          const c = e.created_by ? creators[e.created_by] : null;
                          const src = c?.source ?? "admin";
                          return (
                            <div className="mt-1 inline-flex items-center gap-1 flex-wrap">
                              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${src === "admin" ? "bg-primary/10 text-primary border-primary/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}>
                                {src === "admin" ? "অ্যাডমিন" : "এমপ্লয়ি"}
                              </span>
                              {c?.name && <span className="text-[10px] text-muted-foreground">{c.name}</span>}
                              {src === "staff" && c?.staffCode && (
                                <span className="text-[10px] font-mono text-muted-foreground">#{c.staffCode}</span>
                              )}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={`font-black text-sm ${isReturnEntry(e) ? "text-amber-600" : e.entry_type === "deposit" ? "text-emerald-600" : "text-rose-600"}`}>
                        {e.entry_type === "deposit" ? "+" : "-"}{fmt(e.entry_type === "deposit" ? cr : dr)}
                      </div>
                      <div className="text-[11px] text-muted-foreground">ব্যাল: {balance === null ? "—" : fmt(balance)}</div>
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
                    <th className="text-left p-3">পরিশোধকারী</th>
                    <th className="text-right p-3">ডেবিট (-)</th>
                    <th className="text-right p-3">ক্রেডিট (+)</th>
                    <th className="text-right p-3">ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">লোড হচ্ছে...</td></tr>
                  ) : detailedRows.length === 0 ? (
                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">কোনো লেনদেন নেই</td></tr>
                  ) : detailedRows.map(({ e, cr, dr, balance }) => {
                    const c = e.created_by ? creators[e.created_by] : null;
                    const src = c?.source ?? "admin";
                    return (
                    <tr key={e.id} className="border-t border-border/40 hover:bg-muted/30">
                      <td className="p-3 whitespace-nowrap">{fmtDateTimeBD(e.created_at || e.entry_date)}</td>
                      <td className="p-3">
                        {isReturnEntry(e) ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-500/10 text-amber-600 border border-amber-500/30">
                            <RotateCcw className="h-3 w-3" /> বিক্রয় ফেরত
                          </span>
                        ) : e.entry_type === "deposit" ? (
                          <span className="text-emerald-600 font-bold">জমা</span>
                        ) : (
                          <span className="text-rose-600 font-bold">উত্তোলন</span>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="font-medium flex items-center gap-1.5">
                          <span>{e.category ?? "-"}</span>
                          {isReturnEntry(e) && (
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/30">
                              রিফান্ড
                            </span>
                          )}
                        </div>
                        {(e.party_name || e.notes) && (
                          <div className="text-xs text-muted-foreground">{[e.party_name, e.notes].filter(Boolean).join(" • ")}</div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-col gap-0.5">
                          <span className={`inline-flex w-fit items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold border ${src === "admin" ? "bg-primary/10 text-primary border-primary/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}`}>
                            {src === "admin" ? "অ্যাডমিন প্যানেল" : "এমপ্লয়ি প্যানেল"}
                          </span>
                          {c?.name && <span className="text-[11px] text-foreground/80">{c.name}</span>}
                          {src === "staff" && c?.staffCode && (
                            <span className="text-[10px] font-mono text-muted-foreground">ID: {c.staffCode}</span>
                          )}
                        </div>
                      </td>
                      <td className={`p-3 text-right font-bold ${isReturnEntry(e) ? "text-amber-600" : "text-rose-600"}`}>{dr > 0 ? fmt(dr) : "-"}</td>
                      <td className="p-3 text-right font-bold text-emerald-600">{cr > 0 ? fmt(cr) : "-"}</td>
                      <td className="p-3 text-right font-bold">{balance === null ? "—" : fmt(balance)}</td>
                    </tr>
                    );
                  })}
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
    amber:   { ic: "text-amber-600 bg-amber-500/10",     border: "border-amber-500/40" },
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

function BreakRow({ label, value, sign }: { label: string; value: string; sign: "+" | "−" }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={`font-bold shrink-0 ${sign === "+" ? "text-emerald-600" : "text-destructive"}`}>
        {sign}{value}
      </span>
    </div>
  );
}


