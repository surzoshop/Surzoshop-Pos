import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2 } from "lucide-react";

export default function Customers() {
  const { t } = useT();
  const { role } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", nid: "" });
  const isAdmin = role === "admin";

  const load = async () => {
    const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
    setItems(data ?? []);
  };
  useEffect(() => { load(); }, []);

  const save = async () => {
    const { error } = await supabase.from("customers").insert(form);
    if (error) return toast({ title: error.message, variant: "destructive" });
    setForm({ name: "", phone: "", address: "", nid: "" }); setOpen(false); load();
  };
  const del = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("customers").delete().eq("id", id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
  };

  const filtered = items.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.phone?.includes(search));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="text-2xl md:text-3xl font-bold">{t("customers")}</h1>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />{t("addCustomer")}</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{t("addCustomer")}</DialogTitle></DialogHeader>
            <div className="space-y-3">
              <div><Label>{t("name")}</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
              <div><Label>{t("phone")}</Label><Input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} /></div>
              <div><Label>{t("address")}</Label><Input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></div>
              <div><Label>{t("nid")}</Label><Input value={form.nid} onChange={e => setForm({ ...form, nid: e.target.value })} /></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>{t("cancel")}</Button><Button onClick={save}>{t("save")}</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
      <Input placeholder={t("search")} value={search} onChange={e => setSearch(e.target.value)} className="max-w-md" />
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left">
            <tr><th className="p-3">{t("name")}</th><th className="p-3">{t("phone")}</th><th className="p-3">{t("address")}</th>{isAdmin && <th className="p-3 text-right">{t("actions")}</th>}</tr>
          </thead>
          <tbody>
            {filtered.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("noResults")}</td></tr>}
            {filtered.map(c => (
              <tr key={c.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{c.name}</td>
                <td className="p-3">{c.phone || "-"}</td>
                <td className="p-3 text-muted-foreground">{c.address || "-"}</td>
                {isAdmin && <td className="p-3 text-right"><Button size="icon" variant="ghost" className="text-destructive" onClick={() => del(c.id)}><Trash2 className="h-4 w-4" /></Button></td>}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
