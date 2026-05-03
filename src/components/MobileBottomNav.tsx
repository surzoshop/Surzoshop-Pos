import { NavLink, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Wallet, Smartphone, Menu, ScanLine } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useShop, PageKey } from "@/hooks/useShop";

interface Props {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: Props) {
  const { pathname } = useLocation();
  const { t } = useT();
  const { canAccess } = useShop();

  const left = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard"), key: "dashboard" as PageKey },
    { url: "/installments", icon: Wallet, label: t("installments"), key: "installments" as PageKey },
  ].filter(i => canAccess(i.key));

  const right = [
    { url: "/scanner", icon: Smartphone, label: "Scanner", always: true },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 app-bottom-nav border-t border-border shadow-[0_-10px_30px_-10px_hsl(var(--foreground)/0.15)]">
      <div className="relative grid grid-cols-5 items-end px-1 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {left.map(item => {
          const active = pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`h-9 w-12 flex items-center justify-center rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="truncate max-w-full px-1">{item.label}</span>
            </NavLink>
          );
        })}

        {/* Center FAB — POS quick access */}
        {canAccess("pos" as PageKey) && (
          <div className="flex items-end justify-center">
            <Link
              to="/pos"
              className="app-fab -mt-7 h-14 w-14 rounded-full gradient-primary text-primary-foreground flex items-center justify-center active:scale-95 transition-transform"
              aria-label="POS"
            >
              <ScanLine className="h-6 w-6" />
            </Link>
          </div>
        )}

        {right.map(item => {
          const active = pathname === item.url;
          return (
            <NavLink
              key={item.url}
              to={item.url}
              className={`flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold transition-colors ${
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className={`h-9 w-12 flex items-center justify-center rounded-xl transition-all ${active ? "bg-primary/10" : ""}`}>
                <item.icon className="h-5 w-5" />
              </div>
              <span>{item.label}</span>
            </NavLink>
          );
        })}

        <button
          onClick={onOpenMenu}
          className="flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-semibold text-muted-foreground hover:text-foreground"
        >
          <div className="h-9 w-12 flex items-center justify-center rounded-xl">
            <Menu className="h-5 w-5" />
          </div>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
