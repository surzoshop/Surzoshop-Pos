import { supabase } from "@/integrations/supabase/client";

// Friendly Bangla labels + emoji for known actions → shown in Telegram
const ACTION_LABELS: Record<string, { emoji: string; label: string }> = {
  "sale.create":         { emoji: "🛒", label: "নতুন বিক্রয়" },
  "sale.update":         { emoji: "✏️", label: "বিক্রয় সম্পাদনা" },
  "sale.delete":         { emoji: "🗑️", label: "বিক্রয় মুছে ফেলা" },
  "sale.return":         { emoji: "↩️", label: "বিক্রয় ফেরত" },
  "installment.create":  { emoji: "📅", label: "নতুন কিস্তি প্ল্যান" },
  "installment.pay":     { emoji: "💵", label: "কিস্তি গ্রহণ" },
  "installment.edit":    { emoji: "✏️", label: "কিস্তি সম্পাদনা" },
  "installment.delete":  { emoji: "🗑️", label: "কিস্তি মুছে ফেলা" },
  "product.create":      { emoji: "➕", label: "নতুন পণ্য" },
  "product.update":      { emoji: "✏️", label: "পণ্য সম্পাদনা" },
  "product.delete":      { emoji: "🗑️", label: "পণ্য মুছে ফেলা" },
  "category.create":     { emoji: "🏷️", label: "নতুন ক্যাটেগরি" },
  "category.update":     { emoji: "✏️", label: "ক্যাটেগরি সম্পাদনা" },
  "category.delete":     { emoji: "🗑️", label: "ক্যাটেগরি মুছে ফেলা" },
  "stock.adjust":        { emoji: "📦", label: "স্টক সমন্বয়" },
  "customer.create":     { emoji: "👤", label: "নতুন কাস্টমার" },
  "customer.update":     { emoji: "✏️", label: "কাস্টমার সম্পাদনা" },
  "purchase.create":     { emoji: "🛍️", label: "নতুন ক্রয়" },
  "purchase.pay":        { emoji: "💵", label: "সরবরাহকারী পেমেন্ট" },
  "expense.create":      { emoji: "💸", label: "নতুন খরচ" },
  "auth.login":          { emoji: "🔐", label: "লগইন" },
  "auth.logout":         { emoji: "🚪", label: "লগআউট" },
  "staff.create":        { emoji: "👨‍💼", label: "নতুন স্টাফ" },
  "staff.update":        { emoji: "✏️", label: "স্টাফ সম্পাদনা" },
};

const META_LABELS: Record<string, string> = {
  amount: "💰 পরিমাণ",
  total: "💰 মোট",
  invoice_no: "🧾 ইনভয়েস",
  customer_name: "👤 কাস্টমার",
  product_name: "📦 পণ্য",
  qty: "🔢 পরিমাণ",
  tenure_months: "📅 মেয়াদ (মাস)",
  payment_method: "💳 পেমেন্ট",
  reason: "📝 কারণ",
  note: "📝 নোট",
};

const fmtVal = (k: string, v: any) => {
  if (k === "amount" || k === "total") return "৳ " + Number(v || 0).toLocaleString("en-IN");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
};

/**
 * Fire-and-forget activity logger. Records what the current user did so an admin
 * can later audit per-staff history. Also pushes a nicely formatted notification
 * to all linked Telegram subscribers. Failures are silent — never break main flow.
 */
export async function logActivity(params: {
  action: string;
  entity_type?: string;
  entity_id?: string | null;
  shop_id?: string | null;
  meta?: Record<string, any>;
}) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Resolve staff_id + display name via shop_users / staff_access
    let staff_id: string | null = null;
    let display_name: string | null = null;
    try {
      const { data } = await supabase
        .from("shop_users")
        .select("staff_id, display_name")
        .eq("user_id", user.id)
        .not("staff_id", "is", null)
        .limit(1);
      staff_id = (data as any)?.[0]?.staff_id ?? null;
      display_name = (data as any)?.[0]?.display_name ?? null;
      if (!staff_id) {
        const { data: sa } = await supabase
          .from("staff_access" as any)
          .select("staff_id")
          .eq("user_id", user.id)
          .limit(1);
        staff_id = (sa as any)?.[0]?.staff_id ?? null;
      }
    } catch { /* ignore */ }

    if (!display_name) {
      const { data: prof } = await supabase
        .from("profiles").select("full_name").eq("user_id", user.id).maybeSingle();
      display_name = (prof as any)?.full_name ?? user.email ?? "User";
    }

    await supabase.from("staff_activity_logs" as any).insert({
      user_id: user.id,
      staff_id,
      shop_id: params.shop_id ?? null,
      action: params.action,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      meta: params.meta ?? {},
    });

    // Telegram notification — fire and forget
    try {
      const info = ACTION_LABELS[params.action] ?? { emoji: "🔔", label: params.action };
      const role = staff_id ? "👨‍💼 Staff" : "👑 Admin";
      const time = new Date().toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
      const metaLines = params.meta
        ? Object.entries(params.meta)
            .filter(([_, v]) => v !== null && v !== undefined && v !== "")
            .slice(0, 8)
            .map(([k, v]) => `${META_LABELS[k] ?? "•  " + k}: <b>${fmtVal(k, v)}</b>`)
            .join("\n")
        : "";

      const text = [
        `${info.emoji} <b>${info.label}</b>`,
        `${role}: <b>${display_name}</b>`,
        `🕐 ${time}`,
        metaLines ? "\n" + metaLines : "",
      ].filter(Boolean).join("\n");

      supabase.functions.invoke("telegram-notify", { body: { text } }).catch(() => {});
    } catch { /* ignore */ }
  } catch {
    // swallow
  }
}
