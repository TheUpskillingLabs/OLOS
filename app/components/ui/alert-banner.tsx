import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  type LucideIcon,
} from "lucide-react";

type Variant = "warning" | "success" | "error" | "info";

const styles: Record<
  Variant,
  { wrap: string; title: string; icon: LucideIcon }
> = {
  warning: {
    wrap: "border-yellow-500/30 bg-yellow-500/[0.06]",
    title: "text-yellow-300",
    icon: AlertTriangle,
  },
  success: {
    wrap: "border-teal/20 bg-teal/10",
    title: "text-aqua",
    icon: CheckCircle2,
  },
  error: {
    wrap: "border-red/20 bg-red/10",
    title: "text-red-300",
    icon: XCircle,
  },
  info: {
    wrap: "border-teal/20 bg-teal/[0.04]",
    title: "text-aqua",
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
      className={`flex items-start gap-3 rounded-md border p-4 ${s.wrap} ${className ?? ""}`}
      role={variant === "error" ? "alert" : "status"}
    >
      <Icon className={`h-5 w-5 flex-shrink-0 ${s.title}`} aria-hidden />
      <div className="flex-1">
        {title && (
          <div className={`text-sm font-semibold ${s.title}`}>{title}</div>
        )}
        {children && (
          <div className={`text-sm text-cloud/80 ${title ? "mt-1" : ""}`}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  );
}
