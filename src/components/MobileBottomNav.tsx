import { NavLink, useLocation, Link } from "react-router-dom";
import { LayoutDashboard, Wallet, Smartphone, Menu, ScanLine } from "lucide-react";
import { useT } from "@/i18n/LanguageContext";
import { useShop, PageKey } from "@/hooks/useShop";

interface Props {
  onOpenMenu: () => void;
}

type Tone = "indigo" | "amber" | "slate" | "rose";
const TONES: Record<Tone, { grad: string; shadow: string }> = {
  indigo: { grad: "bg-gradient-to-br from-indigo-400 to-indigo-600", shadow: "shadow-indigo-500/40" },
  amber:  { grad: "bg-gradient-to-br from-amber-400 to-orange-500",  shadow: "shadow-amber-500/40" },
  slate:  { grad: "bg-gradient-to-br from-slate-400 to-slate-600",   shadow: "shadow-slate-500/40" },
  rose:   { grad: "bg-gradient-to-br from-rose-400 to-red-600",      shadow: "shadow-rose-500/40" },
};

export function MobileBottomNav({ onOpenMenu }: Props) {
  const { pathname } = useLocation();
  const { t } = useT();
  const { canAccess } = useShop();

  const left: { url: string; icon: any; label: string; key: PageKey; tone: Tone }[] = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard"), key: "dashboard", tone: "indigo" },
    { url: "/installments", icon: Wallet, label: t("installments"), key: "installments", tone: "amber" },
  ];
  const leftFiltered = left.filter(i => canAccess(i.key));

  const right: { url: string; icon: any; label: string; tone: Tone }[] = [
    { url: "/scanner", icon: Smartphone, label: "Scanner", tone: "slate" },
  ];

  const renderItem = (item: { url: string; icon: any; label: string; tone: Tone }) => {
    const active = pathname === item.url;
    const T = TONES[item.tone];
    return (
      <NavLink
        key={item.url}
        to={item.url}
        className={`group flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-bold transition-all ${
          active ? "text-primary" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <span className={`h-9 w-9 rounded-xl text-white flex items-center justify-center shadow-lg transition-all duration-300 ${T.grad} ${T.shadow} group-hover:scale-110 group-hover:-rotate-6 group-active:scale-95 group-active:rotate-0 ${active ? "ring-2 ring-primary/40 ring-offset-1 ring-offset-background" : ""}`}>
          <item.icon className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
        </span>
        <span className="truncate max-w-full px-1">{item.label}</span>
      </NavLink>
    );
  };

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 app-bottom-nav border-t border-border shadow-[0_-10px_30px_-10px_hsl(var(--foreground)/0.15)]">
      <div className="relative grid grid-cols-5 items-end px-1 pt-1 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {leftFiltered.map(renderItem)}

        {/* Center FAB — POS quick access */}
        {canAccess("pos" as PageKey) && (
          <div className="flex items-end justify-center">
            <Link
              to="/pos"
              className="group app-fab -mt-7 h-14 w-14 rounded-full gradient-primary text-primary-foreground flex items-center justify-center shadow-lg shadow-primary/40 active:scale-95 transition-all duration-300 hover:scale-105 hover:-rotate-6"
              aria-label="POS"
            >
              <ScanLine className="h-6 w-6 transition-transform duration-300 group-hover:scale-110" />
            </Link>
          </div>
        )}

        {right.map(renderItem)}

        <button
          onClick={onOpenMenu}
          className="group flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-xl text-[10px] font-bold text-muted-foreground hover:text-foreground"
        >
          <span className={`h-9 w-9 rounded-xl text-white flex items-center justify-center shadow-lg transition-all duration-300 ${TONES.rose.grad} ${TONES.rose.shadow} group-hover:scale-110 group-hover:-rotate-6 group-active:scale-95 group-active:rotate-0`}>
            <Menu style={{ width: 18, height: 18 }} />
          </span>
          <span>Menu</span>
        </button>
      </div>
    </nav>
  );
}
