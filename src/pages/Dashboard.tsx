import { useEffect, useMemo, useState } from "react";
import { todayBD, toBDDate } from "@/lib/datetime";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import {
  Calendar, Wallet, ShoppingBag, AlertTriangle, PlusCircle, ScanLine,
  UserPlus, TrendingUp, Headset, Package, Users, Boxes, CircleDollarSign,
  ArrowUpRight, ArrowDownRight, Archive, PackageCheck, CalendarRange,
} from "lucide-react";
import { AddProductSheet } from "@/components/AddProductSheet";
import { AddCustomerSheet } from "@/components/AddCustomerSheet";

const toMonthInput = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const toDateInput  = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function Dashboard() {
  const { t, fmt, lang } = useT();
  const [stats, setStats] = useState({
    todaySales: 0, todayCount: 0, monthSales: 0, monthProfit: 0,
    monthSalesCount: 0, deliveredToday: 0, lowStockCount: 0,
    totalProducts: 0, stockUnits: 0, stockCostValue: 0, stockSaleValue: 0,
    totalCustomers: 0, totalDue: 0,
    todayStockUnits: 0, yestStockUnits: 0,
    todaySoldQty: 0, yestSoldQty: 0,
    totalPurchases: 0,
  });
  const [weekly, setWeekly] = useState<{ day: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState(0);
  const [productSheet, setProductSheet] = useState(false);
  const [customerSheet, setCustomerSheet] = useState(false);

  // Period filters
  const [selectedMonth, setSelectedMonth] = useState<Date>(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const d = new Date(); d.setHours(0, 0, 0, 0); return d;
  });
  const [weeklyMonth, setWeeklyMonth] = useState<Date>(() => {
    const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const isCurrentMonth = useMemo(() => {
    const n = new Date();
    return selectedMonth.getFullYear() === n.getFullYear() && selectedMonth.getMonth() === n.getMonth();
  }, [selectedMonth]);
  const isToday = useMemo(() => {
    const n = new Date(); n.setHours(0, 0, 0, 0);
    return selectedDate.getTime() === n.getTime();
  }, [selectedDate]);

  useEffect(() => { void loadAll(); }, [selectedMonth, selectedDate, weeklyMonth]);

  const loadAll = async () => {
    const dayStart = new Date(selectedDate); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart); dayEnd.setDate(dayEnd.getDate() + 1);
    const prevDay = new Date(dayStart); prevDay.setDate(prevDay.getDate() - 1);

    const monthStart = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth(), 1);
    const monthEnd = new Date(selectedMonth.getFullYear(), selectedMonth.getMonth() + 1, 1);

    const wMonthStart = new Date(weeklyMonth.getFullYear(), weeklyMonth.getMonth(), 1);
    const wMonthEnd = new Date(weeklyMonth.getFullYear(), weeklyMonth.getMonth() + 1, 1);

    const [salesToday, salesYest, salesMonth, salesWeek, itemsMonth, items30, lowStockData, recentSales, productsAll, customersCount, duesData, soldTodayData, soldYestData, purchasedTodayData, purchasesAllData] = await Promise.all([
      supabase.from("sales").select("total,due").gte("created_at", dayStart.toISOString()).lt("created_at", dayEnd.toISOString()),
      supabase.from("sales").select("total").gte("created_at", prevDay.toISOString()).lt("created_at", dayStart.toISOString()),
      supabase.from("sales").select("total").gte("created_at", monthStart.toISOString()).lt("created_at", monthEnd.toISOString()),
      supabase.from("sales").select("total,created_at").gte("created_at", wMonthStart.toISOString()).lt("created_at", wMonthEnd.toISOString()),
      supabase.from("sale_items").select("qty,unit_price,products(cost),sales!inner(created_at)").gte("sales.created_at", monthStart.toISOString()).lt("sales.created_at", monthEnd.toISOString()),
      supabase.from("sale_items").select("product_name,qty,subtotal,sales!inner(created_at)").gte("sales.created_at", monthStart.toISOString()).lt("sales.created_at", monthEnd.toISOString()),
      supabase.from("products").select("id", { count: "exact", head: true }).lte("stock", 5),
      supabase.from("sales").select("id,invoice_no,total,due,created_at,customers(name)").order("created_at", { ascending: false }).limit(4),
      supabase.from("products").select("stock,cost,price", { count: "exact" }).eq("is_active", true),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("sales").select("due").gt("due", 0),
      supabase.from("sale_items").select("qty,sales!inner(created_at)").gte("sales.created_at", dayStart.toISOString()).lt("sales.created_at", dayEnd.toISOString()),
      supabase.from("sale_items").select("qty,sales!inner(created_at)").gte("sales.created_at", prevDay.toISOString()).lt("sales.created_at", dayStart.toISOString()),
      supabase.from("purchase_items").select("qty,purchases!inner(created_at)").gte("purchases.created_at", dayStart.toISOString()).lt("purchases.created_at", dayEnd.toISOString()),
      supabase.from("purchases").select("total"),
    ]);

    const todayTotal = (salesToday.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const yestTotal = (salesYest.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const monthSales = (salesMonth.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const monthProfit = (itemsMonth.data ?? []).reduce((a: number, b: any) => a + (Number(b.unit_price) - Number(b.products?.cost ?? 0)) * b.qty, 0);

    setSalesTrend(yestTotal === 0 ? 100 : Math.round(((todayTotal - yestTotal) / yestTotal) * 100));

    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      days[toBDDate(d)] = 0;
    }
    (salesWeek.data ?? []).forEach(s => {
      const k = toBDDate(s.created_at);
      if (k in days) days[k] += Number(s.total);
    });
    const dayNames = lang === "bn"
      ? ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"]
      : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    setWeekly(Object.entries(days).map(([date, total]) => ({ day: dayNames[new Date(date).getDay()], total })));

    const map = new Map<string, { qty: number; revenue: number }>();
    (items30.data ?? []).forEach((i: any) => {
      const cur = map.get(i.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += i.qty; cur.revenue += Number(i.subtotal);
      map.set(i.product_name, cur);
    });
    setTopProducts([...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 3));
    setRecent(recentSales.data ?? []);
    const productsArr = (productsAll.data ?? []) as any[];
    const stockUnits = productsArr.reduce((a, p) => a + Number(p.stock), 0);
    const stockCostValue = productsArr.reduce((a, p) => a + Number(p.stock) * Number(p.cost), 0);
    const stockSaleValue = productsArr.reduce((a, p) => a + Number(p.stock) * Number(p.price), 0);
    const totalDue = (duesData.data ?? []).reduce((a: number, d: any) => a + Number(d.due), 0);
    const todaySoldQty = (soldTodayData.data ?? []).reduce((a: number, b: any) => a + Number(b.qty), 0);
    const yestSoldQty = (soldYestData.data ?? []).reduce((a: number, b: any) => a + Number(b.qty), 0);
    const purchasedTodayQty = (purchasedTodayData.data ?? []).reduce((a: number, b: any) => a + Number(b.qty), 0);
    const totalPurchases = (purchasesAllData.data ?? []).reduce((a: number, b: any) => a + Number(b.total || 0), 0);
    // আজকের সকাল = বর্তমান stock + আজ বিক্রি − আজ ক্রয়
    const yestStockUnits = stockUnits + todaySoldQty - purchasedTodayQty;
    setStats({
      todaySales: todayTotal, todayCount: salesToday.data?.length ?? 0,
      monthSales, monthProfit,
      monthSalesCount: salesMonth.data?.length ?? 0,
      deliveredToday: salesToday.data?.length ?? 0,
      lowStockCount: lowStockData.count ?? 0,
      totalProducts: productsAll.count ?? 0,
      stockUnits, stockCostValue, stockSaleValue,
      totalCustomers: customersCount.count ?? 0,
      totalDue,
      todayStockUnits: stockUnits, yestStockUnits,
      todaySoldQty, yestSoldQty,
      totalPurchases,
    });
  };

  const maxWeek = Math.max(1, ...weekly.map(d => d.total));

  return (
    <div className="space-y-5 md:space-y-8">
      {/* Page Header + Quick Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 lg:gap-6">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-foreground">{t("dashboardOverview")}</h2>
          <p className="text-muted-foreground text-sm mt-1">{t("dashboardSubtitle")}</p>
        </div>
        <div className="grid grid-cols-2 lg:flex gap-2.5 md:gap-3 w-full lg:w-auto">
          {/* Add Product — subtle */}
          <button
            onClick={() => setProductSheet(true)}
            className="group flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold text-xs md:text-sm
              bg-[hsl(var(--surface-container-lowest))] text-foreground border border-[hsl(var(--border))]
              hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--surface-container-low))]
              transition-all duration-200"
          >
            <PlusCircle className="h-4 w-4 text-[hsl(var(--primary))] transition-transform duration-300 group-hover:rotate-90" />
            <span className="truncate">{t("addProduct")}</span>
          </button>

          {/* Add Customer — subtle */}
          <button
            onClick={() => setCustomerSheet(true)}
            className="group flex items-center justify-center gap-2 px-4 md:px-5 py-2.5 md:py-3 rounded-xl font-semibold text-xs md:text-sm
              bg-[hsl(var(--surface-container-lowest))] text-foreground border border-[hsl(var(--border))]
              hover:border-[hsl(var(--primary)/0.4)] hover:bg-[hsl(var(--surface-container-low))]
              transition-all duration-200"
          >
            <UserPlus className="h-4 w-4 text-[hsl(var(--primary))] transition-transform duration-300 group-hover:scale-110" />
            <span className="truncate">{t("addCustomer")}</span>
          </button>

          {/* New Sale — Primary CTA */}
          <Link
            to="/pos"
            className="group col-span-2 flex items-center justify-center gap-2 px-5 md:px-6 py-2.5 md:py-3 rounded-xl font-bold text-xs md:text-sm
              bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border border-[hsl(var(--primary))]
              shadow-[var(--shadow-primary)] hover:opacity-95 hover:-translate-y-0.5 active:translate-y-0
              transition-all duration-200"
          >
            <ShoppingBag className="h-4 w-4 md:h-5 md:w-5 transition-transform duration-300 group-hover:scale-110" />
            <span>{t("newSale")}</span>
          </Link>
        </div>
      </div>

      {/* Stats Bento Grid — colorful */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-5">
        <ColorStatCard
          to="/sales" theme="emerald" icon={<Calendar />}
          chip={`${salesTrend >= 0 ? "+" : ""}${salesTrend}%`}
          label={t("todaySales")} value={fmt(stats.todaySales)} sub={t("increaseFromYesterday")}
        />
        <ColorStatCard
          to="/reports" theme="violet" icon={<Wallet />}
          chip={t("monthTarget")}
          label="মোট বিক্রয়" value={fmt(stats.monthSales)} sub="এই মাসের মোট বিক্রয়"
        />
        <ColorStatCard
          to="/sales" theme="sky" icon={<ShoppingBag />}
          chip={`${stats.todayCount} আজ`}
          label="মাসিক বিক্রয় সংখ্যা" value={`${stats.monthSalesCount}`} sub={`আজকের বিক্রয়: ${stats.deliveredToday}`}
        />
        <ColorStatCard
          to="/products" theme="amber" icon={<AlertTriangle />}
          chip={t("urgent")}
          label={t("lowStockTitle")}
          value={`${String(stats.lowStockCount).padStart(2, "0")} ${t("productsLow")}`}
          sub={t("needsRefill")}
        />
        <ColorStatCard
          to="/products" theme="indigo" icon={<Boxes />}
          chip={t("info")}
          label={t("totalProducts")} value={`${stats.totalProducts}`} sub={t("activeItems")}
        />
        <ColorStatCard
          to="/products" theme="teal" icon={<Package />}
          chip={t("live")}
          label="মোট স্টক" value={`${stats.stockUnits}`} sub="ইউনিট"
        />
        <ColorStatCard
          to="/customers" theme="pink" icon={<Users />}
          chip={t("growth")}
          label={t("totalCustomers")} value={`${stats.totalCustomers}`} sub={t("registeredBuyers")}
        />
        <ColorStatCard
          to="/products" theme="rose" icon={<CircleDollarSign />}
          chip={t("info")}
          label="স্টক বিক্রয় মূল্য" value={fmt(stats.stockSaleValue)} sub="বর্তমান স্টক × বিক্রয়মূল্য"
        />
      </div>

      {/* Mini stat row — secondary metrics with explanations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 md:gap-3">
        <MiniStat
          to="/products" theme="teal" icon={<Package className="h-4 w-4" />}
          label="স্টক ক্রয় মূল্য" value={fmt(stats.stockCostValue)}
          hint="বর্তমান স্টক × ক্রয়মূল্য"
        />
        <MiniStat
          to="/ledger" theme="emerald" icon={<ShoppingBag className="h-4 w-4" />}
          label="মোট ক্রয় মূল্য" value={fmt(stats.totalPurchases)}
          hint="সকল ক্রয়ের যোগফল (lifetime)"
        />
        <MiniStat
          to="/reports" theme="violet" icon={<TrendingUp className="h-4 w-4" />}
          label="মাসিক লাভ" value={fmt(stats.monthProfit)}
          hint="এ মাসে: বিক্রয় − ক্রয়মূল্য"
        />
        <MiniStat
          to="/ledger" theme="amber" icon={<AlertTriangle className="h-4 w-4" />}
          label="মূল্য পার্থক্য" value={fmt(Math.max(0, stats.totalPurchases - stats.stockCostValue))}
          hint="বিক্রিত পণ্যের ক্রয়মূল্য (COGS)"
        />
      </div>

      {/* Explanation card — why the difference */}
      <div className="bg-[hsl(var(--surface-container-lowest))] border border-amber-500/30 rounded-2xl p-4 md:p-5">
        <div className="flex items-start gap-3">
          <div className="h-9 w-9 shrink-0 rounded-lg bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow shadow-amber-500/30">
            <AlertTriangle className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm md:text-base font-bold text-foreground font-bn">পার্থক্যের কারণ — কেন মোট ক্রয় ও স্টক ক্রয়মূল্য আলাদা?</h4>
            <p className="text-[12px] md:text-[13px] text-muted-foreground mt-1 font-bn leading-relaxed">
              <b className="text-foreground">মোট ক্রয় মূল্য</b> = এখন পর্যন্ত সব ক্রয়ের যোগফল (বিক্রি হয়ে গেলেও কমে না)। <br/>
              <b className="text-foreground">স্টক ক্রয় মূল্য</b> = বর্তমানে দোকানে যা স্টক আছে শুধু তার ক্রয়মূল্য। <br/>
              <b className="text-foreground">পার্থক্য ({fmt(Math.max(0, stats.totalPurchases - stats.stockCostValue))})</b> = ইতিমধ্যে যেসব পণ্য বিক্রি হয়ে গেছে তাদের ক্রয়মূল্য (COGS)। <br/>
              <span className="text-[11px]">⚠️ নোট: পণ্যের ক্রয়মূল্য আপডেট হলে পুরনো ক্রয়ের হিস্ট্রিও আপডেট হয়ে যায়, তাই কিছু ক্ষেত্রে সামান্য বেশি/কম দেখাতে পারে।</span>
            </p>
          </div>
        </div>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 md:gap-8">
        {/* LEFT: Chart + Transactions */}
        <div className="lg:col-span-2 space-y-5 md:space-y-8">
          {/* Weekly Chart — minimal */}
          <div className="bg-[hsl(var(--surface-container-lowest))] p-4 md:p-8 rounded-2xl border border-[hsl(var(--border))]">
            <div className="flex justify-between items-center mb-6 md:mb-10">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-[hsl(var(--primary)/0.1)] flex items-center justify-center">
                  <TrendingUp className="h-5 w-5 text-[hsl(var(--primary))]" />
                </div>
                <div>
                  <h3 className="text-base md:text-xl font-bold text-foreground">{t("weeklySalesAnalysis")}</h3>
                  <p className="text-xs md:text-sm text-muted-foreground">{t("last7DaysReport")}</p>
                </div>
              </div>
              <select className="bg-[hsl(var(--surface-container-low))] border border-[hsl(var(--border))] rounded-lg text-[11px] md:text-xs font-semibold py-1.5 md:py-2 px-3 md:px-4 outline-none focus:ring-2 focus:ring-[hsl(var(--primary)/0.3)] cursor-pointer">
                <option>{t("thisWeek")}</option>
                <option>{t("lastWeek")}</option>
              </select>
            </div>

            <div className="relative h-44 md:h-64 flex items-end justify-between gap-2 md:gap-4">
              <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                {[0,1,2,3].map(i => <div key={i} className="border-b border-dashed border-[hsl(var(--border))] w-full" />)}
              </div>
              {weekly.map((d, i) => {
                const isMax = d.total === maxWeek && d.total > 0;
                const h = Math.max(4, (d.total / maxWeek) * 100);
                return (
                  <div key={i} className="flex-1 h-full flex items-end relative group/bar">
                    <div
                      style={{ height: `${h}%`, animation: `growUp 0.7s ${i * 0.06}s ease-out backwards` }}
                      className={`w-full rounded-t-lg transition-all duration-300 cursor-pointer relative
                        ${isMax
                          ? "bg-[hsl(var(--primary))]"
                          : "bg-[hsl(var(--primary)/0.18)] hover:bg-[hsl(var(--primary)/0.35)]"
                        }`}
                    >
                      <div className="absolute -top-9 left-1/2 -translate-x-1/2 opacity-0 group-hover/bar:opacity-100 transition-opacity bg-foreground text-background text-[10px] font-bold py-1 px-2 rounded-md whitespace-nowrap shadow-lg">
                        {fmt(d.total)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-semibold text-muted-foreground px-1 uppercase tracking-wider">
              {weekly.map((d, i) => <span key={i} className={d.total === maxWeek && d.total > 0 ? "text-[hsl(var(--primary))]" : ""}>{d.day}</span>)}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-[hsl(var(--surface-container-lowest))] p-4 md:p-8 rounded-2xl border border-[hsl(var(--surface-container-high))]/40 overflow-hidden">
            <div className="flex justify-between items-center mb-4 md:mb-6">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-sky-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-sky-500/30">
                  <ShoppingBag className="h-5 w-5 text-white" />
                </div>
                <h3 className="text-base md:text-xl font-bold text-foreground">{t("recentTransactions")}</h3>
              </div>
              <Link to="/sales" className="group inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 text-xs md:text-sm font-bold hover:gap-2 transition-all">
                {t("viewAll")} <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </Link>
            </div>

            {/* Mobile: cards */}
            <div className="md:hidden space-y-2">
              {recent.length === 0 && <div className="py-8 text-center text-muted-foreground text-sm">{t("noResults")}</div>}
              {recent.map((r: any) => {
                const due = Number(r.due);
                const total = Number(r.total);
                const status = due === 0 ? "paid" : due === total ? "pending" : "partial";
                const sm = {
                  paid: { label: t("completed"), cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
                  pending: { label: t("pending"), cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
                  partial: { label: t("partial"), cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
                } as const;
                const s = sm[status];
                return (
                  <div key={r.id} className="bg-[hsl(var(--surface-container-low))] p-3 rounded-xl flex items-center justify-between gap-2 border border-transparent hover:border-sky-500/30 transition-all">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate">{r.customers?.name ?? t("walkInCustomer")}</p>
                      <p className="text-[11px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-sm">{fmt(total)}</p>
                      <span className={`${s.cls} text-[9px] font-black px-2 py-0.5 rounded-full uppercase border`}>{s.label}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop: table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-[hsl(var(--surface-container-high))]/40">
                    <th className="pb-4 font-bold">{t("date")}</th>
                    <th className="pb-4 font-bold">{t("buyerName")}</th>
                    <th className="pb-4 font-bold">{t("amount")}</th>
                    <th className="pb-4 font-bold text-right">{t("status")}</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {recent.length === 0 && (
                    <tr><td colSpan={4} className="py-8 text-center text-muted-foreground">{t("noResults")}</td></tr>
                  )}
                  {recent.map((r: any) => {
                    const due = Number(r.due);
                    const total = Number(r.total);
                    const status = due === 0 ? "paid" : due === total ? "pending" : "partial";
                    const sm = {
                      paid: { label: t("completed"), cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
                      pending: { label: t("pending"), cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
                      partial: { label: t("partial"), cls: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30" },
                    } as const;
                    const s = sm[status];
                    return (
                      <tr key={r.id} className="hover:bg-[hsl(var(--surface-container-low))] transition-colors border-b border-[hsl(var(--surface-container-high))]/20 last:border-0">
                        <td className="py-4">{new Date(r.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</td>
                        <td className="py-4 font-semibold">{r.customers?.name ?? t("walkInCustomer")}</td>
                        <td className="py-4 font-bold text-foreground">{fmt(total)}</td>
                        <td className="py-4 text-right">
                          <span className={`${s.cls} text-[10px] font-black px-3 py-1 rounded-full uppercase border`}>{s.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Daily comparison + Quick actions + Top selling */}
        <div className="space-y-5 md:space-y-8">
          {/* Daily Stock & Sales Comparison */}
          <DailyComparison
            todayStock={stats.todayStockUnits}
            yestStock={stats.yestStockUnits}
            todaySold={stats.todaySoldQty}
            yestSold={stats.yestSoldQty}
            lang={lang}
          />

          {/* Quick Actions — colorful tiles */}
          <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 dark:from-[hsl(var(--inverse-surface))] dark:via-[hsl(var(--inverse-surface))] dark:to-[hsl(var(--inverse-surface))] p-5 md:p-8 rounded-2xl text-white shadow-xl overflow-hidden">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
            <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />
            <h3 className="relative text-base md:text-lg font-bold mb-4 md:mb-6 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52,211,153)] animate-pulse" />
              {t("quickActions")}
            </h3>
            <div className="relative grid grid-cols-4 lg:grid-cols-2 gap-3 md:gap-4">
              <QAButton to="/pos" tone="emerald" icon={<ScanLine className="h-6 w-6 md:h-7 md:w-7" />} label={t("scan")} />
              <QAButton onClick={() => setCustomerSheet(true)} tone="sky" icon={<UserPlus className="h-6 w-6 md:h-7 md:w-7" />} label={t("newCustomerShort")} />
              <QAButton to="/reports" tone="amber" icon={<TrendingUp className="h-6 w-6 md:h-7 md:w-7" />} label={t("reports")} />
              <QAButton to="/installments" tone="fuchsia" icon={<Headset className="h-6 w-6 md:h-7 md:w-7" />} label={t("support")} />
            </div>
          </div>

          {/* Top Selling */}
          <div className="bg-[hsl(var(--surface-container-lowest))] p-5 md:p-8 rounded-2xl border border-[hsl(var(--surface-container-high))]/40">
            <div className="flex items-center gap-3 mb-4 md:mb-6">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
                <Package className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base md:text-lg font-bold text-foreground">{t("topProducts")}</h3>
            </div>
            <div className="space-y-3 md:space-y-4">
              {topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>}
              {topProducts.map((p, i) => {
                const tones = [
                  "from-amber-500 to-orange-500 shadow-amber-500/30",
                  "from-sky-500 to-cyan-500 shadow-sky-500/30",
                  "from-emerald-500 to-teal-500 shadow-emerald-500/30",
                ];
                return (
                  <div key={p.name} className="group flex items-center gap-3 p-2 rounded-xl hover:bg-[hsl(var(--surface-container-low))] transition-all">
                    <div className={`relative w-11 h-11 bg-gradient-to-br ${tones[i] ?? tones[0]} rounded-xl flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                      <Package className="h-5 w-5 text-white" />
                      <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} {t("soldQty")}</p>
                    </div>
                    <p className="text-sm font-bold text-foreground">{fmt(p.revenue)}</p>
                  </div>
                );
              })}
            </div>
            <Link to="/products" className="group mt-6 w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-foreground border border-[hsl(var(--surface-container-high))] py-3 rounded-xl hover:bg-[hsl(var(--surface-container-low))] hover:border-amber-500/40 transition-all">
              {t("checkInventory")}
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </div>
      </div>

      <AddProductSheet open={productSheet} onOpenChange={setProductSheet} onSaved={loadAll} />
      <AddCustomerSheet open={customerSheet} onOpenChange={setCustomerSheet} onSaved={loadAll} />
    </div>
  );
}

const THEMES: Record<string, { iconGrad: string; iconShadow: string; chip: string; accent: string; bar: string; valueText: string }> = {
  emerald: { iconGrad: "bg-gradient-to-br from-emerald-400 to-emerald-600", iconShadow: "shadow-emerald-500/40 group-hover:shadow-emerald-500/60", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", accent: "hover:border-emerald-500/50", bar: "bg-gradient-to-b from-emerald-400 to-emerald-600", valueText: "group-hover:text-emerald-700 dark:group-hover:text-emerald-300" },
  violet:  { iconGrad: "bg-gradient-to-br from-violet-400 to-violet-600",   iconShadow: "shadow-violet-500/40 group-hover:shadow-violet-500/60",   chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300",   accent: "hover:border-violet-500/50",  bar: "bg-gradient-to-b from-violet-400 to-violet-600",   valueText: "group-hover:text-violet-700 dark:group-hover:text-violet-300" },
  sky:     { iconGrad: "bg-gradient-to-br from-sky-400 to-sky-600",         iconShadow: "shadow-sky-500/40 group-hover:shadow-sky-500/60",         chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",            accent: "hover:border-sky-500/50",     bar: "bg-gradient-to-b from-sky-400 to-sky-600",         valueText: "group-hover:text-sky-700 dark:group-hover:text-sky-300" },
  amber:   { iconGrad: "bg-gradient-to-br from-amber-400 to-orange-500",    iconShadow: "shadow-amber-500/40 group-hover:shadow-amber-500/60",     chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",      accent: "hover:border-amber-500/50",   bar: "bg-gradient-to-b from-amber-400 to-orange-500",    valueText: "group-hover:text-amber-700 dark:group-hover:text-amber-300" },
  indigo:  { iconGrad: "bg-gradient-to-br from-indigo-400 to-indigo-600",   iconShadow: "shadow-indigo-500/40 group-hover:shadow-indigo-500/60",   chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",   accent: "hover:border-indigo-500/50",  bar: "bg-gradient-to-b from-indigo-400 to-indigo-600",   valueText: "group-hover:text-indigo-700 dark:group-hover:text-indigo-300" },
  teal:    { iconGrad: "bg-gradient-to-br from-teal-400 to-teal-600",       iconShadow: "shadow-teal-500/40 group-hover:shadow-teal-500/60",       chip: "bg-teal-500/10 text-teal-700 dark:text-teal-300",         accent: "hover:border-teal-500/50",    bar: "bg-gradient-to-b from-teal-400 to-teal-600",       valueText: "group-hover:text-teal-700 dark:group-hover:text-teal-300" },
  pink:    { iconGrad: "bg-gradient-to-br from-pink-400 to-fuchsia-600",    iconShadow: "shadow-pink-500/40 group-hover:shadow-pink-500/60",       chip: "bg-pink-500/10 text-pink-700 dark:text-pink-300",         accent: "hover:border-pink-500/50",    bar: "bg-gradient-to-b from-pink-400 to-fuchsia-600",    valueText: "group-hover:text-pink-700 dark:group-hover:text-pink-300" },
  rose:    { iconGrad: "bg-gradient-to-br from-rose-400 to-red-600",        iconShadow: "shadow-rose-500/40 group-hover:shadow-rose-500/60",       chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300",         accent: "hover:border-rose-500/50",    bar: "bg-gradient-to-b from-rose-400 to-red-600",        valueText: "group-hover:text-rose-700 dark:group-hover:text-rose-300" },
};

function ColorStatCard({ to, theme, icon, chip, label, value, sub }: any) {
  const T = THEMES[theme] ?? THEMES.violet;
  return (
    <Link
      to={to ?? "#"}
      className={`group relative overflow-hidden bg-[hsl(var(--surface-container-lowest))] p-3 md:p-5 pl-4 md:pl-6 rounded-2xl block border border-[hsl(var(--border))] ${T.accent}
        hover:shadow-lg hover:-translate-y-1 active:translate-y-0 active:scale-[0.98] transition-all duration-300 ease-out`}
    >
      {/* Side accent bar */}
      <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${T.bar} opacity-80 group-hover:opacity-100 group-hover:top-0 group-hover:bottom-0 transition-all duration-300`} />

      <div className="relative flex justify-between items-start mb-3 md:mb-4">
        <div className={`h-9 w-9 md:h-11 md:w-11 ${T.iconGrad} text-white rounded-xl flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4 md:[&>svg]:h-5 md:[&>svg]:w-5 shadow-lg ${T.iconShadow} transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 group-active:rotate-0 group-active:scale-95`}>
          {icon}
        </div>
        <span className={`text-[9px] md:text-[10px] font-bold ${T.chip} px-1.5 md:px-2 py-0.5 md:py-1 rounded-full uppercase tracking-wider whitespace-nowrap`}>{chip}</span>
      </div>
      <p className="relative text-foreground/85 text-[13px] md:text-xs font-extrabold md:font-bold truncate uppercase tracking-wide font-bn">{label}</p>
      <h3 className={`relative text-xl md:text-2xl font-black md:font-extrabold mt-1 text-foreground truncate font-bn transition-colors duration-300 ${T.valueText}`}>{value}</h3>
      <p className="relative text-[11px] md:text-[11px] text-muted-foreground font-bold md:font-semibold mt-1 md:mt-2 truncate font-bn">{sub}</p>
    </Link>
  );
}

const QA_TONES: Record<string, string> = {
  emerald: "from-emerald-500/30 to-emerald-500/10 hover:from-emerald-500/50 hover:to-emerald-500/20 border-emerald-400/20 hover:border-emerald-400/50 hover:shadow-emerald-500/30",
  sky:     "from-sky-500/30 to-sky-500/10 hover:from-sky-500/50 hover:to-sky-500/20 border-sky-400/20 hover:border-sky-400/50 hover:shadow-sky-500/30",
  amber:   "from-amber-500/30 to-amber-500/10 hover:from-amber-500/50 hover:to-amber-500/20 border-amber-400/20 hover:border-amber-400/50 hover:shadow-amber-500/30",
  fuchsia: "from-fuchsia-500/30 to-fuchsia-500/10 hover:from-fuchsia-500/50 hover:to-fuchsia-500/20 border-fuchsia-400/20 hover:border-fuchsia-400/50 hover:shadow-fuchsia-500/30",
};
const QA_ICON: Record<string, string> = {
  emerald: "text-emerald-300",
  sky: "text-sky-300",
  amber: "text-amber-300",
  fuchsia: "text-fuchsia-300",
};

function QAButton({ to, onClick, icon, label, tone = "emerald" }: any) {
  const t = QA_TONES[tone] ?? QA_TONES.emerald;
  const cls = `group relative overflow-hidden bg-gradient-to-br ${t} p-3 md:p-4 rounded-xl flex flex-col items-center gap-1.5 md:gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 border`;
  const inner = (
    <>
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className={`relative transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${QA_ICON[tone] ?? QA_ICON.emerald}`}>{icon}</div>
      <span className="relative text-[10px] md:text-xs font-bold text-center leading-tight text-white/90">{label}</span>
    </>
  );
  if (onClick) return <button onClick={onClick} className={cls}>{inner}</button>;
  return <Link to={to} className={cls}>{inner}</Link>;
}

function MiniStat({ to, theme, icon, label, value, hint }: any) {
  const T = THEMES[theme] ?? THEMES.violet;
  return (
    <Link
      to={to ?? "#"}
      className={`group flex items-start gap-2.5 bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--border))] ${T.accent} rounded-xl px-3 py-2.5 hover:-translate-y-0.5 hover:shadow-md transition-all duration-200`}
    >
      <div className={`h-8 w-8 shrink-0 ${T.iconGrad} text-white rounded-lg flex items-center justify-center shadow ${T.iconShadow}`}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate font-bn">{label}</p>
        <p className={`text-sm md:text-base font-extrabold text-foreground truncate font-bn ${T.valueText} transition-colors`}>{value}</p>
        {hint && <p className="text-[10px] text-muted-foreground font-semibold mt-0.5 truncate font-bn">{hint}</p>}
      </div>
    </Link>
  );
}

function DailyComparison({ todayStock, yestStock, todaySold, yestSold, lang }: any) {
  const fmtN = (n: number) => new Intl.NumberFormat(lang === "bn" ? "bn-BD" : "en-US").format(Math.max(0, Math.round(n)));
  const stockDiff = todayStock - yestStock;
  const soldDiff = todaySold - yestSold;
  const cells = [
    { label: "গতকালের স্টক", value: fmtN(yestStock), tone: "indigo", icon: <Archive className="h-4 w-4" /> },
    { label: "আজকের স্টক",   value: fmtN(todayStock), tone: "teal",  icon: <Boxes className="h-4 w-4" />, diff: stockDiff },
    { label: "গতকাল বিক্রি", value: fmtN(yestSold),   tone: "amber", icon: <PackageCheck className="h-4 w-4" /> },
    { label: "আজ বিক্রি",     value: fmtN(todaySold),  tone: "emerald", icon: <ShoppingBag className="h-4 w-4" />, diff: soldDiff },
  ];
  const toneMap: Record<string, { grad: string; shadow: string; ring: string; bg: string }> = {
    indigo:  { grad: "from-indigo-400 to-indigo-600",  shadow: "shadow-indigo-500/30",  ring: "border-indigo-500/20",  bg: "bg-indigo-500/5" },
    teal:    { grad: "from-teal-400 to-teal-600",      shadow: "shadow-teal-500/30",    ring: "border-teal-500/20",    bg: "bg-teal-500/5" },
    amber:   { grad: "from-amber-400 to-orange-500",   shadow: "shadow-amber-500/30",   ring: "border-amber-500/20",   bg: "bg-amber-500/5" },
    emerald: { grad: "from-emerald-400 to-emerald-600",shadow: "shadow-emerald-500/30", ring: "border-emerald-500/20", bg: "bg-emerald-500/5" },
  };
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-5 md:p-6 rounded-2xl border border-[hsl(var(--surface-container-high))]/40">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
          <TrendingUp className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="text-base md:text-lg font-bold text-foreground">আজ বনাম গতকাল</h3>
          <p className="text-[11px] text-muted-foreground">স্টক ও বিক্রয় তুলনা</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {cells.map((c, i) => {
          const T = toneMap[c.tone];
          const diff = c.diff;
          const up = diff !== undefined && diff > 0;
          const down = diff !== undefined && diff < 0;
          return (
            <div key={i} className={`relative ${T.bg} border ${T.ring} rounded-xl p-3 flex flex-col gap-1.5 hover:-translate-y-0.5 transition-all`}>
              <div className="flex items-center justify-between gap-2">
                <div className={`h-8 w-8 bg-gradient-to-br ${T.grad} text-white rounded-lg flex items-center justify-center shadow ${T.shadow}`}>
                  {c.icon}
                </div>
                {diff !== undefined && diff !== 0 && (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${up ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" : "bg-rose-500/15 text-rose-600 dark:text-rose-400"}`}>
                    {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                    {fmtN(Math.abs(diff))}
                  </span>
                )}
              </div>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider truncate font-bn">{c.label}</p>
              <p className="text-lg md:text-xl font-black text-foreground truncate font-bn">{c.value}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
