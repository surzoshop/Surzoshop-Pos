import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PrimaryButton, StatusPill } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  Store, Plus, Users, ArrowRightCircle, UserPlus, Loader2, ShieldCheck,
  TrendingUp, Wallet, Receipt, AlertCircle, Package, ShoppingBag,
} from "lucide-react";
import { ALL_PAGES, PageKey } from "@/hooks/useShop";
import { useT } from "@/i18n/LanguageContext";

const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "ড্যাশবোর্ড", pos: "POS (বিক্রয়)", sales: "বিক্রয় খাতা",
  customers: "ক্রেতা", contacts: "যোগাযোগ", installments: "কিস্তি",
  products: "পণ্য তালিকা", warranty: "ওয়ারেন্টি",
  suppliers: "সরবরাহকারী", purchases: "ক্রয়", "stock-adjustments": "স্টক সমন্বয়",
  expenses: "খরচ", reports: "রিপোর্ট", staff: "কর্মী",
  attendance: "হাজিরা", shops: "শপ",
};

// Default access for a new Staff (per user requirement)
const DEFAULT_STAFF_PERMS: Partial<Record<PageKey, boolean>> = {
  dashboard: true, pos: true, sales: true, customers: true,
  installments: true, products: true, warranty: true,
};

// Pages a Staff is NEVER allowed to see (admin-only / sensitive)
const STAFF_RESTRICTED: PageKey[] = ["shops", "staff", "reports", "expenses"];

type ShopStats = {
  shop_id: string | null;
  totalSales: number;
  totalDue: number;
  totalPaid: number;
  salesCount: number;
  installmentCount: number;
  pendingInstallments: number;
  totalExpenses: number;
  productCount: number;
};

