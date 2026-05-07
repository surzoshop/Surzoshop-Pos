import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { ImageUpload } from "@/components/ImageUpload";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, ShoppingBag, Calendar, FileText, Receipt, Search, Eye, Wallet, ArrowLeft, Building2, Package, DollarSign, StickyNote, Printer, Save, ImagePlus, CheckCircle2, X } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton, StatusPill } from "@/components/PageHeader";

export default function Purchases() {
  const { t, fmt, lang } = useT();
  const { user, role } = useAuth();
  const { currentShop } = useShop();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [purchases, setPurchases] = useState<any[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [viewBill, setViewBill] = useState<any>(null);
  const [payOpen, setPayOpen] = useState(false);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payAmt, setPayAmt] = useState(0);
  const [supplierFocus, setSupplierFocus] = useState(false);
  const [productFocusIdx, setProductFocusIdx] = useState<number | null>(null);

  // form state
  const [supplierId, setSupplierId] = useState("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [billDate, setBillDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<any[]>([
    { product_id: "", product_name: "", search: "", brand: "", category_id: "", qty: 1, unit: "pcs", unit_cost: 0, sell_price: 0, subtotal: 0, image_url: "" },
  ]);
  const [discount, setDiscount] = useState(0);
  const [delivery, setDelivery] = useState(0);
  const [paid, setPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("cash");

  const load = async () => {
    const [p, s, pr, c] = await Promise.all([
      supabase.from("purchases").select("*, suppliers(name)").order("created_at", { ascending: false }).limit(200),
      supabase.from("suppliers").select("id,name,phone").order("name"),
      supabase.from("products").select("id,name,cost,price,unit,barcode,sku,image_url,category_id").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    setPurchases(p.data ?? []); setSuppliers(s.data ?? []); setProducts(pr.data ?? []); setCategories(c.data ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase
      .channel("purchases-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "purchases" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_items" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "purchase_payments" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const subtotal = items.reduce((a, b) => a + (Number(b.subtotal) || 0), 0);
  const total = Math.max(subtotal - discount + delivery, 0);
  const due = Math.max(total - paid, 0);
  const fullyPaid = total > 0 && due === 0;

  const supplierMatches = useMemo(() =>
    !supplierSearch ? suppliers
      : suppliers.filter(s => s.name.toLowerCase().includes(supplierSearch.toLowerCase()) || s.phone?.includes(supplierSearch)),
    [supplierSearch, suppliers]);

  const updateItem = (idx: number, patch: any) => {
    setItems(items.map((it, i) => {
      if (i !== idx) return it;
      const next = { ...it, ...patch };
      next.subtotal = (Number(next.qty) || 0) * (Number(next.unit_cost) || 0);
      return next;
    }));
  };
  const addItemRow = () => setItems([...items, { product_id: "", product_name: "", search: "", brand: "", category_id: "", qty: 1, unit: "pcs", unit_cost: 0, sell_price: 0, subtotal: 0, image_url: "" }]);
  const removeItemRow = (idx: number) => setItems(items.length === 1 ? items : items.filter((_, i) => i !== idx));

  const pickProduct = (idx: number, p: any) => updateItem(idx, {
    product_id: p.id, product_name: p.name, search: p.name,
    unit_cost: Number(p.cost), sell_price: Number(p.price),
    unit: p.unit ?? "pcs", category_id: p.category_id ?? "",
    image_url: p.image_url ?? "",
  });

  const resetForm = () => {
    setItems([{ product_id: "", product_name: "", search: "", brand: "", category_id: "", qty: 1, unit: "pcs", unit_cost: 0, sell_price: 0, subtotal: 0, image_url: "" }]);
    setPaid(0); setDiscount(0); setDelivery(0); setSupplierId(""); setSupplierSearch(""); setNotes("");
    setEditingId(null);
  };

  const openEdit = async (p: any) => {
    const { data: its } = await supabase.from("purchase_items").select("*").eq("purchase_id", p.id);
    setEditingId(p.id);
    setSupplierId(p.supplier_id ?? "");
    setSupplierSearch(p.suppliers?.name ?? "");
    setBillDate((p.created_at ?? new Date().toISOString()).slice(0, 10));
    setNotes(p.notes ?? "");
    setDiscount(Number(p.discount) || 0);
    setDelivery(0);
    setPaid(Number(p.paid) || 0);
    setItems((its ?? []).map((it: any) => {
      const prod = products.find(pp => pp.id === it.product_id);
      return {
        product_id: it.product_id, product_name: it.product_name, search: it.product_name,
        brand: "", category_id: prod?.category_id ?? "", qty: it.qty, unit: prod?.unit ?? "pcs",
        unit_cost: Number(it.unit_cost), sell_price: prod?.price ?? 0,
        subtotal: Number(it.subtotal), image_url: prod?.image_url ?? "",
      };
    }));
    setOpen(true);
  };

  const validItems = () => items.filter(i => (i.product_id || (i.search && i.search.trim())) && i.qty > 0);

  const save = async (alsoPrint = false) => {
    const rowsToSave = validItems();
    if (rowsToSave.length === 0) return toast({ title: "কমপক্ষে একটি পণ্য নির্বাচন বা লিখুন", variant: "destructive" });

    // Step 1: Create new products on the fly (so POS / Products list automatically gets them)
    const prepared: any[] = [];
    for (const it of rowsToSave) {
      let pid = it.product_id;
      let pname = it.product_name || it.search;
      if (!pid) {
        const { data: created, error: pe } = await supabase.from("products").insert({
          name: pname.trim(),
          cost: Number(it.unit_cost) || 0,
          price: Number(it.sell_price) || Number(it.unit_cost) || 0,
          unit: it.unit ?? "pcs",
          category_id: it.category_id || null,
          image_url: it.image_url || null,
          stock: 0, // trigger will increment
          shop_id: currentShop?.id ?? null,
        }).select().single();
        if (pe) return toast({ title: "নতুন পণ্য তৈরিতে সমস্যা: " + pe.message, variant: "destructive" });
        pid = created.id;
      } else if (it.image_url) {
        // Update existing product image / cost when changed
        await supabase.from("products").update({
          image_url: it.image_url || null,
          cost: Number(it.unit_cost) || 0,
          ...(it.sell_price ? { price: Number(it.sell_price) } : {}),
        }).eq("id", pid);
      }
      prepared.push({ ...it, product_id: pid, product_name: pname });
    }

    // Step 2: Create or update purchase
    let purchaseRow: any;
    if (editingId) {
      const { data, error } = await supabase.from("purchases").update({
        supplier_id: supplierId || null, subtotal, discount, total, paid, due,
        notes: notes || null,
      }).eq("id", editingId).select().single();
      if (error) return toast({ title: error.message, variant: "destructive" });
      purchaseRow = data;
      // Remove old items (trigger only adds on insert; for simplicity we delete + re-insert)
      await supabase.from("purchase_items").delete().eq("purchase_id", editingId);
    } else {
      const { data, error } = await supabase.from("purchases").insert({
        supplier_id: supplierId || null, subtotal, discount, total, paid, due,
        notes: notes || null, created_by: user!.id, shop_id: currentShop?.id ?? null,
      }).select().single();
      if (error) return toast({ title: error.message, variant: "destructive" });
      purchaseRow = data;
    }

    // Step 3: Insert items (DB trigger auto-increments product stock)
    const rows = prepared.map(i => ({
      product_id: i.product_id, product_name: i.product_name, qty: i.qty,
      unit_cost: i.unit_cost, subtotal: i.subtotal,
      purchase_id: purchaseRow.id, shop_id: currentShop?.id ?? null,
    }));
    const { error: e2 } = await supabase.from("purchase_items").insert(rows);
    if (e2) return toast({ title: e2.message, variant: "destructive" });

    // Step 4: Cash book entry for paid amount (so it shows up in Ledger) — only on new
    if (!editingId && paid > 0) {
      await supabase.from("cash_book").insert({
        entry_type: "out",
        amount: paid,
        category: "ক্রয়",
        payment_method: paymentMethod,
        party_name: suppliers.find(s => s.id === supplierId)?.name ?? null,
        reference_no: purchaseRow.bill_no,
        notes: `ক্রয় বিল ${purchaseRow.bill_no}`,
        created_by: user!.id,
        shop_id: currentShop?.id ?? null,
      });
    }

    toast({ title: editingId ? "ক্রয় আপডেট হয়েছে ✓" : "ক্রয় সংরক্ষিত ✓ স্টক ও পণ্য তালিকা আপডেট হয়েছে" });
    if (alsoPrint) {
      const supName = suppliers.find(s => s.id === supplierId)?.name ?? "—";
      printA4Invoice({
        billNo: purchaseRow.bill_no, billDate, supplierName: supName,
        shop: currentShop, items: prepared, subtotal, discount, delivery, total, paid, due,
        paymentMethod, notes,
      });
    }
    setOpen(false); resetForm(); load();
  };

  const printExisting = async (p: any) => {
    const { data: its } = await supabase.from("purchase_items").select("*").eq("purchase_id", p.id);
    printA4Invoice({
      billNo: p.bill_no,
      billDate: (p.created_at ?? "").slice(0, 10),
      supplierName: p.suppliers?.name ?? "—",
      shop: currentShop,
      items: (its ?? []).map((it: any) => ({ product_name: it.product_name, qty: it.qty, unit: "", unit_cost: Number(it.unit_cost), subtotal: Number(it.subtotal) })),
      subtotal: Number(p.subtotal), discount: Number(p.discount), delivery: 0,
      total: Number(p.total), paid: Number(p.paid), due: Number(p.due),
      paymentMethod: "—", notes: p.notes ?? "",
    });
  };

  const printA4Invoice = (p: any) => {
    const itemsCount = p.items.length;
    const itemTotal = p.items.reduce((a: number, it: any) => a + Number(it.subtotal), 0);
    const grand = Number(p.total);
    const paidAmt = Number(p.paid);
    const dueAmt = Number(p.due);
    const disc = Number(p.discount) || 0;
    const deliv = Number(p.delivery) || 0;
    const subAfterDisc = itemTotal - disc;

    const rows = p.items.map((it: any, i: number) => `
      <tr style="background:${i % 2 ? "#f7f7fb" : "#ffffff"}">
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f5">${it.product_name}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f5">৳${fmt(Number(it.unit_cost)).replace("৳","")}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f5">${it.qty} ${it.unit ?? ""}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f5">0%</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eef0f5">৳${fmt(Number(it.subtotal)).replace("৳","")}</td>
      </tr>`).join("");

    const numToWords = (n: number) => {
      // simple english words for the amount-in-words section
      const a = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
      const b = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
      const inWords = (num: number): string => {
        if (num < 20) return a[num];
        if (num < 100) return b[Math.floor(num/10)] + (num%10 ? ' ' + a[num%10] : '');
        if (num < 1000) return a[Math.floor(num/100)] + ' Hundred' + (num%100 ? ' ' + inWords(num%100) : '');
        if (num < 100000) return inWords(Math.floor(num/1000)) + ' Thousand' + (num%1000 ? ' ' + inWords(num%1000) : '');
        if (num < 10000000) return inWords(Math.floor(num/100000)) + ' Lakh' + (num%100000 ? ' ' + inWords(num%100000) : '');
        return inWords(Math.floor(num/10000000)) + ' Crore' + (num%10000000 ? ' ' + inWords(num%10000000) : '');
      };
      const r = Math.round(n);
      return (inWords(r) || 'Zero') + ' Taka Only';
    };

    const logoUrl = p.shop?.logo_url || "/brand-logo.png";
    const qrData = encodeURIComponent(`Invoice:${p.billNo}|Total:${grand}|Shop:${p.shop?.name ?? ""}|Date:${p.billDate}`);
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${qrData}`;
    const timeStr = new Date().toLocaleTimeString("en-GB", { hour12: false }).slice(0,5);
    const status = dueAmt === 0 ? "PAID" : dueAmt === grand ? "UNPAID" : "PARTIAL";
    const orderStatus = "COMPLETED";

    const w = window.open("", "_blank", "width=950,height=750");
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${p.billNo}</title>
      <style>
        @page{size:A4;margin:10mm}
        @media print{body{margin:0}}
        *{box-sizing:border-box;font-family:'Segoe UI',Tahoma,Arial,sans-serif}
        body{margin:0;color:#1f2937;font-size:12px;background:#fff}
        .wrap{max-width:780px;margin:0 auto;padding:6px}
        .head{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}
        .logo-box{width:96px;height:96px;border-radius:10px;overflow:hidden;flex-shrink:0;display:flex;align-items:center;justify-content:center;background:#fff;border:1px solid #eef0f5}
        .logo-box img{max-width:100%;max-height:100%;object-fit:contain}
        .shop-name{font-size:26px;font-weight:800;color:#5b5fc7;margin:0 0 4px;line-height:1.1}
        .shop-info{font-size:11.5px;line-height:1.55;color:#1f2937}
        .shop-info b{color:#0f172a}
        .banner{background:#7c83ff;color:#fff;text-align:center;padding:8px;font-weight:700;letter-spacing:.5px;border-radius:4px;margin:10px 0}
        .meta{display:grid;grid-template-columns:repeat(4,1fr);gap:10px 16px;padding:10px 4px;border-bottom:1px solid #eef0f5;margin-bottom:8px}
        .meta .lbl{font-weight:700;font-size:11px;color:#0f172a}
        .meta .val{font-size:12px;color:#1f2937;margin-top:2px}
        h3.sec{color:#5b5fc7;font-size:13px;margin:12px 0 6px;font-weight:700}
        .billto{font-size:12px;line-height:1.7}
        .billto b{color:#0f172a}
        table.items{width:100%;border-collapse:collapse;margin-top:6px;border-radius:4px;overflow:hidden}
        table.items thead th{background:#7c83ff;color:#fff;text-align:left;padding:9px 10px;font-weight:600;font-size:12px}
        .items-banner{background:#7c83ff;color:#fff;display:flex;justify-content:space-between;padding:7px 12px;font-weight:700;font-size:12px;border-radius:4px;margin-top:6px}
        .twocol{display:grid;grid-template-columns:1.2fr 1fr;gap:18px;margin-top:14px}
        .terms b,.payopt b,.bank b{color:#5b5fc7;display:block;margin-bottom:4px;font-size:12.5px}
        .terms ol{margin:0;padding-left:18px;font-size:11.5px;line-height:1.6}
        .totals{font-size:12px}
        .totals .row{display:flex;justify-content:space-between;padding:3px 0}
        .totals .row.b{font-weight:700;color:#0f172a}
        .totals .grand{border-top:1px dashed #94a3b8;border-bottom:1px dashed #94a3b8;padding:5px 0;margin:4px 0;font-weight:800;color:#0f172a}
        .qr{display:flex;flex-direction:column;align-items:center;gap:4px;margin-top:6px}
        .qr img{border:1px solid #eef0f5;border-radius:6px}
        .qr .scan{background:#7c83ff;color:#fff;padding:4px 16px;border-radius:4px;font-size:11px;font-weight:700;margin-top:2px}
        .words{margin-top:10px}
        .words b{color:#5b5fc7;display:block;margin-bottom:3px}
        .powered{text-align:right;font-size:11px;margin-top:14px;color:#0f172a}
        .powered .grow{display:block;font-weight:700;margin-top:3px}
        .footer{background:#7c83ff;color:#fff;text-align:center;padding:10px;margin-top:16px;border-radius:4px;font-weight:700;line-height:1.5}
        .remark{font-size:11px;color:#5b5fc7;margin-top:14px;font-weight:700}
      </style></head><body>
      <div class="wrap">
        <div class="head">
          <div class="logo-box"><img src="${logoUrl}" onerror="this.style.display='none'"/></div>
          <div style="flex:1">
            <h1 class="shop-name">${p.shop?.name ?? "Shop"}</h1>
            <div class="shop-info">
              ${p.shop?.address ? `<div><b>Address:</b> ${p.shop.address}</div>` : ""}
              ${p.shop?.phone ? `<div><b>Phone No.:</b> ${p.shop.phone}</div>` : ""}
              ${p.shop?.email ? `<div><b>Email:</b> ${p.shop.email}</div>` : ""}
              <div><b>Best From Best</b></div>
            </div>
          </div>
        </div>

        <div class="banner">Purchase Invoice / ক্রয় চালান</div>

        <div class="meta">
          <div><div class="lbl">Bill No #:</div><div class="val">${p.billNo}</div></div>
          <div><div class="lbl">ITEM:</div><div class="val">${itemsCount} ITEM${itemsCount>1?'S':''}</div></div>
          <div><div class="lbl">Date:</div><div class="val">${p.billDate}</div></div>
          <div><div class="lbl">Time:</div><div class="val">${timeStr}</div></div>
          <div><div class="lbl">Order Status:</div><div class="val">${orderStatus}</div></div>
          <div><div class="lbl">Payment Method:</div><div class="val">${(p.paymentMethod||'CASH').toUpperCase()}</div></div>
          <div><div class="lbl">Payment Status:</div><div class="val">${status}</div></div>
          <div><div class="lbl">Created By:</div><div class="val">OWNER</div></div>
        </div>

        <h3 class="sec">Billing To / সরবরাহকারী</h3>
        <div class="billto">
          <div><b>Name:</b> ${p.supplierName}</div>
        </div>

        <table class="items">
          <thead><tr>
            <th>Name</th><th>Price/Unit</th><th>Quantity</th><th>GST</th><th>Amount</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>

        <div class="items-banner">
          <span>Total Items: ${itemsCount}</span>
          <span>Item Total : ৳${fmt(itemTotal).replace("৳","")}</span>
        </div>

        <div class="twocol">
          <div>
            <div class="terms">
              <b>Terms &amp; Conditions</b>
              <ol>
                <li>Goods once sold will not be taken back or exchanged.</li>
                <li>All disputes are subject to jurisdiction only.</li>
              </ol>
            </div>
            <div class="payopt" style="margin-top:12px">
              <b>Payment Option</b>
            </div>
            <div class="bank" style="margin-top:6px;font-size:11.5px;line-height:1.6">
              <b>Bank Details</b>
              <div>Shop : ${p.shop?.name ?? ""}</div>
              ${p.shop?.phone ? `<div>Contact : ${p.shop.phone}</div>` : ""}
            </div>
            <div class="qr" style="align-items:flex-start;margin-top:10px">
              <img src="${qrUrl}" alt="QR" width="130" height="130"/>
              <div class="scan">SCAN TO PAY</div>
            </div>
          </div>
          <div>
            <div class="totals">
              <div class="row"><span>Item Total:</span><b>৳${fmt(itemTotal).replace("৳","")}</b></div>
              ${disc>0 ? `<div class="row"><span>Bill Discount:</span><b>- ৳${fmt(disc).replace("৳","")}</b></div>` : ""}
              <div class="row b"><span>Subtotal:</span><b>৳${fmt(subAfterDisc).replace("৳","")}</b></div>
              ${deliv>0 ? `<div class="row"><span>Delivery:</span><b>৳${fmt(deliv).replace("৳","")}</b></div>` : ""}
              <div class="row grand"><span>Grand Total:</span><span>৳${fmt(grand).replace("৳","")}</span></div>
              <div class="row"><span>Paid Amount:</span><b>৳${fmt(paidAmt).replace("৳","")}</b></div>
              ${dueAmt>0 ? `<div class="row" style="color:#b91c1c"><span>Due:</span><b>৳${fmt(dueAmt).replace("৳","")}</b></div>` : ""}
            </div>
            <div class="words">
              <b>Amount in Words</b>
              <div style="font-size:11.5px">${numToWords(grand)}</div>
            </div>
            <div class="powered">
              Powered by <b style="color:#5b5fc7">${p.shop?.name ?? "সূর্য শপ"}</b>
              <span class="grow">Grow with us!</span>
            </div>
          </div>
        </div>

        ${p.notes ? `<div class="remark">Remark: <span style="color:#1f2937;font-weight:400">${p.notes}</span></div>` : `<div class="remark">Remark</div>`}

        <div class="footer">Thank You, Visit Again.<br/>Feels Best</div>
      </div>
      <script>window.onload=()=>{setTimeout(()=>{try{window.focus();window.print();}catch(e){}}, 350)}</script>
      </body></html>`;

    if (w && !w.closed) {
      w.document.open(); w.document.write(html); w.document.close(); w.focus(); return;
    }
    // mobile / popup-blocked fallback: hidden iframe
    const old = document.getElementById("__purchase_print_iframe");
    if (old) old.remove();
    const iframe = document.createElement("iframe");
    iframe.id = "__purchase_print_iframe";
    iframe.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(iframe);
    const idoc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!idoc) { toast({ title: "প্রিন্ট করা যায়নি — পপআপ অনুমতি দিন", variant: "destructive" }); return; }
    idoc.open(); idoc.write(html); idoc.close();
    setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {} }, 800);
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    await supabase.from("purchases").delete().eq("id", id);
    load();
  };

  const viewItems = async (p: any) => {
    const { data } = await supabase.from("purchase_items").select("*").eq("purchase_id", p.id);
    setViewBill({ ...p, items: data ?? [] });
  };

  const submitPayment = async () => {
    if (!payTarget || payAmt <= 0) return;
    const { error } = await supabase.from("purchase_payments").insert({
      purchase_id: payTarget.id, amount: payAmt, payment_method: paymentMethod,
      created_by: user!.id, shop_id: currentShop?.id ?? null,
    });
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "পরিশোধ সংরক্ষিত ✓" });
    setPayOpen(false); setPayTarget(null); setPayAmt(0); load();
  };

  const filtered = purchases.filter(p =>
    !search || p.bill_no?.toLowerCase().includes(search.toLowerCase()) ||
    p.suppliers?.name?.toLowerCase().includes(search.toLowerCase())
  );
  const totalPurchase = filtered.reduce((a, p) => a + Number(p.total), 0);
  const totalDueAll = filtered.reduce((a, p) => a + Number(p.due), 0);

  return (
    <div>
      <PageHeader
        title="ক্রয় / স্টক এন্ট্রি" subtitle="পণ্য ক্রয় বিল ও স্টক ইন রেকর্ড।"
        actions={<PrimaryButton onClick={() => setOpen(true)}><Plus className="h-5 w-5" />নতুন ক্রয়</PrimaryButton>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Stat icon={<ShoppingBag className="h-6 w-6 text-info" />} bg="bg-info/10" label="মোট বিল" value={filtered.length.toString()} />
        <Stat icon={<Receipt className="h-6 w-6 text-primary" />} bg="bg-primary/10" label="মোট ক্রয়" value={fmt(totalPurchase)} />
        <Stat icon={<Wallet className="h-6 w-6 text-destructive" />} bg="bg-destructive/10" label="মোট বকেয়া" value={fmt(totalDueAll)} />
      </div>

      <SurfaceCard className="p-6">
        <div className="relative mb-6">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="বিল নং বা সরবরাহকারী খুঁজুন..."
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">Bill #</th>
                <th className="pb-6 font-bold">{t("date")}</th>
                <th className="pb-6 font-bold">{t("suppliers")}</th>
                <th className="pb-6 font-bold">{t("total")}</th>
                <th className="pb-6 font-bold">{t("paid")}</th>
                <th className="pb-6 font-bold">{t("due")}</th>
                <th className="pb-6 font-bold text-right">{t("actions")}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {filtered.length === 0 && <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4 font-bold">{p.bill_no}</td>
                  <td className="py-4">{new Date(p.created_at).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US")}</td>
                  <td className="py-4">{p.suppliers?.name ?? "—"}</td>
                  <td className="py-4 font-bold text-primary">{fmt(Number(p.total))}</td>
                  <td className="py-4">{fmt(Number(p.paid))}</td>
                  <td className="py-4"><StatusPill tone={Number(p.due) > 0 ? "warning" : "success"}>{fmt(Number(p.due))}</StatusPill></td>
                  <td className="py-4 text-right">
                    <div className="inline-flex gap-1 items-center">
                      <button onClick={() => viewItems(p)} title="দেখুন" className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><Eye className="h-4 w-4" /></button>
                      <button onClick={() => printExisting(p)} title="প্রিন্ট" className="p-1.5 rounded-md hover:bg-info/10 text-info"><Printer className="h-4 w-4" /></button>
                      {isAdmin && <button onClick={() => openEdit(p)} title="এডিট" className="p-1.5 rounded-md hover:bg-primary/10 text-primary"><FileText className="h-4 w-4" /></button>}
                      {Number(p.due) > 0 && (
                        <button onClick={() => { setPayTarget(p); setPayAmt(Number(p.due)); setPayOpen(true); }}
                          className="px-2 py-1 rounded-md text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20">পরিশোধ</button>
                      )}
                      {isAdmin && <button onClick={() => del(p.id)} title="ডিলিট" className="p-1.5 rounded-md hover:bg-destructive/10 text-destructive"><Trash2 className="h-4 w-4" /></button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* === New Purchase — Slide-in side sheet === */}
      <Sheet open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
        <SheetContent
          side="right"
          className="p-0 w-full sm:max-w-2xl md:max-w-3xl lg:max-w-4xl sm:w-[92vw] bg-[hsl(var(--surface-container-lowest))] flex flex-col gap-0 [&>button]:hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 sm:py-3 border-b border-[hsl(var(--surface-container-high))]/60 bg-[hsl(var(--surface-container-lowest))] shrink-0">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <button onClick={() => { setOpen(false); resetForm(); }} className="h-9 w-9 grid place-items-center rounded-full hover:bg-muted shrink-0">
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-xl bg-primary/10 grid place-items-center shrink-0">
                <Receipt className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-bold">{editingId ? "ক্রয় এডিট" : "নতুন ক্রয়"}</h2>
                <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">{editingId ? "বিদ্যমান পারচেজ আপডেট করুন" : "নতুন পারচেজ এন্ট্রি তৈরি করুন"}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <input type="date" value={billDate} onChange={e => setBillDate(e.target.value)}
                className="h-8 px-2 rounded-md bg-[hsl(var(--surface-container-low))] text-[11px] sm:text-xs border-none focus:outline-none focus:ring-2 focus:ring-primary/30 w-[120px] sm:w-auto" />
              <span className="px-2 sm:px-3 py-1 rounded-full bg-primary/10 text-primary text-[10px] sm:text-xs font-bold whitespace-nowrap">আইটেম: {validItems().length}</span>
            </div>
          </div>

          {/* Scroll body */}
          <div className="flex-1 overflow-y-auto overflow-x-visible px-3 sm:px-5 py-3 sm:py-5 space-y-4 sm:space-y-5">
            {/* Supplier card — overflow-visible so dropdown is not clipped */}
            <section className="rounded-2xl bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))]/50 relative">
              <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/30 rounded-t-2xl" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-bold">সরবরাহকারী তথ্য</h3>
                    <p className="text-xs text-muted-foreground">সাপ্লায়ার সিলেক্ট করুন অথবা নতুন যোগ করুন</p>
                  </div>
                </div>
                <div className="relative">
                  <Input
                    placeholder="সাপ্লায়ারের নাম লিখুন বা ক্লিক করে তালিকা থেকে বাছুন"
                    value={supplierSearch}
                    onFocus={() => setSupplierFocus(true)}
                    onBlur={() => setTimeout(() => setSupplierFocus(false), 200)}
                    onChange={e => { setSupplierSearch(e.target.value); setSupplierId(""); setSupplierFocus(true); }}
                    className="h-11 bg-[hsl(var(--surface-container-low))] border-none pr-28"
                  />
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-1 rounded-md bg-primary/10 text-primary text-xs font-bold pointer-events-none">তালিকা ▾</span>
                  {supplierFocus && (
                    <div className="absolute z-[60] left-0 right-0 top-full mt-1 bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))] rounded-xl max-h-60 overflow-y-auto shadow-2xl">
                      {supplierMatches.length === 0 && <div className="px-4 py-4 text-sm text-muted-foreground text-center">কোন সরবরাহকারী পাওয়া যায়নি — সরবরাহকারী পেইজ থেকে যোগ করুন</div>}
                      {supplierMatches.map(s => (
                        <button key={s.id} type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => { setSupplierId(s.id); setSupplierSearch(s.name); setSupplierFocus(false); }}
                          className={`w-full text-left px-4 py-2.5 text-sm hover:bg-primary/10 flex justify-between items-center ${supplierId===s.id ? "bg-primary/10" : ""}`}>
                          <span className="font-medium">{s.name}</span>
                          <span className="text-xs text-muted-foreground">{s.phone ?? ""}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Product list card */}
            <section className="rounded-2xl bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))]/50 relative">
              <div className="h-1 bg-gradient-to-r from-info via-primary to-primary/40 rounded-t-2xl" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-info/10 grid place-items-center">
                    <Package className="h-5 w-5 text-info" />
                  </div>
                  <div>
                    <h3 className="font-bold">পণ্য তালিকা</h3>
                    <p className="text-xs text-muted-foreground">ক্রয়কৃত পণ্য যোগ করুন — নতুন পণ্য সেভ হলে সয়ংক্রিয়ভাবে POS-এ যুক্ত হবে</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {items.map((it, idx) => (
                    <div key={idx} className="rounded-xl border border-[hsl(var(--surface-container-high))]/60 bg-[hsl(var(--surface-container-low))]/40 p-4 relative">
                      <div className="flex items-center justify-between mb-3">
                        <span className="inline-flex items-center gap-2 text-sm font-semibold">
                          <span className="h-6 w-6 grid place-items-center rounded-full bg-primary text-primary-foreground text-[11px] font-bold">{idx + 1}</span>
                          পণ্য #{idx + 1}
                        </span>
                        {items.length > 1 && (
                          <button onClick={() => removeItemRow(idx)} className="h-7 w-7 grid place-items-center rounded-md text-destructive hover:bg-destructive/10">
                            <X className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-[120px_1fr] gap-4">
                        {/* Product image upload */}
                        <div>
                          <Label className="text-xs mb-1 block md:hidden">পণ্যের ছবি</Label>
                          <ImageUpload
                            value={it.image_url || null}
                            onChange={(url) => updateItem(idx, { image_url: url ?? "" })}
                          />
                        </div>
                        <div className="space-y-3">
                          <div>
                            <Label className="text-xs flex items-center gap-1 mb-1"><Package className="h-3 w-3" />পণ্য</Label>
                            <div className="relative">
                              <Input placeholder="পণ্যের নাম লিখুন (নতুন হলে অটো যুক্ত হবে) বা ক্লিক করে বাছুন"
                                value={it.search}
                                onFocus={() => setProductFocusIdx(idx)}
                                onBlur={() => setTimeout(() => setProductFocusIdx(p => p === idx ? null : p), 200)}
                                onChange={e => { updateItem(idx, { search: e.target.value, product_name: e.target.value, product_id: "" }); setProductFocusIdx(idx); }}
                                className="h-10 bg-background pr-28" />
                              <span className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-md bg-primary/10 text-primary text-[11px] font-bold pointer-events-none">পণ্য ▾</span>
                              {productFocusIdx === idx && (
                                <div className="absolute z-[60] left-0 right-0 top-full mt-1 bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))] rounded-xl max-h-60 overflow-y-auto shadow-2xl">
                                  {(() => {
                                    const list = products.filter(p =>
                                      !it.search ||
                                      p.name.toLowerCase().includes(it.search.toLowerCase()) ||
                                      p.barcode?.toLowerCase().includes(it.search.toLowerCase()) ||
                                      p.sku?.toLowerCase().includes(it.search.toLowerCase())
                                    );
                                    if (list.length === 0) return <div className="px-4 py-4 text-sm text-muted-foreground text-center">এই নামে কোন পণ্য নেই — সেভ করলে নতুন হিসেবে যুক্ত হবে</div>;
                                    return list.slice(0, 12).map(p => (
                                      <button key={p.id} type="button"
                                        onMouseDown={(e) => e.preventDefault()}
                                        onClick={() => { pickProduct(idx, p); setProductFocusIdx(null); }}
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-primary/10 flex justify-between items-center gap-2">
                                        <span className="flex items-center gap-2 min-w-0">
                                          {p.image_url && <img src={p.image_url} alt="" className="h-7 w-7 rounded object-cover" />}
                                          <span className="font-medium truncate">{p.name}</span>
                                        </span>
                                        <span className="text-xs text-muted-foreground shrink-0">স্টক: {p.stock ?? "—"} · ৳{fmt(Number(p.cost))}</span>
                                      </button>
                                    ));
                                  })()}
                                </div>
                              )}
                            </div>
                            <p className="text-[10px] text-muted-foreground mt-1">তালিকায় না থাকলে নতুন পণ্যের নাম লিখুন — সেভ করলে অটোমেটিক পণ্য তালিকা ও POS-এ যুক্ত হবে।</p>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs mb-1 block">ব্র্যান্ড</Label>
                              <Input value={it.brand || ""} onChange={e => updateItem(idx, { brand: e.target.value })} placeholder="ব্র্যান্ড নাম" className="h-10 bg-background" />
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">ক্যাটাগরি</Label>
                              <select value={it.category_id ?? ""}
                                onChange={e => updateItem(idx, { category_id: e.target.value })}
                                className="w-full h-10 rounded-md bg-background px-3 text-sm border border-input">
                                <option value="">ক্যাটাগরি নাম</option>
                                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <Label className="text-xs mb-1 block">পরিমাণ</Label>
                              <Input type="number" value={it.qty} onChange={e => updateItem(idx, { qty: +e.target.value })} className="h-10 bg-background" />
                              <p className="text-[10px] text-muted-foreground mt-1">যত পিস ক্রয় করেছেন — স্টকে যুক্ত হবে।</p>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">ইউনিট</Label>
                              <select value={it.unit} onChange={e => updateItem(idx, { unit: e.target.value })}
                                className="w-full h-10 rounded-md bg-background px-3 text-sm border border-input">
                                <option value="pcs">পিস</option>
                                <option value="kg">কেজি</option>
                                <option value="ltr">লিটার</option>
                                <option value="box">বক্স</option>
                                <option value="dz">ডজন</option>
                              </select>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-xl bg-background/50 p-3">
                            <div>
                              <Label className="text-xs mb-1 block">ক্রয়মূল্য (৳)</Label>
                              <Input type="number" value={it.unit_cost} onChange={e => updateItem(idx, { unit_cost: +e.target.value })} className="h-10 bg-background" />
                              <p className="text-[10px] text-muted-foreground mt-1">প্রতি পিসের কেনা দাম।</p>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">বিক্রয়মূল্য (৳)</Label>
                              <Input type="number" placeholder="ঐচ্ছিক" value={it.sell_price || ""} onChange={e => updateItem(idx, { sell_price: +e.target.value })} className="h-10 bg-background" />
                              <p className="text-[10px] text-muted-foreground mt-1">POS-এ কত টাকায় বিক্রি হবে।</p>
                            </div>
                            <div>
                              <Label className="text-xs mb-1 block">মোট (৳)</Label>
                              <div className="h-10 rounded-md bg-primary/10 grid place-items-center text-primary font-bold">৳{fmt(it.subtotal)}</div>
                              <p className="text-[10px] text-muted-foreground mt-1">পরিমাণ × ক্রয়মূল্য।</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  <button onClick={addItemRow}
                    className="w-full h-12 rounded-xl border-2 border-dashed border-[hsl(var(--surface-container-high))] text-muted-foreground hover:border-primary hover:text-primary hover:bg-primary/5 transition flex items-center justify-center gap-2 text-sm font-semibold">
                    <Plus className="h-4 w-4" /> আরও পণ্য যোগ করুন
                  </button>
                </div>
              </div>
            </section>

            {/* Bill summary card */}
            <section className="rounded-2xl bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))]/50 relative">
              <div className="h-1 bg-gradient-to-r from-success via-primary to-info rounded-t-2xl" />
              <div className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-success/10 grid place-items-center">
                    <DollarSign className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <h3 className="font-bold">বিল সামারি ও পেমেন্ট</h3>
                    <p className="text-xs text-muted-foreground">ডিসকাউন্ট, শিপিং ও পেমেন্ট তথ্য</p>
                  </div>
                </div>

                <div className="rounded-xl bg-[hsl(var(--surface-container-low))] p-4 space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">সাবটোটাল</span>
                    <span className="font-bold">৳{fmt(subtotal)}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground -mt-2">সব পণ্যের মোট ক্রয়মূল্যের যোগফল।</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs mb-1 block">ডিসকাউন্ট (৳)</Label>
                      <Input type="number" value={discount} onChange={e => setDiscount(+e.target.value)} className="h-10 bg-background" />
                      <p className="text-[10px] text-muted-foreground mt-1">সরবরাহকারী যত টাকা ছাড় দিয়েছেন — মোট থেকে বিয়োগ হবে।</p>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">ডেলিভারি চার্জ (৳)</Label>
                      <Input type="number" value={delivery} onChange={e => setDelivery(+e.target.value)} className="h-10 bg-background" />
                      <p className="text-[10px] text-muted-foreground mt-1">পণ্য আনার পরিবহন খরচ — মোটে যোগ হবে।</p>
                    </div>
                  </div>
                  <div className="border-t border-[hsl(var(--surface-container-high))]/60 pt-3 flex justify-between items-center">
                    <span className="font-bold">সর্বমোট</span>
                    <span className="text-2xl font-black text-primary">৳{fmt(total)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <Label className="text-xs mb-1 block">পেমেন্ট পদ্ধতি</Label>
                      <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}
                        className="w-full h-10 rounded-md bg-background px-3 text-sm border border-input">
                        <option value="cash">নগদ</option>
                        <option value="bkash">বিকাশ</option>
                        <option value="nagad">নগদ (Mobile)</option>
                        <option value="bank">ব্যাংক</option>
                      </select>
                      <p className="text-[10px] text-muted-foreground mt-1">কিভাবে পরিশোধ করেছেন — ক্যাশবুকে রেকর্ড হবে।</p>
                    </div>
                    <div>
                      <Label className="text-xs mb-1 block">পরিশোধিত (৳)</Label>
                      <Input type="number" value={paid} onChange={e => setPaid(+e.target.value)} className="h-10 bg-background" />
                      <p className="text-[10px] text-muted-foreground mt-1">এখন কত টাকা দিয়েছেন — বাকিটা বকেয়া থাকবে।</p>
                    </div>
                  </div>
                  <div className={`rounded-lg px-4 py-3 flex justify-between items-center font-bold ${fullyPaid ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                    <span className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      {fullyPaid ? "সম্পূর্ণ পরিশোধিত" : "বকেয়া"}
                    </span>
                    <span>৳{fmt(fullyPaid ? total : due)}</span>
                  </div>
                </div>
              </div>
            </section>

            {/* Notes */}
            <section className="rounded-2xl bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))]/50 p-5">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-semibold text-sm">নোট (ঐচ্ছিক)</h3>
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                placeholder="পারচেজ সম্পর্কে কোনো নোট লিখুন..."
                className="w-full rounded-xl bg-[hsl(var(--surface-container-low))] border-none p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
            </section>
          </div>

          {/* Sticky footer — mobile responsive */}
          <div className="border-t border-[hsl(var(--surface-container-high))]/60 px-3 sm:px-5 py-3 bg-[hsl(var(--surface-container-lowest))] shrink-0">
            <div className="hidden sm:flex items-center justify-between">
              <button onClick={() => { setOpen(false); resetForm(); }} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">বাতিল</button>
              <div className="flex items-center gap-2">
                <span className="px-3 py-2 rounded-lg bg-[hsl(var(--surface-container-low))] text-sm font-bold">মোট ৳{fmt(total)}</span>
                <Button variant="outline" onClick={() => save(true)} className="gap-2"><Printer className="h-4 w-4" />সেভ ও প্রিন্ট (A4)</Button>
                <Button onClick={() => save(false)} className="gradient-primary gap-2"><Save className="h-4 w-4" />পারচেজ সেভ</Button>
              </div>
            </div>
            <div className="sm:hidden space-y-2">
              <div className="flex items-center justify-between">
                <button onClick={() => { setOpen(false); resetForm(); }} className="text-xs text-muted-foreground px-2">বাতিল</button>
                <span className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-sm font-black">মোট ৳{fmt(total)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" onClick={() => save(true)} className="gap-1 h-11 text-xs"><Printer className="h-4 w-4" />সেভ + প্রিন্ট</Button>
                <Button onClick={() => save(false)} className="gradient-primary gap-1 h-11 text-xs"><Save className="h-4 w-4" />সেভ</Button>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* View bill */}
      <Dialog open={!!viewBill} onOpenChange={(v) => !v && setViewBill(null)}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-2xl">
          <DialogHeader><DialogTitle>{viewBill?.bill_no}</DialogTitle></DialogHeader>
          {viewBill && (
            <div className="space-y-3">
              <div className="text-sm text-muted-foreground">
                {new Date(viewBill.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")} · {viewBill.suppliers?.name ?? "—"}
              </div>
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-muted-foreground border-b border-[hsl(var(--surface-container-high))]">
                  <tr><th className="text-left pb-2">পণ্য</th><th className="text-right pb-2">Qty</th><th className="text-right pb-2">Cost</th><th className="text-right pb-2">Total</th></tr>
                </thead>
                <tbody>
                  {viewBill.items.map((it: any) => (
                    <tr key={it.id} className="border-b border-[hsl(var(--surface-container-high))]/40">
                      <td className="py-2 font-medium">{it.product_name}</td>
                      <td className="py-2 text-right">{it.qty}</td>
                      <td className="py-2 text-right">{fmt(Number(it.unit_cost))}</td>
                      <td className="py-2 text-right font-bold">{fmt(Number(it.subtotal))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span>{t("subtotal")}</span><span>{fmt(Number(viewBill.subtotal))}</span></div>
                <div className="flex justify-between"><span>{t("discount")}</span><span>-{fmt(Number(viewBill.discount))}</span></div>
                <div className="flex justify-between font-black"><span>{t("total")}</span><span>{fmt(Number(viewBill.total))}</span></div>
                <div className="flex justify-between text-primary"><span>{t("paid")}</span><span>{fmt(Number(viewBill.paid))}</span></div>
                <div className="flex justify-between text-destructive"><span>{t("due")}</span><span>{fmt(Number(viewBill.due))}</span></div>
              </div>
              <div className="flex flex-wrap gap-2 justify-end pt-2">
                <Button variant="outline" onClick={() => printExisting(viewBill)} className="gap-2"><Printer className="h-4 w-4" />প্রিন্ট (A4)</Button>
                {isAdmin && <Button onClick={() => { const b = viewBill; setViewBill(null); openEdit(b); }} className="gap-2"><FileText className="h-4 w-4" />এডিট</Button>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Pay dialog */}
      <Dialog open={payOpen} onOpenChange={setPayOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))]">
          <DialogHeader><DialogTitle>বকেয়া পরিশোধ — {payTarget?.bill_no}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="bg-[hsl(var(--surface-container-low))] rounded-lg p-3 text-sm flex justify-between">
              <span>মোট বকেয়া</span><b className="text-destructive">{fmt(Number(payTarget?.due ?? 0))}</b>
            </div>
            <div><Label>পরিশোধ পরিমাণ</Label><Input type="number" value={payAmt} onChange={e => setPayAmt(+e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPayOpen(false)}>{t("cancel")}</Button>
            <Button onClick={submitPayment} className="gradient-primary">{t("save")}</Button>
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
