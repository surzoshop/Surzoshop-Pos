import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { useT } from "@/i18n/LanguageContext";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";
import { Link } from "react-router-dom";
import {
  ShoppingCart, Receipt, TrendingUp, Calendar, Package, Award,
  ScanLine, Users, ClipboardList, Sparkles,
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
      setTodaySales((tDay ?? []).reduce((a: number, r: any) => a + Number(r.total || 0), 0));
      setTodayOrders((tDay ?? []).length);

      const { data: tMon } = await supabase.from("sales").select("total").gte("created_at", startMonth);
      setMonthSales((tMon ?? []).reduce((a: number, r: any) => a + Number(r.total || 0), 0));
      setMonthOrders((tMon ?? []).length);

      const { data: recent } = await supabase
        .from("sales").select("id, invoice_no, total, created_at")
        .order("created_at", { ascending: false }).limit(8);
      setRecentSales(recent ?? []);

      // Last 7 days bucket
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
  const avgOrder = todayOrders > 0 ? todaySales / todayOrders : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`${greet}, ${profile?.full_name ?? "Staff"} 👋`}
        subtitle={currentShop ? `${currentShop.name} • আজকের কাজের সারাংশ` : "আজকের কাজের সারাংশ"}
      />

      {/* Quick actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <QuickAction to="/pos" icon={ShoppingCart} label="নতুন বিক্রয়" tone="from-emerald-500 to-green-600" />
        <QuickAction to="/sales" icon={Receipt} label="বিক্রয় তালিকা" tone="from-violet-500 to-purple-600" />
        <QuickAction to="/customers" icon={Users} label="কাস্টমার" tone="from-sky-500 to-blue-600" />
        <QuickAction to="/attendance" icon={ClipboardList} label="হাজিরা" tone="from-amber-500 to-orange-600" />
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat icon={ShoppingCart} tone="from-emerald-400 to-green-600" label="আজকের বিক্রয়" value={fmt(todaySales)} />
        <Stat icon={Receipt} tone="from-sky-400 to-blue-600" label="আজকের অর্ডার" value={String(todayOrders)} />
        <Stat icon={TrendingUp} tone="from-fuchsia-400 to-pink-600" label="মাসিক বিক্রয়" value={fmt(monthSales)} />
        <Stat icon={Calendar} tone="from-amber-400 to-orange-600" label="মাসিক অর্ডার" value={String(monthOrders)} />
      </div>

      {/* Highlights row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Highlight
          icon={Sparkles}
          tone="from-emerald-500 to-teal-600"
          label="গড় অর্ডার মূল্য"
          value={fmt(avgOrder)}
          hint="আজকের গড়"
        />
        <Highlight
          icon={Award}
          tone="from-amber-500 to-orange-600"
          label="সপ্তাহের সেরা দিন"
          value={bestDay ? bestDay.label : "—"}
          hint={bestDay ? fmt(bestDay.total) : "এখনো নেই"}
        />
        <Highlight
          icon={ScanLine}
          tone="from-violet-500 to-fuchsia-600"
          label="POS শর্টকাট"
          value="বিক্রয় শুরু"
          hint="ক্লিক করুন"
          to="/pos"
        />
      </div>

      {/* Weekly chart */}
      <SurfaceCard className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-extrabold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" /> গত ৭ দিনের বিক্রয়
          </h3>
          <span className="text-[11px] text-muted-foreground">প্রতিদিনের মোট</span>
        </div>
        <div className="h-40 flex items-end justify-between gap-1.5 md:gap-2.5">
          {week.map((w, i) => {
            const h = Math.max(2, (w.total / maxWeek) * 100);
            const isMax = w.total > 0 && w.total === maxWeek;
            return (
              <div key={i} className="flex-1 h-full flex flex-col items-center justify-end gap-1.5 group" title={`${w.label}: ${fmt(w.total)} • ${w.orders} অর্ডার`}>
                <span className="text-[10px] font-bold text-muted-foreground opacity-0 group-hover:opacity-100 transition">{fmt(w.total)}</span>
                <div
                  className={`w-full rounded-t-lg transition-all ${isMax ? "bg-gradient-to-t from-emerald-500 to-emerald-300" : "bg-gradient-to-t from-primary/70 to-primary/40 group-hover:from-primary group-hover:to-primary/60"}`}
                  style={{ height: `${h}%` }}
                />
                <span className="text-[10px] font-bold text-muted-foreground">{w.label}</span>
              </div>
            );
          })}
        </div>
      </SurfaceCard>

      {/* Recent sales + top products */}
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

        <SurfaceCard className="p-5">
          <h3 className="text-sm font-extrabold mb-4 flex items-center gap-2"><Package className="h-4 w-4 text-primary" /> মাসের শীর্ষ পণ্য</h3>
          {topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">তথ্য নেই</p>
          ) : (
            <ul className="space-y-3">
              {topProducts.map((p, i) => {
                const max = topProducts[0]?.qty || 1;
                return (
                  <li key={p.name} className="flex items-center gap-3">
                    <span className={`h-7 w-7 rounded-full text-white text-xs font-black flex items-center justify-center shadow ${
                      i === 0 ? "bg-gradient-to-br from-amber-400 to-orange-500" :
                      i === 1 ? "bg-gradient-to-br from-slate-300 to-slate-500" :
                      i === 2 ? "bg-gradient-to-br from-orange-300 to-rose-500" :
                      "bg-primary/20 text-primary shadow-none"
                    }`}>{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.name}</p>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-1">
                        <div className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full" style={{ width: `${(p.qty / max) * 100}%` }} />
                      </div>
                    </div>
                    <span className="text-xs font-bold text-muted-foreground">{p.qty} pcs</span>
                  </li>
                );
              })}
            </ul>
          )}
        </SurfaceCard>
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

function QuickAction({ to, icon: Icon, label, tone }: { to: string; icon: any; label: string; tone: string }) {
  return (
    <Link to={to} className="group">
      <SurfaceCard className="p-4 flex items-center gap-3 hover:shadow-lg transition-all hover:-translate-y-0.5">
        <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${tone} text-white flex items-center justify-center shadow group-hover:scale-110 transition`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="text-sm font-extrabold">{label}</span>
      </SurfaceCard>
    </Link>
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
