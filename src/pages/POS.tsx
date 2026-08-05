import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Trash2, Plus, Minus, Search, ScanLine, ShoppingCart, Trash, Receipt as ReceiptIcon, Printer, Package, Smartphone, Wifi, CalendarDays } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { BarcodeScanner } from "@/components/BarcodeScanner";
import { useMobileScanner } from "@/hooks/useMobileScanner";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { CustomerCombobox } from "@/components/CustomerCombobox";
import { ThermalReceipt } from "@/components/ThermalReceipt";
import { bdDateAddMonths, todayBD } from "@/lib/datetime";
import { printSale as printSaleUnified } from "@/lib/printSale";

type Product = { id: string; name: string; barcode: string | null; sku: string | null; price: number; stock: number; image_url?: string | null; has_warranty?: boolean; warranty_months?: number | null };
type CartItem = { product: Product; qty: number; warrantyMonths?: number | null };

// Cart price input with local text state — ensures every keystroke commits to cart
// and avoids controlled-input glitches (cursor jump, stale value) on mobile.
function CartPriceInput({ value, onCommit }: { value: number; onCommit: (n: number) => void }) {
  const [text, setText] = useState<string>(String(value ?? 0));
  const focusedRef = useRef(false);
  // Sync external value into local text only when not focused (avoid clobbering typing)
  useEffect(() => {
    if (!focusedRef.current) setText(String(value ?? 0));
  }, [value]);
  return (
    <Input
      type="text"
      inputMode="decimal"
      pattern="[0-9]*\.?[0-9]*"
      value={text}
      onFocus={(e) => { focusedRef.current = true; e.currentTarget.select(); }}
      onBlur={() => {
        focusedRef.current = false;
        const n = Number(text);
        if (!Number.isFinite(n) || text.trim() === "") setText(String(value ?? 0));
      }}
      onChange={(e) => {
        const raw = e.target.value;
        // Allow only digits + single dot
        if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
        setText(raw);
        if (raw === "" || raw === ".") { onCommit(0); return; }
        const n = Number(raw);
        if (Number.isFinite(n)) onCommit(n);
      }}
      className="h-7 w-24 text-xs px-2 font-semibold"
      title="প্রতি একক বিক্রয় মূল্য — এডিট করতে ক্লিক করুন"
    />
  );
}


const VAT_RATE = 0; // VAT disabled — to be configured later via dedicated VAT settings page
const INSTALLMENT_DUE_DAY = 5;
const roundMoney = (value: number) => Math.round(value * 100) / 100;

const recoverBaseTotal = (sale: any) => {
  const total = Number(sale.total) || 0;
  const downPayment = Number(sale.down_payment) || 0;
  const interestRate = Number(sale.interest_rate) || 0;
  const tenureMonths = Number(sale.tenure_months) || 0;
  const interestFactor = (interestRate / 100) * (tenureMonths / 12);
  return interestFactor ? roundMoney((total + downPayment * interestFactor) / (1 + interestFactor)) : total;
};

