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

  type Tone = "emerald" | "violet" | "sky" | "amber" | "indigo" | "teal" | "pink" | "rose" | "cyan" | "lime" | "fuchsia" | "orange" | "blue" | "purple";
  const allItems: { url: string; icon: any; label: string; key: PageKey; tone: Tone }[] = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard"), key: "dashboard", tone: "indigo" },
    { url: "/pos", icon: ShoppingCart, label: t("pos"), key: "pos", tone: "emerald" },
    { url: "/sales", icon: Receipt, label: t("salesLedger"), key: "sales", tone: "violet" },
    { url: "/customers", icon: Users, label: t("customers"), key: "customers", tone: "sky" },
    { url: "/contacts", icon: Contact, label: "যোগাযোগ", key: "contacts", tone: "cyan" },
    { url: "/installments", icon: Wallet, label: t("installments"), key: "installments", tone: "amber" },
    { url: "/products", icon: Package, label: t("productCatalog"), key: "products", tone: "teal" },
    { url: "/warranty", icon: ShieldCheck, label: "ওয়ারেন্টি", key: "warranty", tone: "lime" },
    { url: "/suppliers", icon: Truck, label: t("suppliers"), key: "suppliers", tone: "orange" },
    { url: "/purchases", icon: ShoppingBag, label: t("purchases"), key: "purchases", tone: "fuchsia" },
    { url: "/stock-adjustments", icon: Warehouse, label: t("stockAdjustments"), key: "stock-adjustments", tone: "blue" },
    { url: "/expenses", icon: ClipboardList, label: t("expenses"), key: "expenses", tone: "rose" },
    { url: "/reports", icon: BarChart3, label: t("reports"), key: "reports", tone: "purple" },
    { url: "/staff", icon: UserCog, label: t("staff"), key: "staff", tone: "pink" },
    { url: "/attendance", icon: CalendarCheck, label: t("attendance"), key: "attendance", tone: "emerald" },
  ];
  const items = allItems.filter(i => canAccess(i.key));

  const content = (
    <>
      {/* Brand — height matches top app bar (h-16) so the bottom border lines up with search bar's border */}
      <div className="h-16 px-6 border-b border-[hsl(var(--surface-container-high))] flex items-center justify-between shrink-0">
        <div className="min-w-0">
          <h1 className="text-lg font-black text-foreground leading-tight truncate">{t("appName")}</h1>
          <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase leading-tight">
            {isSuperAdmin ? "Super Admin" : "Staff Terminal"}
          </p>
        </div>
        <button onClick={onCloseMobile} className="md:hidden p-2 -mr-2 rounded-lg hover:bg-muted text-muted-foreground" aria-label="Close menu">
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Current shop badge — moved out of brand block */}
      {currentShop && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-2 bg-primary/10 px-3 py-2 rounded-lg">
            <Store className="h-4 w-4 text-primary shrink-0" />
            <span className="text-xs font-bold text-foreground truncate">{currentShop.name}</span>
          </div>
        </div>
      )}

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {isSuperAdmin && (
          <NavLink
            to="/shops"
            className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-[15px] mb-1 ${
              pathname === "/shops"
                ? "bg-primary text-primary-foreground font-extrabold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
                : "text-foreground/85 font-bold hover:bg-primary/10 hover:text-primary hover:translate-x-0.5"
            }`}
          >
            <span className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-300 ${
              pathname === "/shops"
                ? "bg-[hsl(var(--primary-foreground)/0.18)]"
                : "bg-primary/10 text-primary group-hover:bg-[linear-gradient(135deg,hsl(var(--primary-glow)),hsl(var(--primary)))] group-hover:text-[hsl(var(--primary-foreground))] group-hover:scale-110 group-hover:-rotate-6 group-hover:shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.5)]"
            }`}>
              <Store className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110" />
            </span>
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
                className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-[15px] ${
                  active
                    ? "bg-primary text-primary-foreground font-extrabold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
                    : "text-foreground/85 font-bold hover:bg-primary/10 hover:text-primary hover:translate-x-0.5"
                }`}
              >
                <span className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-300 ${
                  active
                    ? "bg-[hsl(var(--primary-foreground)/0.18)]"
                    : "bg-primary/10 text-primary group-hover:bg-[linear-gradient(135deg,hsl(var(--primary-glow)),hsl(var(--primary)))] group-hover:text-[hsl(var(--primary-foreground))] group-hover:scale-110 group-hover:-rotate-6 group-hover:shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.5)]"
                }`}>
                  <item.icon className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110" />
                </span>
                <span className="truncate">{item.label}</span>
              </NavLink>
              {isProducts && productsActive && (
                <NavLink
                  to="/products/barcodes"
                  className={`flex items-center gap-2 ml-11 mt-1 px-3 py-1.5 rounded-lg text-[12px] transition-all ${
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
          className={`group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-[15px] ${
            pathname === "/scanner"
              ? "bg-primary text-primary-foreground font-extrabold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
              : "text-foreground/85 font-bold hover:bg-primary/10 hover:text-primary hover:translate-x-0.5"
          }`}
        >
          <span className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all duration-300 ${
            pathname === "/scanner"
              ? "bg-[hsl(var(--primary-foreground)/0.18)]"
              : "bg-primary/10 text-primary group-hover:bg-[linear-gradient(135deg,hsl(var(--primary-glow)),hsl(var(--primary)))] group-hover:text-[hsl(var(--primary-foreground))] group-hover:scale-110 group-hover:-rotate-6 group-hover:shadow-[0_6px_16px_-6px_hsl(var(--primary)/0.5)]"
          }`}>
            <Smartphone className="h-[18px] w-[18px] transition-transform duration-300 group-hover:scale-110" />
          </span>
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
