import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Printer, Search, Plus, Minus, RefreshCcw, ScanLine, Info, Package, Tag } from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";

type Product = { id: string; name: string; barcode: string | null; price: number; category_id: string | null };
type Category = { id: string; name: string };
type PaperKind = "a4" | "mini";

function namePrefix(name: string): string {
  const ascii = (name || "").replace(/[^A-Za-z]/g, "");
  if (ascii.length >= 2) return ascii.slice(0, 2).toUpperCase();
  if (ascii.length === 1) return (ascii + "X").toUpperCase();
  return "PR";
}
async function nextSerial(): Promise<number | null> {
  const { data, error } = await supabase.rpc("next_barcode_serial");
  if (error) return null;
  return Number(data);
}

export default function BarcodePrint() {
  const { role } = useAuth();
  const { currentShop } = useShop();
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string | null>(null);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [showShopName, setShowShopName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const [bulkN, setBulkN] = useState<number>(10);
  const [paper, setPaper] = useState<PaperKind>("a4");
  const isAdmin = role === "admin";

  const load = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("id,name,barcode,price,category_id").order("name"),
      supabase.from("categories").select("id,name").order("name"),
    ]);
    setProducts(p ?? []);
    setCats(c ?? []);
  };
  useEffect(() => { load(); }, []);

  const ensureBarcode = async (p: Product): Promise<string | null> => {
    if (p.barcode) return p.barcode;
    const serial = await nextSerial();
    if (serial == null) { toast({ title: "Serial generate করা যায়নি", variant: "destructive" }); return null; }
    const code = `${namePrefix(p.name)}-${serial}`;
    const { error } = await supabase.from("products").update({ barcode: code }).eq("id", p.id);
    if (error) { toast({ title: error.message, variant: "destructive" }); return null; }
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, barcode: code } : x));
    return code;
  };

  const regenerate = async (p: Product) => {
    if (!confirm("নতুন বারকোড তৈরি হবে। পুরোনোটি আর কাজ করবে না।")) return;
    const serial = await nextSerial();
    if (serial == null) return toast({ title: "Serial generate করা যায়নি", variant: "destructive" });
    const code = `${namePrefix(p.name)}-${serial}`;
    const { error } = await supabase.from("products").update({ barcode: code }).eq("id", p.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setProducts(prev => prev.map(x => x.id === p.id ? { ...x, barcode: code } : x));
    toast({ title: "নতুন বারকোড তৈরি হয়েছে", description: code });
  };

  const inc = (id: string, d: number) => setQty(q => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + d) }));
  const setQ = (id: string, v: number) => setQty(q => ({ ...q, [id]: Math.max(0, v) }));

  const filtered = products.filter(p => {
    if (selectedCat && p.category_id !== selectedCat) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return p.name.toLowerCase().includes(q) || (p.barcode ?? "").toLowerCase().includes(q);
  });

  // Per-category counts
  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    cats.forEach(c => { m[c.id] = products.filter(p => p.category_id === c.id).length; });
    return m;
  }, [cats, products]);

  // Bulk actions on currently filtered (visible) products
  const selectAllVisible = (n = 1) => {
    setQty(prev => {
      const next = { ...prev };
      filtered.forEach(p => { next[p.id] = n; });
      return next;
    });
  };
  const clearAll = () => setQty({});

  const items = useMemo(() => {
    const list: { product: Product; copyNo: number; total: number }[] = [];
    Object.entries(qty).forEach(([id, n]) => {
      const p = products.find(x => x.id === id);
      if (!p || !n) return;
      for (let i = 0; i < n; i++) list.push({ product: p, copyNo: i + 1, total: n });
    });
    return list;
  }, [qty, products]);

  const handlePrint = async () => {
    for (const { product } of items) {
      if (!product.barcode) await ensureBarcode(product);
    }
    setTimeout(() => window.print(), 250);
  };

  const totalLabels = items.length;
  const selectedCount = Object.values(qty).filter(n => n > 0).length;

  return (
    <div>
      <PageHeader
        title="বারকোড প্রিন্ট"
        subtitle="Search/Category filter — bulk select — A4 grid বা mini thermal sticker হিসেবে print করুন।"
      />

      {/* Instructions */}
      <div className="bg-info/10 border border-info/20 rounded-2xl p-4 mb-4 print:hidden">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-bold text-foreground">কীভাবে কাজ করে:</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-foreground/80">
              <li>Search বা Category থেকে পণ্য filter করুন</li>
              <li>"Select All" বা "{bulkN} করে" চেপে bulk quantity দিন, অথবা প্রতিটি পণ্যের সংখ্যা manually লিখুন</li>
              <li>উপরে paper size বাছুন — <strong>A4</strong> (border সহ multiple grid) অথবা <strong>Mini sticker</strong> (38×25mm)</li>
              <li>"Print" → একসাথে সবগুলো লেবেল print হবে</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 print:hidden">
        {/* Product list */}
        <SurfaceCard className="p-4 lg:col-span-2">
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="পণ্যের নাম বা বারকোড দিন..." className="pl-10 h-11" />
          </div>

          {/* Category chips */}
          {cats.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              <button
                onClick={() => setSelectedCat(null)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  selectedCat === null ? "bg-primary text-primary-foreground shadow-md" : "bg-[hsl(var(--surface-container-low))] hover:bg-primary/10"
                }`}
              >সব ({products.length})</button>
              {cats.map(c => (
                <button
                  key={c.id}
                  onClick={() => setSelectedCat(selectedCat === c.id ? null : c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 transition-all ${
                    selectedCat === c.id ? "bg-primary text-primary-foreground shadow-md" : "bg-[hsl(var(--surface-container-low))] hover:bg-primary/10"
                  }`}
                >
                  <Tag className="h-3 w-3" /> {c.name}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                    selectedCat === c.id ? "bg-primary-foreground/20" : "bg-primary/15 text-primary"
                  }`}>{catCounts[c.id] ?? 0}</span>
                </button>
              ))}
            </div>
          )}

          {/* Bulk actions */}
          <div className="flex flex-wrap items-center gap-2 mb-3 p-2 bg-[hsl(var(--surface-container-low))] rounded-xl">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground pl-1">Bulk:</span>
            <Button size="sm" variant="secondary" className="h-8 text-xs font-bold" onClick={() => selectAllVisible(1)}>Select All ({filtered.length})</Button>
            <div className="flex items-center gap-1 bg-background rounded-lg p-1 shadow-sm">
              <input
                type="number"
                min={1}
                value={bulkN}
                onChange={e => setBulkN(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-14 text-center bg-transparent text-sm font-bold focus:outline-none"
              />
              <Button size="sm" className="h-7 text-xs font-bold gradient-primary" onClick={() => selectAllVisible(bulkN)}>
                {bulkN} করে
              </Button>
            </div>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-destructive font-bold" onClick={clearAll}>Clear</Button>
          </div>

          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {filtered.map(p => {
              const selected = (qty[p.id] ?? 0) > 0;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl flex items-center gap-3 transition-all ${
                    selected ? "bg-primary/8 ring-1 ring-primary/30" : "bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container))]"
                  }`}
                >
                  <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-fuchsia-400 to-purple-600 text-white shadow-md shadow-fuchsia-500/30">
                    <Package className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{p.barcode ?? "auto-generate"}</span>
                      <span className="font-bold text-primary">৳{Number(p.price).toFixed(0)}</span>
                    </div>
                  </div>
                  {isAdmin && p.barcode && (
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => regenerate(p)} title="নতুন বারকোড">
                      <RefreshCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <div className="flex items-center gap-1 bg-background rounded-lg p-1 shadow-sm">
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
              );
            })}
            {filtered.length === 0 && <p className="text-sm text-center py-8 text-muted-foreground">কোনো পণ্য নেই</p>}
          </div>
        </SurfaceCard>

        {/* Summary */}
        <SurfaceCard className="p-4 h-fit lg:sticky lg:top-4 space-y-4">
          <h3 className="font-bold flex items-center gap-2"><ScanLine className="h-4 w-4 text-primary" /> Print Summary</h3>

          <div className="grid grid-cols-2 gap-2">
            <div className="bg-primary/5 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">মোট লেবেল</p>
              <p className="text-2xl font-black text-primary">{totalLabels}</p>
            </div>
            <div className="bg-fuchsia-500/5 rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">পণ্য</p>
              <p className="text-2xl font-black text-fuchsia-600">{selectedCount}</p>
            </div>
          </div>

          {/* Paper size */}
          <div className="space-y-2 border-t border-[hsl(var(--surface-container-high))] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Paper Size</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setPaper("a4")}
                className={`p-3 rounded-xl text-left transition-all border-2 ${
                  paper === "a4" ? "border-primary bg-primary/10" : "border-transparent bg-[hsl(var(--surface-container-low))]"
                }`}
              >
                <p className="font-extrabold text-sm">A4 Page</p>
                <p className="text-[10px] text-muted-foreground">Grid (border সহ, multiple per page)</p>
              </button>
              <button
                onClick={() => setPaper("mini")}
                className={`p-3 rounded-xl text-left transition-all border-2 ${
                  paper === "mini" ? "border-primary bg-primary/10" : "border-transparent bg-[hsl(var(--surface-container-low))]"
                }`}
              >
                <p className="font-extrabold text-sm">Mini Sticker</p>
                <p className="text-[10px] text-muted-foreground">38×25mm thermal, একটি করে page</p>
              </button>
            </div>
          </div>

          {/* Label options */}
          <div className="space-y-2 border-t border-[hsl(var(--surface-container-high))] pt-3">
            <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Sticker Options</p>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showShopName} onChange={e => setShowShopName(e.target.checked)} className="rounded" />
              <span>দোকানের নাম দেখান</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={showPrice} onChange={e => setShowPrice(e.target.checked)} className="rounded" />
              <span>দাম দেখান</span>
            </label>
          </div>

          <Button onClick={handlePrint} disabled={totalLabels === 0} className="w-full gradient-primary h-12">
            <Printer className="h-4 w-4 mr-2" /> Print {totalLabels > 0 && `(${totalLabels})`}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
            {paper === "a4"
              ? "Print dialog: A4, Margins=Default, Scale=100%, Background graphics ✓"
              : "Mini printer: Paper size 38×25mm, margins 0, scale 100%"}
          </p>
        </SurfaceCard>
      </div>

      {/* ===== PRINT AREA — A4 grid ===== */}
      {paper === "a4" && (
        <div className="hidden print:block a4-print-area">
          <div className="a4-grid">
            {items.map((it, idx) => (
              <BarcodeSticker
                key={idx}
                product={it.product}
                shopName={showShopName ? (currentShop?.name ?? "") : ""}
                showPrice={showPrice}
                copyLabel={it.total > 1 ? `${it.copyNo}/${it.total}` : ""}
                variant="a4"
              />
            ))}
          </div>
        </div>
      )}

      {/* ===== PRINT AREA — Mini thermal ===== */}
      {paper === "mini" && (
        <div className="hidden print:block thermal-print-area">
          {items.map((it, idx) => (
            <BarcodeSticker
              key={idx}
              product={it.product}
              shopName={showShopName ? (currentShop?.name ?? "") : ""}
              showPrice={showPrice}
              copyLabel={it.total > 1 ? `${it.copyNo}/${it.total}` : ""}
              variant="mini"
            />
          ))}
        </div>
      )}

      <style>{`
        @media print {
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
        }

        /* === MINI thermal === */
        @media print {
          ${paper === "mini" ? `
          @page { size: 38mm 25mm; margin: 0; }
          .thermal-print-area, .thermal-print-area * { visibility: visible !important; }
          .thermal-print-area { position: absolute !important; left: 0; top: 0; width: 38mm; }
          .thermal-sticker {
            width: 38mm !important; height: 25mm !important;
            page-break-after: always; break-after: page;
            box-sizing: border-box; padding: 1mm 1.5mm;
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            overflow: hidden; font-family: 'Inter', Arial, sans-serif; color: #000;
          }
          .thermal-sticker:last-child { page-break-after: auto; break-after: auto; }
          .thermal-sticker .ts-shop, .thermal-sticker .ts-name { font-size: 7pt; line-height: 1.1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
          .thermal-sticker .ts-shop { font-weight: 700; }
          .thermal-sticker .ts-name { font-weight: 600; }
          .thermal-sticker .ts-barcode { width: 100%; flex: 1; display: flex; align-items: center; justify-content: center; min-height: 0; }
          .thermal-sticker .ts-barcode svg { width: 100%; max-height: 12mm; }
          .thermal-sticker .ts-bottom { display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 8pt; font-weight: 800; line-height: 1; }
          ` : ""}
        }

        /* === A4 grid === */
        @media print {
          ${paper === "a4" ? `
          @page { size: A4; margin: 8mm; }
          .a4-print-area, .a4-print-area * { visibility: visible !important; }
          .a4-print-area { position: absolute !important; left: 0; top: 0; width: 100%; }
          .a4-grid {
            border: 1.5px solid #000;
            padding: 4mm;
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 3mm;
            box-sizing: border-box;
          }
          .a4-sticker {
            border: 1px dashed #999;
            border-radius: 2mm;
            padding: 2mm;
            min-height: 26mm;
            display: flex; flex-direction: column; align-items: center; justify-content: space-between;
            box-sizing: border-box;
            font-family: 'Inter', Arial, sans-serif; color: #000;
            page-break-inside: avoid;
            break-inside: avoid;
          }
          .a4-sticker .ts-shop { font-size: 8pt; font-weight: 700; line-height: 1.1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
          .a4-sticker .ts-name { font-size: 8pt; font-weight: 600; line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 100%; }
          .a4-sticker .ts-barcode { width: 100%; display: flex; align-items: center; justify-content: center; }
          .a4-sticker .ts-barcode svg { width: 100%; max-height: 14mm; }
          .a4-sticker .ts-bottom { display: flex; justify-content: space-between; align-items: center; width: 100%; font-size: 9pt; font-weight: 800; line-height: 1; padding-top: 1mm; }
          ` : ""}
        }
      `}</style>
    </div>
  );
}

function BarcodeSticker({
  product, shopName, showPrice, copyLabel, variant,
}: { product: Product; shopName: string; showPrice: boolean; copyLabel: string; variant: "mini" | "a4" }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && product.barcode) {
      try {
        JsBarcode(ref.current, product.barcode, {
          format: "CODE128",
          displayValue: true,
          fontSize: variant === "a4" ? 11 : 10,
          textMargin: 0,
          height: variant === "a4" ? 36 : 32,
          margin: 0,
          width: variant === "a4" ? 1.6 : 1.4,
        });
      } catch {}
    }
  }, [product.barcode, variant]);

  return (
    <div className={variant === "a4" ? "a4-sticker" : "thermal-sticker"}>
      {shopName && <div className="ts-shop">{shopName}</div>}
      <div className="ts-name">{product.name}</div>
      <div className="ts-barcode"><svg ref={ref} /></div>
      {(showPrice || copyLabel) && (
        <div className="ts-bottom">
          <span>{showPrice ? `৳ ${Number(product.price).toFixed(0)}` : ""}</span>
          {copyLabel && <span style={{ fontSize: "6pt", fontWeight: 600 }}>{copyLabel}</span>}
        </div>
      )}
    </div>
  );
}
