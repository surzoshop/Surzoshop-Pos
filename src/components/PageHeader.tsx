import { ReactNode } from "react";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight text-foreground">{title}</h2>
        {subtitle && <p className="text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-3 flex-wrap">{actions}</div>}
    </div>
  );
}

export function StatusPill({ tone, children }: { tone: "success" | "warning" | "destructive" | "info" | "muted"; children: ReactNode }) {
  const map: Record<string, string> = {
    success: "bg-primary/10 text-primary",
    warning: "bg-secondary/30 text-[hsl(var(--secondary-foreground))]",
    destructive: "bg-destructive/10 text-destructive",
    info: "bg-info/10 text-info",
    muted: "bg-[hsl(var(--surface-container-high))] text-muted-foreground",
  };
  return (
    <span className={`${map[tone]} text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider whitespace-nowrap`}>
      {children}
    </span>
  );
}

export function SurfaceCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-[hsl(var(--surface-container-lowest))] rounded-2xl ${className}`}>
      {children}
    </div>
  );
}

export function PrimaryButton({ children, onClick, type = "button", className = "" }: any) {
  return (
    <button
      type={type}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 gradient-primary text-primary-foreground px-6 py-3 rounded-xl font-bold shadow-[0_10px_30px_-10px_hsl(var(--primary)/0.4)] hover:brightness-110 active:scale-95 transition-all ${className}`}
    >
      {children}
    </button>
  );
}

export function GhostButton({ children, onClick, className = "" }: any) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-2 bg-[hsl(var(--surface-container-lowest))] text-foreground px-5 py-3 rounded-xl font-semibold shadow-sm hover:bg-[hsl(var(--surface-container))] active:scale-95 transition-all ${className}`}
    >
      {children}
    </button>
  );
}
