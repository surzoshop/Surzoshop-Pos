import { useT } from "@/i18n/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useShop } from "@/hooks/useShop";
import { useLocation, useNavigate, Link } from "react-router-dom";
import { Bell, Search, Sun, Moon, ChevronLeft, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { GlobalSearch } from "@/components/GlobalSearch";


const TITLES: Record<string, string> = {
  "/": "ড্যাশবোর্ড",
  "/pos": "POS / বিক্রয়",
  "/products": "পণ্য",
  "/customers": "ক্রেতা",
  "/installments": "কিস্তি",
  "/sales": "বিক্রয় তালিকা",
  "/reports": "রিপোর্ট",
  "/suppliers": "সরবরাহকারী",
  "/purchases": "ক্রয়",
  "/expenses": "খরচ",
  "/stock-adjustments": "স্টক সমন্বয়",
  "/staff": "স্টাফ",
  "/attendance": "হাজিরা",
  "/shops": "শপ ম্যানেজমেন্ট",
  "/install": "অ্যাপ ইনস্টল",
};

export function AppMobileHeader() {
  const { user } = useAuth();
  const { currentShop } = useShop();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [dark, setDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => { document.documentElement.classList.toggle("dark", dark); }, [dark]);
  useEffect(() => { setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    if (!user) { setAvatarUrl(null); return; }
    supabase.from("profiles").select("avatar_url").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => setAvatarUrl(data?.avatar_url ?? null));
  }, [user]);

  const isHome = pathname === "/";
  const title = TITLES[pathname] ?? "সূর্য শপ";
  const initial = (user?.email ?? "A").charAt(0).toUpperCase();

  return (
    <header className="md:hidden fixed top-0 inset-x-0 z-30 app-bottom-nav border-b border-border safe-top">
      <div className="flex items-center justify-between px-3 h-14">
        <div className="flex items-center gap-2 min-w-0">
          {!isHome ? (
            <button
              onClick={() => navigate(-1)}
              className="h-10 w-10 -ml-2 flex items-center justify-center rounded-full hover:bg-muted active:scale-95 transition"
              aria-label="Back"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
          ) : (
            <Link to="/" className="h-9 w-9 rounded-xl bg-white border border-border flex items-center justify-center overflow-hidden">
              <img src="/brand-logo.png" alt="Logo" className="h-full w-full object-contain" />
            </Link>
          )}
          <div className="min-w-0">
            <h1 className="font-bold text-base leading-tight truncate">{title}</h1>
            {currentShop && (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 leading-tight truncate">
                <Store className="h-3 w-3" /> {currentShop.name}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setSearchOpen(true)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground" aria-label="Search">
            <Search className="h-5 w-5" />
          </button>

          <button onClick={() => setDark(d => !d)} className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground" aria-label="Theme">
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button className="h-10 w-10 flex items-center justify-center rounded-full hover:bg-muted text-muted-foreground relative" aria-label="Notifications">
            <Bell className="h-5 w-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-destructive rounded-full" />
          </button>
          <Link to="/account" aria-label="Account" className="h-9 w-9 rounded-full overflow-hidden gradient-primary text-primary-foreground flex items-center justify-center font-bold text-sm ml-1">
            {avatarUrl ? <img src={avatarUrl} alt="profile" className="h-full w-full object-cover" /> : initial}
          </Link>
        </div>
      </div>

      <Sheet open={searchOpen} onOpenChange={setSearchOpen}>
        <SheetContent side="top" className="p-4 pt-6 max-h-[90vh] overflow-y-auto">
          <SheetHeader className="mb-3">
            <SheetTitle className="text-base">খুঁজুন</SheetTitle>
          </SheetHeader>
          <div className="w-full">
            <GlobalSearch />
          </div>
          <p className="text-[11px] text-muted-foreground mt-3 text-center">ক্রেতা, ইনভয়েস, পণ্য বা ক্যাটেগরি অনুসন্ধান করুন</p>
        </SheetContent>
      </Sheet>
    </header>
  );
}

