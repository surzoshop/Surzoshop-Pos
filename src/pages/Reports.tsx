import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useShop } from "@/hooks/useShop";
import {
  TrendingUp, Wallet, Receipt, Package, ShoppingCart, FileSpreadsheet,
  FileText, Printer, ChevronDown, ChevronUp, Calendar, Layers, AlertCircle,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

/* ------------------------------------------------------------------ */
/* Types                                                              */
/* ------------------------------------------------------------------ */
type Period = "today" | "week" | "month" | "lastMonth" | "year" | "custom" | "selectMonth";
type PrintTarget = "all" | "sales" | "purchases" | "expenses" | "pl";

type ReportData = {
  sales: any[];
  saleItems: any[];
  purchases: any[];
  purchaseItems: any[];
  expenses: any[];
  products: any[];
  customers: any[];
  suppliers: any[];
  expenseCategories: any[];
};

const EMPTY: ReportData = {
  sales: [], saleItems: [], purchases: [], purchaseItems: [],
  expenses: [], products: [], customers: [], suppliers: [], expenseCategories: [],
};

/* ------------------------------------------------------------------ */
/* Helpers                                                            */
/* ------------------------------------------------------------------ */
function startOfDay(d: Date) { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date)   { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function getRange(period: Period, monthVal: string, yearVal: number, from: string, to: string): [Date, Date] {
  const now = new Date();
  if (period === "today")     return [startOfDay(now), endOfDay(now)];
  if (period === "week")      { const s = startOfDay(now); s.setDate(s.getDate() - 6); return [s, endOfDay(now)]; }
  if (period === "month")     return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)];
  if (period === "lastMonth") return [new Date(now.getFullYear(), now.getMonth() - 1, 1), endOfDay(new Date(now.getFullYear(), now.getMonth(), 0))];
  if (period === "year")      return [new Date(now.getFullYear(), 0, 1), endOfDay(now)];
  if (period === "selectMonth") {
    const [y, m] = monthVal.split("-").map(Number);
    return [new Date(y, m - 1, 1), endOfDay(new Date(y, m, 0))];
  }
  if (period === "custom") {
    return [from ? startOfDay(new Date(from)) : new Date(now.getFullYear(), 0, 1),
            to ? endOfDay(new Date(to)) : endOfDay(now)];
  }
  return [new Date(now.getFullYear(), now.getMonth(), 1), endOfDay(now)];
}

function fmtDate(d: string | Date, lang: string) {
  return new Date(d).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-US",
    { year: "numeric", month: "short", day: "2-digit" });
}

function downloadCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (v: any) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "\uFEFF" + [headers, ...rows].map(r => r.map(escape).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ */
/* Component                                                          */
/* ------------------------------------------------------------------ */
export default function Reports() {
  const { t, fmt, lang } = useT();
  const { currentShop } = useShop();
  const [period, setPeriod] = useState<Period>("month");
  const [monthVal, setMonthVal] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [from, setFrom] = useState(""); const [to, setTo] = useState("");
  const [data, setData] = useState<ReportData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState({ sales: true, purchases: true, expenses: true, pl: true });

  const printAreaRef = useRef<HTMLDivElement>(null);

  const [start, end] = useMemo(() => getRange(period, monthVal, new Date().getFullYear(), from, to),
    [period, monthVal, from, to]);

  /* ----------------------------- Load data ------------------------- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      const startISO = start.toISOString();
      const endISO = end.toISOString();

      const [sales, saleItems, purchases, purchaseItems, expenses, products, customers, suppliers, ecats] = await Promise.all([
        supabase.from("sales").select("id,invoice_no,total,subtotal,discount,paid,due,payment_type,status,created_at,customer_id,customers(name,phone)")
          .gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: true }).limit(2000),
        supabase.from("sale_items").select("product_id,product_name,qty,unit_price,subtotal,products(cost),sales!inner(created_at)")
          .gte("sales.created_at", startISO).lte("sales.created_at", endISO).limit(5000),
        supabase.from("purchases").select("id,bill_no,total,subtotal,discount,paid,due,created_at,supplier_id,suppliers(name)")
          .gte("created_at", startISO).lte("created_at", endISO).order("created_at", { ascending: true }).limit(2000),
        supabase.from("purchase_items").select("product_id,product_name,qty,unit_cost,subtotal,purchases!inner(created_at)")
          .gte("purchases.created_at", startISO).lte("purchases.created_at", endISO).limit(5000),
        supabase.from("expenses").select("id,title,amount,expense_date,payment_method,notes,category_id,expense_categories(name)")
          .gte("expense_date", start.toISOString().slice(0, 10)).lte("expense_date", end.toISOString().slice(0, 10))
          .order("expense_date", { ascending: true }).limit(2000),
        supabase.from("products").select("id,name,sku,stock,cost,price,is_active").eq("is_active", true).limit(2000),
        supabase.from("customers").select("id,name,phone").limit(2000),
        supabase.from("suppliers").select("id,name").limit(500),
        supabase.from("expense_categories").select("id,name").limit(200),
      ]);

      if (!mounted) return;
      setData({
        sales: sales.data ?? [],
        saleItems: saleItems.data ?? [],
        purchases: purchases.data ?? [],
        purchaseItems: purchaseItems.data ?? [],
        expenses: expenses.data ?? [],
        products: products.data ?? [],
        customers: customers.data ?? [],
        suppliers: suppliers.data ?? [],
        expenseCategories: ecats.data ?? [],
      });
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [start, end]);

  /* ----------------------------- Aggregations ---------------------- */
  const k = useMemo(() => {
    const totalSales = data.sales.reduce((a, b) => a + Number(b.total), 0);
    const totalDiscount = data.sales.reduce((a, b) => a + Number(b.discount), 0);
    const totalPaid = data.sales.reduce((a, b) => a + Number(b.paid), 0);
    const totalDue = data.sales.reduce((a, b) => a + Number(b.due), 0);
    const grossProfit = data.saleItems.reduce(
      (a, b: any) => a + (Number(b.unit_price) - Number(b.products?.cost ?? 0)) * Number(b.qty), 0);
    const totalPurchase = data.purchases.reduce((a, b) => a + Number(b.total), 0);
    const totalExpense = data.expenses.reduce((a, b) => a + Number(b.amount), 0);
    const netProfit = grossProfit - totalExpense;
    const stockValue = data.products.reduce((a, p: any) => a + Number(p.stock) * Number(p.cost), 0);
    const stockSaleValue = data.products.reduce((a, p: any) => a + Number(p.stock) * Number(p.price), 0);
    return { totalSales, totalDiscount, totalPaid, totalDue, grossProfit, totalPurchase, totalExpense, netProfit, stockValue, stockSaleValue };
  }, [data]);

  /* -------- Daily breakdown table (sales + purchases + expenses) --- */
  const daily = useMemo(() => {
    const map = new Map<string, { sales: number; orders: number; discount: number; paid: number; due: number; purchase: number; expense: number }>();
    const ensure = (key: string) => {
      if (!map.has(key)) map.set(key, { sales: 0, orders: 0, discount: 0, paid: 0, due: 0, purchase: 0, expense: 0 });
      return map.get(key)!;
    };
    data.sales.forEach(s => {
      const key = new Date(s.created_at).toISOString().slice(0, 10);
      const r = ensure(key);
      r.sales += Number(s.total); r.orders += 1; r.discount += Number(s.discount);
      r.paid += Number(s.paid); r.due += Number(s.due);
    });
    data.purchases.forEach(p => {
      const key = new Date(p.created_at).toISOString().slice(0, 10);
      ensure(key).purchase += Number(p.total);
    });
    data.expenses.forEach(e => {
      ensure(String(e.expense_date)).expense += Number(e.amount);
    });
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([date, v]) => ({ date, ...v }));
  }, [data]);

  /* -------- Product-wise sales -------- */
  const productSales = useMemo(() => {
    const map = new Map<string, { name: string; qty: number; revenue: number; cost: number; profit: number }>();
    data.saleItems.forEach((i: any) => {
      const cur = map.get(i.product_name) ?? { name: i.product_name, qty: 0, revenue: 0, cost: 0, profit: 0 };
      const c = Number(i.products?.cost ?? 0);
      cur.qty += Number(i.qty);
      cur.revenue += Number(i.subtotal);
      cur.cost += c * Number(i.qty);
      cur.profit += (Number(i.unit_price) - c) * Number(i.qty);
      map.set(i.product_name, cur);
    });
    return [...map.values()].sort((a, b) => b.revenue - a.revenue);
  }, [data.saleItems]);

  /* -------- Top customers -------- */
  const topCustomers = useMemo(() => {
    const map = new Map<string, { name: string; phone: string; orders: number; total: number; due: number }>();
    data.sales.forEach((s: any) => {
      const name = s.customers?.name ?? t("walkInCustomer");
      const phone = s.customers?.phone ?? "";
      const cur = map.get(name) ?? { name, phone, orders: 0, total: 0, due: 0 };
      cur.orders += 1; cur.total += Number(s.total); cur.due += Number(s.due);
      map.set(name, cur);
    });
    return [...map.values()].sort((a, b) => b.total - a.total).slice(0, 20);
  }, [data.sales, t]);

  /* -------- Expense by category -------- */
  const expenseByCat = useMemo(() => {
    const map = new Map<string, number>();
    data.expenses.forEach((e: any) => {
      const k = e.expense_categories?.name ?? "—";
      map.set(k, (map.get(k) ?? 0) + Number(e.amount));
    });
    return [...map.entries()].sort((a, b) => b[1] - a[1]).map(([name, total]) => ({ name, total }));
  }, [data.expenses]);

  /* -------- Monthly comparison (current year) -------- */
  const monthly = useMemo(() => {
    const months = lang === "bn"
      ? ["জানু","ফেব্রু","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্ট","অক্টো","নভে","ডিসে"]
      : ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const arr = months.map((m, i) => ({ month: m, idx: i, sales: 0, purchase: 0, expense: 0 }));
    data.sales.forEach(s => {
      const d = new Date(s.created_at);
      if (d.getFullYear() === start.getFullYear()) arr[d.getMonth()].sales += Number(s.total);
    });
    data.purchases.forEach(p => {
      const d = new Date(p.created_at);
      if (d.getFullYear() === start.getFullYear()) arr[d.getMonth()].purchase += Number(p.total);
    });
    data.expenses.forEach(e => {
      const d = new Date(e.expense_date);
      if (d.getFullYear() === start.getFullYear()) arr[d.getMonth()].expense += Number(e.amount);
    });
    return arr;
  }, [data, start, lang]);

  /* ----------------------------- Print ----------------------------- */
  const handlePrint = (target: PrintTarget = "all") => {
    const body = document.body;
    const cleanup = () => {
      body.removeAttribute("data-report-print");
      window.removeEventListener("afterprint", cleanup);
    };

    if (target === "all") {
      setOpen({ sales: true, purchases: true, expenses: true, pl: true });
    } else {
      setOpen(prev => ({ ...prev, [target]: true }));
    }
    body.setAttribute("data-report-print", target);
    window.addEventListener("afterprint", cleanup, { once: true });
    requestAnimationFrame(() => setTimeout(() => window.print(), 100));
  };

  /* ----------------------------- PDF ------------------------------- */
  // Brand palette — matches stock_explanation.pdf
  const BLUE: [number, number, number] = [30, 64, 175];     // #1E40AF
  const ALT:  [number, number, number] = [248, 250, 252];   // #F8FAFC zebra
  const AMBER:[number, number, number] = [254, 243, 199];   // #FEF3C7 footer
  const GREEN:[number, number, number] = [240, 253, 244];   // #F0FDF4 profit
  const TEXT: [number, number, number] = [15, 23, 42];
  const MUTED:[number, number, number] = [100, 116, 139];

  const handlePDF = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const W = doc.internal.pageSize.getWidth();
    const shopName = currentShop?.name ?? "Shop";
    const periodLabel = `${fmtDate(start, "en")} — ${fmtDate(end, "en")}`;

    doc.setFillColor(...BLUE);
    doc.rect(0, 0, W, 70, "F");
    doc.setTextColor(255); doc.setFontSize(20); doc.setFont("helvetica", "bold");
    doc.text(shopName, W / 2, 30, { align: "center" });
    doc.setFontSize(11); doc.setFont("helvetica", "normal");
    doc.text("Business Report", W / 2, 48, { align: "center" });
    doc.setFontSize(9);
    doc.text(`Period: ${periodLabel}  |  Generated: ${new Date().toLocaleString("en-US")}`, W / 2, 62, { align: "center" });
    doc.setTextColor(...TEXT);

    autoTable(doc, {
      startY: 90,
      head: [["Description", "Amount (BDT)"]],
      body: [
        ["Total Sales", k.totalSales.toFixed(2)],
        ["Total Discount", k.totalDiscount.toFixed(2)],
        ["Total Paid", k.totalPaid.toFixed(2)],
        ["Total Due", k.totalDue.toFixed(2)],
        ["Total Purchase", k.totalPurchase.toFixed(2)],
        ["Total Expense", k.totalExpense.toFixed(2)],
        ["Gross Profit", k.grossProfit.toFixed(2)],
        ["Stock Cost Value", k.stockValue.toFixed(2)],
        ["Stock Sale Value", k.stockSaleValue.toFixed(2)],
      ],
      foot: [[k.netProfit >= 0 ? "Net Profit" : "Net Loss", Math.abs(k.netProfit).toFixed(2)]],
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold", halign: "left" },
      footStyles: { fillColor: GREEN, textColor: [21, 128, 61], fontStyle: "bold", fontSize: 11 },
      alternateRowStyles: { fillColor: ALT },
      styles: { fontSize: 10, cellPadding: 6, lineColor: [226, 232, 240], lineWidth: 0.5 },
      columnStyles: { 1: { halign: "right", fontStyle: "bold" } },
      margin: { left: 36, right: 36 },
    });

    const sectionPage = (title: string) => {
      doc.addPage();
      doc.setFillColor(...BLUE); doc.rect(0, 0, W, 36, "F");
      doc.setTextColor(255); doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text(title, 40, 23);
      doc.setTextColor(...TEXT);
    };

    const baseTable = (head: string[][], body: any[][], foot?: any[][]) => ({
      head, body, foot,
      headStyles: { fillColor: BLUE, textColor: 255, fontStyle: "bold" as const },
      footStyles: { fillColor: AMBER, textColor: TEXT, fontStyle: "bold" as const },
      alternateRowStyles: { fillColor: ALT },
      styles: { fontSize: 8, cellPadding: 4, lineColor: [226, 232, 240] as [number, number, number], lineWidth: 0.4 },
      margin: { left: 36, right: 36 },
    });

    if (daily.length) {
      sectionPage("Daily Sales Report");
      autoTable(doc, { startY: 50, ...baseTable(
        [["Date","Orders","Sales","Discount","Paid","Due","Purchase","Expense"]],
        daily.map(d => [d.date, d.orders, d.sales.toFixed(2), d.discount.toFixed(2), d.paid.toFixed(2), d.due.toFixed(2), d.purchase.toFixed(2), d.expense.toFixed(2)]),
        [["Total", daily.reduce((a,b)=>a+b.orders,0), k.totalSales.toFixed(2), k.totalDiscount.toFixed(2), k.totalPaid.toFixed(2), k.totalDue.toFixed(2), k.totalPurchase.toFixed(2), k.totalExpense.toFixed(2)]],
      )});
    }

    if (data.sales.length) {
      sectionPage("All Sales Transactions");
      autoTable(doc, { startY: 50, ...baseTable(
        [["Invoice","Date","Customer","Total","Paid","Due","Status"]],
        data.sales.map((s: any) => [s.invoice_no, fmtDate(s.created_at,"en"), s.customers?.name ?? "Walk-in", Number(s.total).toFixed(2), Number(s.paid).toFixed(2), Number(s.due).toFixed(2), s.status]),
      )});
    }

    if (productSales.length) {
      sectionPage("Product-wise Sales");
      autoTable(doc, { startY: 50, ...baseTable(
        [["Product","Qty","Revenue","Cost","Profit"]],
        productSales.map(p => [p.name, p.qty, p.revenue.toFixed(2), p.cost.toFixed(2), p.profit.toFixed(2)]),
        [["Total", productSales.reduce((a,b)=>a+b.qty,0), productSales.reduce((a,b)=>a+b.revenue,0).toFixed(2), productSales.reduce((a,b)=>a+b.cost,0).toFixed(2), productSales.reduce((a,b)=>a+b.profit,0).toFixed(2)]],
      )});
    }

    if (data.purchases.length) {
      sectionPage("Purchase List");
      autoTable(doc, { startY: 50, ...baseTable(
        [["Bill No","Date","Supplier","Total","Paid","Due"]],
        data.purchases.map((p: any) => [p.bill_no, fmtDate(p.created_at,"en"), p.suppliers?.name ?? "-", Number(p.total).toFixed(2), Number(p.paid).toFixed(2), Number(p.due).toFixed(2)]),
      )});
    }

    if (data.expenses.length) {
      sectionPage("Expenses");
      autoTable(doc, { startY: 50, ...baseTable(
        [["Date","Title","Category","Method","Amount"]],
        data.expenses.map((e: any) => [e.expense_date, e.title, e.expense_categories?.name ?? "-", e.payment_method ?? "cash", Number(e.amount).toFixed(2)]),
        [["Total","","","", k.totalExpense.toFixed(2)]],
      )});
    }

    if (data.products.length) {
      sectionPage("Stock Report");
      autoTable(doc, { startY: 50, ...baseTable(
        [["Product","SKU","Stock","Cost","Price","Stock Cost Value","Stock Sale Value"]],
        data.products.map((p: any) => [p.name, p.sku ?? "-", p.stock, Number(p.cost).toFixed(2), Number(p.price).toFixed(2), (Number(p.stock)*Number(p.cost)).toFixed(2), (Number(p.stock)*Number(p.price)).toFixed(2)]),
        [["Total","", data.products.reduce((a,b:any)=>a+Number(b.stock),0), "","", k.stockValue.toFixed(2), k.stockSaleValue.toFixed(2)]],
      )});
    }

    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8); doc.setTextColor(...MUTED);
      doc.text(`${shopName}  •  Page ${i} of ${pageCount}`, W / 2, doc.internal.pageSize.getHeight() - 16, { align: "center" });
    }

    doc.save(`Report_${start.toISOString().slice(0,10)}_${end.toISOString().slice(0,10)}.pdf`);
  };

  /* ----------------------------- Excel (styled, multi-sheet) ------- */
  const handleExcel = async () => {
    const wb = new ExcelJS.Workbook();
    wb.creator = currentShop?.name ?? "Shop";
    wb.created = new Date();

    const HEADER_FILL = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FF1E40AF" } };
    const ALT_FILL    = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF8FAFC" } };
    const FOOT_FILL   = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFEF3C7" } };
    const BORDER = { top:{style:"thin" as const,color:{argb:"FFE2E8F0"}}, left:{style:"thin" as const,color:{argb:"FFE2E8F0"}}, bottom:{style:"thin" as const,color:{argb:"FFE2E8F0"}}, right:{style:"thin" as const,color:{argb:"FFE2E8F0"}} };

    const buildSheet = (name: string, title: string, headers: string[], rows: any[][], foot?: any[], widths?: number[]) => {
      const ws = wb.addWorksheet(name, { views: [{ state: "frozen", ySplit: 4 }] });
      const colCount = headers.length;
      ws.mergeCells(1, 1, 1, colCount);
      const tc = ws.getCell(1, 1);
      tc.value = `${currentShop?.name ?? "Shop"} — ${title}`;
      tc.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
      tc.fill = HEADER_FILL; tc.alignment = { horizontal: "center", vertical: "middle" };
      ws.getRow(1).height = 26;
      ws.mergeCells(2, 1, 2, colCount);
      const sub = ws.getCell(2, 1);
      sub.value = `Period: ${fmtDate(start,"en")} — ${fmtDate(end,"en")}    |    Generated: ${new Date().toLocaleString("en-US")}`;
      sub.font = { italic: true, color: { argb: "FF64748B" }, size: 10 };
      sub.alignment = { horizontal: "center" };
      const headerRow = ws.getRow(4);
      headers.forEach((h, i) => {
        const c = headerRow.getCell(i + 1);
        c.value = h; c.font = { bold: true, color: { argb: "FFFFFFFF" } };
        c.fill = HEADER_FILL; c.alignment = { horizontal: "center", vertical: "middle" }; c.border = BORDER;
      });
      headerRow.height = 22;
      rows.forEach((r, ri) => {
        const row = ws.getRow(5 + ri);
        r.forEach((v, ci) => {
          const c = row.getCell(ci + 1);
          c.value = v; c.border = BORDER;
          if (typeof v === "number") c.numFmt = "#,##0.00";
          if (ri % 2 === 1) c.fill = ALT_FILL;
        });
      });
      if (foot) {
        const fr = ws.getRow(5 + rows.length);
        foot.forEach((v, ci) => {
          const c = fr.getCell(ci + 1);
          c.value = v; c.fill = FOOT_FILL; c.font = { bold: true }; c.border = BORDER;
          if (typeof v === "number") c.numFmt = "#,##0.00";
        });
      }
      (widths ?? headers.map(() => 16)).forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    };

    buildSheet("Summary", "Business Summary",
      ["Description", "Amount (BDT)"],
      [
        ["Total Sales", k.totalSales],
        ["Total Discount", k.totalDiscount],
        ["Total Paid", k.totalPaid],
        ["Total Due", k.totalDue],
        ["Total Purchase", k.totalPurchase],
        ["Total Expense", k.totalExpense],
        ["Gross Profit", k.grossProfit],
        ["Stock Cost Value", k.stockValue],
        ["Stock Sale Value", k.stockSaleValue],
      ],
      [k.netProfit >= 0 ? "Net Profit" : "Net Loss", Math.abs(k.netProfit)],
      [32, 20],
    );

    if (daily.length) buildSheet("Daily", "Daily Sales Report",
      ["Date","Orders","Sales","Discount","Paid","Due","Purchase","Expense"],
      daily.map(d => [d.date, d.orders, d.sales, d.discount, d.paid, d.due, d.purchase, d.expense]),
      ["Total", daily.reduce((a,b)=>a+b.orders,0), k.totalSales, k.totalDiscount, k.totalPaid, k.totalDue, k.totalPurchase, k.totalExpense],
      [14,10,14,14,14,14,14,14]);

    if (data.sales.length) buildSheet("Sales", "All Sales",
      ["Invoice","Date","Customer","Total","Paid","Due","Status"],
      data.sales.map((s: any) => [s.invoice_no, fmtDate(s.created_at,"en"), s.customers?.name ?? "Walk-in", Number(s.total), Number(s.paid), Number(s.due), s.status]),
      undefined, [14,14,24,14,14,14,12]);

    if (productSales.length) buildSheet("Products", "Product-wise Sales",
      ["Product","Qty","Revenue","Cost","Profit"],
      productSales.map(p => [p.name, p.qty, p.revenue, p.cost, p.profit]),
      ["Total", productSales.reduce((a,b)=>a+b.qty,0), productSales.reduce((a,b)=>a+b.revenue,0), productSales.reduce((a,b)=>a+b.cost,0), productSales.reduce((a,b)=>a+b.profit,0)],
      [32,10,16,16,16]);

    if (data.purchases.length) buildSheet("Purchases", "Purchase List",
      ["Bill No","Date","Supplier","Total","Paid","Due"],
      data.purchases.map((p: any) => [p.bill_no, fmtDate(p.created_at,"en"), p.suppliers?.name ?? "-", Number(p.total), Number(p.paid), Number(p.due)]),
      undefined, [14,14,24,14,14,14]);

    if (data.expenses.length) buildSheet("Expenses", "Expenses",
      ["Date","Title","Category","Method","Amount"],
      data.expenses.map((e: any) => [e.expense_date, e.title, e.expense_categories?.name ?? "-", e.payment_method ?? "cash", Number(e.amount)]),
      ["Total","","","", k.totalExpense],
      [14,28,18,14,16]);

    if (data.products.length) buildSheet("Stock", "Stock Report",
      ["Product","SKU","Stock","Cost","Price","Stock Cost Value","Stock Sale Value"],
      data.products.map((p: any) => [p.name, p.sku ?? "-", Number(p.stock), Number(p.cost), Number(p.price), Number(p.stock)*Number(p.cost), Number(p.stock)*Number(p.price)]),
      ["Total","", data.products.reduce((a,b:any)=>a+Number(b.stock),0), "","", k.stockValue, k.stockSaleValue],
      [32,14,10,14,14,18,18]);

    const buf = await wb.xlsx.writeBuffer();
    saveAs(new Blob([buf]), `Report_${start.toISOString().slice(0,10)}_${end.toISOString().slice(0,10)}.xlsx`);
  };

  /* ----------------------------- CSV ------------------------------- */
  const csvAll = () => {
    const periodTag = `${start.toISOString().slice(0,10)}_${end.toISOString().slice(0,10)}`;
    downloadCSV(`Sales_${periodTag}.csv`,
      ["Invoice", "Date", "Customer", "Phone", "Subtotal", "Discount", "Total", "Paid", "Due", "Status"],
      data.sales.map((s: any) => [
        s.invoice_no, new Date(s.created_at).toLocaleString(),
        s.customers?.name ?? "Walk-in", s.customers?.phone ?? "",
        Number(s.subtotal), Number(s.discount), Number(s.total),
        Number(s.paid), Number(s.due), s.status,
      ]));
  };

  /* ----------------------------- UI -------------------------------- */
  const isProfit = k.netProfit >= 0;

  return (
    <div className="space-y-5 md:space-y-6">
      {/* PageHeader */}
      <PageHeader title={t("reports")} subtitle={t("reportsSubtitle")} />

      {/* Filter bar — non-printable */}
      <div className="no-print bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--border))] rounded-2xl p-4 md:p-5 flex flex-col gap-3">
        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
          <Calendar className="h-4 w-4 text-[hsl(var(--primary))]" />
          {t("reportPeriod")}
        </div>
        <div className="flex flex-wrap gap-2">
          {[
            { id: "today", label: t("today") },
            { id: "week", label: t("filterWeek") },
            { id: "month", label: t("filterMonth") },
            { id: "lastMonth", label: t("lastMonth") },
            { id: "year", label: t("thisYear") },
            { id: "selectMonth", label: t("selectMonth") },
            { id: "custom", label: t("customRange") },
          ].map(p => (
            <button
              key={p.id}
              onClick={() => setPeriod(p.id as Period)}
              className={`px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-semibold border transition-all ${
                period === p.id
                  ? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] border-[hsl(var(--primary))]"
                  : "bg-[hsl(var(--surface-container-low))] text-foreground border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)]"
              }`}
            >{p.label}</button>
          ))}
        </div>

        {period === "selectMonth" && (
          <input type="month" value={monthVal} onChange={e => setMonthVal(e.target.value)}
            className="bg-[hsl(var(--surface-container-low))] border border-[hsl(var(--border))] rounded-lg px-3 py-2 text-sm w-fit" />
        )}
        {period === "custom" && (
          <div className="flex flex-wrap gap-2 items-center text-sm">
            <span className="text-muted-foreground font-semibold">{t("from")}:</span>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="bg-[hsl(var(--surface-container-low))] border border-[hsl(var(--border))] rounded-lg px-3 py-2" />
            <span className="text-muted-foreground font-semibold">{t("to")}:</span>
            <input type="date" value={to} onChange={e => setTo(e.target.value)}
              className="bg-[hsl(var(--surface-container-low))] border border-[hsl(var(--border))] rounded-lg px-3 py-2" />
          </div>
        )}

        <div className="flex flex-wrap gap-2 pt-2 border-t border-[hsl(var(--border))]">
          <button onClick={() => handlePrint("all")}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-bold text-sm hover:opacity-95 active:scale-95 transition-all shadow-[var(--shadow-primary)]">
            <Printer className="h-4 w-4" /> {t("printAll")}
          </button>
          <button onClick={handlePDF}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 text-white font-bold text-sm hover:bg-rose-700 active:scale-95 transition-all">
            <FileText className="h-4 w-4" /> {t("downloadPdf")}
          </button>
          <button onClick={handleExcel}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 active:scale-95 transition-all">
            <FileSpreadsheet className="h-4 w-4" /> {t("downloadExcel")}
          </button>
          {loading && <span className="text-xs text-muted-foreground self-center">Loading…</span>}
        </div>
      </div>

      {/* Print area */}
      <div ref={printAreaRef} className="report-print-root print-area space-y-5 md:space-y-6">

        {/* Print header — only visible in print */}
        <div className="hidden print:block text-center mb-4">
          <h1 className="text-2xl font-bold">{currentShop?.name ?? "Shop"}</h1>
          <p className="text-sm text-muted-foreground">{currentShop?.address ?? ""}</p>
          <p className="text-xs mt-1">
            {t("reportPeriod")}: {fmtDate(start, lang)} — {fmtDate(end, lang)}
          </p>
        </div>

        {/* KPI cards */}
        <div className="print-summary-grid grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <Kpi tone="emerald" icon={<TrendingUp />} label={t("totalSales")} value={fmt(k.totalSales)} sub={`${data.sales.length} ${t("invoice")}`} />
          <Kpi tone="violet"  icon={<Wallet />}     label={t("grossProfit")} value={fmt(k.grossProfit)} sub={t("revenueShort")} />
          <Kpi tone="amber"   icon={<ShoppingCart />} label={t("totalPurchase")} value={fmt(k.totalPurchase)} sub={`${data.purchases.length} ${t("billNo")}`} />
          <Kpi tone="sky"     icon={<Receipt />}    label={t("totalExpense")} value={fmt(k.totalExpense)} sub={`${data.expenses.length}`} />
          <Kpi tone="indigo"  icon={<Layers />}     label={t("stockValue")} value={fmt(k.stockValue)} sub={`${data.products.length} ${t("totalProducts")}`} />
          <Kpi tone="pink"    icon={<Package />}    label={t("paid")} value={fmt(k.totalPaid)} sub={t("totalSales")} />
          <Kpi tone="rose"    icon={<AlertCircle />} label={t("pendingDue")} value={fmt(k.totalDue)} sub={t("uncollected")} />
          <Kpi tone={isProfit ? "teal" : "rose"} icon={<Wallet />}
               label={isProfit ? t("netProfit") : t("netLoss")}
               value={fmt(Math.abs(k.netProfit))} sub={t("profitLoss")} />
        </div>

        {/* SECTION: Sales */}
        <Section
          open={open.sales}
          toggle={() => setOpen(s => ({ ...s, sales: !s.sales }))}
          title={t("salesSummary")}
          accent="emerald"
          printTarget="sales"
          onPrint={() => handlePrint("sales")}
          onCsv={() => downloadCSV(
            `Sales_${start.toISOString().slice(0,10)}.csv`,
            ["Invoice", "Date", "Customer", "Total", "Paid", "Due", "Status"],
            data.sales.map((s: any) => [s.invoice_no, new Date(s.created_at).toLocaleString(),
              s.customers?.name ?? "Walk-in", Number(s.total), Number(s.paid), Number(s.due), s.status]))}
        >
          {/* Daily breakdown */}
          <h4 className="text-sm font-bold text-foreground mb-2 mt-2">{t("dailySalesReport")}</h4>
          <ExcelTable
            headers={[t("date"), t("orderCount"), t("totalSales"), t("discount"), t("paid"), t("due")]}
            rows={daily.map(d => [
              fmtDate(d.date, lang), d.orders, fmt(d.sales), fmt(d.discount), fmt(d.paid), fmt(d.due),
            ])}
            footer={[t("total"), daily.reduce((a, b) => a + b.orders, 0),
              fmt(k.totalSales), fmt(k.totalDiscount), fmt(k.totalPaid), fmt(k.totalDue)]}
            empty={daily.length === 0}
            emptyText={t("noData")}
          />

          {/* All transactions */}
          <h4 className="text-sm font-bold text-foreground mb-2 mt-6">{t("allTransactions")}</h4>
          <ExcelTable
            headers={[t("invoiceNo"), t("date"), t("customer"), t("total"), t("paid"), t("due"), t("status")]}
            rows={data.sales.map((s: any) => [
              s.invoice_no, fmtDate(s.created_at, lang),
              s.customers?.name ?? t("walkInCustomer"),
              fmt(Number(s.total)), fmt(Number(s.paid)), fmt(Number(s.due)),
              s.status,
            ])}
            empty={data.sales.length === 0}
            emptyText={t("noData")}
          />

          {/* Product-wise */}
          <h4 className="text-sm font-bold text-foreground mb-2 mt-6">{t("productWiseSales")}</h4>
          <ExcelTable
            headers={[t("productName"), t("qty"), t("totalRevenue"), t("costShort"), t("profit")]}
            rows={productSales.map(p => [p.name, p.qty, fmt(p.revenue), fmt(p.cost), fmt(p.profit)])}
            empty={productSales.length === 0}
            emptyText={t("noData")}
          />

          {/* Top customers */}
          <h4 className="text-sm font-bold text-foreground mb-2 mt-6">{t("topCustomers")}</h4>
          <ExcelTable
            headers={[t("customer"), t("phone"), t("orderCount"), t("total"), t("due")]}
            rows={topCustomers.map(c => [c.name, c.phone, c.orders, fmt(c.total), fmt(c.due)])}
            empty={topCustomers.length === 0}
            emptyText={t("noData")}
          />
        </Section>

        {/* SECTION: Purchases */}
        <Section
          open={open.purchases}
          toggle={() => setOpen(s => ({ ...s, purchases: !s.purchases }))}
          title={t("purchaseSummary")}
          accent="amber"
          printTarget="purchases"
          onPrint={() => handlePrint("purchases")}
          onCsv={() => downloadCSV(
            `Purchases_${start.toISOString().slice(0,10)}.csv`,
            ["Bill No", "Date", "Supplier", "Total", "Paid", "Due"],
            data.purchases.map((p: any) => [p.bill_no, new Date(p.created_at).toLocaleString(),
              p.suppliers?.name ?? "—", Number(p.total), Number(p.paid), Number(p.due)]))}
        >
          <ExcelTable
            headers={[t("billNo"), t("date"), t("supplier"), t("total"), t("paid"), t("due")]}
            rows={data.purchases.map((p: any) => [
              p.bill_no, fmtDate(p.created_at, lang),
              p.suppliers?.name ?? "—",
              fmt(Number(p.total)), fmt(Number(p.paid)), fmt(Number(p.due)),
            ])}
            footer={[t("total"), "",
              `${data.purchases.length} ${t("billNo")}`,
              fmt(k.totalPurchase),
              fmt(data.purchases.reduce((a, b) => a + Number(b.paid), 0)),
              fmt(data.purchases.reduce((a, b) => a + Number(b.due), 0))]}
            empty={data.purchases.length === 0}
            emptyText={t("noData")}
          />
        </Section>

        {/* SECTION: Expenses */}
        <Section
          open={open.expenses}
          toggle={() => setOpen(s => ({ ...s, expenses: !s.expenses }))}
          title={t("expenseSummary")}
          accent="sky"
          printTarget="expenses"
          onPrint={() => handlePrint("expenses")}
          onCsv={() => downloadCSV(
            `Expenses_${start.toISOString().slice(0,10)}.csv`,
            ["Date", "Title", "Category", "Method", "Amount"],
            data.expenses.map((e: any) => [e.expense_date, e.title,
              e.expense_categories?.name ?? "—", e.payment_method ?? "cash", Number(e.amount)]))}
        >
          <h4 className="text-sm font-bold text-foreground mb-2 mt-2">{t("expenseByCategory")}</h4>
          <ExcelTable
            headers={[t("category"), t("totalExpense")]}
            rows={expenseByCat.map(c => [c.name, fmt(c.total)])}
            footer={[t("total"), fmt(k.totalExpense)]}
            empty={expenseByCat.length === 0}
            emptyText={t("noData")}
          />

          <h4 className="text-sm font-bold text-foreground mb-2 mt-6">{t("allTransactions")}</h4>
          <ExcelTable
            headers={[t("date"), t("title"), t("category"), t("paymentMethod"), t("amount")]}
            rows={data.expenses.map((e: any) => [
              fmtDate(e.expense_date, lang), e.title,
              e.expense_categories?.name ?? "—",
              e.payment_method ?? "cash", fmt(Number(e.amount)),
            ])}
            empty={data.expenses.length === 0}
            emptyText={t("noData")}
          />
        </Section>

        {/* SECTION: P&L + Stock + Monthly comparison */}
        <Section
          open={open.pl}
          toggle={() => setOpen(s => ({ ...s, pl: !s.pl }))}
          title={t("profitLoss")}
          accent="violet"
          printTarget="pl"
          onPrint={() => handlePrint("pl")}
          onCsv={() => downloadCSV(
            `Stock_${new Date().toISOString().slice(0,10)}.csv`,
            ["Product", "SKU", "Stock", "Cost", "Price", "Stock Value (cost)", "Stock Value (sale)"],
            data.products.map((p: any) => [p.name, p.sku ?? "",
              p.stock, Number(p.cost), Number(p.price),
              Number(p.stock) * Number(p.cost), Number(p.stock) * Number(p.price)]))}
        >
          {/* P&L summary */}
          <ExcelTable
            headers={[t("period"), t("amount")]}
            rows={[
              [t("totalSales"), fmt(k.totalSales)],
              [t("grossProfit"), fmt(k.grossProfit)],
              [t("totalExpense"), `- ${fmt(k.totalExpense)}`],
              [isProfit ? t("netProfit") : t("netLoss"), fmt(Math.abs(k.netProfit))],
            ]}
            empty={false}
            emptyText=""
          />

          <h4 className="text-sm font-bold text-foreground mb-2 mt-6">{t("monthlyComparison")} ({start.getFullYear()})</h4>
          <ExcelTable
            headers={[t("period"), t("totalSales"), t("totalPurchase"), t("totalExpense")]}
            rows={monthly.map(m => [m.month, fmt(m.sales), fmt(m.purchase), fmt(m.expense)])}
            footer={[
              t("total"),
              fmt(monthly.reduce((a, b) => a + b.sales, 0)),
              fmt(monthly.reduce((a, b) => a + b.purchase, 0)),
              fmt(monthly.reduce((a, b) => a + b.expense, 0)),
            ]}
            empty={false}
            emptyText=""
          />

          <h4 className="text-sm font-bold text-foreground mb-2 mt-6">{t("stockReport")}</h4>
          <ExcelTable
            headers={[t("productName"), t("sku"), t("stock"), t("cost"), t("price"), t("purchaseValue"), t("saleValue")]}
            rows={data.products.map((p: any) => [
              p.name, p.sku ?? "—", p.stock, fmt(Number(p.cost)), fmt(Number(p.price)),
              fmt(Number(p.stock) * Number(p.cost)), fmt(Number(p.stock) * Number(p.price)),
            ])}
            footer={[t("total"), "", "", "", "", fmt(k.stockValue), fmt(k.stockSaleValue)]}
            empty={data.products.length === 0}
            emptyText={t("noData")}
          />
        </Section>

        <div className="text-center text-[10px] text-muted-foreground py-4 print:block">
          {t("generatedOn")}: {new Date().toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm 10mm; }
          html, body { background: hsl(0 0% 100%) !important; }
          body[data-report-print] * { visibility: hidden !important; }
          body[data-report-print] .report-print-root,
          body[data-report-print] .report-print-root * { visibility: visible !important; }
          body[data-report-print] .no-print,
          body[data-report-print] .no-print * { display: none !important; visibility: hidden !important; }
          body[data-report-print] nav, body[data-report-print] aside, body[data-report-print] header,
          body[data-report-print] footer, body[data-report-print] [role="navigation"] { display: none !important; }
          body[data-report-print] .report-print-root {
            position: absolute !important;
            inset: 0 auto auto 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            background: hsl(0 0% 100%) !important;
          }
          body[data-report-print]:not([data-report-print="all"]) .print-summary-grid { display: none !important; }
          body[data-report-print="sales"] .section-card:not([data-print-section="sales"]),
          body[data-report-print="purchases"] .section-card:not([data-print-section="purchases"]),
          body[data-report-print="expenses"] .section-card:not([data-print-section="expenses"]),
          body[data-report-print="pl"] .section-card:not([data-print-section="pl"]) { display: none !important; }
          .print-area { display: block !important; }
          .print-area * { color: hsl(0 0% 0%) !important; box-shadow: none !important; }
          .print-area table { page-break-inside: auto; width: 100% !important; }
          .print-area tr { page-break-inside: avoid; page-break-after: auto; }
          .print-area thead { display: table-header-group; }
          .print-area .section-card { break-inside: auto; box-shadow: none !important; border: 1px solid hsl(0 0% 78%) !important; border-radius: 8px !important; margin-bottom: 12px !important; }
          .print-area .section-card > div:first-child { background: hsl(0 0% 96%) !important; border-bottom: 1px solid hsl(0 0% 78%) !important; }
          .print-area .kpi-card { border: 1px solid hsl(0 0% 86%) !important; border-radius: 8px !important; }
          .print-area th { background: hsl(0 0% 93%) !important; font-weight: 800 !important; }
          .print-area th, .print-area td { border-color: hsl(0 0% 76%) !important; padding: 6px 8px !important; }
        }
      `}</style>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Small subcomponents                                                */
/* ------------------------------------------------------------------ */
const TONES: Record<string, { icon: string; chip: string; bar: string }> = {
  emerald: { icon: "bg-gradient-to-br from-emerald-400 to-emerald-600", chip: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", bar: "bg-emerald-500" },
  violet:  { icon: "bg-gradient-to-br from-violet-400 to-violet-600",   chip: "bg-violet-500/10 text-violet-700 dark:text-violet-300",   bar: "bg-violet-500" },
  amber:   { icon: "bg-gradient-to-br from-amber-400 to-orange-500",    chip: "bg-amber-500/10 text-amber-700 dark:text-amber-300",      bar: "bg-amber-500" },
  sky:     { icon: "bg-gradient-to-br from-sky-400 to-sky-600",         chip: "bg-sky-500/10 text-sky-700 dark:text-sky-300",            bar: "bg-sky-500" },
  indigo:  { icon: "bg-gradient-to-br from-indigo-400 to-indigo-600",   chip: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",   bar: "bg-indigo-500" },
  pink:    { icon: "bg-gradient-to-br from-pink-400 to-fuchsia-600",    chip: "bg-pink-500/10 text-pink-700 dark:text-pink-300",         bar: "bg-pink-500" },
  rose:    { icon: "bg-gradient-to-br from-rose-400 to-red-600",        chip: "bg-rose-500/10 text-rose-700 dark:text-rose-300",         bar: "bg-rose-500" },
  teal:    { icon: "bg-gradient-to-br from-teal-400 to-teal-600",       chip: "bg-teal-500/10 text-teal-700 dark:text-teal-300",         bar: "bg-teal-500" },
};

function Kpi({ tone, icon, label, value, sub }: any) {
  const T = TONES[tone] ?? TONES.violet;
  return (
    <div className={`kpi-card group relative overflow-hidden bg-[hsl(var(--surface-container-lowest))] p-3 md:p-4 pl-4 md:pl-5 rounded-2xl border border-[hsl(var(--border))] hover:shadow-md transition-all`}>
      <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${T.bar}`} />
      <div className="flex items-start justify-between mb-2">
        <div className={`h-9 w-9 md:h-10 md:w-10 ${T.icon} text-white rounded-xl flex items-center justify-center [&>svg]:h-4 [&>svg]:w-4 md:[&>svg]:h-5 md:[&>svg]:w-5 shadow`}>
          {icon}
        </div>
      </div>
      <p className="text-[10px] md:text-[11px] font-bold text-muted-foreground uppercase tracking-wide truncate">{label}</p>
      <h3 className="text-base md:text-xl font-extrabold text-foreground mt-1 truncate font-bn">{value}</h3>
      <p className="text-[9px] md:text-[10px] text-muted-foreground mt-0.5 truncate">{sub}</p>
    </div>
  );
}

