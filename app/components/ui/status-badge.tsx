import * as React from "react";

type Variant =
  | "active"
  | "forming"
  | "inactive"
  | "draft"
  | "revoked"
  | "success";

// The prototype's .status grammar: a colored dot + an uppercase label — never
// a pill (one-radius rule; genuine circles only). The dot is part of the
// grammar, so withDot is accepted for API compatibility but always on.
const variantClass: Record<Variant, string> = {
  active: "status active",
  success: "status active",
  forming: "status forming",
  inactive: "status",
  draft: "status soon",
  revoked: "status risk",
};

export function StatusBadge({
  variant,
  children,
  className,
}: {
  variant: Variant;
  withDot?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span className={`${variantClass[variant]} ${className ?? ""}`}>
      {children}
    </span>
  );
}
