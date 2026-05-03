import { NavLink, useLocation, Link } from "react-router-dom";
import {
  LayoutDashboard, Package, Receipt, Warehouse, Users, ShoppingCart,
  HelpCircle, LogOut, Truck, ShoppingBag, Wallet, ClipboardList,
  UserCog, CalendarCheck, BarChart3, ChevronDown,
} from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

type Item = { url: string; icon: any; label: string };
type Group = { label: string; items: Item[] };

export function AppSidebar() {
  const { pathname } = useLocation();
  const { t } = useT();
  const { signOut } = useAuth();

  const groups: Group[] = [
    {
      label: t("dashboard"),
      items: [{ url: "/", icon: LayoutDashboard, label: t("dashboard") }],
    },
    {
      label: t("sales"),
      items: [
        { url: "/pos", icon: ShoppingCart, label: t("pos") },
        { url: "/sales", icon: Receipt, label: t("salesLedger") },
        { url: "/customers", icon: Users, label: t("customers") },
        { url: "/installments", icon: Wallet, label: t("installments") },
      ],
    },
    {
      label: t("inventory"),
      items: [
        { url: "/products", icon: Package, label: t("productCatalog") },
        { url: "/suppliers", icon: Truck, label: t("suppliers") },
        { url: "/purchases", icon: ShoppingBag, label: t("purchases") },
        { url: "/stock-adjustments", icon: Warehouse, label: t("stockAdjustments") },
      ],
    },
    {
      label: t("finance"),
      items: [
        { url: "/expenses", icon: ClipboardList, label: t("expenses") },
        { url: "/reports", icon: BarChart3, label: t("reports") },
      ],
    },
    {
      label: t("hr"),
      items: [
        { url: "/staff", icon: UserCog, label: t("staff") },
        { url: "/attendance", icon: CalendarCheck, label: t("attendance") },
      ],
    },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-[hsl(var(--surface-container-lowest))] flex-col z-40 shadow-[0_10px_40px_-10px_hsl(var(--foreground)/0.06)]">
      {/* Brand */}
      <div className="px-7 pt-6 pb-5">
        <h1 className="text-lg font-black text-foreground leading-tight">{t("appName")}</h1>
        <p className="text-[10px] text-muted-foreground tracking-[0.2em] uppercase mt-1">Admin Terminal</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 pb-4 space-y-5">
        {groups.map((g) => (
          <SidebarGroup key={g.label} group={g} pathname={pathname} />
        ))}
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
        <button className="flex items-center gap-3 text-muted-foreground text-xs hover:text-primary transition-colors w-full">
          <HelpCircle className="h-4 w-4" /> Help Center
        </button>
        <button
          onClick={signOut}
          className="flex items-center gap-3 text-muted-foreground text-xs hover:text-destructive transition-colors w-full"
        >
          <LogOut className="h-4 w-4" /> {t("logout")}
        </button>
      </div>
    </aside>
  );
}

function SidebarGroup({ group, pathname }: { group: Group; pathname: string }) {
  const hasActive = group.items.some((i) => i.url === pathname);
  const [open, setOpen] = useState(hasActive || group.items.length === 1);
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span>{group.label}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="mt-1 space-y-0.5">
          {group.items.map((item) => {
            const active = pathname === item.url;
            return (
              <NavLink
                key={item.url}
                to={item.url}
                className={`flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-150 text-sm ${
                  active
                    ? "bg-primary text-primary-foreground font-semibold shadow-[0_8px_20px_-8px_hsl(var(--primary)/0.5)]"
                    : "text-muted-foreground hover:bg-[hsl(var(--surface-container-low))] hover:text-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      )}
    </div>
  );
}
