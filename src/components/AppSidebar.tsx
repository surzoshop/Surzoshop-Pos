import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Package, Receipt, Warehouse, Users, ShoppingCart,
  HelpCircle, LogOut, Truck, ShoppingBag, Wallet, ClipboardList,
  UserCog, CalendarCheck, BarChart3, Store, X, Smartphone, Printer, Contact, ShieldCheck,
  RotateCcw, BookOpen, Layers, Activity, Send,
} from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop, PageKey } from "@/hooks/useShop";
import { useEffect } from "react";

// Per-icon color theme — visible at rest, intensified on hover (Dashboard parity)
const ICON_THEMES: Record<string, { grad: string; shadow: string; ring: string }> = {
  emerald: { grad: "bg-gradient-to-br from-emerald-400 to-emerald-600", shadow: "shadow-emerald-500/40 group-hover:shadow-emerald-500/60", ring: "ring-emerald-500/20" },
  violet:  { grad: "bg-gradient-to-br from-violet-400 to-violet-600",   shadow: "shadow-violet-500/40 group-hover:shadow-violet-500/60",   ring: "ring-violet-500/20" },
  sky:     { grad: "bg-gradient-to-br from-sky-400 to-sky-600",         shadow: "shadow-sky-500/40 group-hover:shadow-sky-500/60",         ring: "ring-sky-500/20" },
  amber:   { grad: "bg-gradient-to-br from-amber-400 to-orange-500",    shadow: "shadow-amber-500/40 group-hover:shadow-amber-500/60",     ring: "ring-amber-500/20" },
  indigo:  { grad: "bg-gradient-to-br from-indigo-400 to-indigo-600",   shadow: "shadow-indigo-500/40 group-hover:shadow-indigo-500/60",   ring: "ring-indigo-500/20" },
  teal:    { grad: "bg-gradient-to-br from-teal-400 to-teal-600",       shadow: "shadow-teal-500/40 group-hover:shadow-teal-500/60",       ring: "ring-teal-500/20" },
  pink:    { grad: "bg-gradient-to-br from-pink-400 to-fuchsia-600",    shadow: "shadow-pink-500/40 group-hover:shadow-pink-500/60",       ring: "ring-pink-500/20" },
  rose:    { grad: "bg-gradient-to-br from-rose-400 to-red-600",        shadow: "shadow-rose-500/40 group-hover:shadow-rose-500/60",       ring: "ring-rose-500/20" },
  cyan:    { grad: "bg-gradient-to-br from-cyan-400 to-cyan-600",       shadow: "shadow-cyan-500/40 group-hover:shadow-cyan-500/60",       ring: "ring-cyan-500/20" },
  lime:    { grad: "bg-gradient-to-br from-lime-400 to-green-600",      shadow: "shadow-lime-500/40 group-hover:shadow-lime-500/60",       ring: "ring-lime-500/20" },
  fuchsia: { grad: "bg-gradient-to-br from-fuchsia-400 to-purple-600",  shadow: "shadow-fuchsia-500/40 group-hover:shadow-fuchsia-500/60", ring: "ring-fuchsia-500/20" },
  orange:  { grad: "bg-gradient-to-br from-orange-400 to-red-500",      shadow: "shadow-orange-500/40 group-hover:shadow-orange-500/60",   ring: "ring-orange-500/20" },
  blue:    { grad: "bg-gradient-to-br from-blue-400 to-blue-600",       shadow: "shadow-blue-500/40 group-hover:shadow-blue-500/60",       ring: "ring-blue-500/20" },
  purple:  { grad: "bg-gradient-to-br from-purple-400 to-purple-600",   shadow: "shadow-purple-500/40 group-hover:shadow-purple-500/60",   ring: "ring-purple-500/20" },
  slate:   { grad: "bg-gradient-to-br from-slate-400 to-slate-600",     shadow: "shadow-slate-500/40 group-hover:shadow-slate-500/60",     ring: "ring-slate-500/20" },
};

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

  type Tone = "emerald" | "violet" | "sky" | "amber" | "indigo" | "teal" | "pink" | "rose" | "cyan" | "lime" | "fuchsia" | "orange" | "blue" | "purple" | "slate";
  const allItems: { url: string; icon: any; label: string; key: PageKey; tone: Tone }[] = [
    { url: "/", icon: LayoutDashboard, label: "ড্যাশবোর্ড", key: "dashboard", tone: "indigo" },
    { url: "/pos", icon: ShoppingCart, label: "বিক্রি করুন (POS)", key: "pos", tone: "emerald" },
    { url: "/sales", icon: Receipt, label: "বিক্রয় তালিকা", key: "sales", tone: "violet" },
    { url: "/sales/returns", icon: RotateCcw, label: "বিক্রয় ফেরত", key: "sales-returns", tone: "rose" },
    { url: "/purchases", icon: ShoppingBag, label: "ক্রয় / স্টক এন্ট্রি", key: "purchases", tone: "fuchsia" },
    { url: "/products", icon: Package, label: "পণ্য তালিকা", key: "products", tone: "teal" },
    { url: "/stock-ledger", icon: Layers, label: "স্টক ম্যানেজমেন্ট", key: "stock-ledger", tone: "blue" },
    { url: "/stock-adjustments", icon: Warehouse, label: "স্টক সমন্বয়", key: "stock-adjustments", tone: "blue" },
    { url: "/expenses", icon: ClipboardList, label: "খরচ এন্ট্রি", key: "expenses", tone: "rose" },
    { url: "/ledger", icon: BookOpen, label: "হিসাব ব্যবস্থাপনা", key: "ledger", tone: "indigo" },
    { url: "/installments", icon: Wallet, label: "কিস্তি ম্যানেজমেন্ট", key: "installments", tone: "amber" },
    { url: "/warranty", icon: ShieldCheck, label: "ওয়ারেন্টি ম্যানেজমেন্ট", key: "warranty", tone: "lime" },
    { url: "/customers", icon: Users, label: "কাস্টমার ম্যানেজমেন্ট", key: "customers", tone: "sky" },
    { url: "/customers/ledger", icon: BookOpen, label: "বাকি ম্যানেজমেন্ট", key: "customer-ledger", tone: "cyan" },
    { url: "/customers/report", icon: ShieldCheck, label: "কাস্টমার রিপোর্ট", key: "customer-report", tone: "emerald" },
    { url: "/suppliers", icon: Truck, label: "সরবরাহকারী", key: "suppliers", tone: "orange" },
    { url: "/suppliers/ledger", icon: BookOpen, label: "সরবরাহকারী লেজার", key: "supplier-ledger", tone: "amber" },
    { url: "/contacts", icon: Contact, label: "যোগাযোগ", key: "contacts", tone: "cyan" },
    { url: "/reports", icon: BarChart3, label: "রিপোর্ট", key: "reports", tone: "purple" },
    { url: "/staff", icon: UserCog, label: "স্টাফ", key: "staff", tone: "pink" },
    { url: "/attendance", icon: CalendarCheck, label: "হাজিরা", key: "attendance", tone: "emerald" },
    { url: "/activity-logs", icon: Activity, label: "বিস্তারিত Activity Log", key: "activity-logs", tone: "slate" },
    { url: "/telegram", icon: Send, label: "Telegram Notification", key: "telegram", tone: "sky" },
  ];
  const items = allItems.filter(i => canAccess(i.key));

  const content = (
    <>
      {/* Brand — height matches top app bar (h-16) so the bottom border lines up with search bar's border */}
      <div className="h-16 px-4 border-b border-[hsl(var(--surface-container-high))] flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden shrink-0">
            <img src="/brand-logo.png" alt="Logo" className="h-full w-full object-contain" />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-black text-foreground leading-tight truncate">{t("appName")}</h1>
            <p className="text-[9px] text-muted-foreground tracking-[0.2em] uppercase leading-tight">
              {isSuperAdmin ? "Super Admin Panel" : "স্টাফ প্যানেল • Staff Panel"}
            </p>
          </div>
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
        {isSuperAdmin && (() => {
          const T = ICON_THEMES.fuchsia;
          const active = pathname === "/shops";
          return (
            <NavLink
              to="/shops"
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 text-[15px] mb-1 ${
                active
                  ? "bg-primary/10 text-primary font-extrabold ring-1 ring-primary/30"
                  : "text-foreground/85 font-bold hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-md"
              }`}
            >
              <span className={`shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl text-white shadow-lg transition-all duration-300 ${T.grad} ${T.shadow} group-hover:scale-110 group-hover:-rotate-6 group-active:rotate-0 group-active:scale-95`}>
                <Store className="h-[18px] w-[18px]" />
              </span>
              <span className="truncate">Multiple Shops</span>
            </NavLink>
          );
        })()}
        {items.map((item) => {
          const active = pathname === item.url;
          const isProducts = item.url === "/products";
          const productsActive = pathname.startsWith("/products");
          const T = ICON_THEMES[item.tone] ?? ICON_THEMES.indigo;
          return (
            <div key={item.url}>
              <NavLink
                to={item.url}
                className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 text-[15px] ${
                  active
                    ? "bg-primary/10 text-primary font-extrabold ring-1 ring-primary/30"
                    : "text-foreground/85 font-bold hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-md"
                }`}
              >
                <span className={`shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl text-white shadow-lg transition-all duration-300 ${T.grad} ${T.shadow} group-hover:scale-110 group-hover:-rotate-6 group-active:rotate-0 group-active:scale-95`}>
                  <item.icon className="h-[18px] w-[18px]" />
                </span>
                <span className="truncate">{item.label}</span>
              </NavLink>
              {isProducts && productsActive && (
                <div className="ml-6 mt-1 space-y-1">
                  {[
                    { to: "/products/categories", label: "ক্যাটাগরি", icon: Layers, tone: "teal" as const },
                    { to: "/products/barcodes", label: "বারকোড প্রিন্ট", icon: Printer, tone: "fuchsia" as const },
                  ].map(sub => {
                    const ST = ICON_THEMES[sub.tone];
                    const subActive = pathname === sub.to;
                    const Icon = sub.icon;
                    return (
                      <NavLink
                        key={sub.to}
                        to={sub.to}
                        className={`group flex items-center gap-3 px-3 py-2 rounded-xl transition-all duration-300 text-[13px] ${
                          subActive
                            ? "bg-primary/10 text-primary font-extrabold ring-1 ring-primary/30"
                            : "text-foreground/85 font-bold hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-md"
                        }`}
                      >
                        <span className={`shrink-0 inline-flex items-center justify-center h-7 w-7 rounded-lg text-white shadow-md transition-all duration-300 ${ST.grad} ${ST.shadow} group-hover:scale-110 group-hover:-rotate-6 group-active:rotate-0 group-active:scale-95`}>
                          <Icon className="h-[14px] w-[14px]" />
                        </span>
                        <span className="truncate">{sub.label}</span>
                      </NavLink>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
        {(() => {
          const T = ICON_THEMES.slate;
          const active = pathname === "/install";
          return (
            <NavLink
              to="/install"
              className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-300 text-[15px] ${
                active
                  ? "bg-primary/10 text-primary font-extrabold ring-1 ring-primary/30"
                  : "text-foreground/85 font-bold hover:bg-muted/60 hover:-translate-y-0.5 hover:shadow-md"
              }`}
            >
              <span className={`shrink-0 inline-flex items-center justify-center h-9 w-9 rounded-xl text-white shadow-lg transition-all duration-300 ${T.grad} ${T.shadow} group-hover:scale-110 group-hover:-rotate-6 group-active:rotate-0 group-active:scale-95`}>
                <Smartphone className="h-[18px] w-[18px]" />
              </span>
              <span className="truncate">Apps</span>
            </NavLink>
          );
        })()}
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
