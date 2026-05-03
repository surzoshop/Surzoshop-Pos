import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Calendar, AlertTriangle, CheckCircle2, Plus, Trash2 } from "lucide-react";
import { PageHeader, StatusPill, SurfaceCard, PrimaryButton } from "@/components/PageHeader";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function Installments() {
  const { t, fmt, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [paying, setPaying] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [filter, setFilter] = useState<"all" | "pending" | "overdue" | "paid">("all");

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
    down_payment: 0, interest_rate: 0, tenure_months: 6, late_fee_per_day: 0, notes: "",
    first_due: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
  });

  const load = async () => {
    const [{ data }, c, p, g] = await Promise.all([
      supabase.from("installments").select("*, sales(invoice_no, customers(name, phone))").order("due_date"),
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.from("products").select("id,name,price,stock").order("name"),
      supabase.from("guarantors").select("id,name,phone").order("name"),
    ]);
    const today = new Date().toISOString().slice(0, 10);
    const enriched = (data ?? []).map(i => ({
      ...i,
      status: i.status === "paid" ? "paid" : (i.due_date < today ? "overdue" : "pending"),
    }));
    setItems(enriched);
    setCustomers(c.data ?? []); setProducts(p.data ?? []); setGuarantors(g.data ?? []);
  };
  useEffect(() => { load(); }, []);

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
      down_payment: 0, interest_rate: 0, tenure_months: 6, late_fee_per_day: 0, notes: "",
      first_due: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10) });
    load();
  };

  const pay = async () => {
    if (amount <= 0) return;
    const { error } = await supabase.from("installment_payments").insert({
      installment_id: paying.id, amount, received_by: user!.id,
    });
    if (error) return toast({ title: error.message, variant: "destructive" });
    setPaying(null); setAmount(0); load();
    toast({ title: t("paid") });
  };

  const filtered = filter === "all" ? items : items.filter(i => i.status === filter);
  const counts = {
    pending: items.filter(i => i.status === "pending").length,
    overdue: items.filter(i => i.status === "overdue").length,
    paid: items.filter(i => i.status === "paid").length,
    totalDue: items.filter(i => i.status !== "paid").reduce((a, b) => a + Number(b.amount) - Number(b.paid_amount), 0),
  };

  return (
    <div>
      <PageHeader title={t("installments")} subtitle={t("installmentsSubtitle")}
        actions={<PrimaryButton onClick={() => setOpenNew(true)}><Plus className="h-5 w-5" />{lang === "bn" ? "নতুন কিস্তি" : "New Installment"}</PrimaryButton>} />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
        <SummaryCard icon={<Calendar className="h-6 w-6 text-info" />} bg="bg-info/10"
          label={t("pending")} value={counts.pending.toString()} />
        <SummaryCard icon={<AlertTriangle className="h-6 w-6 text-destructive" />} bg="bg-destructive/10"
          label={t("overdue")} value={counts.overdue.toString()} />
        <SummaryCard icon={<CheckCircle2 className="h-6 w-6 text-primary" />} bg="bg-primary/10"
          label={t("completed")} value={counts.paid.toString()} />
        <SummaryCard icon={<Wallet className="h-6 w-6 text-[hsl(var(--secondary-foreground))]" />} bg="bg-secondary/30"
          label={t("pendingDue")} value={fmt(counts.totalDue)} />
      </div>

      <SurfaceCard className="p-6">
        {/* Filter chips */}
        <div className="flex gap-3 overflow-x-auto pb-2 mb-6">
          {(["all", "pending", "overdue", "paid"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-5 py-2 rounded-full font-medium whitespace-nowrap text-sm transition-all ${
                filter === f
                  ? "bg-primary text-primary-foreground"
                  : "bg-[hsl(var(--surface-container-low))] text-muted-foreground hover:bg-[hsl(var(--surface-container))]"
              }`}>
              {f === "all" ? t("filterAll") : t(f as any)}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">{t("invoice")}</th>
                <th className="pb-6 font-bold">{t("customer")}</th>
                <th className="pb-6 font-bold">#</th>
                <th className="pb-6 font-bold">{t("dueDate")}</th>
                <th className="pb-6 font-bold">{t("amount")}</th>
                <th className="pb-6 font-bold">{t("status")}</th>
                <th className="pb-6 font-bold text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>
              )}
              {filtered.map(i => {
                const tone = i.status === "paid" ? "success" : i.status === "overdue" ? "destructive" : "warning";
                return (
                  <tr key={i.id} className="hover:bg-[hsl(var(--surface-container-low))] transition-colors">
                    <td className="py-4 font-semibold">{i.sales?.invoice_no}</td>
                    <td className="py-4">{i.sales?.customers?.name ?? "—"}</td>
                    <td className="py-4">{i.installment_no}</td>
                    <td className="py-4">{new Date(i.due_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                    <td className="py-4 font-bold text-foreground">{fmt(Number(i.amount))}</td>
                    <td className="py-4"><StatusPill tone={tone}>{t(i.status as any)}</StatusPill></td>
                    <td className="py-4 text-right">
                      {i.status !== "paid" && (
                        <Button size="sm" className="gradient-primary text-primary-foreground"
                          onClick={() => { setPaying(i); setAmount(Number(i.amount) - Number(i.paid_amount)); }}>
                          <Wallet className="h-4 w-4 mr-1" />{t("pay")}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

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
            {/* Customer + Guarantor */}
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
                <div className="flex gap-2">
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
            </div>

            {/* Items */}
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

            {/* Loan terms */}
            <div className="border-t border-[hsl(var(--surface-container-high))] pt-3 space-y-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--secondary-foreground))]">{t("loanTerms")}</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div><Label>{t("downPayment")}</Label><Input type="number" value={plan.down_payment} onChange={e => setPlan({ ...plan, down_payment: +e.target.value || 0 })} /></div>
                <div><Label>{t("tenureMonths")}</Label><Input type="number" min={1} max={60} value={plan.tenure_months} onChange={e => setPlan({ ...plan, tenure_months: Math.max(1, +e.target.value) })} /></div>
                <div><Label>{t("interestRate")}</Label><Input type="number" value={plan.interest_rate} onChange={e => setPlan({ ...plan, interest_rate: +e.target.value || 0 })} /></div>
                <div><Label>{t("lateFee")}</Label><Input type="number" value={plan.late_fee_per_day} onChange={e => setPlan({ ...plan, late_fee_per_day: +e.target.value || 0 })} /></div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>{lang === "bn" ? "প্রথম কিস্তির তারিখ" : "First due date"}</Label><Input type="date" value={plan.first_due} onChange={e => setPlan({ ...plan, first_due: e.target.value })} /></div>
                <div><Label>{lang === "bn" ? "নোট" : "Notes"}</Label><Input value={plan.notes} onChange={e => setPlan({ ...plan, notes: e.target.value })} /></div>
              </div>
            </div>

            {/* Summary */}
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
    <div className="bg-[hsl(var(--surface-container-lowest))] p-6 rounded-2xl transition-all hover:-translate-y-1">
      <div className={`p-3 ${bg} rounded-xl w-fit mb-4`}>{icon}</div>
      <p className="text-muted-foreground text-sm font-medium">{label}</p>
      <h3 className="text-2xl font-bold text-foreground mt-1">{value}</h3>
    </div>
  );
}
