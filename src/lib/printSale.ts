// Unified Sale print/PDF utility
// Offers 3 output formats: 58mm thermal mini-printer, A4 print, A4 PDF download.
// Includes warranty info + full installment schedule (date + amount).

import { supabase } from "@/integrations/supabase/client";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

type Shop = { name?: string | null; address?: string | null; phone?: string | null; logo_url?: string | null };

const SHOP_DISPLAY_NAME = "সূর্য শপ";

export type PrintSaleOptions = {
  saleId: string;
  shop: Shop;
  fmt: (n: number) => string;
  lang?: "bn" | "en";
};

const fmtBDDate = (d: string | Date | null | undefined, lang: "bn" | "en" = "bn") => {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka", day: "2-digit", month: "2-digit", year: "numeric",
  }).format(date);
};

const fmtBDDateTime = (d: string | Date, lang: "bn" | "en" = "bn") => {
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat(lang === "bn" ? "bn-BD" : "en-GB", {
    timeZone: "Asia/Dhaka", day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }).format(date);
};

const DEFAULT_LOGO_PATH = "/brand-logo.png";

const defaultLogoUrl = () => {
  if (typeof window === "undefined") return DEFAULT_LOGO_PATH;
  return new URL(DEFAULT_LOGO_PATH, window.location.origin).toString();
};

const normalizeLogoUrl = (logo?: string | null) => {
  const source = logo?.trim() || defaultLogoUrl();
  if (source.startsWith("data:")) return source;
  try { return new URL(source, window.location.origin).toString(); }
  catch { return defaultLogoUrl(); }
};

async function imageUrlToDataUrl(src?: string | null) {
  const url = normalizeLogoUrl(src);
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, { cache: "force-cache", mode: "cors" });
    if (!res.ok) throw new Error(`Logo fetch failed: ${res.status}`);
    const blob = await res.blob();
    if (!blob.type.startsWith("image/")) throw new Error("Logo is not an image");
    return await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    const fallback = defaultLogoUrl();
    if (url !== fallback) return imageUrlToDataUrl(fallback);
    return fallback;
  }
}

async function loadSale(saleId: string) {
  const [{ data: sale }, { data: items }, { data: installments }] = await Promise.all([
    supabase.from("sales").select("*, customers(name, phone, address)").eq("id", saleId).maybeSingle(),
    supabase.from("sale_items").select("*, products(supplier_voucher)").eq("sale_id", saleId).order("created_at", { ascending: true }),
    supabase.from("installments").select("*").eq("sale_id", saleId).order("installment_no", { ascending: true }),
  ]);
  const normalizedItems = (items ?? []).map((it: any) => ({
    ...it,
    supplier_voucher: it.products?.supplier_voucher ?? null,
  }));
  return { sale, items: normalizedItems, installments: installments ?? [] };
}

