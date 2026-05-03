import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Package, Receipt, Warehouse, Users, ShoppingCart,
  HelpCircle, LogOut, Truck, ShoppingBag, Wallet, ClipboardList,
  UserCog, CalendarCheck, BarChart3, Store,
} from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop, PageKey } from "@/hooks/useShop";

export function AppSidebar() {
  const { pathname } = useLocation();
  const { t } = useT();
  const { signOut } = useAuth();
  const { canAccess, isSuperAdmin, currentShop } = useShop();

  const allItems: { url: string; icon: any; label: string; key: PageKey }[] = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard"), key: "dashboard" },
    { url: "/pos", icon: ShoppingCart, label: t("pos"), key: "pos" },
    { url: "/sales", icon: Receipt, label: t("salesLedger"), key: "sales" },
    { url: "/customers", icon: Users, label: t("customers"), key: "customers" },
    { url: "/installments", icon: Wallet, label: t("installments"), key: "installments" },
    { url: "/products", icon: Package, label: t("productCatalog"), key: "products" },
    { url: "/suppliers", icon: Truck, label: t("suppliers"), key: "suppliers" },
    { url: "/purchases", icon: ShoppingBag, label: t("purchases"), key: "purchases" },
    { url: "/stock-adjustments", icon: Warehouse, label: t("stockAdjustments"), key: "stock-adjustments" },
    { url: "/expenses", icon: ClipboardList, label: t("expenses"), key: "expenses" },
    { url: "/reports", icon: BarChart3, label: t("reports"), key: "reports" },
    { url: "/staff", icon: UserCog, label: t("staff"), key: "staff" },
    { url: "/attendance", icon: CalendarCheck, label: t("attendance"), key: "attendance" },
  ];
  const items = allItems.filter(i => canAccess(i.key));

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-[hsl(var(--sidebar-background,var(--surface-container-lowest)))] flex-col z-40 shadow-[0_10px_40px_-10px_hsl(var(--foreground)/0.08)] border-r border-[hsl(var(--surface-container-high))]">
      {/* Brand */}
      <div className="px-6 pt-6 pb-5 border-b border-[hsl(var(--surface-container-high))]">
        <h1 className="text-lg font-black text-foreground leading-tight">{t("appName")}</h1>
        <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mt-1">Admin Terminal</p>
      </div>

      {/* Nav — flat list, always visible */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {items.map((item) => {
          const active = pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-[13px] ${
                active
                  ? "bg-primary text-primary-foreground font-bold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
                  : "text-foreground/85 font-medium hover:bg-primary/10 hover:text-primary"
              }`}
            >
              <item.icon className={`h-[18px] w-[18px] shrink-0 ${active ? "" : "text-primary"}`} />
              <span className="truncate">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[hsl(var(--surface-container-high))] space-y-3">
        <Link
          to="/pos"
          className="w-full inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl font-bold text-sm shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)] hover:brightness-110 active:scale-95 transition-all"
        >
          <ShoppingCart className="h-4 w-4" />
          Open POS
        </Link>
        <button className="flex items-center gap-3 text-foreground/70 text-xs font-medium hover:text-primary transition-colors w-full">
          <HelpCircle className="h-4 w-4" /> Help Center
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 text-foreground/70 text-xs font-medium hover:text-destructive transition-colors w-full"
        >
          <LogOut className="h-4 w-4" /> {t("logout")}
        </button>
      </div>
    </aside>
  );
}
