import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine, ArrowUpFromLine, Coins, CalendarDays, ArrowLeft, Wallet,
} from "lucide-react";
import { todayBD, addDaysBDStr, fmtDateBD, fmtDateTimeBD } from "@/lib/datetime";

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

type Row = {
  id: string;
  at: string;
  kind: "in" | "out";
  amount: number;
  label: string;
  detail?: string | null;
  method?: string | null;
  /** যেসব এন্ট্রি দিনের ক্লোজিং হিসাবে ধরা হয় (বিক্রয়/কিস্তি আদায় ও খরচ) */
  counts: boolean;
};

export default function DailyClose() {
  const { currentShop } = useShop();

  const [date, setDate] = useState(todayBD());
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);

  const shopFilter = <T,>(q: T): T => (currentShop ? (q as any).eq("shop_id", currentShop.id) : q);

  const loadDay = useCallback(async () => {
    setLoading(true);
    const dayStart = `${date}T00:00:00+06:00`;
    const dayEnd = `${addDaysBDStr(date, 1)}T00:00:00+06:00`;

    const isBakiPayment = (e: any) => {
      const cat = (e.category ?? "").toLowerCase();
      const notes = (e.notes ?? "").toLowerCase();
      return cat.includes("বাকি পরিশোধ") || cat.includes("credit payment") || cat.includes("বাকি আদায়") ||
             notes.includes("বাকি পরিশোধ") || notes.includes("credit settlement") || notes.includes("বাকি আদায়");
    };

    const isReturnEntry = (e: any) => {
      const cat = (e.category ?? "").toLowerCase();
      const notes = (e.notes ?? "").toLowerCase();
      return cat.includes("ফেরত") || notes.includes("ফেরত") || notes.includes("ret-");
    };

    let sq: any = supabase.from("sales")
      .select("id,invoice_no,created_at,total,paid,due,payment_type,down_payment,customer_id,customers(name)")
      .gte("created_at", dayStart).lt("created_at", dayEnd);
    sq = shopFilter(sq);

    let ipq: any = supabase.from("installment_payments")
      .select("id,amount,paid_at,note,shop_id,installments!inner(sale_id,installment_no)")
      .gte("paid_at", dayStart).lt("paid_at", dayEnd);
    if (currentShop) {
      ipq = ipq.or(`shop_id.eq.${currentShop.id},shop_id.is.null`);
    }

    let cq: any = supabase.from("cash_book" as any).select("*").eq("entry_date", date);
    cq = shopFilter(cq);

    let eq: any = supabase.from("expenses")
      .select("id,title,amount,expense_date,payment_method,created_at").eq("expense_date", date);
    eq = shopFilter(eq);

    const [{ data: sd }, { data: ipd }, { data: cd }, { data: ed }] = await Promise.all([sq, ipq, cq, eq]);

    // দিনের বিক্রয়ের সাথে যুক্ত কিস্তি পেমেন্ট ও পরবর্তীতে পরিশোধিত বকেয়া বাদ দিয়ে ডাউন পেমেন্ট / প্রাথমিক নগদ বের করা
    const saleIds = (sd ?? []).map((s: any) => s.id);
    const instBySale = new Map<string, number>();
    if (saleIds.length) {
      const { data: insts } = await supabase.from("installments").select("id,sale_id").in("sale_id", saleIds);
      const instIds = (insts ?? []).map((i: any) => i.id);
      if (instIds.length) {
        const { data: pays } = await supabase.from("installment_payments")
          .select("amount,installment_id").in("installment_id", instIds);
        const saleOf = new Map<string, string>((insts ?? []).map((i: any) => [i.id, i.sale_id]));
        (pays ?? []).forEach((p: any) => {
          const sid = saleOf.get(p.installment_id);
          if (!sid) return;
          instBySale.set(sid, (instBySale.get(sid) ?? 0) + Number(p.amount || 0));
        });
      }
    }

    const bakiBySale = new Map<string, number>();
    const custIds = (sd ?? []).map((s: any) => s.customer_id).filter(Boolean);
    if (custIds.length) {
      const { data: bakiEntries } = await supabase.from("cash_book" as any)
        .select("amount,customer_id,party_name,created_at,entry_date")
        .eq("entry_type", "deposit")
        .in("customer_id", custIds);

      const bakiPaymentsByCust = new Map<string, { at: string; amount: number }[]>();
      (bakiEntries ?? []).forEach((e: any) => {
        if (isBakiPayment(e)) {
          const key = e.customer_id || e.party_name;
          if (key) {
            const list = bakiPaymentsByCust.get(key) ?? [];
            list.push({ at: e.created_at || e.entry_date, amount: Number(e.amount || 0) });
            bakiPaymentsByCust.set(key, list);
          }
        }
      });

      const salesByCust = new Map<string, any[]>();
      (sd ?? []).forEach((s: any) => {
        const key = s.customer_id || s.customers?.name;
        if (key) {
          const list = salesByCust.get(key) ?? [];
          list.push(s);
          salesByCust.set(key, list);
        }
      });

      salesByCust.forEach((sList, key) => {
        const payments = bakiPaymentsByCust.get(key) ?? [];
        if (!payments.length) return;
        const sortedPayments = [...payments].sort((a, b) => a.at.localeCompare(b.at));
        const sortedSales = [...sList].sort((a, b) => a.created_at.localeCompare(b.created_at));

        for (const p of sortedPayments) {
          let remaining = p.amount;
          for (const s of sortedSales) {
            if (remaining <= 0) break;
            if (s.payment_type === "installment") continue;
            if (String(s.created_at) > p.at) continue;

            const currentBaki = bakiBySale.get(s.id) ?? 0;
            const maxDeductible = Math.max(0, Number(s.paid || 0) - currentBaki);
            const take = Math.min(maxDeductible, remaining);
            if (take > 0) {
              bakiBySale.set(s.id, currentBaki + take);
              remaining -= take;
            }
          }
        }
      });
    }

    const out: Row[] = [];
    (sd ?? []).forEach((s: any) => {
      // যদি কিস্তি বিক্রয় হয়, তবে দিনের ক্যাশে প্রবেশ করেছে ডাউন পেমেন্ট; অন্যথায় নগদ প্রাপ্তি (বকেয়া পরিশোধ ক্যাশবুক থেকে পৃথক আসবে)
      const basePaid = s.payment_type === "installment" && s.down_payment != null
        ? Number(s.down_payment)
        : Math.max(0, Number(s.paid || 0) - (instBySale.get(s.id) ?? 0) - (bakiBySale.get(s.id) ?? 0));
      if (basePaid <= 0) return;
      out.push({
        id: `sale-${s.id}`,
        at: String(s.created_at),
        kind: "in",
        amount: basePaid,
        label: `বিক্রয় — ${s.invoice_no}`,
        detail: `${s.customers?.name ?? "নগদ কাস্টমার"}${Number(s.due || 0) > 0 ? ` • বাকি ${fmt(Number(s.due))}` : ""}`,
        method: "cash",
        counts: true,
      });
    });
    (ipd ?? []).forEach((p: any) => {
      out.push({
        id: `inst-${p.id}`,
        at: String(p.paid_at),
        kind: "in",
        amount: Number(p.amount || 0),
        label: `কিস্তি আদায় — কিস্তি নং ${p.installments?.installment_no ?? "-"}`,
        detail: p.note ?? null,
        method: "cash",
        counts: true,
      });
    });
    (cd ?? []).forEach((e: any) => {
      const isDeposit = e.entry_type === "deposit";
      const isBaki = isBakiPayment(e);
      const isReturn = isReturnEntry(e);

      let counts = false;
      let kind: "in" | "out" = isDeposit ? "in" : "out";
      let label = `${isDeposit ? "ক্যাশবুক জমা" : "উত্তোলন"}${e.category ? ` — ${e.category}` : ""}`;

      if (isDeposit && isBaki) {
        counts = true;
        kind = "in";
        label = `বাকি আদায় — ${e.party_name || e.notes || "কাস্টমার"}`;
      } else if (!isDeposit && isReturn) {
        counts = true;
        kind = "out";
        label = `বিক্রয় ফেরত রিফান্ড — ${e.party_name || e.notes || "কাস্টমার"}`;
      }

      out.push({
        id: `cb-${e.id}`,
        at: String(e.created_at || `${date}T00:00:00+06:00`),
        kind,
        amount: Number(e.amount || 0),
        label,
        detail: e.party_name ?? e.notes ?? null,
        method: e.payment_method ?? "cash",
        counts,
      });
    });
    (ed ?? []).forEach((x: any) => {
      out.push({
        id: `exp-${x.id}`,
        at: String(x.created_at ?? `${date}T00:00:00+06:00`),
        kind: "out",
        amount: Number(x.amount || 0),
        label: `খরচ — ${x.title}`,
        detail: null,
        method: x.payment_method ?? "cash",
        counts: true,
      });
    });

    out.sort((a, b) => a.at.localeCompare(b.at));
    setRows(out);
    setLoading(false);
  }, [date, currentShop?.id]);

  useEffect(() => { loadDay(); }, [loadDay]);

  const totals = useMemo(() => {
    const income = rows.filter(r => r.counts && r.kind === "in").reduce((s, r) => s + r.amount, 0);
    const expense = rows.filter(r => r.counts && r.kind === "out").reduce((s, r) => s + r.amount, 0);
    const withdraw = rows.filter(r => !r.counts && r.kind === "out").reduce((s, r) => s + r.amount, 0);
    const deposit = rows.filter(r => !r.counts && r.kind === "in").reduce((s, r) => s + r.amount, 0);
    return { income, expense, closing: income - expense, withdraw, deposit };
  }, [rows]);

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-[1200px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Link to="/ledger" className="p-2 rounded-xl bg-muted hover:bg-muted/70 transition-colors shrink-0" aria-label="ফিরে যান">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-lg sm:text-2xl font-black text-foreground truncate">দৈনিক হিসাব ক্লোজ</h1>
            <p className="text-[11px] sm:text-xs text-muted-foreground">দিনের নগদ আদায় − দিনের খরচ = দিনের ক্লোজিং (স্বয়ংক্রিয়)</p>
          </div>
        </div>
        <div className="w-full sm:w-auto">
          <Label className="text-[11px] text-muted-foreground">তারিখ</Label>
          <Input type="date" value={date} max={todayBD()} onChange={e => setDate(e.target.value)}
            className="h-11 sm:h-10 w-full sm:w-[170px]" />
        </div>
      </div>

      {/* Quick date chips */}
      <div className="-mx-1 px-1 overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 min-w-max">
          {[
            { label: "আজ", d: todayBD() },
            { label: "গতকাল", d: addDaysBDStr(todayBD(), -1) },
            { label: "গত পরশু", d: addDaysBDStr(todayBD(), -2) },
          ].map(c => (
            <button key={c.d} onClick={() => setDate(c.d)}
              className={`px-4 py-2 rounded-full text-xs font-bold border-2 transition-colors whitespace-nowrap ${
                date === c.d ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground/80 border-border hover:bg-muted"
              }`}>{c.label}</button>
          ))}
        </div>
      </div>

      <DailyCloseStats totals={totals} loading={loading} />

      {/* Day history */}
      <Card>
        <CardContent className="p-0">
          <div className="px-3 sm:px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
            <p className="font-bold text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> {fmtDateBD(date)} — সকল লেনদেন (সময় অনুসারে)
            </p>
            <span className="text-xs text-muted-foreground">{rows.length.toLocaleString("bn-BD")} টি এন্ট্রি</span>
          </div>

          {/* Mobile list */}
          <div className="sm:hidden divide-y divide-border/40">
            {loading ? (
              <div className="p-8 text-center text-muted-foreground">লোড হচ্ছে…</div>
            ) : rows.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">এই দিনে কোনো লেনদেন হয়নি</div>
            ) : rows.map((r, i) => (
              <div key={r.id} className="p-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-muted-foreground">{(i + 1).toLocaleString("bn-BD")}</span>
                    <p className="font-bold text-sm truncate">{r.label}</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{fmtDateTimeBD(r.at)}</p>
                  {r.detail && <p className="text-[11px] text-muted-foreground truncate">{r.detail}</p>}
                  {!r.counts && (
                    <span className="mt-1 inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      ক্লোজিং হিসাবের বাইরে
                    </span>
                  )}
                </div>
                <div className={`font-black text-sm shrink-0 ${r.kind === "in" ? "text-emerald-600" : "text-rose-600"}`}>
                  {r.kind === "in" ? "+" : "−"}{fmt(r.amount)}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold">#</th>
                  <th className="px-3 py-2 font-bold">সময়</th>
                  <th className="px-3 py-2 font-bold">বিবরণ</th>
                  <th className="px-3 py-2 font-bold text-right">জমা (+)</th>
                  <th className="px-3 py-2 font-bold text-right">খরচ (−)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 text-muted-foreground">{(i + 1).toLocaleString("bn-BD")}</td>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTimeBD(r.at)}</td>
                    <td className="px-3 py-2">
                      <p className="font-semibold text-foreground">{r.label}</p>
                      {r.detail && <p className="text-[11px] text-muted-foreground">{r.detail}</p>}
                      {!r.counts && <p className="text-[10px] text-muted-foreground">ক্লোজিং হিসাবের বাইরে</p>}
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-600">{r.kind === "in" ? fmt(r.amount) : "—"}</td>
                    <td className="px-3 py-2 text-right font-bold text-rose-600">{r.kind === "out" ? fmt(r.amount) : "—"}</td>
                  </tr>
                ))}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">এই দিনে কোনো লেনদেন হয়নি</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">লোড হচ্ছে…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/** ৩টি কার্ড — দৈনিক হিসাব ক্লোজ (হিসাব ব্যবস্থাপনাতেও ব্যবহৃত) */
