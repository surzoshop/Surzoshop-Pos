import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type Role = "admin" | "cashier" | "staff" | "super_admin" | null;

type AuthCtx = {
  user: User | null;
  session: Session | null;
  role: Role;
  loading: boolean;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<Role>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(async () => {
          const { data } = await supabase.from("user_roles").select("role").eq("user_id", s.user.id);
          const roles = (data ?? []).map(r => r.role);
          setRole(
            roles.includes("super_admin") ? "super_admin"
            : roles.includes("admin") ? "admin"
            : roles.includes("cashier") ? "cashier"
            : roles.includes("staff") ? "staff"
            : null
          );
        }, 0);
      } else {
        setRole(null);
      }
    });

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        supabase.from("user_roles").select("role").eq("user_id", s.user.id).then(({ data }) => {
          const roles = (data ?? []).map(r => r.role);
          setRole(
            roles.includes("super_admin") ? "super_admin"
            : roles.includes("admin") ? "admin"
            : roles.includes("cashier") ? "cashier"
            : roles.includes("staff") ? "staff"
            : null
          );
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    try {
      // Best-effort logout log before token is gone
      try {
        const { logActivity } = await import("@/lib/activityLog");
        await logActivity({ action: "auth.logout" });
      } catch { /* ignore */ }
      await supabase.auth.signOut();
    } catch (e) {
      console.warn("signOut error", e);
    }
    setUser(null);
    setSession(null);
    setRole(null);
    // ProtectedRoute will redirect to /auth via React Router (no full page reload → no 404 risk)
  };

  return <Ctx.Provider value={{ user, session, role, loading, signOut }}>{children}</Ctx.Provider>;
}

export const useAuth = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAuth must be inside AuthProvider");
  return ctx;
};
