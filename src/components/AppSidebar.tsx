import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Package, Receipt, Warehouse, Users, ShoppingCart,
  HelpCircle, LogOut, Truck, ShoppingBag, Wallet, ClipboardList,
  UserCog, CalendarCheck, BarChart3, Store, X, Smartphone, Printer, Contact, ShieldCheck,
} from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop, PageKey } from "@/hooks/useShop";
import { useEffect } from "react";

interface Props {
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export function AppSidebar({ mobileOpen = false, onCloseMobile }: Props) {
  const { pathname } = useLocation();
  const { t } = useT();
  const { signOut } = useAuth();
  const { canAccess, isSuperAdmin, currentShop } = useShop();

  // close mobile drawer on route change
  useEffect(() => { if (mobileOpen) onCloseMobile?.(); /* eslint-disable-next-line */ }, [pathname]);

  const allItems: { url: string; icon: any; label: string; key: PageKey }[] = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard"), key: "dashboard" },
    { url: "/pos", icon: ShoppingCart, label: t("pos"), key: "pos" },
    { url: "/sales", icon: Receipt, label: t("salesLedger"), key: "sales" },
    { url: "/customers", icon: Users, label: t("customers"), key: "customers" },
    { url: "/contacts", icon: Contact, label: "যোগাযোগ", key: "customers" },
    { url: "/installments", icon: Wallet, label: t("installments"), key: "installments" },
    { url: "/products", icon: Package, label: t("productCatalog"), key: "products" },
    { url: "/warranty", icon: ShieldCheck, label: "ওয়ারেন্টি", key: "products" },
    { url: "/suppliers", icon: Truck, label: t("suppliers"), key: "suppliers" },
    { url: "/purchases", icon: ShoppingBag, label: t("purchases"), key: "purchases" },
    { url: "/stock-adjustments", icon: Warehouse, label: t("stockAdjustments"), key: "stock-adjustments" },
    { url: "/expenses", icon: ClipboardList, label: t("expenses"), key: "expenses" },
    { url: "/reports", icon: BarChart3, label: t("reports"), key: "reports" },
    { url: "/staff", icon: UserCog, label: t("staff"), key: "staff" },
    { url: "/attendance", icon: CalendarCheck, label: t("attendance"), key: "attendance" },
  ];
  const items = allItems.filter(i => canAccess(i.key));

  const content = (
    <>
      {/* Brand + current shop */}
      <div className="px-6 pt-6 pb-5 border-b border-[hsl(var(--surface-container-high))] flex items-start justify-between">
        <div>
          <h1 className="text-lg font-black text-foreground leading-tight">{t("appName")}</h1>
          <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mt-1">
            {isSuperAdmin ? "Super Admin" : "Staff Terminal"}
          </p>
          {currentShop && (
            <div className="mt-3 flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
              <Store className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs font-bold text-foreground truncate">{currentShop.name}</span>
            </div>
          )}
        </div>
        <button onClick={onCloseMobile} className="md:hidden p-2 -mr-2 -mt-1 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {isSuperAdmin && (
          <NavLink
            to="/shops"
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 text-[15px] mb-1 ${
              pathname === "/shops"
                ? "bg-primary text-primary-foreground font-extrabold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
                : "text-foreground/85 font-bold hover:bg-primary/10 hover:text-primary"
            }`}
          >
            <Store className={`h-5 w-5 shrink-0 ${pathname === "/shops" ? "" : "text-primary"}`} />
            <span className="truncate">Multiple Shops</span>
          </NavLink>
        )}
        {items.map((item) => {
          const active = pathname === item.url;
          const isProducts = item.url === "/products";
          const productsActive = pathname.startsWith("/products");
          return (
            <div key={item.url}>
              <NavLink
                to={item.url}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 text-[15px] ${
                  active
                    ? "bg-primary text-primary-foreground font-extrabold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
                    : "text-foreground/85 font-bold hover:bg-primary/10 hover:text-primary"
                }`}
              >
                <item.icon className={`h-5 w-5 shrink-0 ${active ? "" : "text-primary"}`} />
                <span className="truncate">{item.label}</span>
              </NavLink>
              {isProducts && productsActive && (
                <NavLink
                  to="/products/barcodes"
                  className={`flex items-center gap-2 ml-9 mt-1 px-3 py-1.5 rounded-lg text-[12px] transition-all ${
                    pathname === "/products/barcodes"
                      ? "bg-primary/15 text-primary font-bold"
                      : "text-foreground/70 hover:text-primary hover:bg-primary/5"
                  }`}
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>বারকোড প্রিন্ট</span>
                </NavLink>
              )}
            </div>
          );
        })}
        <NavLink
          to="/scanner"
          className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-150 text-[15px] ${
            pathname === "/scanner"
              ? "bg-primary text-primary-foreground font-extrabold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
              : "text-foreground/85 font-bold hover:bg-primary/10 hover:text-primary"
          }`}
        >
          <Smartphone className={`h-5 w-5 shrink-0 ${pathname === "/scanner" ? "" : "text-primary"}`} />
          <span className="truncate">Scanner App</span>
        </NavLink>
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
    </>
  );

  return (
    <>
      {/* Desktop */}
      <aside className="hidden md:flex fixed left-0 top-0 h-screen w-72 bg-[hsl(var(--sidebar-background,var(--surface-container-lowest)))] flex-col z-40 shadow-[0_10px_40px_-10px_hsl(var(--foreground)/0.08)] border-r border-[hsl(var(--surface-container-high))]">
        {content}
      </aside>

      {/* Mobile drawer */}
      <div className={`md:hidden fixed inset-0 z-50 ${mobileOpen ? "" : "pointer-events-none"}`}>
        <div
          onClick={onCloseMobile}
          className={`absolute inset-0 bg-foreground/40 backdrop-blur-sm transition-opacity ${mobileOpen ? "opacity-100" : "opacity-0"}`}
        />
        <aside
          className={`absolute left-0 top-0 h-full w-72 max-w-[85%] bg-[hsl(var(--sidebar-background,var(--surface-container-lowest)))] flex flex-col shadow-2xl border-r border-[hsl(var(--surface-container-high))] transition-transform duration-300 ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          {content}
        </aside>
      </div>
    </>
  );
}
