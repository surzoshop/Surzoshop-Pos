import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { ShoppingCart, Package, Users, AlertTriangle, TrendingUp, Wallet } from "lucide-react";
import { Link } from "react-router-dom";

type Stats = {
  todaySales: number; todayDue: number; products: number; customers: number;
  lowStock: number; monthSales: number; pendingDue: number;
};

export default function Dashboard() {
  const { t, fmt } = useT();
  const [s, setS] = useState<Stats>({ todaySales: 0, todayDue: 0, products: 0, customers: 0, lowStock: 0, monthSales: 0, pendingDue: 0 });
  const [recent, setRecent] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const today = new Date(); today.setHours(0,0,0,0);
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);

      const [salesToday, salesMonth, allSales, prods, custs, low, recentSales] = await Promise.all([
        supabase.from("sales").select("total,due").gte("created_at", today.toISOString()),
        supabase.from("sales").select("total").gte("created_at", monthStart.toISOString()),
        supabase.from("sales").select("due"),
        supabase.from("products").select("id", { count: "exact", head: true }),
        supabase.from("customers").select("id", { count: "exact", head: true }),
        supabase.from("products").select("id", { count: "exact", head: true }).lte("stock", 5),
        supabase.from("sales").select("id,invoice_no,total,due,created_at,payment_type,customers(name)").order("created_at", { ascending: false }).limit(8),
      ]);

      setS({
        todaySales: (salesToday.data ?? []).reduce((a, b) => a + Number(b.total), 0),
        todayDue: (salesToday.data ?? []).reduce((a, b) => a + Number(b.due), 0),
        monthSales: (salesMonth.data ?? []).reduce((a, b) => a + Number(b.total), 0),
        pendingDue: (allSales.data ?? []).reduce((a, b) => a + Number(b.due), 0),
        products: prods.count ?? 0,
        customers: custs.count ?? 0,
        lowStock: low.count ?? 0,
      });
      setRecent(recentSales.data ?? []);
    })();
  }, []);

  const stats = [
    { label: t("todaySales"), value: fmt(s.todaySales), icon: ShoppingCart, color: "from-primary to-primary-glow" },
    { label: t("salesThisMonth"), value: fmt(s.monthSales), icon: TrendingUp, color: "from-info to-info" },
    { label: t("pendingDue"), value: fmt(s.pendingDue), icon: Wallet, color: "from-warning to-accent" },
    { label: t("totalProducts"), value: s.products, icon: Package, color: "from-success to-primary" },
    { label: t("totalCustomers"), value: s.customers, icon: Users, color: "from-info to-primary" },
    { label: t("lowStock"), value: s.lowStock, icon: AlertTriangle, color: "from-destructive to-warning" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">{t("dashboard")}</h1>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {stats.map(stat => (
          <Card key={stat.label} className="p-4 overflow-hidden relative">
            <div className={`h-9 w-9 rounded-lg bg-gradient-to-br ${stat.color} flex items-center justify-center mb-2`}>
              <stat.icon className="h-5 w-5 text-white" />
            </div>
            <div className="text-xs text-muted-foreground">{stat.label}</div>
            <div className="text-lg md:text-xl font-bold mt-0.5">{stat.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">{t("recentSales")}</h2>
        <div className="space-y-2">
          {recent.length === 0 && <p className="text-muted-foreground text-sm">{t("noResults")}</p>}
          {recent.map((r: any) => (
            <Link to="/sales" key={r.id} className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition border border-border/50">
              <div>
                <div className="font-medium">{r.invoice_no}</div>
                <div className="text-xs text-muted-foreground">{r.customers?.name ?? t("walkInCustomer")} • {new Date(r.created_at).toLocaleString()}</div>
              </div>
              <div className="text-right">
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
