import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Printer, Search, Plus, Minus, RefreshCcw, ScanLine, Info } from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";

type Product = { id: string; name: string; barcode: string | null; price: number };

function generateBarcode() {
  const ts = Date.now().toString(36).toUpperCase();
  const rnd = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `SS${ts}${rnd}`;
}

export default function BarcodePrint() {
  const { role } = useAuth();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const isAdmin = role === "admin";

  const load = async () => {
    const { data } = await supabase.from("products").select("id,name,barcode,price").order("name");
    setProducts(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const ensureBarcode = async (p: Product) => {
    if (p.barcode) return p.barcode;
    const code = generateBarcode();
    const { error } = await supabase.from("products").update({ barcode: code }).eq("id", p.id);
    if (error) { toast({ title: error.message, variant: "destructive" }); return null; }
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, barcode: code } : x));
    return code;
  };

  const regenerate = async (p: Product) => {
    if (!confirm("এই পণ্যের জন্য নতুন বারকোড তৈরি হবে। পুরোনোটি আর কাজ করবে না। চালিয়ে যাবেন?")) return;
    const code = generateBarcode();
    const { error } = await supabase.from("products").update({ barcode: code }).eq("id", p.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, barcode: code } : x));
  };

  const inc = (id: string, d: number) => setQty(q => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  const setQ = (id: string, v: number) => setQty(q => ({ ...q, [id]: Math.max(0, v) }));

  const filtered = products.filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const items = useMemo(() => {
    const list: { product: Product; index: number }[] = [];
    Object.entries(qty).forEach(([id, n]) => {
      const p = products.find(x => x.id === id);
      if (!p || !n) return;
      for (let i = 0; i < n; i++) list.push({ product: p, index: i });
    });
    return list;
  }, [qty, products]);

  const handlePrint = async () => {
    // ensure all selected items have a barcode
    for (const { product } of items) {
      if (!product.barcode) await ensureBarcode(product);
    }
    setTimeout(() => window.print(), 200);
  };

  const totalLabels = items.length;

  return (
    <div>
      <PageHeader
        title="বারকোড প্রিন্ট"
        subtitle="পণ্যের জন্য বারকোড তৈরি করুন এবং একসাথে print করুন। স্ক্যান করলে POS এ স্বয়ংক্রিয় add হবে।"
      />

      {/* Instructions */}
      <div className="bg-info/10 border border-info/20 rounded-2xl p-4 mb-4 print:hidden">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-bold text-foreground">কীভাবে কাজ করে:</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-foreground/80">
              <li>প্রতিটি পণ্যের জন্য কয়টা বারকোড লাগবে select করুন</li>
              <li>"Print" বাটন চাপুন → printer-এ sticker print হবে</li>
              <li>পণ্যে sticker লাগিয়ে POS-এ scan করুন → automatically cart-এ add হবে</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 print:hidden">
        {/* Product list */}
        <SurfaceCard className="p-4 lg:col-span-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="পণ্য খুঁজুন..." className="pl-10 h-11" />
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {filtered.map(p => (
              <div key={p.id} className="bg-[hsl(var(--surface-container-low))] p-3 rounded-xl flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{p.name}</p>
                  <p className="text-[11px] font-mono text-muted-foreground truncate">{p.barcode ?? "বারকোড নেই"}</p>
                </div>
                {isAdmin && p.barcode && (
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => regenerate(p)} title="নতুন বারকোড">
                    <RefreshCcw className="h-3.5 w-3.5" />
                  </Button>
                )}
                <div className="flex items-center gap-1 bg-background rounded-lg p-1">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => inc(p.id, -1)}><Minus className="h-3 w-3" /></Button>
                  <input
                    type="number"
                    value={qty[p.id] ?? 0}
                    onChange={e => setQ(p.id, parseInt(e.target.value) || 0)}
                    className="w-12 text-center bg-transparent text-sm font-bold focus:outline-none"
                  />
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => inc(p.id, 1)}><Plus className="h-3 w-3" /></Button>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <p className="text-sm text-center py-8 text-muted-foreground">কোনো পণ্য নেই</p>}
          </div>
        </SurfaceCard>

        {/* Summary */}
        <SurfaceCard className="p-4 h-fit sticky top-4">
          <h3 className="font-bold mb-3 flex items-center gap-2"><ScanLine className="h-4 w-4 text-primary" /> Print Summary</h3>
          <div className="bg-primary/5 rounded-xl p-4 mb-3">
            <p className="text-xs text-muted-foreground">মোট লেবেল</p>
            <p className="text-3xl font-black text-primary">{totalLabels}</p>
          </div>
          <Button onClick={handlePrint} disabled={totalLabels === 0} className="w-full gradient-primary h-12">
            <Printer className="h-4 w-4 mr-2" /> Print {totalLabels > 0 && `(${totalLabels})`}
          </Button>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">
            টিপ: A4 পেপারে label sheet ব্যবহার করুন। থার্মাল printer-এর জন্য browser print settings থেকে paper size সেট করুন।
          </p>
        </SurfaceCard>
      </div>

      {/* Print area */}
      <div className="hidden print:block print-area">
        {items.map((it, idx) => (
          <BarcodeLabel key={idx} product={it.product} />
        ))}
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area {
            position: absolute; left: 0; top: 0; width: 100%;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 4mm;
            padding: 5mm;
          }
          @page { margin: 5mm; }
        }
      `}</style>
    </div>
  );
}

function BarcodeLabel({ product }: { product: Product }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && product.barcode) {
      try {
        JsBarcode(ref.current, product.barcode, {
          format: "CODE128",
          displayValue: true,
          fontSize: 12,
          height: 40,
          margin: 2,
          width: 1.5,
        });
      } catch {}
    }
  }, [product.barcode]);
  return (
    <div className="border border-black/30 rounded p-2 text-center break-inside-avoid">
      <p className="text-[10px] font-bold truncate">{product.name}</p>
      <svg ref={ref} className="w-full" />
      <p className="text-[10px] font-bold">৳ {Number(product.price).toFixed(2)}</p>
    </div>
  );
}
