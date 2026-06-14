// Telegram webhook receiver. Handles /start, commands, and on-demand reports.
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
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}

const fmt = (n: number) => "৳ " + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });
const nowBn = () => new Date().toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });

function welcomeMessage(name?: string | null): string {
  return [
    "🎉 <b>স্বাগতম, সূর্য Shop-এ!</b>",
    "",
    `👋 হ্যালো${name ? " " + name : ""}, আমি আপনার সাথে সফলভাবে <b>সংযুক্ত</b> আছি।`,
    "",
    "✅ <b>System Status:</b> 🟢 Online",
    "📡 <b>Connection:</b> Active",
    `🕐 <b>Server Time:</b> ${nowBn()}`,
    "",
    "এখন থেকে আপনার দোকানের সকল কার্যক্রম — বিক্রয়, কিস্তি, stock, edit, login সহ যাবতীয় activity — আমি সরাসরি এখানে notification আকারে পাঠাবো।",
    "",
    "📋 <b>Available Commands:</b>",
    "/today — আজকের বিক্রয় report",
    "/yesterday — গতকালের report",
    "/week — সর্বশেষ ৭ দিনের report",
    "/month — চলতি মাসের report",
    "/due — বকেয়া কাস্টমার তালিকা",
    "/stock — কম stock-এর পণ্য",
    "/status — সংযোগের অবস্থা",
    "/stop — notification বন্ধ",
    "",
    "<i>সবকিছু professionally সাজিয়ে দেওয়া আছে। যেকোনো সময় report চাইতে পারেন।</i>",
  ].join("\n");
}

async function getUserIdForChat(supabase: any, chatId: number): Promise<string | null> {
  const { data } = await supabase.from("telegram_subscribers")
    .select("user_id").eq("chat_id", chatId).eq("is_active", true).maybeSingle();
  return data?.user_id ?? null;
}

async function reportSales(supabase: any, chatId: number, fromISO: string, toISO: string, title: string) {
  const userId = await getUserIdForChat(supabase, chatId);
  if (!userId) {
    await tgSend(chatId, "❌ এই chat কোনো অ্যাকাউন্টের সাথে যুক্ত নেই। অ্যাপ থেকে link code নিন।");
    return;
  }

  const { data: sales, error } = await supabase
    .from("sales")
    .select("id, invoice_no, total, paid, due, status, customer_name, created_at, payment_method")
    .gte("created_at", fromISO).lte("created_at", toISO)
    .order("created_at", { ascending: false });

  if (error) { await tgSend(chatId, "⚠️ Report লোড করা যায়নি।"); return; }

  const rows = sales ?? [];
  const total = rows.reduce((s: number, r: any) => s + Number(r.total || 0), 0);
  const paid  = rows.reduce((s: number, r: any) => s + Number(r.paid || 0), 0);
  const due   = rows.reduce((s: number, r: any) => s + Number(r.due  || 0), 0);

  const head = [
    `📊 <b>${title}</b>`,
    `🕐 ${nowBn()}`,
    "",
    `🧾 মোট বিক্রয়: <b>${rows.length}</b>`,
    `💰 মোট টাকা: <b>${fmt(total)}</b>`,
    `✅ আদায়: <b>${fmt(paid)}</b>`,
    `🟠 বকেয়া: <b>${fmt(due)}</b>`,
    "",
  ];

  const list = rows.slice(0, 15).map((r: any, i: number) => {
    const t = new Date(r.created_at).toLocaleString("bn-BD", { dateStyle: "short", timeStyle: "short" });
    return `${i + 1}. <b>${r.invoice_no ?? r.id.slice(0, 6)}</b> — ${fmt(r.total)}\n   👤 ${r.customer_name ?? "Walk-in"} • ⏱ ${t} • ${r.status}`;
  });

  const tail = rows.length > 15 ? [`\n<i>... আরও ${rows.length - 15}টি বিক্রয়</i>`] : [];

  await tgSend(chatId, [...head, ...(list.length ? list : ["<i>কোনো বিক্রয় নেই</i>"]), ...tail].join("\n"));
}

