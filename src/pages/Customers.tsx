import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "@/lib/activityLog";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, Search, Phone, MapPin, Pencil, Eye, Users, ShoppingBag, Wallet } from "lucide-react";
import { PageHeader, SurfaceCard, PrimaryButton } from "@/components/PageHeader";
import { AddCustomerSheet } from "@/components/AddCustomerSheet";

export default function Customers() {
  const { t, fmt } = useT();
  const { role } = useAuth();
  const { toast } = useToast();
  const nav = useNavigate();
  const [items, setItems] = useState<any[]>([]);
  const [stats, setStats] = useState<Record<string, { count: number; total: number; due: number }>>({});
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const isAdmin = role === "admin";

  const load = async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
    const { data: s } = await supabase.from("sales").select("customer_id,total,due");
    const map: Record<string, { count: number; total: number; due: number }> = {};
    (s ?? []).forEach((row: any) => {
      if (!row.customer_id) return;
      const m = map[row.customer_id] || { count: 0, total: 0, due: 0 };
      m.count += 1;
      m.total += Number(row.total) || 0;
      m.due += Number(row.due) || 0;
      map[row.customer_id] = m;
    });
    setStats(map);
  };
  useEffect(() => { load(); }, []);

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  const openPreview = (c: any) => nav(`/customers/${c.id}`);

  const filtered = items.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search) || c.alt_phone?.includes(search));

  const totals = useMemo(() => {
    const totalCustomers = items.length;
    let totalPurchases = 0, totalDue = 0;
    Object.values(stats).forEach(s => { totalPurchases += s.count; totalDue += s.due; });
    return { totalCustomers, totalPurchases, totalDue };
  }, [items, stats]);

  const openAdd = () => { setEditing(null); setOpen(true); };
  const openEdit = (c: any) => { setEditing(c); setOpen(true); };

  return (
    <div>
      <PageHeader
        title={t("customers")}
        subtitle={t("customersSubtitle")}
        actions={<PrimaryButton onClick={openAdd}><Plus className="h-5 w-5" />{t("addCustomer")}</PrimaryButton>}
      />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <SurfaceCard className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-info/10 text-info flex items-center justify-center">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">মোট ক্রেতা</div>
            <div className="text-2xl font-black">{totals.totalCustomers}</div>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-success/10 text-success flex items-center justify-center">
            <ShoppingBag className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">মোট ক্রয় সংখ্যা</div>
            <div className="text-2xl font-black">{totals.totalPurchases}</div>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-5 flex items-center gap-4">
          <div className="h-12 w-12 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center">
            <Wallet className="h-6 w-6" />
          </div>
          <div>
            <div className="text-xs text-muted-foreground font-medium">মোট বকেয়া</div>
            <div className="text-2xl font-black">৳{fmt(totals.totalDue)}</div>
          </div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-4 mb-6">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t("search")}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
        </div>
      </SurfaceCard>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {filtered.length === 0 && (
          <div className="col-span-full text-center text-muted-foreground py-16">{t("noResults")}</div>
        )}
        {filtered.map(c => {
          const st = stats[c.id] || { count: 0, total: 0, due: 0 };
          return (
            <SurfaceCard key={c.id} className="p-5 transition-all hover:-translate-y-1 hover:shadow-lg flex flex-col">
              <div className="flex items-start gap-3 mb-4">
                {c.photo_url ? (
                  <img src={c.photo_url} alt={c.name} className="h-14 w-14 rounded-full object-cover ring-2 ring-primary/20" />
                ) : (
                  <div className="h-14 w-14 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-xl shrink-0">
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-foreground text-base truncate">{c.name}</h3>
                  {(c.phone || c.alt_phone) && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <Phone className="h-3 w-3" /> {c.phone}
                      {c.alt_phone && <span className="text-muted-foreground/70">· {c.alt_phone}</span>}
                    </div>
                  )}
                  {c.address && (
                    <div className="flex items-start gap-1.5 text-xs text-muted-foreground mt-0.5">
                      <MapPin className="h-3 w-3 mt-0.5 shrink-0" /> <span className="truncate">{c.address}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4 text-center">
                <div className="rounded-lg bg-[hsl(var(--surface-container-low))] py-2">
                  <div className="text-[10px] text-muted-foreground font-medium">ক্রয়</div>
                  <div className="text-sm font-bold">{st.count}</div>
                </div>
                <div className="rounded-lg bg-success/10 py-2">
                  <div className="text-[10px] text-success font-medium">মোট</div>
                  <div className="text-sm font-bold text-success">৳{fmt(st.total)}</div>
                </div>
                <div className="rounded-lg bg-destructive/10 py-2">
                  <div className="text-[10px] text-destructive font-medium">বকেয়া</div>
                  <div className="text-sm font-bold text-destructive">৳{fmt(st.due)}</div>
                </div>
              </div>

              <div className="flex gap-2 mt-auto">
                <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openPreview(c)}>
                  <Eye className="h-4 w-4" /> দেখুন
                </Button>
                {isAdmin && (
                  <>
                    <Button size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" /> এডিট
                    </Button>
                    <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(c.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </div>
            </SurfaceCard>
          );
        })}
      </div>

      <AddCustomerSheet open={open} onOpenChange={setOpen} onSaved={load} customer={editing} />

    </div>
  );
}

