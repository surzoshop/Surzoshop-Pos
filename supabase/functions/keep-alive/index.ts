// Keep-alive function: pings the database to prevent Supabase pause due to inactivity.
// Scheduled via pg_cron to run every 3 days.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Lightweight read to register database activity
    const { error: shopErr } = await supabase
      .from("shops")
      .select("id", { count: "exact", head: true })
      .limit(1);

    const { error: prodErr } = await supabase
      .from("products")
      .select("id", { count: "exact", head: true })
      .limit(1);

    const ts = new Date().toISOString();
    console.log(`[keep-alive] ping ok @ ${ts}`, { shopErr, prodErr });

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: ts,
        message: "Database activity registered. Project will not be paused.",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[keep-alive] error:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
