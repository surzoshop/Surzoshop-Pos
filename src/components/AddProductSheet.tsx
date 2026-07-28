import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImageUpload } from "@/components/ImageUpload";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { Package, Tag, DollarSign, Layers, ShieldCheck, TrendingUp, Lock } from "lucide-react";

function namePrefix(name: string): string {
  const ascii = (name || "").replace(/[^A-Za-z]/g, "");
  if (ascii.length >= 2) return ascii.slice(0, 2).toUpperCase();
  if (ascii.length === 1) return (ascii + "X").toUpperCase();
  return "PR";
}
async function generateBarcode(name: string): Promise<string> {
  const { data } = await supabase.rpc("next_barcode_serial");
  const serial = data ?? Date.now();
  return `${namePrefix(name)}-${serial}`;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
  editing?: any | null;
}

const WARRANTY_PRESETS = [
  { label: "৬ মাস", months: 6 },
  { label: "১ বছর", months: 12 },
  { label: "২ বছর", months: 24 },
  { label: "৩ বছর", months: 36 },
  { label: "৫ বছর", months: 60 },
];

const WARRANTY_TYPES = [
  "ম্যানুফ্যাকচারার",
  "সেলার / দোকান",
  "ব্র্যান্ড অফিসিয়াল",
  "ইন্টারন্যাশনাল",
];

