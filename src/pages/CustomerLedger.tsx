import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Search, Wallet, ShoppingBag, AlertCircle, Phone, User, BadgeDollarSign, History, X } from "lucide-react";
import { PageHeader, SurfaceCard, StatusPill, PrimaryButton } from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { fmtDateTimeBD } from "@/lib/datetime";
import { logActivity } from "@/lib/activityLog";

type DueCustomer = {
  id: string;
  name: string;
  phone: string | null;
  due: number;
  paid: number;
  total: number;
  sales: any[]; // open credit sales (due > 0)
};

export default function CustomerLedger() {
  const { t, lang, fmt } = useT();
  const { user } = useAuth();
  const { currentShop } = useShop();
  const { toast } = useToast();

  const [customers, setCustomers] = useState<any[]>([]);
  const [allSales, setAllSales] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<DueCustomer | null>(null);
  const [historyPayments, setHistoryPayments] = useState<any[]>([]);

  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<DueCustomer | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payNote, setPayNote] = useState("");
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const [{ data: c }, { data: s }] = await Promise.all([
      supabase.from("customers").select("id,name,phone").order("name"),
      // Credit (non-installment) sales — শুধু "বাকি" বিক্রয়
      supabase.from("sales")
        .select("id,invoice_no,created_at,total,paid,due,status,customer_id,payment_type,notes")
        .neq("payment_type", "installment" as any)
        .order("created_at", { ascending: true }),
    ]);
    setCustomers(c ?? []);
    setAllSales(s ?? []);
  };
  useEffect(() => { load(); }, []);

  const dueCustomers: DueCustomer[] = useMemo(() => {
    const byCust: Record<string, any[]> = {};
    for (const s of allSales) {
      if (!s.customer_id) continue;
      if (Number(s.due) <= 0) continue;
      (byCust[s.customer_id] ||= []).push(s);
    }
    const list: DueCustomer[] = [];
    for (const [cid, sales] of Object.entries(byCust)) {
      const cust = customers.find(c => c.id === cid);
      if (!cust) continue;
      list.push({
        id: cid,
        name: cust.name,
        phone: cust.phone ?? null,
        due: sales.reduce((a, s) => a + Number(s.due), 0),
        paid: sales.reduce((a, s) => a + Number(s.paid), 0),
        total: sales.reduce((a, s) => a + Number(s.total), 0),
        sales,
      });
    }
    return list.sort((a, b) => b.due - a.due);
  }, [allSales, customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dueCustomers;
    return dueCustomers.filter(c =>
      c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q)
    );
  }, [dueCustomers, search]);

  const totals = useMemo(() => ({
    customers: dueCustomers.length,
    totalDue: dueCustomers.reduce((a, c) => a + c.due, 0),
    totalSales: dueCustomers.reduce((a, c) => a + c.total, 0),
    totalPaid: dueCustomers.reduce((a, c) => a + c.paid, 0),
  }), [dueCustomers]);

  const openPay = (c: DueCustomer) => {
    setPayTarget(c);
    setPayAmount(c.due);
    setPayNote("");
    setPayOpen(true);
  };

  const submitPayment = async () => {
    if (!payTarget || !user) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast({ title: lang === "bn" ? "সঠিক পরিমাণ দিন" : "Enter valid amount", variant: "destructive" });
      return;
    }
    if (amt > payTarget.due + 0.001) {
      toast({ title: lang === "bn" ? "বকেয়ার চেয়ে বেশি দেওয়া যাবে না" : "Cannot exceed due", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      // Distribute across open sales (oldest first)
      let remaining = amt;
      const open = [...payTarget.sales].sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
      for (const s of open) {
        if (remaining <= 0) break;
        const sd = Number(s.due);
        const apply = Math.min(sd, remaining);
        const newPaid = Number(s.paid) + apply;
        const newDue = Math.max(sd - apply, 0);
        const newStatus = newDue <= 0 ? "completed" : "partial";
        const { error } = await supabase.from("sales")
          .update({ paid: newPaid, due: newDue, status: newStatus as any })
          .eq("id", s.id);
        if (error) throw error;
        remaining -= apply;
      }

      // Record into cash book as deposit (income)
      const { error: cbErr } = await supabase.from("cash_book" as any).insert({
        entry_type: "deposit",
        amount: amt,
        category: lang === "bn" ? "বাকি পরিশোধ" : "Credit Payment",
        party_name: payTarget.name,
        payment_method: "cash",
        notes: payNote || (lang === "bn" ? `${payTarget.name} - বাকি পরিশোধ` : `${payTarget.name} - credit settlement`),
        created_by: user.id,
        shop_id: currentShop?.id ?? null,
      });
      if (cbErr) throw cbErr;

      await logActivity({
        action: "credit_payment",
        entity_type: "customer",
        entity_id: payTarget.id,
        shop_id: currentShop?.id ?? null,
        meta: { amount: amt, customer: payTarget.name },
      });

      toast({ title: lang === "bn" ? "পরিশোধ সফল হয়েছে ✓" : "Payment recorded ✓" });
      setPayOpen(false);
      setPayTarget(null);
      setPayAmount(0);
      setPayNote("");
      await load();
      if (selected?.id === payTarget.id) {
        // refresh selected detail
        setSelected(prev => prev ? { ...prev } : prev);
      }
    } catch (e: any) {
      toast({ title: e.message ?? "Error", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  // load history (cash_book deposits + sales) for selected customer
  useEffect(() => {
    if (!selected) { setHistoryPayments([]); return; }
    (async () => {
      const { data } = await supabase.from("cash_book" as any)
        .select("id,entry_date,amount,party_name,notes,entry_type,created_at,category")
        .eq("party_name", selected.name)
        .eq("entry_type", "deposit")
        .order("created_at", { ascending: false });
      setHistoryPayments((data ?? []) as any);
    })();
  }, [selected, allSales]);

  return (
    <div>
      <PageHeader
        title={lang === "bn" ? "বাকি ম্যানেজমেন্ট" : "Due Management"}
        subtitle={lang === "bn" ? "যাদের বাকি আছে শুধু তাদের তালিকা ও পরিশোধ।" : "Only customers with outstanding credit dues."}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-6">
        <Stat icon={<User className="h-5 w-5 text-info" />} bg="bg-info/10" label={lang === "bn" ? "বাকি ক্রেতা" : "Due Customers"} value={totals.customers.toString()} />
        <Stat icon={<ShoppingBag className="h-5 w-5 text-primary" />} bg="bg-primary/10" label={lang === "bn" ? "মোট বিক্রয়" : "Total Sales"} value={fmt(totals.totalSales)} />
        <Stat icon={<Wallet className="h-5 w-5 text-emerald-600" />} bg="bg-emerald-500/10" label={lang === "bn" ? "মোট পরিশোধ" : "Total Paid"} value={fmt(totals.totalPaid)} />
        <Stat icon={<AlertCircle className="h-5 w-5 text-destructive" />} bg="bg-destructive/10" label={lang === "bn" ? "মোট বকেয়া" : "Total Due"} value={fmt(totals.totalDue)} />
      </div>

      <SurfaceCard className="p-4 md:p-6">
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder={lang === "bn" ? "নাম বা ফোন দিয়ে খুঁজুন..." : "Search by name or phone..."}
            className="w-full h-10 pl-9 pr-3 rounded-lg bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">
            {lang === "bn" ? "কোনো বকেয়া ক্রেতা নেই 🎉" : "No customers with dues 🎉"}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filtered.map(c => (
              <div key={c.id}
                className="relative overflow-hidden bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-4 shadow-sm hover:shadow-lg border border-[hsl(var(--surface-container-high))]/40 hover:border-primary/40 transition-all">
                <div className="absolute top-0 left-0 h-1 w-full bg-gradient-to-r from-destructive to-destructive/60" />
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <div className="font-bold text-foreground text-base truncate flex items-center gap-2">
                      <User className="h-4 w-4 text-primary shrink-0" />{c.name}
                    </div>
                    {c.phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{c.phone}</div>}
                  </div>
                  <StatusPill tone="destructive">{c.sales.length} {lang === "bn" ? "বিল" : "bills"}</StatusPill>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-3 text-center">
                  <MiniCell label={lang === "bn" ? "মোট" : "Total"} value={fmt(c.total)} />
                  <MiniCell label={lang === "bn" ? "পরিশোধ" : "Paid"} value={fmt(c.paid)} tone="text-emerald-600" />
                  <MiniCell label={lang === "bn" ? "বাকি" : "Due"} value={fmt(c.due)} tone="text-destructive" strong />
                </div>

                <div className="flex gap-2">
                  <Button onClick={() => openPay(c)} className="flex-1 gap-1.5">
                    <BadgeDollarSign className="h-4 w-4" />
                    {lang === "bn" ? "বাকি পরিশোধ" : "Pay Due"}
                  </Button>
                  <Button variant="outline" onClick={() => setSelected(c)} className="gap-1.5">
                    <History className="h-4 w-4" />
                    {lang === "bn" ? "ইতিহাস" : "History"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      {/* History Sheet */}
      {selected && (
        <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {selected.name} — {lang === "bn" ? "লেনদেন ইতিহাস" : "Transaction History"}
              </DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto space-y-4">
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground mb-2">
                  {lang === "bn" ? "বাকি বিক্রয়" : "Credit Sales"}
                </div>
                <div className="space-y-2">
                  {selected.sales.map(s => (
                    <div key={s.id} className="flex items-center justify-between gap-3 bg-muted/30 rounded-lg p-3">
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{s.invoice_no}</div>
                        <div className="text-[11px] text-muted-foreground">{fmtDateTimeBD(s.created_at, lang)}</div>
                      </div>
                      <div className="text-right text-xs">
                        <div>{lang === "bn" ? "মোট" : "Total"}: <b>{fmt(Number(s.total))}</b></div>
                        <div className="text-emerald-600">{lang === "bn" ? "পরিশোধ" : "Paid"}: {fmt(Number(s.paid))}</div>
                        <div className="text-destructive font-bold">{lang === "bn" ? "বাকি" : "Due"}: {fmt(Number(s.due))}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-xs font-bold uppercase text-muted-foreground mb-2">
                  {lang === "bn" ? "পরিশোধ ইতিহাস" : "Payment History"}
                </div>
                {historyPayments.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4">
                    {lang === "bn" ? "কোন পরিশোধ নেই" : "No payments yet"}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {historyPayments.map(p => (
                      <div key={p.id} className="flex items-center justify-between gap-3 bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
                        <div className="min-w-0">
                          <div className="text-sm font-bold truncate">{p.category ?? (lang === "bn" ? "বাকি পরিশোধ" : "Credit Payment")}</div>
                          <div className="text-[11px] text-muted-foreground">{fmtDateTimeBD(p.created_at, lang)}</div>
                          {p.notes && <div className="text-[11px] text-muted-foreground truncate">{p.notes}</div>}
                        </div>
                        <div className="text-emerald-600 font-bold">+{fmt(Number(p.amount))}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSelected(null)}>{lang === "bn" ? "বন্ধ করুন" : "Close"}</Button>
              <Button onClick={() => { setSelected(null); openPay(selected); }} className="gap-1.5">
                <BadgeDollarSign className="h-4 w-4" />
                {lang === "bn" ? "পরিশোধ করুন" : "Pay Now"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Pay Dialog */}
      <Dialog open={payOpen} onOpenChange={(o) => { if (!o) { setPayOpen(false); setPayTarget(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BadgeDollarSign className="h-5 w-5 text-primary" />
              {lang === "bn" ? "বাকি পরিশোধ" : "Pay Due"}
            </DialogTitle>
          </DialogHeader>
          {payTarget && (
            <div className="space-y-4">
              <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                <div className="text-sm font-bold">{payTarget.name}</div>
                {payTarget.phone && <div className="text-xs text-muted-foreground">{payTarget.phone}</div>}
                <div className="flex justify-between text-sm pt-2 border-t border-border/40 mt-2">
                  <span className="text-muted-foreground">{lang === "bn" ? "মোট বকেয়া" : "Total Due"}</span>
                  <span className="font-black text-destructive">{fmt(payTarget.due)}</span>
                </div>
              </div>
              <div>
                <Label>{lang === "bn" ? "পরিশোধের পরিমাণ" : "Amount"}</Label>
                <Input type="number" value={payAmount || ""} onChange={e => setPayAmount(Number(e.target.value))}
                  min={0} max={payTarget.due} step="0.01" autoFocus />
                <div className="flex gap-2 mt-2">
                  <button type="button" onClick={() => setPayAmount(payTarget.due)}
                    className="text-xs px-2 py-1 rounded bg-primary/10 text-primary hover:bg-primary/20">
                    {lang === "bn" ? "সম্পূর্ণ" : "Full"}
                  </button>
                  <button type="button" onClick={() => setPayAmount(Math.round(payTarget.due / 2))}
                    className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70">
                    {lang === "bn" ? "অর্ধেক" : "Half"}
                  </button>
                </div>
              </div>
              <div>
                <Label>{lang === "bn" ? "নোট (ঐচ্ছিক)" : "Note (optional)"}</Label>
                <Input value={payNote} onChange={e => setPayNote(e.target.value)} placeholder={lang === "bn" ? "নোট..." : "Note..."} />
              </div>
              {payAmount > 0 && payAmount <= payTarget.due && (
                <div className="text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 rounded-lg p-2 text-center">
                  {lang === "bn" ? "পরিশোধের পর বাকি থাকবে: " : "Remaining after payment: "}
                  <b>{fmt(payTarget.due - payAmount)}</b>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setPayOpen(false); setPayTarget(null); }} disabled={busy}>
              {lang === "bn" ? "বাতিল" : "Cancel"}
            </Button>
            <Button onClick={submitPayment} disabled={busy || !payAmount || payAmount <= 0} className="gap-1.5">
              <BadgeDollarSign className="h-4 w-4" />
              {busy ? (lang === "bn" ? "প্রসেসিং..." : "Processing...") : (lang === "bn" ? "পরিশোধ করুন" : "Pay")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, bg, label, value }: any) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-4 rounded-2xl flex items-center gap-3">
      <div className={`p-2.5 ${bg} rounded-xl`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-xs font-medium truncate">{label}</p>
        <h3 className="text-base md:text-lg font-bold text-foreground truncate">{value}</h3>
      </div>
    </div>
  );
}

function MiniCell({ label, value, tone, strong }: { label: string; value: string; tone?: string; strong?: boolean }) {
  return (
    <div className="bg-muted/30 rounded-lg py-2 px-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-bold">{label}</div>
      <div className={`text-sm ${strong ? "font-black" : "font-bold"} ${tone ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
