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
      className={`rounded-card border border-ink/10 bg-white p-6 shadow-card ${className ?? ""}`}
    >
      <div className="stat-lbl mb-2">{label}</div>
      <div className="stat-num">{value}</div>
      {sublabel && <div className="t-small mt-2">{sublabel}</div>}
    </div>
  );
}
