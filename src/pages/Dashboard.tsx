import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import {
  Calendar, Wallet, ShoppingBag, AlertTriangle, PlusCircle, ScanLine,
  UserPlus, TrendingUp, Headset, Package,
} from "lucide-react";
import { AddProductSheet } from "@/components/AddProductSheet";
import { AddCustomerSheet } from "@/components/AddCustomerSheet";

export default function Dashboard() {
  const { t, fmt, lang } = useT();
  const [stats, setStats] = useState({
    todaySales: 0, todayCount: 0, monthSales: 0, monthProfit: 0,
    orderCount: 0, deliveredToday: 0, lowStockCount: 0,
  });
  const [weekly, setWeekly] = useState<{ day: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [salesTrend, setSalesTrend] = useState(0);
  const [productSheet, setProductSheet] = useState(false);
  const [customerSheet, setCustomerSheet] = useState(false);

  useEffect(() => { void loadAll(); }, []);

  const loadAll = async () => {
    const now = new Date();
    const today = new Date(now); today.setHours(0,0,0,0);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);

    const [salesToday, salesYest, salesMonth, salesWeek, itemsMonth, items30, lowStockData, recentSales] = await Promise.all([
      supabase.from("sales").select("total,due").gte("created_at", today.toISOString()),
      supabase.from("sales").select("total").gte("created_at", yest.toISOString()).lt("created_at", today.toISOString()),
      supabase.from("sales").select("total").gte("created_at", monthStart.toISOString()),
      supabase.from("sales").select("total,created_at").gte("created_at", weekStart.toISOString()),
      supabase.from("sale_items").select("qty,unit_price,products(cost),sales!inner(created_at)").gte("sales.created_at", monthStart.toISOString()),
      supabase.from("sale_items").select("product_name,qty,subtotal,sales!inner(created_at)").gte("sales.created_at", weekStart.toISOString()),
      supabase.from("products").select("id", { count: "exact", head: true }).lte("stock", 5),
      supabase.from("sales").select("id,invoice_no,total,due,created_at,customers(name)").order("created_at", { ascending: false }).limit(4),
    ]);

    const todayTotal = (salesToday.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const yestTotal = (salesYest.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const monthSales = (salesMonth.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const monthProfit = (itemsMonth.data ?? []).reduce((a: number, b: any) => a + (Number(b.unit_price) - Number(b.products?.cost ?? 0)) * b.qty, 0);

    setSalesTrend(yestTotal === 0 ? 100 : Math.round(((todayTotal - yestTotal) / yestTotal) * 100));

    const days: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today); d.setDate(d.getDate() - i);
      days[d.toISOString().slice(0, 10)] = 0;
    }
    (salesWeek.data ?? []).forEach(s => {
      const k = new Date(s.created_at).toISOString().slice(0, 10);
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
    setStats({
      todaySales: todayTotal, todayCount: salesToday.data?.length ?? 0,
      monthSales, monthProfit,
      orderCount: salesMonth.data?.length ?? 0,
      deliveredToday: salesToday.data?.length ?? 0,
      lowStockCount: lowStockData.count ?? 0,
    });
  };

  const maxWeek = Math.max(1, ...weekly.map(d => d.total));

  return (
    <div className="space-y-8">
      {/* Page Header + Quick Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">{t("dashboardOverview")}</h2>
          <p className="text-muted-foreground mt-1">{t("dashboardSubtitle")}</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <button onClick={() => setProductSheet(true)} className="flex items-center gap-2 bg-[hsl(var(--surface-container-lowest))] text-foreground px-5 py-3 rounded-xl font-semibold shadow-sm hover:bg-[hsl(var(--surface-container))] active:scale-95 transition-all">
            <PlusCircle className="h-5 w-5 text-primary" />
            {t("addProduct")}
          </button>
          <button onClick={() => setCustomerSheet(true)} className="flex items-center gap-2 bg-[hsl(var(--surface-container-lowest))] text-foreground px-5 py-3 rounded-xl font-semibold shadow-sm hover:bg-[hsl(var(--surface-container))] active:scale-95 transition-all">
            <UserPlus className="h-5 w-5 text-info" />
            {t("addCustomer")}
          </button>
          <Link to="/pos" className="flex items-center gap-2 gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)] hover:brightness-110 active:scale-95 transition-all">
            <ShoppingBag className="h-5 w-5" />
            {t("newSale")}
          </Link>
        </div>
      </div>

      {/* Stats Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          to="/sales"
          icon={<Calendar className="h-6 w-6 text-primary" />}
          iconBg="bg-primary/10"
          chip={`${salesTrend >= 0 ? "+" : ""}${salesTrend}%`}
          chipClass="text-primary bg-primary/10"
          label={t("todaySales")}
          value={fmt(stats.todaySales)}
          sub={t("increaseFromYesterday")}
        />
        <StatCard
          to="/reports"
          icon={<Wallet className="h-6 w-6 text-[hsl(var(--secondary-foreground))]" />}
          iconBg="bg-secondary/30"
          chip={t("monthTarget")}
          chipClass="text-[hsl(var(--secondary-foreground))] bg-secondary/30"
          label={t("totalRevenue")}
          value={fmt(stats.monthSales)}
          sub={t("monthlyProfit")}
        />
        <StatCard
          to="/sales"
          icon={<ShoppingBag className="h-6 w-6 text-info" />}
          iconBg="bg-info/10"
          chip={`${stats.todayCount} ${t("newOrders")}`}
          chipClass="text-info bg-info/10"
          label={t("orderCount")}
          value={`${stats.orderCount}`}
          sub={`${t("deliveredToday")}: ${stats.deliveredToday}`}
        />
        <Link to="/products" className="bg-secondary/20 p-6 rounded-2xl transition-all hover:-translate-y-1 border-l-4 border-secondary block">
          <div className="flex justify-between items-start mb-4">
            <div className="p-3 bg-secondary text-[hsl(var(--secondary-foreground))] rounded-xl">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <span className="text-xs font-bold text-[hsl(var(--secondary-foreground))] bg-secondary px-2 py-1 rounded">
              {t("urgent")}
            </span>
          </div>
          <p className="text-muted-foreground text-sm font-medium">{t("lowStockTitle")}</p>
          <h3 className="text-2xl font-bold mt-1 text-[hsl(var(--secondary-foreground))]">
            {String(stats.lowStockCount).padStart(2, "0")} {t("productsLow")}
          </h3>
          <p className="text-[10px] text-[hsl(var(--secondary-foreground))]/70 mt-2">{t("needsRefill")}</p>
        </Link>
      </div>

      {/* Main Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* LEFT: Chart + Transactions */}
        <div className="lg:col-span-2 space-y-8">
          {/* Weekly Chart */}
          <div className="bg-[hsl(var(--surface-container-lowest))] p-8 rounded-2xl">
            <div className="flex justify-between items-center mb-10">
              <div>
                <h3 className="text-xl font-bold text-foreground">{t("weeklySalesAnalysis")}</h3>
                <p className="text-sm text-muted-foreground">{t("last7DaysReport")}</p>
              </div>
              <select className="bg-[hsl(var(--surface-container-low))] border-none rounded-lg text-xs font-bold py-2 px-4 outline-none focus:ring-2 focus:ring-primary/20">
                <option>{t("thisWeek")}</option>
                <option>{t("lastWeek")}</option>
              </select>
            </div>
            <div className="h-64 flex items-end justify-between gap-4 relative">
              <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
                {[0,1,2,3].map(i => <div key={i} className="border-b border-[hsl(var(--surface-container-high))] w-full" />)}
              </div>
              {weekly.map((d, i) => {
                const isMax = d.total === maxWeek && d.total > 0;
                const h = Math.max(4, (d.total / maxWeek) * 100);
                return (
                  <div key={i} className={`flex-1 rounded-t-lg transition-all relative group ${
                    isMax ? "bg-primary/20 border-t-4 border-primary" : "bg-primary/10 hover:bg-primary/30"
                  }`} style={{ height: `${h}%` }}>
                    {isMax && (
                      <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] py-1 px-2 rounded whitespace-nowrap">
                        {fmt(d.total)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between mt-4 text-[10px] font-bold text-muted-foreground px-1 uppercase tracking-wider">
              {weekly.map((d, i) => <span key={i}>{d.day}</span>)}
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-[hsl(var(--surface-container-lowest))] p-8 rounded-2xl overflow-hidden">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-foreground">{t("recentTransactions")}</h3>
              <Link to="/sales" className="text-primary text-sm font-bold hover:underline">{t("viewAll")}</Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                    <th className="pb-6 font-bold">{t("date")}</th>
                    <th className="pb-6 font-bold">{t("buyerName")}</th>
                    <th className="pb-6 font-bold">{t("amount")}</th>
                    <th className="pb-6 font-bold text-right">{t("status")}</th>
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
                    const statusMap = {
                      paid: { label: t("completed"), cls: "bg-primary/10 text-primary" },
                      pending: { label: t("pending"), cls: "bg-secondary/30 text-[hsl(var(--secondary-foreground))]" },
                      partial: { label: t("partial"), cls: "bg-destructive/10 text-destructive" },
                    } as const;
                    const s = statusMap[status];
                    return (
                      <tr key={r.id} className="hover:bg-[hsl(var(--surface-container-low))] transition-colors">
                        <td className="py-4">{new Date(r.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                        <td className="py-4 font-semibold">{r.customers?.name ?? t("walkInCustomer")}</td>
                        <td className="py-4 font-bold text-foreground">{fmt(total)}</td>
                        <td className="py-4 text-right">
                          <span className={`${s.cls} text-[10px] font-black px-3 py-1 rounded-full uppercase`}>{s.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* RIGHT: Quick actions + Top selling */}
        <div className="space-y-8">
          {/* Quick Actions — dark inverse card */}
          <div className="bg-[hsl(var(--inverse-surface))] p-8 rounded-2xl text-[hsl(var(--inverse-on-surface))] shadow-xl">
            <h3 className="text-lg font-bold mb-6">{t("quickActions")}</h3>
            <div className="grid grid-cols-2 gap-4">
              <QAButton to="/pos" icon={<ScanLine className="h-7 w-7 text-[hsl(var(--primary-fixed))]" />} label={t("scan")} />
              <QAButton onClick={() => setCustomerSheet(true)} icon={<UserPlus className="h-7 w-7 text-secondary" />} label={t("newCustomerShort")} />
              <QAButton to="/reports" icon={<TrendingUp className="h-7 w-7 text-[hsl(var(--primary-fixed))]" />} label={t("reports")} />
              <QAButton to="/installments" icon={<Headset className="h-7 w-7 text-secondary" />} label={t("support")} />
            </div>
          </div>

          {/* Top Selling */}
          <div className="bg-[hsl(var(--surface-container-lowest))] p-8 rounded-2xl">
            <h3 className="text-lg font-bold text-foreground mb-6">{t("topProducts")}</h3>
            <div className="space-y-6">
              {topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>}
              {topProducts.map(p => (
                <div key={p.name} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[hsl(var(--surface-container-low))] rounded-lg flex items-center justify-center shrink-0">
                    <Package className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.qty} {t("soldQty")}</p>
                  </div>
                  <p className="text-sm font-bold text-foreground">{fmt(p.revenue)}</p>
                </div>
              ))}
            </div>
            <Link to="/products" className="mt-6 w-full inline-flex items-center justify-center text-sm font-bold text-foreground border border-[hsl(var(--surface-container-high))] py-3 rounded-xl hover:bg-[hsl(var(--surface-container-low))] transition-all">
              {t("checkInventory")}
            </Link>
          </div>
        </div>
      </div>

      <AddProductSheet open={productSheet} onOpenChange={setProductSheet} onSaved={loadAll} />
      <AddCustomerSheet open={customerSheet} onOpenChange={setCustomerSheet} onSaved={loadAll} />
    </div>
  );
}

function StatCard({ to, icon, iconBg, chip, chipClass, label, value, sub }: any) {
  return (
    <Link to={to ?? "#"} className="bg-[hsl(var(--surface-container-lowest))] p-6 rounded-2xl transition-all hover:-translate-y-1 block hover:shadow-lg">
      <div className="flex justify-between items-start mb-4">
        <div className={`p-3 ${iconBg} rounded-xl`}>{icon}</div>
        <span className={`text-xs font-bold ${chipClass} px-2 py-1 rounded`}>{chip}</span>
      </div>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <h3 className="text-2xl font-bold mt-1 text-foreground">{value}</h3>
      <p className="text-[10px] text-muted-foreground mt-2">{sub}</p>
    </Link>
  );
}

function QAButton({ to, onClick, icon, label }: any) {
  const cls = "bg-white/10 hover:bg-white/20 p-4 rounded-xl flex flex-col items-center gap-2 transition-all";
  if (onClick) {
    return (
      <button onClick={onClick} className={cls}>
        {icon}
        <span className="text-xs font-medium">{label}</span>
      </button>
    );
  }
  return (
    <Link to={to} className={cls}>
      {icon}
      <span className="text-xs font-medium">{label}</span>
    </Link>
  );
}