// ---------- 58mm thermal ----------
function buildThermalHTML(sale: any, items: any[], installments: any[], shop: Shop, fmt: (n: number) => string, lang: "bn" | "en") {
  const dateStr = fmtBDDateTime(sale.created_at, lang);
  const logoUrl = normalizeLogoUrl(shop.logo_url);
  const fallbackLogo = defaultLogoUrl();
  const itemRows = items.map((it: any) => `
    <tr>
      <td style="padding:2px 0">${escapeHtml(it.product_name)}${it.warranty_until ? `<div style="font-size:9px;color:#000">⛨ ওয়ারেন্টি ${it.warranty_months || ""} মাস (${fmtBDDate(it.warranty_until, lang)})</div>` : ""}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${fmt(Number(it.unit_price))}</td>
      <td style="text-align:right;font-weight:700">${fmt(Number(it.subtotal))}</td>
    </tr>`).join("");

  const instRows = installments.length ? `
    <div style="border-top:1px dashed #000;margin:5px 0"></div>
    <div style="text-align:center;font-weight:700;font-size:11px">কিস্তি সময়সূচি</div>
    <table style="width:100%;font-size:10px;border-collapse:collapse">
      <thead><tr style="border-bottom:1px solid #000">
        <th style="text-align:left">#</th><th style="text-align:left">তারিখ</th><th style="text-align:right">টাকা</th><th style="text-align:right">অবস্থা</th>
      </tr></thead>
      <tbody>
        ${installments.map(i => `<tr>
          <td>${i.installment_no}</td>
          <td>${fmtBDDate(i.due_date, lang)}</td>
          <td style="text-align:right;font-weight:700">${fmt(Number(i.amount))}</td>
          <td style="text-align:right">${i.status === "paid" ? "✓ পরিশোধিত" : "বকেয়া"}</td>
        </tr>`).join("")}
      </tbody>
    </table>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>${sale.invoice_no}</title>
    <style>
      @page{size:80mm auto;margin:3mm}
      @media print{body{margin:0}}
      html,body{margin:0;padding:0}
      body{font-family:'Courier New',monospace;font-size:12px;color:#000;width:74mm;margin:0 auto;padding:4px}
      .c{text-align:center}.r{text-align:right}.b{font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:11px}
      th,td{padding:2px 0}
      .dash{border-top:1px dashed #000;margin:4px 0}
      .solid{border-top:1px solid #000;margin:4px 0}
      h1{font-size:15px;margin:0;font-weight:800;letter-spacing:.5px}
      .small{font-size:10px;line-height:1.3}
    </style></head><body>
    <div class="c">
      <img src="${escapeHtml(logoUrl)}" data-fallback="${escapeHtml(fallbackLogo)}" style="max-height:42px"/>
      <h1>${SHOP_DISPLAY_NAME}</h1>
      ${shop.address ? `<div class="small">📍 ${escapeHtml(shop.address)}</div>` : ""}
      ${shop.phone ? `<div class="small">📞 ${escapeHtml(shop.phone)}</div>` : ""}
      <div class="dash"></div>
      <div class="b">ক্যাশ মেমো / CASH MEMO</div>
    </div>
    <div class="small">
      <div style="display:flex;justify-content:space-between"><span>Inv:</span><span class="b">${sale.invoice_no}</span></div>
      <div style="display:flex;justify-content:space-between"><span>তারিখ:</span><span>${dateStr}</span></div>
      ${sale.customers?.name ? `<div style="display:flex;justify-content:space-between"><span>ক্রেতা:</span><span>${escapeHtml(sale.customers.name)}${sale.customers.phone ? " · " + escapeHtml(sale.customers.phone) : ""}</span></div>` : ""}
    </div>
    <div class="dash"></div>
    <table>
      <thead><tr class="b" style="border-bottom:1px solid #000">
        <th style="text-align:left">Item</th><th>Qty</th><th class="r">Rate</th><th class="r">Total</th>
      </tr></thead>
      <tbody>${itemRows}</tbody>
    </table>
    <div class="dash"></div>
    <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(Number(sale.total) + Number(sale.discount || 0))}</span></div>
    ${Number(sale.discount) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>- ${fmt(Number(sale.discount))}</span></div>` : ""}
    <div class="solid"></div>
    <div style="display:flex;justify-content:space-between;font-size:14px" class="b"><span>মোট</span><span>${fmt(Number(sale.total))}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Paid</span><span>${fmt(Number(sale.paid))}</span></div>
    ${Number(sale.due) > 0 ? `<div style="display:flex;justify-content:space-between" class="b"><span>বকেয়া</span><span>${fmt(Number(sale.due))}</span></div>` : ""}
    ${instRows}
    <div class="dash"></div>
    <div class="c small">
      <div class="b">ধন্যবাদ — আবার আসবেন</div>
      <div style="margin-top:2px">বিক্রয়কৃত পণ্য ফেরতযোগ্য নয়</div>
    </div>
    </body></html>`;
}

// ---------- A4 layout — Excel-style grid with full borders + colors ----------
const A4_CSS = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Hind Siliguli','Noto Sans Bengali','Segoe UI',Arial,sans-serif;color:#0f172a;background:#fff;font-size:12px;line-height:1.4;-webkit-print-color-adjust:exact;print-color-adjust:exact}
.sheet{width:210mm;min-height:297mm;padding:10mm 10mm;background:#fff;margin:0 auto}
.outer{border:1px solid #bfdbfe;border-radius:6px;overflow:hidden;box-shadow:0 0 0 3px #f8fbff,0 0 0 4px #bfdbfe}
.head{background:linear-gradient(135deg,#f0f9ff 0%,#e0f2fe 55%,#dbeafe 100%);color:#1e3a8a;padding:18px 16px 14px;border-bottom:2px solid #bfdbfe;text-align:center;position:relative}
.head .head-logo-c{position:absolute;top:12px;right:14px;margin-bottom:0;z-index:2}
.head .head-logo-c img{max-height:56px;max-width:80px;background:#fff;padding:4px;border-radius:8px;box-shadow:0 2px 5px rgba(30,58,138,.12);border:1px solid #bfdbfe}
.head h1{font-size:32px;font-weight:900;letter-spacing:0;line-height:1.1;color:#172554;text-shadow:0 1px 0 rgba(255,255,255,.9)}
.head .meta{font-size:11.5px;color:#475569;margin-top:5px;line-height:1.5;font-weight:500}
.head .meta b{font-weight:700;margin-right:4px;color:#1e3a8a}
.head .invbar{margin-top:10px;display:inline-block;padding:5px 14px;background:rgba(219,234,254,.72);border:1px solid #93c5fd;border-radius:20px;font-size:11px;color:#1e3a8a;font-weight:600;box-shadow:inset 0 1px 0 rgba(255,255,255,.75)}
.head .invbar .lbl{color:#334155;text-transform:uppercase;letter-spacing:1px;font-size:10px;margin-right:6px}
.head .invbar .no{color:#1e3a8a;font-weight:900;letter-spacing:.5px}
.head .invbar .sep{margin:0 10px;color:#cbd5e1}
.title-band{background:linear-gradient(90deg,#1e3a8a 0%,#2563eb 50%,#1e3a8a 100%);color:#fef3c7;font-family:'Hind Siliguli','Kalpurush','Noto Serif Bengali','Georgia',serif;font-weight:700;font-style:italic;text-align:center;padding:9px;font-size:18px;letter-spacing:4px;border-top:1px solid #fff;text-shadow:0 1px 2px rgba(0,0,0,.3)}
.title-band .en{font-family:'Georgia','Playfair Display',serif;font-style:italic;font-weight:600;font-size:12px;letter-spacing:5px;opacity:.85;margin-left:10px}
table.xls{width:100%;border-collapse:collapse;table-layout:fixed}
table.xls th,table.xls td{border:1px solid #1e3a8a;padding:6px 8px;font-size:11.5px;vertical-align:middle;word-wrap:break-word}
table.xls th{background:#dbeafe;color:#1e3a8a;font-weight:800;text-align:left;font-size:11px;text-transform:uppercase;letter-spacing:.5px}
.section-title{background:#1e3a8a;color:#fff;font-weight:800;padding:6px 10px;font-size:12px;letter-spacing:1px;text-transform:uppercase;border:1px solid #1e3a8a;border-bottom:0}
.kv th{background:#e0e7ff;color:#1e3a8a;font-weight:700;width:22%;text-align:left}
.kv td{background:#fff;font-weight:600}
table.items thead th{background:linear-gradient(180deg,#2563eb,#1d4ed8);color:#fff;text-align:center;font-size:11px;padding:8px 6px}
table.items tbody tr:nth-child(even) td{background:#f8fafc}
table.items tbody tr:nth-child(odd) td{background:#ffffff}
table.items td.num{text-align:right;font-variant-numeric:tabular-nums;font-weight:700;color:#0f172a}
table.items td.center{text-align:center}
table.items td.qty{text-align:center;font-weight:700;background:#fef3c7 !important;color:#92400e}
.warr-tag{display:inline-block;font-size:10px;background:#d1fae5;color:#065f46;padding:1px 6px;border:1px solid #6ee7b7;border-radius:2px;margin-top:3px;font-weight:700}
table.totals{width:55%;margin-left:auto;border-collapse:collapse;table-layout:fixed}
table.totals td{border:1px solid #1e3a8a;padding:6px 12px;font-size:12px}
table.totals .lbl{background:#e0e7ff;color:#1e3a8a;font-weight:700;text-align:left;width:55%}
table.totals .val{background:#fff;text-align:right;font-weight:800;color:#0f172a;font-variant-numeric:tabular-nums}
table.totals .grand .lbl,table.totals .grand .val{background:#1e3a8a !important;color:#fff !important;font-size:14px;font-weight:800}
table.totals .due .lbl,table.totals .due .val{background:#fee2e2 !important;color:#991b1b !important;font-weight:800}
table.totals .paid .lbl,table.totals .paid .val{background:#dcfce7 !important;color:#166534 !important}
.inst-paid{background:#dcfce7 !important;color:#166534;font-weight:700}
.inst-due{background:#fef3c7 !important;color:#92400e;font-weight:700}
.warr thead th{background:linear-gradient(180deg,#10b981,#059669);color:#fff;text-align:center;font-size:11px;padding:8px}
.warr td{border-color:#059669}
.inst thead th{background:linear-gradient(180deg,#dc2626,#b91c1c);color:#fff;text-align:center;font-size:11px;padding:8px}
.inst td{border-color:#dc2626}
.inst .section-title{background:#dc2626;border-color:#dc2626}
.warr .section-title{background:#059669;border-color:#059669}
.signs{display:table;width:100%;margin-top:24px;table-layout:fixed}
.sig{display:table-cell;width:33.33%;text-align:center;padding:0 10px;vertical-align:bottom}
.sig .line{border-top:1.5px solid #0f172a;margin-top:42px;padding-top:5px;font-size:11px;color:#475569;font-weight:600}
.seal-box{width:110px;height:110px;border:1.5px dashed #1e3a8a;border-radius:6px;margin:0 auto;display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:10px;font-weight:600;letter-spacing:1px;background:repeating-linear-gradient(45deg,#fff,#fff 6px,#f8fafc 6px,#f8fafc 12px)}
.seal-cap{font-size:11px;color:#475569;font-weight:600;margin-top:6px}
.foot{margin-top:14px;text-align:center;font-size:10px;color:#475569;border-top:2px dashed #1e3a8a;padding-top:8px}
.foot .b{font-weight:800;color:#1e3a8a;font-size:11px}
.gap{height:8px}
@media print{
  html,body{width:210mm;min-height:297mm;margin:0 !important;padding:0 !important;background:#fff !important;overflow:visible !important}
  .sheet{width:210mm;min-height:296mm;margin:0 !important;padding:8mm 9mm !important;page-break-after:avoid;break-after:avoid;overflow:hidden}
  .outer{box-shadow:none}
  .signs,.foot{break-inside:avoid;page-break-inside:avoid}
}
`;