function Section({ open, toggle, title, accent, children, onPrint, onCsv, printTarget }: any) {
  const T = TONES[accent] ?? TONES.violet;
  return (
    <div data-print-section={printTarget} className="section-card bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--border))] rounded-2xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 md:px-6 py-3 md:py-4 border-b border-[hsl(var(--border))]">
        <button onClick={toggle} className="flex items-center gap-3 text-left flex-1 min-w-0">
          <span className={`h-8 w-1.5 rounded-full ${T.bar}`} />
          <h3 className="text-base md:text-lg font-bold text-foreground truncate font-bn">{title}</h3>
        </button>
        <div className="flex items-center gap-1.5 no-print">
          <button onClick={onCsv} title="CSV"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 transition">
            <FileSpreadsheet className="h-4 w-4" />
          </button>
          <button onClick={onPrint} title="Print"
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-[hsl(var(--primary)/0.1)] text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary)/0.2)] transition">
            <Printer className="h-4 w-4" />
          </button>
          <button onClick={toggle}
            className="h-8 w-8 inline-flex items-center justify-center rounded-lg bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container))] transition">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>
      {open && <div className="p-4 md:p-6">{children}</div>}
    </div>
  );
}

function ExcelTable({ headers, rows, footer, empty, emptyText }:
  { headers: (string | number)[]; rows: (string | number)[][]; footer?: (string | number)[]; empty: boolean; emptyText: string; }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[hsl(var(--border))]">
      <table className="w-full text-xs md:text-sm border-collapse">
        <thead>
          <tr className="bg-[hsl(var(--surface-container-low))]">
            {headers.map((h, i) => (
              <th key={i} className="text-left font-bold text-foreground px-3 py-2.5 border-b border-r last:border-r-0 border-[hsl(var(--border))] uppercase tracking-wide text-[10px] md:text-[11px] whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {empty ? (
            <tr><td colSpan={headers.length} className="text-center text-muted-foreground py-8">{emptyText}</td></tr>
          ) : rows.map((r, i) => (
            <tr key={i} className="hover:bg-[hsl(var(--surface-container-low))]/60 transition-colors">
              {r.map((c, j) => (
                <td key={j} className="px-3 py-2 border-b border-r last:border-r-0 border-[hsl(var(--border))] text-foreground font-bn whitespace-nowrap">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && !empty && (
          <tfoot>
            <tr className="bg-[hsl(var(--primary)/0.08)] font-bold">
              {footer.map((c, i) => (
                <td key={i} className="px-3 py-2.5 border-t-2 border-r last:border-r-0 border-[hsl(var(--primary)/0.3)] text-foreground font-bn whitespace-nowrap">
                  {c}
                </td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}