async function reportDue(supabase: any, chatId: number) {
  const userId = await getUserIdForChat(supabase, chatId);
  if (!userId) { await tgSend(chatId, "❌ Linked নয়।"); return; }

  const { data: sales } = await supabase
    .from("sales")
    .select("invoice_no, customer_name, due, created_at")
    .gt("due", 0)
    .order("due", { ascending: false })
    .limit(20);

  const rows = sales ?? [];
  const totalDue = rows.reduce((s: number, r: any) => s + Number(r.due || 0), 0);
  const list = rows.map((r: any, i: number) =>
    `${i + 1}. ${r.customer_name ?? "Walk-in"} — <b>${fmt(r.due)}</b>\n   🧾 ${r.invoice_no ?? "-"}`);

  await tgSend(chatId, [
    "🟠 <b>বকেয়া রিপোর্ট</b> (Top 20)",
    `🕐 ${nowBn()}`,
    `💸 মোট বকেয়া: <b>${fmt(totalDue)}</b>`,
    "",
    ...(list.length ? list : ["<i>কোনো বকেয়া নেই 🎉</i>"]),
  ].join("\n"));
}

async function reportLowStock(supabase: any, chatId: number) {
  const userId = await getUserIdForChat(supabase, chatId);
  if (!userId) { await tgSend(chatId, "❌ Linked নয়।"); return; }

  const { data: prods } = await supabase
    .from("products")
    .select("name, sku, stock, low_stock_alert")
    .order("stock", { ascending: true })
    .limit(50);

  const low = (prods ?? []).filter((p: any) =>
    Number(p.stock) <= Number(p.low_stock_alert ?? 5)).slice(0, 20);

  await tgSend(chatId, [
    "📦 <b>কম Stock পণ্য</b>",
    `🕐 ${nowBn()}`,
    "",
    ...(low.length
      ? low.map((p: any, i: number) =>
          `${i + 1}. ${p.name} ${p.sku ? `(${p.sku})` : ""}\n   📊 Stock: <b>${p.stock}</b> / Alert: ${p.low_stock_alert ?? 5}`)
      : ["<i>সব পণ্যের stock পর্যাপ্ত 🎉</i>"]),
  ].join("\n"));
}