function buildA4Body(sale: any, items: any[], installments: any[], shop: Shop, fmt: (n: number) => string, lang: "bn" | "en") {
  const dateStr = fmtBDDateTime(sale.created_at, lang);
  const logoUrl = normalizeLogoUrl(shop.logo_url);
  const warrantyItems = items.filter((i: any) => i.warranty_until);

  const itemRows = items.map((it: any, idx: number) => `
    <tr>
      <td class="center">${idx + 1}</td>
      <td>
        <div style="font-weight:700;color:#0f172a">${escapeHtml(it.product_name)}</div>
        ${it.warranty_until ? `<div class="warr-tag">⛨ ওয়ারেন্টি ${it.warranty_months || ""} মাস · ${fmtBDDate(it.warranty_until, lang)}</div>` : ""}
      </td>
      <td class="qty">${it.qty}</td>
      <td class="num">${fmt(Number(it.unit_price))}</td>
      <td class="num">${fmt(Number(it.subtotal))}</td>
    </tr>`).join("");

  const warrantyBlock = warrantyItems.length ? `
    <div class="gap"></div>
    <div class="warr">
      <div class="section-title">⛨ ওয়ারেন্টি তথ্য / Warranty Information</div>
      <table class="xls">
        <colgroup><col style="width:8%"><col><col style="width:18%"><col style="width:22%"></colgroup>
        <thead><tr>
          <th style="text-align:center">ক্রম</th><th>পণ্যের নাম</th><th style="text-align:center">মেয়াদ</th><th style="text-align:center">শেষ তারিখ</th>
        </tr></thead>
        <tbody>
          ${warrantyItems.map((it: any, i: number) => `<tr>
            <td style="text-align:center;font-weight:700">${i + 1}</td>
            <td style="font-weight:600">${escapeHtml(it.product_name)}</td>
            <td style="text-align:center;font-weight:700;background:#ecfdf5">${it.warranty_months || ""} মাস</td>
            <td style="text-align:center;font-weight:800;background:#ecfdf5;color:#065f46">${fmtBDDate(it.warranty_until, lang)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  const totalInst = installments.reduce((a, i) => a + Number(i.amount || 0), 0);
  const totalPaidInst = installments.reduce((a, i) => a + Number(i.paid_amount || 0), 0);

  const installmentBlock = installments.length ? `
    <div class="gap"></div>
    <div class="inst">
      <div class="section-title">💰 কিস্তি সময়সূচি / Installment Schedule</div>
      <table class="xls">
        <colgroup><col style="width:7%"><col style="width:17%"><col style="width:14%"><col style="width:14%"><col style="width:16%"><col style="width:16%"><col style="width:16%"></colgroup>
        <thead><tr>
          <th style="text-align:center">কিস্তি নং</th>
          <th style="text-align:center">পরিশোধের তারিখ</th>
          <th style="text-align:right">কিস্তি (৳)</th>
          <th style="text-align:right">পরিশোধিত (৳)</th>
          <th style="text-align:center">অবস্থা</th>
          <th style="text-align:center">পরিশোধের তারিখ (ম্যানুয়াল)</th>
          <th style="text-align:center">গ্রহণকারীর স্বাক্ষর</th>
        </tr></thead>
        <tbody>
          ${installments.map(i => `<tr>
            <td style="text-align:center;font-weight:800;background:#fee2e2;color:#991b1b">${i.installment_no}</td>
            <td style="text-align:center;font-weight:700">${fmtBDDate(i.due_date, lang)}</td>
            <td class="num">${fmt(Number(i.amount))}</td>
            <td class="num">${fmt(Number(i.paid_amount || 0))}</td>
            <td style="text-align:center" class="${i.status === "paid" ? "inst-paid" : "inst-due"}">${i.status === "paid" ? "✓ পরিশোধিত" : "⏳ বকেয়া"}</td>
            <td style="height:32px;background:#fff"></td>
            <td style="height:32px;background:#fff"></td>
          </tr>`).join("")}
          <tr>
            <td colspan="2" style="text-align:right;font-weight:800;background:#fef3c7;color:#92400e">সর্বমোট</td>
            <td class="num" style="background:#fef3c7;color:#92400e">${fmt(totalInst)}</td>
            <td class="num" style="background:#fef3c7;color:#92400e">${fmt(totalPaidInst)}</td>
            <td colspan="3" style="background:#fef3c7;text-align:center;font-weight:800;color:#92400e">বকেয়া ${fmt(Math.max(totalInst - totalPaidInst, 0))}</td>
          </tr>
        </tbody>
      </table>
      <div style="font-size:10px;color:#475569;margin-top:4px;font-style:italic">
        * প্রতিটি কিস্তি পরিশোধের সময় উপরের ফাঁকা ঘরে তারিখ ও গ্রহণকারীর স্বাক্ষর দিতে হবে।
      </div>
    </div>` : "";

  return `
    <div class="sheet">
      <div class="outer">
        <div class="head">
          <div class="head-logo-c"><img src="${escapeHtml(logoUrl)}" crossorigin="anonymous" onerror="this.parentNode.style.display='none'"/></div>
          <h1>${SHOP_DISPLAY_NAME}</h1>
          ${shop.address ? `<div class="meta"><b>📍</b>${escapeHtml(shop.address)}</div>` : ""}
          ${shop.phone ? `<div class="meta"><b>📞</b>${escapeHtml(shop.phone)}</div>` : ""}
          <div class="invbar">
            <span class="lbl">Invoice</span><span class="no">${escapeHtml(sale.invoice_no)}</span>
            <span class="sep">|</span>
            <span class="lbl">Date</span><span>${dateStr}</span>
          </div>
        </div>
        <div class="title-band">৺ ক্যাশ  মেমো ৺<span class="en">CASH MEMO</span></div>
      </div>

      <div class="gap"></div>

      <table class="xls kv">
        <colgroup><col style="width:18%"><col style="width:32%"><col style="width:18%"><col style="width:32%"></colgroup>
        <tbody>
          <tr>
            <th>ক্রেতার নাম</th><td>${escapeHtml(sale.customers?.name || "—")}</td>
            <th>মোবাইল</th><td>${escapeHtml(sale.customers?.phone || "—")}</td>
          </tr>
          <tr>
            <th>ঠিকানা</th><td colspan="3">${escapeHtml(sale.customers?.address || "—")}</td>
          </tr>
          <tr>
            <th>পেমেন্ট ধরন</th><td style="font-weight:800;color:#1e3a8a">${sale.payment_type === "installment" ? "কিস্তি" : sale.payment_type === "due" ? "বাকি" : "নগদ"}</td>
            <th>মাধ্যম</th><td>${sale.payment_method ? String(sale.payment_method).toUpperCase() : "—"}</td>
          </tr>
        </tbody>
      </table>

      <div class="gap"></div>

      <div class="section-title" style="background:#1e3a8a">📦 পণ্যের তালিকা / Items</div>
      <table class="xls items">
        <colgroup><col style="width:8%"><col><col style="width:12%"><col style="width:18%"><col style="width:20%"></colgroup>
        <thead><tr>
          <th style="text-align:center">ক্রম</th>
          <th>পণ্যের বিবরণ</th>
          <th style="text-align:center">পরিমাণ</th>
          <th style="text-align:right">একক দর (৳)</th>
          <th style="text-align:right">মোট (৳)</th>
        </tr></thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="gap"></div>

      <table class="totals">
        <tr><td class="lbl">Subtotal</td><td class="val">${fmt(Number(sale.total) + Number(sale.discount || 0))}</td></tr>
        ${Number(sale.discount) > 0 ? `<tr><td class="lbl">ছাড় (Discount)</td><td class="val">- ${fmt(Number(sale.discount))}</td></tr>` : ""}
        <tr class="grand"><td class="lbl">মোট / GRAND TOTAL</td><td class="val">${fmt(Number(sale.total))}</td></tr>
        <tr class="paid"><td class="lbl">পরিশোধিত (Paid)</td><td class="val">${fmt(Number(sale.paid))}</td></tr>
        ${Number(sale.due) > 0 ? `<tr class="due"><td class="lbl">বকেয়া (Due)</td><td class="val">${fmt(Number(sale.due))}</td></tr>` : ""}
      </table>

      ${warrantyBlock}
      ${installmentBlock}

      <div class="signs">
        <div class="sig"><div class="line">ক্রেতার স্বাক্ষর / Customer Signature</div></div>
        <div class="sig">
          <div class="seal-box">SEAL / সীল</div>
          <div class="seal-cap">প্রতিষ্ঠানের সীল</div>
        </div>
        <div class="sig"><div class="line">অনুমোদনকারীর স্বাক্ষর / Authorized Signature</div></div>
      </div>

      <div class="foot">
        <div class="b">ধন্যবাদ — আবার আসবেন</div>
        <div>বিক্রয়কৃত পণ্য ফেরতযোগ্য নয় · Powered by ${SHOP_DISPLAY_NAME}</div>
      </div>
    </div>`;
}

function buildA4Document(sale: any, items: any[], installments: any[], shop: Shop, fmt: (n: number) => string, lang: "bn" | "en", _autoPrint: boolean) {
  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${sale.invoice_no}</title>
    <style>@page{size:A4;margin:0}${A4_CSS}</style>
    </head><body>${buildA4Body(sale, items, installments, shop, fmt, lang)}
    </body></html>`;
}

function escapeHtml(s: any): string {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function isMobilePrintContext() {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.matchMedia("(max-width: 768px)").matches;
}

async function waitForImages(root: Document | HTMLElement) {
  const imgs = root instanceof Document ? Array.from(root.images || []) : Array.from(root.querySelectorAll("img"));
  await Promise.all(imgs.map(img => new Promise<void>(res => {
    let settled = false;
    const done = () => { if (!settled) { settled = true; res(); } };
    img.onload = done;
    img.onerror = () => {
      const fallback = img.getAttribute("data-fallback");
      if (fallback && img.src !== fallback) {
        img.removeAttribute("data-fallback");
        img.src = fallback;
        return;
      }
      img.style.display = "none";
      done();
    };
    if (img.complete && img.naturalWidth > 0) done();
    setTimeout(done, 3000);
  })));
}

function openHTMLInCurrentWindowForMobile(html: string) {
  document.getElementById("__mobile_print_root")?.remove();
  document.getElementById("__mobile_print_style")?.remove();

  const parsed = new DOMParser().parseFromString(html, "text/html");
  const isA4 = !!parsed.querySelector(".sheet");
  const rootWidth = isA4 ? "210mm" : "80mm";
  const rootMinHeight = isA4 ? "297mm" : "auto";
  const styleEl = document.createElement("style");
  styleEl.id = "__mobile_print_style";
  styleEl.textContent = `${Array.from(parsed.querySelectorAll("style")).map(s => s.textContent ?? "").join("\n")}
    @media print{
      body > *:not(#__mobile_print_root){display:none !important}
      #__mobile_print_root{display:block !important;position:static !important;opacity:1 !important;width:${rootWidth} !important;min-height:auto !important;margin:0 auto !important;padding:${isA4 ? "0" : "4px"} !important;background:#fff !important;overflow:visible !important;color:#000 !important}
    }`;

  const root = document.createElement("div");
  root.id = "__mobile_print_root";
  root.style.cssText = `position:fixed;left:0;top:0;width:${rootWidth};min-height:${rootMinHeight};background:#fff;z-index:2147483647;opacity:0;pointer-events:none;overflow:hidden`;
  root.innerHTML = parsed.body.innerHTML;
  document.head.appendChild(styleEl);
  document.body.appendChild(root);

  const cleanup = () => { root.remove(); styleEl.remove(); };
  waitForImages(root).then(() => setTimeout(() => {
    try { window.print(); } catch (e) { console.error("Print failed:", e); cleanup(); }
    window.addEventListener("afterprint", cleanup, { once: true });
    setTimeout(cleanup, 60_000);
  }, 250));
}

function openHTMLInPrintWindow(html: string) {
  if (isMobilePrintContext()) {
    openHTMLInCurrentWindowForMobile(html);
    return;
  }

  // Always use a hidden iframe — never open a new tab/window.
  // This shows only the browser's native print dialog without redirecting the user.
  const old = document.getElementById("__print_iframe"); if (old) old.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__print_iframe";
  Object.assign(iframe.style, {
    position: "fixed", left: "0", top: "0",
    width: "210mm", height: "297mm", border: "0", opacity: "0", pointerEvents: "none",
  });
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!idoc) return;
  idoc.open(); idoc.write(html); idoc.close();

  const cleanup = () => { try { iframe.remove(); } catch { void 0; } };
  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) { console.error("Print failed:", e); }
    // Remove iframe after the print dialog closes
    try { iframe.contentWindow?.addEventListener("afterprint", cleanup); } catch { void 0; }
    setTimeout(cleanup, 60_000);
  };

  // Wait for images (logo) inside iframe before printing
  const waitImages = async () => {
    const imgs = Array.from(idoc.images || []);
    await Promise.all(imgs.map(img => new Promise<void>(res => {
      const done = () => res();
      img.onload = done;
      img.onerror = () => {
        const fallback = img.getAttribute("data-fallback");
        if (fallback && img.src !== fallback) {
          img.removeAttribute("data-fallback");
          img.src = fallback;
          return;
        }
        img.style.display = "none";
        done();
      };
      if (img.complete && img.naturalWidth > 0) done();
      setTimeout(done, 3000);
    })));
  };

  if (iframe.contentWindow?.document.readyState === "complete") {
    waitImages().then(() => setTimeout(triggerPrint, 200));
  } else {
    iframe.addEventListener("load", () => { waitImages().then(() => setTimeout(triggerPrint, 200)); });
  }
}

