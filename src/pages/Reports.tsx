import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { TrendingUp, Wallet, Receipt, Package } from "lucide-react";

export default function Reports() {
  const { t, fmt } = useT();
  const [data, setData] = useState({ totalSales: 0, totalDue: 0, count: 0, profit: 0, daily: [] as { date: string; total: number }[] });

  useEffect(() => {
    (async () => {
      const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
      const { data: sales } = await supabase.from("sales").select("total,due,created_at").gte("created_at", monthStart.toISOString());
      const { data: items } = await supabase.from("sale_items")
        .select("qty,unit_price,products(cost),sales!inner(created_at)")
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

      setData({ totalSales, totalDue, count: sales?.length ?? 0, profit, daily });
    })();
  }, []);

  const max = Math.max(1, ...data.daily.map(d => d.total));

  const stats = [
    { label: t("salesThisMonth"), value: fmt(data.totalSales), icon: TrendingUp },
    { label: t("profit"), value: fmt(data.profit), icon: Wallet },
    { label: t("pendingDue"), value: fmt(data.totalDue), icon: Receipt },
    { label: t("sales"), value: data.count, icon: Package },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl md:text-3xl font-bold">{t("reports")}</h1>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map(s => (
          <Card key={s.label} className="p-4">
            <s.icon className="h-5 w-5 text-primary mb-2" />
            <div className="text-xs text-muted-foreground">{s.label}</div>
            <div className="text-xl font-bold">{s.value}</div>
          </Card>
        ))}
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-4">{t("salesThisMonth")}</h2>
        <div className="flex items-end gap-1 h-48">
          {data.daily.length === 0 && <div className="text-muted-foreground text-sm w-full text-center self-center">{t("noResults")}</div>}
          {data.daily.map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 group min-w-0">
              <div className="text-xs opacity-0 group-hover:opacity-100 transition">{fmt(d.total)}</div>
              <div className="w-full rounded-t gradient-primary" style={{ height: `${(d.total / max) * 100}%` }} />
              <div className="text-[10px] text-muted-foreground truncate">{d.date.slice(5)}</div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