function dateRange(kind: "today" | "yesterday" | "week" | "month"): [string, string, string] {
  const now = new Date();
  const tz = 6 * 60 * 60 * 1000; // BD UTC+6 approx
  const local = new Date(now.getTime() + tz);
  const startOfLocalDay = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()));
  let from: Date, to: Date, title: string;
  switch (kind) {
    case "today":
      from = new Date(startOfLocalDay.getTime() - tz);
      to = new Date(from.getTime() + 24 * 60 * 60 * 1000);
      title = "আজকের বিক্রয় Report"; break;
    case "yesterday":
      to = new Date(startOfLocalDay.getTime() - tz);
      from = new Date(to.getTime() - 24 * 60 * 60 * 1000);
      title = "গতকালের বিক্রয় Report"; break;
    case "week":
      to = new Date();
      from = new Date(to.getTime() - 7 * 24 * 60 * 60 * 1000);
      title = "সর্বশেষ ৭ দিনের Report"; break;
    case "month":
      from = new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1) - tz);
      to = new Date();
      title = "চলতি মাসের Report"; break;
  }
  return [from.toISOString(), to.toISOString(), title];
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
  const text: string = (msg?.text ?? "").trim();
  if (!chatId) return new Response(JSON.stringify({ ok: true }));

  try {
    const cmd = text.split(/\s+/)[0]?.toLowerCase();

    if (cmd === "/start") {
      const parts = text.split(/\s+/);
      const code = parts[1]?.trim();

      if (code) {
        const { data: link } = await supabase
          .from("telegram_link_codes")
          .select("user_id, expires_at, used")
          .eq("code", code).maybeSingle();

        if (!link) {
          await tgSend(chatId, "❌ ভুল কোড। অ্যাপ থেকে নতুন কোড নিন।");
        } else if (link.used || new Date(link.expires_at) < new Date()) {
          await tgSend(chatId, "⏰ কোডের মেয়াদ শেষ। নতুন কোড নিন।");
        } else {
          await supabase.from("telegram_subscribers").upsert({
            user_id: link.user_id, chat_id: chatId,
            username: msg.from?.username ?? null,
            first_name: msg.from?.first_name ?? null,
            is_active: true, notify_all: true,
          }, { onConflict: "chat_id" });
          await supabase.from("telegram_link_codes").update({ used: true }).eq("code", code);
          await tgSend(chatId, welcomeMessage(msg.from?.first_name));
        }
      } else {
        // Already linked? show welcome anyway
        const { data: existing } = await supabase
          .from("telegram_subscribers").select("is_active").eq("chat_id", chatId).maybeSingle();
        if (existing) {
          await tgSend(chatId, welcomeMessage(msg.from?.first_name));
        } else {
          await tgSend(chatId, [
            "👋 <b>স্বাগতম সূর্য Shop-এ!</b>",
            "",
            "এই বট-কে আপনার অ্যাকাউন্টের সাথে সংযুক্ত করতে:",
            "1️⃣ অ্যাপের <b>Telegram Notification</b> পেজে যান",
            "2️⃣ Link code generate করুন",
            "3️⃣ এখানে পাঠান: <code>/start &lt;code&gt;</code>",
          ].join("\n"));
        }
      }
    } else if (cmd === "/stop") {
      await supabase.from("telegram_subscribers").update({ is_active: false }).eq("chat_id", chatId);
      await tgSend(chatId, "🔕 Notification বন্ধ করা হলো। আবার চালু করতে /start লিখুন।");
    } else if (cmd === "/status") {
      const { data } = await supabase.from("telegram_subscribers")
        .select("is_active, first_name, created_at").eq("chat_id", chatId).maybeSingle();
      if (!data) {
        await tgSend(chatId, "❌ এই chat কোনো অ্যাকাউন্টের সাথে যুক্ত নেই।");
      } else {
        await tgSend(chatId, [
          "📊 <b>Connection Status</b>",
          `🟢 System: <b>Online</b>`,
          `🔔 Notifications: <b>${data.is_active ? "✅ Active" : "🔕 Paused"}</b>`,
          `👤 ${data.first_name ?? "-"}`,
          `📅 Linked: ${new Date(data.created_at).toLocaleString("bn-BD")}`,
          `🕐 Now: ${nowBn()}`,
        ].join("\n"));
      }
    } else if (cmd === "/today") {
      const [f, t, title] = dateRange("today"); await reportSales(supabase, chatId, f, t, title);
    } else if (cmd === "/yesterday") {
      const [f, t, title] = dateRange("yesterday"); await reportSales(supabase, chatId, f, t, title);
    } else if (cmd === "/week") {
      const [f, t, title] = dateRange("week"); await reportSales(supabase, chatId, f, t, title);
    } else if (cmd === "/month") {
      const [f, t, title] = dateRange("month"); await reportSales(supabase, chatId, f, t, title);
    } else if (cmd === "/due") {
      await reportDue(supabase, chatId);
    } else if (cmd === "/stock") {
      await reportLowStock(supabase, chatId);
    } else if (cmd === "/help" || cmd === "/commands") {
      await tgSend(chatId, welcomeMessage(msg.from?.first_name));
    } else {
      await tgSend(chatId, "🤔 অজানা command। /help লিখে সব command দেখুন।");
    }
  } catch (e) {
    console.error("webhook error", e);
    await tgSend(chatId, "⚠️ Internal error: " + String(e));
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