async function downloadPDF(sale: any, items: any[], installments: any[], shop: Shop, fmt: (n: number) => string, lang: "bn" | "en", filename: string) {
  const existing = document.getElementById("__a4_pdf_wrapper");
  if (existing) existing.remove();
  const pdfShop = { ...shop, logo_url: await imageUrlToDataUrl(shop.logo_url) };

  // Render in an actual on-page (but offscreen) container so html2canvas captures real layout + fonts
  const wrapper = document.createElement("div");
  wrapper.id = "__a4_pdf_wrapper";
  wrapper.style.cssText = "position:fixed;left:-10000px;top:0;z-index:-1;opacity:1;pointer-events:none;width:210mm;background:#fff;overflow:hidden";

  const styleEl = document.createElement("style");
  styleEl.textContent = A4_CSS;
  wrapper.appendChild(styleEl);

  const content = document.createElement("div");
  content.innerHTML = buildA4Body(sale, items, installments, pdfShop, fmt, lang);
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  // Wait for images (logo) to load so they appear in the canvas
  const imgs = Array.from(wrapper.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if (img.complete) return Promise.resolve();
    return new Promise<void>(res => {
      img.onload = () => res();
      img.onerror = () => { img.style.display = "none"; res(); };
      setTimeout(() => res(), 2500);
    });
  }));
  // Give the browser a tick to apply layout
  await new Promise(r => setTimeout(r, 150));

  try {
    const target = wrapper.querySelector(".sheet") as HTMLElement;
    const canvas = await html2canvas(target, {
      scale: 2,
      useCORS: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: target.scrollWidth,
      windowHeight: target.scrollHeight,
    });

    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = 210;
    const pdfH = 297;
    const imgH = Math.min((canvas.height * pdfW) / canvas.width, pdfH);
    const imgData = canvas.toDataURL("image/jpeg", 0.95);

    pdf.addImage(imgData, "JPEG", 0, 0, pdfW, imgH);
    pdf.save(filename);
  } catch (err) {
    console.error("PDF generation failed:", err);
    alert("PDF তৈরি করা যায়নি — আবার চেষ্টা করুন।");
  } finally {
    wrapper.remove();
  }
}


