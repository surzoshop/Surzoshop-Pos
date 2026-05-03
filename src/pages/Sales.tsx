import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function Sales() {
  const { t, fmt } = useT();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("sales").select("*, customers(name)").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setItems(data ?? []));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl md:text-3xl font-bold">{t("sales")}</h1>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr>
              <th className="p-3">{t("invoice")}</th>
              <th className="p-3">{t("date")}</th>
              <th className="p-3">{t("customer")}</th>
              <th className="p-3">{t("paymentType")}</th>
              <th className="p-3 text-right">{t("total")}</th>
              <th className="p-3 text-right">{t("paid")}</th>
              <th className="p-3 text-right">{t("due")}</th>
              <th className="p-3">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-muted-foreground">{t("noResults")}</td></tr>}
            {items.map(s => (
              <tr key={s.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{s.invoice_no}</td>
                <td className="p-3">{new Date(s.created_at).toLocaleString()}</td>
                <td className="p-3">{s.customers?.name ?? "-"}</td>
                <td className="p-3">{t(s.payment_type === "cash" ? "cash" : "installmentSale")}</td>
                <td className="p-3 text-right font-semibold">{fmt(Number(s.total))}</td>
                <td className="p-3 text-right">{fmt(Number(s.paid))}</td>
                <td className="p-3 text-right">{Number(s.due) > 0 ? <span className="text-warning">{fmt(Number(s.due))}</span> : fmt(0)}</td>
                <td className="p-3"><Badge variant={s.status === "completed" ? "default" : "secondary"}>{t(s.status as any)}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
