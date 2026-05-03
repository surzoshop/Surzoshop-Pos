import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { useT } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Store, Languages } from "lucide-react";

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

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <Card className="w-full max-w-md p-8 shadow-lg">
        <div className="flex justify-end mb-2">
          <Button size="sm" variant="ghost" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
            <Languages className="h-4 w-4 mr-1" />{lang === "bn" ? "EN" : "বাং"}
          </Button>
        </div>
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 rounded-2xl gradient-primary items-center justify-center mb-3">
            <Store className="h-7 w-7 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{t("appName")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {mode === "login" ? t("loginSubtitle") : t("signupSubtitle")}
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <Label>{t("fullName")}</Label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} required />
            </div>
          )}
          <div>
            <Label>{t("email")}</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <Label>{t("password")}</Label>
            <Input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {mode === "login" ? t("login") : t("signup")}
          </Button>
        </form>

        <div className="mt-4 text-center text-sm">
          <button className="text-primary hover:underline" onClick={() => setMode(mode === "login" ? "signup" : "login")}>
            {mode === "login" ? t("needAccount") + " " + t("signup") : t("haveAccount") + " " + t("login")}
          </button>
        </div>
        {mode === "signup" && (
          <p className="mt-3 text-xs text-center text-muted-foreground">{t("firstUserNote")}</p>
        )}
      </Card>
    </div>
  );
}
