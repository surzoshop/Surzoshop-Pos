import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { useT } from "@/i18n/LanguageContext";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";
import { Link } from "react-router-dom";
import {
  ShoppingCart, Receipt, TrendingUp, Calendar, Package, Award,
  ScanLine, Users, ClipboardList, Sparkles, Trophy, Target,
} from "lucide-react";

/**
 * Staff-facing dashboard. Sales-side metrics ONLY.
 * NEVER shows cost / purchase price / profit / supplier dues / cash-book.
 */
export default function StaffDashboard() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const { fmt, lang } = useT();

  const [todaySales, setTodaySales] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [todayHigh, setTodayHigh] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [monthOrders, setMonthOrders] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
  const [profile, setProfile] = useState<{ full_name?: string } | null>(null);
  const [week, setWeek] = useState<{ label: string; total: number; orders: number }[]>([]);
  const [bestDay, setBestDay] = useState<{ label: string; total: number } | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const startWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();

      if (user) {
        const { data } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        setProfile((data as any) ?? null);
      }

      const { data: tDay } = await supabase.from("sales").select("total").gte("created_at", startToday);
      const totals = (tDay ?? []).map((r: any) => Number(r.total || 0));
      setTodaySales(totals.reduce((a, b) => a + b, 0));
      setTodayOrders(totals.length);
      setTodayHigh(totals.length ? Math.max(...totals) : 0);

      const { data: tMon } = await supabase.from("sales").select("total").gte("created_at", startMonth);
      setMonthSales((tMon ?? []).reduce((a: number, r: any) => a + Number(r.total || 0), 0));
      setMonthOrders((tMon ?? []).length);

      const { data: recent } = await supabase
        .from("sales").select("id, invoice_no, total, created_at")
        .order("created_at", { ascending: false }).limit(8);
      setRecentSales(recent ?? []);

      const { data: weekRows } = await supabase
        .from("sales").select("total, created_at").gte("created_at", startWeek);
      const buckets: { label: string; total: number; orders: number; date: Date }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        buckets.push({
          date: d,
          label: d.toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { weekday: "short" }),
          total: 0, orders: 0,
        });
      }
      (weekRows ?? []).forEach((r: any) => {
        const d = new Date(r.created_at);
        const key = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        const b = buckets.find(x => x.date.getTime() === key);
        if (b) { b.total += Number(r.total || 0); b.orders += 1; }
      });
      setWeek(buckets.map(b => ({ label: b.label, total: b.total, orders: b.orders })));
      const best = [...buckets].sort((a, b) => b.total - a.total)[0];
      if (best && best.total > 0) setBestDay({ label: best.label, total: best.total });

      const { data: items } = await supabase
        .from("sale_items").select("product_name, qty").gte("created_at", startMonth);
      const map: Record<string, number> = {};
      (items ?? []).forEach((i: any) => { map[i.product_name] = (map[i.product_name] ?? 0) + Number(i.qty || 0); });
      const top = Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(top);
    })();
  }, [user, lang]);

  const greet = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "শুভ সকাল";
    if (h < 17) return "শুভ দুপুর";
    return "শুভ সন্ধ্যা";
  }, []);

  const maxWeek = Math.max(1, ...week.map(w => w.total));
  // Goal = average of last 7 days; bars beyond goal turn emerald
  const weekAvg = week.length ? week.reduce((a, b) => a + b.total, 0) / week.length : 0;
  const goal = Math.max(weekAvg * 1.1, maxWeek * 0.6); // 10% above avg or 60% of max
  const avgSale = todayOrders > 0 ? todaySales / todayOrders : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet}, ${profile?.full_name ?? "Staff"} 👋`}
        subtitle={currentShop ? `${currentShop.name} • আজকের কাজের সারাংশ` : "আজকের কাজের সারাংশ"}
      />

      {/* Admin-style Quick Actions panel */}
      <div className="relative bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 dark:from-[hsl(var(--inverse-surface))] dark:via-[hsl(var(--inverse-surface))] dark:to-[hsl(var(--inverse-surface))] p-5 md:p-6 rounded-2xl text-white shadow-xl overflow-hidden">
        <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />
        <h3 className="relative text-base md:text-lg font-bold mb-4 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgb(52,211,153)] animate-pulse" />
          দ্রুত শর্টকাট
        </h3>
        <div className="relative grid grid-cols-4 gap-3 md:gap-4">
          <QAButton to="/pos" tone="emerald" icon={<ScanLine className="h-6 w-6" />} label="বিক্রয় (POS)" />
          <QAButton to="/sales" tone="sky" icon={<Receipt className="h-6 w-6" />} label="বিক্রয় তালিকা" />
          <QAButton to="/customers" tone="amber" icon={<Users className="h-6 w-6" />} label="কাস্টমার" />
          <QAButton to="/attendance" tone="fuchsia" icon={<ClipboardList className="h-6 w-6" />} label="হাজিরা" />
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={ShoppingCart} tone="from-emerald-400 to-green-600" label="আজকের বিক্রয়" value={fmt(todaySales)} />
        <Stat icon={Trophy} tone="from-sky-400 to-blue-600" label="আজকের সর্বোচ্চ বিক্রয়" value={fmt(todayHigh)} />
        <Stat icon={TrendingUp} tone="from-fuchsia-400 to-pink-600" label="মাসিক বিক্রয়" value={fmt(monthSales)} />
        <Stat icon={Calendar} tone="from-amber-400 to-orange-600" label="মাসিক অর্ডার" value={String(monthOrders)} />
      </div>

      {/* Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Highlight
          icon={Sparkles}
          tone="from-emerald-500 to-teal-600"
          label="গড় বিক্রয় মূল্য"
          value={fmt(avgSale)}
          hint={`${todayOrders} আজকের বিক্রয়`}
        />
        <Highlight
          icon={Award}
          tone="from-amber-500 to-orange-600"
          label="সপ্তাহের সেরা দিন"
          value={bestDay ? bestDay.label : "—"}
          hint={bestDay ? fmt(bestDay.total) : "এখনো নেই"}
        />
      </div>

      {/* Weekly chart with goal line */}
      <SurfaceCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> গত ৭ দিনের বিক্রয়
          </h3>
          <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
            <Target className="h-3.5 w-3.5 text-amber-500" /> লক্ষ্য: {fmt(goal)}
          </span>
        </div>
        <div className="relative h-36 px-1">
          {/* Goal line */}
          <div
            className="absolute left-0 right-0 border-t-2 border-dashed border-amber-500/70 z-10 pointer-events-none"
            style={{ bottom: `${(goal / Math.max(maxWeek, goal)) * 100}%` }}
          >
            <span className="absolute -top-2.5 right-0 text-[9px] font-black bg-amber-500 text-white px-1.5 py-0.5 rounded">GOAL</span>
          </div>
          {/* Grid lines */}
          <div className="absolute inset-0 flex flex-col justify-between py-1 pointer-events-none">
            {[0,1,2,3].map(i => <div key={i} className="border-b border-dashed border-[hsl(var(--border))]/50 w-full" />)}
          </div>
          <div className="relative h-full flex items-end justify-between gap-3 md:gap-5">
            {week.map((w, i) => {
              const denom = Math.max(maxWeek, goal);
              const h = Math.max(2, (w.total / denom) * 100);
              const hitGoal = w.total >= goal && w.total > 0;
              return (
                <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 group" title={`${w.label}: ${fmt(w.total)} • ${w.orders} অর্ডার`}>
                  <span className="text-[9px] font-bold text-foreground opacity-0 group-hover:opacity-100 transition whitespace-nowrap">{fmt(w.total)}</span>
                  <div className="w-full flex justify-center">
                    <div
                      className={`w-2 md:w-2.5 rounded-full transition-all ${hitGoal ? "bg-gradient-to-t from-emerald-500 to-emerald-300 shadow-[0_0_8px_rgb(52,211,153,0.5)]" : "bg-gradient-to-t from-primary to-primary/50 group-hover:from-primary group-hover:to-primary/80"}`}
                      style={{ height: `${h}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-bold text-muted-foreground">{w.label}</span>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-3 mt-3 text-[10px] text-muted-foreground">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> লক্ষ্য পূরণ</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" /> অন্যান্য</span>
        </div>
      </SurfaceCard>

      {/* Recent sales + Top products (revamped) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <SurfaceCard className="p-5">
          <h3 className="text-sm font-extrabold mb-4 flex items-center gap-2"><Receipt className="h-4 w-4 text-primary" /> সাম্প্রতিক বিক্রয়</h3>
          {recentSales.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">কোনো বিক্রয় নেই</p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]">
              {recentSales.map(s => (
                <li key={s.id} className="py-2.5 flex items-center justify-between text-sm">
                  <div>
                    <p className="font-bold">{s.invoice_no}</p>
                    <p className="text-[11px] text-muted-foreground">{new Date(s.created_at).toLocaleString()}</p>
                  </div>
                  <span className="font-extrabold text-emerald-600">{fmt(Number(s.total))}</span>
                </li>
              ))}
            </ul>
          )}
        </SurfaceCard>

        {/* Top Products — admin-style polished UI */}
        <div className="bg-[hsl(var(--surface-container-lowest))] p-5 rounded-2xl border border-[hsl(var(--surface-container-high))]/40">
          <div className="flex items-center gap-3 mb-5">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/30">
              <Package className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">মাসিক শীর্ষ পণ্য</h3>
              <p className="text-[11px] text-muted-foreground">এই মাসের সর্বাধিক বিক্রি</p>
            </div>
          </div>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">তথ্য নেই</p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((p, i) => {
                const tones = [
                  "from-amber-500 to-orange-500 shadow-amber-500/30",
                  "from-sky-500 to-cyan-500 shadow-sky-500/30",
                  "from-emerald-500 to-teal-500 shadow-emerald-500/30",
                  "from-violet-500 to-fuchsia-500 shadow-violet-500/30",
                  "from-rose-500 to-pink-500 shadow-rose-500/30",
                ];
                return (
                  <div key={p.name} className="group flex items-center gap-3 p-2 rounded-xl hover:bg-[hsl(var(--surface-container-low))] transition-all">
                    <div className={`relative w-11 h-11 bg-gradient-to-br ${tones[i] ?? tones[0]} rounded-xl flex items-center justify-center shrink-0 shadow-lg group-hover:scale-105 transition-transform`}>
                      <Package className="h-5 w-5 text-white" />
                      <span className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-foreground text-background text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.qty} pcs বিক্রি</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone: string }) {
  return (
    <SurfaceCard className="p-4 relative overflow-hidden">
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br ${tone} opacity-20 blur-xl`} />
      <div className={`h-9 w-9 rounded-xl bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-[11px] text-muted-foreground mt-3 font-bn">{label}</p>
      <p className="text-xl font-black mt-0.5">{value}</p>
    </SurfaceCard>
  );
}

function Highlight({ icon: Icon, label, value, hint, tone, to }: { icon: any; label: string; value: string; hint: string; tone: string; to?: string }) {
  const inner = (
    <SurfaceCard className="p-4 relative overflow-hidden hover:shadow-lg transition">
      <div className={`absolute inset-0 bg-gradient-to-br ${tone} opacity-[0.07]`} />
      <div className="relative flex items-center gap-3">
        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow-lg`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
          <p className="text-base font-black truncate">{value}</p>
          <p className="text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </div>
    </SurfaceCard>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
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

function QAButton({ to, icon, label, tone = "emerald" }: { to: string; icon: any; label: string; tone?: string }) {
  const t = QA_TONES[tone] ?? QA_TONES.emerald;
  const cls = `group relative overflow-hidden bg-gradient-to-br ${t} p-3 md:p-4 rounded-xl flex flex-col items-center gap-1.5 md:gap-2 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 border`;
  return (
    <Link to={to} className={cls}>
      <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
      <div className={`relative transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-3 ${QA_ICON[tone] ?? QA_ICON.emerald}`}>{icon}</div>
      <span className="relative text-[10px] md:text-xs font-bold text-center leading-tight text-white/90">{label}</span>
    </Link>
  );
}