// ---------- Chooser modal ----------
function showChooser(): Promise<"thermal" | "a4" | "pdf" | null> {
  return new Promise(resolve => {
    const overlay = document.createElement("div");
    overlay.style.cssText = "position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100000;display:flex;align-items:center;justify-content:center;animation:fadeIn .15s ease;font-family:'Hind Siliguli','Noto Sans Bengali','Segoe UI',Arial,sans-serif;padding:16px";
    overlay.innerHTML = `
      <div style="background:#fff;border-radius:16px;padding:22px;max-width:420px;width:100%;box-shadow:0 30px 80px -20px rgba(0,0,0,.4);animation:popIn .2s ease">
        <div style="text-align:center;margin-bottom:16px">
          <div style="font-size:18px;font-weight:800;color:#0f172a;margin-bottom:4px">প্রিন্ট অপশন নির্বাচন করুন</div>
          <div style="font-size:12px;color:#64748b">কোন ফরম্যাটে আপনি ক্যাশ মেমো চান?</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:10px">
          <button data-c="thermal" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px;background:linear-gradient(135deg,#0ea5e9,#0284c7);color:#fff;border:0;border-radius:12px;cursor:pointer;text-align:left;transition:transform .1s">
            <div style="font-size:24px">🖨️</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px">মিনি থার্মাল প্রিন্টার (৮০মিমি / ৫৮মিমি)</div>
              <div style="font-size:11px;opacity:.85">প্রিন্ট ডায়ালগে আপনার থার্মাল প্রিন্টার ও কাগজের সাইজ নির্বাচন করুন</div>
            </div>
          </button>
          <button data-c="a4" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px;background:linear-gradient(135deg,#1d4ed8,#1e40af);color:#fff;border:0;border-radius:12px;cursor:pointer;text-align:left;transition:transform .1s">
            <div style="font-size:24px">📄</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px">A4 পেজ প্রিন্ট</div>
              <div style="font-size:11px;opacity:.85">সম্পূর্ণ কিস্তি ও ওয়ারেন্টিসহ পেশাদার ইনভয়েস</div>
            </div>
          </button>
          <button data-c="pdf" style="display:flex;align-items:center;gap:12px;width:100%;padding:14px;background:linear-gradient(135deg,#dc2626,#b91c1c);color:#fff;border:0;border-radius:12px;cursor:pointer;text-align:left;transition:transform .1s">
            <div style="font-size:24px">⬇️</div>
            <div style="flex:1">
              <div style="font-weight:700;font-size:14px">PDF ডাউনলোড (A4)</div>
              <div style="font-size:11px;opacity:.85">ক্রেতাকে পাঠানোর জন্য PDF ফাইল</div>
            </div>
          </button>
          <button data-c="cancel" style="margin-top:4px;padding:10px;background:#f1f5f9;color:#475569;border:0;border-radius:10px;cursor:pointer;font-weight:600">বাতিল</button>
        </div>
      </div>
      <style>@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}</style>
    `;
    const close = (val: any) => { overlay.remove(); resolve(val); };
    overlay.addEventListener("click", e => {
      const t = e.target as HTMLElement;
      const btn = t.closest("button[data-c]") as HTMLButtonElement | null;
      if (btn) {
        const v = btn.dataset.c;
        close(v === "cancel" ? null : v);
      } else if (t === overlay) close(null);
    });
    document.body.appendChild(overlay);
  });
}

// ---------- Public API ----------
export async function printSale(opts: PrintSaleOptions) {
  const choice = await showChooser();
  if (!choice) return;

  const { sale, items, installments } = await loadSale(opts.saleId);
  if (!sale) { alert("ইনভয়েস পাওয়া যায়নি"); return; }
  const lang = opts.lang || "bn";

  if (choice === "thermal") {
    openHTMLInPrintWindow(buildThermalHTML(sale, items, installments, opts.shop, opts.fmt, lang));
  } else if (choice === "a4") {
    const printShop = { ...opts.shop, logo_url: await imageUrlToDataUrl(opts.shop.logo_url) };
    openHTMLInPrintWindow(buildA4Document(sale, items, installments, printShop, opts.fmt, lang, true));
  } else if (choice === "pdf") {
    await downloadPDF(sale, items, installments, opts.shop, opts.fmt, lang, `Invoice-${sale.invoice_no}.pdf`);
  }
}
