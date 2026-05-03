import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Wallet } from "lucide-react";

export default function Installments() {
  const { t, fmt } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [paying, setPaying] = useState<any>(null);
  const [amount, setAmount] = useState(0);

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

  const statusColor = (s: string) => s === "paid" ? "bg-success" : s === "overdue" ? "bg-destructive" : "bg-warning";

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">{t("installments")}</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">{t("invoice")}</th>
              <th className="p-3">{t("customer")}</th>
              <th className="p-3">#</th>
              <th className="p-3">{t("dueDate")}</th>
              <th className="p-3 text-right">{t("amount")}</th>
              <th className="p-3 text-right">{t("paid")}</th>
              <th className="p-3">{t("status")}</th>
              <th className="p-3 text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t("noResults")}</td></tr>}
            {items.map(i => (
              <tr key={i.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{i.sales?.invoice_no}</td>
                <td className="p-3">{i.sales?.customers?.name ?? "-"}</td>
                <td className="p-3">{i.installment_no}</td>
                <td className="p-3">{i.due_date}</td>
                <td className="p-3 text-right">{fmt(Number(i.amount))}</td>
                <td className="p-3 text-right">{fmt(Number(i.paid_amount))}</td>
                <td className="p-3"><Badge className={`${statusColor(i.status)} text-white`}>{t(i.status as any)}</Badge></td>
                <td className="p-3 text-right">
                  {i.status !== "paid" && (
                    <Button size="sm" onClick={() => { setPaying(i); setAmount(Number(i.amount) - Number(i.paid_amount)); }}>
                      <Wallet className="h-4 w-4 mr-1" />{t("pay")}
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={!!paying} onOpenChange={o => !o && setPaying(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>{t("payInstallment")}</DialogTitle></DialogHeader>
          {paying && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">{paying.sales?.invoice_no} • {t("amount")}: {fmt(Number(paying.amount))}</div>
              <div><Label>{t("amount")}</Label><Input type="number" value={amount} onChange={e => setAmount(+e.target.value)} /></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setPaying(null)}>{t("cancel")}</Button><Button onClick={pay}>{t("pay")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
