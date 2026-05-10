import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { TrendingUp, ArrowDownRight, ArrowUpRight, Wallet } from "lucide-react";

type Bucket = { label: string; sales: number; purchases: number; expenses: number };

export default function CashFlowChart() {
  const { t, fmt, lang } = useT();
  const [data, setData] = useState<Bucket[]>([]);
  const [totals, setTotals] = useState({ sales: 0, purchases: 0, expenses: 0, net: 0 });

  useEffect(() => { void load(); }, []);

  const load = async () => {
    // last 6 months
    const now = new Date();
    const months: { start: Date; end: Date; label: string }[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      months.push({
        start, end,
        label: start.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { month: "short" }),
      });
    }
    const earliest = months[0].start;
    const latest = months[months.length - 1].end;

    const [salesRes, purchasesRes, expensesRes] = await Promise.all([
      supabase.from("sales").select("total,created_at").gte("created_at", earliest.toISOString()).lt("created_at", latest.toISOString()),
      supabase.from("purchases").select("total,created_at").gte("created_at", earliest.toISOString()).lt("created_at", latest.toISOString()),
      supabase.from("expenses").select("amount,expense_date").gte("expense_date", earliest.toISOString().slice(0, 10)).lt("expense_date", latest.toISOString().slice(0, 10)),
    ]);

    const buckets: Bucket[] = months.map(m => ({ label: m.label, sales: 0, purchases: 0, expenses: 0 }));
    const idxOf = (d: Date) => months.findIndex(m => d >= m.start && d < m.end);

    (salesRes.data ?? []).forEach((r: any) => {
      const i = idxOf(new Date(r.created_at));
      if (i >= 0) buckets[i].sales += Number(r.total);
    });
    (purchasesRes.data ?? []).forEach((r: any) => {
      const i = idxOf(new Date(r.created_at));
      if (i >= 0) buckets[i].purchases += Number(r.total);
    });
    (expensesRes.data ?? []).forEach((r: any) => {
      const i = idxOf(new Date(r.expense_date));
      if (i >= 0) buckets[i].expenses += Number(r.amount);
    });

    setData(buckets);
    const sales = buckets.reduce((a, b) => a + b.sales, 0);
    const purchases = buckets.reduce((a, b) => a + b.purchases, 0);
    const expenses = buckets.reduce((a, b) => a + b.expenses, 0);
    setTotals({ sales, purchases, expenses, net: sales - purchases - expenses });
  };

  const max = useMemo(() => Math.max(1, ...data.flatMap(d => [d.sales, d.purchases, d.expenses])), [data]);

  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--border))] rounded-2xl p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base md:text-xl font-bold text-foreground font-bn">নগদ প্রবাহ ও মুনাফা</h3>
            <p className="text-xs text-muted-foreground font-bn">গত ৬ মাসের বিক্রয় বনাম ক্রয় ও খরচ</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider font-bn">নিট</div>
          <div className={`text-base md:text-lg font-black ${totals.net >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
            {fmt(totals.net)}
          </div>
        </div>
      </div>

      {/* Legend + totals */}
      <div className="grid grid-cols-3 gap-2 md:gap-3 mb-4">
        <Pill color="bg-emerald-500" label={lang === "bn" ? "বিক্রয়" : "Sales"} value={fmt(totals.sales)} icon={<ArrowUpRight className="h-3 w-3" />} />
        <Pill color="bg-sky-500" label={lang === "bn" ? "ক্রয়" : "Purchases"} value={fmt(totals.purchases)} icon={<ArrowDownRight className="h-3 w-3" />} />
        <Pill color="bg-rose-500" label={lang === "bn" ? "খরচ" : "Expenses"} value={fmt(totals.expenses)} icon={<TrendingUp className="h-3 w-3" />} />
      </div>

      {/* Grouped bar chart */}
      <div className="relative h-44 md:h-56 flex items-end justify-between gap-2 md:gap-4 pb-1">
        <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
          {[0,1,2,3].map(i => <div key={i} className="border-b border-dashed border-[hsl(var(--border))] w-full" />)}
        </div>
        {data.map((d, i) => (
          <div key={i} className="flex-1 h-full flex items-end justify-center gap-0.5 md:gap-1 group">
            <Bar value={d.sales} max={max} color="bg-emerald-500" delay={i * 60} title={fmt(d.sales)} />
            <Bar value={d.purchases} max={max} color="bg-sky-500" delay={i * 60 + 40} title={fmt(d.purchases)} />
            <Bar value={d.expenses} max={max} color="bg-rose-500" delay={i * 60 + 80} title={fmt(d.expenses)} />
          </div>
        ))}
      </div>
      <div className="flex justify-between mt-3 text-[10px] font-semibold text-muted-foreground px-1 uppercase tracking-wider">
        {data.map((d, i) => <span key={i} className="flex-1 text-center">{d.label}</span>)}
      </div>
    </div>
  );
}

function Pill({ color, label, value, icon }: { color: string; label: string; value: string; icon: React.ReactNode }) {
  return (
    <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-2.5 md:p-3">
      <div className="flex items-center gap-1.5">
        <span className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground truncate">{label}</span>
        {icon}
      </div>
      <div className="text-sm md:text-base font-black text-foreground mt-1">{value}</div>
    </div>
  );
}

function Bar({ value, max, color, delay, title }: { value: number; max: number; color: string; delay: number; title: string }) {
  const h = Math.max(2, (value / max) * 100);
  return (
    <div className="relative flex-1 h-full flex items-end" title={title}>
      <div
        className={`w-full rounded-t-md ${color} hover:brightness-110 transition-all`}
        style={{ height: `${h}%`, animation: `growUp 0.7s ${delay}ms ease-out backwards` }}
      />
    </div>
  );
}
