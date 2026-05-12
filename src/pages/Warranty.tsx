import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck, Search, Calendar, User, Package, AlertTriangle, CheckCircle2, Phone, Clock, Boxes } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";

type WarrantySaleItem = {
  id: string;
  product_id: string;
  product_name: string;
  qty: number;
  unit_price: number;
  warranty_months: number;
  warranty_until: string;
  sales: {
    invoice_no: string;
    created_at: string;
    customers: { id: string; name: string; phone: string | null } | null;
  };
};

type WarrantyProduct = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  stock: number;
  image_url: string | null;
  warranty_months: number | null;
};

export default function Warranty() {
  const { fmt } = useT();
  const [tab, setTab] = useState("customers");
  const [q, setQ] = useState("");
  const [items, setItems] = useState<WarrantySaleItem[]>([]);
  const [products, setProducts] = useState<WarrantyProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: it }, { data: pr }] = await Promise.all([
        supabase
          .from("sale_items")
          .select("id, product_id, product_name, qty, unit_price, warranty_months, warranty_until, sales!inner(invoice_no, created_at, customers(id, name, phone))")
          .not("warranty_until", "is", null)
          .order("warranty_until", { ascending: false })
          .limit(500),
        supabase
          .from("products")
          .select("id, name, sku, price, stock, image_url, warranty_months")
          .eq("has_warranty", true)
          .order("name"),
      ]);
      setItems((it as any) ?? []);
      setProducts((pr as any) ?? []);
      setLoading(false);
    })();
  }, []);

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const stats = useMemo(() => {
    let active = 0, expired = 0, expiringSoon = 0;
    items.forEach(r => {
      const until = new Date(r.warranty_until);
      const days = Math.ceil((until.getTime() - today.getTime()) / 86400000);
      if (days < 0) expired++;
      else if (days <= 30) { active++; expiringSoon++; }
      else active++;
    });
    return { totalProducts: products.length, active, expired, expiringSoon };
  }, [items, products, today]);

  const filteredItems = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter(r =>
      r.product_name.toLowerCase().includes(needle) ||
      r.sales.invoice_no.toLowerCase().includes(needle) ||
      r.sales.customers?.name?.toLowerCase().includes(needle) ||
      r.sales.customers?.phone?.includes(needle)
    );
  }, [items, q]);

  const filteredProducts = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return products;
    return products.filter(p =>
      p.name.toLowerCase().includes(needle) ||
      p.sku?.toLowerCase().includes(needle)
    );
  }, [products, q]);

  // group customer warranties by customer
  const groupedByCustomer = useMemo(() => {
    const map = new Map<string, { name: string; phone: string | null; items: WarrantySaleItem[] }>();
    filteredItems.forEach(r => {
      const key = r.sales.customers?.id ?? "_walkin";
      const name = r.sales.customers?.name ?? "Walk-in কাস্টমার";
      const phone = r.sales.customers?.phone ?? null;
      if (!map.has(key)) map.set(key, { name, phone, items: [] });
      map.get(key)!.items.push(r);
    });
    return [...map.entries()].map(([id, v]) => ({ id, ...v }));
  }, [filteredItems]);

  return (
    <div>
      <PageHeader
        title="ওয়ারেন্টি ম্যানেজমেন্ট"
        subtitle="ওয়ারেন্টিযুক্ত পণ্য ও কাস্টমার ওয়ারেন্টি — সম্পূর্ণ তালিকা ও যাচাই"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <SurfaceCard className="p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-info/10 text-info flex items-center justify-center"><Boxes className="h-5 w-5" /></div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">ওয়ারেন্টিযুক্ত পণ্য</div>
            <div className="text-xl font-black">{stats.totalProducts}</div>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-success/10 text-success flex items-center justify-center"><ShieldCheck className="h-5 w-5" /></div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">সক্রিয় ওয়ারেন্টি</div>
            <div className="text-xl font-black text-success">{stats.active}</div>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-warning/10 text-warning flex items-center justify-center"><Clock className="h-5 w-5" /></div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">শীঘ্রই শেষ (৩০ দিন)</div>
            <div className="text-xl font-black text-warning">{stats.expiringSoon}</div>
          </div>
        </SurfaceCard>
        <SurfaceCard className="p-4 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-destructive/10 text-destructive flex items-center justify-center"><AlertTriangle className="h-5 w-5" /></div>
          <div>
            <div className="text-[11px] text-muted-foreground font-medium">মেয়াদ শেষ</div>
            <div className="text-xl font-black text-destructive">{stats.expired}</div>
          </div>
        </SurfaceCard>
      </div>

      {/* Search */}
      <SurfaceCard className="p-4 mb-5">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="পণ্যের নাম, ইনভয়েস, কাস্টমার নাম/মোবাইল…"
            className="h-12 pl-12 text-sm"
          />
        </div>
      </SurfaceCard>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="customers">কাস্টমার ওয়ারেন্টি ({filteredItems.length})</TabsTrigger>
          <TabsTrigger value="products">ওয়ারেন্টিযুক্ত পণ্য ({filteredProducts.length})</TabsTrigger>
        </TabsList>

        {/* CUSTOMER WARRANTIES */}
        <TabsContent value="customers" className="space-y-4">
          {loading ? (
            <SurfaceCard className="p-12 text-center text-muted-foreground">লোড হচ্ছে…</SurfaceCard>
          ) : groupedByCustomer.length === 0 ? (
            <SurfaceCard className="p-12 text-center text-muted-foreground">কোনো কাস্টমার ওয়ারেন্টি পাওয়া যায়নি</SurfaceCard>
          ) : groupedByCustomer.map(group => (
            <SurfaceCard key={group.id} className="p-5">
              <div className="flex items-center gap-3 pb-3 mb-3 border-b border-[hsl(var(--surface-container))]">
                <div className="h-10 w-10 rounded-full gradient-primary text-primary-foreground font-bold flex items-center justify-center">
                  {group.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-black text-foreground">{group.name}</h3>
                  {group.phone && (
                    <div className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3" /> {group.phone}</div>
                  )}
                </div>
                <StatusPill tone="info">{group.items.length} টি পণ্য</StatusPill>
              </div>

              <div className="space-y-2">
                {group.items.map(r => {
                  const until = new Date(r.warranty_until);
                  const sold = new Date(r.sales.created_at);
                  const days = Math.ceil((until.getTime() - today.getTime()) / 86400000);
                  const valid = days >= 0;
                  const soon = valid && days <= 30;
                  return (
                    <div key={r.id} className={`rounded-xl p-3 border-l-4 ${!valid ? "border-destructive bg-destructive/5" : soon ? "border-warning bg-warning/5" : "border-success bg-success/5"}`}>
                      <div className="flex items-start gap-3 flex-wrap">
                        <div className={`p-2 rounded-lg ${!valid ? "bg-destructive/10 text-destructive" : soon ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}>
                          {valid ? <ShieldCheck className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-bold text-sm">{r.product_name}</span>
                            <span className="text-[10px] text-muted-foreground">× {r.qty}</span>
                            {valid
                              ? soon
                                ? <StatusPill tone="warning">{days} দিন বাকি</StatusPill>
                                : <StatusPill tone="success"><CheckCircle2 className="inline h-3 w-3 mr-0.5" />{days} দিন বাকি</StatusPill>
                              : <StatusPill tone="destructive">মেয়াদ শেষ</StatusPill>}
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-[11px] text-muted-foreground mt-1.5">
                            <div className="flex items-center gap-1"><Package className="h-3 w-3" /> {r.sales.invoice_no}</div>
                            <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> বিক্রয়: {sold.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}</div>
                            <div className="flex items-center gap-1"><ShieldCheck className="h-3 w-3" /> মেয়াদ: {until.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}</div>
                            <div className="flex items-center gap-1"><Clock className="h-3 w-3" /> {r.warranty_months} মাস</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </SurfaceCard>
          ))}
        </TabsContent>

        {/* PRODUCTS WITH WARRANTY */}
        <TabsContent value="products">
          {loading ? (
            <SurfaceCard className="p-12 text-center text-muted-foreground">লোড হচ্ছে…</SurfaceCard>
          ) : filteredProducts.length === 0 ? (
            <SurfaceCard className="p-12 text-center text-muted-foreground">ওয়ারেন্টিযুক্ত কোনো পণ্য নেই</SurfaceCard>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProducts.map(p => (
                <SurfaceCard key={p.id} className="p-4 flex gap-3">
                  <div className="w-16 h-16 rounded-xl bg-[hsl(var(--surface-container-high))] flex items-center justify-center overflow-hidden shrink-0">
                    {p.image_url ? (
                      <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <Package className="h-7 w-7 text-muted-foreground/50" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-bold text-sm line-clamp-2">{p.name}</h3>
                    {p.sku && <div className="text-[10px] text-muted-foreground">SKU: {p.sku}</div>}
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <StatusPill tone="info"><ShieldCheck className="inline h-3 w-3 mr-0.5" />{p.warranty_months ?? 0} মাস</StatusPill>
                      <span className="text-xs font-bold text-primary">৳{fmt(p.price)}</span>
                      <span className="text-[10px] text-muted-foreground">স্টক: {p.stock}</span>
                    </div>
                  </div>
                </SurfaceCard>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
