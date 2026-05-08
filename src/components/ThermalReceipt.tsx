import { forwardRef } from "react";

export type ThermalReceiptProps = {
  shop: {
    name: string;
    address?: string | null;
    phone?: string | null;
    logo_url?: string | null;
  };
  invoiceNo: string;
  createdAt: string | Date;
  cashier?: string;
  customer?: { name?: string | null; phone?: string | null } | null;
  items: { name: string; qty: number; unit_price: number; subtotal: number }[];
  subtotal: number;
  discount: number;
  vat?: number;
  total: number;
  paid: number;
  due: number;
  paymentType?: string;
  paymentMethod?: string;
  emi?: { count: number; amount: number; firstDue?: string } | null;
  fmt: (n: number) => string;
};

export const ThermalReceipt = forwardRef<HTMLDivElement, ThermalReceiptProps>((p, ref) => {
  const date = typeof p.createdAt === "string" ? new Date(p.createdAt) : p.createdAt;
  const dateStr = date.toLocaleString("bn-BD", { timeZone: "Asia/Dhaka", hour12: true });

  return (
    <div ref={ref} className="thermal-receipt mx-auto bg-white text-black" style={{ width: "80mm", padding: "4mm 3mm", fontFamily: "'Courier New', monospace", fontSize: "11px", lineHeight: 1.35 }}>
      {/* Header */}
      <div style={{ textAlign: "center", marginBottom: 6 }}>
        {p.shop.logo_url && (
          <img src={p.shop.logo_url} alt="" style={{ maxHeight: 40, margin: "0 auto 4px", display: "block" }} />
        )}
        <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: 0.5 }}>{p.shop.name}</div>
        {p.shop.address && <div style={{ fontSize: 10 }}>{p.shop.address}</div>}
        {p.shop.phone && <div style={{ fontSize: 10 }}>📞 {p.shop.phone}</div>}
        <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
        <div style={{ fontSize: 11, fontWeight: 700 }}>ক্যাশ মেমো / CASH MEMO</div>
      </div>

      {/* Meta */}
      <div style={{ fontSize: 10, marginBottom: 4 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>Invoice:</span><span style={{ fontWeight: 700 }}>{p.invoiceNo}</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span>তারিখ:</span><span>{dateStr}</span>
        </div>
        {p.cashier && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ক্যাশিয়ার:</span><span>{p.cashier}</span>
          </div>
        )}
        {p.customer?.name && (
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span>ক্রেতা:</span><span>{p.customer.name}{p.customer.phone ? ` · ${p.customer.phone}` : ""}</span>
          </div>
        )}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "4px 0" }} />

      {/* Items header */}
      <div style={{ display: "flex", fontSize: 10, fontWeight: 700, borderBottom: "1px solid #000", paddingBottom: 2 }}>
        <div style={{ flex: 1 }}>Item</div>
        <div style={{ width: 28, textAlign: "center" }}>Qty</div>
        <div style={{ width: 42, textAlign: "right" }}>Rate</div>
        <div style={{ width: 50, textAlign: "right" }}>Total</div>
      </div>

      {/* Items */}
      <div style={{ paddingTop: 3 }}>
        {p.items.map((it, i) => (
          <div key={i} style={{ display: "flex", fontSize: 10, padding: "2px 0", borderBottom: "1px dotted #ccc" }}>
            <div style={{ flex: 1, paddingRight: 4, wordBreak: "break-word" }}>{it.name}</div>
            <div style={{ width: 28, textAlign: "center" }}>{it.qty}</div>
            <div style={{ width: 42, textAlign: "right" }}>{p.fmt(it.unit_price)}</div>
            <div style={{ width: 50, textAlign: "right", fontWeight: 700 }}>{p.fmt(it.subtotal)}</div>
          </div>
        ))}
      </div>

      <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />

      {/* Totals */}
      <div style={{ fontSize: 11 }}>
        <Row label="Subtotal" value={p.fmt(p.subtotal)} />
        {!!p.vat && <Row label="VAT" value={p.fmt(p.vat)} />}
        {p.discount > 0 && <Row label="Discount" value={`- ${p.fmt(p.discount)}`} />}
        <div style={{ borderTop: "1px solid #000", margin: "3px 0" }} />
        <Row label="মোট / TOTAL" value={p.fmt(p.total)} bold size={13} />
        <Row label="Paid" value={p.fmt(p.paid)} />
        {p.due > 0 && <Row label="Due (বকেয়া)" value={p.fmt(p.due)} bold />}
        {p.paymentMethod && <Row label="Method" value={p.paymentMethod.toUpperCase()} />}
      </div>

      {/* EMI */}
      {p.emi && p.emi.count > 0 && (
        <>
          <div style={{ borderTop: "1px dashed #000", margin: "5px 0" }} />
          <div style={{ fontSize: 10, textAlign: "center", fontWeight: 700 }}>কিস্তি পরিকল্পনা</div>
          <Row label={`${p.emi.count} মাস × `} value={p.fmt(p.emi.amount)} />
          {p.emi.firstDue && <Row label="প্রথম তারিখ" value={p.emi.firstDue} />}
        </>
      )}

      {/* Footer */}
      <div style={{ borderTop: "1px dashed #000", margin: "6px 0" }} />
      <div style={{ textAlign: "center", fontSize: 10 }}>
        <div style={{ fontWeight: 700 }}>ধন্যবাদ — আবার আসবেন</div>
        <div style={{ fontSize: 9, marginTop: 2 }}>বিক্রয়কৃত পণ্য ফেরতযোগ্য নয়</div>
        <div style={{ fontSize: 9, marginTop: 4, opacity: 0.7 }}>Powered by সূর্য শপ</div>
      </div>
    </div>
  );
});
ThermalReceipt.displayName = "ThermalReceipt";

function Row({ label, value, bold, size }: { label: string; value: string; bold?: boolean; size?: number }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "1px 0", fontWeight: bold ? 800 : 400, fontSize: size ?? 11 }}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
