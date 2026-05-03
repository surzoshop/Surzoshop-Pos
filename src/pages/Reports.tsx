import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { TrendingUp, Wallet, Receipt, Package } from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";

export default function Reports() {
  const { t, fmt, lang } = useT();
  const [data, setData] = useState({ totalSales: 0, totalDue: 0, count: 0, profit: 0, daily: [] as { date: string; total: number }[], topProducts: [] as any[] });

  useEffect(() => {
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const { data: sales } = await supabase.from("sales").select("total,due,created_at").gte("created_at", monthStart.toISOString());
      const { data: items } = await supabase.from("sale_items")
        .select("product_name,qty,subtotal,unit_price,products(cost),sales!inner(created_at)")
        .gte("sales.created_at", monthStart.toISOString());

      const totalSales = (sales ?? []).reduce((a, b) => a + Number(b.total), 0);
      const totalDue = (sales ?? []).reduce((a, b) => a + Number(b.due), 0);
      const profit = (items ?? []).reduce((a: number, b: any) => a + (Number(b.unit_price) - Number(b.products?.cost ?? 0)) * b.qty, 0);

      const grouped: Record<string, number> = {};
      (sales ?? []).forEach(s => {
        const d = new Date(s.created_at).toISOString().slice(0, 10);
        grouped[d] = (grouped[d] ?? 0) + Number(s.total);
      });
      const daily = Object.entries(grouped).map(([date, total]) => ({ date, total })).sort((a, b) => a.date.localeCompare(b.date));

      const map = new Map<string, { qty: number; revenue: number }>();
      (items ?? []).forEach((i: any) => {
        const cur = map.get(i.product_name) ?? { qty: 0, revenue: 0 };
        cur.qty += i.qty; cur.revenue += Number(i.subtotal);
        map.set(i.product_name, cur);
      });
      const topProducts = [...map.entries()].map(([name, v]) => ({ name, ...v })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

      setData({ totalSales, totalDue, count: sales?.length ?? 0, profit, daily, topProducts });
    })();
  }, []);

  const max = Math.max(1, ...data.daily.map(d => d.total));

  const stats = [
    { label: t("totalRevenue"), value: fmt(data.totalSales), icon: TrendingUp, bg: "bg-primary/10", color: "text-primary" },
    { label: t("profit"), value: fmt(data.profit), icon: Wallet, bg: "bg-info/10", color: "text-info" },
    { label: t("pendingDue"), value: fmt(data.totalDue), icon: Receipt, bg: "bg-secondary/30", color: "text-[hsl(var(--secondary-foreground))]" },
    { label: t("recentSales"), value: data.count.toString(), icon: Package, bg: "bg-primary/10", color: "text-primary" },
  ];

  return (
    <div>
      <PageHeader title={t("reports")} subtitle={t("reportsSubtitle")} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        {stats.map(s => (
          <div key={s.label} className="bg-[hsl(var(--surface-container-lowest))] p-6 rounded-2xl transition-all hover:-translate-y-1">
            <div className={`p-3 ${s.bg} rounded-xl w-fit mb-4`}>
              <s.icon className={`h-6 w-6 ${s.color}`} />
            </div>
            <p className="text-muted-foreground text-sm font-medium">{s.label}</p>
            <h3 className="text-2xl font-bold mt-1 text-foreground">{s.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <SurfaceCard className="lg:col-span-2 p-8">
          <div className="mb-10">
            <h3 className="text-xl font-bold text-foreground">{t("dailyBreakdown")}</h3>
            <p className="text-sm text-muted-foreground">{t("monthSummary")}</p>
          </div>
          <div className="h-64 flex items-end justify-between gap-2 relative">
            <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
              {[0,1,2,3].map(i => <div key={i} className="border-b border-[hsl(var(--surface-container-high))] w-full" />)}
            </div>
            {data.daily.length === 0 && (
              <div className="text-muted-foreground text-sm w-full text-center self-center">{t("noResults")}</div>
            )}
            {data.daily.map(d => {
              const h = Math.max(4, (d.total / max) * 100);
              return (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-2 group min-w-0">
                  <div className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{fmt(d.total)}</div>
                  <div className="w-full rounded-t-lg bg-primary/10 group-hover:bg-primary/30 transition-all" style={{ height: `${h}%` }} />
                </div>
              );
            })}
          </div>
          {data.daily.length > 0 && (
            <div className="flex justify-between mt-4 text-[10px] font-bold text-muted-foreground px-1">
              {data.daily.map(d => <span key={d.date} className="truncate">{d.date.slice(5)}</span>)}
            </div>
          )}
        </SurfaceCard>

        <SurfaceCard className="p-8">
          <h3 className="text-lg font-bold text-foreground mb-6">{t("topProducts")}</h3>
          <div className="space-y-5">
            {data.topProducts.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("noResults")}</p>}
            {data.topProducts.map((p, i) => (
              <div key={p.name} className="flex items-center gap-4">
                <div className={`h-10 w-10 rounded-xl flex items-center justify-center font-black text-sm shrink-0 ${
                  i === 0 ? "bg-secondary/40 text-[hsl(var(--secondary-foreground))]" : "bg-[hsl(var(--surface-container-low))] text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.qty} {t("soldQty")}</p>
                </div>
                <p className="text-sm font-bold text-primary">{fmt(p.revenue)}</p>
              </div>
            ))}
          </div>
        </SurfaceCard>
      </div>
    </div>
  );
}
