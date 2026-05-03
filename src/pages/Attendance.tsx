import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";
import { Input } from "@/components/ui/input";

const STATUSES = ["present", "absent", "leave", "half_day"] as const;

export default function Attendance() {
  const { t, lang } = useT();
  const { toast } = useToast();
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [staff, setStaff] = useState<any[]>([]);
  const [att, setAtt] = useState<Record<string, string>>({});

  const load = async () => {
    const [s, a] = await Promise.all([
      supabase.from("staff").select("*").eq("is_active", true).order("name"),
      supabase.from("attendance").select("*").eq("date", date),
    ]);
    setStaff(s.data ?? []);
    const map: Record<string, string> = {};
    (a.data ?? []).forEach(r => { map[r.staff_id] = r.status; });
    setAtt(map);
  };
  useEffect(() => { load(); }, [date]);

  const mark = async (staff_id: string, status: string) => {
    const { error } = await supabase.from("attendance").upsert({ staff_id, date, status: status as any }, { onConflict: "staff_id,date" } as any);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setAtt({ ...att, [staff_id]: status });
  };

  const labels: Record<string, string> = {
    present: t("present"), absent: t("absent"), leave: t("leave"), half_day: t("halfDay"),
  };
  const tones: Record<string, any> = { present: "success", absent: "destructive", leave: "warning", half_day: "info" };

  return (
    <div>
      <PageHeader title={t("attendance")} subtitle={t("attendanceSubtitle")} />

      <SurfaceCard className="p-6 mb-6">
        <label className="text-sm text-muted-foreground mr-3">{t("date")}</label>
        <Input type="date" className="inline-flex w-auto" value={date} onChange={e => setDate(e.target.value)} />
      </SurfaceCard>

      <SurfaceCard className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-[11px] uppercase tracking-widest text-muted-foreground">
                <th className="pb-6 font-bold">{t("name")}</th>
                <th className="pb-6 font-bold">{t("position")}</th>
                <th className="pb-6 font-bold">{t("status")}</th>
                <th className="pb-6 font-bold text-right">{t("markAttendance")}</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {staff.length === 0 && <tr><td colSpan={4} className="py-12 text-center text-muted-foreground">{t("noResults")}</td></tr>}
              {staff.map(s => (
                <tr key={s.id} className="hover:bg-[hsl(var(--surface-container-low))]">
                  <td className="py-4 font-semibold">{s.name}</td>
                  <td className="py-4 text-muted-foreground">{s.position}</td>
                  <td className="py-4">{att[s.id] ? <StatusPill tone={tones[att[s.id]]}>{labels[att[s.id]]}</StatusPill> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="py-4 text-right">
                    <div className="inline-flex gap-1 flex-wrap justify-end">
                      {STATUSES.map(st => (
                        <button key={st} onClick={() => mark(s.id, st)}
                          className={`px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all ${
                            att[s.id] === st ? "bg-primary text-primary-foreground" : "bg-[hsl(var(--surface-container-low))] text-muted-foreground hover:bg-[hsl(var(--surface-container))]"
                          }`}>
                          {labels[st]}
                        </button>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SurfaceCard>
    </div>
  );
}