export default function Shops() {
  const { t, fmt } = useT();
  const { shops, currentShop, setCurrentShopId, isSuperAdmin, refresh } = useShop();
  const { user } = useAuth();
  const [openCreate, setOpenCreate] = useState(false);
  const [openStaff, setOpenStaff] = useState<string | null>(null);
  const [stats, setStats] = useState<Record<string, ShopStats>>({});
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    if (!isSuperAdmin) return;
    void loadStats();
    // eslint-disable-next-line
  }, [shops.length, isSuperAdmin]);

  const loadStats = async () => {
    setLoadingStats(true);
    const [sales, insts, exp, prods] = await Promise.all([
      supabase.from("sales").select("shop_id,total,paid,due"),
      supabase.from("installments").select("shop_id,status"),
      supabase.from("expenses").select("shop_id,amount"),
      supabase.from("products").select("shop_id,id"),
    ]);
    const map: Record<string, ShopStats> = {};
    const ensure = (id: string | null) => {
      const k = id ?? "_none";
      if (!map[k]) map[k] = { shop_id: id, totalSales: 0, totalDue: 0, totalPaid: 0, salesCount: 0, installmentCount: 0, pendingInstallments: 0, totalExpenses: 0, productCount: 0 };
      return map[k];
    };
    shops.forEach(s => ensure(s.id));
    (sales.data ?? []).forEach((r: any) => {
      const s = ensure(r.shop_id);
      s.totalSales += Number(r.total) || 0;
      s.totalPaid += Number(r.paid) || 0;
      s.totalDue += Number(r.due) || 0;
      s.salesCount += 1;
    });
    (insts.data ?? []).forEach((r: any) => {
      const s = ensure(r.shop_id);
      s.installmentCount += 1;
      if (r.status !== "paid") s.pendingInstallments += 1;
    });
    (exp.data ?? []).forEach((r: any) => {
      const s = ensure(r.shop_id);
      s.totalExpenses += Number(r.amount) || 0;
    });
    (prods.data ?? []).forEach((r: any) => {
      const s = ensure(r.shop_id);
      s.productCount += 1;
    });
    setStats(map);
    setLoadingStats(false);
  };

  const totals = useMemo(() => {
    const init: ShopStats = { shop_id: null, totalSales: 0, totalDue: 0, totalPaid: 0, salesCount: 0, installmentCount: 0, pendingInstallments: 0, totalExpenses: 0, productCount: 0 };
    return Object.values(stats).reduce((a, s) => ({
      shop_id: null,
      totalSales: a.totalSales + s.totalSales,
      totalDue: a.totalDue + s.totalDue,
      totalPaid: a.totalPaid + s.totalPaid,
      salesCount: a.salesCount + s.salesCount,
      installmentCount: a.installmentCount + s.installmentCount,
      pendingInstallments: a.pendingInstallments + s.pendingInstallments,
      totalExpenses: a.totalExpenses + s.totalExpenses,
      productCount: a.productCount + s.productCount,
    }), init);
  }, [stats]);

  if (!isSuperAdmin) {
    return (
      <div className="max-w-md mx-auto mt-20 text-center">
        <Card className="p-8">
          <ShieldCheck className="h-12 w-12 text-primary mx-auto mb-3" />
          <h3 className="text-lg font-bold">Super Admin Only</h3>
          <p className="text-sm text-muted-foreground mt-2">শুধু super admin এই pageটি দেখতে পারবেন।</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="All Shops"
        subtitle="সব shop-এর বিক্রি, বাকি, কিস্তি ও খরচ একসাথে দেখুন।"
        actions={
          <PrimaryButton onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4" /> নতুন Shop
          </PrimaryButton>
        }
      />

      {/* Aggregate totals */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">সব Shop মিলিয়ে</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <TotalTile to="/sales" icon={<TrendingUp className="h-5 w-5" />} label="মোট বিক্রি" value={fmt(totals.totalSales)} tone="primary" />
          <TotalTile to="/sales" icon={<Wallet className="h-5 w-5" />} label="মোট আদায়" value={fmt(totals.totalPaid)} tone="success" />
          <TotalTile to="/sales" icon={<AlertCircle className="h-5 w-5" />} label="মোট বাকি" value={fmt(totals.totalDue)} tone="danger" />
          <TotalTile to="/installments" icon={<Receipt className="h-5 w-5" />} label="কিস্তি (বাকি/মোট)" value={`${totals.pendingInstallments} / ${totals.installmentCount}`} tone="warning" />
          <TotalTile to="/expenses" icon={<ShoppingBag className="h-5 w-5" />} label="মোট খরচ" value={fmt(totals.totalExpenses)} tone="muted" />
          <TotalTile to="/products" icon={<Package className="h-5 w-5" />} label="মোট পণ্য" value={`${totals.productCount}`} tone="muted" />
          <TotalTile to="/sales" icon={<Receipt className="h-5 w-5" />} label="বিক্রির সংখ্যা" value={`${totals.salesCount}`} tone="muted" />
          <TotalTile to="/shops" icon={<Store className="h-5 w-5" />} label="মোট Shop" value={`${shops.length}`} tone="primary" />
        </div>
      </div>

      {/* Per-shop cards */}
      <div>
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mb-3">প্রত্যেক Shop-এর বিস্তারিত</h3>
        <div className="grid md:grid-cols-2 gap-5">
          {shops.map((s) => {
            const active = currentShop?.id === s.id;
            const st = stats[s.id] ?? { totalSales: 0, totalDue: 0, totalPaid: 0, salesCount: 0, installmentCount: 0, pendingInstallments: 0, totalExpenses: 0, productCount: 0 } as ShopStats;
            return (
              <Card key={s.id} className={`group relative overflow-hidden p-5 border border-[hsl(var(--border))] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${active ? "border-[hsl(var(--primary)/0.45)] shadow-md" : "hover:border-[hsl(var(--primary)/0.22)]"}`}>
                <span className="absolute left-0 top-3 bottom-3 w-1 rounded-r-full bg-[linear-gradient(180deg,hsl(var(--primary-glow)),hsl(var(--primary)))] opacity-80 transition-all duration-300 group-hover:top-0 group-hover:bottom-0 group-hover:opacity-100" />
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-xl bg-[linear-gradient(135deg,hsl(var(--primary-glow)),hsl(var(--primary)))] text-[hsl(var(--primary-foreground))] flex items-center justify-center shadow-lg shadow-[hsl(var(--primary)/0.22)] transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3 group-active:scale-95">
                      <Store className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="font-extrabold text-lg text-foreground font-bn">{s.name}</h3>
                      <p className="text-xs font-medium text-muted-foreground">{s.address || "—"}</p>
                    </div>
                  </div>
                  {active && <StatusPill tone="success">Active</StatusPill>}
                </div>

                <div className="grid grid-cols-2 gap-2 mb-4">
                  <ShopStatTile label="বিক্রি" value={fmt(st.totalSales)} tone="primary" />
                  <ShopStatTile label="আদায়" value={fmt(st.totalPaid)} tone="success" />
                  <ShopStatTile label="বাকি" value={fmt(st.totalDue)} tone="danger" />
                  <ShopStatTile label="কিস্তি বাকি" value={`${st.pendingInstallments} / ${st.installmentCount}`} tone="warning" />
                  <ShopStatTile label="খরচ" value={fmt(st.totalExpenses)} tone="muted" />
                  <ShopStatTile label="পণ্য" value={`${st.productCount}`} tone="muted" />
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={active ? "secondary" : "default"}
                    onClick={() => setCurrentShopId(s.id)}
                    className="flex-1 transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                  >
                    <ArrowRightCircle className="h-4 w-4 mr-1" />
                    {active ? "Selected" : "Switch"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => setOpenStaff(s.id)} className="transition-all duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]">
                    <UserPlus className="h-4 w-4 mr-1" /> কর্মী
                  </Button>
                </div>
              </Card>
            );
          })}
          {shops.length === 0 && (
            <Card className="p-8 text-center col-span-full">
              <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="font-medium">কোনো shop নেই</p>
              <p className="text-sm text-muted-foreground mb-4">প্রথম shop তৈরি করুন</p>
              <PrimaryButton onClick={() => setOpenCreate(true)}><Plus className="h-4 w-4" /> Create Shop</PrimaryButton>
            </Card>
          )}
        </div>
        {loadingStats && <p className="text-xs text-muted-foreground mt-2 flex items-center gap-2"><Loader2 className="h-3 w-3 animate-spin" /> Stats loading…</p>}
      </div>

      <CreateShopDialog open={openCreate} onOpenChange={setOpenCreate} ownerId={user?.id ?? null} onCreated={refresh} />
      {openStaff && <StaffAccessDialog shopId={openStaff} onClose={() => setOpenStaff(null)} />}
    </div>
  );
}

function TotalTile({ to, icon, label, value, tone }: { to: string; icon: React.ReactNode; label: string; value: string; tone: "primary" | "success" | "danger" | "warning" | "muted" }) {
  const T = SHOP_TONES[tone] ?? SHOP_TONES.primary;
  return (
    <Link
      to={to}
      className={`group relative overflow-hidden bg-[hsl(var(--surface-container-lowest))] rounded-2xl p-4 pl-5 hover:-translate-y-1 hover:shadow-lg active:translate-y-0 active:scale-[0.98] transition-all duration-300 border border-[hsl(var(--border))] ${T.accent}`}
    >
      <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-r-full ${T.bar} opacity-80 transition-all duration-300 group-hover:top-0 group-hover:bottom-0 group-hover:opacity-100`} />
      <div className={`h-9 w-9 rounded-xl flex items-center justify-center mb-2 text-[hsl(var(--primary-foreground))] ${T.iconGrad} shadow-lg ${T.iconShadow} transition-all duration-300 group-hover:scale-110 group-hover:-rotate-6 group-active:rotate-0 group-active:scale-95`}>{icon}</div>
      <p className="text-[11px] font-extrabold text-foreground/80 uppercase tracking-wide font-bn truncate">{label}</p>
      <p className={`text-lg font-extrabold text-foreground mt-1 font-bn truncate transition-colors duration-300 ${T.valueText}`}>{value}</p>
    </Link>
  );
}

function ShopStatTile({ label, value, tone }: { label: string; value: string; tone: "primary" | "success" | "danger" | "warning" | "muted" }) {
  const T = SHOP_TONES[tone] ?? SHOP_TONES.primary;
  return (
    <div className={`group/stat relative overflow-hidden rounded-xl border bg-[hsl(var(--surface-container-lowest))] px-3 py-2.5 pl-4 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md ${T.accent}`}>
      <span className={`absolute left-0 top-2 bottom-2 w-0.5 rounded-r-full ${T.bar} opacity-75 transition-all duration-300 group-hover/stat:top-0 group-hover/stat:bottom-0`} />
      <p className="text-[10px] font-extrabold text-foreground/75 uppercase tracking-wider font-bn truncate">{label}</p>
      <p className={`text-sm font-extrabold text-foreground mt-0.5 font-bn truncate transition-colors duration-300 ${T.valueText}`}>{value}</p>
    </div>
  );
}

const SHOP_TONES: Record<"primary" | "success" | "danger" | "warning" | "muted", { iconGrad: string; iconShadow: string; accent: string; bar: string; valueText: string }> = {
  primary: { iconGrad: "bg-[linear-gradient(135deg,hsl(var(--primary-glow)),hsl(var(--primary)))]", iconShadow: "shadow-[hsl(var(--primary)/0.28)]", accent: "hover:border-[hsl(var(--primary)/0.45)]", bar: "bg-[linear-gradient(180deg,hsl(var(--primary-glow)),hsl(var(--primary)))]", valueText: "group-hover:text-[hsl(var(--primary))] group-hover/stat:text-[hsl(var(--primary))]" },
  success: { iconGrad: "bg-[linear-gradient(135deg,hsl(var(--success)/0.72),hsl(var(--success)))]", iconShadow: "shadow-[hsl(var(--success)/0.24)]", accent: "hover:border-[hsl(var(--success)/0.42)]", bar: "bg-[linear-gradient(180deg,hsl(var(--success)/0.72),hsl(var(--success)))]", valueText: "group-hover:text-[hsl(var(--success))] group-hover/stat:text-[hsl(var(--success))]" },
  danger: { iconGrad: "bg-[linear-gradient(135deg,hsl(var(--destructive)/0.72),hsl(var(--destructive)))]", iconShadow: "shadow-[hsl(var(--destructive)/0.24)]", accent: "hover:border-[hsl(var(--destructive)/0.38)]", bar: "bg-[linear-gradient(180deg,hsl(var(--destructive)/0.72),hsl(var(--destructive)))]", valueText: "group-hover:text-[hsl(var(--destructive))] group-hover/stat:text-[hsl(var(--destructive))]" },
  warning: { iconGrad: "bg-[linear-gradient(135deg,hsl(var(--warning)),hsl(var(--secondary)))]", iconShadow: "shadow-[hsl(var(--warning)/0.24)]", accent: "hover:border-[hsl(var(--warning)/0.48)]", bar: "bg-[linear-gradient(180deg,hsl(var(--warning)),hsl(var(--secondary)))]", valueText: "group-hover:text-[hsl(var(--warning-foreground))] group-hover/stat:text-[hsl(var(--warning-foreground))]" },
  muted: { iconGrad: "bg-[linear-gradient(135deg,hsl(var(--info)/0.78),hsl(var(--primary)))]", iconShadow: "shadow-[hsl(var(--info)/0.20)]", accent: "hover:border-[hsl(var(--info)/0.36)]", bar: "bg-[linear-gradient(180deg,hsl(var(--info)/0.78),hsl(var(--primary)))]", valueText: "group-hover:text-[hsl(var(--info))] group-hover/stat:text-[hsl(var(--info))]" },
};

function CreateShopDialog({ open, onOpenChange, ownerId, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; ownerId: string | null; onCreated: () => void; }) {
  const { toast } = useToast();
  const [name, setName] = useState(""); const [address, setAddress] = useState(""); const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (!name) return;
    setBusy(true);
    const { error } = await supabase.from("shops").insert({ name, address, phone, owner_id: ownerId });
    setBusy(false);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    toast({ title: "Shop created" });
    setName(""); setAddress(""); setPhone("");
    onOpenChange(false); onCreated();
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>নতুন Shop তৈরি করুন</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>নাম</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>ঠিকানা</Label><Input value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div><Label>ফোন</Label><Input value={phone} onChange={e => setPhone(e.target.value)} /></div>
          <Button onClick={submit} disabled={busy || !name} className="w-full">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}তৈরি করুন
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function StaffAccessDialog({ shopId, onClose }: { shopId: string; onClose: () => void; }) {
  const { toast } = useToast();
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("shop_users").select("*").eq("shop_id", shopId).order("created_at");
    setMembers(data ?? []); setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const togglePerm = async (memberId: string, page: PageKey, perms: any) => {
    const next = { ...(perms || {}), [page]: !perms?.[page] };
    const { error } = await supabase.from("shop_users").update({ permissions: next }).eq("id", memberId);
    if (error) return toast({ title: "Error", description: error.message, variant: "destructive" });
    setMembers(ms => ms.map(m => m.id === memberId ? { ...m, permissions: next } : m));
  };

  const removeMember = async (id: string) => {
    if (!confirm("Remove this user from shop?")) return;
    await supabase.from("shop_users").delete().eq("id", id);
    load();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Staff Access</DialogTitle></DialogHeader>

        <div className="flex justify-end mb-2">
          <Button size="sm" onClick={() => setShowCreate(true)}><UserPlus className="h-4 w-4 mr-1" /> নতুন Staff</Button>
        </div>

        {loading ? <Loader2 className="h-6 w-6 animate-spin mx-auto" /> :
          members.length === 0 ? <p className="text-sm text-muted-foreground text-center py-6">কোনো staff নেই।</p> :
          <div className="space-y-4">
            {members.map(m => (
              <Card key={m.id} className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <p className="font-bold">{m.display_name || m.email}</p>
                    <p className="text-xs text-muted-foreground">{m.email}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => removeMember(m.id)}>Remove</Button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {ALL_PAGES.filter(p => !STAFF_RESTRICTED.includes(p)).map(p => (
                    <label key={p} className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-2 rounded-lg">
                      <Switch checked={!!m.permissions?.[p]} onCheckedChange={() => togglePerm(m.id, p, m.permissions)} />
                      <span>{PAGE_LABELS[p]}</span>
                    </label>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        }

        {showCreate && <CreateStaffDialog shopId={shopId} onClose={() => { setShowCreate(false); load(); }} />}
      </DialogContent>
    </Dialog>
  );
}

function CreateStaffDialog({ shopId, onClose }: { shopId: string; onClose: () => void; }) {
  const { toast } = useToast();
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [name, setName] = useState(""); const [position, setPosition] = useState("Staff");
  const [busy, setBusy] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean>>({ ...DEFAULT_STAFF_PERMS } as Record<string, boolean>);

  const togglePerm = (p: PageKey) => setPerms(prev => ({ ...prev, [p]: !prev[p] }));

  const submit = async () => {
    if (!email || !password) return toast({ title: "Email ও password দিন", variant: "destructive" });
    if (password.length < 6) return toast({ title: "Password কমপক্ষে ৬ অক্ষরের হতে হবে", variant: "destructive" });
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-shop-user", {
      body: { email, password, full_name: name || email, shop_id: shopId, permissions: perms },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      return toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
    }
    toast({ title: "কর্মী তৈরি হয়েছে", description: `${email} এই shop-এ যুক্ত হয়েছেন` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-primary" /> নতুন কর্মী যোগ করুন
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <span className="text-sm font-bold text-primary">ভূমিকা: Staff (এই shop-এ locked)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><Label>পূর্ণ নাম</Label><Input value={name} onChange={e => setName(e.target.value)} placeholder="যেমন: রহিম উদ্দিন" /></div>
            <div><Label>পদবি</Label><Input value={position} onChange={e => setPosition(e.target.value)} placeholder="Staff / Cashier / Manager" /></div>
            <div><Label>Email (login)</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@example.com" /></div>
            <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="কমপক্ষে ৬ অক্ষর" /></div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <p className="text-sm font-bold">পেজ অ্যাক্সেস (Page Access)</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" type="button" onClick={() => setPerms({ ...DEFAULT_STAFF_PERMS } as Record<string, boolean>)}>Default</Button>
                <Button size="sm" variant="outline" type="button" onClick={() => {
                  const all: Record<string, boolean> = {};
                  ALL_PAGES.filter(p => !STAFF_RESTRICTED.includes(p)).forEach(p => { all[p] = true; });
                  setPerms(all);
                }}>সব দিন</Button>
                <Button size="sm" variant="outline" type="button" onClick={() => setPerms({})}>কিছু না</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-72 overflow-y-auto bg-muted/20 p-3 rounded-lg">
              {ALL_PAGES.filter(p => !STAFF_RESTRICTED.includes(p)).map(p => (
                <label key={p} className="flex items-center gap-2 text-sm bg-background px-3 py-2 rounded-lg border border-border cursor-pointer hover:border-primary/50 transition-colors">
                  <Switch checked={!!perms[p]} onCheckedChange={() => togglePerm(p)} />
                  <span className="font-medium">{PAGE_LABELS[p]}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              ⚠️ Staff <b>শপ লিস্ট, কর্মী, রিপোর্ট ও খরচ</b> দেখতে পাবে না (super admin only)।
            </p>
          </div>

          <Button onClick={submit} disabled={busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}কর্মী তৈরি করুন
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
