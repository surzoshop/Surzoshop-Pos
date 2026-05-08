import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { Search, Wallet, ShoppingBag, AlertCircle } from "lucide-react";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";
import { fmtDateTimeBD } from "@/lib/datetime";

export default function CustomerLedger() {
  const { t, lang, fmt } = useT();
  const [customers, setCustomers] = useState<any[]>([]);
  const [cid, setCid] = useState("");
  const [search, setSearch] = useState("");
  const [sales, setSales] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);

  useEffect(() => {
    supabase.from("customers").select("id,name,phone").order("name").then(({ data }) => {
      setCustomers(data ?? []);
      if (data && data.length && !cid) setCid(data[0].id);
    });
    // eslint-disable-next-line
  }, []);

  useEffect(() => {
    if (!cid) return;
    (async () => {
      const { data: s } = await supabase.from("sales").select("id,invoice_no,created_at,total,paid,due,status").eq("customer_id", cid).order("created_at");
      setSales(s ?? []);
      const saleIds = (s ?? []).map((x: any) => x.id);
      if (saleIds.length) {
        const { data: ip } = await supabase.from("installment_payments").select("id,amount,paid_at,installment_id,installments!inner(sale_id)").in("installments.sale_id", saleIds);
        setPayments(ip ?? []);
      } else setPayments([]);
    })();
  }, [cid]);

  const totalSales = sales.reduce((a, s) => a + Number(s.total), 0);
  const totalPaid = sales.reduce((a, s) => a + Number(s.paid), 0);
  const totalDue = sales.reduce((a, s) => a + Number(s.due), 0);

  const txns = useMemo(() => {
    const list: any[] = [];
    sales.forEach(s => list.push({ date: s.created_at, type: "sale", ref: s.invoice_no, debit: Number(s.total), credit: 0 }));
    sales.forEach(s => { if (Number(s.paid) > 0) list.push({ date: s.created_at, type: "payment", ref: `${s.invoice_no} (down)`, debit: 0, credit: Number(s.paid) - 0 }); });
    payments.forEach(p => list.push({ date: p.paid_at, type: "payment", ref: "EMI", debit: 0, credit: Number(p.amount) }));
    list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    let bal = 0;
    return list.map(x => { bal = bal + x.debit - x.credit; return { ...x, balance: bal }; });
  }, [sales, payments]);

  const filtered = customers.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || (c.phone ?? "").includes(search));
  const selected = customers.find(c => c.id === cid);

  return (
    <div>
      <PageHeader title="ক্রেতা লেজার" subtitle="প্রতিটি ক্রেতার লেনদেন ইতিহাস ও বকেয়া।" />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SurfaceCard className="p-4 lg:col-span-1 h-fit">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filtered.map(c => (
              <button key={c.id} onClick={() => setCid(c.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${cid === c.id ? "bg-primary/10 text-primary font-bold ring-1 ring-primary/30" : "hover:bg-muted/60"}`}>
                <div className="truncate font-semibold">{c.name}</div>
                <div className="text-xs text-muted-foreground">{c.phone ?? "—"}</div>
              </button>
            ))}
          </div>
        </SurfaceCard>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat icon={<ShoppingBag className="h-5 w-5 text-info" />} bg="bg-info/10" label="মোট বিক্রয়" value={fmt(totalSales)} />
            <Stat icon={<Wallet className="h-5 w-5 text-primary" />} bg="bg-primary/10" label="মোট পরিশোধ" value={fmt(totalPaid)} />
            <Stat icon={<AlertCircle className="h-5 w-5 text-destructive" />} bg="bg-destructive/10" label="মোট বকেয়া" value={fmt(totalDue)} />
          </div>

          <SurfaceCard className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">{selected?.name ?? "—"}</h3>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">ইতিহাস (History)</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-[hsl(var(--surface-container-high))]">
                    <th className="pb-3 font-bold">তারিখ ও সময়</th>
                    <th className="pb-3 font-bold">বিবরণ</th>
                    <th className="pb-3 font-bold text-right">ডেবিট</th>
                    <th className="pb-3 font-bold text-right">ক্রেডিট</th>
                    <th className="pb-3 font-bold text-right">ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">কোন লেনদেন নেই</td></tr>}
                  {txns.map((x, i) => (
                    <tr key={i} className="border-b border-[hsl(var(--surface-container-high))]/40">
                      <td className="py-3 text-muted-foreground whitespace-nowrap text-xs">{fmtDateTimeBD(x.date, lang)}</td>
                      <td className="py-3"><StatusPill tone={x.type === "sale" ? "info" : "success"}>{x.ref}</StatusPill></td>
                      <td className="py-3 text-right text-destructive font-semibold">{x.debit > 0 ? fmt(x.debit) : "—"}</td>
                      <td className="py-3 text-right text-primary font-semibold">{x.credit > 0 ? fmt(x.credit) : "—"}</td>
                      <td className="py-3 text-right font-bold">{fmt(x.balance)}</td>
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
