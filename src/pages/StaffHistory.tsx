import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { PageHeader, SurfaceCard } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, ShoppingCart, Receipt, ClipboardList, LogIn, Users, Package,
  CalendarCheck, Activity, Phone, MapPin, Briefcase, Pencil, Clock,
} from "lucide-react";

const ACTION_META: Record<string, { label: string; icon: any; tone: string }> = {
  "sale.create": { label: "নতুন বিক্রয়", icon: ShoppingCart, tone: "text-emerald-600 bg-emerald-500/10" },
  "expense.create": { label: "নতুন খরচ", icon: ClipboardList, tone: "text-amber-600 bg-amber-500/10" },
  "customer.create": { label: "নতুন কাস্টমার", icon: Users, tone: "text-sky-600 bg-sky-500/10" },
  "product.create": { label: "নতুন পণ্য", icon: Package, tone: "text-fuchsia-600 bg-fuchsia-500/10" },
  "attendance.create": { label: "হাজিরা", icon: CalendarCheck, tone: "text-indigo-600 bg-indigo-500/10" },
  "auth.login": { label: "Login", icon: LogIn, tone: "text-slate-600 bg-slate-500/10" },
};

function metaFor(action: string) {
  return ACTION_META[action] ?? { label: action, icon: Activity, tone: "text-muted-foreground bg-muted" };
}

export default function StaffHistory() {
  const { id } = useParams<{ id: string }>();
  const nav = useNavigate();
  const { fmt } = useT();
  const [staff, setStaff] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: s } = await supabase.from("staff").select("*").eq("id", id).maybeSingle();
      setStaff(s);
      const { data: l } = await (supabase.from("staff_activity_logs" as any) as any)
        .select("*")
        .eq("staff_id", id)
        .order("created_at", { ascending: false })
        .limit(500);
      setLogs(l ?? []);
    })();
  }, [id]);

  const filtered = useMemo(() => {
    let arr = logs;
    if (tab === "sale") arr = arr.filter(l => l.action.startsWith("sale."));
    else if (tab === "expense") arr = arr.filter(l => l.action.startsWith("expense."));
    else if (tab === "login") arr = arr.filter(l => l.action.startsWith("auth."));
    else if (tab === "other") arr = arr.filter(l =>
      !l.action.startsWith("sale.") && !l.action.startsWith("expense.") && !l.action.startsWith("auth."));
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter(l => JSON.stringify(l).toLowerCase().includes(q));
    }
    return arr;
  }, [logs, tab, search]);

  const stats = useMemo(() => {
    const total = logs.length;
    const sales = logs.filter(l => l.action === "sale.create").length;
    const expenses = logs.filter(l => l.action === "expense.create").length;
    const logins = logs.filter(l => l.action.startsWith("auth.")).length;
    const lastAt = logs[0]?.created_at;
    return { total, sales, expenses, logins, lastAt };
  }, [logs]);

  if (!staff) {
    return (
      <div className="text-center py-20 text-muted-foreground">লোড হচ্ছে...</div>
    );
  }

  const initial = (staff.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Button variant="ghost" onClick={() => nav("/staff")} className="-ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" /> স্টাফ তালিকায় ফিরুন
        </Button>
        <Button onClick={() => nav("/staff")} size="sm" className="gradient-primary text-primary-foreground">
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> Password / Access সম্পাদনা
        </Button>
      </div>

      <PageHeader title="স্টাফ Activity History" subtitle="বিক্রয় • খরচ • Login সহ সব activity এক জায়গায়" />

      <SurfaceCard className="p-5 mb-5 bg-gradient-to-br from-[hsl(var(--surface-container-lowest))] to-[hsl(var(--surface-container-low))]">
        <div className="flex flex-wrap items-start gap-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-pink-400 to-fuchsia-600 text-white flex items-center justify-center font-black text-2xl shrink-0 shadow-lg shadow-fuchsia-500/30">
            {initial}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xl font-black">{staff.name}</h3>
            <div className="flex flex-wrap gap-3 mt-2 text-xs text-muted-foreground">
              {staff.position && <span className="flex items-center gap-1.5"><Briefcase className="h-3.5 w-3.5" />{staff.position}</span>}
              {staff.phone && <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{staff.phone}</span>}
              {staff.address && <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" />{staff.address}</span>}
            </div>
          </div>
          <div className="grid grid-cols-4 gap-2 w-full sm:w-auto">
            <MiniBox label="মোট" value={String(stats.total)} />
            <MiniBox label="বিক্রয়" value={String(stats.sales)} tone="text-emerald-600" />
            <MiniBox label="খরচ" value={String(stats.expenses)} tone="text-amber-600" />
            <MiniBox label="Login" value={String(stats.logins)} tone="text-sky-600" />
          </div>
        </div>
        {stats.lastAt && (
          <p className="text-[11px] text-muted-foreground mt-3 flex items-center gap-1.5">
            <Clock className="h-3 w-3" /> শেষ activity: {new Date(stats.lastAt).toLocaleString()}
          </p>
        )}
      </SurfaceCard>

      {/* Filter + tabs */}
      <div className="mb-4">
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="খুঁজুন..." className="max-w-sm" />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="mb-4 flex-wrap h-auto">
          <TabsTrigger value="all">সব Activity</TabsTrigger>
          <TabsTrigger value="sale">বিক্রয়</TabsTrigger>
          <TabsTrigger value="expense">খরচ</TabsTrigger>
          <TabsTrigger value="login">Login</TabsTrigger>
          <TabsTrigger value="other">অন্যান্য</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          {filtered.length === 0 ? (
            <SurfaceCard className="p-10 text-center text-muted-foreground">কোনো activity নেই</SurfaceCard>
          ) : (
            <SurfaceCard className="p-2 sm:p-3">
              <ul className="divide-y divide-[hsl(var(--border))]">
                {filtered.map(l => {
                  const m = metaFor(l.action);
                  const Icon = m.icon;
                  return (
                    <li key={l.id} className="flex items-start gap-3 px-3 py-3">
                      <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${m.tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold">{m.label}</p>
                        {l.meta && Object.keys(l.meta).length > 0 && (
                          <p className="text-[11px] text-muted-foreground truncate">
                            {l.meta.invoice_no && <span>Invoice: <b>{l.meta.invoice_no}</b> • </span>}
                            {typeof l.meta.amount !== "undefined" && <span>{fmt(Number(l.meta.amount))} • </span>}
                            {l.meta.title && <span>{l.meta.title}</span>}
                            {l.entity_type && !l.meta.invoice_no && !l.meta.title && <span>{l.entity_type}</span>}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground whitespace-nowrap">
                        {new Date(l.created_at).toLocaleString()}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </SurfaceCard>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MiniBox({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="bg-[hsl(var(--surface-container-high))] rounded-xl px-3 py-2 text-center">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className={`text-lg font-black mt-0.5 ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
