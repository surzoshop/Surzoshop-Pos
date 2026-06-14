import { useEffect, useMemo, useRef, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ImageUpload } from "@/components/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { useToast } from "@/hooks/use-toast";
import { UserPlus, IdCard, Briefcase, MapPin, Camera, FileImage, Phone, PhoneCall } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  customer?: any | null;
}

export function AddCustomerSheet({ open, onOpenChange, onSaved, customer }: Props) {
  const { toast } = useToast();
  const empty = {
    name: "", phone: "", alt_phone: "", address: "", nid: "",
    present_address: "", permanent_address: "", occupation: "", monthly_income: "",
    photo_url: "", nid_front_url: "", nid_back_url: "",
  };
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const [sameAsPresent, setSameAsPresent] = useState(false);
  const [allAddresses, setAllAddresses] = useState<{ present: string[]; permanent: string[]; short: string[] }>({ present: [], permanent: [], short: [] });
  const isEdit = !!customer?.id;

  useEffect(() => {
    if (open) {
      if (customer) {
        setForm({
          name: customer.name || "",
          phone: customer.phone || "",
          alt_phone: customer.alt_phone || "",
          address: customer.address || "",
          nid: customer.nid || "",
          present_address: customer.present_address || "",
          permanent_address: customer.permanent_address || "",
          occupation: customer.occupation || "",
          monthly_income: customer.monthly_income ?? "",
          photo_url: customer.photo_url || "",
          nid_front_url: customer.nid_front_url || "",
          nid_back_url: customer.nid_back_url || "",
        });
        setSameAsPresent(false);
      } else {
        setForm(empty);
        setSameAsPresent(false);
      }
      // load existing addresses for suggestions
      supabase.from("customers")
        .select("present_address,permanent_address,address")
        .limit(1000)
        .then(({ data }) => {
          const present = new Set<string>(), permanent = new Set<string>(), short = new Set<string>();
          (data ?? []).forEach((c: any) => {
            if (c.present_address?.trim()) present.add(c.present_address.trim());
            if (c.permanent_address?.trim()) permanent.add(c.permanent_address.trim());
            if (c.address?.trim()) short.add(c.address.trim());
          });
          setAllAddresses({
            present: [...present],
            permanent: [...permanent],
            short: [...short],
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer]);

  const save = async () => {
    if (!form.name?.trim()) return toast({ title: "নাম প্রয়োজন", variant: "destructive" });
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      phone: form.phone || null,
      alt_phone: form.alt_phone || null,
      address: form.address || null,
      nid: form.nid || null,
      present_address: form.present_address || null,
      permanent_address: sameAsPresent ? form.present_address || null : form.permanent_address || null,
      occupation: form.occupation || null,
      monthly_income: form.monthly_income ? Number(form.monthly_income) : null,
      photo_url: form.photo_url || null,
      nid_front_url: form.nid_front_url || null,
      nid_back_url: form.nid_back_url || null,
    };
    const { error } = isEdit
      ? await supabase.from("customers").update(payload as any).eq("id", customer.id)
      : await supabase.from("customers").insert(payload as any);
    setSaving(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    logActivity({
      action: isEdit ? "customer.update" : "customer.create",
      entity_type: "customer",
      entity_id: isEdit ? customer.id : null,
      meta: { customer_name: payload.name, phone: payload.phone },
    });
    toast({ title: isEdit ? "ক্রেতা আপডেট হয়েছে" : "ক্রেতা যোগ হয়েছে" });
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
              <SheetTitle className="text-xl font-black">{isEdit ? "ক্রেতা সম্পাদনা" : "নতুন ক্রেতা যুক্ত করুন"}</SheetTitle>
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
              <div><Label>NID নম্বর</Label><Input value={form.nid} onChange={e => setForm({ ...form, nid: e.target.value })} /></div>
            </div>
            <div><Label>পেশা</Label><Input value={form.occupation} onChange={e => setForm({ ...form, occupation: e.target.value })} /></div>
          </section>

          {/* Contact — dual phone */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Phone className="h-4 w-4 text-info" /> যোগাযোগ নম্বর
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3 space-y-1.5">
                <Label className="text-[11px] font-bold flex items-center gap-1.5 text-info">
                  <Phone className="h-3.5 w-3.5" /> প্রধান মোবাইল
                </Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.phone}
                  onChange={e => setForm({ ...form, phone: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  className="bg-background"
                />
              </div>
              <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3 space-y-1.5">
                <Label className="text-[11px] font-bold flex items-center gap-1.5 text-muted-foreground">
                  <PhoneCall className="h-3.5 w-3.5" /> বিকল্প মোবাইল
                </Label>
                <Input
                  type="tel"
                  inputMode="tel"
                  value={form.alt_phone}
                  onChange={e => setForm({ ...form, alt_phone: e.target.value })}
                  placeholder="01XXXXXXXXX (ঐচ্ছিক)"
                  className="bg-background"
                />
              </div>
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
            <AddressField
              label="বর্তমান ঠিকানা"
              value={form.present_address}
              onChange={(v) => setForm({ ...form, present_address: v })}
              suggestions={allAddresses.present}
              multiline
            />
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
              <AddressField
                label="স্থায়ী ঠিকানা"
                value={form.permanent_address}
                onChange={(v) => setForm({ ...form, permanent_address: v })}
                suggestions={allAddresses.permanent}
                multiline
              />
            )}
            <AddressField
              label="সংক্ষিপ্ত ঠিকানা / এলাকা"
              value={form.address}
              onChange={(v) => setForm({ ...form, address: v })}
              suggestions={allAddresses.short}
              placeholder="যেমন: ধানমন্ডি, ঢাকা"
            />
          </section>
        </div>

        <div className="border-t border-[hsl(var(--surface-container))] px-6 py-4 flex gap-3 bg-[hsl(var(--surface-container-lowest))]">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>ক্যানসেল</Button>
          <Button onClick={save} disabled={saving} className="flex-1 gradient-primary text-primary-foreground font-bold">
            {saving ? "সংরক্ষণ হচ্ছে..." : isEdit ? "আপডেট করুন" : "ক্রেতা যুক্ত করুন"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function AddressField({ label, value, onChange, suggestions, multiline, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  suggestions: string[];
  multiline?: boolean;
  placeholder?: string;
}) {
  const [focused, setFocused] = useState(false);
  const blurTimer = useRef<number | null>(null);

  const matches = useMemo(() => {
    const q = (value || "").trim().toLowerCase();
    if (!q) return [];
    return suggestions
      .filter(s => s.toLowerCase().includes(q) && s.toLowerCase() !== q)
      .slice(0, 6);
  }, [value, suggestions]);

  const showList = focused && matches.length > 0;

  return (
    <div className="relative">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea
          rows={2}
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (blurTimer.current) window.clearTimeout(blurTimer.current); setFocused(true); }}
          onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 150); }}
        />
      ) : (
        <Input
          value={value}
          placeholder={placeholder}
          onChange={e => onChange(e.target.value)}
          onFocus={() => { if (blurTimer.current) window.clearTimeout(blurTimer.current); setFocused(true); }}
          onBlur={() => { blurTimer.current = window.setTimeout(() => setFocused(false), 150); }}
        />
      )}
      {showList && (
        <div className="absolute z-50 left-0 right-0 mt-1 bg-popover border border-[hsl(var(--surface-container-high))] rounded-xl shadow-lg overflow-hidden">
          <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-[hsl(var(--surface-container-low))]">
            পূর্বে সংরক্ষিত ঠিকানা
          </div>
          <ul className="max-h-56 overflow-y-auto">
            {matches.map((m, i) => (
              <li key={i}>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onChange(m); setFocused(false); }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-[hsl(var(--surface-container-low))] flex items-start gap-2 border-t border-[hsl(var(--surface-container))] first:border-0"
                >
                  <MapPin className="h-3.5 w-3.5 text-info shrink-0 mt-0.5" />
                  <span className="line-clamp-2">{m}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
