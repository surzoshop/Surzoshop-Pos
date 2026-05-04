import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, IdCard, Briefcase, MapPin, Camera, FileImage } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}

export function AddCustomerSheet({ open, onOpenChange, onSaved }: Props) {
  const { toast } = useToast();
  const empty = {
    name: "", phone: "", address: "", nid: "",
    present_address: "", permanent_address: "", occupation: "", monthly_income: "",
    photo_url: "", nid_front_url: "", nid_back_url: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [sameAsPresent, setSameAsPresent] = useState(false);

  useEffect(() => {
    if (open) { setForm(empty); setSameAsPresent(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const save = async () => {
    if (!form.name?.trim()) return toast({ title: "নাম প্রয়োজন", variant: "destructive" });
    setSaving(true);
    const { error } = await supabase.from("customers").insert({
      name: form.name.trim(),
      phone: form.phone || null,
      address: form.address || null,
      nid: form.nid || null,
      present_address: form.present_address || null,
      permanent_address: sameAsPresent ? form.present_address || null : form.permanent_address || null,
      occupation: form.occupation || null,
      monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
      photo_url: form.photo_url || null,
      nid_front_url: form.nid_front_url || null,
      nid_back_url: form.nid_back_url || null,
    });
    setSaving(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "ক্রেতা যোগ হয়েছে" });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-[hsl(var(--surface-container-lowest))]"
      >
        <SheetHeader className="px-6 py-5 border-b border-[hsl(var(--surface-container))] bg-gradient-to-r from-info/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-info/10">
              <UserPlus className="h-6 w-6 text-info" />
            </div>
            <div>
              <SheetTitle className="text-xl font-black">নতুন ক্রেতা যুক্ত করুন</SheetTitle>
              <SheetDescription className="text-xs">ক্রেতার সম্পূর্ণ KYC তথ্য পূরণ করুন</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Photo */}
          <section className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Camera className="h-3.5 w-3.5" /> ক্রেতার ছবি
            </Label>
            <div className="flex justify-center bg-[hsl(var(--surface-container-low))] rounded-xl py-4">
              <ImageUpload
                value={form.photo_url}
                onChange={(url) => setForm({ ...form, photo_url: url })}
                bucket="kyc-docs"
                folder="customer-photos"
              />
            </div>
          </section>

          {/* Personal */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <IdCard className="h-4 w-4 text-info" /> ব্যক্তিগত তথ্য
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>নাম *</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>মোবাইল</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>NID নম্বর</Label><Input value={form.nid} onChange={e => setForm({ ...form, nid: e.target.value })} /></div>
              <div><Label>পেশা</Label><Input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} /></div>
            </div>
          </section>

          {/* NID images */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <FileImage className="h-4 w-4 text-info" /> NID কপি (ঐচ্ছিক)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3">
                <Label className="text-xs">NID সামনের দিক</Label>
                <ImageUpload
                  value={form.nid_front_url}
                  onChange={(url) => setForm({ ...form, nid_front_url: url })}
                  bucket="kyc-docs"
                  folder="nid-front"
                />
              </div>
              <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3">
                <Label className="text-xs">NID পিছনের দিক</Label>
                <ImageUpload
                  value={form.nid_back_url}
                  onChange={(url) => setForm({ ...form, nid_back_url: url })}
                  bucket="kyc-docs"
                  folder="nid-back"
                />
              </div>
            </div>
          </section>

          {/* Financial */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-info" /> আর্থিক তথ্য
            </h3>
            <div><Label>মাসিক আয় (৳)</Label><Input type="number" inputMode="decimal" value={form.monthly_income} onChange={e => setForm({ ...form, monthly_income: e.target.value })} /></div>
          </section>

          {/* Address */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-info" /> ঠিকানা
            </h3>
            <div>
              <Label>বর্তমান ঠিকানা</Label>
              <Textarea rows={2} value={form.present_address} onChange={e => setForm({ ...form, present_address: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
              <input
                type="checkbox"
                checked={sameAsPresent}
                onChange={e => setSameAsPresent(e.target.checked)}
                className="rounded"
              />
              স্থায়ী ঠিকানা বর্তমান ঠিকানার মতই
            </label>
            {!sameAsPresent && (
              <div>
                <Label>স্থায়ী ঠিকানা</Label>
                <Textarea rows={2} value={form.permanent_address} onChange={e => setForm({ ...form, permanent_address: e.target.value })} />
              </div>
            )}
            <div>
              <Label>সংক্ষিপ্ত ঠিকানা / এলাকা</Label>
              <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} placeholder="যেমন: ধানমন্ডি, ঢাকা" />
            </div>
          </section>
        </div>

        <div className="border-t border-[hsl(var(--surface-container))] px-6 py-4 flex gap-3 bg-[hsl(var(--surface-container-lowest))]">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>ক্যানসেল</Button>
          <Button onClick={save} disabled={saving} className="flex-1 gradient-primary text-primary-foreground font-bold">
            {saving ? "যোগ হচ্ছে..." : "ক্রেতা যুক্ত করুন"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
