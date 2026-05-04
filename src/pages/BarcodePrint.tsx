import { useEffect, useMemo, useRef, useState } from "react";
import JsBarcode from "jsbarcode";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Printer, Search, Plus, Minus, RefreshCcw, ScanLine, Info, Package, Tag, Printer as PrinterIcon } from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";

type Product = { id: string; name: string; barcode: string | null; price: number };

// Build prefix from product name: first 2 letters, A-Z only, uppercase
function namePrefix(name: string): string {
  const cleaned = (name || "").replace(/[^A-Za-z\u0980-\u09FF]/g, "");
  // Bengali → fallback "PR"
  const ascii = cleaned.replace(/[^A-Za-z]/g, "");
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
  const [search, setSearch] = useState("");
  const [qty, setQty] = useState<Record<string, number>>({});
  const [showShopName, setShowShopName] = useState(true);
  const [showPrice, setShowPrice] = useState(true);
  const isAdmin = role === "admin";

  const load = async () => {
    const { data } = await supabase.from("products").select("id,name,barcode,price").order("name");
    setProducts(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const ensureBarcode = async (p: Product): Promise<string | null> => {
    if (p.barcode) return p.barcode;
    const serial = await nextSerial();
    if (serial == null) {
      toast({ title: "Serial generate করা যায়নি", variant: "destructive" });
      return null;
    }
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

  const filtered = products.filter(p =>
    !search ||
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.barcode?.toLowerCase().includes(search.toLowerCase())
  );

  const items = useMemo(() => {
    const list: { product: Product; index: number; copyNo: number; total: number }[] = [];
    Object.entries(qty).forEach(([id, n]) => {
      const p = products.find(x => x.id === id);
      if (!p || !n) return;
      for (let i = 0; i < n; i++) list.push({ product: p, index: i, copyNo: i + 1, total: n });
    });
    return list;
  }, [qty, products]);

  const handlePrint = async () => {
    // Ensure every selected item has a barcode
    for (const { product } of items) {
      if (!product.barcode) await ensureBarcode(product);
    }
    // Wait a tick for state + DOM render
    setTimeout(() => window.print(), 250);
  };

  const totalLabels = items.length;
  const selectedCount = Object.values(qty).filter(n => n > 0).length;

  return (
    <div>
      <PageHeader
        title="বারকোড প্রিন্ট"
        subtitle="পণ্যের জন্য professional barcode sticker (38×25mm) তৈরি ও print করুন।"
      />

      {/* Instructions */}
      <div className="bg-info/10 border border-info/20 rounded-2xl p-4 mb-4 print:hidden">
        <div className="flex items-start gap-3">
          <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
          <div className="text-sm space-y-1">
            <p className="font-bold text-foreground">কীভাবে কাজ করে:</p>
            <ol className="list-decimal pl-4 space-y-0.5 text-foreground/80">
              <li>প্রতিটি পণ্যের জন্য কয়টা sticker লাগবে select করুন</li>
              <li>"Print" বাটন চাপুন → 38×25mm thermal printer-এ sticker print হবে</li>
              <li>বারকোড format: প্রথম ২ অক্ষর + serial নম্বর (যেমন <code className="font-mono bg-background/50 px-1 rounded">SU-1000</code>)</li>
              <li>পণ্যে sticker লাগিয়ে POS-এ scan করুন → cart-এ auto add</li>
            </ol>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-4 print:hidden">
        {/* Product list */}
        <SurfaceCard className="p-4 lg:col-span-2">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="পণ্য বা বারকোড খুঁজুন..." className="pl-10 h-11" />
          </div>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
            {filtered.map(p => {
              const selected = (qty[p.id] ?? 0) > 0;
              return (
                <div
                  key={p.id}
                  className={`p-3 rounded-xl flex items-center gap-3 transition-all ${
                    selected
                      ? "bg-primary/8 ring-1 ring-primary/30"
                      : "bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container))]"
                  }`}
                >
                  <span className="shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-lg bg-gradient-to-br from-fuchsia-400 to-purple-600 text-white shadow-md shadow-fuchsia-500/30">
                    <Package className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm truncate">{p.name}</p>
                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                      <span className="font-mono">{p.barcode ?? "বারকোড নেই — print-এ auto generate হবে"}</span>
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
            Mini thermal printer settings: <strong>Paper size 38×25mm</strong>, margins 0, scale 100%
          </p>
        </SurfaceCard>
      </div>

      {/* Print area — one sticker per page (38×25mm) for thermal printers */}
      <div className="hidden print:block thermal-print-area">
        {items.map((it, idx) => (
          <BarcodeSticker
            key={idx}
            product={it.product}
            shopName={showShopName ? (currentShop?.name ?? "") : ""}
            showPrice={showPrice}
            copyLabel={it.total > 1 ? `${it.copyNo}/${it.total}` : ""}
          />
        ))}
      </div>

      <style>{`
        @media print {
          @page { size: 38mm 25mm; margin: 0; }
          html, body { margin: 0 !important; padding: 0 !important; background: white !important; }
          body * { visibility: hidden !important; }
          .thermal-print-area, .thermal-print-area * { visibility: visible !important; }
          .thermal-print-area {
            position: absolute !important;
            left: 0; top: 0;
            width: 38mm;
          }
          .thermal-sticker {
            width: 38mm !important;
            height: 25mm !important;
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
            padding: 1mm 1.5mm;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: space-between;
            overflow: hidden;
            font-family: 'Inter', Arial, sans-serif;
            color: #000;
          }
          .thermal-sticker:last-child { page-break-after: auto; break-after: auto; }
          .thermal-sticker .ts-shop {
            font-size: 7pt;
            font-weight: 700;
            line-height: 1;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .thermal-sticker .ts-name {
            font-size: 7pt;
            font-weight: 600;
            line-height: 1.1;
            text-align: center;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 100%;
          }
          .thermal-sticker .ts-barcode {
            width: 100%;
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 0;
          }
          .thermal-sticker .ts-barcode svg {
            width: 100%;
            max-height: 12mm;
          }
          .thermal-sticker .ts-bottom {
            display: flex;
            justify-content: space-between;
            align-items: center;
            width: 100%;
            font-size: 8pt;
            font-weight: 800;
            line-height: 1;
          }
        }
      `}</style>
    </div>
  );
}

function BarcodeSticker({
  product, shopName, showPrice, copyLabel,
}: { product: Product; shopName: string; showPrice: boolean; copyLabel: string }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    if (ref.current && product.barcode) {
      try {
        JsBarcode(ref.current, product.barcode, {
          format: "CODE128",
          displayValue: true,
          fontSize: 10,
          textMargin: 0,
          height: 32,
          margin: 0,
          width: 1.4,
        });
      } catch {}
    }
  }, [product.barcode]);

  return (
    <div className="thermal-sticker">
      {shopName && <div className="ts-shop">{shopName}</div>}
      <div className="ts-name">{product.name}</div>
      <div className="ts-barcode">
        <svg ref={ref} />
      </div>
      {(showPrice || copyLabel) && (
        <div className="ts-bottom">
          <span>{showPrice ? `৳ ${Number(product.price).toFixed(0)}` : ""}</span>
          {copyLabel && <span style={{ fontSize: "6pt", fontWeight: 600 }}>{copyLabel}</span>}
        </div>
      )}
    </div>
  );
}
