import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, ScanLine, Receipt as ReceiptIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";

type Product = { id: string; name: string; barcode: string | null; sku: string | null; price: number; stock: number };
type CartItem = { product: Product; qty: number };

export default function POS() {
  const { t, fmt, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paid, setPaid] = useState(0);
  const [paymentType, setPaymentType] = useState<"cash" | "installment">("cash");
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [installmentCount, setInstallmentCount] = useState(3);
  const [lastSale, setLastSale] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); loadCustomers(); }, []);
  const loadCustomers = async () => {
    const { data } = await supabase.from("customers").select("id,name,phone").order("name");
    setCustomers(data ?? []);
  };

  useEffect(() => {
    if (!search) { setResults([]); return; }
    const id = setTimeout(async () => {
      const { data } = await supabase.from("products")
        .select("id,name,barcode,sku,price,stock")
        .or(`barcode.eq.${search},name.ilike.%${search}%,sku.ilike.%${search}%`)
        .limit(8);
      setResults(data ?? []);
      // auto-add if exact barcode match
      const exact = (data ?? []).find(p => p.barcode === search);
      if (exact) { addToCart(exact); setSearch(""); setResults([]); }
    }, 200);
    return () => clearTimeout(id);
  }, [search]);

  const addToCart = (p: Product) => {
    setCart(c => {
      const ex = c.find(i => i.product.id === p.id);
      if (ex) return c.map(i => i.product.id === p.id ? { ...i, qty: Math.min(i.qty + 1, p.stock) } : i);
      return [...c, { product: p, qty: 1 }];
    });
  };
  const updateQty = (id: string, delta: number) => {
    setCart(c => c.map(i => i.product.id === id ? { ...i, qty: Math.max(1, Math.min(i.qty + delta, i.product.stock)) } : i));
  };
  const removeItem = (id: string) => setCart(c => c.filter(i => i.product.id !== id));

  const subtotal = cart.reduce((a, i) => a + i.product.price * i.qty, 0);
  const total = Math.max(0, subtotal - discount);
  const due = Math.max(0, total - paid);

  const completeSale = async () => {
    if (cart.length === 0) return;
    if (paymentType === "installment" && !customerId) {
      toast({ title: lang === "bn" ? "ক্রেতা নির্বাচন করুন" : "Select a customer for installment", variant: "destructive" });
      return;
    }

    const { data: sale, error } = await supabase.from("sales").insert({
      customer_id: customerId || null,
      subtotal, discount, total, paid, due,
      payment_type: paymentType,
      status: due > 0 ? "partial" : "completed",
      created_by: user!.id,
    }).select().single();
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }

    const items = cart.map(i => ({
      sale_id: sale.id, product_id: i.product.id, product_name: i.product.name,
      qty: i.qty, unit_price: i.product.price, subtotal: i.product.price * i.qty,
    }));
    await supabase.from("sale_items").insert(items);

    if (paymentType === "installment" && due > 0) {
      const per = Math.ceil((due / installmentCount) * 100) / 100;
      const schedule = Array.from({ length: installmentCount }).map((_, idx) => {
        const d = new Date(); d.setMonth(d.getMonth() + idx + 1);
        return {
          sale_id: sale.id, installment_no: idx + 1,
          due_date: d.toISOString().slice(0, 10),
          amount: idx === installmentCount - 1 ? due - per * (installmentCount - 1) : per,
        };
      });
      await supabase.from("installments").insert(schedule);
    }

    setLastSale({ ...sale, items: cart, customer: customers.find(c => c.id === customerId) });
    setShowReceipt(true);
    setCart([]); setDiscount(0); setPaid(0); setCustomerId(""); setPaymentType("cash");
    toast({ title: lang === "bn" ? "বিক্রয় সম্পন্ন" : "Sale completed" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 h-[calc(100vh-7rem)]">
      <div className="lg:col-span-3 flex flex-col gap-4 min-h-0">
        <Card className="p-4">
          <div className="relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input ref={inputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder={t("scanBarcode")} className="pl-10 h-11 text-base" />
          </div>
          {results.length > 0 && (
            <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 max-h-64 overflow-auto">
              {results.map(p => (
                <button key={p.id} onClick={() => { addToCart(p); setSearch(""); setResults([]); inputRef.current?.focus(); }}
                  className="text-left p-3 rounded-lg border hover:border-primary hover:bg-primary/5 transition">
                  <div className="font-medium text-sm line-clamp-1">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{t("stock")}: {p.stock}</div>
                  <div className="text-primary font-semibold mt-1">{fmt(p.price)}</div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card className="flex-1 flex flex-col min-h-0">
          <div className="p-4 border-b font-semibold">{t("cart")} ({cart.length})</div>
          <div className="flex-1 overflow-auto p-2">
            {cart.length === 0 && <div className="text-center text-muted-foreground p-8">{t("emptyCart")}</div>}
            {cart.map(i => (
              <div key={i.product.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted/50">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{i.product.name}</div>
                  <div className="text-xs text-muted-foreground">{fmt(i.product.price)} × {i.qty}</div>
                </div>
                <div className="flex items-center gap-1">
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product.id, -1)}><Minus className="h-3 w-3" /></Button>
                  <span className="w-8 text-center text-sm">{i.qty}</span>
                  <Button size="icon" variant="outline" className="h-7 w-7" onClick={() => updateQty(i.product.id, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
                <div className="w-20 text-right font-semibold">{fmt(i.product.price * i.qty)}</div>
                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeItem(i.product.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="lg:col-span-2 p-4 flex flex-col gap-3 overflow-auto">
        <div>
          <Label>{t("customer")}</Label>
          <Select value={customerId || "_walkin"} onValueChange={v => setCustomerId(v === "_walkin" ? "" : v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="_walkin">{t("walkInCustomer")}</SelectItem>
              {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name} {c.phone ? `• ${c.phone}` : ""}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label>{t("paymentType")}</Label>
          <Select value={paymentType} onValueChange={v => setPaymentType(v as any)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="cash">{t("cash")}</SelectItem>
              <SelectItem value="installment">{t("installmentSale")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {paymentType === "installment" && (
          <div>
            <Label>{t("numberOfInstallments")}</Label>
            <Input type="number" min={1} max={36} value={installmentCount} onChange={e => setInstallmentCount(Math.max(1, +e.target.value))} />
          </div>
        )}

        <div className="space-y-1 mt-2 pt-3 border-t">
          <div className="flex justify-between text-sm"><span>{t("subtotal")}</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between items-center text-sm">
            <span>{t("discount")}</span>
            <Input type="number" value={discount} onChange={e => setDiscount(+e.target.value || 0)} className="w-24 h-8 text-right" />
          </div>
          <div className="flex justify-between text-base font-bold pt-2 border-t"><span>{t("total")}</span><span className="text-primary">{fmt(total)}</span></div>
          <div className="flex justify-between items-center text-sm pt-2">
            <span>{t("paid")}</span>
            <Input type="number" value={paid} onChange={e => setPaid(+e.target.value || 0)} className="w-24 h-8 text-right" />
          </div>
          <div className="flex justify-between text-sm font-semibold"><span>{t("due")}</span><span className={due > 0 ? "text-warning" : ""}>{fmt(due)}</span></div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={() => setPaid(total)}>{t("cash")} = {t("total")}</Button>
        </div>
        <Button size="lg" className="w-full" onClick={completeSale} disabled={cart.length === 0}>
          <ReceiptIcon className="h-5 w-5 mr-2" />{t("completeSale")}
        </Button>
      </Card>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>{t("receipt")}</DialogTitle></DialogHeader>
          {lastSale && (
            <div id="receipt-print" className="text-sm space-y-2">
              <div className="text-center border-b pb-2">
                <div className="font-bold text-lg">{t("appName")}</div>
                <div className="text-xs text-muted-foreground">{lastSale.invoice_no}</div>
                <div className="text-xs">{new Date(lastSale.created_at).toLocaleString()}</div>
              </div>
              <div className="text-xs">{t("customer")}: {lastSale.customer?.name ?? t("walkInCustomer")}</div>
              <div className="border-y py-2 space-y-1">
                {lastSale.items.map((i: CartItem) => (
                  <div key={i.product.id} className="flex justify-between text-xs">
                    <span>{i.product.name} × {i.qty}</span>
                    <span>{fmt(i.product.price * i.qty)}</span>
                  </div>
                ))}
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="flex justify-between"><span>{t("subtotal")}</span><span>{fmt(Number(lastSale.subtotal))}</span></div>
                <div className="flex justify-between"><span>{t("discount")}</span><span>{fmt(Number(lastSale.discount))}</span></div>
                <div className="flex justify-between font-bold"><span>{t("total")}</span><span>{fmt(Number(lastSale.total))}</span></div>
                <div className="flex justify-between"><span>{t("paid")}</span><span>{fmt(Number(lastSale.paid))}</span></div>
                <div className="flex justify-between"><span>{t("due")}</span><span>{fmt(Number(lastSale.due))}</span></div>
              </div>
              <div className="text-center text-xs pt-2 border-t">{t("thankYou")}</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceipt(false)}>{t("cancel")}</Button>
            <Button onClick={() => window.print()}>{t("printReceipt")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