export function DailyCloseStats({
  totals, loading,
}: { totals: { income: number; expense: number; closing: number; withdraw?: number }; loading?: boolean }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
      <Card className="border-l-4 border-l-emerald-500">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-muted-foreground">
            <ArrowDownToLine className="h-4 w-4 text-emerald-500" /> সারাদিনের বিক্রয়/আদায় (নগদ)
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-emerald-600">
            {loading ? "…" : fmt(totals.income)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">ডাউন পেমেন্ট + নগদ বিক্রয় + কিস্তি আদায়</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-rose-500">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-muted-foreground">
            <ArrowUpFromLine className="h-4 w-4 text-rose-500" /> সারাদিনের খরচ
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-rose-600">
            {loading ? "…" : fmt(totals.expense)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1">শুধুমাত্র খরচ এন্ট্রি (উত্তোলন এখানে ধরা হয় না)</p>
        </CardContent>
      </Card>
      <Card className="border-l-4 border-l-primary">
        <CardContent className="p-3 sm:p-4">
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold text-muted-foreground">
            <Coins className="h-4 w-4 text-primary" /> হিসাব ক্লোজ (দিনের নীট)
          </div>
          <p className="mt-1.5 text-xl sm:text-2xl font-black text-primary">
            {loading ? "…" : fmt(totals.closing)}
          </p>
          <p className="text-[11px] text-muted-foreground mt-1 inline-flex items-center gap-1">
            <Wallet className="h-3 w-3" /> আদায় − খরচ (স্বয়ংক্রিয়, ম্যানুয়াল ক্লোজের প্রয়োজন নেই)
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
