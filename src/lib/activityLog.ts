import { supabase } from "@/integrations/supabase/client";

/**
 * Fire-and-forget activity logger. Records what the current user did so an admin
 * can later audit per-staff history. Failures are silent — never break main flow.
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

    // Try to resolve staff_id via shop_users mapping (if any)
    // A user can be linked to many shops — pick any row that has a staff_id.
    let staff_id: string | null = null;
    try {
      const { data } = await supabase
        .from("shop_users")
        .select("staff_id")
        .eq("user_id", user.id)
        .not("staff_id", "is", null)
        .limit(1);
      staff_id = (data as any)?.[0]?.staff_id ?? null;
      if (!staff_id) {
        // Fallback to staff_access mapping
        const { data: sa } = await supabase
          .from("staff_access" as any)
          .select("staff_id")
          .eq("user_id", user.id)
          .limit(1);
        staff_id = (sa as any)?.[0]?.staff_id ?? null;
      }
    } catch { /* ignore */ }

    await supabase.from("staff_activity_logs" as any).insert({
      user_id: user.id,
      staff_id,
      shop_id: params.shop_id ?? null,
      action: params.action,
      entity_type: params.entity_type ?? null,
      entity_id: params.entity_id ?? null,
      meta: params.meta ?? {},
    });

    // Fire-and-forget Telegram notification
    try {
      const who = user.email || user.id.slice(0, 8);
      const time = new Date().toLocaleString("bn-BD", { dateStyle: "short", timeStyle: "short" });
      const entity = params.entity_type ? `\n📂 ${params.entity_type}` : "";
      const metaStr = params.meta && Object.keys(params.meta).length
        ? "\n" + Object.entries(params.meta).slice(0, 6)
            .map(([k, v]) => `• <b>${k}</b>: ${typeof v === "object" ? JSON.stringify(v) : String(v)}`)
            .join("\n")
        : "";
      const text = `🔔 <b>${params.action}</b>${entity}\n👤 ${who}\n🕐 ${time}${metaStr}`;
      supabase.functions.invoke("telegram-notify", { body: { text } }).catch(() => {});
    } catch { /* ignore */ }
  } catch {
    // swallow
  }
}
