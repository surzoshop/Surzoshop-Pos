import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

export type ExportProduct = {
  name: string;
  category?: string;
  barcode?: string | null;
  sku?: string | null;
  cost: number;
  price: number;
  stock: number;
  unit?: string | null;
};

const fmtBDT = (n: number) => `৳${Number(n || 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;

export async function exportProductsToExcel(products: ExportProduct[], opts?: { shopName?: string; isAdmin?: boolean }) {
  const isAdmin = opts?.isAdmin ?? true;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Easy Kisti Shop";
  wb.created = new Date();
  const ws = wb.addWorksheet("পণ্য তালিকা", {
    views: [{ state: "frozen", ySplit: 4 }],
    pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 } },
  });

  const cols = [
    { header: "ক্রঃ", key: "sl", width: 6 },
    { header: "পণ্যের নাম", key: "name", width: 32 },
    { header: "ক্যাটাগরি", key: "category", width: 18 },
    { header: "বারকোড", key: "barcode", width: 18 },
    { header: "SKU", key: "sku", width: 14 },
    ...(isAdmin ? [{ header: "ক্রয় মূল্য", key: "cost", width: 14 }] : []),
    { header: "বিক্রয় মূল্য", key: "price", width: 14 },
    { header: "স্টক", key: "stock", width: 10 },
    { header: "একক", key: "unit", width: 10 },
    { header: "মোট মূল্য", key: "total", width: 16 },
  ];
  ws.columns = cols as any;

  // Title row
  const lastColLetter = ws.getColumn(cols.length).letter;
  ws.mergeCells(`A1:${lastColLetter}1`);
  const title = ws.getCell("A1");
  title.value = `${opts?.shopName ?? "পণ্য তালিকা"} — Product Inventory Report`;
  title.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  title.alignment = { horizontal: "center", vertical: "middle" };
  title.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
  ws.getRow(1).height = 28;

  // Subtitle
  ws.mergeCells(`A2:${lastColLetter}2`);
  const sub = ws.getCell("A2");
  const today = new Date().toLocaleDateString("en-GB");
  sub.value = `তারিখ: ${today}     |     মোট পণ্য: ${products.length}`;
  sub.font = { name: "Calibri", size: 11, italic: true, color: { argb: "FF334155" } };
  sub.alignment = { horizontal: "center", vertical: "middle" };
  sub.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
  ws.getRow(2).height = 20;

  // Spacer
  ws.getRow(3).height = 6;

  // Header row at row 4
  const headerRow = ws.getRow(4);
  headerRow.values = cols.map(c => c.header);
  headerRow.eachCell(cell => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF134E4A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FF0F766E" } },
      left: { style: "thin", color: { argb: "FF0F766E" } },
      bottom: { style: "medium", color: { argb: "FF0F766E" } },
      right: { style: "thin", color: { argb: "FF0F766E" } },
    };
  });
  headerRow.height = 26;

  // Data rows
  let totalCost = 0, totalPrice = 0, totalStock = 0, totalValue = 0;
  products.forEach((p, idx) => {
    const stockVal = Number(p.stock || 0) * Number(p.price || 0);
    totalCost += Number(p.cost || 0) * Number(p.stock || 0);
    totalPrice += Number(p.price || 0);
    totalStock += Number(p.stock || 0);
    totalValue += stockVal;

    const rowData: any = {
      sl: idx + 1,
      name: p.name,
      category: p.category ?? "—",
      barcode: p.barcode ?? "—",
      sku: p.sku ?? "—",
      price: Number(p.price || 0),
      stock: Number(p.stock || 0),
      unit: p.unit ?? "pcs",
      total: stockVal,
    };
    if (isAdmin) rowData.cost = Number(p.cost || 0);

    const row = ws.addRow(rowData);
    const isAlt = idx % 2 === 1;
    row.eachCell((cell, colNumber) => {
      cell.font = { name: "Calibri", size: 10, color: { argb: "FF1E293B" } };
      cell.alignment = { vertical: "middle", horizontal: colNumber === 2 ? "left" : "center", wrapText: true };
      if (isAlt) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0FDFA" } };
      cell.border = {
        top: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } },
      };
    });
    // Stock badge color
    const stockCell = row.getCell("stock");
    if (Number(p.stock) === 0) {
      stockCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEE2E2" } };
      stockCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFB91C1C" } };
    } else if (Number(p.stock) <= 2) {
      stockCell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFEF3C7" } };
      stockCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FFB45309" } };
    } else {
      stockCell.font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF15803D" } };
    }
    // Currency format
    if (isAdmin) row.getCell("cost").numFmt = '"৳"#,##0.00';
    row.getCell("price").numFmt = '"৳"#,##0.00';
    row.getCell("total").numFmt = '"৳"#,##0.00';
    row.getCell("name").font = { name: "Calibri", size: 10, bold: true, color: { argb: "FF0F172A" } };
    row.height = 22;
  });

  // Total row
  const totalRow = ws.addRow({
    sl: "",
    name: "মোট (Total)",
    category: "",
    barcode: "",
    sku: "",
    ...(isAdmin ? { cost: totalCost } : {}),
    price: "",
    stock: totalStock,
    unit: "",
    total: totalValue,
  });
  totalRow.eachCell(cell => {
    cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } };
    cell.alignment = { vertical: "middle", horizontal: "center" };
    cell.border = {
      top: { style: "medium", color: { argb: "FF0F766E" } },
      left: { style: "thin", color: { argb: "FF0F766E" } },
      bottom: { style: "medium", color: { argb: "FF0F766E" } },
      right: { style: "thin", color: { argb: "FF0F766E" } },
    };
  });
  if (isAdmin) totalRow.getCell("cost").numFmt = '"৳"#,##0.00';
  totalRow.getCell("total").numFmt = '"৳"#,##0.00';
  totalRow.height = 26;

  // Auto filter
  ws.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: cols.length } };

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const fname = `product-list-${new Date().toISOString().slice(0, 10)}.xlsx`;
  saveAs(blob, fname);
}
