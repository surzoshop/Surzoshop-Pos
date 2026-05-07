import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Calendar, AlertTriangle, CheckCircle2, Plus, Trash2, Settings2, User, Phone, CalendarDays, Percent, Banknote, Clock } from "lucide-react";
import { PageHeader, StatusPill, SurfaceCard, PrimaryButton } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Inst = any;
type Plan = {
  sale_id: string;
  invoice_no: string;
  customer_name: string;
  customer_phone?: string;
  total: number;
  down_payment: number;
  tenure_months: number;
  late_fee_pct: number;
  start_date: string;
  paid: number;
  due: number;
  installments: Inst[];
};

const DAY = 1000 * 60 * 60 * 24;

export default function Installments() {
  const { t, fmt, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<Inst[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [paying, setPaying] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "completed">("all");
  const [managing, setManaging] = useState<Plan | null>(null);

  // ===== New Installment Plan Modal =====
  const [openNew, setOpenNew] = useState(false);
  const [customers, setCustomers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [showG, setShowG] = useState(false);
  const [gForm, setGForm] = useState<any>({ name: "", phone: "", nid: "", address: "", relation: "" });
  const [plan, setPlan] = useState<any>({
    customer_id: "", guarantor_id: "",
    items: [] as any[], pid: "", qty: 1, price: 0,
    down_payment: 2000, interest_rate: 0, tenure_months: 5, late_fee_per_day: 5, notes: "",
    first_due: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  });

  const load = async () => {
    const [{ data: insts }, { data: salesData }, c, p, g] = await Promise.all([
      supabase.from("installments").select("*, sales(invoice_no, customers(name, phone))").order("due_date"),
      supabase.from("sales").select("id, invoice_no, total, down_payment, tenure_months, late_fee_per_day, paid, due, created_at, customers(name, phone)").eq("payment_type", "installment" as any).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.from("products").select("id,name,price,stock").order("name"),
      supabase.from("guarantors").select("id,name,phone").order("name"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const enriched = (insts ?? []).map(i => ({
      ...i,
      derived_status: i.status === "paid" ? "paid" : (i.due_date < today ? "overdue" : "pending"),
    }));
    setItems(enriched);
    setSales(salesData ?? []);
    setCustomers(c.data ?? []); setProducts(p.data ?? []); setGuarantors(g.data ?? []);
  };
  useEffect(() => { load(); }, []);

  // Build plans from sales + grouped installments
  const plans: Plan[] = useMemo(() => {
    const byS: Record<string, Inst[]> = {};
    for (const i of items) (byS[i.sale_id] ||= []).push(i);
    return sales.map(s => {
      const sched = (byS[s.id] ?? []).sort((a, b) => a.installment_no - b.installment_no);
      return {
        sale_id: s.id,
        invoice_no: s.invoice_no,
        customer_name: s.customers?.name ?? "—",
        customer_phone: s.customers?.phone,
        total: Number(s.total),
        down_payment: Number(s.down_payment ?? 0),
        tenure_months: Number(s.tenure_months ?? sched.length),
        late_fee_pct: Number(s.late_fee_per_day ?? 0),
        start_date: sched[0]?.due_date ?? s.created_at,
        paid: Number(s.paid),
        due: Number(s.due),
        installments: sched,
      };
    });
  }, [items, sales]);

  const filteredPlans = useMemo(() => {
    if (filter === "all") return plans;
    return plans.filter(p => {
      if (filter === "completed") return p.due <= 0;
      if (filter === "overdue") return p.installments.some(i => i.derived_status === "overdue");
      return p.due > 0; // active
    });
  }, [plans, filter]);

  // ===== Plan calculations =====
  const planSubtotal = plan.items.reduce((a: number, b: any) => a + b.subtotal, 0);
  const interestAmount = (planSubtotal - plan.down_payment) * (plan.interest_rate / 100) * (plan.tenure_months / 12);
  const planTotal = planSubtotal + interestAmount;
  const financed = Math.max(planTotal - plan.down_payment, 0);
  const emi = plan.tenure_months > 0 ? financed / plan.tenure_months : 0;

  const addPlanItem = () => {
    const prod = products.find(x => x.id === plan.pid);
    if (!prod || plan.qty <= 0) return;
    setPlan({
      ...plan,
      items: [...plan.items, { product_id: prod.id, product_name: prod.name, qty: plan.qty, unit_price: plan.price || prod.price, subtotal: plan.qty * (plan.price || prod.price) }],
      pid: "", qty: 1, price: 0,
    });
  };

  const saveGuarantor = async () => {
    if (!gForm.name) return toast({ title: "Name required", variant: "destructive" });
    const { data, error } = await supabase.from("guarantors").insert(gForm).select().single();
    if (error) return toast({ title: error.message, variant: "destructive" });
    setGuarantors([data, ...guarantors]); setPlan({ ...plan, guarantor_id: data.id }); setShowG(false);
    setGForm({ name: "", phone: "", nid: "", address: "", relation: "" });
  };

  const savePlan = async () => {
    if (!plan.customer_id) return toast({ title: lang === "bn" ? "ক্রেতা নির্বাচন করুন" : "Select customer", variant: "destructive" });
    if (plan.items.length === 0) return toast({ title: lang === "bn" ? "পণ্য যোগ করুন" : "Add items", variant: "destructive" });
    if (!plan.guarantor_id) return toast({ title: lang === "bn" ? "জামিনদার নির্বাচন করুন" : "Select guarantor", variant: "destructive" });
    if (plan.tenure_months <= 0) return toast({ title: "Invalid tenure", variant: "destructive" });

    const { data: sale, error } = await supabase.from("sales").insert({
      customer_id: plan.customer_id,
      subtotal: planSubtotal, discount: 0, total: planTotal,
      paid: plan.down_payment, due: financed,
      payment_type: "installment" as any,
      status: financed > 0 ? "partial" : "completed" as any,
      created_by: user!.id,
      down_payment: plan.down_payment, interest_rate: plan.interest_rate,
      tenure_months: plan.tenure_months, emi_amount: emi,
      late_fee_per_day: plan.late_fee_per_day, guarantor_id: plan.guarantor_id,
      notes: plan.notes,
    } as any).select().single();
    if (error) return toast({ title: error.message, variant: "destructive" });

    const saleItems = plan.items.map((i: any) => ({ ...i, sale_id: sale.id }));
    await supabase.from("sale_items").insert(saleItems);

    const per = Math.round((financed / plan.tenure_months) * 100) / 100;
    const firstDue = new Date(plan.first_due);
    const schedule = Array.from({ length: plan.tenure_months }).map((_, idx) => {
      const d = new Date(firstDue); d.setMonth(d.getMonth() + idx);
      return {
        sale_id: sale.id, installment_no: idx + 1,
        due_date: d.toISOString().slice(0, 10),
        amount: idx === plan.tenure_months - 1 ? financed - per * (plan.tenure_months - 1) : per,
      };
    });
    await supabase.from("installments").insert(schedule);

    toast({ title: lang === "bn" ? "কিস্তি প্ল্যান তৈরি হয়েছে" : "Installment plan created" });
    setOpenNew(false);
    setPlan({ customer_id: "", guarantor_id: "", items: [], pid: "", qty: 1, price: 0,
      down_payment: 2000, interest_rate: 0, tenure_months: 5, late_fee_per_day: 5, notes: "",
      first_due: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10) });
    load();
  };

  const computeLateFee = (i: Inst, pct: number) => {
    if (i.derived_status !== "overdue") return 0;
    return Math.round(Number(i.amount) * (pct / 100));
  };
  const overdueDays = (i: Inst) => {
    if (i.derived_status !== "overdue") return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(i.due_date).getTime()) / DAY));
  };

  const pay = async () => {
    if (amount <= 0) return;
    const { error } = await supabase.from("installment_payments").insert({
      installment_id: paying.id, amount, received_by: user!.id,
    });
    if (error) return toast({ title: error.message, variant: "destructive" });
    setPaying(null); setAmount(0); await load();
    toast({ title: t("paid") });
    // refresh managing plan
    if (managing) {
      const fresh = plans.find(p => p.sale_id === managing.sale_id);
      if (fresh) setManaging(fresh);
    }
  };

  // Refresh managing plan when underlying data updates
  useEffect(() => {
    if (!managing) return;
    const fresh = plans.find(p => p.sale_id === managing.sale_id);
    if (fresh) setManaging(fresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [plans]);

  const counts = {
    active: plans.filter(p => p.due > 0).length,
    overdue: plans.filter(p => p.installments.some(i => i.derived_status === "overdue")).length,
    completed: plans.filter(p => p.due <= 0).length,
    totalDue: plans.reduce((a, b) => a + b.due, 0),
  };

  return (
    <div>
      <PageHeader title={t("installments")} subtitle={t("installmentsSubtitle")}
        actions={<PrimaryButton onClick={() => setOpenNew(true)}><Plus className="h-5 w-5" />{lang === "bn" ? "নতুন কিস্তি" : "New Installment"}</PrimaryButton>} />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
        <SummaryCard icon={<Calendar className="h-5 w-5" />} accent="from-info to-info/70" iconText="text-info-foreground"
          label={lang === "bn" ? "চলমান" : "Active"} value={counts.active.toString()} delay={0} />
        <SummaryCard icon={<AlertTriangle className="h-5 w-5" />} accent="from-destructive to-destructive/70" iconText="text-destructive-foreground"
          label={t("overdue")} value={counts.overdue.toString()} delay={60} />
        <SummaryCard icon={<CheckCircle2 className="h-5 w-5" />} accent="from-primary to-primary-glow" iconText="text-primary-foreground"
          label={t("completed")} value={counts.completed.toString()} delay={120} />
        <SummaryCard icon={<Wallet className="h-5 w-5" />} accent="from-secondary to-secondary/60" iconText="text-[hsl(var(--secondary-foreground))]"
          label={t("pendingDue")} value={fmt(counts.totalDue)} delay={180} />
      </div>

      <SurfaceCard className="p-4 md:p-6">
        {/* Filter chips */}
        <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2 mb-6">
          {(["all", "active", "overdue", "completed"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-4 md:px-5 py-2 rounded-full font-medium whitespace-nowrap text-sm transition-all ${
                filter === f ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--surface-container-low))] text-muted-foreground hover:bg-[hsl(var(--surface-container))]"
              }`}>
              {f === "all" ? t("filterAll") : f === "active" ? (lang === "bn" ? "চলমান" : "Active") : t(f as any)}
            </button>
          ))}
        </div>

        {filteredPlans.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">{t("noResults")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPlans.map(p => {
              const hasOverdue = p.installments.some(i => i.derived_status === "overdue");
              const tone = p.due <= 0 ? "success" : hasOverdue ? "destructive" : "info";
              const label = p.due <= 0 ? t("completed") : hasOverdue ? t("overdue") : (lang === "bn" ? "চলমান" : "Active");
              const paidCount = p.installments.filter(i => i.derived_status === "paid").length;
              return (
                <div key={p.sale_id} className="bg-[hsl(var(--surface-container-low))] rounded-2xl p-5 border border-[hsl(var(--surface-container-high))]/40 hover:border-primary/40 transition-all hover:-translate-y-0.5">
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{p.invoice_no}</div>
                      <div className="font-bold text-foreground text-lg truncate flex items-center gap-2 mt-0.5">
                        <User className="h-4 w-4 text-primary shrink-0" />{p.customer_name}
                      </div>
                      {p.customer_phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{p.customer_phone}</div>}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill tone={tone}>{label}</StatusPill>
                      <button onClick={() => setManaging(p)} title={t("managePlan")}
                        className="p-2 rounded-lg bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground transition-all">
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mb-4 text-xs">
                    <Cell icon={<Banknote className="h-3.5 w-3.5" />} label={t("planTotal")} value={fmt(p.total)} />
                    <Cell icon={<Wallet className="h-3.5 w-3.5" />} label={t("downPayment")} value={fmt(p.down_payment)} />
                    <Cell icon={<CalendarDays className="h-3.5 w-3.5" />} label={t("noOfInstallments")} value={`${p.tenure_months} ${t("months")}`} />
                    <Cell icon={<Percent className="h-3.5 w-3.5" />} label={t("lateFee")} value={`${p.late_fee_pct}%`} />
                  </div>

                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                    {t("startDate")}: {p.start_date ? new Date(p.start_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US") : "—"}
                  </div>

                  <div className="flex items-center justify-between bg-[hsl(var(--surface-container-lowest))] rounded-xl p-3 text-sm">
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("paid")}</div>
                      <div className="font-bold text-primary">{fmt(p.paid)} <span className="text-[10px] text-muted-foreground">({paidCount}/{p.tenure_months})</span></div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{t("due")}</div>
                      <div className="font-bold text-destructive">{fmt(p.due)}</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* Manage Plan Sheet */}
      <Sheet open={!!managing} onOpenChange={o => !o && setManaging(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{t("managePlan")} — {managing?.invoice_no}</SheetTitle>
          </SheetHeader>
          {managing && (
            <div className="mt-6 space-y-5">
              {/* Header summary */}
              <div className="bg-[hsl(var(--surface-container-low))] rounded-2xl p-4">
                <div className="font-bold text-lg flex items-center gap-2"><User className="h-4 w-4 text-primary" />{managing.customer_name}</div>
                {managing.customer_phone && <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{managing.customer_phone}</div>}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4 text-sm">
                  <Stat label={t("planTotal")} value={fmt(managing.total)} />
                  <Stat label={t("downPayment")} value={fmt(managing.down_payment)} />
                  <Stat label={t("noOfInstallments")} value={`${managing.tenure_months}`} />
                  <Stat label={t("lateFee")} value={`${managing.late_fee_pct}%`} />
                  <Stat label={t("frequency")} value={t("monthly")} />
                  <Stat label={t("startDate")} value={managing.start_date ? new Date(managing.start_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US") : "—"} />
                  <Stat label={t("paid")} value={fmt(managing.paid)} tone="primary" />
                  <Stat label={t("due")} value={fmt(managing.due)} tone="destructive" />
                </div>
              </div>

              {/* Schedule */}
              <div>
                <div className="text-[11px] uppercase tracking-widest text-muted-foreground font-bold mb-3">{t("schedule")}</div>
                <div className="space-y-2">
                  {/* Down payment row */}
                  {managing.down_payment > 0 && (
                    <div className="flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">DP</div>
                        <div>
                          <div className="font-semibold text-sm">{t("downPayment")}</div>
                          <div className="text-xs text-muted-foreground">{managing.start_date ? new Date(managing.start_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US") : "—"}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{fmt(managing.down_payment)}</div>
                        <StatusPill tone="success">{t("paid")}</StatusPill>
                      </div>
                    </div>
                  )}
                  {managing.installments.map(i => {
                    const status = i.derived_status as "paid" | "overdue" | "pending";
                    const tone = status === "paid" ? "success" : status === "overdue" ? "destructive" : "warning";
                    const fee = computeLateFee(i, managing.late_fee_pct);
                    const days = overdueDays(i);
                    const remaining = Math.max(0, Number(i.amount) - Number(i.paid_amount));
                    const payable = remaining + fee;
                    return (
                      <div key={i.id} className={`rounded-xl px-4 py-3 border ${status === "overdue" ? "bg-destructive/5 border-destructive/30" : status === "paid" ? "bg-primary/5 border-primary/20" : "bg-[hsl(var(--surface-container-low))] border-[hsl(var(--surface-container-high))]/40"}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${status === "paid" ? "bg-primary/10 text-primary" : status === "overdue" ? "bg-destructive/10 text-destructive" : "bg-[hsl(var(--surface-container-high))] text-foreground"}`}>
                              {i.installment_no}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-sm">{lang === "bn" ? `কিস্তি ${i.installment_no}` : `Installment ${i.installment_no}`}</div>
                              <div className="text-xs text-muted-foreground flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {new Date(i.due_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}
                                {days > 0 && <span className="text-destructive">• {days} {t("overdueDays")}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-bold">{fmt(Number(i.amount))}</div>
                            {fee > 0 && <div className="text-[10px] text-destructive font-semibold">+{fmt(fee)} {t("lateFeeAccrued")}</div>}
                            <StatusPill tone={tone}>{t(status as any)}</StatusPill>
                          </div>
                        </div>
                        {status !== "paid" && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--surface-container-high))]/40">
                            <div className="text-xs">
                              <span className="text-muted-foreground">{t("payable")}: </span>
                              <span className="font-bold text-foreground">{fmt(payable)}</span>
                            </div>
                            <Button size="sm" className="gradient-primary text-primary-foreground"
                              onClick={() => { setPaying(i); setAmount(payable); }}>
                              <Wallet className="h-4 w-4 mr-1" />{t("pay")}
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Pay dialog */}
      <Dialog open={!!paying} onOpenChange={o => !o && setPaying(null)}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>{t("payInstallment")}</DialogTitle></DialogHeader>
          {paying && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{paying.sales?.invoice_no} • {t("amount")}: {fmt(Number(paying.amount))}</div>
              <div><Label>{t("amount")}</Label><Input type="number" value={amount} onChange={e => setAmount(+e.target.value)} /></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>{t("cancel")}</Button>
            <Button onClick={pay} className="gradient-primary">{t("pay")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New Installment Plan */}
      <Dialog open={openNew} onOpenChange={setOpenNew}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-3xl max-h-[92vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{lang === "bn" ? "নতুন কিস্তি প্ল্যান" : "New Installment Plan"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("customer")}</Label>
                <Select value={plan.customer_id || "_n"} onValueChange={v => setPlan({ ...plan, customer_id: v === "_n" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_n">—</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `(${c.phone})` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t("guarantor")}</Label>
                <Select value={plan.guarantor_id || "_n"} onValueChange={v => v === "__new" ? setShowG(true) : setPlan({ ...plan, guarantor_id: v === "_n" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_n">—</SelectItem>
                    {guarantors.map(g => <SelectItem key={g.id} value={g.id}>{g.name} {g.phone ? `(${g.phone})` : ""}</SelectItem>)}
                    <SelectItem value="__new">+ {t("add")} {t("guarantor")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="border-t border-[hsl(var(--surface-container-high))] pt-3">
              <Label className="mb-2 block">{t("items")}</Label>
              <div className="grid grid-cols-12 gap-2 mb-2">
                <Select value={plan.pid || "_n"} onValueChange={v => { const id = v === "_n" ? "" : v; const p = products.find(x => x.id === id); setPlan({ ...plan, pid: id, price: p ? Number(p.price) : 0 }); }}>
                  <SelectTrigger className="col-span-5"><SelectValue placeholder={t("products")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_n">—</SelectItem>
                    {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Input className="col-span-2" type="number" placeholder={t("qty")} value={plan.qty} onChange={e => setPlan({ ...plan, qty: +e.target.value })} />
                <Input className="col-span-3" type="number" placeholder={t("price")} value={plan.price} onChange={e => setPlan({ ...plan, price: +e.target.value })} />
                <Button className="col-span-2" onClick={addPlanItem}>{t("add")}</Button>
              </div>
              {plan.items.map((i: any, idx: number) => (
                <div key={idx} className="flex justify-between items-center text-sm bg-[hsl(var(--surface-container-low))] rounded-lg px-3 py-2 mb-1">
                  <span className="font-medium">{i.product_name}</span>
                  <div className="flex items-center gap-3">
                    <span className="text-muted-foreground">{i.qty} × {fmt(i.unit_price)}</span>
                    <span className="font-bold">{fmt(i.subtotal)}</span>
                    <button onClick={() => setPlan({ ...plan, items: plan.items.filter((_: any, x: number) => x !== idx) })} className="text-destructive"><Trash2 className="h-4 w-4" /></button>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-[hsl(var(--surface-container-high))] pt-3 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--secondary-foreground))]">{t("loanTerms")}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>{t("downPayment")}</Label><Input type="number" value={plan.down_payment} onChange={e => setPlan({ ...plan, down_payment: +e.target.value || 0 })} /></div>
                <div><Label>{t("noOfInstallments")}</Label><Input type="number" min={1} max={60} value={plan.tenure_months} onChange={e => setPlan({ ...plan, tenure_months: Math.max(1, +e.target.value) })} /></div>
                <div><Label>{t("interestRate")}</Label><Input type="number" value={plan.interest_rate} onChange={e => setPlan({ ...plan, interest_rate: +e.target.value || 0 })} /></div>
                <div><Label>{t("lateFee")}</Label><Input type="number" value={plan.late_fee_per_day} onChange={e => setPlan({ ...plan, late_fee_per_day: +e.target.value || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{lang === "bn" ? "প্রথম কিস্তির তারিখ" : "First due date"}</Label><Input type="date" value={plan.first_due} onChange={e => setPlan({ ...plan, first_due: e.target.value })} /></div>
                <div><Label>{lang === "bn" ? "নোট" : "Notes"}</Label><Input value={plan.notes} onChange={e => setPlan({ ...plan, notes: e.target.value })} /></div>
              </div>
            </div>

            <div className="bg-secondary/15 rounded-xl p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">{t("subtotal")}</span><span>{fmt(planSubtotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{lang === "bn" ? "সুদ" : "Interest"}</span><span>{fmt(interestAmount)}</span></div>
              <div className="flex justify-between font-bold"><span>{t("total")}</span><span>{fmt(planTotal)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">{t("downPayment")}</span><span>−{fmt(plan.down_payment)}</span></div>
              <div className="flex justify-between text-destructive font-bold border-t border-secondary/40 pt-1.5"><span>{lang === "bn" ? "অর্থায়িত পরিমাণ" : "Financed"}</span><span>{fmt(financed)}</span></div>
              <div className="flex justify-between text-primary font-black text-base pt-1"><span>EMI / {t("months")}</span><span>{fmt(emi)}</span></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenNew(false)}>{t("cancel")}</Button>
            <Button onClick={savePlan} className="gradient-primary">{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick Guarantor */}
      <Dialog open={showG} onOpenChange={setShowG}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>{t("add")} {t("guarantor")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("name")}</Label><Input value={gForm.name} onChange={e => setGForm({ ...gForm, name: e.target.value })} /></div>
              <div><Label>{t("relation")}</Label><Input value={gForm.relation} onChange={e => setGForm({ ...gForm, relation: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("phone")}</Label><Input value={gForm.phone} onChange={e => setGForm({ ...gForm, phone: e.target.value })} /></div>
              <div><Label>{t("nid")}</Label><Input value={gForm.nid} onChange={e => setGForm({ ...gForm, nid: e.target.value })} /></div>
            </div>
            <div><Label>{t("address")}</Label><Input value={gForm.address} onChange={e => setGForm({ ...gForm, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowG(false)}>{t("cancel")}</Button>
            <Button onClick={saveGuarantor} className="gradient-primary">{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryCard({ icon, bg, label, value }: any) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-5 rounded-2xl transition-all hover:-translate-y-1">
      <div className={`p-2.5 ${bg} rounded-xl w-fit mb-3`}>{icon}</div>
      <p className="text-muted-foreground text-xs font-medium">{label}</p>
      <h3 className="text-xl md:text-2xl font-bold text-foreground mt-1">{value}</h3>
    </div>
  );
}

function Cell({ icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] rounded-lg px-3 py-2">
      <div className="flex items-center gap-1 text-muted-foreground text-[10px] uppercase tracking-wider font-bold">{icon}{label}</div>
      <div className="font-bold text-foreground text-sm mt-0.5">{value}</div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "primary" | "destructive" }) {
  const cls = tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{label}</div>
      <div className={`font-bold ${cls}`}>{value}</div>
    </div>
  );
}
