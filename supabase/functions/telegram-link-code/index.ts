// Creates a one-time link code for the authenticated user and returns
// the bot username so the client can build a deeplink to start the bot.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Generate 8-char alnum code
    const code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[b % 32]).join("");

    await supabase.from("telegram_link_codes").insert({ code, user_id: user.id });

    // Fetch bot username
    let botUsername: string | null = null;
    try {
      const r = await fetch(`${GATEWAY_URL}/getMe`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${Deno.env.get("LOVABLE_API_KEY")}`,
          "X-Connection-Api-Key": Deno.env.get("TELEGRAM_API_KEY")!,
          "Content-Type": "application/json",
        },
        body: "{}",
      });
      const j = await r.json();
      botUsername = j?.result?.username ?? null;
    } catch (e) { console.error("getMe", e); }

    return new Response(JSON.stringify({
      code,
      bot_username: botUsername,
      deeplink: botUsername ? `https://t.me/${botUsername}?start=${code}` : null,
      expires_in_minutes: 15,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: corsHeaders });
  }
});
