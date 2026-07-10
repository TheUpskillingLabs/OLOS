/**
 * Progress toward a pod/project reaching its minimum size to "form". Makes the
 * forming→active milestone — previously invisible to participants — legible: a
 * filling bar and "needs N more to form", flipping to a quiet "Formed ✓" once
 * the minimum is met. Presentational; pass the live member count and the min.
 */
export default function FormationMeter({
  count,
  min,
  className = "",
}: {
  count: number;
  min: number;
  className?: string;
}) {
  const formed = count >= min;
  const needed = Math.max(0, min - count);
  const pct = min > 0 ? Math.min(100, Math.round((count / min) * 100)) : 100;

  return (
    <div className={className}>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-ink/[0.06]"
        role="progressbar"
        aria-valuenow={count}
        aria-valuemin={0}
        aria-valuemax={min}
        aria-label={formed ? "Formed" : `${count} of ${min} members to form`}
      >
        <div
          className="h-full rounded-full bg-teal transition-[width] duration-500 ease-spring"
          style={{ width: `${formed ? 100 : pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs tabular-nums">
        {formed ? (
          <span className="font-semibold text-teal-deep">Formed&nbsp;✓</span>
        ) : (
          <span className="text-meta">
            {count} of {min} to form
            <span className="text-meta-soft"> · needs {needed} more</span>
          </span>
        )}
      </p>
    </div>
  );
}
