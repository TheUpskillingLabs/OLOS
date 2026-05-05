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
      className={`flex flex-col items-center justify-center rounded-md border border-dashed border-whisper bg-white/[0.01] p-12 text-center ${className ?? ""}`}
    >
      {Icon && (
        <Icon className="mb-4 h-12 w-12 text-cloud/30" aria-hidden />
      )}
      <h3 className="mb-2 text-lg font-semibold tracking-tight text-cloud">
        {title}
      </h3>
      {description && (
        <p className="mb-6 max-w-md text-sm text-cloud/60">{description}</p>
      )}
      {action}
    </div>
  );
}
