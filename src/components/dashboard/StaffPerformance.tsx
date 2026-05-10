import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { Users, UserCheck, Trophy, Activity, ArrowRight } from "lucide-react";

type StaffRow = { id: string; name: string; position: string | null; is_active: boolean };
type SalePerformer = { user_id: string; name: string; count: number; revenue: number };

export default function StaffPerformance() {
  const { t, fmt, lang } = useT();
  const [staff, setStaff] = useState<StaffRow[]>([]);
  const [presentToday, setPresentToday] = useState(0);
  const [absentToday, setAbsentToday] = useState(0);
  const [perf, setPerf] = useState<SalePerformer[]>([]);

  useEffect(() => { void load(); }, []);

  const load = async () => {
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    const [staffRes, attRes, salesRes, profilesRes] = await Promise.all([
      supabase.from("staff").select("id,name,position,is_active"),
      supabase.from("attendance").select("staff_id,status").eq("date", todayStart.toISOString().slice(0, 10)),
      supabase.from("sales").select("created_by,total").gte("created_at", monthStart.toISOString()),
      supabase.from("profiles").select("user_id,full_name"),
    ]);

    const staffArr = (staffRes.data ?? []) as StaffRow[];
    setStaff(staffArr);

    const att = attRes.data ?? [];
    setPresentToday(att.filter((a: any) => a.status === "present" || a.status === "late").length);
    setAbsentToday(att.filter((a: any) => a.status === "absent").length);

    const profileMap = new Map<string, string>();
    (profilesRes.data ?? []).forEach((p: any) => profileMap.set(p.user_id, p.full_name ?? ""));

    const map = new Map<string, { count: number; revenue: number }>();
    (salesRes.data ?? []).forEach((s: any) => {
      if (!s.created_by) return;
      const cur = map.get(s.created_by) ?? { count: 0, revenue: 0 };
      cur.count += 1; cur.revenue += Number(s.total);
      map.set(s.created_by, cur);
    });
    const list: SalePerformer[] = [...map.entries()].map(([uid, v]) => ({
      user_id: uid,
      name: profileMap.get(uid) || (lang === "bn" ? "অজানা" : "Unknown"),
      count: v.count,
      revenue: v.revenue,
    })).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    setPerf(list);
  };

  const activeStaff = useMemo(() => staff.filter(s => s.is_active).length, [staff]);
  const maxRev = Math.max(1, ...perf.map(p => p.revenue));

  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] border border-[hsl(var(--border))] rounded-2xl p-4 md:p-6 space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-500 text-white flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-base md:text-xl font-bold text-foreground font-bn">স্টাফ পারফরম্যান্স</h3>
            <p className="text-xs text-muted-foreground font-bn">এই মাসের বিক্রয় ও আজকের উপস্থিতি</p>
          </div>
        </div>
        <Link to="/staff" className="text-xs md:text-sm font-bold text-indigo-600 dark:text-indigo-400 inline-flex items-center gap-1 hover:gap-2 transition-all">
          {t("viewAll")} <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-2.5 md:gap-3">
        <KPI tone="indigo" icon={<Users className="h-4 w-4" />} label={lang === "bn" ? "মোট স্টাফ" : "Active Staff"} value={`${activeStaff}`} />
        <KPI tone="emerald" icon={<UserCheck className="h-4 w-4" />} label={lang === "bn" ? "আজ উপস্থিত" : "Present Today"} value={`${presentToday}`} />
        <KPI tone="rose" icon={<Activity className="h-4 w-4" />} label={lang === "bn" ? "আজ অনুপস্থিত" : "Absent Today"} value={`${absentToday}`} />
      </div>

      {/* Performance bars */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-500" />
          <h4 className="text-sm font-bold text-foreground font-bn">শীর্ষ বিক্রেতা (এই মাস)</h4>
        </div>
        <div className="space-y-2.5">
          {perf.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-6 font-bn">এই মাসে কোনো বিক্রয় ডেটা নেই</p>
          )}
          {perf.map((p, i) => {
            const pct = (p.revenue / maxRev) * 100;
            const tones = [
              "from-amber-400 to-orange-500",
              "from-sky-400 to-cyan-500",
              "from-emerald-400 to-teal-500",
              "from-violet-400 to-purple-500",
              "from-rose-400 to-pink-500",
            ];
            return (
              <div key={p.user_id} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="h-5 w-5 shrink-0 rounded-md bg-foreground/10 text-foreground font-black text-[10px] flex items-center justify-center">{i + 1}</span>
                    <span className="font-semibold truncate">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-muted-foreground">{p.count} {t("soldQty")}</span>
                    <span className="font-bold text-foreground">{fmt(p.revenue)}</span>
                  </div>
                </div>
                <div className="h-2 rounded-full bg-[hsl(var(--surface-container-low))] overflow-hidden">
                  <div className={`h-full rounded-full bg-gradient-to-r ${tones[i] ?? tones[0]}`} style={{ width: `${pct}%`, transition: "width 600ms ease-out" }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function KPI({ tone, icon, label, value }: { tone: "indigo" | "emerald" | "rose"; icon: React.ReactNode; label: string; value: string }) {
  const map = {
    indigo: "from-indigo-500/15 to-indigo-500/5 text-indigo-600 dark:text-indigo-400 border-indigo-500/20",
    emerald: "from-emerald-500/15 to-emerald-500/5 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    rose: "from-rose-500/15 to-rose-500/5 text-rose-600 dark:text-rose-400 border-rose-500/20",
  } as const;
  return (
    <div className={`bg-gradient-to-br ${map[tone]} border rounded-xl p-3`}>
      <div className="flex items-center gap-1.5 mb-1.5">
        {icon}
        <span className="text-[10px] font-bold uppercase tracking-wider truncate">{label}</span>
      </div>
      <div className="text-xl md:text-2xl font-black text-foreground">{value}</div>
    </div>
  );
}
