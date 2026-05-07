import { useEffect, useState } from "react";
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

export default function Sales() {
  const { t, fmt, lang } = useT();
  const { currentShop } = useShop();
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [editPaid, setEditPaid] = useState(0);
  const [editNotes, setEditNotes] = useState("");

  const load = () =>
    supabase.from("sales").select("*, customers(name, phone)").order("created_at", { ascending: false }).limit(200)
      .then(({ data }) => setItems(data ?? []));

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
    const { data: si } = await supabase.from("sale_items").select("*").eq("sale_id", sale.id);
    const itemRows = (si ?? []).map((it: any) => `
      <tr>
        <td style="padding:2px 0">${it.product_name}</td>
        <td style="text-align:center">${it.qty}</td>
        <td style="text-align:right">${fmt(Number(it.unit_price))}</td>
        <td style="text-align:right;font-weight:700">${fmt(Number(it.subtotal))}</td>
      </tr>`).join("");
    const dateStr = new Date(sale.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US");
    const shopName = currentShop?.name ?? "Shop";
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${sale.invoice_no}</title>
      <style>
        @page{size:80mm auto;margin:3mm}
        @media print{body{margin:0}}
        body{font-family:'Courier New',monospace;font-size:12px;color:#000;width:74mm;margin:0 auto;padding:4px}
        .c{text-align:center}.r{text-align:right}.b{font-weight:700}
        table{width:100%;border-collapse:collapse;font-size:11px}
        th,td{padding:2px 0}
        .dash{border-top:1px dashed #000;margin:4px 0}
        .solid{border-top:1px solid #000;margin:4px 0}
        h1{font-size:15px;margin:0;font-weight:800}
        .small{font-size:10px}
      </style></head><body>
      <div class="c">
        <img src="${currentShop?.logo_url || '/brand-logo.png'}" style="max-height:48px" onerror="this.style.display='none'"/>
        <h1>${shopName}</h1>
        ${currentShop?.address ? `<div class="small">${currentShop.address}</div>` : ""}
        ${currentShop?.phone ? `<div class="small">📞 ${currentShop.phone}</div>` : ""}
        <div class="dash"></div>
        <div class="b">ক্যাশ মেমো / CASH MEMO</div>
      </div>
      <div class="small">
        <div style="display:flex;justify-content:space-between"><span>Invoice:</span><span class="b">${sale.invoice_no}</span></div>
        <div style="display:flex;justify-content:space-between"><span>তারিখ:</span><span>${dateStr}</span></div>
        ${sale.customers?.name ? `<div style="display:flex;justify-content:space-between"><span>ক্রেতা:</span><span>${sale.customers.name}${sale.customers.phone ? " · " + sale.customers.phone : ""}</span></div>` : ""}
      </div>
      <div class="dash"></div>
      <table>
        <thead><tr class="b" style="border-bottom:1px solid #000">
          <th style="text-align:left">Item</th><th>Qty</th><th class="r">Rate</th><th class="r">Total</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>
      <div class="dash"></div>
      <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(Number(sale.subtotal))}</span></div>
      ${Number(sale.discount) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>- ${fmt(Number(sale.discount))}</span></div>` : ""}
      <div class="solid"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px" class="b"><span>মোট / TOTAL</span><span>${fmt(Number(sale.total))}</span></div>
      <div style="display:flex;justify-content:space-between"><span>Paid</span><span>${fmt(Number(sale.paid))}</span></div>
      ${Number(sale.due) > 0 ? `<div style="display:flex;justify-content:space-between" class="b"><span>Due (বকেয়া)</span><span>${fmt(Number(sale.due))}</span></div>` : ""}
      <div class="dash"></div>
      <div class="c small">
        <div class="b">ধন্যবাদ — আবার আসবেন</div>
        <div style="margin-top:2px">বিক্রয়কৃত পণ্য ফেরতযোগ্য নয়</div>
        <div style="margin-top:4px;opacity:.7">Powered by সূর্য শপ</div>
      </div>
      <script>
        window.addEventListener('load', function(){
          setTimeout(function(){ try{ window.focus(); window.print(); }catch(e){} }, 300);
        });
      <\/script>
      </body></html>`;

    // Try popup first
    const w = window.open("", "_blank");
    if (w && !w.closed) {
      w.document.open();
      w.document.write(html);
      w.document.close();
      return;
    }

    // Fallback for mobile / blocked popups: hidden iframe in current page
    const old = document.getElementById("__sales_print_iframe");
    if (old) old.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "__sales_print_iframe";
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const idoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!idoc) { toast({ title: "প্রিন্ট করা যায়নি — পপআপ অনুমতি দিন", variant: "destructive" }); return; }
    idoc.open(); idoc.write(html); idoc.close();
    setTimeout(() => {
      try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); }
      catch (e) { toast({ title: "প্রিন্ট ব্যর্থ", variant: "destructive" }); }
    }, 500);
  };

  const handleDelete = async (sale: any) => {
    if (!confirm(`ইনভয়েস ${sale.invoice_no} মুছে ফেলবেন?`)) return;
    await supabase.from("sale_items").delete().eq("sale_id", sale.id);
    const { error } = await supabase.from("sales").delete().eq("id", sale.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "ইনভয়েস মুছে ফেলা হয়েছে" });
    load();
  };

  const openEdit = (sale: any) => {
    setEditing(sale);
    setEditPaid(Number(sale.paid));
    setEditNotes(sale.notes ?? "");
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
      <PageHeader title={t("salesLedger")} subtitle={t("salesSubtitle")} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Stat icon={<Receipt className="h-6 w-6 text-primary" />} bg="bg-primary/10" label={t("recentSales")} value={filtered.length.toString()} />
        <Stat icon={<Receipt className="h-6 w-6 text-info" />} bg="bg-info/10" label={t("totalRevenue")} value={fmt(totalRevenue)} />
        <Stat icon={<Receipt className="h-6 w-6 text-[hsl(var(--secondary-foreground))]" />} bg="bg-secondary/30" label={t("pendingDue")} value={fmt(totalDue)} />
      </div>

      <SurfaceCard className="p-4 sm:p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>

        <div className="overflow-x-auto">
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
