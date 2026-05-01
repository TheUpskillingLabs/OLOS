import * as React from "react";

type Variant =
  | "active"
  | "forming"
  | "inactive"
  | "draft"
  | "revoked"
  | "success";

const styles: Record<Variant, { wrap: string; dot: string }> = {
  active: { wrap: "bg-teal/20 text-aqua", dot: "bg-aqua" },
  forming: { wrap: "bg-teal/10 text-teal", dot: "bg-teal" },
  inactive: { wrap: "bg-white/10 text-cloud/60", dot: "bg-cloud/40" },
  draft: { wrap: "bg-yellow-500/20 text-yellow-300", dot: "bg-yellow-300" },
  revoked: { wrap: "bg-red/20 text-red-300", dot: "bg-red-300" },
  success: { wrap: "bg-teal/20 text-aqua", dot: "bg-aqua" },
};

export function StatusBadge({
  variant,
  withDot = false,
  children,
  className,
}: {
  variant: Variant;
  withDot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const s = styles[variant];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.wrap} ${className ?? ""}`}
    >
      {withDot && (
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} aria-hidden />
      )}
      {children}
    </span>
  );
}
