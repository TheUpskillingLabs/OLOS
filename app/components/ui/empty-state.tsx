import * as React from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: LucideIcon;
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col justify-center rounded-card border border-dashed border-meta-soft p-12 ${className ?? ""}`}
    >
      {Icon && <Icon className="mb-4 h-12 w-12 text-meta-soft" aria-hidden />}
      <h3 className="t-h4 mb-2">{title}</h3>
      {description && (
        <p className="t-small mb-6 max-w-md">{description}</p>
      )}
      {action}
    </div>
  );
}
