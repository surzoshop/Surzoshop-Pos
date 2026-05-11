import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useShop } from "@/hooks/useShop";
import { toast } from "sonner";
import {
  ArrowDownCircle, ArrowUpCircle, ArrowLeft, Search, Trash2,
  ArrowDownToLine, ArrowUpFromLine, BookOpen, Download,
} from "lucide-react";
import { todayBD, addDaysBDStr, firstOfMonthBD, prevMonthRangeBD, fmtDateTimeBD } from "@/lib/datetime";

type Entry = {
  id: string;
  entry_date: string;
  entry_type: "deposit" | "withdraw";
  amount: number;
  category: string | null;
  payment_method: string | null;
  reference_no: string | null;
  party_name: string | null;
  notes: string | null;
  created_at: string;
};

type RangeKey = "today" | "7d" | "30d" | "thisMonth" | "lastMonth" | "lifetime";
type FilterKey = "all" | "deposit" | "withdraw";

const fmt = (n: number) => `৳${Number(n || 0).toLocaleString("bn-BD")}`;

function rangeDates(r: RangeKey): { from: string; to: string } {
  const to = todayBD();
  if (r === "today") return { from: to, to };
  if (r === "7d") return { from: addDaysBDStr(to, -6), to };
  if (r === "30d") return { from: addDaysBDStr(to, -29), to };
  if (r === "thisMonth") return { from: firstOfMonthBD(), to };
  if (r === "lastMonth") return prevMonthRangeBD();
  return { from: "2000-01-01", to };
}

const RANGE_CHIPS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "আজ" },
  { key: "7d", label: "৭ দিন" },
  { key: "30d", label: "৩০ দিন" },
  { key: "thisMonth", label: "এই মাস" },
  { key: "lastMonth", label: "গত মাস" },
  { key: "lifetime", label: "লাইফটাইম" },
];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "সব" },
  { key: "deposit", label: "জমা" },
  { key: "withdraw", label: "উত্তোলন" },
];

