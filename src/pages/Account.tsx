import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useT } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Loader2, Camera, User as UserIcon, Lock, Save, ShieldCheck } from "lucide-react";

export default function Account() {
  const { user, role } = useAuth();
  const { lang } = useT();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setFullName(data.full_name ?? "");
        setAvatarUrl(data.avatar_url ?? null);
      }
      setLoading(false);
    })();
  }, [user]);

  const saveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, full_name: fullName }, { onConflict: "user_id" });
      if (error) throw error;
      toast({ title: lang === "bn" ? "সংরক্ষিত হয়েছে" : "Saved", description: lang === "bn" ? "প্রোফাইল আপডেট হয়েছে" : "Profile updated" });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Error", description: lang === "bn" ? "পাসওয়ার্ড কমপক্ষে ৬ অক্ষর" : "Password must be at least 6 chars", variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: "Error", description: lang === "bn" ? "পাসওয়ার্ড মিলছে না" : "Passwords do not match", variant: "destructive" });
      return;
    }
    setPwSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast({ title: lang === "bn" ? "পাসওয়ার্ড পরিবর্তিত" : "Password changed" });
      setNewPassword(""); setConfirmPassword("");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setPwSaving(false); }
  };

  const onPickAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const url = pub.publicUrl;
      const { error: dbErr } = await supabase
        .from("profiles")
        .upsert({ user_id: user.id, avatar_url: url }, { onConflict: "user_id" });
      if (dbErr) throw dbErr;
      setAvatarUrl(url);
      toast({ title: lang === "bn" ? "ছবি আপডেট হয়েছে" : "Photo updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (loading) return <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const initial = (fullName || user?.email || "A").charAt(0).toUpperCase();

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-black">{lang === "bn" ? "অ্যাকাউন্ট সেটিংস" : "Account Settings"}</h1>
        <p className="text-sm text-muted-foreground">{lang === "bn" ? "আপনার প্রোফাইল, ছবি এবং পাসওয়ার্ড পরিচালনা করুন" : "Manage your profile, photo and password"}</p>
      </div>

      {/* Profile card */}
      <Card className="p-6">
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="h-24 w-24 rounded-full overflow-hidden ring-2 ring-primary/20 bg-muted flex items-center justify-center text-3xl font-black gradient-primary text-primary-foreground">
              {avatarUrl ? <img src={avatarUrl} alt="avatar" className="h-full w-full object-cover" /> : initial}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition disabled:opacity-50"
              aria-label="Change photo"
            >
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickAvatar} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-bold text-lg truncate">{fullName || user?.email}</p>
            <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
            {role && (
              <span className="inline-flex items-center gap-1 mt-2 text-xs font-bold bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                <ShieldCheck className="h-3 w-3" /> {role}
              </span>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <div>
            <Label className="flex items-center gap-2 text-sm"><UserIcon className="h-4 w-4" />{lang === "bn" ? "পূর্ণ নাম" : "Full Name"}</Label>
            <Input className="mt-1.5 h-11" value={fullName} onChange={e => setFullName(e.target.value)} placeholder={lang === "bn" ? "আপনার নাম" : "Your name"} />
          </div>
          <Button onClick={saveProfile} disabled={saving} className="w-full sm:w-auto">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            {lang === "bn" ? "সংরক্ষণ করুন" : "Save Changes"}
          </Button>
        </div>
      </Card>

      {/* Password card */}
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Lock className="h-5 w-5 text-primary" />
          <h2 className="font-bold text-lg">{lang === "bn" ? "পাসওয়ার্ড পরিবর্তন" : "Change Password"}</h2>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <Label className="text-sm">{lang === "bn" ? "নতুন পাসওয়ার্ড" : "New Password"}</Label>
            <Input className="mt-1.5 h-11" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="••••••••" />
          </div>
          <div>
            <Label className="text-sm">{lang === "bn" ? "নিশ্চিত করুন" : "Confirm Password"}</Label>
            <Input className="mt-1.5 h-11" type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="••••••••" />
          </div>
        </div>
        <Button onClick={changePassword} disabled={pwSaving} className="mt-4 w-full sm:w-auto">
          {pwSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Lock className="h-4 w-4 mr-2" />}
          {lang === "bn" ? "পাসওয়ার্ড পরিবর্তন করুন" : "Update Password"}
        </Button>
      </Card>
    </div>
  );
}
