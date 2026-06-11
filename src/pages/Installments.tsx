import { useEffect, useMemo, useState } from "react";
import { todayBD, bdDateAddMonths, addDaysBDStr } from "@/lib/datetime";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Calendar, AlertTriangle, CheckCircle2, Plus, Trash2, Settings2, User, Phone, CalendarDays, Percent, Banknote, Clock, Search, X } from "lucide-react";
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
  sale_date: string;
  paid: number;
  due: number;
  installments: Inst[];
  extra_charge?: number;
  items_text?: string;
};


const DAY = 1000 * 60 * 60 * 24;
const INSTALLMENT_DUE_DAY = 5;

const addMonthsToDateStr = (dateStr: string, monthsToAdd: number) => {
  const [year, month, day] = dateStr.split("-").map(Number);
  const targetMonthIndex = month - 1 + monthsToAdd;
  const targetYear = year + Math.floor(targetMonthIndex / 12);
  const targetMonth = ((targetMonthIndex % 12) + 12) % 12;
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
  const targetDay = Math.min(day, daysInMonth);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
};

export default function Installments() {
  const { t, fmt, lang } = useT();
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const { toast } = useToast();
  const [items, setItems] = useState<Inst[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [paying, setPaying] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [filter, setFilter] = useState<"all" | "active" | "overdue" | "completed" | "due_today" | "due_tomorrow" | "due_yesterday" | "due_5d" | "overdue_5d" | "this_month">("all");
  const [searchQ, setSearchQ] = useState("");
  const [managing, setManaging] = useState<Plan | null>(null);
  const [paymentsByInst, setPaymentsByInst] = useState<Record<string, any[]>>({});
  const [extraBySale, setExtraBySale] = useState<Record<string, number>>({});
  const [itemsBySale, setItemsBySale] = useState<Record<string, string[]>>({});
  const [editPay, setEditPay] = useState<any>(null);
  const [editPayAmount, setEditPayAmount] = useState(0);

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
    first_due: bdDateAddMonths(1, INSTALLMENT_DUE_DAY),
  });

  const load = async () => {
    const [{ data: insts }, { data: salesData }, c, p, g, { data: pays }, { data: siExtras }] = await Promise.all([
      supabase.from("installments").select("*, sales(invoice_no, customers(name, phone))").order("due_date"),
      supabase.from("sales").select("id, invoice_no, total, down_payment, tenure_months, late_fee_per_day, paid, due, created_at, customers(name, phone)").eq("payment_type", "installment" as any).order("created_at", { ascending: false }),
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.from("products").select("id,name,price,stock,credit_extra,installment_extra").order("name"),
      supabase.from("guarantors").select("id,name,phone").order("name"),
      supabase.from("installment_payments").select("*").order("paid_at", { ascending: false }),
      supabase.from("sale_items").select("sale_id,qty,product_name,products(installment_extra)"),
    ]);
    const today = todayBD();
    const enriched = (insts ?? []).map(i => ({
      ...i,
      derived_status: i.status === "paid" ? "paid" : (i.due_date < today ? "overdue" : "pending"),
    }));
    setItems(enriched);
    setSales(salesData ?? []);
    setCustomers(c.data ?? []); setProducts(p.data ?? []); setGuarantors(g.data ?? []);
    const grouped: Record<string, any[]> = {};
    for (const p of pays ?? []) (grouped[p.installment_id] ||= []).push(p);
    setPaymentsByInst(grouped);
    const extras: Record<string, number> = {};
    const names: Record<string, string[]> = {};
    for (const r of (siExtras ?? []) as any[]) {
      const x = Number(r.products?.installment_extra ?? 0) * Number(r.qty ?? 0);
      if (x) extras[r.sale_id] = (extras[r.sale_id] ?? 0) + x;
      if (r.product_name) {
        const label = `${r.product_name}${Number(r.qty) > 1 ? ` ×${r.qty}` : ""}`;
        (names[r.sale_id] ||= []).push(label);
      }
    }
    setExtraBySale(extras);
    setItemsBySale(names);
  };
  useEffect(() => { load(); }, []);

  const saveEditPay = async () => {
    if (!editPay || editPayAmount < 0) return;
    const { error } = await supabase.from("installment_payments")
      .update({ amount: editPayAmount }).eq("id", editPay.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setEditPay(null); setEditPayAmount(0); await load();
    toast({ title: lang === "bn" ? "পরিশোধ আপডেট হয়েছে ✓" : "Payment updated ✓" });
  };

  const deletePay = async (p: any) => {
    if (!confirm(lang === "bn" ? `${fmt(Number(p.amount))} টাকার পরিশোধ মুছে ফেলবেন?` : `Delete payment of ${fmt(Number(p.amount))}?`)) return;
    const { error } = await supabase.from("installment_payments").delete().eq("id", p.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    await load();
    toast({ title: lang === "bn" ? "পরিশোধ মুছে ফেলা হয়েছে" : "Payment deleted" });
  };


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
        sale_date: s.created_at,

        paid: Number(s.paid),
        due: Number(s.due),
        installments: sched,
        extra_charge: extraBySale[s.id] ?? 0,
        items_text: (itemsBySale[s.id] ?? []).join(", "),
      };
    });
  }, [items, sales, extraBySale, itemsBySale]);

  const filteredPlans = useMemo(() => {
    const today = todayBD();
    const q = searchQ.trim().toLowerCase();
    let list = plans;

    if (filter !== "all") {
      list = list.filter(p => {
        if (filter === "completed") return p.due <= 0;
        if (filter === "overdue") return p.installments.some(i => i.derived_status === "overdue");
        if (filter === "active") return p.due > 0;
        if (filter === "due_today") {
          return p.installments.some(i => i.derived_status !== "paid" && i.due_date === today);
        }
        if (filter === "due_tomorrow") {
          const tomorrow = addDaysBDStr(today, 1);
          return p.installments.some(i => i.derived_status !== "paid" && i.due_date === tomorrow);
        }
        if (filter === "due_yesterday") {
          const yesterday = addDaysBDStr(today, -1);
          return p.installments.some(i => i.derived_status !== "paid" && i.due_date === yesterday);
        }
        if (filter === "due_5d") {
          const limit = addDaysBDStr(today, 5);
          return p.installments.some(i => i.derived_status !== "paid" && i.due_date >= today && i.due_date <= limit);
        }
        if (filter === "overdue_5d") {
          const start = addDaysBDStr(today, -5);
          return p.installments.some(i => i.derived_status !== "paid" && i.due_date >= start && i.due_date < today);
        }
        if (filter === "this_month") {
          const ym = today.slice(0, 7);
          return p.installments.some(i => i.derived_status !== "paid" && i.due_date.slice(0, 7) === ym);
        }
        return true;
      });
    }

    if (q) {
      list = list.filter(p =>
        p.customer_name.toLowerCase().includes(q) ||
        p.invoice_no.toLowerCase().includes(q) ||
        (p.customer_phone ?? "").toLowerCase().includes(q) ||
        (p.items_text ?? "").toLowerCase().includes(q)
      );
    }

    return list;
  }, [plans, filter, searchQ]);


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
    const schedule = Array.from({ length: plan.tenure_months }).map((_, idx) => {
      return {
        sale_id: sale.id, installment_no: idx + 1,
        due_date: addMonthsToDateStr(plan.first_due || bdDateAddMonths(1, INSTALLMENT_DUE_DAY), idx),
        amount: idx === plan.tenure_months - 1 ? financed - per * (plan.tenure_months - 1) : per,
      };
    });
    await supabase.from("installments").insert(schedule);

    toast({ title: lang === "bn" ? "কিস্তি প্ল্যান তৈরি হয়েছে" : "Installment plan created" });
    setOpenNew(false);
    setPlan({ customer_id: "", guarantor_id: "", items: [], pid: "", qty: 1, price: 0,
      down_payment: 2000, interest_rate: 0, tenure_months: 5, late_fee_per_day: 5, notes: "",
      first_due: bdDateAddMonths(1, INSTALLMENT_DUE_DAY) });
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
    if (!paying) return;
    // For staff: amount is fixed (remaining + late fee). Only admin can override.
    const remaining = Math.max(0, Number(paying.amount) - Number(paying.paid_amount));
    const fee = computeLateFee(paying, managing?.late_fee_pct ?? 0);
    const fixedPayable = remaining + fee;
    const finalAmount = isAdmin ? amount : fixedPayable;
    if (finalAmount <= 0) return;
    const { error } = await supabase.from("installment_payments").insert({
      installment_id: paying.id, amount: finalAmount, received_by: user!.id,
    });
    if (error) return toast({ title: error.message, variant: "destructive" });
    setPaying(null); setAmount(0); await load();
    toast({ title: t("paid") });
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
        {/* Filter chips + search */}
        <div className="flex flex-col md:flex-row md:items-center gap-3 mb-6">
          <div className="flex gap-2 md:gap-3 overflow-x-auto pb-2">
            {([
              { k: "all", bn: "সব", en: "All" },
              { k: "due_today", bn: "আজ কিস্তি", en: "Due Today" },
              { k: "due_yesterday", bn: "গতকাল", en: "Due Yesterday" },
              { k: "due_5d", bn: "আগামী ৫ দিন", en: "Next 5 days" },
              { k: "overdue_5d", bn: "গত ৫ দিন", en: "Last 5 days" },
              { k: "this_month", bn: "এই মাস", en: "This month" },
              { k: "active", bn: "চলমান", en: "Active" },
              { k: "overdue", bn: "মেয়াদ উত্তীর্ণ", en: "Overdue" },
              { k: "completed", bn: "সম্পন্ন", en: "Completed" },
            ] as const).map(({ k, bn, en }) => (
              <button key={k} onClick={() => setFilter(k as any)}
                className={`px-4 md:px-5 py-2 rounded-full font-medium whitespace-nowrap text-sm transition-all ${
                  filter === k ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--surface-container-low))] text-muted-foreground hover:bg-[hsl(var(--surface-container))]"
                }`}>
                {lang === "bn" ? bn : en}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-72 md:ml-auto shrink-0">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQ}
              onChange={e => setSearchQ(e.target.value)}
              placeholder={lang === "bn" ? "ক্রেতা / ইনভয়েস খুঁজুন…" : "Search customer / invoice…"}
              className="w-full rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--surface-container-lowest))] pl-9 pr-9 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {searchQ && (
              <button
                onClick={() => setSearchQ("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                aria-label="Clear"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>


        {filteredPlans.length === 0 ? (
          <div className="py-16 text-center text-muted-foreground">{t("noResults")}</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredPlans.map((p, idx) => {
              const hasOverdue = p.installments.some(i => i.derived_status === "overdue");
              const tone = p.due <= 0 ? "success" : hasOverdue ? "destructive" : "info";
              const label = p.due <= 0 ? t("completed") : hasOverdue ? t("overdue") : (lang === "bn" ? "চলমান" : "Active");
              const accentBar = p.due <= 0 ? "from-primary to-primary-glow" : hasOverdue ? "from-destructive to-destructive/60" : "from-info to-info/60";
              const paidCount = p.installments.filter(i => i.derived_status === "paid").length;
              return (
                <div key={p.sale_id} style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
                  className="relative overflow-hidden bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-5 shadow-sm hover:shadow-lg border border-[hsl(var(--surface-container-high))]/40 hover:border-primary/40 transition-all hover:-translate-y-1 animate-fade-in">
                  <div className={`absolute top-0 left-0 h-1 w-full bg-gradient-to-r ${accentBar}`} />
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div className="min-w-0">
                      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold">{p.invoice_no}</div>
                      <div className="font-bold text-foreground text-lg truncate flex items-center gap-2 mt-0.5">
                        <User className="h-4 w-4 text-primary shrink-0" />{p.customer_name}
                      </div>
                      {p.customer_phone && <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{p.customer_phone}</div>}
                      {p.items_text && (
                        <div className="text-[11px] text-foreground font-semibold mt-1.5 line-clamp-2 leading-snug bg-[hsl(var(--surface-container-low))] rounded-md px-2 py-1" title={p.items_text}>
                          🛒 {p.items_text}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <StatusPill tone={tone}>{label}</StatusPill>
                      <button onClick={() => setManaging(p)} title={t("managePlan")}
                        className="p-2 rounded-lg gradient-primary text-primary-foreground hover:brightness-110 active:scale-95 transition-all shadow-sm">
                        <Settings2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 mb-4">
                    <Cell icon={<Banknote className="h-4 w-4" />} label={t("planTotal")} value={fmt(p.total)} accent="from-primary/15 to-primary/5" iconColor="text-primary" border="border-primary/20" />
                    <Cell icon={<Wallet className="h-4 w-4" />} label={t("downPayment")} value={fmt(p.down_payment)} accent="from-info/15 to-info/5" iconColor="text-info" border="border-info/20" />
                    <Cell icon={<CalendarDays className="h-4 w-4" />} label={t("noOfInstallments")} value={`${p.tenure_months} ${t("months")}`} accent="from-secondary/30 to-secondary/10" iconColor="text-[hsl(var(--secondary-foreground))]" border="border-secondary/40" />
                    <Cell icon={<Percent className="h-4 w-4" />} label={t("lateFee")} value={`${p.late_fee_pct}%`} accent="from-destructive/15 to-destructive/5" iconColor="text-destructive" border="border-destructive/20" />
                  </div>

                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                    {t("startDate")}: {p.start_date ? new Date(p.start_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" }) : "—"}
                  </div>

                  {(p.extra_charge ?? 0) > 0 && (
                    <div className="flex items-center justify-between bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 mb-2 text-xs">
                      <span className="font-bold text-amber-700 dark:text-amber-400">
                        {lang === "bn" ? "কিস্তিতে অতিরিক্ত চার্জ" : "Installment Extra Charge"}
                      </span>
                      <span className="font-extrabold text-amber-700 dark:text-amber-400">+{fmt(p.extra_charge ?? 0)}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between bg-gradient-to-r from-[hsl(var(--surface-container-low))] to-[hsl(var(--surface-container))] rounded-xl p-3 text-sm border border-[hsl(var(--surface-container-high))]/40">
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
              <div className="bg-gradient-to-br from-[hsl(var(--surface-container-low))] to-[hsl(var(--surface-container))] rounded-2xl p-5 animate-fade-in">
                <div className="font-bold text-xl flex items-center gap-2"><User className="h-5 w-5 text-primary" />{managing.customer_name}</div>
                {managing.customer_phone && <div className="text-sm text-muted-foreground flex items-center gap-1 mt-1"><Phone className="h-3 w-3" />{managing.customer_phone}</div>}
                {managing.items_text && (
                  <div className="mt-3 bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))]/40 rounded-xl px-3 py-2">
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-1">
                      {lang === "bn" ? "ক্রয়কৃত পণ্য" : "Purchased Items"}
                    </div>
                    <div className="text-sm text-foreground font-medium">🛒 {managing.items_text}</div>
                  </div>
                )}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
                  <Stat icon={<Banknote className="h-4 w-4" />} label={t("planTotal")} value={fmt(managing.total)} accent="from-primary/15 to-primary/5" iconColor="text-primary" border="border-primary/25" delay={0} />
                  <Stat icon={<Wallet className="h-4 w-4" />} label={t("downPayment")} value={fmt(managing.down_payment)} accent="from-info/15 to-info/5" iconColor="text-info" border="border-info/25" delay={50} />
                  <Stat icon={<CalendarDays className="h-4 w-4" />} label={t("noOfInstallments")} value={`${managing.tenure_months}`} accent="from-secondary/30 to-secondary/10" iconColor="text-[hsl(var(--secondary-foreground))]" border="border-secondary/40" delay={100} />
                  <Stat icon={<Percent className="h-4 w-4" />} label={t("lateFee")} value={`${managing.late_fee_pct}%`} accent="from-destructive/15 to-destructive/5" iconColor="text-destructive" border="border-destructive/25" delay={150} />
                  <Stat icon={<Clock className="h-4 w-4" />} label={t("frequency")} value={t("monthly")} accent="from-primary/10 to-primary/5" iconColor="text-primary" border="border-primary/20" delay={200} />
                  <Stat icon={<CalendarDays className="h-4 w-4" />} label={t("startDate")} value={managing.start_date ? new Date(managing.start_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" }) : "—"} accent="from-info/10 to-info/5" iconColor="text-info" border="border-info/20" delay={250} />
                  <Stat icon={<CheckCircle2 className="h-4 w-4" />} label={t("paid")} value={fmt(managing.paid)} accent="from-primary/20 to-primary/5" iconColor="text-primary" valueColor="text-primary" border="border-primary/30" delay={300} />
                  <Stat icon={<AlertTriangle className="h-4 w-4" />} label={t("due")} value={fmt(managing.due)} accent="from-destructive/20 to-destructive/5" iconColor="text-destructive" valueColor="text-destructive" border="border-destructive/30" delay={350} />
                </div>
              </div>

              {/* Schedule */}
              <div>
                <div className="text-sm uppercase tracking-widest text-muted-foreground font-bold mb-3">{t("schedule")}</div>
                <div className="space-y-3">
                  {/* Down payment row */}
                  {managing.down_payment > 0 && (
                    <div className="flex items-center justify-between bg-gradient-to-r from-primary/15 to-primary/5 border-2 border-primary/30 rounded-2xl px-5 py-4 shadow-sm hover:shadow-md transition-all animate-fade-in">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-xl gradient-primary text-primary-foreground flex items-center justify-center font-black text-sm shadow-md">DP</div>
                        <div>
                          <div className="font-bold text-base">{t("downPayment")}</div>
                          <div className="text-sm text-muted-foreground">{managing.sale_date ? new Date(managing.sale_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" }) : "—"}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-black text-lg text-primary">{fmt(managing.down_payment)}</div>
                        <StatusPill tone="success">{t("paid")}</StatusPill>
                      </div>
                    </div>
                  )}
                  {managing.installments.map((i, idx) => {
                    const status = i.derived_status as "paid" | "overdue" | "pending";
                    const tone = status === "paid" ? "success" : status === "overdue" ? "destructive" : "warning";
                    const fee = computeLateFee(i, managing.late_fee_pct);
                    const days = overdueDays(i);
                    const remaining = Math.max(0, Number(i.amount) - Number(i.paid_amount));
                    const payable = remaining + fee;
                    const rowBg = status === "overdue"
                      ? "bg-gradient-to-r from-destructive/15 to-destructive/5 border-destructive/30"
                      : status === "paid"
                        ? "bg-gradient-to-r from-primary/15 to-primary/5 border-primary/25"
                        : "bg-gradient-to-r from-info/10 to-info/5 border-info/20";
                    const badgeBg = status === "paid"
                      ? "gradient-primary text-primary-foreground"
                      : status === "overdue"
                        ? "bg-gradient-to-br from-destructive to-destructive/70 text-destructive-foreground"
                        : "bg-gradient-to-br from-info to-info/70 text-info-foreground";
                    return (
                      <div key={i.id} style={{ animationDelay: `${Math.min(idx, 12) * 40}ms` }}
                        className={`rounded-2xl px-5 py-4 border-2 shadow-sm hover:shadow-md transition-all animate-fade-in ${rowBg}`}>
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-black text-base shadow-md ${badgeBg}`}>
                              {i.installment_no}
                            </div>
                            <div className="min-w-0">
                              <div className="font-bold text-base">{lang === "bn" ? `কিস্তি ${i.installment_no}` : `Installment ${i.installment_no}`}</div>
                              <div className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                                <Clock className="h-3.5 w-3.5" />
                                {new Date(i.due_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}
                                {days > 0 && <span className="text-destructive font-semibold">• {days} {t("overdueDays")}</span>}
                              </div>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="font-black text-lg">{fmt(Number(i.amount))}</div>
                            {fee > 0 && <div className="text-xs text-destructive font-bold">+{fmt(fee)} {t("lateFeeAccrued")}</div>}
                            <StatusPill tone={tone}>{t(status as any)}</StatusPill>
                          </div>
                        </div>
                        {status !== "paid" && (
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-[hsl(var(--surface-container-high))]/50">
                            <div className="text-sm">
                              <span className="text-muted-foreground">{t("payable")}: </span>
                              <span className="font-black text-foreground">{fmt(payable)}</span>
                            </div>
                            <Button size="sm" className="gradient-primary text-primary-foreground shadow-md hover:brightness-110"
                              onClick={() => { setPaying(i); setAmount(payable); }}>
                              <Wallet className="h-4 w-4 mr-1" />{lang === "bn" ? "কিস্তি পরিশোধ করুন" : "Pay Installment"}
                            </Button>
                          </div>
                        )}
                        {isAdmin && (paymentsByInst[i.id]?.length ?? 0) > 0 && (
                          <div className="mt-3 pt-3 border-t border-[hsl(var(--surface-container-high))]/50">
                            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold mb-2">
                              {lang === "bn" ? "নেওয়া পরিশোধসমূহ (অ্যাডমিন)" : "Received Payments (Admin)"}
                            </div>
                            <div className="space-y-1.5">
                              {paymentsByInst[i.id].map((pay: any) => (
                                <div key={pay.id} className="flex items-center justify-between bg-[hsl(var(--surface-container-lowest))] rounded-lg px-3 py-2 text-sm border border-[hsl(var(--surface-container-high))]/40">
                                  <div className="min-w-0">
                                    <div className="font-bold text-foreground">{fmt(Number(pay.amount))}</div>
                                    <div className="text-[11px] text-muted-foreground">
                                      {new Date(pay.paid_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button onClick={() => { setEditPay(pay); setEditPayAmount(Number(pay.amount)); }}
                                      className="p-1.5 rounded-md hover:bg-primary/10 text-primary" title={lang === "bn" ? "এডিট" : "Edit"}>
                                      <Settings2 className="h-4 w-4" />
                                    </button>
                                    <button onClick={() => deletePay(pay)}
                                      className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive" title={lang === "bn" ? "ডিলিট" : "Delete"}>
                                      <Trash2 className="h-4 w-4" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
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
              <div>
                <Label>{t("amount")}</Label>
                <Input
                  type="number"
                  value={amount}
                  onChange={e => isAdmin && setAmount(+e.target.value)}
                  readOnly={!isAdmin}
                  disabled={!isAdmin}
                  className={!isAdmin ? "bg-[hsl(var(--surface-container))] cursor-not-allowed font-bold text-foreground opacity-100" : ""}
                />
                {!isAdmin && (
                  <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1">
                    🔒 {lang === "bn" ? "পরিমাণ নির্ধারিত — শুধু অ্যাডমিন পরিবর্তন করতে পারবেন।" : "Amount is fixed — only admin can edit."}
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaying(null)}>{t("cancel")}</Button>
            <Button onClick={pay} className="gradient-primary">{t("pay")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit received payment (admin only) */}
      <Dialog open={!!editPay} onOpenChange={o => !o && setEditPay(null)}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader>
            <DialogTitle>{lang === "bn" ? "পরিশোধ সংশোধন" : "Edit Payment"}</DialogTitle>
          </DialogHeader>
          {editPay && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {lang === "bn" ? "মূল পরিমাণ" : "Original"}: <b>{fmt(Number(editPay.amount))}</b>
                {" • "}{new Date(editPay.paid_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}
              </div>
              <div>
                <Label>{lang === "bn" ? "নতুন পরিমাণ (৳)" : "New Amount (৳)"}</Label>
                <Input type="number" value={editPayAmount} onChange={e => setEditPayAmount(+e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1.5">
                  {lang === "bn" ? "পার্থক্য স্বয়ংক্রিয়ভাবে কিস্তি ও বিক্রয়ে সমন্বয় হবে।" : "Difference auto-adjusts the installment & sale."}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditPay(null)}>{t("cancel")}</Button>
            <Button onClick={saveEditPay} className="gradient-primary">{t("save")}</Button>
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

function SummaryCard({ icon, accent, iconText, label, value, delay = 0 }: any) {
  return (
    <div style={{ animationDelay: `${delay}ms` }}
      className="relative overflow-hidden bg-[hsl(var(--surface-container-lowest))] p-5 rounded-2xl shadow-sm hover:shadow-lg transition-all hover:-translate-y-1 animate-fade-in border border-[hsl(var(--surface-container-high))]/40">
      <div className={`absolute -top-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${accent} opacity-20 blur-2xl`} />
      <div className={`p-2.5 bg-gradient-to-br ${accent} rounded-xl w-fit mb-3 shadow-md ${iconText}`}>{icon}</div>
      <p className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">{label}</p>
      <h3 className="text-xl md:text-2xl font-black text-foreground mt-1">{value}</h3>
    </div>
  );
}

function Cell({ icon, label, value, accent, iconColor, border }: { icon: any; label: string; value: string; accent: string; iconColor: string; border: string }) {
  return (
    <div className={`bg-gradient-to-br ${accent} rounded-xl px-3 py-2.5 border ${border} transition-all hover:-translate-y-0.5`}>
      <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold ${iconColor}`}>{icon}<span className="text-muted-foreground">{label}</span></div>
      <div className="font-black text-foreground text-sm mt-1">{value}</div>
    </div>
  );
}

function Stat({ icon, label, value, accent, iconColor, border, valueColor, delay = 0 }: { icon?: any; label: string; value: string; accent: string; iconColor: string; border: string; valueColor?: string; delay?: number }) {
  return (
    <div style={{ animationDelay: `${delay}ms` }}
      className={`bg-gradient-to-br ${accent} rounded-xl p-3 border ${border} animate-fade-in transition-all hover:-translate-y-0.5 hover:shadow-md`}>
      <div className={`flex items-center gap-1.5 text-[11px] uppercase tracking-widest font-bold ${iconColor}`}>{icon}<span className="text-muted-foreground">{label}</span></div>
      <div className={`font-black text-base mt-1 ${valueColor || "text-foreground"}`}>{value}</div>
    </div>
  );
}