export function AddProductSheet({ open, onOpenChange, onSaved, editing }: Props) {
  const { toast } = useToast();
  const { role } = useAuth();
  const isAdmin = role === "admin" || role === "super_admin";
  const [cats, setCats] = useState<any[]>([]);
  const empty = {
    name: "", category_id: "", price: "", cost: "", stock: "", unit: "pcs",
    image_url: "", sku: "", supplier_voucher: "",
    credit_extra: "", installment_extra: "",
    has_warranty: false, warranty_months: "" as string | number, warranty_type: "ম্যানুফ্যাকচারার",
  };
  const [form, setForm] = useState<any>(empty);
  const [saving, setSaving] = useState(false);
  const isEdit = !!editing?.id;

  useEffect(() => {
    if (open) {
      if (editing?.id) {
        setForm({
          ...empty,
          ...editing,
          category_id: editing.category_id ?? "",
          image_url: editing.image_url ?? "",
          warranty_months: editing.warranty_months ?? "",
          warranty_type: editing.warranty_type ?? "ম্যানুফ্যাকচারার",
        });
      } else {
        setForm(empty);
      }
      supabase.from("categories").select("*").order("name").then(({ data }) => setCats(data ?? []));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing]);

  const cost = Number(form.cost) || 0;
  const price = Number(form.price) || 0;
  const profit = price - cost;
  const profitPct = cost > 0 ? (profit / cost) * 100 : 0;

  const save = async () => {
    if (!form.name?.trim()) return toast({ title: "পণ্যের নাম দিন", variant: "destructive" });
    if (form.has_warranty && !Number(form.warranty_months)) {
      return toast({ title: "Warranty কত মাসের সেটি দিন", variant: "destructive" });
    }
    setSaving(true);
    const productName = form.name.trim();
    const payload: any = {
      name: productName,
      sku: form.sku?.trim() || null,
      price,
      cost,
      stock: Number(form.stock) || 0,
      unit: form.unit || "pcs",
      category_id: form.category_id || null,
      image_url: form.image_url || null,
      ...(isAdmin ? {
        credit_extra: Number(form.credit_extra) || 0,
        installment_extra: Number(form.installment_extra) || 0,
      } : {}),
      has_warranty: !!form.has_warranty,
      warranty_months: form.has_warranty ? Number(form.warranty_months) : null,
    };
    let error;
    if (isEdit) {
      ({ error } = await supabase.from("products").update(payload).eq("id", editing.id));
    } else {
      payload.barcode = await generateBarcode(productName);
      ({ error } = await supabase.from("products").insert(payload));
    }
    if (error) { setSaving(false); return toast({ title: error.message, variant: "destructive" }); }

    // ক্রয়মূল্য / পণ্যের নাম পরিবর্তন হলে DB trigger স্বয়ংক্রিয়ভাবে
    // purchase_items + purchases (subtotal/total/paid/due) সিঙ্ক করে দেয়।

    setSaving(false);
    toast({ title: isEdit ? "পণ্য আপডেট হয়েছে" : "পণ্য যোগ হয়েছে" });
    onOpenChange(false);
    onSaved?.();
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl p-0 flex flex-col bg-[hsl(var(--surface-container-lowest))]"
      >
        <SheetHeader className="px-6 py-5 border-b border-[hsl(var(--surface-container))] bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <Package className="h-6 w-6 text-primary" />
            </div>
            <div>
              <SheetTitle className="text-xl font-black">
                {isEdit ? "পণ্য সম্পাদনা" : "নতুন পণ্য যুক্ত করুন"}
              </SheetTitle>
              <SheetDescription className="text-xs">পণ্যের সকল তথ্য পূরণ করুন</SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {/* Image */}
          <section className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">পণ্যের ছবি</Label>
            <div className="flex justify-center bg-[hsl(var(--surface-container-low))] rounded-xl py-4">
              <ImageUpload value={form.image_url} onChange={(url) => setForm({ ...form, image_url: url })} />
            </div>
          </section>

          {/* Basic info */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-primary" /> পণ্যের বিস্তারিত
            </h3>
            <div>
              <Label>পণ্যের নাম *</Label>
              <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="যেমন: Samsung Galaxy A55" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>ক্যাটাগরি</Label>
                <Select value={form.category_id || "__none"} onValueChange={(v) => setForm({ ...form, category_id: v === "__none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="নির্বাচন করুন" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">— কোনটি না —</SelectItem>
                    {cats.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label>SKU / মডেল</Label><Input value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} placeholder="optional" /></div>
            </div>
          </section>

          {/* Pricing + Profit */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-primary" /> মূল্য ও প্রফিট
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>ক্রয় মূল্য (৳)</Label><Input type="number" inputMode="decimal" value={form.cost} onChange={e => setForm({ ...form, cost: e.target.value })} /></div>
              <div><Label>বিক্রয় মূল্য (৳) *</Label><Input type="number" inputMode="decimal" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} /></div>
            </div>
            <div className={`rounded-xl p-3 flex items-center justify-between ${profit >= 0 ? "bg-success/10" : "bg-destructive/10"}`}>
              <span className="flex items-center gap-2 text-xs font-bold">
                <TrendingUp className={`h-4 w-4 ${profit >= 0 ? "text-success" : "text-destructive"}`} />
                প্রফিট প্রতি ইউনিট
              </span>
              <span className={`text-sm font-black ${profit >= 0 ? "text-success" : "text-destructive"}`}>
                ৳{profit.toFixed(2)} ({profitPct.toFixed(1)}%)
              </span>
            </div>
          </section>

          {/* Credit / Installment extra charge — admin only */}
          {isAdmin && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-primary" /> বাকি / কিস্তিতে অতিরিক্ত চার্জ
              </h3>
              <p className="text-[11px] text-muted-foreground -mt-1">
                বাকিতে বা কিস্তিতে বিক্রি করলে প্রতি ইউনিটে কত টাকা অতিরিক্ত নেওয়া হবে।
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>বাকিতে অতিরিক্ত (৳)</Label>
                  <Input type="number" inputMode="decimal" value={form.credit_extra}
                    onChange={e => setForm({ ...form, credit_extra: e.target.value })}
                    placeholder="0" />
                </div>
                <div>
                  <Label>কিস্তিতে অতিরিক্ত (৳)</Label>
                  <Input type="number" inputMode="decimal" value={form.installment_extra}
                    onChange={e => setForm({ ...form, installment_extra: e.target.value })}
                    placeholder="0" />
                </div>
              </div>
            </section>
          )}

          {/* Stock */}
          <section className="space-y-3">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Layers className="h-4 w-4 text-primary" /> মজুদ
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>বর্তমান মজুদ</Label><Input type="number" inputMode="numeric" value={form.stock} onChange={e => setForm({ ...form, stock: e.target.value })} /></div>
              <div><Label>একক</Label><Input value={form.unit} onChange={e => setForm({ ...form, unit: e.target.value })} placeholder="pcs / kg / ltr" /></div>
            </div>
            {!isEdit && <p className="text-[11px] text-muted-foreground">বারকোড স্বয়ংক্রিয়ভাবে তৈরি হবে।</p>}
            {isEdit && editing?.barcode && (
              <p className="text-[11px] text-muted-foreground font-mono">বারকোড: {editing.barcode}</p>
            )}
          </section>

          {/* Warranty */}
          <section className="space-y-3 bg-info/5 border border-info/20 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-info" /> ওয়ারেন্টি ব্যবস্থাপনা
              </h3>
              <Switch
                checked={!!form.has_warranty}
                onCheckedChange={(v) => setForm({ ...form, has_warranty: v, warranty_months: v ? form.warranty_months || 12 : "" })}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              মোবাইল, ফ্রিজ, TV, ইলেকট্রনিক্স পণ্যের জন্য ওয়ারেন্টি চালু করুন।
            </p>
            {form.has_warranty && (
              <div className="space-y-3 pt-2 border-t border-info/20">
                <div className="flex flex-wrap gap-2">
                  {WARRANTY_PRESETS.map(p => (
                    <button
                      key={p.months}
                      type="button"
                      onClick={() => setForm({ ...form, warranty_months: p.months })}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                        Number(form.warranty_months) === p.months
                          ? "bg-info text-info-foreground"
                          : "bg-[hsl(var(--surface-container))] text-foreground hover:bg-[hsl(var(--surface-container-high))]"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>সময় (মাস) *</Label>
                    <Input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      value={form.warranty_months}
                      onChange={e => setForm({ ...form, warranty_months: e.target.value })}
                      placeholder="যেমন: 12"
                    />
                  </div>
                  <div>
                    <Label>ওয়ারেন্টির ধরন</Label>
                    <Select value={form.warranty_type} onValueChange={(v) => setForm({ ...form, warranty_type: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {WARRANTY_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>

        <div className="border-t border-[hsl(var(--surface-container))] px-6 py-4 flex gap-3 bg-[hsl(var(--surface-container-lowest))]">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>ক্যানসেল</Button>
          <Button onClick={save} disabled={saving} className="flex-1 gradient-primary text-primary-foreground font-bold">
            {saving ? "সংরক্ষণ হচ্ছে..." : isEdit ? "আপডেট করুন" : "প্রোডাক্ট যুক্ত করুন"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
