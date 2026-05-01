import * as React from "react";

export function StatCard({
  label,
  value,
  sublabel,
  className,
}: {
  label: string;
  value: React.ReactNode;
  sublabel?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-md border border-whisper bg-white/[0.02] p-6 ${className ?? ""}`}
    >
      <div className="mb-2 text-xs font-medium uppercase tracking-widest text-cloud/40">
        {label}
      </div>
      <div className="text-3xl font-bold tabular-nums tracking-tight text-white">
        {value}
      </div>
      {sublabel && (
        <div className="mt-2 text-xs text-cloud/60">{sublabel}</div>
      )}
    </div>
  );
}
