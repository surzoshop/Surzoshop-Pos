import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop, ALL_PAGES, PageKey } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, UserCog, ShieldCheck, KeyRound, Loader2, History, Search, Phone, Store as StoreIcon,
  LayoutDashboard, ShoppingCart, Receipt, RotateCcw, ShoppingBag, Package, Layers,
  Warehouse, ClipboardList, BookOpen, Wallet, Users, Truck, Contact, BarChart3,
  CalendarCheck, Store,
} from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton } from "@/components/PageHeader";

// Position categories
const POSITIONS: { value: string; label: string }[] = [
  { value: "cashier", label: "ক্যাশিয়ার" },
  { value: "accountant", label: "হিসাব রক্ষক" },
  { value: "manager", label: "ম্যানেজার" },
  { value: "salesman", label: "সেলসম্যান" },
  { value: "stock_keeper", label: "স্টক কিপার" },
  { value: "delivery", label: "ডেলিভারি ম্যান" },
  { value: "security", label: "নিরাপত্তা কর্মী" },
  { value: "cleaner", label: "ক্লিনার" },
  { value: "other", label: "অন্যান্য" },
];

// All access points with friendly labels + icons
const ACCESS_POINTS: { key: PageKey; label: string; icon: any }[] = [
  { key: "dashboard", label: "ড্যাশবোর্ড / হোম", icon: LayoutDashboard },
  { key: "pos", label: "বিক্রি (POS)", icon: ShoppingCart },
  { key: "sales", label: "বিক্রয় তালিকা", icon: Receipt },
  { key: "sales-returns", label: "বিক্রয় ফেরত", icon: RotateCcw },
  { key: "purchases", label: "ক্রয় / স্টক এন্ট্রি", icon: ShoppingBag },
  { key: "products", label: "পণ্য তালিকা", icon: Package },
  { key: "stock-ledger", label: "স্টক ম্যানেজমেন্ট", icon: Layers },
  { key: "stock-adjustments", label: "স্টক সমন্বয়", icon: Warehouse },
  { key: "expenses", label: "খরচ এন্ট্রি", icon: ClipboardList },
  { key: "installments", label: "কিস্তি ম্যানেজমেন্ট", icon: Wallet },
  { key: "warranty", label: "ওয়ারেন্টি", icon: ShieldCheck },
  { key: "customers", label: "কাস্টমার", icon: Users },
  { key: "customer-ledger", label: "বাকি ম্যানেজমেন্ট", icon: BookOpen },
  { key: "suppliers", label: "সরবরাহকারী", icon: Truck },
  { key: "supplier-ledger", label: "সরবরাহকারী লেজার", icon: BookOpen },
  { key: "contacts", label: "যোগাযোগ", icon: Contact },
  { key: "reports", label: "রিপোর্ট", icon: BarChart3 },
  { key: "staff", label: "স্টাফ", icon: UserCog },
  { key: "attendance", label: "হাজিরা", icon: CalendarCheck },
  { key: "shops", label: "শপ ম্যানেজমেন্ট", icon: Store },
];

// Presets per position
const PRESETS: Record<string, PageKey[]> = {
  cashier: ["dashboard"],
  accountant: ["dashboard", "expenses", "customer-ledger", "supplier-ledger", "reports"],
  manager: [...ACCESS_POINTS.map(a => a.key)].filter(k => k !== "shops" && k !== "staff") as PageKey[],
  salesman: ["dashboard", "pos", "customers", "products"],
  stock_keeper: ["dashboard", "products", "stock-ledger", "stock-adjustments", "purchases"],
  delivery: ["dashboard", "sales"],
  security: ["dashboard"],
  cleaner: ["dashboard"],
  other: ["dashboard"],
};

const emptyForm = {
  name: "", phone: "", nid: "", address: "", position: "cashier", salary: 0,
  loginPhone: "", password: "", createLogin: true, shopId: "" as string,
};

