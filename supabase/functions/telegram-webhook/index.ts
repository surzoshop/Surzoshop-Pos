// Telegram webhook receiver. Handles /start <code> to link Telegram chat to user.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/telegram";

async function deriveSecret(apiKey: string): Promise<string> {
  const data = new TextEncoder().encode(`telegram-webhook:${apiKey}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function safeEqual(a: string | null, b: string): boolean {
  if (!a || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

async function tgSend(chatId: number, text: string) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY")!;
  await fetch(`${GATEWAY_URL}/sendMessage`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TELEGRAM_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  const TELEGRAM_API_KEY = Deno.env.get("TELEGRAM_API_KEY");
  if (!TELEGRAM_API_KEY) return new Response("Misconfigured", { status: 500 });

  const expected = await deriveSecret(TELEGRAM_API_KEY);
  if (!safeEqual(req.headers.get("X-Telegram-Bot-Api-Secret-Token"), expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const update = await req.json();
  const msg = update.message ?? update.edited_message;
  const chatId: number | undefined = msg?.chat?.id;
  const text: string = msg?.text ?? "";
  if (!chatId) return new Response(JSON.stringify({ ok: true }));

  try {
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const code = parts[1]?.trim();
      if (code) {
        const { data: link } = await supabase
          .from("telegram_link_codes")
          .select("user_id, expires_at, used")
          .eq("code", code)
          .maybeSingle();

        if (!link) {
          await tgSend(chatId, "❌ ভুল কোড। অ্যাপ থেকে নতুন কোড নিন।");
        } else if (link.used || new Date(link.expires_at) < new Date()) {
          await tgSend(chatId, "⏰ কোডের মেয়াদ শেষ। নতুন কোড নিন।");
        } else {
          await supabase.from("telegram_subscribers").upsert({
            user_id: link.user_id,
            chat_id: chatId,
            username: msg.from?.username ?? null,
            first_name: msg.from?.first_name ?? null,
            is_active: true,
            notify_all: true,
          }, { onConflict: "chat_id" });

          await supabase.from("telegram_link_codes").update({ used: true }).eq("code", code);
          await tgSend(chatId, "✅ <b>সফলভাবে সংযুক্ত হয়েছে!</b>\n\nএখন থেকে সকল অ্যাকশনের নোটিফিকেশন এখানে পাবেন।");
        }
      } else {
        await tgSend(chatId, "👋 স্বাগতম!\n\nঅ্যাকাউন্ট সংযুক্ত করতে অ্যাপের <b>Telegram Settings</b> পেজে যান এবং সেখানের কোডটি দিয়ে আবার /start করুন।");
      }
    } else if (text === "/stop") {
      await supabase.from("telegram_subscribers")
        .update({ is_active: false })
        .eq("chat_id", chatId);
      await tgSend(chatId, "🔕 নোটিফিকেশন বন্ধ করা হলো।");
    } else if (text === "/status") {
      const { data } = await supabase.from("telegram_subscribers")
        .select("is_active, first_name").eq("chat_id", chatId).maybeSingle();
      await tgSend(chatId, data
        ? `📊 স্ট্যাটাস: ${data.is_active ? "✅ Active" : "🔕 Paused"}`
        : "❌ এই চ্যাট কোনো অ্যাকাউন্টের সাথে যুক্ত নেই।");
    } else {
      await tgSend(chatId, "Commands:\n/start &lt;code&gt; — সংযুক্ত করুন\n/stop — নোটিফিকেশন বন্ধ\n/status — স্ট্যাটাস দেখুন");
    }
  } catch (e) {
    console.error("webhook error", e);
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
