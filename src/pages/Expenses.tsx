import { useEffect, useMemo, useState } from "react";
import { toBDDate } from "@/lib/datetime";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Plus, Trash2, Wallet, Search, Calendar as CalendarIcon, Tag, Pencil,
  Receipt, Zap, Home, Megaphone, Truck, Users, Wifi, Droplet, ShoppingBag,
  Wrench, Phone, Coffee, FileText, Banknote, TrendingDown, Filter, X,
} from "lucide-react";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";

const DEFAULT_CATS = [
  "দোকান ভাড়া", "বিদ্যুৎ বিল", "পানির বিল", "ইন্টারনেট বিল",
  "মোবাইল রিচার্জ", "যাতায়াত / পরিবহন", "কর্মচারীর বেতন", "ব্যানার ও প্রচারণা",
  "মেরামত ও রক্ষণাবেক্ষণ", "অফিস সামগ্রী", "চা-নাস্তা", "ট্যাক্স / ভ্যাট",
  "প্যাকেজিং", "ক্লিনিং", "অন্যান্য",
];

// Icon by category name (Bangla keyword match)
const catIcon = (name: string) => {
  const n = (name || "").toLowerCase();
  if (n.includes("ভাড়া") || n.includes("rent")) return Home;
  if (n.includes("বিদ্যুৎ") || n.includes("electric")) return Zap;
  if (n.includes("পানি") || n.includes("water")) return Droplet;
  if (n.includes("ইন্টারনেট") || n.includes("wifi") || n.includes("internet")) return Wifi;
  if (n.includes("মোবাইল") || n.includes("phone") || n.includes("রিচার্জ")) return Phone;
  if (n.includes("যাতায়াত") || n.includes("পরিবহন") || n.includes("transport")) return Truck;
  if (n.includes("বেতন") || n.includes("salary") || n.includes("কর্মচারী")) return Users;
  if (n.includes("ব্যানার") || n.includes("প্রচার") || n.includes("market") || n.includes("ad")) return Megaphone;
  if (n.includes("মেরামত") || n.includes("repair")) return Wrench;
  if (n.includes("সামগ্রী") || n.includes("অফিস")) return FileText;
  if (n.includes("চা") || n.includes("নাস্তা") || n.includes("food")) return Coffee;
  if (n.includes("ট্যাক্স") || n.includes("ভ্যাট") || n.includes("tax")) return Banknote;
  if (n.includes("প্যাকেজ")) return ShoppingBag;
  return Receipt;
};

type Range = "today" | "yesterday" | "this_month" | "last_month" | "all" | "custom";

function ymd(d: Date) { return toBDDate(d); }
function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }

