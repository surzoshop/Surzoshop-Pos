import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Search, Calendar, User, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";

export default function Warranty() {
  const { fmt } = useT();
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<any[] | null>(null);

  const search = async () => {
    if (!q.trim()) return;
    setLoading(true);
    // Search by invoice_no, customer name/phone, or product name
    const { data } = await supabase
      .from("sale_items")
      .select("*, sales!inner(invoice_no, created_at, customers(name, phone))")
      .not("warranty_until", "is", null)
      .or(`product_name.ilike.%${q}%`)
      .order("created_at", { ascending: false })
      .limit(50);

    let combined = data ?? [];

    // Also try by invoice/customer
    const { data: byInvoice } = await supabase
      .from("sale_items")
      .select("*, sales!inner(invoice_no, created_at, customers(name, phone))")
      .not("warranty_until", "is", null)
      .or(`invoice_no.ilike.%${q}%,customers.name.ilike.%${q}%,customers.phone.ilike.%${q}%`, { foreignTable: "sales" })
      .limit(50);

    const map = new Map<string, any>();
    [...combined, ...(byInvoice ?? [])].forEach(r => map.set(r.id, r));
    setResults([...map.values()]);
    setLoading(false);
  };

  const today = new Date(); today.setHours(0,0,0,0);

  return (
    <div>
      <PageHeader
        title="ওয়ারেন্টি যাচাই"
        subtitle="ইনভয়েস নম্বর, ক্রেতার নাম/মোবাইল অথবা পণ্যের নাম দিয়ে warranty status check করুন"
      />

      <SurfaceCard className="p-6 mb-6">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              value={q}
              onChange={e => setQ(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder="যেমন: INV-105, রহিম, 01712345678, Samsung A55"
              className="h-12 pl-12 text-sm"
            />
          </div>
          <Button onClick={search} disabled={loading} className="gradient-primary text-primary-foreground font-bold px-6">
            {loading ? "খুঁজছি..." : "খুঁজুন"}
          </Button>
        </div>
      </SurfaceCard>

      {results !== null && (
        <div className="space-y-3">
          {results.length === 0 && (
            <SurfaceCard className="p-12 text-center text-muted-foreground">
              কোনো warranty পণ্য পাওয়া যায়নি
            </SurfaceCard>
          )}
          {results.map((r: any) => {
            const until = new Date(r.warranty_until);
            const sold = new Date(r.sales.created_at);
            const valid = until >= today;
            const daysLeft = Math.ceil((until.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
            return (
              <SurfaceCard key={r.id} className={`p-5 border-l-4 ${valid ? "border-primary" : "border-destructive"}`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-xl ${valid ? "bg-primary/10" : "bg-destructive/10"}`}>
                    {valid
                      ? <ShieldCheck className="h-6 w-6 text-primary" />
                      : <AlertTriangle className="h-6 w-6 text-destructive" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-black text-foreground text-lg">{r.product_name}</h3>
                      {valid
                        ? <StatusPill tone="success"><CheckCircle2 className="inline h-3 w-3 mr-1" />বৈধ</StatusPill>
                        : <StatusPill tone="destructive">মেয়াদ শেষ</StatusPill>}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm mt-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Package className="h-4 w-4" />
                        ইনভয়েস: <span className="font-bold text-foreground">{r.sales.invoice_no}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <User className="h-4 w-4" />
                        <span className="font-bold text-foreground">{r.sales.customers?.name ?? "Walk-in"}</span>
                        {r.sales.customers?.phone && <span className="text-xs">({r.sales.customers.phone})</span>}
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        বিক্রয়: <span className="font-semibold text-foreground">{sold.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <ShieldCheck className="h-4 w-4" />
                        মেয়াদ: <span className="font-semibold text-foreground">{until.toLocaleDateString("bn-BD", { timeZone: "Asia/Dhaka" })}</span>
                        <span className={`text-xs font-bold ${valid ? "text-primary" : "text-destructive"}`}>
                          ({valid ? `${daysLeft} দিন বাকি` : `${Math.abs(daysLeft)} দিন আগে শেষ`})
                        </span>
                      </div>
                      <div className="text-muted-foreground">
                        ওয়ারেন্টি: <span className="font-bold text-foreground">{r.warranty_months} মাস</span>
                      </div>
                      <div className="text-muted-foreground">
                        পরিমাণ: <span className="font-bold text-foreground">{r.qty} × {fmt(r.unit_price)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </SurfaceCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
