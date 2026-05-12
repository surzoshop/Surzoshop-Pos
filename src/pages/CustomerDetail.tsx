import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { PageHeader, SurfaceCard, StatusPill } from "@/components/PageHeader";
import { AddCustomerSheet } from "@/components/AddCustomerSheet";
import {
  ArrowLeft, Phone, MapPin, IdCard, Briefcase, Wallet, Calendar,
  Pencil, Trash2, ShoppingBag, FileImage, Camera, User as UserIcon, Home,
} from "lucide-react";

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t, fmt } = useT();
  const { role } = useAuth();
  const { toast } = useToast();
  const isAdmin = role === "admin";

  const [customer, setCustomer] = useState<any | null>(null);
  const [sales, setSales] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [zoomed, setZoomed] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: c } = await supabase.from("customers").select("*").eq("id", id).maybeSingle();
    setCustomer(c);
    const { data: s } = await supabase.from("sales")
      .select("id,invoice_no,created_at,total,paid,due,status,payment_type")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });
    setSales(s ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const del = async () => {
    if (!customer || !confirm(t("confirmDelete"))) return;
    const { error } = await supabase.from("customers").delete().eq("id", customer.id);
    if (error) return toast({ title: error.message, variant: "destructive" });
    toast({ title: "ক্রেতা মুছে ফেলা হয়েছে" });
    nav("/customers");
  };

  if (loading) return <div className="text-center py-20 text-muted-foreground">লোড হচ্ছে...</div>;
  if (!customer) return (
    <div className="text-center py-20">
      <p className="text-muted-foreground mb-4">ক্রেতা পাওয়া যায়নি</p>
      <Button onClick={() => nav("/customers")}><ArrowLeft className="h-4 w-4 mr-1" /> ফিরে যান</Button>
    </div>
  );

  const totalPurchase = sales.reduce((a, s) => a + (Number(s.total) || 0), 0);
  const totalPaid = sales.reduce((a, s) => a + (Number(s.paid) || 0), 0);
  const totalDue = sales.reduce((a, s) => a + (Number(s.due) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={() => nav("/customers")} className="gap-1.5">
          <ArrowLeft className="h-4 w-4" /> ক্রেতার তালিকা
        </Button>
      </div>

      <PageHeader
        title={customer.name}
        subtitle="ক্রেতার সম্পূর্ণ KYC ও লেনদেন বিবরণ"
        actions={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setEditing(true)} className="gap-1.5">
                <Pencil className="h-4 w-4" /> এডিট
              </Button>
              <Button variant="destructive" onClick={del} className="gap-1.5">
                <Trash2 className="h-4 w-4" /> মুছুন
              </Button>
            </div>
          )
        }
      />

      {/* Top profile card */}
      <SurfaceCard className="p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          <div className="shrink-0 mx-auto sm:mx-0">
            {customer.photo_url ? (
              <button onClick={() => setZoomed(customer.photo_url)} className="block">
                <img
                  src={customer.photo_url}
                  alt={customer.name}
                  className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl object-cover ring-4 ring-primary/20 shadow-md hover:ring-primary/40 transition"
                />
              </button>
            ) : (
              <div className="h-32 w-32 sm:h-40 sm:w-40 rounded-2xl gradient-primary text-primary-foreground flex items-center justify-center font-black text-5xl">
                {customer.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="flex-1 space-y-3 w-full">
            <div className="flex items-start gap-2">
              <UserIcon className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <div className="text-xs text-muted-foreground">নাম</div>
                <div className="text-xl font-black">{customer.name}</div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoItem icon={<Phone className="h-4 w-4" />} label="প্রধান মোবাইল" value={customer.phone || "—"} />
              <InfoItem icon={<Phone className="h-4 w-4" />} label="বিকল্প মোবাইল" value={customer.alt_phone || "—"} />
              <InfoItem icon={<IdCard className="h-4 w-4" />} label="NID নম্বর" value={customer.nid || "—"} />
              <InfoItem icon={<Briefcase className="h-4 w-4" />} label="পেশা" value={customer.occupation || "—"} />
              <InfoItem icon={<Wallet className="h-4 w-4" />} label="মাসিক আয়" value={customer.monthly_income ? `৳${fmt(customer.monthly_income)}` : "—"} />
              <InfoItem icon={<Calendar className="h-4 w-4" />} label="যুক্ত হয়েছে" value={new Date(customer.created_at).toLocaleDateString("bn-BD")} />
            </div>
          </div>
        </div>
      </SurfaceCard>

      {/* Address section */}
      <SurfaceCard className="p-5 space-y-3">
        <h3 className="text-sm font-black flex items-center gap-2">
          <Home className="h-4 w-4 text-info" /> ঠিকানা
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <InfoItem icon={<MapPin className="h-4 w-4" />} label="বর্তমান ঠিকানা" value={customer.present_address || "—"} />
          <InfoItem icon={<MapPin className="h-4 w-4" />} label="স্থায়ী ঠিকানা" value={customer.permanent_address || "—"} />
          <InfoItem icon={<MapPin className="h-4 w-4" />} label="সংক্ষিপ্ত / এলাকা" value={customer.address || "—"} />
        </div>
      </SurfaceCard>

      {/* NID images */}
      <SurfaceCard className="p-5 space-y-3">
        <h3 className="text-sm font-black flex items-center gap-2">
          <FileImage className="h-4 w-4 text-info" /> NID কপি
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DocImage label="NID সামনের দিক" url={customer.nid_front_url} onZoom={setZoomed} />
          <DocImage label="NID পিছনের দিক" url={customer.nid_back_url} onZoom={setZoomed} />
        </div>
      </SurfaceCard>

      {/* Sales summary + history */}
      <div className="grid grid-cols-3 gap-3">
        <SurfaceCard className="p-4 text-center">
          <div className="text-[11px] text-muted-foreground font-medium">মোট ক্রয়</div>
          <div className="text-xl font-black">{sales.length}</div>
        </SurfaceCard>
        <SurfaceCard className="p-4 text-center bg-success/5">
          <div className="text-[11px] text-success font-medium">মোট টাকা</div>
          <div className="text-xl font-black text-success">৳{fmt(totalPurchase)}</div>
        </SurfaceCard>
        <SurfaceCard className="p-4 text-center bg-destructive/5">
          <div className="text-[11px] text-destructive font-medium">বকেয়া</div>
          <div className="text-xl font-black text-destructive">৳{fmt(totalDue)}</div>
        </SurfaceCard>
      </div>

      <SurfaceCard className="p-5">
        <h3 className="text-sm font-black flex items-center gap-2 mb-3">
          <ShoppingBag className="h-4 w-4 text-info" /> লেনদেন ইতিহাস ({sales.length})
        </h3>
        {sales.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground py-8">কোনো লেনদেন নেই</div>
        ) : (
          <div className="space-y-2">
            {sales.map(s => (
              <div key={s.id} className="flex items-center justify-between gap-3 p-3 rounded-lg bg-[hsl(var(--surface-container-low))]">
                <div className="min-w-0">
                  <div className="font-bold text-sm">{s.invoice_no}</div>
                  <div className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(s.created_at).toLocaleString("bn-BD", { timeZone: "Asia/Dhaka" })}
                  </div>
                  <div className="mt-1">
                    <StatusPill tone={s.status === "completed" ? "success" : s.status === "partial" ? "warning" : "info"}>
                      {s.payment_type === "installment" ? "কিস্তি" : s.payment_type === "credit" ? "বাকি" : "নগদ"} · {s.status}
                    </StatusPill>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="font-black text-sm">৳{fmt(s.total)}</div>
                  <div className="text-[10px] text-success">পরিশোধ ৳{fmt(s.paid)}</div>
                  {Number(s.due) > 0 && <div className="text-[10px] text-destructive">বকেয়া ৳{fmt(s.due)}</div>}
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>

      <AddCustomerSheet open={editing} onOpenChange={setEditing} onSaved={load} customer={customer} />

      {/* Zoom modal */}
      {zoomed && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setZoomed(null)}
        >
          <img src={zoomed} alt="" className="max-h-full max-w-full rounded-xl shadow-2xl" />
        </div>
      )}
    </div>
  );
}

function InfoItem({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 p-3 rounded-lg bg-[hsl(var(--surface-container-low))]">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="min-w-0">
        <div className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">{label}</div>
        <div className="text-sm font-semibold break-words whitespace-pre-wrap">{value}</div>
      </div>
    </div>
  );
}

function DocImage({ label, url, onZoom }: { label: string; url?: string | null; onZoom: (u: string) => void }) {
  return (
    <div className="bg-[hsl(var(--surface-container-low))] rounded-xl p-3">
      <div className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Camera className="h-3.5 w-3.5" /> {label}
      </div>
      {url ? (
        <button onClick={() => onZoom(url)} className="block w-full">
          <img src={url} alt={label} className="w-full max-h-64 object-contain rounded-lg bg-background hover:ring-2 hover:ring-primary/40 transition" />
        </button>
      ) : (
        <div className="h-40 flex items-center justify-center text-xs text-muted-foreground bg-background rounded-lg border-2 border-dashed">
          ছবি যোগ করা হয়নি
        </div>
      )}
    </div>
  );
}