export default function POS() {
  const { t, fmt, lang } = useT();
  const { user, role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const { currentShop } = useShop();
  const { toast } = useToast();
  const receiptRef = useRef<HTMLDivElement>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("__all");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "card" | "bkash" | "nagad">("cash");
  const [paymentType, setPaymentType] = useState<"cash" | "installment" | "due">("cash");
  const [duePaid, setDuePaid] = useState(0); // for "বাকিতে" — how much customer pays now
  const [totalOverride, setTotalOverride] = useState<number | null>(null);
  const [extraChargeOverride, setExtraChargeOverride] = useState<number | null>(null);
  const [editingExtra, setEditingExtra] = useState(false);
  
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [installmentCount, setInstallmentCount] = useState(3);
  const [downPayment, setDownPayment] = useState(0);
  const [interestRate, setInterestRate] = useState(0); // kept for DB compatibility, always 0
  const [lateFeePerDay, setLateFeePerDay] = useState(5); // default 5%
  const [scheduleDates, setScheduleDates] = useState<string[]>([]);
  const [guarantors, setGuarantors] = useState<any[]>([]);
  const [guarantorId, setGuarantorId] = useState<string>("");
  const [showGuarantorForm, setShowGuarantorForm] = useState(false);
  const [gForm, setGForm] = useState<any>({ name: "", phone: "", nid: "", address: "", relation: "" });
  const [lastSale, setLastSale] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const mobileScanner = useMobileScanner();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editId = searchParams.get("edit");
  const [editingSaleId, setEditingSaleId] = useState<string | null>(null);
  const [originalQty, setOriginalQty] = useState<Record<string, number>>({});
  const [editLoaded, setEditLoaded] = useState(false);
  // Existing installment rows of the sale being edited (with real collected amounts)
  const [existingInstallments, setExistingInstallments] = useState<any[]>([]);
  const collectedInstallments = existingInstallments.reduce((a, i) => a + (Number(i.paid_amount) || 0), 0);

  useEffect(() => { inputRef.current?.focus(); load(); }, []);

  // Load existing sale into POS for editing
  useEffect(() => {
    if (!editId || editLoaded || products.length === 0) return;
    (async () => {
      const { data: sale } = await supabase.from("sales").select("*").eq("id", editId).maybeSingle();
      if (!sale) { toast({ title: "Sale পাওয়া যায়নি", variant: "destructive" }); return; }
      const { data: items } = await supabase.from("sale_items").select("*").eq("sale_id", editId);
      const orig: Record<string, number> = {};
      const newCart: CartItem[] = [];
      const savedDiscount = Number(sale.discount) || 0;
      const savedExtraCharge = Number((sale as any).extra_charge) || 0;
      const savedBaseTotal = recoverBaseTotal(sale);
      // Load line items EXACTLY as saved — never scale unit prices to match the
      // invoice total, otherwise the total/extra-charge leaks into product prices
      // and inflates the amount on every re-edit.
      (items ?? []).forEach((it: any) => {
        const p = products.find(pp => pp.id === it.product_id);
        if (p) {
          const qty = Number(it.qty) || 1;
          const unitPrice = Number(it.unit_price) || 0;
          orig[p.id] = (orig[p.id] || 0) + qty;
          newCart.push({ product: { ...p, price: unitPrice }, qty, warrantyMonths: it.warranty_months ?? (p.has_warranty ? Number(p.warranty_months) || null : null) });
        }
      });
      const rawSubtotal = newCart.reduce((sum, i) => sum + i.product.price * i.qty, 0);
      const recomputedBase = Math.max(0, rawSubtotal * (1 + VAT_RATE) - savedDiscount + (sale.payment_type !== "cash" ? savedExtraCharge : 0));
      setEditingSaleId(editId);
      setOriginalQty(orig);
      setCart(newCart);
      setCustomerId(sale.customer_id || "");
      setDiscount(savedDiscount);
      // If the saved total was manually adjusted (round-off / negotiation), keep it as
      // an explicit override instead of baking the difference into product prices.
      setTotalOverride(
        Math.abs(recomputedBase - savedBaseTotal) > 0.009 ? roundMoney(savedBaseTotal) : null
      );

      // Restore the exact extra-charge the cashier saved (including 0) so it does
      // not silently get recomputed from product defaults on every reopen.
      if (sale.payment_type !== "cash") {
        setExtraChargeOverride(savedExtraCharge);
      }
      if (sale.payment_type === "installment") {
        setPaymentType("installment");
        setDownPayment(Number(sale.down_payment) || 0);
        setInterestRate(0);
        setInstallmentCount(Number(sale.tenure_months) || 3);
        setLateFeePerDay(Number(sale.late_fee_per_day) || 5);
        const { data: existingInst } = await supabase
          .from("installments").select("id, installment_no, due_date, amount, paid_amount, status")
          .eq("sale_id", editId).order("installment_no");
        setExistingInstallments(existingInst ?? []);
        if (existingInst && existingInst.length) {
          setScheduleDates(existingInst.map((i: any) => i.due_date));
          setInstallmentCount(existingInst.length);
        }
        setGuarantorId(sale.guarantor_id || "");
      } else if (Number(sale.due) > 0) {
        setPaymentType("due");
        setDuePaid(Number(sale.paid) || 0);
      } else {
        setPaymentType("cash");
      }
      setEditLoaded(true);
      toast({ title: `এডিট মোড — ${sale.invoice_no}` });
    })();
  }, [editId, products, editLoaded]);

  const load = async () => {
    const [{ data: p }, { data: c }, { data: g }] = await Promise.all([
      supabase.from("products").select("id,name,barcode,sku,price,stock,image_url,has_warranty,warranty_months,credit_extra,installment_extra").order("name"),
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

  const clearTotalOverride = () => setTotalOverride(null);
  // Reset extra-charge override whenever cart contents or payment type change — but
  // NOT while loading an existing invoice for edit (the loader restores the saved value).
  const skipExtraResetRef = useRef(false);
  useEffect(() => {
    if (editId && !editLoaded) { skipExtraResetRef.current = true; return; }
    if (skipExtraResetRef.current) { skipExtraResetRef.current = false; return; }
    setExtraChargeOverride(null);
    setEditingExtra(false);
  }, [paymentType, cart.length, editId, editLoaded]);


  const addToCart = (p: Product) => {
    const extra = originalQty[p.id] || 0;
    if (p.stock + extra <= 0) {
      toast({ title: t("outOfStock"), variant: "destructive" });
      return;
    }
    clearTotalOverride();
    setCart(c => {
      const ex = c.find(i => i.product.id === p.id);
      if (ex) return c.map(i => i.product.id === p.id ? { ...i, qty: Math.min(i.qty + 1, p.stock + extra) } : i);
      const defaultMonths = p.has_warranty ? (Number(p.warranty_months) || null) : null;
      return [...c, { product: p, qty: 1, warrantyMonths: defaultMonths }];
    });
  };
  const updateQty = (id: string, delta: number) => {
    clearTotalOverride();
    setCart(c => c.map(i => i.product.id === id ? { ...i, qty: Math.max(1, Math.min(i.qty + delta, i.product.stock + (originalQty[i.product.id] || 0))) } : i));
  };
  const removeItem = (id: string) => { clearTotalOverride(); setCart(c => c.filter(i => i.product.id !== id)); };
  const updatePrice = (id: string, price: number) => {
    if (!Number.isFinite(price)) return;
    clearTotalOverride();
    setCart(c => c.map(i => i.product.id === id ? { ...i, product: { ...i.product, price: Math.max(0, price) } } : i));
  };
  const updateWarranty = (id: string, months: number | null) => {
    setCart(c => c.map(i => i.product.id === id ? { ...i, warrantyMonths: months } : i));
  };

  const subtotal = cart.reduce((a, i) => a + i.product.price * i.qty, 0);
  // Extra charge for credit / installment sales (per-product configured in Stock entry)
  const computedExtra = cart.reduce((a, i) => {
    const p: any = i.product;
    if (paymentType === "installment") return a + (Number(p.installment_extra) || 0) * i.qty;
    if (paymentType === "due")         return a + (Number(p.credit_extra) || 0) * i.qty;
    return a;
  }, 0);
  const extraCharge = paymentType === "cash"
    ? 0
    : (extraChargeOverride !== null ? Math.max(0, extraChargeOverride) : computedExtra);
  const vat = subtotal * VAT_RATE;
  const computedBase = Math.max(0, subtotal + vat - discount + extraCharge);
  // Allow user to override grand total (for negotiation / round-off). Override applies before installment interest.
  const baseTotal = totalOverride !== null ? Math.max(0, totalOverride) : computedBase;
  // EMI calculation: simple interest over tenure (more transparent for retail)
  const principal = paymentType === "installment" ? Math.max(baseTotal - downPayment, 0) : 0;
  const interestAmount = paymentType === "installment"
    ? principal * (interestRate / 100) * (installmentCount / 12)
    : 0;
  const total = baseTotal + interestAmount;
  const financed = principal + interestAmount;
  // Already-collected installment money (edit mode only) must be respected so the
  // real remaining due is shown instead of the whole financed amount again.
  const collected = paymentType === "installment" ? Math.min(collectedInstallments, financed) : 0;
  const due =
    paymentType === "installment" ? Math.max(financed - collected, 0)
    : paymentType === "due" ? Math.max(total - duePaid, 0)
    : 0;
  const paid =
    paymentType === "installment" ? downPayment + collected
    : paymentType === "due" ? Math.min(duePaid, total)
    : total;
  const emi = paymentType === "installment" && installmentCount > 0 ? financed / installmentCount : 0;

  // Default schedule dates: 5th of each upcoming month, in Asia/Dhaka tz
  const defaultScheduleDates = (count: number): string[] =>
    Array.from({ length: count }).map((_, idx) => bdDateAddMonths(idx + 1, INSTALLMENT_DUE_DAY));

  // Keep scheduleDates length in sync with installmentCount (preserve user-edited dates)
  useEffect(() => {
    if (paymentType !== "installment") return;
    setScheduleDates(prev => {
      const def = defaultScheduleDates(installmentCount);
      return Array.from({ length: installmentCount }).map((_, i) => prev[i] || def[i]);
    });
  }, [installmentCount, paymentType]);

  // EMI schedule preview
  const schedulePreview = useMemo(() => {
    if (paymentType !== "installment" || installmentCount <= 0 || financed <= 0) return [];
    const per = Math.round((financed / installmentCount) * 100) / 100;
    const dates = scheduleDates.length === installmentCount ? scheduleDates : defaultScheduleDates(installmentCount);
    return Array.from({ length: installmentCount }).map((_, idx) => {
      const amount = idx === installmentCount - 1 ? financed - per * (installmentCount - 1) : per;
      return { no: idx + 1, date: dates[idx], amount };
    });
  }, [paymentType, installmentCount, financed, scheduleDates]);

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
    if (submitting) return; // guard against double-submit
    if (paymentType === "installment" && !customerId) {
      toast({ title: lang === "bn" ? "ক্রেতা নির্বাচন করুন" : "Select a customer", variant: "destructive" });
      return;
    }
    if (paymentType === "installment" && !guarantorId) {
      toast({ title: lang === "bn" ? "জামিনদার নির্বাচন করুন" : "Select a guarantor", variant: "destructive" });
      return;
    }
    if (paymentType === "due" && !customerId) {
      toast({ title: lang === "bn" ? "বাকির জন্য ক্রেতা নির্বাচন করুন" : "Select a customer for credit sale", variant: "destructive" });
      return;
    }

    setSubmitting(true);
    try {
    // ============ EDIT MODE: update existing sale ============
    if (editingSaleId) {
      // 1) Restock previous items
      for (const [pid, qty] of Object.entries(originalQty)) {
        const { data: prod } = await supabase.from("products").select("stock").eq("id", pid).maybeSingle();
        if (prod) await supabase.from("products").update({ stock: Number(prod.stock) + Number(qty) }).eq("id", pid);
      }
      // 2) Reload the latest installment state (another user may have collected money meanwhile)
      const { data: insts } = await supabase
        .from("installments").select("id, installment_no, amount, paid_amount")
        .eq("sale_id", editingSaleId).order("installment_no");
      const liveInsts = insts ?? [];
      const liveCollected = liveInsts.reduce((a: number, i: any) => a + (Number(i.paid_amount) || 0), 0);

      if (liveCollected > 0 && paymentType !== "installment") {
        toast({
          title: lang === "bn"
            ? "এই বিক্রয়ে কিস্তি পরিশোধ হয়েছে — পেমেন্ট টাইপ পরিবর্তন করা যাবে না"
            : "Installment payments already collected — payment type can't be changed",
          variant: "destructive",
        });
        return;
      }
      if (paymentType !== "installment" && liveInsts.length) {
        await supabase.from("installments").delete().in("id", liveInsts.map((i: any) => i.id));
      }
      await supabase.from("sale_items").delete().eq("sale_id", editingSaleId);

      // 3) Update sales row
      const updatePayload: any = {
        customer_id: customerId || null,
        subtotal, discount, total, paid, due,
        extra_charge: paymentType === "cash" ? 0 : extraCharge,
        payment_type: paymentType === "due" ? "cash" : paymentType,
        status: due > 0 ? "partial" : "completed",
        down_payment: paymentType === "installment" ? downPayment : 0,
        interest_rate: paymentType === "installment" ? interestRate : 0,
        tenure_months: paymentType === "installment" ? installmentCount : null,
        emi_amount: paymentType === "installment" ? emi : null,
        late_fee_per_day: paymentType === "installment" ? lateFeePerDay : 0,
        guarantor_id: paymentType === "installment" ? guarantorId : null,
      };
      const { error: uerr } = await supabase.from("sales").update(updatePayload).eq("id", editingSaleId);
      if (uerr) { toast({ title: uerr.message, variant: "destructive" }); return; }
      logActivity({ action: "sale.update", entity_type: "sale", entity_id: editingSaleId, meta: { amount: total } });

      // 4) Insert new sale_items (trigger will decrement stock)
      const newItems = cart.map(i => {
        const months = i.warrantyMonths != null && Number(i.warrantyMonths) > 0 ? Number(i.warrantyMonths) : null;
        const warranty_until: string | null = months ? bdDateAddMonths(months) : null;
        return {
          sale_id: editingSaleId, product_id: i.product.id, product_name: i.product.name,
          qty: i.qty, unit_price: i.product.price, subtotal: i.product.price * i.qty,
          warranty_months: months, warranty_until,
        };
      });
      await supabase.from("sale_items").insert(newItems);

      // 5) Recreate installments if installment type
      if (paymentType === "installment" && due > 0) {
        const per = Math.round((due / installmentCount) * 100) / 100;
        const dates = scheduleDates.length === installmentCount ? scheduleDates : defaultScheduleDates(installmentCount);
        const schedule = Array.from({ length: installmentCount }).map((_, idx) => ({
          sale_id: editingSaleId, installment_no: idx + 1,
          due_date: dates[idx],
          amount: idx === installmentCount - 1 ? due - per * (installmentCount - 1) : per,
        }));
        await supabase.from("installments").insert(schedule);
      }

      toast({ title: lang === "bn" ? "ইনভয়েস আপডেট হয়েছে ✓" : "Sale updated" });
      navigate("/sales");
      return;
    }

    // ============ NEW SALE ============
    const salePayload: any = {
      customer_id: customerId || null,
      subtotal, discount, total, paid, due,
      extra_charge: paymentType === "cash" ? 0 : extraCharge,
      payment_type: paymentType === "due" ? "cash" : paymentType,
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
    logActivity({
      action: "sale.create",
      entity_type: "sale",
      entity_id: sale.id,
      shop_id: salePayload.shop_id ?? null,
      meta: { invoice_no: sale.invoice_no, amount: Number(sale.total), payment_type: paymentType },
    });

    const items = cart.map(i => {
      const months = i.warrantyMonths != null && Number(i.warrantyMonths) > 0 ? Number(i.warrantyMonths) : null;
      const warranty_until: string | null = months ? bdDateAddMonths(months) : null;
      return {
        sale_id: sale.id, product_id: i.product.id, product_name: i.product.name,
        qty: i.qty, unit_price: i.product.price, subtotal: i.product.price * i.qty,
        warranty_months: months, warranty_until,
      };
    });
    await supabase.from("sale_items").insert(items);

    if (paymentType === "installment" && due > 0) {
      const per = Math.round((due / installmentCount) * 100) / 100;
      const dates = scheduleDates.length === installmentCount ? scheduleDates : defaultScheduleDates(installmentCount);
      const schedule = Array.from({ length: installmentCount }).map((_, idx) => ({
        sale_id: sale.id, installment_no: idx + 1,
        due_date: dates[idx],
        amount: idx === installmentCount - 1 ? due - per * (installmentCount - 1) : per,
      }));
      const { error: instErr } = await supabase.from("installments").insert(schedule);
      if (instErr) { toast({ title: instErr.message, variant: "destructive" }); return; }

    }

    const firstDue = paymentType === "installment" && installmentCount > 0
      ? (scheduleDates[0] || defaultScheduleDates(installmentCount)[0])
      : undefined;
    setLastSale({ ...sale, items: cart, customer: customers.find(c => c.id === customerId), payment_method: paymentMethod, first_due: firstDue });
    setShowReceipt(true);
    setCart([]); setDiscount(0); setCustomerId(""); setPaymentType("cash"); setPaymentMethod("cash");
    setDownPayment(0); setInterestRate(0); setLateFeePerDay(5); setGuarantorId(""); setScheduleDates([]);
    setDuePaid(0); setTotalOverride(null);
    load();
    toast({ title: lang === "bn" ? "বিক্রয় সম্পন্ন" : "Sale completed" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6 lg:h-[calc(100vh-8rem)]">
      <section className="lg:col-span-3 flex flex-col gap-4 lg:min-h-0">
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

        <div className="lg:flex-1 lg:overflow-y-auto pr-2 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 pb-4">
          {visible.length === 0 && (
            <div className="col-span-full text-center text-muted-foreground py-16">{t("noResults")}</div>
          )}
          {visible.map(p => (
            <button key={p.id} onClick={() => addToCart(p)}
              className="bg-[hsl(var(--surface-container-lowest))] p-3 rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer group flex flex-col gap-2 text-left">
              <div className="aspect-square rounded-lg overflow-hidden bg-[hsl(var(--surface-container-high))] relative flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                ) : (
                  <Package className="h-12 w-12 text-muted-foreground/40 group-hover:scale-110 transition-transform duration-500" />
                )}
                {p.stock === 1 && (
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

      <section className="lg:col-span-2 flex flex-col bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-4 sm:p-6 shadow-sm">
        {editingSaleId && (
          <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs sm:text-sm font-semibold text-primary">
            <span>✎ এডিট মোড — ইনভয়েস আপডেট হবে</span>
            <button onClick={() => navigate("/sales")} className="underline hover:text-primary/80">বাতিল</button>
          </div>
        )}
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

        <div className="space-y-3 mb-4 max-h-[60vh] lg:max-h-none overflow-y-auto lg:overflow-visible pr-1 rounded-xl lg:border lg:border-[hsl(var(--surface-container-high))] lg:bg-[hsl(var(--surface-container-low))] lg:p-2">
          {cart.length === 0 && (
            <div className="text-center text-muted-foreground py-12">{t("emptyCart")}</div>
          )}
          {cart.map(i => (
            <div key={i.product.id} className="flex items-center gap-3 p-2 bg-[hsl(var(--surface))] rounded-xl">
              <div className="w-14 h-14 rounded-lg bg-[hsl(var(--surface-container-high))] flex items-center justify-center shrink-0 overflow-hidden">
                {i.product.image_url ? (
                  <img src={i.product.image_url} alt={i.product.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-sm truncate">{i.product.name}</h4>
                <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
                  <div className="flex items-center gap-2 bg-[hsl(var(--surface-container-high))] rounded-full px-2 py-1">
                    <button onClick={() => updateQty(i.product.id, -1)} className="w-6 h-6 flex items-center justify-center bg-[hsl(var(--surface-container-lowest))] rounded-full shadow-sm active:scale-90">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{i.qty}</span>
                    <button onClick={() => updateQty(i.product.id, 1)} className="w-6 h-6 flex items-center justify-center bg-[hsl(var(--surface-container-lowest))] rounded-full shadow-sm active:scale-90">
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">৳</span>
                    <CartPriceInput
                      value={i.product.price}
                      onCommit={(n) => updatePrice(i.product.id, n)}
                    />
                  </div>

                  <span className="font-bold text-primary text-sm">{fmt(i.product.price * i.qty)}</span>
                  <button onClick={() => removeItem(i.product.id)} className="text-destructive p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 px-1">
                  <span className="text-[10px] font-bold text-info uppercase tracking-wider">ওয়ারেন্টি</span>
                  <Input
                    type="number"
                    min={0}
                    value={i.warrantyMonths ?? ""}
                    onChange={(e) => updateWarranty(i.product.id, e.target.value === "" ? null : Math.max(0, +e.target.value))}
                    placeholder="0"
                    className="h-6 w-16 text-xs px-2"
                    title="এই বিক্রয়ের জন্য ওয়ারেন্টি (মাস)"
                  />
                  <span className="text-[10px] text-muted-foreground">মাস</span>
                  {i.warrantyMonths && Number(i.warrantyMonths) > 0 ? (
                    <span className="text-[10px] font-semibold text-success">
                      মেয়াদ {bdDateAddMonths(Number(i.warrantyMonths))}
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground">কোন ওয়ারেন্টি নেই</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        {cart.length > 0 && (
          <>
            <div className="grid grid-cols-1 gap-2 mb-3">
              <div>
                <Label className="text-xs">{t("customer")}</Label>
                <CustomerCombobox customers={customers} value={customerId} onChange={setCustomerId} />
              </div>
              <div>
                <Label className="text-xs">{t("paymentType")}</Label>
                <Select value={paymentType} onValueChange={v => setPaymentType(v as any)}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">{t("cash")}</SelectItem>
                    <SelectItem value="due">বাকিতে</SelectItem>
                    <SelectItem value="installment">{t("installmentSale")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {paymentType === "installment" && (
              <div className="mb-3 space-y-2 p-3 rounded-xl bg-secondary/15">
                <div className="text-[11px] font-bold uppercase tracking-wider text-[hsl(var(--secondary-foreground))]">{t("loanTerms")}</div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <Label className="text-xs">Down Payment</Label>
                    <Input type="number" value={downPayment} onChange={e => setDownPayment(+e.target.value || 0)} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("tenureMonths")}</Label>
                    <Input type="number" min={1} max={60} value={installmentCount}
                      onChange={e => setInstallmentCount(Math.max(1, +e.target.value))} className="h-9" />
                  </div>
                  <div>
                    <Label className="text-xs">{t("lateFee")} (%)</Label>
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
                <div className="space-y-1 pt-2 border-t border-secondary/30 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">EMI / {t("months")}</span><span className="font-bold text-primary">{fmt(emi)}</span></div>
                </div>
                {schedulePreview.length > 0 && (
                  <details open className="text-xs rounded-lg bg-[hsl(var(--surface-container-lowest))] p-2">
                    <summary className="cursor-pointer font-bold flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" /> {t("schedule")} preview ({schedulePreview.length})</summary>
                    <div className="max-h-48 overflow-y-auto mt-2 space-y-1">
                      {schedulePreview.map((s, idx) => (
                        <div key={s.no} className="flex items-center gap-2 border-b border-dashed border-muted/50 py-1">
                          <span className="w-8 shrink-0 font-bold">#{s.no}</span>
                          <Input
                            type="date"
                            value={s.date}
                            onChange={e => {
                              const next = [...(scheduleDates.length === installmentCount ? scheduleDates : defaultScheduleDates(installmentCount))];
                              next[idx] = e.target.value;
                              setScheduleDates(next);
                            }}
                            className="h-7 text-xs flex-1 px-1"
                          />

                          <span className="font-mono font-bold w-20 text-right">{fmt(s.amount)}</span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}
            {paymentType === "due" && (
              <div className="mb-3 space-y-2 p-3 rounded-xl bg-warning/10">
                <div className="text-[11px] font-bold uppercase tracking-wider text-warning">বাকিতে বিক্রয়</div>
                <div>
                  <Label className="text-xs">এখন নগদ পরিশোধ (৳)</Label>
                  <Input type="number" min={0} value={duePaid || ""}
                    onChange={e => setDuePaid(Math.max(0, +e.target.value || 0))}
                    placeholder="0" className="h-9" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs pt-1">
                  <div className="rounded-lg bg-[hsl(var(--surface-container-lowest))] p-2">
                    <div className="text-muted-foreground">মোট</div>
                    <div className="font-bold">{fmt(total)}</div>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--surface-container-lowest))] p-2">
                    <div className="text-muted-foreground">নগদ</div>
                    <div className="font-bold text-success">{fmt(Math.min(duePaid, total))}</div>
                  </div>
                  <div className="rounded-lg bg-[hsl(var(--surface-container-lowest))] p-2">
                    <div className="text-muted-foreground">বকেয়া</div>
                    <div className="font-bold text-destructive">{fmt(Math.max(total - duePaid, 0))}</div>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="space-y-4 pt-4 border-t border-[hsl(var(--surface-container-high))]">
          {isAdmin && (
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
          )}

          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-muted-foreground"><span>{t("subtotal")}:</span><span>{fmt(subtotal)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("vat")} (0%):</span><span>{fmt(0)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>{t("discount")}:</span><span className="text-destructive">-{fmt(discount)}</span></div>
            {paymentType !== "cash" && (extraCharge > 0 || editingExtra || extraChargeOverride !== null) && (
              <div className="flex justify-between items-center gap-2 bg-amber-500/10 -mx-1 px-3 py-2 rounded-lg border border-amber-500/30">
                <span className="font-bold text-amber-700 dark:text-amber-400 text-xs">
                  {paymentType === "installment"
                    ? (lang === "bn" ? "কিস্তিতে অতিরিক্ত চার্জ" : "Installment Extra")
                    : (lang === "bn" ? "বাকিতে অতিরিক্ত চার্জ" : "Credit Extra")}
                </span>
                <div className="flex items-center gap-1.5">
                  {editingExtra ? (
                    <>
                      <span className="font-extrabold text-amber-700 dark:text-amber-400">+</span>
                      <Input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        defaultValue={String(extraCharge)}
                        onFocus={(e) => e.currentTarget.select()}
                        onBlur={(e) => {
                          const n = parseFloat(e.currentTarget.value);
                          setExtraChargeOverride(Number.isFinite(n) ? Math.max(0, n) : 0);
                          setEditingExtra(false);
                          clearTotalOverride();
                        }}
                        onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget as HTMLInputElement).blur(); }}
                        className="h-7 w-24 text-right font-extrabold text-amber-700 dark:text-amber-400 px-2"
                      />
                      {extraChargeOverride !== null && (
                        <button
                          type="button"
                          onClick={() => { setExtraChargeOverride(null); setEditingExtra(false); clearTotalOverride(); }}
                          className="text-[10px] text-muted-foreground hover:text-primary underline"
                          title={lang === "bn" ? "মূল মান" : "Reset"}
                        >↺</button>
                      )}
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingExtra(true)}
                      className="font-extrabold text-amber-700 dark:text-amber-400 hover:underline cursor-pointer"
                      title={lang === "bn" ? "ক্লিক করে এডিট করুন" : "Click to edit"}
                    >
                      +{fmt(extraCharge)} ✎
                    </button>
                  )}
                </div>
              </div>
            )}
            {paymentType === "installment" && downPayment > 0 && (
              <div className="flex justify-between text-muted-foreground"><span>{lang === "bn" ? "ডাউন পেমেন্ট" : "Down Payment"}:</span><span className="text-success">-{fmt(downPayment)}</span></div>
            )}
            {due > 0 && (
              <div className="flex justify-between items-center bg-destructive/10 -mx-1 px-3 py-2 rounded-lg">
                <span className="font-bold text-destructive">{lang === "bn" ? "বকেয়া" : "Due"}:</span>
                <span className="font-extrabold text-destructive text-base">{fmt(due)}</span>
              </div>
            )}

            {/* Editable Grand Total — admin-only edit; staff sees read-only total */}
            <div className="pt-3 border-t border-dashed border-[hsl(var(--surface-container-highest))]">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-base font-extrabold">{t("grandTotal")}:</span>
                {isAdmin && totalOverride !== null && (
                  <button onClick={() => setTotalOverride(null)} className="text-[11px] text-muted-foreground hover:text-primary underline">
                    মূল ({fmt(computedBase)}) এ ফিরুন
                  </button>
                )}
              </div>
              {isAdmin ? (
                <>
                  <div className={`flex items-stretch rounded-xl border-2 ${totalOverride !== null ? "border-primary/60 bg-primary/5" : "border-primary/30 bg-[hsl(var(--surface-container-low))]"} shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary/40 transition-all`}>
                    <button
                      type="button"
                      onClick={() => setTotalOverride(Math.max(0, Math.round((total - 10) * 100) / 100))}
                      className="px-3 sm:px-4 bg-[hsl(var(--surface-container))] hover:bg-[hsl(var(--surface-container-high))] text-primary font-bold flex items-center justify-center active:scale-95 transition-all border-r border-primary/20"
                      aria-label="কমান"
                      title="১০ টাকা কমান"
                    >
                      <Minus className="h-5 w-5" />
                    </button>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={Number.isFinite(total) ? total : 0}
                      onChange={(e) => {
                        const v = +e.target.value;
                        setTotalOverride(Number.isFinite(v) ? v : 0);
                      }}
                      className="flex-1 min-w-0 text-center bg-transparent text-xl sm:text-2xl font-black text-primary px-2 py-2.5 focus:outline-none tabular-nums"
                      title="সরাসরি লিখে edit করুন"
                    />
                    <button
                      type="button"
                      onClick={() => setTotalOverride(Math.round((total + 10) * 100) / 100)}
                      className="px-3 sm:px-4 bg-[hsl(var(--surface-container))] hover:bg-[hsl(var(--surface-container-high))] text-primary font-bold flex items-center justify-center active:scale-95 transition-all border-l border-primary/20"
                      aria-label="বাড়ান"
                      title="১০ টাকা বাড়ান"
                    >
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>
                  <div className="flex justify-between items-center mt-1.5 text-[10px] text-muted-foreground">
                    <span>{totalOverride !== null ? "✎ custom মোট সেট করা" : "ক্লিক বা +/- চাপুন — custom মোট দিতে পারেন"}</span>
                    <span>−/+ = ৳১০</span>
                  </div>
                </>
              ) : (
                <div className="rounded-xl border-2 border-primary/30 bg-[hsl(var(--surface-container-low))] px-4 py-3 text-center">
                  <div className="text-2xl font-black text-primary tabular-nums">{fmt(total)}</div>
                  <div className="text-[10px] text-muted-foreground mt-1">🔒 মোট পরিমাণ পরিবর্তনের অনুমতি নেই — শুধুমাত্র admin</div>
                </div>
              )}
            </div>
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
            <button onClick={completeSale} disabled={cart.length === 0 || submitting}
              className="w-full h-14 gradient-primary text-primary-foreground rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)] active:scale-95 transition-transform disabled:opacity-50 disabled:cursor-not-allowed">
              <ReceiptIcon className="h-5 w-5" />
              {submitting ? (lang === "bn" ? "প্রক্রিয়াধীন…" : "Processing…") : (editingSaleId ? (lang === "bn" ? "আপডেট সংরক্ষণ" : "Save changes") : t("payNow"))}
            </button>
          </div>
        </div>
      </section>

      <Dialog open={showReceipt} onOpenChange={setShowReceipt}>
        <DialogContent className="max-w-md bg-[hsl(var(--surface-container-lowest))] max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("receipt")} — Thermal 80mm</DialogTitle></DialogHeader>
          {lastSale && (
            <ThermalReceipt
              ref={receiptRef}
              shop={{
                name: currentShop?.name ?? t("appName"),
                address: currentShop?.address,
                phone: currentShop?.phone,
                logo_url: currentShop?.logo_url,
              }}
              invoiceNo={lastSale.invoice_no}
              createdAt={lastSale.created_at}
              customer={lastSale.customer ? { name: lastSale.customer.name, phone: lastSale.customer.phone } : null}
              items={lastSale.items.map((i: CartItem) => ({
                name: i.product.name,
                qty: i.qty,
                unit_price: i.product.price,
                subtotal: i.product.price * i.qty,
              }))}
              subtotal={Number(lastSale.subtotal)}
              discount={Number(lastSale.discount)}
              total={Number(lastSale.total)}
              paid={Number(lastSale.paid)}
              due={Number(lastSale.due)}
              paymentType={lastSale.payment_type}
              paymentMethod={lastSale.payment_method ?? undefined}
              emi={lastSale.emi_amount ? { count: lastSale.tenure_months, amount: Number(lastSale.emi_amount), firstDue: lastSale.first_due } : null}
              fmt={fmt}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReceipt(false)}>{t("cancel")}</Button>
            <Button onClick={() => lastSale && printSaleUnified({ saleId: lastSale.id, shop: { name: currentShop?.name, address: currentShop?.address, phone: currentShop?.phone, logo_url: currentShop?.logo_url }, fmt, lang })} className="gradient-primary"><Printer className="h-4 w-4 mr-1" />{t("printReceipt")}</Button>
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
