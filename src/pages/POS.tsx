import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Search, ScanLine, ShoppingCart, Trash, Receipt as ReceiptIcon, Printer, Package, Smartphone, Wifi } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useMobileScanner } from "@/hooks/useMobileScanner";
import { Link } from "react-router-dom";

type Product = { id: string; name: string; barcode: string | null; sku: string | null; price: number; stock: number };
type CartItem = { product: Product; qty: number };

const VAT_RATE = 0.05;

export default function POS() {
  const { t, fmt, lang } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("__all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bkash" | "nagad">("cash");
  const [paymentType, setPaymentType] = useState<"cash" | "installment">("cash");
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [installmentCount, setInstallmentCount] = useState(3);
  const [downPayment, setDownPayment] = useState(0);
  const [interestRate, setInterestRate] = useState(0);
  const [lateFeePerDay, setLateFeePerDay] = useState(0);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [guarantorId, setGuarantorId] = useState<string>("");
  const [showGuarantorForm, setShowGuarantorForm] = useState(false);
  const [gForm, setGForm] = useState<any>({ name: "", phone: "", nid: "", address: "", relation: "" });
  const [lastSale, setLastSale] = useState<any>(null);
  const [showReceipt, setShowReceipt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const mobileScanner = useMobileScanner();

  useEffect(() => { inputRef.current?.focus(); load(); }, []);

  const load = async () => {
    const [{ data: p }, { data: c }, { data: g }] = await Promise.all([
      supabase.from("products").select("id,name,barcode,sku,price,stock").order("name"),
      supabase.from("customers").select("id,name,phone").order("name"),
      supabase.from("guarantors").select("id,name,phone").order("name"),
    ]);
    setProducts(p ?? []);
    setCustomers(c ?? []);
    setGuarantors(g ?? []);
  };

  useEffect(() => {
    if (!search) return;
    const id = setTimeout(() => {
      const exact = products.find(p => p.barcode === search);
      if (exact) { addToCart(exact); setSearch(""); }
    }, 200);
    return () => clearTimeout(id);
  }, [search, products]);

  const categories = ["__all"];
  const visible = products.filter(p => {
    if (search && !p.name.toLowerCase().includes(search.toLowerCase()) && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const addToCart = (p: Product) => {
    if (p.stock <= 0) {
      toast({ title: t("outOfStock"), variant: "destructive" });
      return;
    }
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
  const vat = subtotal * VAT_RATE;
  const baseTotal = Math.max(0, subtotal + vat - discount);
  const interestAmount = paymentType === "installment"
    ? (baseTotal - downPayment) * (interestRate / 100) * (installmentCount / 12)
    : 0;
  const total = baseTotal + interestAmount;
  const financed = paymentType === "installment" ? Math.max(total - downPayment, 0) : 0;
  const due = paymentType === "installment" ? financed : 0;
  const paid = paymentType === "installment" ? downPayment : total;
  const emi = paymentType === "installment" && installmentCount > 0 ? financed / installmentCount : 0;

  // Subscribe to barcodes from paired mobile scanner (managed globally)
  useEffect(() => {
    return mobileScanner.subscribe((code) => {
      const found = products.find(p => p.barcode === code || p.sku === code);
      if (found) {
        addToCart(found);
        toast({ title: "মোবাইল থেকে যোগ হয়েছে", description: found.name });
      } else {
        toast({ title: "Product পাওয়া যায়নি", description: code, variant: "destructive" });
      }
    });
  }, [mobileScanner, products]);

  const saveGuarantor = async () => {
    if (!gForm.name) return toast({ title: "Name required", variant: "destructive" });
    const { data, error } = await supabase.from("guarantors").insert(gForm).select().single();
    if (error) return toast({ title: error.message, variant: "destructive" });
    setGuarantors([data, ...guarantors]); setGuarantorId(data.id); setShowGuarantorForm(false);
    setGForm({ name: "", phone: "", nid: "", address: "", relation: "" });
  };

  const completeSale = async () => {
    if (cart.length === 0) return;
    if (paymentType === "installment" && !customerId) {
      toast({ title: lang === "bn" ? "ক্রেতা নির্বাচন করুন" : "Select a customer", variant: "destructive" });
      return;
    }
    if (paymentType === "installment" && !guarantorId) {
      toast({ title: lang === "bn" ? "জামিনদার নির্বাচন করুন" : "Select a guarantor", variant: "destructive" });
      return;
    }

    const salePayload: any = {
      customer_id: customerId || null,
      subtotal, discount, total, paid, due,
      payment_type: paymentType,
      status: due > 0 ? "partial" : "completed",
      created_by: user!.id,
    };
    if (paymentType === "installment") {
      salePayload.down_payment = downPayment;
      salePayload.interest_rate = interestRate;
      salePayload.tenure_months = installmentCount;
      salePayload.emi_amount = emi;
      salePayload.late_fee_per_day = lateFeePerDay;
      salePayload.guarantor_id = guarantorId;
    }
    const { data: sale, error } = await supabase.from("sales").insert(salePayload).select().single();
    if (error) { toast({ title: error.message, variant: "destructive" }); return; }

    const items = cart.map(i => ({
      sale_id: sale.id, product_id: i.product.id, product_name: i.product.name,
      qty: i.qty, unit_price: i.product.price, subtotal: i.product.price * i.qty,
    }));
    await supabase.from("sale_items").insert(items);

    if (paymentType === "installment" && due > 0) {
      const per = Math.round((due / installmentCount) * 100) / 100;
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
    setCart([]); setDiscount(0); setCustomerId(""); setPaymentType("cash"); setPaymentMethod("cash");
    setDownPayment(0); setInterestRate(0); setLateFeePerDay(0); setGuarantorId("");
    load();
    toast({ title: lang === "bn" ? "বিক্রয় সম্পন্ন" : "Sale completed" });
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 h-[calc(100vh-8rem)]">
      <section className="lg:col-span-3 flex flex-col gap-4 min-h-0">
        <div className="bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-4 shadow-sm space-y-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={t("productSearch")}
              className="w-full h-14 pl-12 pr-12 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-base"
            />
            <button
              type="button"
              onClick={() => setScannerOpen(true)}
              aria-label="Open barcode scanner"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-all active:scale-95"
            >
              <ScanLine className="h-5 w-5" />
            </button>
          </div>
          {mobileScanner.phase === "connected" && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/10 px-3 py-2 text-xs font-medium text-primary">
              <Wifi className="h-4 w-4" />
              <span>মোবাইল scanner connected — scan করলে cart-এ যোগ হবে</span>
            </div>
          )}
          {mobileScanner.phase !== "connected" && (
            <Link
              to="/install"
              className="flex items-center gap-2 rounded-xl bg-muted/50 hover:bg-muted px-3 py-2 text-xs text-muted-foreground transition-colors"
            >
              <Smartphone className="h-4 w-4 text-primary" />
              <span>মোবাইল ফোনকে wireless scanner বানাতে চান? Scanner App পেজে যান</span>
            </Link>
          )}
        </div>

        <div className="flex gap-3 overflow-x-auto pb-2">
          {categories.map(c => (
            <button key={c} onClick={() => setActiveCat(c)}
              className={`px-6 py-2 rounded-full font-medium whitespace-nowrap text-sm transition-all ${
                activeCat === c
                  ? "bg-primary text-primary-foreground"
                  : "bg-[hsl(var(--surface-container-lowest))] text-muted-foreground hover:bg-white"
              }`}>
              {c === "__all" ? t("allProducts") : c}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto pr-2 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4 pb-4">
          {visible.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-16">{t("noResults")}</div>
          )}
          {visible.map(p => (
            <button key={p.id} onClick={() => addToCart(p)}
              className="bg-[hsl(var(--surface-container-lowest))] p-3 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col gap-2 text-left">
              <div className="aspect-square rounded-lg overflow-hidden bg-[hsl(var(--surface-container-high))] relative flex items-center justify-center">
                <Package className="h-12 w-12 text-muted-foreground/40 group-hover:scale-110 transition-transform duration-500" />
                {p.stock <= 5 && p.stock > 0 && (
                  <span className="absolute top-2 right-2 bg-secondary text-[hsl(var(--secondary-foreground))] text-[10px] font-bold px-2 py-1 rounded-md">
                    {t("lowStock")}
                  </span>
                )}
                {p.stock === 0 && (
                  <span className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px] font-bold px-2 py-1 rounded-md">
                    {t("outOfStock")}
                  </span>
                )}
              </div>
              <div className="flex flex-col">
                <h3 className="font-bold text-foreground text-sm leading-tight line-clamp-2">{p.name}</h3>
                <div className="flex justify-between items-center mt-2">
                  <span className="text-primary font-bold">{fmt(p.price)}</span>
                  <span className="text-primary bg-primary/10 p-1 rounded-lg">
                    <Plus className="h-4 w-4" />
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      <section className="lg:col-span-2 flex flex-col bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-6 min-h-0 shadow-sm">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-extrabold flex items-center gap-2 text-foreground">
            <ShoppingCart className="h-6 w-6 text-primary" />
            {t("currentCart")} ({cart.length})
          </h2>
          {cart.length > 0 && (
            <button onClick={() => setCart([])} className="text-destructive text-sm font-medium flex items-center gap-1 hover:bg-destructive/10 px-3 py-1 rounded-lg transition-colors">
              <Trash className="h-4 w-4" />
              {t("clearAll")}
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {cart.length === 0 && (
            <div className="text-center text-muted-foreground py-12">{t("emptyCart")}</div>
          )}
          {cart.map(i => (
            <div key={i.product.id} className="flex items-center gap-3 p-2 bg-[hsl(var(--surface))] rounded-xl">
              <div className="w-14 h-14 rounded-lg bg-[hsl(var(--surface-container-high))] flex items-center justify-center shrink-0">
                <Package className="h-6 w-6 text-muted-foreground/50" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm truncate">{i.product.name}</h4>
                <div className="flex items-center justify-between mt-2 gap-2">
                  <div className="flex items-center gap-2 bg-[hsl(var(--surface-container-high))] rounded-full px-2 py-1">
                    <button onClick={() => updateQty(i.product.id, -1)} className="w-6 h-6 flex items-center justify-center bg-[hsl(var(--surface-container-lowest))] rounded-full shadow-sm active:scale-90">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{i.qty}</span>
                    <button onClick={() => updateQty(i.product.id, 1)} className="w-6 h-6 flex items-center justify-center bg-[hsl(var(--surface-container-lowest))] rounded-full shadow-sm active:scale-90">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <span className="font-bold text-primary text-sm">{fmt(i.product.price * i.qty)}</span>
                  <button onClick={() => removeItem(i.product.id)} className="text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <Label className="text-xs">{t("customer")}</Label>
                <Select value={customerId || "_walkin"} onValueChange={v => setCustomerId(v === "_walkin" ? "" : v)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_walkin">{t("walkInCustomer")}</SelectItem>
                    {customers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">{t("paymentType")}</Label>
                <Select value={paymentType} onValueChange={v => setPaymentType(v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("cash")}</SelectItem>
                    <SelectItem value="installment">{t("installmentSale")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {paymentType === "installment" && (
              <div className="mb-3 space-y-2 p-3 rounded-xl bg-secondary/15">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--secondary-foreground))]">{t("loanTerms")}</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label className="text-xs">{t("downPayment")}</Label>
                    <Input type="number" value={downPayment} onChange={e => setDownPayment(+e.target.value || 0)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("tenureMonths")}</Label>
                    <Input type="number" min={1} max={60} value={installmentCount}
                      onChange={e => setInstallmentCount(Math.max(1, +e.target.value))} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("interestRate")}</Label>
                    <Input type="number" value={interestRate} onChange={e => setInterestRate(+e.target.value || 0)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("lateFee")}</Label>
                    <Input type="number" value={lateFeePerDay} onChange={e => setLateFeePerDay(+e.target.value || 0)} className="h-9" />
                  </div>
                </div>
                <div>
                  <Label className="text-xs">{t("guarantor")}</Label>
                  <div className="flex gap-2">
                    <Select value={guarantorId || "_none"} onValueChange={v => v === "__new" ? setShowGuarantorForm(true) : setGuarantorId(v === "_none" ? "" : v)}>
                      <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">—</SelectItem>
                        {guarantors.map(g => <SelectItem key={g.id} value={g.id}>{g.name} {g.phone ? `(${g.phone})` : ""}</SelectItem>)}
                        <SelectItem value="__new">+ {t("add")} {t("guarantor")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-between text-xs pt-2 border-t border-secondary/30">
                  <span className="text-muted-foreground">EMI/{t("months")}</span>
                  <span className="font-bold">{fmt(emi)}</span>
                </div>
              </div>
            )}
          </>
        )}

        <div className="space-y-4 pt-4 border-t border-[hsl(var(--surface-container-high))]">
          <div className="flex gap-2">
            <input
              type="number"
              value={discount || ""}
              onChange={e => setDiscount(+e.target.value || 0)}
              placeholder={t("discountCode")}
              className="flex-1 h-10 px-4 rounded-lg bg-[hsl(var(--surface))] border-none text-sm focus:outline-none focus:ring-2 focus:ring-secondary/50"
            />
            <button className="bg-secondary text-[hsl(var(--secondary-foreground))] px-4 rounded-lg font-bold text-sm hover:brightness-105 transition">
              {t("apply")}
            </button>
          </div>

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{t("subtotal")}:</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("vat")}:</span><span>{fmt(vat)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("discount")}:</span><span className="text-destructive">-{fmt(discount)}</span></div>
            <div className="flex justify-between text-xl font-black pt-2 border-t border-dashed border-[hsl(var(--surface-container-highest))]"><span>{t("grandTotal")}:</span><span className="text-primary">{fmt(total)}</span></div>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("paymentMethods")}</span>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "cash", label: "Cash" },
                { id: "card", label: "Card" },
                { id: "bkash", label: "bKash", color: "text-pink-600" },
                { id: "nagad", label: "Nagad", color: "text-orange-600" },
              ].map(m => (
                <button key={m.id} onClick={() => setPaymentMethod(m.id as any)}
                  className={`h-10 flex items-center justify-center rounded-lg transition-all text-xs font-bold ${
                    paymentMethod === m.id
                      ? "bg-[hsl(var(--surface-container-low))] border-2 border-primary text-primary"
                      : `bg-[hsl(var(--surface-container-low))] ${m.color ?? "text-muted-foreground"} hover:bg-[hsl(var(--surface-container))]`
                  }`}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <button onClick={completeSale} disabled={cart.length === 0}
              className="w-full h-14 gradient-primary text-primary-foreground rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
              <ReceiptIcon className="h-5 w-5" />
              {t("payNow")}
            </button>
          </div>
        </div>
      </section>

      <Dialog open={pairOpen} onOpenChange={setPairOpen}>
        <DialogContent className="max-w-xl bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Smartphone className="h-5 w-5 text-primary" /> Mobile Pairing</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Card className="p-4 space-y-2 bg-primary/5 border-primary/20">
              <div className="flex items-center gap-2 text-sm font-bold"><Wifi className="h-4 w-4 text-primary" /> Step 1: মোবাইলে scanner app খুলুন</div>
              <p className="text-xs text-muted-foreground">এই QR scan করুন অথবা link copy করে ফোনে খুলুন।</p>
              <div className="bg-background rounded-xl p-4">
                <QRCode value={pairLink} size={180} className="mx-auto h-auto w-full max-w-[180px]" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(pairLink); toast({ title: "Link copied" }); }}><Link2 className="h-4 w-4" /> Copy link</Button>
                <Button variant="outline" onClick={() => { navigator.clipboard.writeText(offerText); toast({ title: "Offer copied" }); }}><Copy className="h-4 w-4" /> Copy offer</Button>
              </div>
            </Card>

            <div className="space-y-2">
              <Label>Step 2: Scanner app-এর answer code এখানে দিন</Label>
              <textarea
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                placeholder="Answer code / link paste করুন"
                className="w-full min-h-28 rounded-xl border bg-background p-3 text-xs"
              />
              <Button onClick={finalizePairing} className="w-full gradient-primary text-primary-foreground">Connect scanner</Button>
            </div>

            <div className="rounded-xl bg-muted/50 px-4 py-3 text-sm flex items-center gap-2">
              {rtcPhase === "connected" ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Smartphone className="h-4 w-4 text-primary" />}
              <span>{connectionState}</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPairOpen(false)}>{t("cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-sm bg-[hsl(var(--surface-container-lowest))]">
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
            <Button onClick={() => window.print()} className="gradient-primary"><Printer className="h-4 w-4 mr-1" />{t("printReceipt")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showGuarantorForm} onOpenChange={setShowGuarantorForm}>
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
            <Button variant="outline" onClick={() => setShowGuarantorForm(false)}>{t("cancel")}</Button>
            <Button onClick={saveGuarantor} className="gradient-primary">{t("save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BarcodeScanner
        open={scannerOpen}
        onClose={() => setScannerOpen(false)}
        onDetected={(code) => {
          setScannerOpen(false);
          const found = products.find(p => p.barcode === code || p.sku === code);
          if (found) {
            addToCart(found);
            toast({ title: "✓ যোগ হয়েছে", description: found.name });
          } else {
            setSearch(code);
            toast({ title: "Product পাওয়া যায়নি", description: code, variant: "destructive" });
          }
        }}
      />
    </div>
  );
}
