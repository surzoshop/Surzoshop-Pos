import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, X, User, Receipt, Package, Loader2, Phone, ArrowRight, Tag } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";

type Hit =
  | { kind: "customer"; id: string; title: string; sub: string }
  | { kind: "sale"; id: string; title: string; sub: string }
  | { kind: "product"; id: string; title: string; sub: string }
  | { kind: "category"; id: string; title: string; sub: string; stock: number; count: number };

export function GlobalSearch() {
  const navigate = useNavigate();
  const { t, fmt } = useT();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [hits, setHits] = useState<Hit[]>([]);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  // Keyboard shortcut: ⌘/Ctrl + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        (document.getElementById("global-search-input") as HTMLInputElement | null)?.focus();
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced search
  useEffect(() => {
    const term = q.trim();
    if (term.length < 1) { setHits([]); setLoading(false); return; }
    setLoading(true);
    const handle = setTimeout(async () => {
      const like = `%${term}%`;
      const [cust, sale, prod, cats] = await Promise.all([
        term.length >= 2 ? supabase.from("customers")
          .select("id,name,phone,address")
          .or(`name.ilike.${like},phone.ilike.${like}`)
          .limit(5) : Promise.resolve({ data: [] as any[] }),
        term.length >= 2 ? supabase.from("sales")
          .select("id,invoice_no,total,due,created_at,customers(name)")
          .ilike("invoice_no", like)
          .order("created_at", { ascending: false })
          .limit(5) : Promise.resolve({ data: [] as any[] }),
        term.length >= 2 ? supabase.from("products")
          .select("id,name,sku,barcode,price,stock")
          .or(`name.ilike.${like},sku.ilike.${like},barcode.ilike.${like}`)
          .limit(5) : Promise.resolve({ data: [] as any[] }),
        supabase.from("categories")
          .select("id,name,products(stock)")
          .ilike("name", `${term}%`)
          .limit(8),
      ]);

      const merged: Hit[] = [
        ...(cats.data ?? []).map((c: any): Hit => {
          const products = c.products ?? [];
          const stock = products.reduce((a: number, p: any) => a + Number(p.stock || 0), 0);
          return {
            kind: "category", id: c.id,
            title: c.name,
            sub: `${products.length} পণ্য • মোট স্টক ${stock}`,
            stock, count: products.length,
          };
        }),
        ...(cust.data ?? []).map((c: any): Hit => ({
          kind: "customer", id: c.id,
          title: c.name || "—",
          sub: [c.phone, c.address].filter(Boolean).join(" • ") || "Customer",
        })),
        ...(sale.data ?? []).map((s: any): Hit => ({
          kind: "sale", id: s.id,
          title: s.invoice_no,
          sub: `${s.customers?.name ?? "Walk-in"} • ${fmt(Number(s.total))}${Number(s.due) > 0 ? ` • বাকি ${fmt(Number(s.due))}` : ""}`,
        })),
        ...(prod.data ?? []).map((p: any): Hit => ({
          kind: "product", id: p.id,
          title: p.name,
          sub: `${p.sku ? "SKU: " + p.sku : ""}${p.barcode ? " • " + p.barcode : ""} • ${fmt(Number(p.price))} • Stock: ${p.stock}`,
        })),
      ];
      setHits(merged);
      setLoading(false);
    }, 250);
    return () => clearTimeout(handle);
  }, [q, fmt]);

  const go = (h: Hit) => {
    setOpen(false);
    setQ("");
    if (h.kind === "customer") navigate(`/customers?focus=${h.id}`);
    else if (h.kind === "sale") navigate(`/sales?focus=${h.id}`);
    else if (h.kind === "category") navigate(`/products?category=${h.id}`);
    else navigate(`/products?focus=${h.id}`);
  };

  const groups: { kind: Hit["kind"]; label: string; icon: any; color: string; items: Hit[] }[] = [
    { kind: "category", label: "ক্যাটেগরি", icon: Tag,    color: "text-amber-600 bg-amber-500/10",   items: hits.filter(h => h.kind === "category") },
    { kind: "customer", label: "ক্রেতা",   icon: User,    color: "text-sky-600 bg-sky-500/10",       items: hits.filter(h => h.kind === "customer") },
    { kind: "sale",     label: "ইনভয়েস",   icon: Receipt, color: "text-violet-600 bg-violet-500/10", items: hits.filter(h => h.kind === "sale") },
    { kind: "product",  label: "পণ্য",     icon: Package, color: "text-teal-600 bg-teal-500/10",     items: hits.filter(h => h.kind === "product") },
  ];

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className={`relative flex items-center bg-[hsl(var(--surface-container-low))] rounded-full transition-all duration-200 ${open ? "ring-2 ring-primary/30 shadow-md" : "ring-1 ring-transparent hover:ring-[hsl(var(--border))]"}`}>
        <Search className={`absolute left-3.5 h-4 w-4 transition-colors ${open ? "text-primary" : "text-muted-foreground"}`} />
        <input
          id="global-search-input"
          type="text"
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="ক্রেতা ফোন / ইনভয়েস / পণ্য খুঁজুন…"
          className="w-full bg-transparent border-none rounded-full py-2.5 pl-10 pr-16 text-sm focus:outline-none placeholder:text-muted-foreground/70"
        />
        {q ? (
          <button
            onClick={() => { setQ(""); setHits([]); }}
            className="absolute right-12 h-6 w-6 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
            aria-label="Clear"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
        <kbd className="absolute right-3 hidden sm:flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground bg-background border border-border rounded px-1.5 py-0.5">
          ⌘K
        </kbd>
      </div>

      {open && q.trim().length >= 1 && (
        <div className="absolute left-0 right-0 mt-2 bg-background border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-fade-in">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> খুঁজছি…
            </div>
          )}
          {!loading && hits.length === 0 && (
            <div className="text-center py-8 px-4">
              <Search className="h-8 w-8 text-muted-foreground/50 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">কিছু পাওয়া যায়নি</p>
              <p className="text-xs text-muted-foreground mt-1">"{q}" এর জন্য কোনো ক্রেতা, ইনভয়েস বা পণ্য নেই</p>
            </div>
          )}
          {!loading && hits.length > 0 && (
            <div className="max-h-[60vh] overflow-y-auto py-1">
              {groups.filter(g => g.items.length > 0).map(g => (
                <div key={g.kind}>
                  <div className="px-3 pt-2 pb-1 flex items-center gap-2">
                    <span className={`h-5 w-5 rounded-md flex items-center justify-center ${g.color}`}>
                      <g.icon className="h-3 w-3" />
                    </span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted-foreground">{g.label}</span>
                    <span className="text-[10px] text-muted-foreground/70">({g.items.length})</span>
                  </div>
                  {g.items.map(h => (
                    <button
                      key={`${h.kind}-${h.id}`}
                      onClick={() => go(h)}
                      className="group w-full text-left px-3 py-2 hover:bg-primary/5 flex items-center gap-3 transition-colors"
                    >
                      <span className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${g.color}`}>
                        {h.kind === "customer" && <Phone className="h-4 w-4" />}
                        {h.kind === "sale" && <Receipt className="h-4 w-4" />}
                        {h.kind === "product" && <Package className="h-4 w-4" />}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold text-foreground truncate">{h.title}</p>
                        <p className="text-xs text-muted-foreground truncate">{h.sub}</p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              ))}
              <div className="border-t border-border px-3 py-2 flex items-center justify-between bg-muted/30">
                <span className="text-[10px] text-muted-foreground">↵ select • Esc close</span>
                <span className="text-[10px] text-muted-foreground">{hits.length} ফলাফল</span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
