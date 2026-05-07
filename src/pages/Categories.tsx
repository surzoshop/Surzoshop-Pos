import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader, SurfaceCard, PrimaryButton } from "@/components/PageHeader";
import { Plus, Pencil, Trash2, Tag, Search, Package } from "lucide-react";

type Category = { id: string; name: string };

export default function Categories() {
  const { role } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const isAdmin = role === "admin";

  const [cats, setCats] = useState<Category[]>([]);
  const [counts, setCounts] = useState<Record<string, { products: number; stock: number }>>({});
  const [search, setSearch] = useState("");
  const [newCat, setNewCat] = useState("");
  const [editing, setEditing] = useState<Category | null>(null);

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      supabase.from("categories").select("id,name").order("name"),
      supabase.from("products").select("category_id,stock").eq("is_active", true),
    ]);
    setCats(c ?? []);
    const m: Record<string, { products: number; stock: number }> = {};
    (p ?? []).forEach((row: any) => {
      if (!row.category_id) return;
      if (!m[row.category_id]) m[row.category_id] = { products: 0, stock: 0 };
      m[row.category_id].products += 1;
      m[row.category_id].stock += Number(row.stock || 0);
    });
    setCounts(m);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("categories-page-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  const save = async () => {
    if (editing) {
      if (!editing.name.trim()) return;
      const { error } = await supabase.from("categories").update({ name: editing.name.trim() }).eq("id", editing.id);
      if (error) return toast({ title: error.message, variant: "destructive" });
      setEditing(null); load();
      return toast({ title: "ক্যাটাগরি আপডেট হয়েছে" });
    }
    if (!newCat.trim()) return;
    const { error } = await supabase.from("categories").insert({ name: newCat.trim() });
    if (error) return toast({ title: error.message, variant: "destructive" });
    setNewCat(""); load();
    toast({ title: "ক্যাটাগরি যোগ হয়েছে" });
  };

  const del = async (c: Category) => {
    if ((counts[c.id] ?? 0) > 0) {
      return toast({ title: `এই ক্যাটাগরিতে ${counts[c.id]} টি পণ্য আছে — আগে পণ্য সরান`, variant: "destructive" });
    }
    if (!confirm(`"${c.name}" মুছবেন?`)) return;
    const { error } = await supabase.from("categories").delete().eq("id", c.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    load();
    toast({ title: "ক্যাটাগরি মুছে ফেলা হয়েছে" });
  };

  const filtered = cats.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()));
  const totalProducts = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div>
      <PageHeader
        title="ক্যাটাগরি ম্যানেজমেন্ট"
        subtitle="পণ্যের ক্যাটাগরি যোগ, edit ও পরিচালনা করুন।"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-6 mb-6">
        <Stat icon={<Tag className="h-5 w-5 text-primary" />} bg="bg-primary/10" label="মোট ক্যাটাগরি" value={cats.length} />
        <Stat icon={<Package className="h-5 w-5 text-info" />} bg="bg-info/10" label="মোট পণ্য" value={totalProducts} />
        <Stat icon={<Tag className="h-5 w-5 text-[hsl(var(--secondary-foreground))]" />} bg="bg-secondary/30" label="খালি ক্যাটাগরি" value={cats.filter(c => !counts[c.id]).length} />
      </div>

      <SurfaceCard className="p-4 md:p-6">
        {/* Add / Edit form */}
        {isAdmin && (
          <div className="mb-4 flex gap-2">
            {editing ? (
              <>
                <Input
                  autoFocus
                  value={editing.name}
                  onChange={e => setEditing({ ...editing, name: e.target.value })}
                  placeholder="ক্যাটাগরির নতুন নাম"
                  onKeyDown={e => e.key === "Enter" && save()}
                  className="h-11"
                />
                <PrimaryButton onClick={save}>সংরক্ষণ</PrimaryButton>
                <Button variant="ghost" onClick={() => setEditing(null)}>বাতিল</Button>
              </>
            ) : (
              <>
                <Input
                  value={newCat}
                  onChange={e => setNewCat(e.target.value)}
                  placeholder="নতুন ক্যাটাগরির নাম..."
                  onKeyDown={e => e.key === "Enter" && save()}
                  className="h-11"
                />
                <PrimaryButton onClick={save}><Plus className="h-4 w-4" /> যোগ করুন</PrimaryButton>
              </>
            )}
          </div>
        )}

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="ক্যাটাগরি খুঁজুন..." className="pl-10 h-11" />
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground text-sm">কোনো ক্যাটাগরি নেই</div>
          )}
          {filtered.map(c => {
            const n = counts[c.id] ?? 0;
            return (
              <div
                key={c.id}
                className="group relative bg-[hsl(var(--surface-container-low))] hover:bg-[hsl(var(--surface-container))] rounded-2xl p-4 transition-all hover:-translate-y-0.5 hover:shadow-md"
              >
                <button
                  onClick={() => navigate(`/products?category=${c.id}`)}
                  className="absolute inset-0 rounded-2xl"
                  aria-label={`${c.name} এর পণ্য দেখুন`}
                />
                <div className="relative flex items-center gap-3 pointer-events-none">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground flex items-center justify-center shadow-md shrink-0">
                    <Tag className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-extrabold text-foreground truncate">{c.name}</p>
                    <p className="text-xs font-bold text-primary mt-0.5">
                      <span className="bg-primary/10 px-2 py-0.5 rounded-full">{n} পণ্য</span>
                    </p>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1 pointer-events-auto relative z-10">
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-info" onClick={(e) => { e.stopPropagation(); setEditing(c); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={(e) => { e.stopPropagation(); del(c); }}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </SurfaceCard>
    </div>
  );
}

function Stat({ icon, bg, label, value }: any) {
  return (
    <div className="bg-[hsl(var(--surface-container-lowest))] p-3 md:p-5 rounded-2xl flex items-center gap-3 transition-all hover:-translate-y-0.5">
      <div className={`p-2 md:p-3 ${bg} rounded-xl shrink-0`}>{icon}</div>
      <div className="min-w-0">
        <p className="text-muted-foreground text-[11px] md:text-sm font-bold truncate">{label}</p>
        <h3 className="text-lg md:text-2xl font-extrabold text-foreground mt-0.5">{value}</h3>
      </div>
    </div>
  );
}
