import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ShoppingCart, Package, Users, AlertTriangle, TrendingUp, TrendingDown,
  Wallet, Plus, UserPlus, Receipt, Calendar, ArrowUpRight, Clock, Award,
} from "lucide-react";

type Trend = { value: number; up: boolean };

export default function Dashboard() {
  const { t, fmt, lang } = useT();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [stats, setStats] = useState({
    todaySales: 0, todayCount: 0, todayDue: 0, monthSales: 0,
    monthProfit: 0, pendingDue: 0, products: 0, customers: 0,
    avgSale: 0, monthlyCollected: 0,
  });
  const [trend, setTrend] = useState<{ sales: Trend; orders: Trend }>({ sales: { value: 0, up: true }, orders: { value: 0, up: true } });
  const [weekly, setWeekly] = useState<{ day: string; total: number }[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number; revenue: number }[]>([]);
  const [lowStock, setLowStock] = useState<any[]>([]);
  const [upcoming, setUpcoming] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    if (user) {
      supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle()
        .then(({ data }) => setName(data?.full_name?.split(" ")[0] ?? user.email!.split("@")[0]));
    }
  }, [user]);

  useEffect(() => { void loadAll(); }, []);

  const loadAll = async () => {
    const now = new Date();
    const today = new Date(now); today.setHours(0,0,0,0);
    const yest = new Date(today); yest.setDate(yest.getDate() - 1);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const weekStart = new Date(today); weekStart.setDate(weekStart.getDate() - 6);
    const next7 = new Date(today); next7.setDate(next7.getDate() + 7);

    const [
      salesToday, salesYest, salesMonth, salesAll, salesWeek,
      itemsMonth, items30, lowStockData, upcomingData, recentSales,
      prodCount, custCount, paymentsMonth,
    ] = await Promise.all([
      supabase.from("sales").select("total,due").gte("created_at", today.toISOString()),
      supabase.from("sales").select("total").gte("created_at", yest.toISOString()).lt("created_at", today.toISOString()),
      supabase.from("sales").select("total").gte("created_at", monthStart.toISOString()),
      supabase.from("sales").select("due"),
      supabase.from("sales").select("total,created_at").gte("created_at", weekStart.toISOString()),
      supabase.from("sale_items").select("qty,unit_price,products(cost),sales!inner(created_at)").gte("sales.created_at", monthStart.toISOString()),
      supabase.from("sale_items").select("product_name,qty,subtotal,sales!inner(created_at)").gte("sales.created_at", weekStart.toISOString()),
      supabase.from("products").select("id,name,stock,unit").lte("stock", 5).order("stock").limit(6),
      supabase.from("installments").select("id,due_date,amount,paid_amount,sales(invoice_no,customers(name,phone))")
        .neq("status", "paid").lte("due_date", next7.toISOString().slice(0,10)).order("due_date").limit(6),
      supabase.from("sales").select("id,invoice_no,total,due,created_at,payment_type,customers(name)").order("created_at", { ascending: false }).limit(6),
      supabase.from("products").select("id", { count: "exact", head: true }),
      supabase.from("customers").select("id", { count: "exact", head: true }),
      supabase.from("installment_payments").select("amount").gte("paid_at", monthStart.toISOString()),
    ]);

    const todayTotal = (salesToday.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const yestTotal = (salesYest.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const todayCount = salesToday.data?.length ?? 0;
    const yestCount = salesYest.data?.length ?? 0;
    const monthSales = (salesMonth.data ?? []).reduce((a, b) => a + Number(b.total), 0);
    const monthProfit = (itemsMonth.data ?? []).reduce((a: number, b: any) => a + (Number(b.unit_price) - Number(b.products?.cost ?? 0)) * b.qty, 0);
    const pendingDue = (salesAll.data ?? []).reduce((a, b) => a + Number(b.due), 0);
    const todayDue = (salesToday.data ?? []).reduce((a, b) => a + Number(b.due), 0);
    const monthlyCollected = (paymentsMonth.data ?? []).reduce((a, b) => a + Number(b.amount), 0);

    // Trends
    const salesTrend = yestTotal === 0 ? 100 : Math.round(((todayTotal - yestTotal) / yestTotal) * 100);
    const ordersTrend = yestCount === 0 ? 100 : Math.round(((todayCount - yestCount) / yestCount) * 100);

    // Weekly chart
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
    setWeekly(Object.entries(days).map(([date, total]) => ({
      day: dayNames[new Date(date).getDay()], total,
    })));

    // Top products
    const map = new Map<string, { qty: number; revenue: number }>();
    (items30.data ?? []).forEach((i: any) => {
      const cur = map.get(i.product_name) ?? { qty: 0, revenue: 0 };
      cur.qty += i.qty; cur.revenue += Number(i.subtotal);
      map.set(i.product_name, cur);
    });
    setTopProducts([...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.qty - a.qty).slice(0, 5));

    setLowStock(lowStockData.data ?? []);
    setUpcoming(upcomingData.data ?? []);
    setRecent(recentSales.data ?? []);
    setStats({
      todaySales: todayTotal, todayCount, todayDue,
      monthSales, monthProfit, pendingDue,
      products: prodCount.count ?? 0, customers: custCount.count ?? 0,
      avgSale: todayCount ? todayTotal / todayCount : 0,
      monthlyCollected,
    });
    setTrend({ sales: { value: Math.abs(salesTrend), up: salesTrend >= 0 }, orders: { value: Math.abs(ordersTrend), up: ordersTrend >= 0 } });
  };

  const greet = () => {
    const h = new Date().getHours();
    return h < 12 ? t("goodMorning") : h < 17 ? t("goodAfternoon") : t("goodEvening");
  };

  const maxWeek = Math.max(1, ...weekly.map(d => d.total));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <p className="text-muted-foreground text-sm">{greet()}, 👋</p>
          <h1 className="text-2xl md:text-3xl font-bold">{name || "Admin"}</h1>
          <p className="text-muted-foreground text-sm mt-1">{t("overview")}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link to="/pos"><Button className="gap-2"><ShoppingCart className="h-4 w-4" />{t("newSale")}</Button></Link>
          <Link to="/products"><Button variant="outline" className="gap-2"><Plus className="h-4 w-4" />{t("addProduct")}</Button></Link>
          <Link to="/customers"><Button variant="outline" className="gap-2"><UserPlus className="h-4 w-4" />{t("addCustomer")}</Button></Link>
          <Link to="/installments"><Button variant="outline" className="gap-2"><Wallet className="h-4 w-4" />{t("receivePayment")}</Button></Link>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          icon={ShoppingCart} label={t("todaySales")} value={fmt(stats.todaySales)}
          trend={trend.sales} trendLabel={t("vsYesterday")} gradient="from-primary to-primary-glow"
        />
        <KpiCard
          icon={Receipt} label={t("todayInvoices")} value={String(stats.todayCount)}
          trend={trend.orders} trendLabel={t("vsYesterday")} gradient="from-info to-info"
        />
        <KpiCard
          icon={TrendingUp} label={t("profit")} value={fmt(stats.monthProfit)}
          subtitle={t("salesThisMonth")} gradient="from-success to-primary"
        />
        <KpiCard
          icon={Wallet} label={t("pendingDue")} value={fmt(stats.pendingDue)}
          subtitle={`${t("monthlyDue")}: ${fmt(stats.monthlyCollected)}`} gradient="from-warning to-accent"
        />
      </div>

      {/* Mini stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MiniStat icon={Users} label={t("totalCustomers")} value={stats.customers} />
        <MiniStat icon={Package} label={t("totalProducts")} value={stats.products} />
        <MiniStat icon={Award} label={t("avgSale")} value={fmt(stats.avgSale)} />
        <MiniStat icon={AlertTriangle} label={t("lowStock")} value={lowStock.length} highlight={lowStock.length > 0} />
      </div>

      {/* Chart + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold">{t("weekSales")}</h2>
            <Link to="/reports"><Button variant="ghost" size="sm" className="gap-1">{t("viewAll")}<ArrowUpRight className="h-3 w-3" /></Button></Link>
          </div>
          <div className="flex items-end gap-2 h-48">
            {weekly.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                <div className="text-xs font-medium opacity-0 group-hover:opacity-100 transition">{fmt(d.total)}</div>
                <div className="w-full rounded-t-lg gradient-primary transition-all hover:opacity-80" style={{ height: `${Math.max(4, (d.total / maxWeek) * 100)}%` }} />
                <div className="text-xs text-muted-foreground">{d.day}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><Award className="h-4 w-4 text-primary" />{t("topProducts")}</h2>
          <div className="space-y-3">
            {topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>}
            {topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-3">
                <div className={`h-7 w-7 rounded-md flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"}`}>{i + 1}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{t("soldQty")}: {p.qty}</div>
                </div>
                <div className="text-sm font-semibold">{fmt(p.revenue)}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Low stock + Upcoming dues */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-destructive" />{t("lowStockAlerts")}</h2>
            <Link to="/products"><Button variant="ghost" size="sm">{t("viewAll")}</Button></Link>
          </div>
          <div className="space-y-2">
            {lowStock.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">✓ {lang === "bn" ? "সব ঠিক আছে" : "All good"}</p>}
            {lowStock.map(p => (
              <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/30">
                <div className="text-sm font-medium truncate flex-1">{p.name}</div>
                <Badge variant={p.stock === 0 ? "destructive" : "secondary"} className={p.stock === 0 ? "" : "bg-warning/15 text-warning hover:bg-warning/20"}>
                  {p.stock === 0 ? t("outOfStock") : `${p.stock} ${p.unit ?? ""}`}
                </Badge>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2"><Calendar className="h-4 w-4 text-info" />{t("upcomingDues")}</h2>
            <Link to="/installments"><Button variant="ghost" size="sm">{t("viewAll")}</Button></Link>
          </div>
          <div className="space-y-2">
            {upcoming.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>}
            {upcoming.map((i: any) => {
              const overdue = i.due_date < new Date().toISOString().slice(0, 10);
              return (
                <div key={i.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border/60 hover:bg-muted/30">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{i.sales?.customers?.name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />{i.due_date} • {i.sales?.invoice_no}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold">{fmt(Number(i.amount) - Number(i.paid_amount))}</div>
                    {overdue && <Badge variant="destructive" className="text-[10px] py-0">{t("overdue")}</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* Recent activity */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{t("recentActivity")}</h2>
          <Link to="/sales"><Button variant="ghost" size="sm">{t("viewAll")}</Button></Link>
        </div>
        <div className="space-y-2">
          {recent.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>}
          {recent.map((r: any) => (
            <Link to="/sales" key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/40 transition border border-border/50">
              <div className="flex items-center gap-3 min-w-0">
                <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${r.payment_type === "cash" ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                  <Receipt className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <div className="font-medium text-sm">{r.invoice_no}</div>
                  <div className="text-xs text-muted-foreground truncate">{r.customers?.name ?? t("walkInCustomer")} • {new Date(r.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}</div>
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-semibold">{fmt(Number(r.total))}</div>
                {Number(r.due) > 0 && <div className="text-xs text-warning">{t("due")}: {fmt(Number(r.due))}</div>}
              </div>
            </Link>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, trend, trendLabel, subtitle, gradient }: any) {
  return (
    <Card className="p-4 relative overflow-hidden">
      <div className="flex items-start justify-between mb-3">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        {trend && (
          <Badge variant="secondary" className={`gap-0.5 ${trend.up ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
            {trend.up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
            {trend.value}%
          </Badge>
        )}
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-xl md:text-2xl font-bold mt-0.5">{value}</div>
      {(subtitle || trendLabel) && <div className="text-[11px] text-muted-foreground mt-1 truncate">{subtitle ?? trendLabel}</div>}
    </Card>
  );
}

function MiniStat({ icon: Icon, label, value, highlight }: any) {
  return (
    <Card className={`p-3 flex items-center gap-3 ${highlight ? "border-destructive/40" : ""}`}>
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${highlight ? "bg-destructive/15 text-destructive" : "bg-muted text-muted-foreground"}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground truncate">{label}</div>
        <div className="font-semibold">{value}</div>
      </div>
    </Card>
  );
}
