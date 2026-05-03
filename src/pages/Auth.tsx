import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useT } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, Store, Languages, Sun, ShieldCheck, BarChart3,
  Wallet, ShoppingCart, Mail, Lock, User, ArrowRight,
} from "lucide-react";

export default function Auth() {
  const { t, lang, setLang } = useT();
  const { toast } = useToast();
  const nav = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${window.location.origin}/`, data: { full_name: fullName } },
        });
        if (error) throw error;
        toast({ title: "Success", description: "Account created. You can now log in." });
        setMode("login");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        nav("/");
      }
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const features = [
    { icon: ShoppingCart, title: lang === "bn" ? "দ্রুত POS" : "Fast POS", desc: lang === "bn" ? "বারকোড স্ক্যান করে সেকেন্ডে বিক্রয়" : "Sell in seconds with barcode scan" },
    { icon: Wallet, title: lang === "bn" ? "কিস্তি ব্যবস্থাপনা" : "Installments", desc: lang === "bn" ? "EMI, গ্যারান্টর, KYC একসাথে" : "EMI, guarantor, KYC in one place" },
    { icon: BarChart3, title: lang === "bn" ? "Multi-Shop রিপোর্ট" : "Multi-Shop Reports", desc: lang === "bn" ? "সব শাখার বিক্রয় এক ড্যাশবোর্ডে" : "All branches in one dashboard" },
    { icon: ShieldCheck, title: lang === "bn" ? "সুরক্ষিত অ্যাক্সেস" : "Secure Access", desc: lang === "bn" ? "Custom permission সহ Staff" : "Staff with custom permissions" },
  ];

  return (
    <div className="min-h-screen w-full grid lg:grid-cols-[1.05fr_1fr] bg-background">
      {/* LEFT — Brand showcase (desktop only) */}
      <aside className="relative hidden lg:flex flex-col justify-between overflow-hidden text-primary-foreground p-12 xl:p-16 gradient-primary">
        {/* decorative blobs */}
        <div className="absolute -top-32 -left-24 h-[26rem] w-[26rem] rounded-full bg-white/15 blur-3xl" />
        <div className="absolute bottom-0 -right-32 h-[28rem] w-[28rem] rounded-full bg-white/10 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.07]"
             style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "22px 22px" }} />

        <div className="relative z-10 flex items-center gap-3">
          <div className="h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center ring-1 ring-white/30">
            <Sun className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-black leading-tight">{t("appName")}</p>
            <p className="text-[11px] uppercase tracking-[0.25em] opacity-80">{t("appTagline")}</p>
          </div>
        </div>

        <div className="relative z-10 space-y-8">
          <div>
            <h2 className="text-4xl xl:text-5xl font-black leading-[1.1]">
              {lang === "bn" ? "একটি প্যানেলে" : "Run your"} <br />
              {lang === "bn" ? "পুরো দোকান।" : "entire shop."}
            </h2>
            <p className="mt-4 text-base xl:text-lg opacity-90 max-w-md">
              {lang === "bn"
                ? "POS, ইনভেন্টরি, কিস্তি, রিপোর্ট ও মাল্টি-শপ ম্যানেজমেন্ট — সব এক জায়গায়।"
                : "POS, inventory, installments, reports and multi-shop management — all in one place."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 max-w-xl">
            {features.map((f) => (
              <div key={f.title} className="flex items-start gap-3 bg-white/10 backdrop-blur-md rounded-xl p-4 ring-1 ring-white/15">
                <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                  <f.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">{f.title}</p>
                  <p className="text-[11px] opacity-80 mt-0.5 leading-snug">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs opacity-75 flex items-center justify-between">
          <span>© {new Date().getFullYear()} {t("appName")}</span>
          <span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5" /> Secure & encrypted</span>
        </div>
      </aside>

      {/* RIGHT — Auth form */}
      <main className="relative flex items-center justify-center p-5 sm:p-8 md:p-12 bg-[hsl(var(--surface-container-low,var(--background)))]">
        {/* mobile decorative top */}
        <div className="lg:hidden absolute inset-x-0 top-0 h-44 gradient-primary -z-0" />

        <div className="w-full max-w-md relative z-10">
          {/* Mobile brand */}
          <div className="lg:hidden flex flex-col items-center mb-6 text-primary-foreground">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center ring-1 ring-white/30">
              <Sun className="h-7 w-7" />
            </div>
            <h1 className="mt-2 text-xl font-black">{t("appName")}</h1>
            <p className="text-[11px] uppercase tracking-[0.2em] opacity-90">{t("appTagline")}</p>
          </div>

          {/* Card */}
          <div className="bg-card text-card-foreground rounded-3xl shadow-2xl border border-border/60 p-6 sm:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl sm:text-2xl font-black tracking-tight">
                  {mode === "login"
                    ? (lang === "bn" ? "স্বাগতম 👋" : "Welcome back 👋")
                    : (lang === "bn" ? "অ্যাকাউন্ট তৈরি করুন" : "Create an account")}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {mode === "login" ? t("loginSubtitle") : t("signupSubtitle")}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => setLang(lang === "bn" ? "en" : "bn")} className="shrink-0">
                <Languages className="h-4 w-4 mr-1" />{lang === "bn" ? "EN" : "বাং"}
              </Button>
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 bg-muted/60 rounded-xl p-1 mb-6">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`py-2 text-sm font-bold rounded-lg transition-all ${mode === "login" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >{t("login")}</button>
              <button
                type="button"
                onClick={() => setMode("signup")}
                className={`py-2 text-sm font-bold rounded-lg transition-all ${mode === "signup" ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
              >{t("signup")}</button>
            </div>

            <form onSubmit={submit} className="space-y-4">
              {mode === "signup" && (
                <Field label={t("fullName")} icon={<User className="h-4 w-4" />}>
                  <Input value={fullName} onChange={e => setFullName(e.target.value)} required className="pl-10 h-11" placeholder={lang === "bn" ? "আপনার নাম" : "Your name"} />
                </Field>
              )}
              <Field label={t("email")} icon={<Mail className="h-4 w-4" />}>
                <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required className="pl-10 h-11" placeholder="you@shop.com" />
              </Field>
              <Field label={t("password")} icon={<Lock className="h-4 w-4" />}>
                <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} className="pl-10 h-11" placeholder="••••••••" />
              </Field>

              <Button type="submit" className="w-full h-11 text-sm font-bold gradient-primary text-primary-foreground hover:brightness-110 shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.5)]" disabled={loading}>
                {loading
                  ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  : <ArrowRight className="h-4 w-4 mr-2" />}
                {mode === "login" ? t("login") : t("signup")}
              </Button>
            </form>

            <div className="mt-5 text-center text-sm">
              <button type="button" className="text-primary font-semibold hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
                {mode === "login" ? t("needAccount") + " " + t("signup") : t("haveAccount") + " " + t("login")}
              </button>
            </div>
            {mode === "signup" && (
              <p className="mt-3 text-[11px] text-center text-muted-foreground leading-relaxed">{t("firstUserNote")}</p>
            )}
          </div>

          <p className="text-center text-[11px] text-muted-foreground mt-6 lg:hidden">
            © {new Date().getFullYear()} {t("appName")}
          </p>
        </div>
      </main>
    </div>
  );
}

function Field({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs font-semibold text-foreground/80">{label}</Label>
      <div className="relative mt-1.5">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none">{icon}</span>
        {children}
      </div>
    </div>
  );
}