export default function Staff() {
  const { t, fmt } = useT();
  const { role } = useAuth();
  const { currentShop, shops } = useShop();
  const { toast } = useToast();
  const nav = useNavigate();
  const isAdmin = role === "admin";
  const [items, setItems] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [posFilter, setPosFilter] = useState<string>("all");
  const [form, setForm] = useState({ ...emptyForm });
  const [permissions, setPermissions] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {};
    PRESETS.cashier.forEach(p => { m[p] = true; });
    return m;
  });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await supabase.from("staff").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const grantedCount = useMemo(
    () => ACCESS_POINTS.filter(a => permissions[a.key]).length,
    [permissions]
  );

  const filteredItems = useMemo(() => {
    return items.filter(s => {
      if (posFilter !== "all" && s.position !== posFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (s.name ?? "").toLowerCase().includes(q) || (s.phone ?? "").toLowerCase().includes(q);
      }
      return true;
    });
  }, [items, search, posFilter]);

  const totalSalary = useMemo(() => items.reduce((a, s) => a + Number(s.salary || 0), 0), [items]);
  const activeCount = items.filter(s => s.is_active !== false).length;

  const applyPreset = (position: string) => {
    const next: Record<string, boolean> = {};
    (PRESETS[position] ?? PRESETS.other).forEach(k => { next[k] = true; });
    setPermissions(next);
  };

  const onPositionChange = (v: string) => {
    setForm(f => ({ ...f, position: v }));
    applyPreset(v);
  };

  const togglePerm = (k: string, v: boolean) => {
    setPermissions(p => ({ ...p, [k]: v }));
  };

  const grantAll = () => {
    const next: Record<string, boolean> = {};
    ACCESS_POINTS.forEach(a => { next[a.key] = true; });
    setPermissions(next);
  };
  const clearAll = () => setPermissions({});

  const openSheet = () => {
    setForm({ ...emptyForm, shopId: currentShop?.id ?? (shops[0]?.id ?? "") });
    applyPreset("cashier");
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim()) return toast({ title: "নাম প্রয়োজন", variant: "destructive" });
    if (!form.shopId) return toast({ title: "Shop নির্বাচন করুন", variant: "destructive" });

    if (form.createLogin) {
      const digits = form.loginPhone.replace(/\D+/g, "");
      if (!digits || digits.length < 6) {
        return toast({ title: "Login-এর জন্য সঠিক মোবাইল নম্বর দিন", variant: "destructive" });
      }
      if (form.password.length < 6) {
        return toast({ title: "Password কমপক্ষে ৬ অক্ষর", variant: "destructive" });
      }
    }

    setSaving(true);
    try {
      // 1) Insert staff record
      const { data: staffRow, error: sErr } = await supabase.from("staff").insert({
        name: form.name,
        phone: form.phone || form.loginPhone,
        nid: form.nid, address: form.address,
        position: form.position, salary: form.salary,
        shop_id: form.shopId,
      }).select().single();
      if (sErr) throw sErr;

      // 2) Optionally create login + permissions via edge function
      if (form.createLogin) {
        const permsObj: Record<string, boolean> = {};
        ACCESS_POINTS.forEach(a => { if (permissions[a.key]) permsObj[a.key] = true; });

        const { data, error: fnErr } = await supabase.functions.invoke("create-shop-user", {
          body: {
            phone: form.loginPhone,
            password: form.password,
            full_name: form.name,
            shop_id: form.shopId,
            staff_id: staffRow.id,
            permissions: permsObj,
          },
        });
        if (fnErr || (data as any)?.error) {
          throw new Error((data as any)?.error || fnErr?.message || "Login তৈরি ব্যর্থ");
        }
      }

      toast({ title: "স্টাফ সংরক্ষিত", description: form.createLogin ? "মোবাইল নম্বর দিয়ে login করতে পারবে" : "Staff record তৈরি হয়েছে" });
      setOpen(false);
      setForm({ ...emptyForm });
      load();
    } catch (e: any) {
      toast({ title: e.message ?? "ত্রুটি", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const del = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm(t("confirmDelete"))) return;
    await supabase.from("staff").delete().eq("id", id); load();
  };

  return (
    <div>
      <PageHeader title={t("staff")} subtitle={t("staffSubtitle")}
        actions={isAdmin ? <PrimaryButton onClick={openSheet}><Plus className="h-5 w-5" />{t("addStaff")}</PrimaryButton> : undefined} />

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3 md:gap-4 mb-5">
        <SurfaceCard className="p-4">
          <p className="text-[11px] text-muted-foreground font-bn">মোট স্টাফ</p>
          <p className="text-2xl font-black mt-1">{items.length}</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-[11px] text-muted-foreground font-bn">সক্রিয়</p>
          <p className="text-2xl font-black mt-1 text-emerald-600">{activeCount}</p>
        </SurfaceCard>
        <SurfaceCard className="p-4">
          <p className="text-[11px] text-muted-foreground font-bn">মাসিক বেতন</p>
          <p className="text-2xl font-black mt-1">{fmt(totalSalary)}</p>
        </SurfaceCard>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="নাম বা ফোন দিয়ে খুঁজুন" className="pl-9" />
        </div>
        <Select value={posFilter} onValueChange={setPosFilter}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[100] bg-popover">
            <SelectItem value="all">সব পদ</SelectItem>
            {POSITIONS.map(p => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filteredItems.length === 0 && <div className="col-span-full text-center text-muted-foreground py-16">{t("noResults")}</div>}
        {filteredItems.map(s => {
          const posLabel = POSITIONS.find(p => p.value === s.position)?.label ?? s.position;
          const initial = (s.name ?? "?").trim().charAt(0).toUpperCase();
          return (
            <div
              key={s.id}
              className="bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-5 transition-all hover:-translate-y-1 hover:shadow-lg cursor-pointer group"
              onClick={() => nav(`/staff/${s.id}/history`)}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white flex items-center justify-center font-black text-lg shrink-0">
                    {initial}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-base truncate">{s.name}</h3>
                    <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary/10 text-primary">{posLabel}</span>
                  </div>
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); nav(`/staff/${s.id}/history`); }} title="History">
                    <History className="h-4 w-4" />
                  </Button>
                  {isAdmin && <Button size="icon" variant="ghost" className="text-destructive h-8 w-8" onClick={(e) => del(e, s.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              </div>
              {s.phone && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="h-3 w-3" />{s.phone}</p>}
              <div className="mt-3 pt-3 border-t border-[hsl(var(--surface-container-high))] flex justify-between text-sm">
                <span className="text-muted-foreground">{t("salary")}</span>
                <span className="font-bold">{fmt(Number(s.salary))}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Side-slide Sheet for adding staff */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl overflow-y-auto bg-[hsl(var(--surface-container-lowest))] p-0"
        >
          <div className="sticky top-0 z-10 bg-[hsl(var(--surface-container-lowest))] border-b border-[hsl(var(--border))] px-5 md:px-7 py-4">
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="text-xl font-extrabold flex items-center gap-2 font-bn">
                <span className="h-9 w-9 rounded-xl bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white flex items-center justify-center shadow shadow-pink-500/30">
                  <UserCog className="h-5 w-5" />
                </span>
                নতুন কর্মী যোগ করুন
              </SheetTitle>
              <SheetDescription className="font-bn">
                নাম, পদ, বেতন ও Custom Access সহ একসাথে সেট করুন
              </SheetDescription>
            </SheetHeader>
          </div>

          <div className="px-5 md:px-7 py-5 space-y-6">
            {/* Basic info */}
            <section className="space-y-3">
              <h4 className="text-xs font-extrabold uppercase tracking-wider text-muted-foreground font-bn">মূল তথ্য</h4>
              <div>
                <Label className="text-xs font-bn">নাম *</Label>
                <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="পুরো নাম" className="mt-1" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bn">পদ (Position)</Label>
                  <Select value={form.position} onValueChange={onPositionChange}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent className="z-[100] bg-popover">
                      {POSITIONS.map(p => (
                        <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bn">বেতন</Label>
                  <Input type="number" value={form.salary} onChange={e => setForm({ ...form, salary: +e.target.value })} className="mt-1" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs font-bn">ফোন নম্বর</Label>
                  <Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs font-bn">NID</Label>
                  <Input value={form.nid} onChange={e => setForm({ ...form, nid: e.target.value })} className="mt-1" />
                </div>
              </div>
              <div>
                <Label className="text-xs font-bn">ঠিকানা</Label>
                <Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs font-bn">Shop নির্বাচন *</Label>
                <Select value={form.shopId} onValueChange={(v) => setForm({ ...form, shopId: v })}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="একটি shop বেছে নিন" />
                  </SelectTrigger>
                  <SelectContent className="z-[100] bg-popover">
                    {shops.map(sh => (
                      <SelectItem key={sh.id} value={sh.id}>
                        <span className="inline-flex items-center gap-2"><StoreIcon className="h-3.5 w-3.5" />{sh.name}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Login provisioning */}
            <section className="space-y-3 border-t border-[hsl(var(--border))] pt-5">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-[hsl(var(--primary))]" />
                  <h4 className="text-sm font-extrabold font-bn">App Login তৈরি করুন</h4>
                </div>
                <Switch checked={form.createLogin} onCheckedChange={(v) => setForm({ ...form, createLogin: v })} />
              </div>
              {form.createLogin && (
                <>
                  <p className="text-[11px] text-muted-foreground font-bn">
                    এই কর্মী নিচের <b>মোবাইল নম্বর</b> ও <b>Password</b> দিয়ে App-এ login করতে পারবে। শুধুমাত্র নিচে দেওয়া access গুলো দেখতে পাবে।
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <Label className="text-xs font-bn">মোবাইল নম্বর (Login)</Label>
                      <Input type="tel" value={form.loginPhone} onChange={e => setForm({ ...form, loginPhone: e.target.value })} placeholder="01XXXXXXXXX" className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-xs">Password</Label>
                      <Input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="কমপক্ষে ৬ অক্ষর" className="mt-1" />
                    </div>
                  </div>
                </>
              )}
            </section>

            {/* Permissions */}
            {form.createLogin && (
              <section className="space-y-3 border-t border-[hsl(var(--border))] pt-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h4 className="text-sm font-extrabold font-bn">Access নিয়ন্ত্রণ</h4>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                      {grantedCount}/{ACCESS_POINTS.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={grantAll}>সব অন</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={clearAll}>সব বন্ধ</Button>
                    <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => applyPreset(form.position)}>Preset</Button>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground font-bn">
                  প্রতিটি section আলাদা করে toggle করুন। যেমন: Cashier-এর জন্য শুধু "ড্যাশবোর্ড" রাখুন।
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {ACCESS_POINTS.map(a => {
                    const Icon = a.icon;
                    const on = !!permissions[a.key];
                    return (
                      <label
                        key={a.key}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition-all
                          ${on
                            ? "bg-emerald-500/10 border-emerald-500/40"
                            : "bg-[hsl(var(--surface-container-low))] border-[hsl(var(--border))] hover:border-[hsl(var(--primary)/0.4)]"}`}
                      >
                        <span className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0
                          ${on ? "bg-emerald-500 text-white" : "bg-[hsl(var(--surface-container-high))] text-muted-foreground"}`}>
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="flex-1 text-xs font-bold font-bn truncate">{a.label}</span>
                        <Switch checked={on} onCheckedChange={(v) => togglePerm(a.key, v)} />
                      </label>
                    );
                  })}
                </div>
              </section>
            )}
          </div>

          <div className="sticky bottom-0 bg-[hsl(var(--surface-container-lowest))] border-t border-[hsl(var(--border))] px-5 md:px-7 py-3 flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={saving}>{t("cancel")}</Button>
            <Button onClick={save} disabled={saving} className="gradient-primary text-primary-foreground">
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              সংরক্ষণ করুন
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
