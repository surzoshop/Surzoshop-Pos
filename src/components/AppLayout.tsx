import { Outlet, NavLink } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { Search, Bell, Languages, Sun, Moon, Store, ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export default function AppLayout() {
  const { t, lang, setLang } = useT();
  const { user } = useAuth();
  const { shops, currentShop, setCurrentShopId, isSuperAdmin } = useShop();
  const [shopOpen, setShopOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const initial = (user?.email ?? "A").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-container-low))]">
      <AppSidebar />

      {/* Top App Bar — glassmorphic */}
      <header className="fixed top-0 right-0 left-0 md:left-64 h-16 glass z-30 flex justify-between items-center px-4 md:px-8 shadow-[0_10px_40px_-10px_hsl(var(--foreground)/0.06)]">
        <div className="flex items-center flex-1">
          <div className="relative w-full max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder={t("searchDashboard")}
              className="w-full bg-[hsl(var(--surface-container-low))] border-none rounded-full py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <nav className="hidden lg:flex items-center ml-8 gap-6">
            <NavLink to="/" end className={({ isActive }) =>
              isActive ? "text-primary border-b-2 border-primary pb-1 text-sm font-medium"
                       : "text-muted-foreground hover:text-primary transition-colors text-sm"}>
              {t("dashboard")}
            </NavLink>
            <NavLink to="/products" className={({ isActive }) =>
              isActive ? "text-primary border-b-2 border-primary pb-1 text-sm font-medium"
                       : "text-muted-foreground hover:text-primary transition-colors text-sm"}>
              {t("products")}
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) =>
              isActive ? "text-primary border-b-2 border-primary pb-1 text-sm font-medium"
                       : "text-muted-foreground hover:text-primary transition-colors text-sm"}>
              {t("reports")}
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          {/* Language Switcher — yellow chip */}
          <button
            onClick={() => setLang(lang === "bn" ? "en" : "bn")}
            className="flex items-center gap-2 bg-secondary text-secondary-foreground px-4 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 hover:brightness-105"
          >
            <Languages className="h-4 w-4" />
            BN / EN
          </button>
          <button onClick={() => setDark(d => !d)} className="text-muted-foreground hover:text-foreground transition-colors">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full" />
          </button>
          <div className="h-9 w-9 rounded-full gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            {initial}
          </div>
        </div>
      </header>

      {/* Main canvas */}
      <main className="md:ml-64 pt-16 min-h-screen">
        <div className="px-4 md:px-8 py-8 animate-fade-in">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
