import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { Search, Package, ArrowDownCircle, ArrowUpCircle, RotateCcw } from "lucide-react";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";

type Movement = {
  date: string;
  product_id: string;
  product_name: string;
  type: "purchase" | "sale" | "return" | "adjustment";
  in_qty: number;
  out_qty: number;
  ref: string;
};

export default function StockLedger() {
  const { t, lang, fmt } = useT();
  const [products, setProducts] = useState<any[]>([]);
  const [pid, setPid] = useState("");
  const [search, setSearch] = useState("");
  const [movements, setMovements] = useState<Movement[]>([]);
  const [opening, setOpening] = useState(0);

  useEffect(() => {
    supabase.from("products").select("id,name,stock,low_stock_threshold").order("name")
      .then(({ data }) => {
        setProducts(data ?? []);
        if (data && data.length && !pid) setPid(data[0].id);
      });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!pid) return;
    (async () => {
      const [pi, si, sa, ri] = await Promise.all([
        supabase.from("purchase_items").select("created_at,qty,unit_cost,purchase_id").eq("product_id", pid),
        supabase.from("sale_items").select("created_at,qty,unit_price,sale_id").eq("product_id", pid),
        supabase.from("stock_adjustments").select("created_at,qty,type,reason").eq("product_id", pid),
        supabase.from("sales_return_items").select("created_at,qty,unit_price,return_id").eq("product_id", pid),
      ]);
      const m: Movement[] = [];
      (pi.data ?? []).forEach((r: any) => m.push({ date: r.created_at, product_id: pid, product_name: "", type: "purchase", in_qty: r.qty, out_qty: 0, ref: "Purchase" }));
      (si.data ?? []).forEach((r: any) => m.push({ date: r.created_at, product_id: pid, product_name: "", type: "sale", in_qty: 0, out_qty: r.qty, ref: "Sale" }));
      (ri.data ?? []).forEach((r: any) => m.push({ date: r.created_at, product_id: pid, product_name: "", type: "return", in_qty: r.qty, out_qty: 0, ref: "Return" }));
      (sa.data ?? []).forEach((r: any) => {
        const isIn = r.type === "return" || r.type === "transfer_in" || r.type === "count";
        m.push({ date: r.created_at, product_id: pid, product_name: "", type: "adjustment", in_qty: isIn ? r.qty : 0, out_qty: isIn ? 0 : r.qty, ref: r.type });
      });
      m.sort((a, b) => +new Date(a.date) - +new Date(b.date));
      setMovements(m);
      const product = products.find(p => p.id === pid);
      const totalIn = m.reduce((a, x) => a + x.in_qty, 0);
      const totalOut = m.reduce((a, x) => a + x.out_qty, 0);
      setOpening((product?.stock ?? 0) - totalIn + totalOut);
    })();
  }, [pid, products]);

  const filteredProducts = useMemo(
    () => products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const selected = products.find(p => p.id === pid);
  let running = opening;
  const rows = movements.map(m => { running = running + m.in_qty - m.out_qty; return { ...m, balance: running }; });
  const totalIn = movements.reduce((a, m) => a + m.in_qty, 0);
  const totalOut = movements.reduce((a, m) => a + m.out_qty, 0);

  return (
    <div>
      <PageHeader title="স্টক লেজার" subtitle="প্রতিটি পণ্যের সম্পূর্ণ in/out movement ও ব্যালেন্স।" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <SurfaceCard className="p-4 lg:col-span-1 h-fit">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filteredProducts.map(p => (
              <button key={p.id} onClick={() => setPid(p.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm flex justify-between items-center transition-all ${pid === p.id ? "bg-primary/10 text-primary font-bold ring-1 ring-primary/30" : "hover:bg-muted/60"}`}>
                <span className="truncate">{p.name}</span>
                <span className="text-xs text-muted-foreground ml-2">{p.stock}</span>
              </button>
            ))}
          </div>
        </SurfaceCard>

        {/* Main */}
        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Stat icon={<Package className="h-5 w-5 text-info" />} bg="bg-info/10" label="প্রারম্ভিক স্টক" value={opening.toString()} />
            <Stat icon={<ArrowDownCircle className="h-5 w-5 text-primary" />} bg="bg-primary/10" label="মোট ইন" value={totalIn.toString()} />
            <Stat icon={<ArrowUpCircle className="h-5 w-5 text-destructive" />} bg="bg-destructive/10" label="মোট আউট" value={totalOut.toString()} />
            <Stat icon={<RotateCcw className="h-5 w-5 text-[hsl(var(--secondary-foreground))]" />} bg="bg-secondary/30" label="বর্তমান স্টক" value={(selected?.stock ?? 0).toString()} />
          </div>

          <SurfaceCard className="p-6">
            <h3 className="text-lg font-bold mb-4">{selected?.name ?? "—"}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-[hsl(var(--surface-container-high))]">
                    <th className="pb-3 font-bold">{t("date")}</th>
                    <th className="pb-3 font-bold">{t("type")}</th>
                    <th className="pb-3 font-bold text-right">ইন</th>
                    <th className="pb-3 font-bold text-right">আউট</th>
                    <th className="pb-3 font-bold text-right">ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-[hsl(var(--surface-container-high))]">
                    <td className="py-3 text-muted-foreground italic" colSpan={4}>প্রারম্ভিক ব্যালেন্স</td>
                    <td className="py-3 text-right font-bold">{opening}</td>
                  </tr>
                  {rows.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">কোন movement নেই</td></tr>}
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-[hsl(var(--surface-container-high))]/40">
                      <td className="py-3 text-muted-foreground">{new Date(r.date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</td>
                      <td className="py-3"><StatusPill tone={r.type === "purchase" || r.type === "return" ? "success" : r.type === "sale" ? "destructive" : "info"}>{r.ref}</StatusPill></td>
                      <td className="py-3 text-right text-primary font-semibold">{r.in_qty || "—"}</td>
                      <td className="py-3 text-right text-destructive font-semibold">{r.out_qty || "—"}</td>
                      <td className="py-3 text-right font-bold">{r.balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, bg, label, value }: any) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-4 rounded-2xl flex items-center gap-3">
      <div className={`p-2.5 ${bg} rounded-xl`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium truncate">{label}</p>
        <h3 className="text-lg font-bold text-foreground">{value}</h3>
      </div>
    </div>
  );
}
