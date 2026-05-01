import * as React from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost" | "small";
type Size = "default" | "sm" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-md font-semibold tracking-tight " +
  "transition-all duration-150 ease-spring " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal " +
  "focus-visible:ring-offset-2 focus-visible:ring-offset-midnight " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "active:scale-[0.97]";

const variants: Record<Variant, string> = {
  primary: "bg-teal text-white hover:bg-teal/80",
  secondary:
    "ring-1 ring-whisper text-cloud/80 hover:bg-white/[0.04] hover:text-cloud hover:ring-white/[0.12]",
  destructive: "bg-red text-white hover:bg-crimson",
  ghost: "text-cloud/60 hover:bg-white/[0.04] hover:text-cloud",
  small:
    "rounded bg-teal/20 text-aqua hover:bg-teal/30 active:scale-[0.96]",
};

const sizes: Record<Size, string> = {
  default: "px-4 py-2 text-sm",
  sm: "px-3 py-1.5 text-xs",
  lg: "px-6 py-3 text-base active:scale-[0.985]",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", size = "default", className, ...rest }, ref) {
    const v = variant === "small" ? variants.small : variants[variant];
    const s = variant === "small" ? "px-3 py-1 text-xs" : sizes[size];
    return (
      <button
        ref={ref}
        className={`${base} ${v} ${s} ${className ?? ""}`}
        {...rest}
      />
    );
  },
);
