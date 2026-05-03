import { Link, useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { Home, ArrowLeft, Search, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useT } from "@/i18n/LanguageContext";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { lang } = useT();
  const bn = lang === "bn";

  useEffect(() => {
    console.warn("404:", location.pathname);
  }, [location.pathname]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 px-4">
      <div className="max-w-lg w-full text-center animate-fade-in">
        <div className="relative mx-auto mb-8 h-32 w-32">
          <div className="absolute inset-0 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative h-full w-full rounded-full gradient-primary flex items-center justify-center shadow-2xl">
            <AlertCircle className="h-16 w-16 text-primary-foreground" strokeWidth={1.5} />
          </div>
        </div>

        <h1 className="text-7xl md:text-8xl font-extrabold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent mb-3">
          404
        </h1>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-3">
          {bn ? "পেজটি খুঁজে পাওয়া যায়নি" : "Page Not Found"}
        </h2>
        <p className="text-muted-foreground mb-2">
          {bn
            ? "আপনি যে পেজটি খুঁজছেন সেটি সরিয়ে ফেলা হয়েছে অথবা ঠিকানাটি ভুল।"
            : "The page you are looking for has been moved or the URL is incorrect."}
        </p>
        <code className="inline-block text-xs bg-muted px-3 py-1 rounded-full text-muted-foreground mb-8">
          {location.pathname}
        </code>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button onClick={() => navigate(-1)} variant="outline" size="lg" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            {bn ? "পিছনে যান" : "Go Back"}
          </Button>
          <Button asChild size="lg" className="gap-2">
            <Link to="/">
              <Home className="h-4 w-4" />
              {bn ? "হোমে ফিরুন" : "Back to Home"}
            </Link>
          </Button>
          <Button asChild variant="ghost" size="lg" className="gap-2">
            <Link to="/pos">
              <Search className="h-4 w-4" />
              POS
            </Link>
          </Button>
        </div>

        <p className="mt-10 text-xs text-muted-foreground">
          Easy Kisti Shop · {new Date().getFullYear()}
        </p>
      </div>
    </main>
  );
};

export default NotFound;
