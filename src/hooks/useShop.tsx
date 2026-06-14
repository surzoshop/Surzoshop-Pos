import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type Shop = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  logo_url: string | null;
  is_active: boolean;
  owner_id: string | null;
};

export type ShopMembership = {
  shop_id: string;
  permissions: Record<string, boolean>;
};

export const ALL_PAGES = [
  "dashboard","pos","sales","customers","contacts","installments","products",
  "warranty","suppliers","purchases","stock-adjustments","expenses","reports",
  "staff","attendance","shops","stock-ledger","customer-ledger","supplier-ledger","sales-returns","ledger","activity-logs","telegram",
] as const;
export type PageKey = typeof ALL_PAGES[number];

type Ctx = {
  shops: Shop[];
  currentShop: Shop | null;
  setCurrentShopId: (id: string | null) => void;
  memberships: ShopMembership[];
  isSuperAdmin: boolean;
  permissions: Record<string, boolean>; // for current shop (super admin = all true)
  canAccess: (page: PageKey) => boolean;
  refresh: () => Promise<void>;
  loading: boolean;
};

const ShopCtx = createContext<Ctx | null>(null);

export function ShopProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [memberships, setMemberships] = useState<ShopMembership[]>([]);
  const [currentShopId, setCurrentShopIdState] = useState<string | null>(
    () => localStorage.getItem("currentShopId")
  );
  const [loading, setLoading] = useState(true);

  const isSuperAdmin = role === "admin"; // existing 'admin' role acts as super admin

  const setCurrentShopId = (id: string | null) => {
    setCurrentShopIdState(id);
    if (id) localStorage.setItem("currentShopId", id);
    else localStorage.removeItem("currentShopId");
  };

  const [globalPerms, setGlobalPerms] = useState<Record<string, boolean>>({});

  const refresh = useCallback(async () => {
    if (!user) { setShops([]); setMemberships([]); setGlobalPerms({}); setLoading(false); return; }
    setLoading(true);
    const [{ data: shopRows }, { data: memRows }, { data: saRows }] = await Promise.all([
      supabase.from("shops").select("*").order("created_at", { ascending: true }),
      supabase.from("shop_users").select("shop_id, permissions").eq("user_id", user.id),
      supabase.from("staff_access" as any).select("permissions, is_active").eq("user_id", user.id).maybeSingle(),
    ]);
    setShops((shopRows ?? []) as Shop[]);
    setMemberships((memRows ?? []).map((m: any) => ({ shop_id: m.shop_id, permissions: m.permissions ?? {} })));
    const sa: any = saRows;
    setGlobalPerms(sa && sa.is_active !== false ? (sa.permissions ?? {}) : {});
    setLoading(false);
  }, [user]);

  useEffect(() => { refresh(); }, [refresh]);

  // Auto-select current shop
  useEffect(() => {
    if (!shops.length) return;
    if (currentShopId && shops.some(s => s.id === currentShopId)) return;
    setCurrentShopId(shops[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shops]);

  const currentShop = shops.find(s => s.id === currentShopId) ?? null;

  const permissions: Record<string, boolean> = (() => {
    if (isSuperAdmin) {
      const all: Record<string, boolean> = {};
      ALL_PAGES.forEach(p => { all[p] = true; });
      return all;
    }
    const m = memberships.find(m => m.shop_id === currentShopId);
    const shopPerms = (m?.permissions ?? {}) as Record<string, boolean>;
    // Merge: shop-specific perms take priority; staff_access acts as base/fallback
    // (so staff still has access even when no shop is selected or no shops exist).
    return { ...globalPerms, ...shopPerms };
  })();

  const canAccess = (page: PageKey) => {
    if (isSuperAdmin) return true;
    return !!permissions[page];
  };

  return (
    <ShopCtx.Provider value={{ shops, currentShop, setCurrentShopId, memberships, isSuperAdmin, permissions, canAccess, refresh, loading }}>
      {children}
    </ShopCtx.Provider>
  );
}

export const useShop = () => {
  const ctx = useContext(ShopCtx);
  if (!ctx) throw new Error("useShop must be inside ShopProvider");
  return ctx;
};
