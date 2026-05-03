import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Package, Receipt, Warehouse, Users, Settings,
  HelpCircle, LogOut, ShoppingCart,
} from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";

export function AppSidebar() {
  const { pathname } = useLocation();
  const { t } = useT();
  const { signOut } = useAuth();

  const items = [
    { url: "/", icon: LayoutDashboard, label: t("overview") },
    { url: "/products", icon: Package, label: t("productCatalog") },
    { url: "/sales", icon: Receipt, label: t("salesLedger") },
    { url: "/customers", icon: Users, label: t("customers") },
    { url: "/installments", icon: Warehouse, label: t("installments") },
    { url: "/reports", icon: Settings, label: t("reports") },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-[hsl(var(--surface-container-lowest))] flex-col py-6 z-40 shadow-[0_10px_40px_-10px_hsl(var(--foreground)/0.06)]">
      {/* Brand */}
      <div className="px-8 mb-10">
        <h1 className="text-lg font-black text-foreground leading-tight">
          {t("appName")}
        </h1>
        <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mt-1">
          Admin Terminal
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 flex flex-col">
        {items.map((item) => {
          const active = pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 px-8 py-3 transition-all duration-200 ${
                active
                  ? "text-primary border-l-4 border-primary bg-primary/5 font-medium"
                  : "text-muted-foreground hover:bg-[hsl(var(--surface-container-low))] border-l-4 border-transparent"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              <span className="font-medium text-sm">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="mt-auto px-8 pt-6 border-t border-[hsl(var(--surface-container-high))] space-y-4">
        <Link
          to="/pos"
          className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl font-bold text-sm shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)] hover:brightness-110 active:scale-95 transition-all"
        >
          <ShoppingCart className="h-4 w-4" />
          Open POS
        </Link>
        <div className="flex flex-col gap-2">
          <button className="flex items-center gap-3 text-muted-foreground text-sm hover:text-primary transition-colors">
            <HelpCircle className="h-5 w-5" />
            Help Center
          </button>
          <button
            onClick={signOut}
            className="flex items-center gap-3 text-muted-foreground text-sm hover:text-destructive transition-colors"
          >
            <LogOut className="h-5 w-5" />
            {t("logout")}
          </button>
        </div>
      </div>
    </aside>
  );
}
