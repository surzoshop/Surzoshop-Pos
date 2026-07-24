import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Search, User, Phone, IdCard, ThumbsUp, Minus, ThumbsDown, MessageSquare, ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { fmtDateTimeBD } from "@/lib/datetime";

type RatingT = "good" | "neutral" | "bad";

type PaymentRow = {
  id: string;
  amount: number;
  paid_at: string;
  rating: RatingT | null;
  remark: string | null;
  installment_no?: number;
  invoice_no?: string;
  source: "installment" | "credit";
};

export default function CustomerReport() {
  const { lang, fmt } = useT();
  const [query, setQuery] = useState("");
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<any | null>(null);
  const [payments, setPayments] = useState<PaymentRow[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("customers")
        .select("id,name,phone,nid,address,photo_url,alt_phone,present_address,permanent_address")
        .order("name");
      setCustomers(data ?? []);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return customers.filter(c =>
      (c.nid ?? "").toLowerCase().includes(q) ||
      (c.name ?? "").toLowerCase().includes(q) ||
      (c.phone ?? "").toLowerCase().includes(q)
    ).slice(0, 25);
  }, [query, customers]);

  const openCustomer = async (c: any) => {
    setSelected(c);
    setLoading(true);
    // Installment payments via joined sales -> customer_id
    const { data: instPays } = await supabase
      .from("installment_payments")
      .select("id, amount, paid_at, rating, remark, installments!inner(installment_no, sale_id, sales!inner(invoice_no, customer_id))")
      .eq("installments.sales.customer_id", c.id)
      .order("paid_at", { ascending: false });

    const { data: cashPays } = await supabase
      .from("cash_book")
      .select("id, amount, created_at, rating, remark, party_name, notes")
      .eq("customer_id", c.id)
      .eq("entry_type", "deposit")
      .order("created_at", { ascending: false });

    const rows: PaymentRow[] = [];
    for (const p of instPays ?? []) {
      const inst: any = (p as any).installments;
      rows.push({
        id: p.id,
        amount: Number(p.amount),
        paid_at: p.paid_at,
        rating: (p as any).rating ?? null,
        remark: (p as any).remark ?? null,
        installment_no: inst?.installment_no,
        invoice_no: inst?.sales?.invoice_no,
        source: "installment",
      });
    }
    for (const p of cashPays ?? []) {
      rows.push({
        id: p.id,
        amount: Number(p.amount),
        paid_at: (p as any).created_at,
        rating: (p as any).rating ?? null,
        remark: (p as any).remark ?? (p as any).notes ?? null,
        source: "credit",
      });
    }
    rows.sort((a, b) => +new Date(b.paid_at) - +new Date(a.paid_at));
    setPayments(rows);
    setLoading(false);
  };

  const stats = useMemo(() => {
    const good = payments.filter(p => p.rating === "good").length;
    const neutral = payments.filter(p => p.rating === "neutral").length;
    const bad = payments.filter(p => p.rating === "bad").length;
    const rated = good + neutral + bad;
    const totalPaid = payments.reduce((a, p) => a + p.amount, 0);
    // Auto trust score
    let trust: "excellent" | "good" | "average" | "poor" | "unknown" = "unknown";
    if (rated > 0) {
      const score = (good * 2 + neutral * 1 - bad * 3) / rated;
      if (bad >= 2 || score < -0.5) trust = "poor";
      else if (score >= 1.5) trust = "excellent";
      else if (score >= 0.8) trust = "good";
      else trust = "average";
    }
    return { good, neutral, bad, rated, totalPaid, count: payments.length, trust };
  }, [payments]);

  const trustMeta: Record<string, { label: string; bnLabel: string; tone: any; icon: any; cls: string }> = {
    excellent: { label: "Excellent — Highly Trusted", bnLabel: "চমৎকার — অত্যন্ত বিশ্বস্ত", tone: "success", icon: ShieldCheck, cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/40" },
    good: { label: "Good — Trusted", bnLabel: "ভালো — বিশ্বস্ত", tone: "success", icon: ShieldCheck, cls: "text-emerald-600 bg-emerald-500/10 border-emerald-500/40" },
    average: { label: "Average — Caution", bnLabel: "মাঝারি — সতর্ক থাকুন", tone: "warning", icon: ShieldQuestion, cls: "text-amber-600 bg-amber-500/10 border-amber-500/40" },
    poor: { label: "Poor — Avoid Credit", bnLabel: "খারাপ — বাকি এড়িয়ে চলুন", tone: "destructive", icon: ShieldAlert, cls: "text-destructive bg-destructive/10 border-destructive/40" },
    unknown: { label: "Not Enough Data", bnLabel: "পর্যাপ্ত তথ্য নেই", tone: "info", icon: ShieldQuestion, cls: "text-muted-foreground bg-muted/40 border-border" },
  };

  const meta = trustMeta[stats.trust];
  const MetaIcon = meta.icon;

  return (
    <div>
      <PageHeader
        title={lang === "bn" ? "কাস্টমার রিপোর্ট" : "Customer Report"}
        subtitle={lang === "bn" ? "NID / নাম / ফোন দিয়ে খুঁজে কাস্টমারের আচরণ ও পরিশোধ ইতিহাস দেখুন।" : "Search by NID / name / phone to view behavior & payment history."}
      />

      <SurfaceCard className="p-4 md:p-6 mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} className="pl-9"
            placeholder={lang === "bn" ? "NID নম্বর, নাম বা ফোন দিয়ে খুঁজুন…" : "Search by NID, name or phone…"} />
        </div>
        {query.trim() && filtered.length > 0 && (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2 max-h-80 overflow-y-auto">
            {filtered.map(c => (
              <button key={c.id} onClick={() => openCustomer(c)}
                className={`text-left bg-[hsl(var(--surface-container-lowest))] hover:bg-primary/5 border border-border rounded-xl p-3 transition-all ${selected?.id === c.id ? "border-primary ring-2 ring-primary/30" : ""}`}>
                <div className="font-bold flex items-center gap-2"><User className="h-4 w-4 text-primary" />{c.name}</div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                  {c.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{c.phone}</span>}
                  {c.nid && <span className="flex items-center gap-1"><IdCard className="h-3 w-3" />{c.nid}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
        {query.trim() && filtered.length === 0 && (
          <div className="mt-3 text-sm text-muted-foreground text-center py-4">
            {lang === "bn" ? "কোন কাস্টমার পাওয়া যায়নি" : "No customer found"}
          </div>
        )}
      </SurfaceCard>

      {selected && (
        <>
          <SurfaceCard className="p-5 mb-6">
            <div className="flex flex-col md:flex-row md:items-center gap-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
                {selected.photo_url
                  ? <img src={selected.photo_url} alt={selected.name} className="h-full w-full object-cover" />
                  : <User className="h-8 w-8 text-primary" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xl font-black">{selected.name}</div>
                <div className="text-sm text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 mt-1">
                  {selected.phone && <span className="flex items-center gap-1"><Phone className="h-3.5 w-3.5" />{selected.phone}</span>}
                  {selected.nid && <span className="flex items-center gap-1"><IdCard className="h-3.5 w-3.5" />NID: {selected.nid}</span>}
                </div>
                {(selected.present_address || selected.address) && (
                  <div className="text-xs text-muted-foreground mt-1">{selected.present_address || selected.address}</div>
                )}
              </div>
              <div className={`px-4 py-3 rounded-xl border-2 font-bold flex items-center gap-2 ${meta.cls}`}>
                <MetaIcon className="h-5 w-5" />
                <div>
                  <div className="text-[10px] uppercase tracking-widest opacity-80">{lang === "bn" ? "বিশ্বাসযোগ্যতা রেটিং" : "Trust Rating"}</div>
                  <div className="text-sm">{lang === "bn" ? meta.bnLabel : meta.label}</div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5">
              <StatBox label={lang === "bn" ? "মোট পরিশোধ" : "Total Paid"} value={fmt(stats.totalPaid)} />
              <StatBox label={lang === "bn" ? "লেনদেন সংখ্যা" : "Transactions"} value={stats.count.toString()} />
              <StatBox label={lang === "bn" ? "ভালো" : "Good"} value={stats.good.toString()} tone="text-emerald-600" icon={<ThumbsUp className="h-4 w-4" />} />
              <StatBox label={lang === "bn" ? "মাঝামাঝি" : "Neutral"} value={stats.neutral.toString()} tone="text-amber-600" icon={<Minus className="h-4 w-4" />} />
              <StatBox label={lang === "bn" ? "খারাপ" : "Bad"} value={stats.bad.toString()} tone="text-destructive" icon={<ThumbsDown className="h-4 w-4" />} />
            </div>
          </SurfaceCard>

          <SurfaceCard className="p-5">
            <div className="text-sm font-bold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              {lang === "bn" ? "পরিশোধ ও মন্তব্য ইতিহাস" : "Payment & Remark History"}
            </div>
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{lang === "bn" ? "লোড হচ্ছে…" : "Loading…"}</div>
            ) : payments.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">{lang === "bn" ? "কোন পরিশোধ ইতিহাস নেই" : "No payment history yet"}</div>
            ) : (
              <div className="space-y-2">
                {payments.map(p => {
                  const rc = p.rating === "good" ? "border-emerald-500/40 bg-emerald-500/5"
                    : p.rating === "bad" ? "border-destructive/40 bg-destructive/5"
                    : p.rating === "neutral" ? "border-amber-500/40 bg-amber-500/5"
                    : "border-border bg-muted/10";
                  return (
                    <div key={`${p.source}-${p.id}`} className={`rounded-xl p-3 border-2 ${rc}`}>
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="text-sm font-bold flex items-center gap-2 flex-wrap">
                            {p.source === "installment"
                              ? <>{p.invoice_no} <span className="text-muted-foreground text-xs">• {lang === "bn" ? "কিস্তি" : "Inst."} #{p.installment_no}</span></>
                              : <span className="px-2 py-0.5 rounded bg-info/10 text-info text-xs">{lang === "bn" ? "বাকি পরিশোধ" : "Credit Payment"}</span>}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{fmtDateTimeBD(p.paid_at, lang)}</div>
                          {p.remark && <div className="text-xs mt-1 italic text-foreground/80">"{p.remark}"</div>}
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-emerald-600 font-black">+{fmt(p.amount)}</div>
                          {p.rating && (
                            <StatusPill tone={p.rating === "good" ? "success" : p.rating === "bad" ? "destructive" : "warning"}>
                              {p.rating === "good" ? (lang === "bn" ? "ভালো" : "Good") : p.rating === "bad" ? (lang === "bn" ? "খারাপ" : "Bad") : (lang === "bn" ? "মাঝামাঝি" : "Neutral")}
                            </StatusPill>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </SurfaceCard>
        </>
      )}
    </div>
  );
}

function StatBox({ label, value, tone, icon }: { label: string; value: string; tone?: string; icon?: any }) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] rounded-xl p-3 border border-border">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-bold flex items-center gap-1">{icon}{label}</div>
      <div className={`font-black text-lg ${tone ?? "text-foreground"}`}>{value}</div>
    </div>
  );
}
