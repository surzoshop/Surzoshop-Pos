import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, ShoppingCart, Package, Users, Calendar, Receipt, BarChart3, LogOut, Languages, Sun, Moon } from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarMenu,
  SidebarMenuButton, SidebarMenuItem, SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();
  const { t, lang, setLang } = useT();
  const { signOut, role } = useAuth();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));

  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);

  const items = [
    { url: "/", icon: LayoutDashboard, label: t("dashboard") },
    { url: "/pos", icon: ShoppingCart, label: t("pos") },
    { url: "/products", icon: Package, label: t("products") },
    { url: "/customers", icon: Users, label: t("customers") },
    { url: "/installments", icon: Calendar, label: t("installments") },
    { url: "/sales", icon: Receipt, label: t("sales") },
    { url: "/reports", icon: BarChart3, label: t("reports") },
  ];

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg gradient-primary flex items-center justify-center text-primary-foreground font-bold shrink-0">SS</div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="font-semibold text-sidebar-foreground truncate">{t("appName")}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{t("appTagline")}</div>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map(item => (
                <SidebarMenuItem key={item.url}>
                  <SidebarMenuButton asChild isActive={pathname === item.url}>
                    <NavLink to={item.url} className="flex items-center gap-3">
                      <item.icon className="h-5 w-5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-2 gap-1">
        {!collapsed && role && (
          <div className="px-2 py-1 text-xs text-sidebar-foreground/60 capitalize">{t(role as any)}</div>
        )}
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" className="flex-1 text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
            <Languages className="h-4 w-4" />{!collapsed && <span className="ml-1">{lang === "bn" ? "EN" : "বাং"}</span>}
          </Button>
          <Button size="sm" variant="ghost" className="text-sidebar-foreground hover:bg-sidebar-accent" onClick={() => setDark(d => !d)}>
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
        <Button size="sm" variant="ghost" className="justify-start text-sidebar-foreground hover:bg-sidebar-accent" onClick={signOut}>
          <LogOut className="h-4 w-4" />{!collapsed && <span className="ml-2">{t("logout")}</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
