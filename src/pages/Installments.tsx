import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Wallet, Calendar, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader, StatusPill, SurfaceCard } from "@/components/PageHeader";

export default function Installments() {
  const { t, fmt, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [paying, setPaying] = useState<any>(null);
  const [amount, setAmount] = useState(0);
  const [filter, setFilter] = useState<"all" | "pending" | "overdue" | "paid">("all");

  const load = async () => {
    const { data } = await supabase.from("installments")
      .select("*, sales(invoice_no, customers(name, phone))")
      .order("due_date");
    const today = new Date().toISOString().slice(0, 10);
    const enriched = (data ?? []).map(i => ({
      ...i,
      status: i.status === "paid" ? "paid" : (i.due_date < today ? "overdue" : "pending"),
    }));
    setItems(enriched);
  };
  useEffect(() => { load(); }, []);

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
      <PageHeader title={t("installments")} subtitle={t("installmentsSubtitle")} />

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
