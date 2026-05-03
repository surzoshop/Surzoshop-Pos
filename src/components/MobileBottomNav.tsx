import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Wallet, Smartphone, Menu } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useShop, PageKey } from "@/hooks/useShop";

interface Props {
  onOpenMenu: () => void;
}

export function MobileBottomNav({ onOpenMenu }: Props) {
  const { pathname } = useLocation();
  const { t } = useT();
  const { canAccess } = useShop();

  const items: { url: string; icon: any; label: string; key: PageKey }[] = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard"), key: "dashboard" as PageKey },
    { url: "/pos", icon: ShoppingCart, label: t("pos"), key: "pos" as PageKey },
    { url: "/installments", icon: Wallet, label: t("installments"), key: "installments" as PageKey },
  ].filter(i => canAccess(i.key));
  // Always show Install App entry (no permission gate)
  items.push({ url: "/install", icon: Smartphone, label: "App", key: "dashboard" as PageKey });

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-xl border-t border-border shadow-[0_-10px_30px_-10px_hsl(var(--foreground)/0.15)]">
      <div className="grid grid-cols-5 px-1 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {items.map(item => {
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
