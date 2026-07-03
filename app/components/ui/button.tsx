import * as React from "react";

type Variant = "primary" | "secondary" | "destructive" | "ghost" | "small";
type Size = "default" | "sm" | "lg";

// The prototype's .btn grammar (one 14px radius, AA teal-deep fill, 34%
// disabled opacity) expressed through the shared component classes; size
// utilities override the .btn padding where the app needs denser buttons.
const base = "btn";

const variants: Record<Variant, string> = {
  primary: "btn-teal",
  secondary: "btn-ghost",
  destructive: "btn-red",
  ghost: "bg-transparent text-teal-deep hover:bg-teal/[0.08]",
  small: "bg-teal/10 text-teal-deep hover:bg-teal/20",
};

const sizes: Record<Size, string> = {
  default: "px-4 py-2.5 text-sm",
  sm: "px-3 py-1.5 text-xs",
  lg: "px-6 py-[15px] text-[15px]",
};

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button({ variant = "primary", size = "default", className, ...rest }, ref) {
    const s = variant === "small" ? "px-3 py-1 text-xs" : sizes[size];
    return (
      <button
        ref={ref}
        className={`${base} ${variants[variant]} ${s} ${className ?? ""}`}
        {...rest}
      />
    );
  },
);
