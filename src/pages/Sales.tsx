import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { useT } from "@/i18n/LanguageContext";
import { Search, Receipt, Printer } from "lucide-react";
import { PageHeader, StatusPill, SurfaceCard } from "@/components/PageHeader";
import { ThermalReceipt } from "@/components/ThermalReceipt";

export default function Sales() {
  const { t, fmt, lang } = useT();
  const { currentShop } = useShop();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [reprint, setReprint] = useState<any>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.from("sales").select("*, customers(name, phone)").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setItems(data ?? []));
  }, []);

  const filtered = items.filter(s =>
    !search || s.invoice_no?.toLowerCase().includes(search.toLowerCase())
    || s.customers?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalRevenue = filtered.reduce((a, s) => a + Number(s.total), 0);
  const totalDue = filtered.reduce((a, s) => a + Number(s.due), 0);

  const openReprint = async (sale: any) => {
    const { data: si } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    setReprint({ ...sale, items: si ?? [] });
    setTimeout(() => doPrint(), 200);
  };

  const doPrint = () => {
    const node = printRef.current; if (!node) return;
    const w = window.open("", "_blank", "width=400,height=600"); if (!w) return;
    w.document.write(`<html><head><title>Receipt</title>
      <style>@page{size:80mm auto;margin:0}body{margin:0;font-family:monospace}</style>
    </head><body>${node.innerHTML}</body></html>`);
    w.document.close(); w.focus(); setTimeout(() => { w.print(); w.close(); }, 100);
  };

  return (
    <div>
      <PageHeader title={t("salesLedger")} subtitle={t("salesSubtitle")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Stat icon={<Receipt className="h-6 w-6 text-primary" />} bg="bg-primary/10" label={t("recentSales")} value={filtered.length.toString()} />
        <Stat icon={<Receipt className="h-6 w-6 text-info" />} bg="bg-info/10" label={t("totalRevenue")} value={fmt(totalRevenue)} />
        <Stat icon={<Receipt className="h-6 w-6 text-[hsl(var(--secondary-foreground))]" />} bg="bg-secondary/30" label={t("pendingDue")} value={fmt(totalDue)} />
      </div>

      <SurfaceCard className="p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">{t("invoice")}</th>
                <th className="pb-6 font-bold">{t("date")}</th>
                <th className="pb-6 font-bold">{t("customer")}</th>
                <th className="pb-6 font-bold">{t("paymentType")}</th>
                <th className="pb-6 font-bold">{t("total")}</th>
                <th className="pb-6 font-bold">{t("due")}</th>
                <th className="pb-6 font-bold">{t("status")}</th>
                <th className="pb-6 font-bold text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>
              )}
              {filtered.map(s => {
                const due = Number(s.due);
                const tone = due === 0 ? "success" : due === Number(s.total) ? "warning" : "destructive";
                return (
                  <tr key={s.id} className="hover:bg-[hsl(var(--surface-container-low))] transition-colors">
                    <td className="py-4 font-bold text-foreground">{s.invoice_no}</td>
                    <td className="py-4 text-muted-foreground">{new Date(s.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                    <td className="py-4 font-medium">{s.customers?.name ?? "—"}</td>
                    <td className="py-4">{t(s.payment_type === "cash" ? "cash" : "installmentSale")}</td>
                    <td className="py-4 font-bold text-primary">{fmt(Number(s.total))}</td>
                    <td className="py-4">{due > 0 ? <span className="text-destructive font-semibold">{fmt(due)}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-4"><StatusPill tone={tone}>{t(s.status as any)}</StatusPill></td>
                    <td className="py-4 text-right">
                      <button onClick={() => openReprint(s)} className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                        <Printer className="h-3.5 w-3.5" />Reprint
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* hidden receipt for reprint */}
      {reprint && (
        <div className="hidden">
          <ThermalReceipt ref={printRef}
            shop={{ name: currentShop?.name ?? "Shop", address: currentShop?.address, phone: currentShop?.phone, logo_url: currentShop?.logo_url }}
            invoiceNo={reprint.invoice_no} createdAt={reprint.created_at}
            customer={reprint.customers}
            items={reprint.items.map((it: any) => ({ name: it.product_name, qty: it.qty, unit_price: Number(it.unit_price), subtotal: Number(it.subtotal) }))}
            subtotal={Number(reprint.subtotal)} discount={Number(reprint.discount)} total={Number(reprint.total)}
            paid={Number(reprint.paid)} due={Number(reprint.due)} paymentType={reprint.payment_type} fmt={fmt} />
        </div>
      )}
    </div>
  );
}

function Stat({ icon, bg, label, value }: any) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-6 rounded-2xl flex items-center gap-4 transition-all hover:-translate-y-1">
      <div className={`p-3 ${bg} rounded-xl`}>{icon}</div>
      <div>
        <p className="text-muted-foreground text-sm font-medium">{label}</p>
        <h3 className="text-xl font-bold text-foreground mt-0.5">{value}</h3>
      </div>
    </div>
  );
}
