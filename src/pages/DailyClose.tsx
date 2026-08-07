import { useCallback, useEffect, useMemo, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import {
  ArrowDownToLine, ArrowUpFromLine, Coins, CalendarDays, Lock,
  CheckCircle2, ArrowLeft, History, ChevronRight,
} from "lucide-react";
import { todayBD, addDaysBDStr, fmtDateBD, fmtDateTimeBD } from "@/lib/datetime";

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD", { maximumFractionDigits: 2 })}`;

type Row = {
  id: string;
  at: string;           // ISO datetime for sorting/display
  kind: "in" | "out";
  amount: number;
  label: string;
  detail?: string | null;
  method?: string | null;
};

type Closing = {
  id: string;
  close_date: string;
  sales_cash: number;
  expense_total: number;
  carry_forward: number;
  closing_amount: number;
  notes: string | null;
  created_at: string;
};

export default function DailyClose() {
  const { user } = useAuth();
  const { currentShop } = useShop();

  const [date, setDate] = useState(todayBD());
  const [month, setMonth] = useState(todayBD().slice(0, 7));
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [carry, setCarry] = useState(0);
  const [carryDate, setCarryDate] = useState<string | null>(null);
  const [existing, setExisting] = useState<Closing | null>(null);
  const [monthClosings, setMonthClosings] = useState<Closing[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const shopFilter = <T,>(q: T): T => (currentShop ? (q as any).eq("shop_id", currentShop.id) : q);

  const loadDay = useCallback(async () => {
    setLoading(true);
    const dayStart = `${date}T00:00:00+06:00`;
    const dayEnd = `${addDaysBDStr(date, 1)}T00:00:00+06:00`;

    // Sales of the day
    let sq: any = supabase.from("sales")
      .select("id,invoice_no,created_at,total,paid,due,payment_type,customers(name)")
      .gte("created_at", dayStart).lt("created_at", dayEnd);
    sq = shopFilter(sq);

    // Installment / credit collections of the day
    let ipq: any = supabase.from("installment_payments")
      .select("id,amount,paid_at,note,installments!inner(sale_id,installment_no)")
      .gte("paid_at", dayStart).lt("paid_at", dayEnd);
    ipq = shopFilter(ipq);

    // Cash book entries of the day
    let cq: any = supabase.from("cash_book" as any).select("*").eq("entry_date", date);
    cq = shopFilter(cq);

    // Expenses of the day
    let eq: any = supabase.from("expenses").select("id,title,amount,expense_date,payment_method,created_at").eq("expense_date", date);
    eq = shopFilter(eq);

    // Last closing before this date (carry forward)
    let pq: any = supabase.from("daily_closings" as any).select("*")
      .lt("close_date", date).order("close_date", { ascending: false }).limit(1);
    pq = shopFilter(pq);

    // Existing closing for this date
    let exq: any = supabase.from("daily_closings" as any).select("*").eq("close_date", date).limit(1);
    exq = shopFilter(exq);

    const [{ data: sd }, { data: ipd }, { data: cd }, { data: ed }, { data: pd }, { data: exd }] =
      await Promise.all([sq, ipq, cq, eq, pq, exq]);

    // Installment payments (all time) belonging to the day's sales — so we don't
    // double count them inside sales.paid.
    const saleIds = (sd ?? []).map((s: any) => s.id);
    let instBySale = new Map<string, number>();
    if (saleIds.length) {
      const { data: insts } = await supabase.from("installments").select("id,sale_id").in("sale_id", saleIds);
      const instIds = (insts ?? []).map((i: any) => i.id);
      if (instIds.length) {
        const { data: pays } = await supabase.from("installment_payments").select("amount,installment_id").in("installment_id", instIds);
        const saleOf = new Map<string, string>((insts ?? []).map((i: any) => [i.id, i.sale_id]));
        (pays ?? []).forEach((p: any) => {
          const sid = saleOf.get(p.installment_id);
          if (!sid) return;
          instBySale.set(sid, (instBySale.get(sid) ?? 0) + Number(p.amount || 0));
        });
      }
    }

    const out: Row[] = [];
    (sd ?? []).forEach((s: any) => {
      const basePaid = Math.max(0, Number(s.paid || 0) - (instBySale.get(s.id) ?? 0));
      if (basePaid <= 0) return;
      out.push({
        id: `sale-${s.id}`,
        at: String(s.created_at),
        kind: "in",
        amount: basePaid,
        label: `বিক্রয় — ${s.invoice_no}`,
        detail: `${s.customers?.name ?? "নগদ কাস্টমার"}${Number(s.due || 0) > 0 ? ` • বাকি ${fmt(Number(s.due))}` : ""}`,
        method: "cash",
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
      });
    });
    (cd ?? []).forEach((e: any) => {
      out.push({
        id: `cb-${e.id}`,
        at: String(e.created_at),
        kind: e.entry_type === "deposit" ? "in" : "out",
        amount: Number(e.amount || 0),
        label: `${e.entry_type === "deposit" ? "ক্যাশবুক জমা" : "ক্যাশবুক উত্তোলন"}${e.category ? ` — ${e.category}` : ""}`,
        detail: e.party_name ?? e.notes ?? null,
        method: e.payment_method ?? "cash",
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
      });
    });

    // Serial-wise: earliest → latest
    out.sort((a, b) => a.at.localeCompare(b.at));
    setRows(out);

    const prev = (pd ?? [])[0] as any;
    setCarry(prev ? Number(prev.closing_amount || 0) : 0);
    setCarryDate(prev ? prev.close_date : null);
    setExisting(((exd ?? [])[0] as any) ?? null);
    setNotes((((exd ?? [])[0] as any)?.notes) ?? "");
    setLoading(false);
  }, [date, currentShop?.id]);

  const loadMonth = useCallback(async () => {
    const from = `${month}-01`;
    const [y, m] = month.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    const to = `${month}-${String(last).padStart(2, "0")}`;
    let q: any = supabase.from("daily_closings" as any).select("*")
      .gte("close_date", from).lte("close_date", to)
      .order("close_date", { ascending: false });
    q = shopFilter(q);
    const { data } = await q;
    setMonthClosings((data ?? []) as any);
  }, [month, currentShop?.id]);

  useEffect(() => { loadDay(); }, [loadDay]);
  useEffect(() => { loadMonth(); }, [loadMonth]);

  const totals = useMemo(() => {
    const cashIn = rows.filter(r => r.kind === "in").reduce((s, r) => s + r.amount, 0);
    const cashOut = rows.filter(r => r.kind === "out").reduce((s, r) => s + r.amount, 0);
    return { cashIn, cashOut, closing: carry + cashIn - cashOut };
  }, [rows, carry]);

  const monthTotal = useMemo(
    () => monthClosings.reduce((s, c) => s + Number(c.closing_amount || 0), 0),
    [monthClosings]
  );

  const saveClosing = async () => {
    setSaving(true);
    const payload: any = {
      shop_id: currentShop?.id ?? null,
      close_date: date,
      sales_cash: totals.cashIn,
      expense_total: totals.cashOut,
      carry_forward: carry,
      closing_amount: totals.closing,
      notes: notes || null,
      closed_by: user?.id ?? null,
    };
    const res = existing
      ? await supabase.from("daily_closings" as any).update(payload).eq("id", existing.id)
      : await supabase.from("daily_closings" as any).insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(existing ? "হিসাব আপডেট হয়েছে" : "দিনের হিসাব ক্লোজ হয়েছে");
    setDialogOpen(false);
    loadDay();
    loadMonth();
  };

  const monthLabel = (() => {
    const [y, m] = month.split("-").map(Number);
    return new Date(y, (m || 1) - 1, 1).toLocaleDateString("bn-BD", { month: "long", year: "numeric" });
  })();

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/ledger" className="p-2 rounded-xl bg-muted hover:bg-muted/70 transition-colors" aria-label="ফিরে যান">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-foreground">দৈনিক হিসাব ক্লোজ</h1>
            <p className="text-xs text-muted-foreground">প্রতিদিনের বিক্রয়, খরচ ও ক্লোজিং ব্যালেন্স — গতকালের জমা সহ</p>
          </div>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label className="text-[11px] text-muted-foreground">তারিখ</Label>
            <Input type="date" value={date} max={todayBD()} onChange={e => setDate(e.target.value)} className="h-10 w-[160px]" />
          </div>
          <div>
            <Label className="text-[11px] text-muted-foreground">মাস (হিস্ট্রি)</Label>
            <Input type="month" value={month} onChange={e => setMonth(e.target.value)} className="h-10 w-[150px]" />
          </div>
        </div>
      </div>

      {/* Quick date chips */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "আজ", d: todayBD() },
          { label: "গতকাল", d: addDaysBDStr(todayBD(), -1) },
          { label: "গত পরশু", d: addDaysBDStr(todayBD(), -2) },
        ].map(c => (
          <button
            key={c.d}
            onClick={() => setDate(c.d)}
            className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-colors ${
              date === c.d ? "bg-primary text-primary-foreground border-primary" : "bg-card text-foreground/80 border-border hover:bg-muted"
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* 3 stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <ArrowDownToLine className="h-4 w-4 text-emerald-500" /> সারাদিনের বিক্রয়/আদায় (নগদ)
            </div>
            <p className="mt-2 text-2xl font-black text-emerald-600">{fmt(totals.cashIn)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">ডাউন পেমেন্ট + নগদ বিক্রয় + কিস্তি আদায় + ক্যাশবুক জমা</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-rose-500">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              <ArrowUpFromLine className="h-4 w-4 text-rose-500" /> সারাদিনের খরচ/উত্তোলন
            </div>
            <p className="mt-2 text-2xl font-black text-rose-600">{fmt(totals.cashOut)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">খরচ এন্ট্রি + ক্যাশবুক উত্তোলন</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <Coins className="h-4 w-4 text-primary" /> হিসাব ক্লোজড
              </div>
              {existing && (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                  <CheckCircle2 className="h-3 w-3" /> ক্লোজড
                </span>
              )}
            </div>
            <p className="mt-2 text-2xl font-black text-primary">{fmt(totals.closing)}</p>
            <p className="text-[11px] text-muted-foreground mt-1">
              গতকালের জমা {fmt(carry)} + আয় − খরচ
            </p>
            <Button className="w-full mt-3 font-bold" disabled={loading} onClick={() => setDialogOpen(true)}>
              <Lock className="h-4 w-4 mr-1" /> {existing ? "হিসাব পুনরায় ক্লোজ করুন" : "হিসাব ক্লোজড"}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Carry forward note */}
      <Card className="bg-muted/40">
        <CardContent className="p-4 text-sm">
          <p className="font-bold text-foreground flex items-center gap-2">
            <History className="h-4 w-4 text-primary" /> গত দিনের জমা (ক্যারি ফরওয়ার্ড)
          </p>
          <p className="text-muted-foreground mt-1">
            {carryDate
              ? <>সর্বশেষ ক্লোজ করা দিন <b className="text-foreground">{fmtDateBD(carryDate)}</b> — সেই দিনের ক্লোজিং <b className="text-foreground">{fmt(carry)}</b> টাকা আজকের হিসাবের সাথে যুক্ত হয়েছে।</>
              : <>এর আগে কোনো দিনের হিসাব ক্লোজ করা হয়নি, তাই গত দিনের জমা ৺০ ধরা হয়েছে।</>}
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            হিসাব: {fmt(carry)} (গত দিনের জমা) + {fmt(totals.cashIn)} (আজকের আয়) − {fmt(totals.cashOut)} (আজকের খরচ) = <b className="text-primary">{fmt(totals.closing)}</b>
          </p>
        </CardContent>
      </Card>

      {/* Day history */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-primary" /> {fmtDateBD(date)} — দিনের সকল লেনদেন (সময় অনুসারে)
            </p>
            <span className="text-xs text-muted-foreground">{rows.length.toLocaleString("bn-BD")} টি এন্ট্রি</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold">#</th>
                  <th className="px-3 py-2 font-bold">সময়</th>
                  <th className="px-3 py-2 font-bold">বিবরণ</th>
                  <th className="px-3 py-2 font-bold text-right">জমা (+)</th>
                  <th className="px-3 py-2 font-bold text-right">খরচ (−)</th>
                  <th className="px-3 py-2 font-bold text-right">ব্যালেন্স</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-border bg-primary/5">
                  <td className="px-3 py-2 text-muted-foreground">০</td>
                  <td className="px-3 py-2 text-muted-foreground">—</td>
                  <td className="px-3 py-2 font-bold">
                    গত দিনের জমা {carryDate ? `(${fmtDateBD(carryDate)} এর ক্লোজিং)` : "(কোনো পূর্ববর্তী ক্লোজিং নেই)"}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-emerald-600">{fmt(carry)}</td>
                  <td className="px-3 py-2 text-right">—</td>
                  <td className="px-3 py-2 text-right font-bold">{fmt(carry)}</td>
                </tr>
                {(() => {
                  let bal = carry;
                  return rows.map((r, i) => {
                    bal += r.kind === "in" ? r.amount : -r.amount;
                    return (
                      <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{(i + 1).toLocaleString("bn-BD")}</td>
                        <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{fmtDateTimeBD(r.at)}</td>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-foreground">{r.label}</p>
                          {r.detail && <p className="text-[11px] text-muted-foreground">{r.detail}</p>}
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-emerald-600">{r.kind === "in" ? fmt(r.amount) : "—"}</td>
                        <td className="px-3 py-2 text-right font-bold text-rose-600">{r.kind === "out" ? fmt(r.amount) : "—"}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmt(bal)}</td>
                      </tr>
                    );
                  });
                })()}
                {!loading && rows.length === 0 && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">এই দিনে কোনো লেনদেন হয়নি</td></tr>
                )}
                {loading && (
                  <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">লোড হচ্ছে…</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Month-wise closing history */}
      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="font-bold text-sm flex items-center gap-2">
              <History className="h-4 w-4 text-primary" /> {monthLabel} — ক্লোজ করা দিনের হিসাব
            </p>
            <span className="text-xs font-bold text-primary">মোট ক্লোজিং: {fmt(monthTotal)}</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs">
                <tr className="text-left">
                  <th className="px-3 py-2 font-bold">তারিখ</th>
                  <th className="px-3 py-2 font-bold text-right">গত দিনের জমা</th>
                  <th className="px-3 py-2 font-bold text-right">বিক্রয়/আদায়</th>
                  <th className="px-3 py-2 font-bold text-right">খরচ</th>
                  <th className="px-3 py-2 font-bold text-right">ক্লোজিং</th>
                  <th className="px-3 py-2 font-bold">নোট</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {monthClosings.map(c => (
                  <tr key={c.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-3 py-2 font-semibold whitespace-nowrap">{fmtDateBD(c.close_date)}</td>
                    <td className="px-3 py-2 text-right">{fmt(Number(c.carry_forward))}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-bold">{fmt(Number(c.sales_cash))}</td>
                    <td className="px-3 py-2 text-right text-rose-600 font-bold">{fmt(Number(c.expense_total))}</td>
                    <td className="px-3 py-2 text-right text-primary font-black">{fmt(Number(c.closing_amount))}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">{c.notes ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => setDate(c.close_date)} className="text-primary inline-flex items-center text-xs font-bold">
                        দেখুন <ChevronRight className="h-3 w-3" />
                      </button>
                    </td>
                  </tr>
                ))}
                {monthClosings.length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-10 text-center text-muted-foreground">এই মাসে কোনো দিনের হিসাব ক্লোজ করা হয়নি</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Confirm dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{fmtDateBD(date)} — হিসাব ক্লোজ</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">গত দিনের জমা</span><b>{fmt(carry)}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">সারাদিনের বিক্রয়/আদায়</span><b className="text-emerald-600">+{fmt(totals.cashIn)}</b></div>
            <div className="flex justify-between"><span className="text-muted-foreground">সারাদিনের খরচ/উত্তোলন</span><b className="text-rose-600">−{fmt(totals.cashOut)}</b></div>
            <div className="flex justify-between border-t border-border pt-2"><span className="font-bold">ক্লোজিং ব্যালেন্স</span><b className="text-primary text-lg">{fmt(totals.closing)}</b></div>
            <div className="pt-2">
              <Label className="text-xs">নোট (ঐচ্ছিক)</Label>
              <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="যেমন: রাত ৯টায় হিসাব বন্ধ করা হয়েছে" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>বাতিল</Button>
            <Button onClick={saveClosing} disabled={saving} className="font-bold">
              <Lock className="h-4 w-4 mr-1" /> {saving ? "সেভ হচ্ছে…" : "নিশ্চিত করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
