import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  type LucideIcon,
} from "lucide-react";

type Variant = "warning" | "success" | "error" | "info";

// The prototype's .gate-banner grammar: a white card with a 4px colored left
// edge. Brand palette carries two semantic hues — teal (good/informational)
// and red (risk/required) — so warning/error take the red edge and
// success/info the teal one; the icon keeps the finer distinction.
const styles: Record<
  Variant,
  { edge: string; title: string; icon: LucideIcon }
> = {
  warning: {
    edge: "border-l-red",
    title: "text-ink",
    icon: AlertTriangle,
  },
  success: {
    edge: "border-l-teal",
    title: "text-teal-deep",
    icon: CheckCircle2,
  },
  error: {
    edge: "border-l-red",
    title: "text-red",
    icon: XCircle,
  },
  info: {
    edge: "border-l-teal",
    title: "text-teal-deep",
    icon: Info,
  },
};

export function AlertBanner({
  variant,
  title,
  children,
  icon: IconOverride,
  action,
  className,
}: {
  variant: Variant;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: LucideIcon;
  action?: React.ReactNode;
  className?: string;
}) {
  const s = styles[variant];
  const Icon = IconOverride ?? s.icon;
  return (
    <div
      className={`flex items-start gap-3 rounded-card border border-ink/10 border-l-4 bg-white p-4 shadow-card ${s.edge} ${className ?? ""}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${s.title}`} aria-hidden />
      <div className="flex-1">
        {title && (
          <div className={`text-sm font-semibold ${s.title}`}>{title}</div>
        )}
        {children && (
          <div className={`text-sm text-charcoal ${title ? "mt-1" : ""}`}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
