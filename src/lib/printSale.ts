// Unified Sale print/PDF utility
// Offers 3 output formats: 58mm thermal mini-printer, A4 print, A4 PDF download.
// Includes warranty info + full installment schedule (date + amount).

import { supabase } from "@/integrations/supabase/client";
import html2pdf from "html2pdf.js";

type Shop = { name?: string | null; address?: string | null; phone?: string | null; logo_url?: string | null };

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

async function loadSale(saleId: string) {
  const [{ data: sale }, { data: items }, { data: installments }] = await Promise.all([
    supabase.from("sales").select("*, customers(name, phone, address)").eq("id", saleId).maybeSingle(),
    supabase.from("sale_items").select("*").eq("sale_id", saleId).order("created_at", { ascending: true }),
    supabase.from("installments").select("*").eq("sale_id", saleId).order("installment_no", { ascending: true }),
  ]);
  return { sale, items: items ?? [], installments: installments ?? [] };
}

// ---------- 58mm thermal ----------
function buildThermalHTML(sale: any, items: any[], installments: any[], shop: Shop, fmt: (n: number) => string, lang: "bn" | "en") {
  const dateStr = fmtBDDateTime(sale.created_at, lang);
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
      @page{size:58mm auto;margin:2mm}
      @media print{body{margin:0}}
      body{font-family:'Courier New',monospace;font-size:11px;color:#000;width:54mm;margin:0 auto;padding:3px}
      .c{text-align:center}.r{text-align:right}.b{font-weight:700}
      table{width:100%;border-collapse:collapse;font-size:10px}
      th,td{padding:2px 0}
      .dash{border-top:1px dashed #000;margin:4px 0}
      .solid{border-top:1px solid #000;margin:4px 0}
      h1{font-size:13px;margin:0;font-weight:800}
      .small{font-size:9px}
    </style></head><body>
    <div class="c">
      ${shop.logo_url ? `<img src="${shop.logo_url}" style="max-height:36px" onerror="this.style.display='none'"/>` : ""}
      <h1>${escapeHtml(shop.name || "Shop")}</h1>
      ${shop.address ? `<div class="small">${escapeHtml(shop.address)}</div>` : ""}
      ${shop.phone ? `<div class="small">📞 ${escapeHtml(shop.phone)}</div>` : ""}
      <div class="dash"></div>
      <div class="b">ক্যাশ মেমো</div>
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
    <div style="display:flex;justify-content:space-between"><span>Subtotal</span><span>${fmt(Number(sale.subtotal))}</span></div>
    ${Number(sale.discount) > 0 ? `<div style="display:flex;justify-content:space-between"><span>Discount</span><span>- ${fmt(Number(sale.discount))}</span></div>` : ""}
    <div class="solid"></div>
    <div style="display:flex;justify-content:space-between;font-size:13px" class="b"><span>মোট</span><span>${fmt(Number(sale.total))}</span></div>
    <div style="display:flex;justify-content:space-between"><span>Paid</span><span>${fmt(Number(sale.paid))}</span></div>
    ${Number(sale.due) > 0 ? `<div style="display:flex;justify-content:space-between" class="b"><span>বকেয়া</span><span>${fmt(Number(sale.due))}</span></div>` : ""}
    ${instRows}
    <div class="dash"></div>
    <div class="c small">
      <div class="b">ধন্যবাদ — আবার আসবেন</div>
      <div style="margin-top:2px">বিক্রয়কৃত পণ্য ফেরতযোগ্য নয়</div>
    </div>
    <script>window.addEventListener('load',()=>setTimeout(()=>{try{window.focus();window.print();}catch(e){}},300));<\/script>
    </body></html>`;
}

// ---------- A4 layout (used for both Print + PDF) ----------
function buildA4HTML(sale: any, items: any[], installments: any[], shop: Shop, fmt: (n: number) => string, lang: "bn" | "en", autoPrint: boolean) {
  const dateStr = fmtBDDateTime(sale.created_at, lang);
  const warrantyItems = items.filter((i: any) => i.warranty_until);

  const itemRows = items.map((it: any, idx: number) => `
    <tr>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${idx + 1}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb">
        <div style="font-weight:600;color:#111827">${escapeHtml(it.product_name)}</div>
        ${it.warranty_until ? `<div style="font-size:11px;color:#0f766e;margin-top:2px">⛨ ওয়ারেন্টি ${it.warranty_months || ""} মাস — মেয়াদ ${fmtBDDate(it.warranty_until, lang)}</div>` : ""}
      </td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:center">${it.qty}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right">${fmt(Number(it.unit_price))}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${fmt(Number(it.subtotal))}</td>
    </tr>`).join("");

  const installmentSection = installments.length ? `
    <div style="margin-top:18px">
      <h3 style="font-size:14px;font-weight:700;color:#111827;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #1d4ed8">কিস্তি সময়সূচি / Installment Schedule</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#f1f5f9;color:#0f172a">
            <th style="padding:8px 10px;text-align:center;border:1px solid #cbd5e1">কিস্তি নং</th>
            <th style="padding:8px 10px;text-align:left;border:1px solid #cbd5e1">পরিশোধের তারিখ</th>
            <th style="padding:8px 10px;text-align:right;border:1px solid #cbd5e1">কিস্তির পরিমাণ</th>
            <th style="padding:8px 10px;text-align:right;border:1px solid #cbd5e1">পরিশোধিত</th>
            <th style="padding:8px 10px;text-align:center;border:1px solid #cbd5e1">অবস্থা</th>
          </tr>
        </thead>
        <tbody>
          ${installments.map(i => `<tr>
            <td style="padding:7px 10px;text-align:center;border:1px solid #e2e8f0">${i.installment_no}</td>
            <td style="padding:7px 10px;border:1px solid #e2e8f0">${fmtBDDate(i.due_date, lang)}</td>
            <td style="padding:7px 10px;text-align:right;border:1px solid #e2e8f0;font-weight:700">${fmt(Number(i.amount))}</td>
            <td style="padding:7px 10px;text-align:right;border:1px solid #e2e8f0">${fmt(Number(i.paid_amount || 0))}</td>
            <td style="padding:7px 10px;text-align:center;border:1px solid #e2e8f0">
              <span style="display:inline-block;padding:2px 8px;border-radius:10px;font-size:10px;font-weight:700;background:${i.status === "paid" ? "#dcfce7" : "#fef3c7"};color:${i.status === "paid" ? "#166534" : "#92400e"}">
                ${i.status === "paid" ? "পরিশোধিত" : "বকেয়া"}
              </span>
            </td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  const warrantySection = warrantyItems.length ? `
    <div style="margin-top:18px">
      <h3 style="font-size:14px;font-weight:700;color:#111827;margin:0 0 8px;padding-bottom:6px;border-bottom:2px solid #0f766e">ওয়ারেন্টি তথ্য / Warranty</h3>
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead>
          <tr style="background:#ecfdf5;color:#064e3b">
            <th style="padding:8px 10px;text-align:left;border:1px solid #a7f3d0">পণ্য</th>
            <th style="padding:8px 10px;text-align:center;border:1px solid #a7f3d0">মেয়াদ</th>
            <th style="padding:8px 10px;text-align:center;border:1px solid #a7f3d0">শেষ তারিখ</th>
          </tr>
        </thead>
        <tbody>
          ${warrantyItems.map((it: any) => `<tr>
            <td style="padding:7px 10px;border:1px solid #d1fae5">${escapeHtml(it.product_name)}</td>
            <td style="padding:7px 10px;text-align:center;border:1px solid #d1fae5">${it.warranty_months || ""} মাস</td>
            <td style="padding:7px 10px;text-align:center;border:1px solid #d1fae5;font-weight:700">${fmtBDDate(it.warranty_until, lang)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>` : "";

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${sale.invoice_no}</title>
    <style>
      @page{size:A4;margin:12mm}
      @media print{body{margin:0}}
      *{box-sizing:border-box}
      body{font-family:'Hind Siliguli','Noto Sans Bengali','Segoe UI',Arial,sans-serif;color:#111827;margin:0;background:#fff;font-size:12px;line-height:1.45}
      .sheet{max-width:186mm;margin:0 auto;padding:6mm}
      .head{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px double #1d4ed8;padding-bottom:14px;margin-bottom:18px}
      .brand{display:flex;gap:12px;align-items:center}
      .brand img{max-height:60px;max-width:90px;object-fit:contain}
      .brand h1{margin:0;font-size:22px;color:#1e3a8a;letter-spacing:.3px}
      .brand .meta{font-size:11px;color:#475569;margin-top:2px}
      .invbox{text-align:right}
      .invbox .label{font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:1px}
      .invbox .no{font-size:18px;font-weight:800;color:#1d4ed8}
      .grid2{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
      .card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px}
      .card h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#64748b;font-weight:700}
      .card .row{display:flex;justify-content:space-between;font-size:12px;padding:2px 0}
      .card .row span:first-child{color:#475569}
      .card .row span:last-child{font-weight:600;color:#0f172a}
      table.items{width:100%;border-collapse:collapse;font-size:12px;border:1px solid #cbd5e1}
      table.items thead{background:linear-gradient(135deg,#1d4ed8,#2563eb);color:#fff}
      table.items th{padding:9px 10px;text-align:left;font-weight:700;font-size:11px;letter-spacing:.4px}
      .totals{margin-top:14px;display:flex;justify-content:flex-end}
      .totals table{border-collapse:collapse;min-width:280px}
      .totals td{padding:6px 12px;font-size:12px}
      .totals .lbl{color:#475569;text-align:left}
      .totals .val{text-align:right;font-weight:700;color:#0f172a}
      .totals .grand{background:#1d4ed8;color:#fff;font-size:14px;font-weight:800}
      .totals .due{background:#fee2e2;color:#991b1b;font-weight:800}
      .signs{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
      .sig{text-align:center;font-size:11px;color:#475569;border-top:1px solid #94a3b8;padding-top:6px}
      .footer{margin-top:24px;text-align:center;font-size:10px;color:#94a3b8;border-top:1px dashed #cbd5e1;padding-top:8px}
    </style></head><body>
    <div class="sheet">
      <div class="head">
        <div class="brand">
          ${shop.logo_url ? `<img src="${shop.logo_url}" onerror="this.style.display='none'"/>` : ""}
          <div>
            <h1>${escapeHtml(shop.name || "Shop")}</h1>
            ${shop.address ? `<div class="meta">${escapeHtml(shop.address)}</div>` : ""}
            ${shop.phone ? `<div class="meta">📞 ${escapeHtml(shop.phone)}</div>` : ""}
          </div>
        </div>
        <div class="invbox">
          <div class="label">Invoice / ক্যাশ মেমো</div>
          <div class="no">${sale.invoice_no}</div>
          <div class="meta" style="font-size:11px;color:#64748b;margin-top:4px">${dateStr}</div>
        </div>
      </div>

      <div class="grid2">
        <div class="card">
          <h4>ক্রেতা / Customer</h4>
          <div class="row"><span>নাম</span><span>${escapeHtml(sale.customers?.name || "—")}</span></div>
          <div class="row"><span>ফোন</span><span>${escapeHtml(sale.customers?.phone || "—")}</span></div>
          ${sale.customers?.address ? `<div class="row"><span>ঠিকানা</span><span style="max-width:60%;text-align:right">${escapeHtml(sale.customers.address)}</span></div>` : ""}
        </div>
        <div class="card">
          <h4>পেমেন্ট</h4>
          <div class="row"><span>ধরন</span><span>${sale.payment_type === "installment" ? "কিস্তি" : sale.payment_type === "due" ? "বাকি" : "নগদ"}</span></div>
          ${sale.payment_method ? `<div class="row"><span>মাধ্যম</span><span>${String(sale.payment_method).toUpperCase()}</span></div>` : ""}
          <div class="row"><span>অবস্থা</span><span>${Number(sale.due) === 0 ? "সম্পূর্ণ পরিশোধিত" : "আংশিক / বকেয়া"}</span></div>
        </div>
      </div>

      <table class="items">
        <thead>
          <tr>
            <th style="width:40px;text-align:center">#</th>
            <th>পণ্যের বিবরণ</th>
            <th style="width:60px;text-align:center">পরিমাণ</th>
            <th style="width:90px;text-align:right">দর</th>
            <th style="width:110px;text-align:right">মোট</th>
          </tr>
        </thead>
        <tbody>${itemRows}</tbody>
      </table>

      <div class="totals">
        <table>
          <tr><td class="lbl">Subtotal</td><td class="val">${fmt(Number(sale.subtotal))}</td></tr>
          ${Number(sale.discount) > 0 ? `<tr><td class="lbl">Discount</td><td class="val">- ${fmt(Number(sale.discount))}</td></tr>` : ""}
          <tr class="grand"><td class="lbl" style="color:#fff">মোট / TOTAL</td><td class="val" style="color:#fff">${fmt(Number(sale.total))}</td></tr>
          <tr><td class="lbl">পরিশোধিত</td><td class="val">${fmt(Number(sale.paid))}</td></tr>
          ${Number(sale.due) > 0 ? `<tr class="due"><td class="lbl" style="color:#991b1b">বকেয়া (Due)</td><td class="val" style="color:#991b1b">${fmt(Number(sale.due))}</td></tr>` : ""}
        </table>
      </div>

      ${warrantySection}
      ${installmentSection}

      <div class="signs">
        <div class="sig">ক্রেতার স্বাক্ষর</div>
        <div class="sig">অনুমোদনকারীর স্বাক্ষর</div>
      </div>
      <div class="footer">ধন্যবাদ — আবার আসবেন · বিক্রয়কৃত পণ্য ফেরতযোগ্য নয়</div>
    </div>
    ${autoPrint ? `<script>window.addEventListener('load',()=>setTimeout(()=>{try{window.focus();window.print();}catch(e){}},400));<\/script>` : ""}
    </body></html>`;
}

function escapeHtml(s: any): string {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function openHTMLInPrintWindow(html: string) {
  const w = window.open("", "_blank");
  if (w && !w.closed) {
    w.document.open(); w.document.write(html); w.document.close();
    return;
  }
  // fallback: hidden iframe
  const old = document.getElementById("__print_iframe"); if (old) old.remove();
  const iframe = document.createElement("iframe");
  iframe.id = "__print_iframe";
  Object.assign(iframe.style, { position: "fixed", right: "0", bottom: "0", width: "0", height: "0", border: "0" });
  document.body.appendChild(iframe);
  const idoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!idoc) return;
  idoc.open(); idoc.write(html); idoc.close();
  setTimeout(() => { try { iframe.contentWindow?.focus(); iframe.contentWindow?.print(); } catch {} }, 500);
}

async function downloadPDF(html: string, filename: string) {
  // Render HTML in a hidden container then convert to PDF
  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.width = "210mm";
  wrapper.style.background = "#fff";
  // Strip script tags so html2pdf doesn't re-trigger print
  wrapper.innerHTML = html.replace(/<script[\s\S]*?<\/script>/gi, "");
  document.body.appendChild(wrapper);
  try {
    await (html2pdf() as any)
      .set({
        margin: 0,
        filename,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff" },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["css", "legacy"] },
      })
      .from(wrapper)
      .save();
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
              <div style="font-weight:700;font-size:14px">মিনি থার্মাল প্রিন্টার (৫৮ মিমি)</div>
              <div style="font-size:11px;opacity:.85">ছোট রসিদ প্রিন্টারের জন্য (POS-58)</div>
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
    openHTMLInPrintWindow(buildA4HTML(sale, items, installments, opts.shop, opts.fmt, lang, true));
  } else if (choice === "pdf") {
    await downloadPDF(buildA4HTML(sale, items, installments, opts.shop, opts.fmt, lang, false), `Invoice-${sale.invoice_no}.pdf`);
  }
}
