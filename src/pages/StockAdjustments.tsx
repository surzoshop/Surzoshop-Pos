import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Pencil, Search, Info, Package, History } from "lucide-react";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";

export default function StockAdjustments() {
  const { t, lang, fmt } = useT();
  const { user } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [newStock, setNewStock] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const load = async () => {
    const [p, h] = await Promise.all([
      supabase.from("products").select("id,name,stock,unit,barcode,image_url,is_active").eq("is_active", true).order("name"),
      supabase.from("stock_adjustments").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    setProducts(p.data ?? []);
    setHistory(h.data ?? []);
  };
  useEffect(() => { load(); }, []);

  const startEdit = (p: any) => {
    setEditing(p);
    setNewStock(Number(p.stock) || 0);
    setReason("");
  };

  const save = async () => {
    if (!editing) return;
    const qty = Number(newStock);
    if (Number.isNaN(qty) || qty < 0) return toast({ title: "সঠিক পরিমাণ দিন", variant: "destructive" });
    setSaving(true);
    // type='count' trigger sets products.stock = qty (everywhere)
    const { error } = await supabase.from("stock_adjustments").insert({
      product_id: editing.id,
      product_name: editing.name,
      type: "count" as any,
      qty,
      reason: reason || `স্টক সংশোধন: ${editing.stock} → ${qty}`,
      created_by: user!.id,
    } as any);
    setSaving(false);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "স্টক আপডেট হয়েছে" });
    setEditing(null);
    load();
  };

  const filtered = useMemo(() =>
    products.filter(p => !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.barcode?.includes(search)
    ), [products, search]);

  const tone = (tp: string) => tp === "damage" || tp === "transfer_out" ? "destructive" : tp === "return" || tp === "transfer_in" ? "success" : "info";

  return (
    <div>
      <PageHeader title={t("stockAdjustments")} subtitle="যেকোনো পণ্যের স্টক ভুল হলে সরাসরি সংশোধন করুন" />

      {/* Description card */}
      <SurfaceCard className="p-4 md:p-5 mb-4 md:mb-6 border-l-4 border-info">
        <div className="flex gap-3">
          <div className="p-2 bg-info/10 rounded-lg shrink-0 h-fit">
            <Info className="h-5 w-5 text-info" />
          </div>
          <div className="text-sm text-foreground/80 leading-relaxed">
            <p className="font-bold text-foreground mb-1">স্টক সমন্বয় কী?</p>
            <p>
              যদি কোনো পণ্যের প্রকৃত স্টক (গুদামে যা আছে) আর সফটওয়্যারে দেখানো স্টকের মধ্যে অমিল হয়
              — যেমন গণনায় ভুল, পণ্য নষ্ট, হারিয়ে যাওয়া, বা ফেরত —
              তাহলে এখান থেকে সঠিক পরিমাণ বসিয়ে সংশোধন করুন। নতুন স্টকটি ইনভেন্টরি, বিক্রয়, রিপোর্ট সব জায়গায় সাথে সাথে আপডেট হয়ে যাবে।
            </p>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard className="p-3 md:p-6">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="পণ্য খুঁজুন..."
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-[hsl(var(--surface-container-low))] border-none focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
            />
          </div>
          <Button variant="outline" onClick={() => setShowHistory(true)} className="gap-2 shrink-0">
            <History className="h-4 w-4" /> ইতিহাস
          </Button>
        </div>

        {/* Mobile: cards */}
        <div className="md:hidden space-y-2">
          {filtered.length === 0 && <div className="py-12 text-center text-muted-foreground text-sm">কোনো পণ্য নেই</div>}
          {filtered.map(p => (
            <div key={p.id} className="bg-[hsl(var(--surface-container-low))] p-3 rounded-xl flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-[hsl(var(--surface-container-high))] shrink-0 flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <Package className="h-5 w-5 text-muted-foreground/50" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-foreground truncate text-sm">{p.name}</p>
                <div className="mt-1">
                  {p.stock === 0 ? <StatusPill tone="destructive">শেষ</StatusPill>
                    : p.stock <= 2 ? <StatusPill tone="warning">⚠ {p.stock} {p.unit}</StatusPill>
                    : <span className="inline-flex items-center rounded-full border border-success/30 bg-success/10 px-2.5 py-0.5 text-xs font-extrabold text-success">{p.stock} {p.unit}</span>}
                </div>
              </div>
              <Button size="sm" onClick={() => startEdit(p)} className="gradient-primary gap-1 shrink-0">
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
            </div>
          ))}
        </div>

        {/* Desktop: table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground border-b border-[hsl(var(--surface-container))]">
                <th className="pb-3 font-bold w-14"></th>
                <th className="pb-3 font-bold">পণ্য</th>
                <th className="pb-3 font-bold">বারকোড</th>
                <th className="pb-3 font-bold">বর্তমান স্টক</th>
                <th className="pb-3 font-bold text-right">ক্রিয়া</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-[hsl(var(--surface-container))]">
              {filtered.length === 0 && <tr><td colSpan={5} className="py-12 text-center text-muted-foreground">কোনো পণ্য নেই</td></tr>}
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-2">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-[hsl(var(--surface-container-high))] flex items-center justify-center">
                      {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" loading="lazy" /> : <Package className="h-5 w-5 text-muted-foreground/50" />}
                    </div>
                  </td>
                  <td className="py-2 font-semibold text-foreground">{p.name}</td>
                  <td className="py-2 text-muted-foreground font-mono text-xs">{p.barcode || "—"}</td>
                  <td className="py-2">
                    {p.stock === 0 ? <StatusPill tone="destructive">শেষ</StatusPill>
                      : p.stock === 1 ? <StatusPill tone="warning">⚠ {p.stock} {p.unit}</StatusPill>
                      : <span className="font-extrabold text-success">{p.stock} {p.unit}</span>}
                  </td>
                  <td className="py-2 text-right">
                    <Button size="sm" onClick={() => startEdit(p)} className="gradient-primary gap-1">
                      <Pencil className="h-3.5 w-3.5" /> স্টক সংশোধন
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle>স্টক সংশোধন</DialogTitle>
            <DialogDescription>
              {editing && <>পণ্য: <span className="font-bold text-foreground">{editing.name}</span></>}
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <div className="space-y-4">
              <div className="bg-[hsl(var(--surface-container-low))] p-3 rounded-lg flex items-center justify-between">
                <span className="text-sm text-muted-foreground">বর্তমান স্টক</span>
                <span className="font-bold text-lg">{editing.stock} {editing.unit}</span>
              </div>
              <div>
                <Label>নতুন প্রকৃত স্টক <span className="text-destructive">*</span></Label>
                <div className="flex items-center gap-2 mt-1">
                  <Button type="button" variant="outline" size="icon" onClick={() => setNewStock(Math.max(0, newStock - 1))}>−</Button>
                  <Input type="number" min={0} value={newStock} onChange={e => setNewStock(+e.target.value)} className="text-center text-lg font-bold" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setNewStock(newStock + 1)}>+</Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1">যা প্রকৃতপক্ষে গুদামে আছে সেটি লিখুন</p>
              </div>
              <div>
                <Label>কারণ (ঐচ্ছিক)</Label>
                <Input value={reason} onChange={e => setReason(e.target.value)} placeholder="যেমন: গণনায় ভুল, ক্ষতিগ্রস্ত..." />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>বাতিল</Button>
            <Button onClick={save} disabled={saving} className="gradient-primary">{saving ? "সংরক্ষণ..." : "সংরক্ষণ"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History dialog */}
      <Dialog open={showHistory} onOpenChange={setShowHistory}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-2xl w-[95vw] max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>সমন্বয়ের ইতিহাস (সর্বশেষ ৫০)</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {history.length === 0 && <p className="text-center text-muted-foreground py-8 text-sm">কোনো ইতিহাস নেই</p>}
            {history.map(i => (
              <div key={i.id} className="bg-[hsl(var(--surface-container-low))] p-3 rounded-lg flex items-center justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm truncate">{i.product_name}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {new Date(i.created_at).toLocaleString(lang === "bn" ? "bn-BD" : "en-US")}
                    {i.reason && ` • ${i.reason}`}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <StatusPill tone={tone(i.type) as any}>
                    {i.type === "count" ? "সংশোধন" : i.type === "damage" ? "ক্ষতি" : i.type === "return" ? "ফেরত" : i.type === "transfer_in" ? "ইন" : "আউট"}
                  </StatusPill>
                  <span className="font-bold text-sm">{i.qty}</span>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
