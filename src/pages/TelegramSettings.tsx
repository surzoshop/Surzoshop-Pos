import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/components/ui/sonner";
import { Loader2, Send, Copy, ExternalLink, CheckCircle2, BellOff, Bell, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

type Subscriber = {
  id: string;
  chat_id: number;
  username: string | null;
  first_name: string | null;
  is_active: boolean;
  notify_all: boolean;
  created_at: string;
};

export default function TelegramSettings() {
  const [loading, setLoading] = useState(true);
  const [subs, setSubs] = useState<Subscriber[]>([]);
  const [generating, setGenerating] = useState(false);
  const [linkData, setLinkData] = useState<{ code: string; deeplink: string | null; bot_username: string | null } | null>(null);
  const [testing, setTesting] = useState(false);

  const loadSubs = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    const { data } = await supabase
      .from("telegram_subscribers" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setSubs((data as any) ?? []);
    setLoading(false);
  };

  useEffect(() => { loadSubs(); }, []);

  const generateCode = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-link-code");
      if (error) throw error;
      setLinkData(data as any);
    } catch (e: any) {
      toast.error("কোড তৈরি করা যায়নি: " + e.message);
    } finally {
      setGenerating(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("telegram-notify", {
        body: { text: "🧪 <b>Test Notification</b>\nTelegram সংযোগ সফল!" },
      });
      if (error) throw error;
      toast.success(`টেস্ট বার্তা পাঠানো হলো (${(data as any)?.sent ?? 0} জনকে)`);
    } catch (e: any) {
      toast.error("পাঠানো যায়নি: " + e.message);
    } finally {
      setTesting(false);
    }
  };

  const toggleActive = async (sub: Subscriber) => {
    await supabase.from("telegram_subscribers" as any)
      .update({ is_active: !sub.is_active })
      .eq("id", sub.id);
    loadSubs();
  };

  const remove = async (sub: Subscriber) => {
    await supabase.from("telegram_subscribers" as any).delete().eq("id", sub.id);
    loadSubs();
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Telegram Notifications"
        description="অ্যাপের যাবতীয় action-এর notification আপনার Telegram-এ পান"
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Telegram Account সংযুক্ত করুন</CardTitle>
          <CardDescription>একটি one-time link code নিয়ে বট-এ পাঠান। সংযুক্ত হলে সব activity notification পাবেন।</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!linkData ? (
            <Button onClick={generateCode} disabled={generating}>
              {generating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              নতুন Link Code তৈরি করুন
            </Button>
          ) : (
            <div className="space-y-3 rounded-lg border p-4 bg-muted/30">
              <div className="flex items-center gap-2">
                <code className="text-2xl font-mono font-bold tracking-wider bg-background px-3 py-1.5 rounded">{linkData.code}</code>
                <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(linkData.code); toast.success("Copied"); }}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">এই কোডটি ১৫ মিনিটের জন্য সক্রিয়।</p>

              {linkData.deeplink && (
                <Button asChild className="w-full sm:w-auto">
                  <a href={linkData.deeplink} target="_blank" rel="noreferrer">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Telegram-এ খুলুন (@{linkData.bot_username})
                  </a>
                </Button>
              )}

              <div className="text-sm space-y-1 pt-2 border-t">
                <p className="font-semibold">Manual করতে চাইলে:</p>
                <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                  <li>Telegram-এ <span className="font-mono">@{linkData.bot_username ?? "<bot>"}</span> খুঁজুন</li>
                  <li>পাঠান: <code className="bg-background px-1.5 py-0.5 rounded">/start {linkData.code}</code></li>
                </ol>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>সংযুক্ত Telegram</CardTitle>
            <CardDescription>আপনার সাথে যুক্ত chat-গুলো</CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={sendTest} disabled={testing || subs.filter(s => s.is_active).length === 0}>
            {testing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
            Test পাঠান
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : subs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">কোনো Telegram account সংযুক্ত নেই।</p>
          ) : (
            <div className="space-y-2">
              {subs.map(s => (
                <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="flex items-center gap-3 min-w-0">
                    {s.is_active
                      ? <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                      : <BellOff className="h-5 w-5 text-muted-foreground shrink-0" />}
                    <div className="min-w-0">
                      <p className="font-medium truncate">{s.first_name ?? "Telegram User"}{s.username ? ` (@${s.username})` : ""}</p>
                      <p className="text-xs text-muted-foreground">Chat ID: {s.chat_id}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s)} />
                      <Label className="text-sm">{s.is_active ? "Active" : "Paused"}</Label>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => remove(s)}>Remove</Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> কোন কোন notification পাবেন</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-1.5 text-sm text-muted-foreground list-disc list-inside">
            <li>নতুন বিক্রয় ও পেমেন্ট</li>
            <li>কিস্তি গ্রহণ / সংশোধন / মুছে ফেলা</li>
            <li>পণ্য / Stock adjustment</li>
            <li>Purchase, Expense, Sales return</li>
            <li>Customer ও Staff পরিবর্তন</li>
            <li>Login / Logout activity</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
