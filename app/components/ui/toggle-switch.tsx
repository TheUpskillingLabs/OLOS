"use client";

/* A single, bulletproof toggle switch. The knob's travel is driven by an
   inline transform (2px off → 22px on inside a 44×24 track) rather than an
   arbitrary Tailwind class, so it can never silently fail to compile — the
   bug that left the permission toggles stuck. Genuine circle knob (allowed
   under the one-radius rule; switches are circles, like avatars). */
export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  busy = false,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  busy?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled || busy}
      onClick={onChange}
      className={`relative inline-block h-6 w-11 flex-shrink-0 rounded-full transition-colors duration-150 ease-out disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal focus-visible:ring-offset-2 ${
        checked ? "bg-teal" : "bg-ink/20"
      }`}
    >
      <span
        aria-hidden="true"
        className="absolute top-0.5 left-0 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150 ease-spring"
        style={{ transform: `translateX(${checked ? 22 : 2}px)` }}
      />
    </button>
  );
}
