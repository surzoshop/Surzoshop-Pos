import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Plus, Pencil, Trash2, Search, Package, Tag, Printer, FileSpreadsheet } from "lucide-react";
import { PageHeader, StatusPill, SurfaceCard, PrimaryButton } from "@/components/PageHeader";
import { ImageUpload } from "@/components/ImageUpload";
import { AddProductSheet } from "@/components/AddProductSheet";
import { exportProductsToExcel } from "@/lib/exportProducts";
import { useShop } from "@/hooks/useShop";

// Build prefix from product name: first 2 letters (A-Z), uppercase
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

export default function Products() {
  const { t, fmt } = useT();
  const { role } = useAuth();
  const { currentShop } = useShop();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [addSheet, setAddSheet] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [newCat, setNewCat] = useState("");
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null);
  const [searchParams] = useSearchParams();
  const [selectedCat, setSelectedCat] = useState<string | null>(searchParams.get("category"));
  const [showCatSuggest, setShowCatSuggest] = useState(false);
  const isAdmin = role === "admin";

  // sync URL param changes
  useEffect(() => { setSelectedCat(searchParams.get("category")); }, [searchParams]);


  const empty = { name: "", category_id: "", price: 0, cost: 0, stock: 0, unit: "pcs", image_url: "" };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true).order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
    ]);
    setItems(p ?? []);
    setCats(c ?? []);
  };
  useEffect(() => {
    load();
    const ch = supabase
      .channel("products-categories-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const startEdit = (p: any) => { setEditing(p); setAddSheet(true); };
  const startNew = () => { setEditing(null); setAddSheet(true); };

  const save = async () => {
    if (!form.name?.trim()) return toast({ title: "নাম দিন", variant: "destructive" });
    const payload: any = {
      name: form.name.trim(),
      price: Number(form.price) || 0,
      cost: Number(form.cost) || 0,
      stock: Number(form.stock) || 0,
      unit: form.unit || "pcs",
      category_id: form.category_id || null,
      image_url: form.image_url || null,
    };
    if (!editing) {
      // auto-generate unique barcode for new product
      payload.barcode = await generateBarcode(payload.name);
    }
    const { error } = editing
      ? await supabase.from("products").update(payload).eq("id", editing.id)
      : await supabase.from("products").insert(payload);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: editing ? "পণ্য আপডেট হয়েছে" : "পণ্য যোগ হয়েছে" });
    setOpen(false); load();
  };

  const saveCat = async () => {
    if (editCat) {
      if (!editCat.name.trim()) return;
      const { error } = await supabase.from("categories").update({ name: editCat.name.trim() }).eq("id", editCat.id);
      if (error) return toast({ title: error.message, variant: "destructive" });
      setEditCat(null); load();
      return toast({ title: "ক্যাটাগরি আপডেট হয়েছে" });
    }
    if (!newCat.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: newCat.trim() });
    if (error) return toast({ title: error.message, variant: "destructive" });
    setNewCat(""); load();
    toast({ title: "ক্যাটাগরি যোগ হয়েছে" });
  };

  const delCat = async (id: string) => {
    if (!confirm("ক্যাটাগরি মুছবেন?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    // Check if product is referenced by sales/purchases/etc.
    const [{ count: saleCount }, { count: purCount }, { count: adjCount }, { count: retCount }] = await Promise.all([
      supabase.from("sale_items").select("id", { count: "exact", head: true }).eq("product_id", id),
      supabase.from("purchase_items").select("id", { count: "exact", head: true }).eq("product_id", id),
      supabase.from("stock_adjustments").select("id", { count: "exact", head: true }).eq("product_id", id),
      supabase.from("sales_return_items").select("id", { count: "exact", head: true }).eq("product_id", id),
    ]);
    const refs = (saleCount ?? 0) + (purCount ?? 0) + (adjCount ?? 0) + (retCount ?? 0);
    if (refs > 0) {
      const ok = confirm(`এই পণ্যটি ${refs} টি লেনদেনে ব্যবহৃত হয়েছে — সম্পূর্ণ মুছে ফেলা যাবে না। শুধু নিষ্ক্রিয় (archive) করে দেওয়া হবে। চালিয়ে যাবেন?`);
      if (!ok) return;
      const { error } = await supabase.from("products").update({ is_active: false, stock: 0 }).eq("id", id);
      if (error) return toast({ title: error.message, variant: "destructive" });
      toast({ title: "পণ্য আর্কাইভ করা হয়েছে (লেনদেন রক্ষা)" });
      return load();
    }
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "পণ্য মুছে ফেলা হয়েছে" });
    load();
  };

  const filtered = items.filter(p => {
    if (selectedCat && p.category_id !== selectedCat) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    const cName = (cats.find(c => c.id === p.category_id)?.name ?? "").toLowerCase();
    return p.name.toLowerCase().includes(q)
      || p.barcode?.toLowerCase().includes(q)
      || p.sku?.toLowerCase().includes(q)
      || cName.includes(q);
  });

  // Category suggestions when typing in search
  const catSuggestions = search
    ? cats.filter(c => c.name.toLowerCase().startsWith(search.toLowerCase())).slice(0, 6)
    : [];

  // Per-category counts: number of distinct products & total stock units
  const catCounts = cats.reduce<Record<string, { products: number; stock: number }>>((acc, c) => {
    const list = items.filter(p => p.category_id === c.id);
    acc[c.id] = {
      products: list.length,
      stock: list.reduce((s, p) => s + Number(p.stock || 0), 0),
    };
    return acc;
  }, {});
  const totalStockUnits = items.reduce((s, p) => s + Number(p.stock || 0), 0);

  const totalValue = filtered.reduce((a, p) => a + Number(p.price) * Number(p.stock), 0);
  const totalCostValue = filtered.reduce((a, p) => a + Number(p.cost) * Number(p.stock), 0);
  const catName = (id: string | null) => cats.find(c => c.id === id)?.name ?? "—";

  // Stock status: alert when 1 or 2 pieces left, otherwise green rounded pill
  const stockBadge = (p: any) => {
    if (p.stock === 0) return <StatusPill tone="destructive">{t("outOfStock")}</StatusPill>;
    if (p.stock <= 2) return <StatusPill tone="warning">⚠ {p.stock} {p.unit}</StatusPill>;
    return (
      <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-extrabold text-success">
        {p.stock} {p.unit}
      </span>
    );
  };


  return (
    <div>
      <PageHeader
        title={t("productsInventory")}
        subtitle={t("productsSubtitle")}
        actions={isAdmin && (
          <div className="flex flex-wrap gap-2">
            <Link
              to="/products/barcodes"
              className="inline-flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-2.5 rounded-xl text-sm font-bold hover:brightness-105 active:scale-95 transition-all"
            >
              <Printer className="h-4 w-4" /> বারকোড প্রিন্ট
            </Link>
            <button
              onClick={() => setCatOpen(true)}
              className="inline-flex items-center gap-2 bg-info/10 text-info px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-info/15 active:scale-95 transition-all"
            >
              <Tag className="h-4 w-4" /> ক্যাটাগরি যোগ করুন
            </button>
            <PrimaryButton onClick={startNew}><Plus className="h-5 w-5" />{t("addProduct")}</PrimaryButton>
          </div>
        )}
      />

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-6 md:mb-8">
        <MiniStat icon={<Package className="h-5 w-5 md:h-6 md:w-6 text-primary" />} bg="bg-primary/10"
          label={t("totalProducts")} value={items.length.toString()} />
        <MiniStat icon={<Package className="h-5 w-5 md:h-6 md:w-6 text-info" />} bg="bg-info/10"
          label="মোট স্টক বিক্রয় মূল্য" value={fmt(totalValue)} />
        {isAdmin && (
          <MiniStat icon={<Package className="h-5 w-5 md:h-6 md:w-6 text-[hsl(var(--secondary-foreground))]" />} bg="bg-secondary/30"
            label="মোট স্টক ক্রয় মূল্য" value={fmt(totalCostValue)} />
        )}
      </div>

      <SurfaceCard className="p-3 md:p-6">
        <div className="relative mb-3">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={e => { setSearch(e.target.value); setShowCatSuggest(true); }}
            onFocus={() => setShowCatSuggest(true)}
            onBlur={() => setTimeout(() => setShowCatSuggest(false), 150)}
            placeholder={t("productSearch")}
            className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
          {showCatSuggest && catSuggestions.length > 0 && (
            <div className="absolute z-20 left-0 right-0 mt-1 bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--surface-container-high))] rounded-xl shadow-lg overflow-hidden animate-fade-in">
              <div className="px-3 pt-2 pb-1 text-[10px] font-extrabold uppercase tracking-widest text-muted-foreground">ক্যাটাগরি সাজেশন</div>
              {catSuggestions.map(c => (
                <button
                  key={c.id}
                  onMouseDown={() => { setSelectedCat(c.id); setSearch(""); setShowCatSuggest(false); }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 hover:bg-primary/10 text-left transition-colors"
                >
                  <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                    <Tag className="h-3.5 w-3.5 text-primary" /> {c.name}
                  </span>
                  <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{catCounts[c.id]?.stock ?? 0} টি · {catCounts[c.id]?.products ?? 0} পণ্য</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Category chip filters */}
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-4 md:mb-5">
            <button
              onClick={() => setSelectedCat(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                selectedCat === null
                  ? "bg-primary text-primary-foreground shadow-md"
                  : "bg-[hsl(var(--surface-container-low))] text-foreground hover:bg-primary/10"
              }`}
            >
              সব ({totalStockUnits} টি)
            </button>
            {cats.map(c => (
              <button
                key={c.id}
                onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                  selectedCat === c.id
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-[hsl(var(--surface-container-low))] text-foreground hover:bg-primary/10"
                }`}
              >
                <Tag className="h-3 w-3" /> {c.name}
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                  selectedCat === c.id ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"
                }`}>{catCounts[c.id]?.stock ?? 0}</span>
              </button>
            ))}
          </div>
        )}

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">{t("noResults")}</div>}
          {filtered.map(p => (
            <div key={p.id} className="bg-[hsl(var(--surface-container-low))] p-3 rounded-xl flex gap-3">
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-[hsl(var(--surface-container-high))] shrink-0 flex items-center justify-center">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                ) : (
                  <Package className="h-6 w-6 text-muted-foreground/50" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-foreground truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{catName(p.category_id)} · {p.barcode ?? "—"}</p>
                  </div>
                  {isAdmin && (
                    <div className="flex shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  )}
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-muted-foreground font-semibold">বিক্রয়</span>
                    <span className="font-bold text-primary text-sm">{fmt(p.price)}</span>
                  </div>
                  {isAdmin && (
                    <div className="flex flex-col items-end">
                      <span className="text-[10px] text-muted-foreground font-semibold">ক্রয়</span>
                      <span className="font-bold text-info text-sm">{fmt(p.cost)}</span>
                    </div>
                  )}
                  {stockBadge(p)}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="text-xs uppercase tracking-wider text-foreground border-b-2 border-[hsl(var(--surface-container))]">
                <th className="pb-3 font-extrabold w-14"></th>
                <th className="pb-3 font-extrabold">{t("name")}</th>
                <th className="pb-3 font-extrabold">{t("category")}</th>
                <th className="pb-3 font-extrabold">{t("barcode")}</th>
                <th className="pb-3 font-extrabold">বিক্রয় মূল্য</th>
                {isAdmin && <th className="pb-3 font-extrabold">ক্রয় মূল্য</th>}
                <th className="pb-3 font-extrabold">{t("stock")}</th>
                {isAdmin && <th className="pb-3 font-extrabold text-right">{t("actions")}</th>}
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-[hsl(var(--surface-container))]">
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>
              )}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[hsl(var(--surface-container-low))] transition-colors">
                  <td className="py-2">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[hsl(var(--surface-container-high))] flex items-center justify-center">
                      {p.image_url ? (
                        <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                      ) : (
                        <Package className="h-5 w-5 text-muted-foreground/50" />
                      )}
                    </div>
                  </td>
                  <td className="py-2 font-bold text-foreground">{p.name}</td>
                  <td className="py-2 text-foreground/80 font-semibold">{catName(p.category_id)}</td>
                  <td className="py-2 text-foreground/70 font-mono text-xs font-bold">{p.barcode || "—"}</td>
                  <td className="py-2 font-extrabold text-primary">{fmt(p.price)}</td>
                  {isAdmin && <td className="py-2 font-extrabold text-info">{fmt(p.cost)}</td>}
                  <td className="py-2">{stockBadge(p)}</td>
                  {isAdmin && (
                    <td className="py-2 text-right">
                      <Button size="icon" variant="ghost" onClick={() => startEdit(p)}><Pencil className="h-4 w-4" /></Button>
                      <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(p.id)}><Trash2 className="h-4 w-4" /></Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* Add/Edit handled by AddProductSheet (same UX as Purchase entry) */}

      {/* Category Dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-md w-[95vw]">
          <DialogHeader><DialogTitle>ক্যাটাগরি ব্যবস্থাপনা</DialogTitle></DialogHeader>
          <div className="space-y-3">
            {editCat ? (
              <div className="flex gap-2">
                <Input
                  autoFocus
                  value={editCat.name}
                  onChange={e => setEditCat({ ...editCat, name: e.target.value })}
                  placeholder="ক্যাটাগরির নতুন নাম"
                  onKeyDown={e => e.key === "Enter" && saveCat()}
                />
                <Button onClick={saveCat} className="gradient-primary shrink-0">সংরক্ষণ</Button>
                <Button variant="ghost" onClick={() => setEditCat(null)} className="shrink-0">বাতিল</Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="নতুন ক্যাটাগরির নাম" onKeyDown={e => e.key === "Enter" && saveCat()} />
                <Button onClick={saveCat} className="gradient-primary shrink-0"><Plus className="h-4 w-4" /></Button>
              </div>
            )}
            <div className="max-h-60 overflow-y-auto space-y-1">
              {cats.length === 0 && <p className="text-sm text-center text-muted-foreground py-4">এখনো কোনো ক্যাটাগরি নেই</p>}
              {cats.map(c => (
                <div key={c.id} className="flex items-center justify-between bg-[hsl(var(--surface-container-low))] px-3 py-2 rounded-lg">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-primary" /> {c.name}
                    <span className="text-[10px] font-extrabold text-primary bg-primary/10 px-2 py-0.5 rounded-full">{catCounts[c.id]?.stock ?? 0} টি · {catCounts[c.id]?.products ?? 0} পণ্য</span>
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-info" onClick={() => setEditCat({ id: c.id, name: c.name })}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delCat(c.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AddProductSheet open={addSheet} onOpenChange={(v) => { setAddSheet(v); if (!v) setEditing(null); }} onSaved={load} editing={editing} />
    </div>
  );
}

function MiniStat({ icon, bg, label, value }: any) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-3 md:p-6 rounded-2xl flex items-center gap-2 md:gap-4 transition-all hover:-translate-y-1">
      <div className={`p-2 md:p-3 ${bg} rounded-xl shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] md:text-sm font-medium truncate">{label}</p>
        <h3 className="text-sm md:text-xl font-bold text-foreground mt-0.5 truncate">{value}</h3>
      </div>
    </div>
  );
}
