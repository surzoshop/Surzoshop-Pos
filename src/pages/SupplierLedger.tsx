import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Search, Wallet, ShoppingBag, AlertCircle, Plus } from "lucide-react";
import { PageHeader, SurfaceCard, StatusPill, PrimaryButton } from "@/components/PageHeader";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function SupplierLedger() {
  const { t, lang, fmt } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [sid, setSid] = useState("");
  const [search, setSearch] = useState("");
  const [purchases, setPurchases] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState({ purchase_id: "", amount: 0, payment_method: "cash", note: "" });

  const loadList = () =>
    supabase.from("suppliers").select("id,name,phone,opening_balance").order("name").then(({ data }) => {
      setSuppliers(data ?? []);
      if (data && data.length && !sid) setSid(data[0].id);
    });

  useEffect(() => { loadList(); /* eslint-disable-next-line */ }, []);

  const loadDetail = async () => {
    if (!sid) return;
    const { data: pur } = await supabase.from("purchases").select("id,bill_no,created_at,total,paid,due").eq("supplier_id", sid).order("created_at");
    setPurchases(pur ?? []);
    const ids = (pur ?? []).map((p: any) => p.id);
    if (ids.length) {
      const { data: pp } = await supabase.from("purchase_payments").select("*").in("purchase_id", ids).order("paid_at");
      setPayments(pp ?? []);
    } else setPayments([]);
  };
  useEffect(() => { loadDetail(); }, [sid]);

  const totalPurchase = purchases.reduce((a, p) => a + Number(p.total), 0);
  const totalPaid = purchases.reduce((a, p) => a + Number(p.paid), 0);
  const totalDue = purchases.reduce((a, p) => a + Number(p.due), 0);

  const txns = useMemo(() => {
    const list: any[] = [];
    purchases.forEach(p => list.push({ date: p.created_at, ref: p.bill_no, debit: 0, credit: Number(p.total), kind: "purchase" }));
    payments.forEach(p => list.push({ date: p.paid_at, ref: `Payment (${p.payment_method})`, debit: Number(p.amount), credit: 0, kind: "payment" }));
    list.sort((a, b) => +new Date(a.date) - +new Date(b.date));
    let bal = 0;
    return list.map(x => { bal = bal - x.debit + x.credit; return { ...x, balance: bal }; });
  }, [purchases, payments]);

  const dueBills = purchases.filter(p => Number(p.due) > 0);

  const savePayment = async () => {
    if (!pay.purchase_id || pay.amount <= 0) return toast({ title: "Bill ও amount দিন", variant: "destructive" });
    const { error } = await supabase.from("purchase_payments").insert({
      purchase_id: pay.purchase_id, amount: pay.amount, payment_method: pay.payment_method,
      note: pay.note, created_by: user!.id,
    });
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "পেমেন্ট সংরক্ষিত ✓" });
    setOpen(false); setPay({ purchase_id: "", amount: 0, payment_method: "cash", note: "" });
    loadDetail(); loadList();
  };

  const filtered = suppliers.filter(s => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.phone ?? "").includes(search));
  const selected = suppliers.find(s => s.id === sid);

  return (
    <div>
      <PageHeader title="সরবরাহকারী লেজার" subtitle="ক্রয় বিল ও পরিশোধ ইতিহাস।"
        actions={selected && <PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />বকেয়া পরিশোধ</PrimaryButton>} />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <SurfaceCard className="p-4 lg:col-span-1 h-fit">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t("search")}
              className="w-full h-10 pl-9 pr-3 rounded-lg bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
          </div>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto">
            {filtered.map(s => (
              <button key={s.id} onClick={() => setSid(s.id)}
                className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all ${sid === s.id ? "bg-primary/10 text-primary font-bold ring-1 ring-primary/30" : "hover:bg-muted/60"}`}>
                <div className="truncate font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">{s.phone ?? "—"}</div>
              </button>
            ))}
          </div>
        </SurfaceCard>

        <div className="lg:col-span-3 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Stat icon={<ShoppingBag className="h-5 w-5 text-info" />} bg="bg-info/10" label="মোট ক্রয়" value={fmt(totalPurchase)} />
            <Stat icon={<Wallet className="h-5 w-5 text-primary" />} bg="bg-primary/10" label="মোট পরিশোধ" value={fmt(totalPaid)} />
            <Stat icon={<AlertCircle className="h-5 w-5 text-destructive" />} bg="bg-destructive/10" label="মোট বকেয়া" value={fmt(totalDue)} />
          </div>

          <SurfaceCard className="p-6">
            <h3 className="text-lg font-bold mb-4">{selected?.name ?? "—"}</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-[hsl(var(--surface-container-high))]">
                    <th className="pb-3 font-bold">{t("date")}</th>
                    <th className="pb-3 font-bold">বিবরণ</th>
                    <th className="pb-3 font-bold text-right">ডেবিট (পরিশোধ)</th>
                    <th className="pb-3 font-bold text-right">ক্রেডিট (ক্রয়)</th>
                    <th className="pb-3 font-bold text-right">ব্যালেন্স</th>
                  </tr>
                </thead>
                <tbody>
                  {txns.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">কোন লেনদেন নেই</td></tr>}
                  {txns.map((x, i) => (
                    <tr key={i} className="border-b border-[hsl(var(--surface-container-high))]/40">
                      <td className="py-3 text-muted-foreground">{new Date(x.date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                      <td className="py-3"><StatusPill tone={x.kind === "purchase" ? "warning" : "success"}>{x.ref}</StatusPill></td>
                      <td className="py-3 text-right text-primary font-semibold">{x.debit > 0 ? fmt(x.debit) : "—"}</td>
                      <td className="py-3 text-right text-destructive font-semibold">{x.credit > 0 ? fmt(x.credit) : "—"}</td>
                      <td className="py-3 text-right font-bold">{fmt(x.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SurfaceCard>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>বকেয়া পরিশোধ</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>বিল</Label>
              <select value={pay.purchase_id} onChange={e => setPay({ ...pay, purchase_id: e.target.value })}
                className="w-full h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                <option value="">— বিল নির্বাচন করুন —</option>
                {dueBills.map(b => <option key={b.id} value={b.id}>{b.bill_no} (বকেয়া: {fmt(Number(b.due))})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("amount")}</Label><Input type="number" value={pay.amount} onChange={e => setPay({ ...pay, amount: +e.target.value })} /></div>
              <div>
                <Label>{t("paymentMethod")}</Label>
                <select value={pay.payment_method} onChange={e => setPay({ ...pay, payment_method: e.target.value })}
                  className="w-full h-10 rounded-md bg-[hsl(var(--surface-container-low))] px-3 text-sm">
                  <option value="cash">নগদ</option><option value="bank">ব্যাংক</option><option value="bkash">bKash</option><option value="nagad">Nagad</option>
                </select>
              </div>
            </div>
            <div><Label>নোট</Label><Input value={pay.note} onChange={e => setPay({ ...pay, note: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button>
            <Button onClick={savePayment} className="gradient-primary">{t("save")}</Button>
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
        <h3 className="text-lg font-bold text-foreground">{value}</h3>
      </div>
    </div>
  );
}
