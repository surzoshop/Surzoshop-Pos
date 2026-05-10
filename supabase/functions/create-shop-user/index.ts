import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Phone -> synthetic email mapping so Supabase Auth (email/password) can be used,
// but the staff user logs in using their phone + password.
function phoneToEmail(phone: string): string {
  const digits = String(phone).replace(/\D+/g, "");
  return `${digits}@staff.local`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supaUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supaUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const admin = createClient(supaUrl, serviceKey);
    const { data: isSA } = await admin.rpc("is_super_admin", { _user_id: user.id });
    if (!isSA) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { phone, email: emailRaw, password, full_name, shop_id, permissions, staff_id } = body;
    if ((!phone && !emailRaw) || !password) {
      return new Response(JSON.stringify({ error: "phone & password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const digits = phone ? String(phone).replace(/\D+/g, "") : "";
    if (phone && digits.length < 6) {
      return new Response(JSON.stringify({ error: "valid phone required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const email = emailRaw ?? phoneToEmail(phone);

    // Try create user; if exists, fetch
    let userId: string | null = null;
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name ?? phone ?? email, phone: digits || undefined, login_phone: digits || undefined },
    });
    if (cErr) {
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (!found) throw cErr;
      userId = found.id;
      // update password for existing
      await admin.auth.admin.updateUserById(userId, { password, user_metadata: { full_name: full_name ?? phone, phone: digits, login_phone: digits } });
    } else {
      userId = created.user!.id;
    }

    // Ensure 'staff' role
    await admin.from("user_roles").upsert({ user_id: userId, role: "staff" }, { onConflict: "user_id,role" });

    // Store shop-independent staff access. Trigger will fan out to shop_users
    // for every existing active shop, and any future shop will pick this up.
    const { error: saErr } = await admin.from("staff_access").upsert({
      user_id: userId,
      staff_id: staff_id ?? null,
      login_identifier: phone ?? email,
      permissions: permissions ?? {},
      is_active: true,
    }, { onConflict: "user_id" });
    if (saErr) throw saErr;

    // Optionally also link directly to a specific shop if provided.
    if (shop_id) {
      const { error: suErr } = await admin.from("shop_users").upsert({
        user_id: userId, shop_id, staff_id: staff_id ?? null,
        display_name: full_name ?? phone ?? email,
        email: phone ?? email,
        permissions: permissions ?? {}, is_active: true,
      }, { onConflict: "user_id,shop_id" });
      if (suErr) throw suErr;
    }

    return new Response(JSON.stringify({ ok: true, user_id: userId, login_phone: digits }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
