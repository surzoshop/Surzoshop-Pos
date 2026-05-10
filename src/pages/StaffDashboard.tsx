import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { useT } from "@/i18n/LanguageContext";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";
import { ShoppingCart, Receipt, TrendingUp, Calendar, Package, User } from "lucide-react";

/**
 * Staff-facing dashboard. Shows ONLY sales-side metrics — never shows
 * cost / purchase price / profit / supplier dues / cash-book.
 */
export default function StaffDashboard() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const { fmt } = useT();

  const [todaySales, setTodaySales] = useState(0);
  const [todayOrders, setTodayOrders] = useState(0);
  const [monthSales, setMonthSales] = useState(0);
  const [monthOrders, setMonthOrders] = useState(0);
  const [recentSales, setRecentSales] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; qty: number }[]>([]);
  const [profile, setProfile] = useState<{ full_name?: string } | null>(null);

  useEffect(() => {
    (async () => {
      const now = new Date();
      const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const startMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

      // Profile
      if (user) {
        const { data } = await supabase.from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
        setProfile((data as any) ?? null);
      }

      // Today
      const { data: tDay } = await supabase
        .from("sales").select("total")
        .gte("created_at", startToday);
      setTodaySales((tDay ?? []).reduce((a: number, r: any) => a + Number(r.total || 0), 0));
      setTodayOrders((tDay ?? []).length);

      // Month
      const { data: tMon } = await supabase
        .from("sales").select("total")
        .gte("created_at", startMonth);
      setMonthSales((tMon ?? []).reduce((a: number, r: any) => a + Number(r.total || 0), 0));
      setMonthOrders((tMon ?? []).length);

      // Recent sales (last 8)
      const { data: recent } = await supabase
        .from("sales")
        .select("id, invoice_no, total, created_at")
        .order("created_at", { ascending: false })
        .limit(8);
      setRecentSales(recent ?? []);

      // Top products this month — by qty (no cost / price exposure beyond qty count)
      const { data: items } = await supabase
        .from("sale_items")
        .select("product_name, qty")
        .gte("created_at", startMonth);
      const map: Record<string, number> = {};
      (items ?? []).forEach((i: any) => { map[i.product_name] = (map[i.product_name] ?? 0) + Number(i.qty || 0); });
      const top = Object.entries(map).map(([name, qty]) => ({ name, qty })).sort((a, b) => b.qty - a.qty).slice(0, 5);
      setTopProducts(top);
    })();
  }, [user]);

  const greet = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "শুভ সকাল";
    if (h < 17) return "শুভ দুপুর";
    return "শুভ সন্ধ্যা";
  }, []);

  return (
    <div>
      <PageHeader
        title={`${greet}, ${profile?.full_name ?? "Staff"} 👋`}
        subtitle={currentShop ? `${currentShop.name} • আপনার কাজের সারাংশ` : "আপনার কাজের সারাংশ"}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Stat icon={ShoppingCart} tone="from-emerald-400 to-green-600" label="আজকের বিক্রয়" value={fmt(todaySales)} />
        <Stat icon={Receipt} tone="from-sky-400 to-blue-600" label="আজকের অর্ডার" value={String(todayOrders)} />
        <Stat icon={TrendingUp} tone="from-fuchsia-400 to-pink-600" label="মাসিক বিক্রয়" value={fmt(monthSales)} />
        <Stat icon={Calendar} tone="from-amber-400 to-orange-600" label="মাসিক অর্ডার" value={String(monthOrders)} />
      </div>

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
              {topProducts.map((p, i) => (
                <li key={p.name} className="flex items-center gap-3">
                  <span className="h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-black flex items-center justify-center">{i + 1}</span>
                  <span className="flex-1 text-sm font-bold truncate">{p.name}</span>
                  <span className="text-xs font-bold text-muted-foreground">{p.qty} pcs</span>
                </li>
              ))}
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