export default function Expenses() {
  const { t, fmt, lang } = useT();
  const { user, role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [items, setItems] = useState<any[]>([]);
  const [cats, setCats] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [editCat, setEditCat] = useState<{ id: string; name: string } | null>(null);
  const [newCat, setNewCat] = useState("");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [range, setRange] = useState<Range>("this_month");
  const [customFrom, setCustomFrom] = useState(ymd(startOfMonth(new Date())));
  const [customTo, setCustomTo] = useState(ymd(new Date()));

  const empty = {
    title: "", amount: 0, category_id: "",
    expense_date: ymd(new Date()),
    payment_method: "cash", notes: "",
  };
  const [form, setForm] = useState<any>(empty);

  const load = async () => {
    const [e, c] = await Promise.all([
      supabase.from("expenses").select("*, expense_categories(name)").order("expense_date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("expense_categories").select("*").order("name"),
    ]);
    setItems(e.data ?? []);
    setCats(c.data ?? []);

    // Seed default categories on first visit (only if user is admin & list is essentially empty)
    if (isAdmin && (c.data ?? []).length < 3) {
      const existing = new Set((c.data ?? []).map((x: any) => x.name.trim().toLowerCase()));
      const toInsert = DEFAULT_CATS.filter(n => !existing.has(n.toLowerCase())).map(name => ({ name }));
      if (toInsert.length) {
        await supabase.from("expense_categories").insert(toInsert);
        const refresh = await supabase.from("expense_categories").select("*").order("name");
        setCats(refresh.data ?? []);
      }
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [isAdmin]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("expenses-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "expense_categories" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line
  }, []);

  const save = async () => {
    if (!form.title.trim() || Number(form.amount) <= 0) {
      return toast({ title: "শিরোনাম ও পরিমাণ দিন", variant: "destructive" });
    }
    const payload = {
      title: form.title.trim(),
      amount: Number(form.amount),
      category_id: form.category_id || null,
      expense_date: form.expense_date,
      payment_method: form.payment_method,
      notes: form.notes || null,
    };
    const { error } = editing
      ? await supabase.from("expenses").update(payload).eq("id", editing.id)
      : await supabase.from("expenses").insert({ ...payload, created_by: user!.id });
    if (error) return toast({ title: error.message, variant: "destructive" });
    if (!editing) {
      logActivity({
        action: "expense.create",
        entity_type: "expense",
        meta: { title: payload.title, amount: Number(payload.amount), payment_method: payload.payment_method },
      });
    }
    toast({ title: editing ? "খরচ আপডেট হয়েছে" : "খরচ যোগ হয়েছে" });
    setEditing(null); setForm(empty); setOpen(false); load();
  };

  const startEdit = (i: any) => {
    setEditing(i);
    setForm({
      title: i.title, amount: Number(i.amount), category_id: i.category_id ?? "",
      expense_date: i.expense_date, payment_method: i.payment_method ?? "cash",
      notes: i.notes ?? "",
    });
    setOpen(true);
  };

  const startNew = () => { setEditing(null); setForm(empty); setOpen(true); };

  // Find last entry matching a title (case-insensitive) — used to auto-fill amount
  const lastByTitle = (title: string) => {
    const q = title.trim().toLowerCase();
    if (!q) return null;
    return items.find((i: any) => (i.title || "").toLowerCase() === q) || null;
  };
  // Find last entry by category id
  const lastByCategory = (catId: string) => {
    if (!catId) return null;
    return items.find((i: any) => i.category_id === catId) || null;
  };

  // Click a category chip: set category, set title to category name, ALWAYS autofill amount from last saved entry of that category
  const pickCategory = (c: { id: string; name: string }) => {
    const prev = lastByCategory(c.id);
    setForm((f: any) => ({
      ...f,
      category_id: c.id,
      title: c.name,
      amount: prev ? Number(prev.amount) : 0,
    }));
  };

  // Click a title suggestion: set title + ALWAYS autofill amount/category from last saved matching entry
  const pickTitleSuggestion = (s: string) => {
    const prev = lastByTitle(s);
    setForm((f: any) => ({
      ...f,
      title: s,
      amount: prev ? Number(prev.amount) : f.amount,
      category_id: prev ? (prev.category_id ?? "") : f.category_id,
    }));
  };

  const saveCat = async () => {
    if (editCat) {
      if (!editCat.name.trim()) return;
      const { error } = await supabase.from("expense_categories").update({ name: editCat.name.trim() }).eq("id", editCat.id);
      if (error) return toast({ title: error.message, variant: "destructive" });
      setEditCat(null); load();
      return toast({ title: "ক্যাটাগরি আপডেট হয়েছে" });
    }
    if (!newCat.trim()) return;
    const { error } = await supabase.from("expense_categories").insert({ name: newCat.trim() });
    if (error) return toast({ title: error.message, variant: "destructive" });
    setNewCat(""); load();
    toast({ title: "ক্যাটাগরি যোগ হয়েছে" });
  };

  const delCat = async (id: string) => {
    if (!confirm("ক্যাটাগরি মুছবেন?")) return;
    const { error } = await supabase.from("expense_categories").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  // Date range computation
  const { fromDate, toDate, rangeLabel } = useMemo(() => {
    const today = new Date();
    if (range === "today") return { fromDate: ymd(today), toDate: ymd(today), rangeLabel: "আজ" };
    if (range === "yesterday") {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { fromDate: ymd(y), toDate: ymd(y), rangeLabel: "গতকাল" };
    }
    if (range === "this_month") return { fromDate: ymd(startOfMonth(today)), toDate: ymd(endOfMonth(today)), rangeLabel: "এই মাস" };
    if (range === "last_month") {
      const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      return { fromDate: ymd(startOfMonth(lm)), toDate: ymd(endOfMonth(lm)), rangeLabel: "গত মাস" };
    }
    if (range === "custom") return { fromDate: customFrom, toDate: customTo, rangeLabel: `${customFrom} → ${customTo}` };
    return { fromDate: "", toDate: "", rangeLabel: "সব সময়" };
  }, [range, customFrom, customTo]);

  const filtered = useMemo(() => items.filter(i => {
    if (fromDate && i.expense_date < fromDate) return false;
    if (toDate && i.expense_date > toDate) return false;
    if (filterCat && i.category_id !== filterCat) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!i.title.toLowerCase().includes(q) && !(i.expense_categories?.name ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  }), [items, fromDate, toDate, filterCat, search]);

  const todayStr = ymd(new Date());
  const yStr = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return ymd(d); })();
  const mStr = todayStr.slice(0, 7);
  const lmDate = new Date(); lmDate.setMonth(lmDate.getMonth() - 1);
  const lmStr = ymd(lmDate).slice(0, 7);

  const sumOf = (pred: (i: any) => boolean) => items.filter(pred).reduce((a, b) => a + Number(b.amount), 0);
  const todayTotal = sumOf(i => i.expense_date === todayStr);
  const yTotal = sumOf(i => i.expense_date === yStr);
  const mTotal = sumOf(i => i.expense_date.startsWith(mStr));
  const lmTotal = sumOf(i => i.expense_date.startsWith(lmStr));
  const filteredTotal = filtered.reduce((a, b) => a + Number(b.amount), 0);

  // Per-category totals (for chips badge & breakdown)
  const catTotals = useMemo(() => {
    const m: Record<string, { count: number; sum: number }> = {};
    filtered.forEach(i => {
      const k = i.category_id ?? "_none";
      if (!m[k]) m[k] = { count: 0, sum: 0 };
      m[k].count += 1; m[k].sum += Number(i.amount);
    });
    return m;
  }, [filtered]);

  return (
    <div className="pb-12">
      <PageHeader
        title={t("expenses")}
        subtitle="দোকানের সকল খরচ একসাথে — শ্রেণিবিন্যাস ও ইতিহাস সহ"
        actions={
          <div className="flex flex-wrap gap-2">
            {isAdmin && (
              <button
                onClick={() => setCatOpen(true)}
                className="inline-flex items-center gap-2 bg-info/10 text-info px-3 md:px-4 py-2.5 rounded-xl text-sm font-bold hover:bg-info/15 active:scale-95 transition-all"
              >
                <Tag className="h-4 w-4" /> ক্যাটাগরি
              </button>
            )}
            <button
              onClick={startNew}
              className="inline-flex items-center gap-2 bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground px-4 py-2.5 rounded-xl text-sm font-extrabold shadow-md shadow-destructive/30 hover:brightness-110 active:scale-95 transition-all"
            >
              <Plus className="h-5 w-5" /> নতুন খরচ
            </button>
          </div>
        }
      />

      {/* History stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-5 mb-5 md:mb-6">
        <HistoryCard active={range === "today"} onClick={() => setRange("today")}
          icon={<Wallet className="h-5 w-5" />} tone="destructive" label="আজকের খরচ" value={fmt(todayTotal)} />
        <HistoryCard active={range === "yesterday"} onClick={() => setRange("yesterday")}
          icon={<CalendarIcon className="h-5 w-5" />} tone="warning" label="গতকালের খরচ" value={fmt(yTotal)} />
        <HistoryCard active={range === "this_month"} onClick={() => setRange("this_month")}
          icon={<TrendingDown className="h-5 w-5" />} tone="info" label="এই মাসের খরচ" value={fmt(mTotal)} />
        <HistoryCard active={range === "last_month"} onClick={() => setRange("last_month")}
          icon={<Receipt className="h-5 w-5" />} tone="primary" label="গত মাসের খরচ" value={fmt(lmTotal)} />
      </div>

      {/* Filters */}
      <SurfaceCard className="p-3 md:p-5 mb-4 md:mb-6">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="খরচ খুঁজুন (শিরোনাম / ক্যাটাগরি)" className="pl-9 h-11" />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="h-4 w-4 text-muted-foreground hidden md:block" />
            {(["today","yesterday","this_month","last_month","custom","all"] as Range[]).map(r => (
              <button key={r} onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  range === r
                    ? "bg-primary text-primary-foreground shadow-md"
                    : "bg-[hsl(var(--surface-container-low))] text-foreground hover:bg-primary/10"
                }`}
              >
                {r === "today" && "আজ"}
                {r === "yesterday" && "গতকাল"}
                {r === "this_month" && "এই মাস"}
                {r === "last_month" && "গত মাস"}
                {r === "custom" && "কাস্টম"}
                {r === "all" && "সব"}
              </button>
            ))}
          </div>
        </div>

        {range === "custom" && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
            <div>
              <Label className="text-xs font-bold">শুরু তারিখ</Label>
              <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="h-11" />
            </div>
            <div>
              <Label className="text-xs font-bold">শেষ তারিখ</Label>
              <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="h-11" />
            </div>
          </div>
        )}

        {/* Category chip filters */}
        {cats.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            <button
              onClick={() => setFilterCat(null)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                filterCat === null
                  ? "bg-destructive text-destructive-foreground shadow-md"
                  : "bg-[hsl(var(--surface-container-low))] text-foreground hover:bg-destructive/10"
              }`}
            >
              সব ক্যাটাগরি
            </button>
            {cats.map(c => {
              const Icon = catIcon(c.name);
              const sum = catTotals[c.id]?.sum ?? 0;
              return (
                <button key={c.id} onClick={() => setFilterCat(filterCat === c.id ? null : c.id)}
                  className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                    filterCat === c.id
                      ? "bg-destructive text-destructive-foreground shadow-md"
                      : "bg-[hsl(var(--surface-container-low))] text-foreground hover:bg-destructive/10"
                  }`}
                >
                  <Icon className="h-3 w-3" /> {c.name}
                  {sum > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-extrabold ${
                      filterCat === c.id ? "bg-destructive-foreground/20" : "bg-destructive/15 text-destructive"
                    }`}>{fmt(sum)}</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* Result summary bar */}
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs md:text-sm font-bold text-muted-foreground">
          <span className="text-foreground">{rangeLabel}</span> · {filtered.length} টি এন্ট্রি
        </p>
        <p className="text-sm md:text-base font-extrabold text-destructive">
          মোট: {fmt(filteredTotal)}
        </p>
      </div>

      {/* List */}
      <SurfaceCard className="p-2 md:p-4">
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="inline-flex p-4 rounded-2xl bg-destructive/10 mb-3"><Receipt className="h-8 w-8 text-destructive" /></div>
            <p className="text-sm font-bold text-foreground">কোনো খরচ পাওয়া যায়নি</p>
            <p className="text-xs text-muted-foreground mt-1">এই সময়সীমায় কোনো খরচ লিপিবদ্ধ হয়নি</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(i => {
              const Icon = catIcon(i.expense_categories?.name ?? "");
              return (
                <div key={i.id}
                  className="flex items-center gap-3 p-3 md:p-4 rounded-xl bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container))] transition-all hover:-translate-y-0.5"
                >
                  <div className="h-11 w-11 md:h-12 md:w-12 rounded-xl bg-gradient-to-br from-destructive/20 to-destructive/5 text-destructive flex items-center justify-center shrink-0">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-foreground truncate text-sm md:text-base">{i.title}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] md:text-xs text-muted-foreground mt-0.5">
                      <span className="font-semibold">{new Date(i.expense_date).toLocaleDateString(lang === "bn" ? "bn-BD" : "en-GB", { timeZone: "Asia/Dhaka" })}</span>
                      {i.expense_categories?.name && (
                        <>
                          <span>·</span>
                          <span className="font-bold text-info">{i.expense_categories.name}</span>
                        </>
                      )}
                      <span>·</span>
                      <span className="capitalize font-semibold">{i.payment_method}</span>
                      {i.notes && <span className="hidden md:inline truncate">— {i.notes}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-extrabold text-destructive text-sm md:text-lg">{fmt(Number(i.amount))}</p>
                    {isAdmin && (
                      <div className="flex justify-end gap-0.5 mt-0.5">
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-info" onClick={() => startEdit(i)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => del(i.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>

      {/* Add / Edit expense dialog */}
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); setForm(empty); } }}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span className="inline-flex h-9 w-9 rounded-xl bg-destructive/15 text-destructive items-center justify-center">
                <Wallet className="h-4 w-4" />
              </span>
              {editing ? "খরচ আপডেট" : "নতুন খরচ"}
            </DialogTitle>
            <DialogDescription>খরচের বিস্তারিত দিয়ে সংরক্ষণ করুন</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="font-bold">শিরোনাম <span className="text-destructive">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm({ ...form, title: e.target.value })}
                placeholder="যেমনঃ দোকান ভাড়া, বিদ্যুৎ বিল"
                className="h-11"
                list="expense-title-suggestions"
                autoComplete="off"
              />
              <datalist id="expense-title-suggestions">
                {Array.from(new Set(items.map((i: any) => i.title).filter(Boolean))).slice(0, 100).map((t: string) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
              {form.title.trim().length > 0 && (() => {
                const q = form.title.trim().toLowerCase();
                const sugg = Array.from(new Set(items.map((i: any) => i.title as string).filter(Boolean)))
                  .filter(t => t.toLowerCase().includes(q) && t.toLowerCase() !== q)
                  .slice(0, 6);
                if (sugg.length === 0) return null;
                return (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {sugg.map(s => (
                      <button key={s} type="button" onClick={() => pickTitleSuggestion(s)}
                        className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-info/10 text-info hover:bg-info/20 transition">
                        {s}
                      </button>
                    ))}
                  </div>
                );
              })()}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="font-bold">পরিমাণ (৳) <span className="text-destructive">*</span></Label>
                <Input type="number" min={0} value={form.amount || ""}
                  onChange={e => setForm({ ...form, amount: +e.target.value })} placeholder="0" className="h-11 font-extrabold text-destructive" />
              </div>
              <div>
                <Label className="font-bold">তারিখ</Label>
                <Input type="date" value={form.expense_date}
                  onChange={e => setForm({ ...form, expense_date: e.target.value })} className="h-11" />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <Label className="font-bold">ক্যাটাগরি</Label>
                <span className="text-[10px] text-muted-foreground font-semibold">{cats.length} টি · scroll করুন</span>
              </div>
              <div className="rounded-xl border-2 border-dashed border-border bg-[hsl(var(--surface-container-lowest))] p-2 max-h-40 overflow-y-auto">
                <div className="flex flex-wrap gap-1.5">
                  <button type="button" onClick={() => setForm({ ...form, category_id: "" })}
                    className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                      !form.category_id
                        ? "bg-primary text-primary-foreground shadow"
                        : "bg-[hsl(var(--surface-container-low))] hover:bg-primary/10"
                    }`}
                  >— কোনোটি না —</button>
                  {cats.map(c => {
                    const Icon = catIcon(c.name);
                    const active = form.category_id === c.id;
                    return (
                      <button key={c.id} type="button" onClick={() => pickCategory(c)}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all inline-flex items-center gap-1.5 ${
                          active
                            ? "bg-destructive text-destructive-foreground shadow"
                            : "bg-[hsl(var(--surface-container-low))] hover:bg-destructive/10"
                        }`}
                      >
                        <Icon className="h-3 w-3" /> {c.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
            <div>
              <Label className="font-bold">পেমেন্ট মাধ্যম</Label>
              <div className="grid grid-cols-4 gap-2 mt-1.5">
                {[
                  { v: "cash", l: "Cash" }, { v: "bank", l: "Bank" },
                  { v: "bkash", l: "bKash" }, { v: "nagad", l: "Nagad" },
                ].map(p => (
                  <button key={p.v} type="button" onClick={() => setForm({ ...form, payment_method: p.v })}
                    className={`h-10 rounded-lg text-xs font-bold transition-all ${
                      form.payment_method === p.v
                        ? "bg-primary text-primary-foreground shadow"
                        : "bg-[hsl(var(--surface-container-low))] hover:bg-primary/10"
                    }`}
                  >{p.l}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="font-bold">নোট (ঐচ্ছিক)</Label>
              <Input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                placeholder="অতিরিক্ত তথ্য..." className="h-11" />
            </div>
          </div>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} className="w-full sm:w-auto">{t("cancel")}</Button>
            <Button onClick={save} className="w-full sm:w-auto bg-gradient-to-br from-destructive to-destructive/80 text-destructive-foreground hover:brightness-110 font-extrabold">
              {editing ? "আপডেট করুন" : "সংরক্ষণ করুন"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Category management dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="bg-[hsl(var(--surface-container-lowest))] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-info" /> খরচের ক্যাটাগরি
            </DialogTitle>
            <DialogDescription>নতুন ক্যাটাগরি যোগ, edit বা মুছে দিন</DialogDescription>
          </DialogHeader>
          {isAdmin && (
            <div className="flex gap-2 mb-3">
              {editCat ? (
                <>
                  <Input autoFocus value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && saveCat()} className="h-11" />
                  <Button onClick={saveCat}>সংরক্ষণ</Button>
                  <Button variant="ghost" size="icon" onClick={() => setEditCat(null)}><X className="h-4 w-4" /></Button>
                </>
              ) : (
                <>
                  <Input value={newCat} onChange={e => setNewCat(e.target.value)}
                    placeholder="নতুন ক্যাটাগরি..." onKeyDown={e => e.key === "Enter" && saveCat()} className="h-11" />
                  <Button onClick={saveCat} className="bg-info text-info-foreground hover:brightness-110"><Plus className="h-4 w-4" /></Button>
                </>
              )}
            </div>
          )}
          <div className="max-h-72 overflow-y-auto space-y-1.5">
            {cats.length === 0 && <p className="text-sm text-center text-muted-foreground py-6">কোনো ক্যাটাগরি নেই</p>}
            {cats.map(c => {
              const Icon = catIcon(c.name);
              return (
                <div key={c.id} className="flex items-center justify-between bg-[hsl(var(--surface-container-low))] px-3 py-2 rounded-lg">
                  <span className="text-sm font-bold flex items-center gap-2">
                    <Icon className="h-4 w-4 text-destructive" /> {c.name}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-info" onClick={() => setEditCat({ id: c.id, name: c.name })}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => delCat(c.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryCard({ icon, label, value, tone, active, onClick }: any) {
  const tones: Record<string, string> = {
    destructive: "from-destructive/20 to-destructive/5 text-destructive ring-destructive/40",
    warning: "from-warning/20 to-warning/5 text-warning ring-warning/40",
    info: "from-info/20 to-info/5 text-info ring-info/40",
    primary: "from-primary/20 to-primary/5 text-primary ring-primary/40",
  };
  return (
    <button onClick={onClick}
      className={`text-left bg-[hsl(var(--surface-container-lowest))] p-3 md:p-5 rounded-2xl flex items-center gap-3 transition-all hover:-translate-y-0.5 hover:shadow-md ${active ? "ring-2 " + tones[tone].split(" ").pop() : "ring-0"}`}
    >
      <div className={`p-2 md:p-3 rounded-xl bg-gradient-to-br ${tones[tone]} shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] md:text-sm font-bold truncate">{label}</p>
        <h3 className="text-base md:text-2xl font-extrabold text-foreground mt-0.5 truncate">{value}</h3>
      </div>
    </button>
  );
}
