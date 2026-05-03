import { useEffect, useState } from "react";
import { useShop } from "@/hooks/useShop";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, PrimaryButton, GhostButton, StatusPill } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { Store, Plus, Users, ArrowRightCircle, UserPlus, Loader2, ShieldCheck } from "lucide-react";
import { ALL_PAGES, PageKey } from "@/hooks/useShop";
import { useT } from "@/i18n/LanguageContext";

const PAGE_LABELS: Record<PageKey, string> = {
  dashboard: "Dashboard", pos: "POS", sales: "Sales", customers: "Customers",
  installments: "Installments", products: "Products", suppliers: "Suppliers",
  purchases: "Purchases", "stock-adjustments": "Stock Adjustments",
  expenses: "Expenses", reports: "Reports", staff: "Staff",
  attendance: "Attendance", shops: "Shops",
};

export default function Shops() {
  const { t } = useT();
  const { shops, currentShop, setCurrentShopId, isSuperAdmin, refresh } = useShop();
  const { user } = useAuth();
  const { toast } = useToast();
  const [openCreate, setOpenCreate] = useState(false);
  const [openStaff, setOpenStaff] = useState<string | null>(null);

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
        title="Multiple Shops"
        subtitle="সব shop manage করুন, switch করুন এবং staff access দিন।"
        actions={
          <PrimaryButton onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4" /> নতুন Shop
          </PrimaryButton>
        }
      />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {shops.map((s) => {
          const active = currentShop?.id === s.id;
          return (
            <Card key={s.id} className={`p-5 transition-all ${active ? "ring-2 ring-primary shadow-lg" : ""}`}>
              <div className="flex items-start justify-between mb-3">
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
                {active && <StatusPill tone="success">Active</StatusPill>}
              </div>
              <h3 className="font-bold text-lg">{s.name}</h3>
              <p className="text-sm text-muted-foreground">{s.address || "—"}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.phone || ""}</p>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  variant={active ? "secondary" : "default"}
                  onClick={() => setCurrentShopId(s.id)}
                  className="flex-1"
                >
                  <ArrowRightCircle className="h-4 w-4 mr-1" />
                  {active ? "Selected" : "Switch"}
                </Button>
                <Button size="sm" variant="outline" onClick={() => setOpenStaff(s.id)}>
                  <Users className="h-4 w-4" />
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

      <CreateShopDialog open={openCreate} onOpenChange={setOpenCreate} ownerId={user?.id ?? null} onCreated={refresh} />
      {openStaff && <StaffAccessDialog shopId={openStaff} onClose={() => setOpenStaff(null)} />}
    </div>
  );
}

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
                  {ALL_PAGES.filter(p => p !== "shops").map(p => (
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
  const [name, setName] = useState(""); const [busy, setBusy] = useState(false);
  const [perms, setPerms] = useState<Record<string, boolean>>({ dashboard: true, pos: true, sales: true, customers: true });

  const togglePerm = (p: PageKey) => setPerms(prev => ({ ...prev, [p]: !prev[p] }));

  const submit = async () => {
    if (!email || !password) return toast({ title: "Email ও password দিন", variant: "destructive" });
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("create-shop-user", {
      body: { email, password, full_name: name, shop_id: shopId, permissions: perms },
    });
    setBusy(false);
    if (error || (data as any)?.error) {
      return toast({ title: "Error", description: error?.message || (data as any)?.error, variant: "destructive" });
    }
    toast({ title: "Staff তৈরি হয়েছে", description: `${email} এই shop-এ যুক্ত হয়েছেন` });
    onClose();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle>নতুন Staff Account</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>নাম</Label><Input value={name} onChange={e => setName(e.target.value)} /></div>
          <div><Label>Email</Label><Input type="email" value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div><Label>Password</Label><Input type="password" value={password} onChange={e => setPassword(e.target.value)} /></div>

          <div>
            <p className="text-sm font-semibold mb-2">Page Access (custom)</p>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
              {ALL_PAGES.filter(p => p !== "shops").map(p => (
                <label key={p} className="flex items-center gap-2 text-sm bg-muted/40 px-3 py-2 rounded-lg">
                  <Switch checked={!!perms[p]} onCheckedChange={() => togglePerm(p)} />
                  <span>{PAGE_LABELS[p]}</span>
                </label>
              ))}
            </div>
          </div>

          <Button onClick={submit} disabled={busy} className="w-full">
            {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Create Staff
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
