import { Outlet, NavLink } from "react-router-dom";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { AppMobileHeader } from "@/components/AppMobileHeader";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { useStandalone } from "@/hooks/useStandalone";
import { Bell, Languages, Sun, Moon, Store, ChevronDown, Menu } from "lucide-react";
import { GlobalSearch } from "@/components/GlobalSearch";
import { useEffect, useState } from "react";

export default function AppLayout() {
  const { t, lang, setLang } = useT();
  const { user } = useAuth();
  const { shops, currentShop, setCurrentShopId, isSuperAdmin } = useShop();
  const [shopOpen, setShopOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  useStandalone();

  const initial = (user?.email ?? "A").charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-[hsl(var(--surface-container-low))]">
      <AppSidebar mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />

      {/* Mobile native-style top bar */}
      <AppMobileHeader />

      {/* Desktop / tablet Top App Bar — glassmorphic */}
      <header className="hidden md:flex fixed top-0 right-0 left-72 h-16 glass z-30 justify-between items-center px-8 shadow-[0_10px_40px_-10px_hsl(var(--foreground)/0.06)]">
        <div className="flex items-center flex-1 gap-2">
          <GlobalSearch />
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

        <div className="flex items-center gap-6">
          {isSuperAdmin && shops.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShopOpen(o => !o)}
                className="flex items-center gap-2 bg-primary/10 text-primary px-3 py-1.5 rounded-full text-xs font-bold hover:bg-primary/15 transition-all"
              >
                <Store className="h-4 w-4" />
                <span className="max-w-[120px] truncate">{currentShop?.name ?? "Select Shop"}</span>
                <ChevronDown className="h-3 w-3" />
              </button>
              {shopOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-background border rounded-xl shadow-xl z-50 py-1 max-h-72 overflow-y-auto">
                  {shops.map(s => (
                    <button
                      key={s.id}
                      onClick={() => { setCurrentShopId(s.id); setShopOpen(false); }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-primary/10 flex items-center gap-2 ${currentShop?.id === s.id ? "bg-primary/10 text-primary font-bold" : ""}`}
                    >
                      <Store className="h-4 w-4" />{s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
      <main className="md:ml-72 pt-14 md:pt-16 pb-24 md:pb-0 min-h-screen">
        <div className="px-3 md:px-8 py-4 md:py-8 animate-fade-in">
          <Outlet />
        </div>
      </main>

      <MobileBottomNav onOpenMenu={() => setMobileNavOpen(true)} />
    </div>
  );
}
