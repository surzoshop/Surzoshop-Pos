import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Search, Receipt, Printer, Trash2, Pencil } from "lucide-react";
import { PageHeader, StatusPill, SurfaceCard } from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { printSale as printSaleUnified } from "@/lib/printSale";

export default function Sales() {
  const { t, fmt, lang } = useT();
  const { currentShop } = useShop();
  const { role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === "admin" || role === "super_admin";

  const [items, setItems] = useState<any[]>([]);
  const [itemsBySale, setItemsBySale] = useState<Record<string, string[]>>({});
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [editPaid, setEditPaid] = useState(0);
  const [editNotes, setEditNotes] = useState("");

  const load = async () => {
    const { data } = await supabase.from("sales").select("*, customers(name, phone)").order("created_at", { ascending: false }).limit(200);
    setItems(data ?? []);
    const ids = (data ?? []).map((s: any) => s.id);
    if (ids.length) {
      const { data: si } = await supabase.from("sale_items").select("sale_id, product_name, qty").in("sale_id", ids);
      const grouped: Record<string, string[]> = {};
      for (const r of (si ?? []) as any[]) {
        const label = `${r.product_name}${Number(r.qty) > 1 ? ` ×${r.qty}` : ""}`;
        (grouped[r.sale_id] ||= []).push(label);
      }
      setItemsBySale(grouped);
    } else {
      setItemsBySale({});
    }
  };

  useEffect(() => {
    load();
    const ch = supabase.channel("sales-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const filtered = items.filter(s =>
    !search || s.invoice_no?.toLowerCase().includes(search.toLowerCase())
    || s.customers?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalRevenue = filtered.reduce((a, s) => a + Number(s.total), 0);
  const totalDue = filtered.reduce((a, s) => a + Number(s.due), 0);

  const printReceipt = async (sale: any) => {
    await printSaleUnified({
      saleId: sale.id,
      shop: {
        name: currentShop?.name,
        address: currentShop?.address,
        phone: currentShop?.phone,
        logo_url: currentShop?.logo_url,
      },
      fmt,
      lang,
    });
  };

  const handleDelete = async (sale: any) => {
    if (!confirm(`ইনভয়েস ${sale.invoice_no} সম্পূর্ণ মুছে ফেলবেন? এটি ফিরিয়ে আনা যাবে না।`)) return;
    try {
      // 1) Restock sold items back to inventory
      const { data: items } = await supabase.from("sale_items").select("product_id, qty").eq("sale_id", sale.id);
      for (const it of items ?? []) {
        if (!it.product_id) continue;
        const { data: p } = await supabase.from("products").select("stock").eq("id", it.product_id).maybeSingle();
        if (p) {
          await supabase.from("products").update({ stock: Number(p.stock) + Number(it.qty) }).eq("id", it.product_id);
        }
      }

      // 2) Delete dependents that reference this sale
      const { data: insts } = await supabase.from("installments").select("id").eq("sale_id", sale.id);
      const instIds = (insts ?? []).map((i: any) => i.id);
      if (instIds.length) {
        await supabase.from("installment_payments").delete().in("installment_id", instIds);
        await supabase.from("installments").delete().in("id", instIds);
      }

      // 2) Keep return audit trail intact (decouple from sale) and clean up orphaned return withdrawals
      const { data: rets } = await supabase.from("sales_returns").select("id,return_no").eq("sale_id", sale.id);
      if (rets && rets.length) {
        await supabase.from("sales_returns").update({ 
          sale_id: null,
          invoice_no: sale.invoice_no,
          customer_name: sale.customers?.name ?? null,
          customer_id: sale.customer_id ?? null,
        } as any).eq("sale_id", sale.id);
        // Also remove any cashbook return withdrawals referencing this invoice/returns so ledger balance is not orphaned
        const returnNotes = rets.map((r: any) => r.return_no).filter(Boolean);
        for (const retNo of returnNotes) {
          await supabase.from("cash_book" as any).delete().ilike("notes", `%${retNo}%`);
        }
        await supabase.from("cash_book" as any).delete().eq("category", "বিক্রয় ফেরত").ilike("notes", `%${sale.invoice_no}%`);
      }

      await supabase.from("guarantors").delete().eq("sale_id", sale.id);
      await supabase.from("sale_items").delete().eq("sale_id", sale.id);

      // 3) Finally delete sale
      const { error } = await supabase.from("sales").delete().eq("id", sale.id);
      if (error) throw error;

      // Optimistic UI: drop from local list right away
      setItems(prev => prev.filter(x => x.id !== sale.id));
      toast({ title: "ইনভয়েস ও সকল সংশ্লিষ্ট তথ্য মুছে ফেলা হয়েছে ✓" });
      load();
    } catch (e: any) {
      toast({ title: "ডিলিট ব্যর্থ", description: e?.message ?? String(e), variant: "destructive" });
    }
  };

  const openEdit = (sale: any) => {
    // Redirect to POS in edit mode — full editing of products, discount, payment type, installment etc.
    navigate(`/pos?edit=${sale.id}`);
  };

  const saveEdit = async () => {
    if (!editing) return;
    const due = Math.max(Number(editing.total) - editPaid, 0);
    const status = due === 0 ? "completed" : "partial";
    const { error } = await supabase.from("sales")
      .update({ paid: editPaid, due, notes: editNotes || null, status })
      .eq("id", editing.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "ইনভয়েস আপডেট হয়েছে ✓" });
    setEditing(null); load();
  };

  return (
    <div>
      <div className="animate-fade-in">
        <PageHeader title={t("salesLedger")} subtitle={t("salesSubtitle")} />
      </div>

      <div className="grid grid-cols-3 gap-2 sm:gap-6 mb-4 sm:mb-8">
        <Stat
          icon={<Receipt className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />}
          accent="from-primary to-primary-glow"
          label={t("recentSales")}
          value={filtered.length.toString()}
          delay="0ms"
        />
        <Stat
          icon={<Receipt className="h-4 w-4 sm:h-6 sm:w-6 text-info-foreground" />}
          accent="from-info to-info/70"
          label={t("totalRevenue")}
          value={fmt(totalRevenue)}
          delay="60ms"
        />
        <Stat
          icon={<Receipt className="h-4 w-4 sm:h-6 sm:w-6 text-[hsl(var(--secondary-foreground))]" />}
          accent="from-secondary to-secondary/60"
          label={t("pendingDue")}
          value={fmt(totalDue)}
          delay="120ms"
        />
      </div>

      <SurfaceCard className="p-3 sm:p-6">
        <div className="relative mb-4 sm:mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2.5">
          {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">{t("noResults")}</div>}
          {filtered.map((s, i) => {
            const due = Number(s.due);
            const total = Number(s.total);
            const isFullDue = due > 0 && due >= total;
            const tone = due === 0 ? "success" : isFullDue ? "destructive" : "warning";
            const accent = due === 0 ? "from-primary to-primary-glow" : isFullDue ? "from-destructive to-destructive/70" : "from-secondary to-secondary/60";
            const payLabel = s.payment_type === "installment" ? t("installmentSale") : (due > 0 ? (lang === "bn" ? "বাকি" : "Credit") : t("cash"));
            const statusLabel = isFullDue ? (lang === "bn" ? "বকেয়া" : "Due") : t(s.status as any);
            return (
              <div key={s.id} className="relative overflow-hidden bg-[hsl(var(--surface-container-low))] rounded-xl p-3 animate-fade-in shadow-sm hover:shadow-md transition-all" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
                <div className={`absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b ${accent}`} />
                <div className="flex items-start justify-between gap-2 pl-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-foreground text-sm">{s.invoice_no}</span>
                      <StatusPill tone={tone}>{statusLabel}</StatusPill>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {new Date(s.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}
                      {s.customers?.name ? ` · ${s.customers.name}` : ""}
                    </div>
                    {itemsBySale[s.id]?.length ? (
                      <div className="text-[11px] text-foreground font-semibold mt-1 line-clamp-2 leading-snug" title={itemsBySale[s.id].join(", ")}>
                        🛒 {itemsBySale[s.id].join(", ")}
                      </div>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-bold text-primary text-sm">{fmt(Number(s.total))}</div>
                    {due > 0 && <div className="text-[11px] text-destructive font-semibold">বকেয়া {fmt(due)}</div>}
                  </div>
                </div>
                <div className="mt-2 pt-2 border-t border-[hsl(var(--surface-container))] flex items-center justify-between pl-2">
                  <span className="text-[11px] text-muted-foreground">{payLabel}</span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => printReceipt(s)} className="p-2 rounded-lg bg-info/10 text-info active:scale-95 hover:bg-info/20 transition-all">
                      <Printer className="h-4 w-4" />
                    </button>
                    {isAdmin && (
                      <button onClick={() => openEdit(s)} className="p-2 rounded-lg bg-primary/10 text-primary active:scale-95 hover:bg-primary/20 transition-all">
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}
                    {isAdmin && (
                      <button onClick={() => handleDelete(s)} className="p-2 rounded-lg bg-destructive/10 text-destructive active:scale-95 hover:bg-destructive/20 transition-all">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[720px]">
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
                const total = Number(s.total);
                const isFullDue = due > 0 && due >= total;
                const tone = due === 0 ? "success" : isFullDue ? "destructive" : "warning";
                const payLabel = s.payment_type === "installment" ? t("installmentSale") : (due > 0 ? (lang === "bn" ? "বাকি" : "Credit") : t("cash"));
                const statusLabel = isFullDue ? (lang === "bn" ? "বকেয়া" : "Due") : t(s.status as any);
                return (
                  <tr key={s.id} className="hover:bg-[hsl(var(--surface-container-low))] transition-colors">
                    <td className="py-4 font-bold text-foreground align-top">
                      <div>{s.invoice_no}</div>
                      {itemsBySale[s.id]?.length ? (
                        <div className="text-[11px] font-semibold text-foreground mt-1 max-w-[220px] line-clamp-2" title={itemsBySale[s.id].join(", ")}>
                          🛒 {itemsBySale[s.id].join(", ")}
                        </div>
                      ) : null}
                    </td>
                    <td className="py-4 text-muted-foreground">{new Date(s.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</td>
                    <td className="py-4 font-medium">{s.customers?.name ?? "—"}</td>
                    <td className="py-4">{payLabel}</td>
                    <td className="py-4 font-bold text-primary">{fmt(Number(s.total))}</td>
                    <td className="py-4">{due > 0 ? <span className="text-destructive font-semibold">{fmt(due)}</span> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-4"><StatusPill tone={tone}>{statusLabel}</StatusPill></td>
                    <td className="py-4 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button onClick={() => printReceipt(s)} title="প্রিন্ট" className="p-1.5 rounded-md hover:bg-info/10 text-info">
                          <Printer className="h-4 w-4" />
                        </button>
                        {isAdmin && (
                          <button onClick={() => openEdit(s)} title="এডিট" className="p-1.5 rounded-md hover:bg-primary/10 text-primary">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {isAdmin && (
                          <button onClick={() => handleDelete(s)} title="ডিলিট" className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>ইনভয়েস এডিট — {editing?.invoice_no}</DialogTitle></DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="bg-[hsl(var(--surface-container-low))] rounded-lg p-3 text-sm flex justify-between">
                <span>মোট</span><b>{fmt(Number(editing.total))}</b>
              </div>
              <div>
                <Label>পরিশোধিত (৳)</Label>
                <Input type="number" value={editPaid} onChange={e => setEditPaid(+e.target.value)} />
                <p className="text-xs text-muted-foreground mt-1">বকেয়া স্বয়ংক্রিয়ভাবে গণনা হবে।</p>
              </div>
              <div>
                <Label>নোট</Label>
                <Input value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>
              <div className="text-sm flex justify-between bg-warning/10 text-warning rounded-lg p-2">
                <span>নতুন বকেয়া</span><b>{fmt(Math.max(Number(editing.total) - editPaid, 0))}</b>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>{t("cancel")}</Button>
            <Button onClick={saveEdit} className="gradient-primary">{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ icon, accent, label, value, delay }: any) {
  return (
    <div
      className="group relative overflow-hidden bg-[hsl(var(--surface-container-lowest))] p-2.5 sm:p-6 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center gap-1.5 sm:gap-4 shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] transition-all hover:-translate-y-1 animate-fade-in"
      style={{ animationDelay: delay }}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accent} opacity-80`} />
      <div className={`p-1.5 sm:p-3 bg-gradient-to-br ${accent} rounded-lg sm:rounded-xl shrink-0 shadow-sm group-hover:scale-110 transition-transform`}>{icon}</div>
      <div className="min-w-0 w-full">
        <p className="text-muted-foreground text-[10px] sm:text-sm font-medium truncate uppercase tracking-wider">{label}</p>
        <h3 className="text-sm sm:text-xl font-bold text-foreground mt-0.5 truncate">{value}</h3>
      </div>
    </div>
  );
}