export default function CashbookHistory() {
  const { currentShop } = useShop();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<RangeKey>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKey>("all");

  useEffect(() => {
    const r = rangeDates(range);
    setFrom(r.from === "2000-01-01" ? "" : r.from);
    setTo(r.from === "2000-01-01" ? "" : r.to);
  }, [range]);

  const load = async () => {
    setLoading(true);
    let q = supabase.from("cash_book" as any).select("*")
      .order("entry_date", { ascending: false }).order("created_at", { ascending: false });
    if (currentShop) q = q.eq("shop_id", currentShop.id);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setEntries((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentShop?.id]);

  const filtered = useMemo(() => entries.filter(e => {
    if (from && e.entry_date < from) return false;
    if (to && e.entry_date > to) return false;
    if (filter !== "all" && e.entry_type !== filter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (e.category ?? "").toLowerCase().includes(q)
        || (e.party_name ?? "").toLowerCase().includes(q)
        || (e.reference_no ?? "").toLowerCase().includes(q)
        || (e.notes ?? "").toLowerCase().includes(q);
    }
    return true;
  }), [entries, from, to, filter, search]);

  const totals = useMemo(() => {
    const cr = filtered.filter(e => e.entry_type === "deposit").reduce((s, e) => s + Number(e.amount || 0), 0);
    const dr = filtered.filter(e => e.entry_type === "withdraw").reduce((s, e) => s + Number(e.amount || 0), 0);
    return { cr, dr, balance: cr - dr };
  }, [filtered]);

  const remove = async (id: string) => {
    if (!confirm("এই এন্ট্রি মুছে ফেলবেন?")) return;
    const { error } = await supabase.from("cash_book" as any).delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("মুছে ফেলা হয়েছে");
    load();
  };

  const exportCsv = () => {
    const head = ["তারিখ", "ধরন", "ক্যাটাগরি", "পার্টি", "পেমেন্ট", "রেফ", "জমা", "উত্তোলন", "নোট"];
    const lines = [head.join(",")];
    filtered.forEach(e => {
      lines.push([
        e.entry_date, e.entry_type === "deposit" ? "জমা" : "উত্তোলন",
        e.category ?? "", e.party_name ?? "",
        e.payment_method ?? "", e.reference_no ?? "",
        e.entry_type === "deposit" ? e.amount : "",
        e.entry_type === "withdraw" ? e.amount : "",
        (e.notes ?? "").replace(/,/g, " "),
      ].join(","));
    });
    const blob = new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cashbook-history-${todayBD()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 space-y-4 max-w-[1200px] mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 min-w-0">
          <Button asChild variant="ghost" size="icon">
            <Link to="/ledger"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-black text-foreground truncate">জমা/উত্তোলন হিস্ট্রি</h1>
            <p className="text-xs text-muted-foreground">ম্যানুয়াল জমা ও উত্তোলনের সম্পূর্ণ রেকর্ড</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 sm:gap-3">
        <Card className="border-2 border-emerald-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-emerald-500/10 text-emerald-600">
              <ArrowDownToLine className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-bold">মোট জমা</p>
              <p className="text-xl font-black truncate">{fmt(totals.cr)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-rose-500/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-rose-500/10 text-rose-600">
              <ArrowUpFromLine className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-bold">মোট উত্তোলন</p>
              <p className="text-xl font-black truncate">{fmt(totals.dr)}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-2 border-primary/40">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl grid place-items-center bg-primary/10 text-primary">
              <BookOpen className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-bold">নীট ব্যালেন্স</p>
              <p className="text-xl font-black truncate">{fmt(totals.balance)}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="border-border/60">
        <CardContent className="p-3 sm:p-4 space-y-3">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="খুঁজুন..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
            <div className="flex items-center gap-2 min-w-max">
              {RANGE_CHIPS.map(c => (
                <button key={c.key} onClick={() => setRange(c.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold border-2 transition-all whitespace-nowrap ${
                    range === c.key ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                  }`}>{c.label}</button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-bold text-muted-foreground sm:hidden">শুরু</Label>
              <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="w-full sm:w-[150px]" />
            </div>
            <div className="flex flex-col gap-1">
              <Label className="text-[11px] font-bold text-muted-foreground sm:hidden">শেষ</Label>
              <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="w-full sm:w-[150px]" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            {FILTERS.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold border-2 transition-all ${
                  filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"
                }`}>{f.label}</button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* List */}
      <Card className="border-border/60">
        <CardContent className="p-0">
          <div className="p-4 border-b border-border/60 flex items-center justify-between">
            <h3 className="font-bold inline-flex items-center gap-2"><BookOpen className="h-4 w-4" /> এন্ট্রি তালিকা</h3>
            <span className="text-xs text-muted-foreground">{filtered.length} টি</span>
          </div>
          {loading ? (
            <div className="p-8 text-center text-muted-foreground">লোড হচ্ছে...</div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground">কোনো এন্ট্রি নেই</div>
          ) : (
            <>
              {/* Mobile */}
              <div className="sm:hidden divide-y divide-border/40">
                {filtered.map(e => (
                  <div key={e.id} className="p-3 hover:bg-muted/30">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-start gap-2 min-w-0">
                        <span className={`h-9 w-9 rounded-full grid place-items-center shrink-0 ${e.entry_type === "deposit" ? "bg-emerald-500/15 text-emerald-600" : "bg-rose-500/15 text-rose-600"}`}>
                          {e.entry_type === "deposit" ? <ArrowDownCircle className="h-4 w-4" /> : <ArrowUpCircle className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <div className="font-bold text-sm truncate">{e.category ?? "-"}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {fmtDateTimeBD(e.created_at || e.entry_date)} • {e.payment_method ?? "cash"}
                            {e.party_name ? ` • ${e.party_name}` : ""}
                          </div>
                          {e.reference_no && <div className="text-[11px] text-muted-foreground">রেফ: {e.reference_no}</div>}
                          {e.notes && <div className="text-[11px] text-muted-foreground line-clamp-2">{e.notes}</div>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className={`font-black text-sm ${e.entry_type === "deposit" ? "text-emerald-600" : "text-rose-600"}`}>
                          {e.entry_type === "deposit" ? "+" : "-"}{fmt(e.amount)}
                        </div>
                        <button onClick={() => remove(e.id)} className="text-rose-500 mt-1"><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {/* Desktop */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40">
                    <tr className="text-left">
                      <th className="p-3">তারিখ</th>
                      <th className="p-3">ধরন</th>
                      <th className="p-3">ক্যাটাগরি</th>
                      <th className="p-3">পার্টি</th>
                      <th className="p-3">পেমেন্ট</th>
                      <th className="p-3">রেফ</th>
                      <th className="p-3 text-right">জমা</th>
                      <th className="p-3 text-right">উত্তোলন</th>
                      <th className="p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(e => (
                      <tr key={e.id} className="border-t border-border/40 hover:bg-muted/20">
                        <td className="p-3 whitespace-nowrap">{fmtDateTimeBD(e.created_at || e.entry_date)}</td>
                        <td className="p-3">
                          <span className={`inline-flex items-center gap-1 text-xs font-bold ${e.entry_type === "deposit" ? "text-emerald-600" : "text-rose-600"}`}>
                            {e.entry_type === "deposit" ? <ArrowDownCircle className="h-3.5 w-3.5" /> : <ArrowUpCircle className="h-3.5 w-3.5" />}
                            {e.entry_type === "deposit" ? "জমা" : "উত্তোলন"}
                          </span>
                        </td>
                        <td className="p-3">{e.category ?? "-"}</td>
                        <td className="p-3">{e.party_name ?? "-"}</td>
                        <td className="p-3">{e.payment_method ?? "cash"}</td>
                        <td className="p-3">{e.reference_no ?? "-"}</td>
                        <td className="p-3 text-right font-bold text-emerald-600">{e.entry_type === "deposit" ? fmt(e.amount) : "-"}</td>
                        <td className="p-3 text-right font-bold text-rose-600">{e.entry_type === "withdraw" ? fmt(e.amount) : "-"}</td>
                        <td className="p-3">
                          <button onClick={() => remove(e.id)} className="text-rose-500 hover:text-rose-700"><Trash2 className="h-4 w-4" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
