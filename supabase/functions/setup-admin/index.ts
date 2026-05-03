import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { email, password, full_name } = await req.json();
    if (!email || !password) {
      return new Response(JSON.stringify({ error: "email and password required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // If user already exists, just (re)assign admin role and confirm
    const { data: list } = await admin.auth.admin.listUsers();
    const existing = list.users.find(u => u.email === email);

    let userId: string;
    if (existing) {
      userId = existing.id;
      await admin.auth.admin.updateUserById(userId, { password, email_confirm: true });
    } else {
      const { data, error } = await admin.auth.admin.createUser({
        email, password, email_confirm: true,
        user_metadata: { full_name: full_name ?? "Admin" },
      });
      if (error) throw error;
      userId = data.user!.id;
    }

    // Ensure admin role (idempotent)
    await admin.from("user_roles").upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    await admin.from("profiles").upsert({ user_id: userId, full_name: full_name ?? "Admin" }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ ok: true, user_id: userId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
