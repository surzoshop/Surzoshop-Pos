import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useShop, PageKey } from "@/hooks/useShop";
import { Card } from "@/components/ui/card";
import { ShieldX } from "lucide-react";

export function PageGate({ page, children }: { page: PageKey; children: ReactNode }) {
  const { canAccess, loading } = useShop();
  if (loading) return null;
  if (!canAccess(page)) {
    return (
      <div className="max-w-md mx-auto mt-20">
        <Card className="p-8 text-center">
          <ShieldX className="h-12 w-12 text-destructive mx-auto mb-3" />
          <h3 className="text-lg font-bold">Access Denied</h3>
          <p className="text-sm text-muted-foreground mt-2">এই page-এ আপনার access নেই।</p>
        </Card>
      </div>
    );
  }
  return <>{children}</>;
}
