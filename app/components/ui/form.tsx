"use client";

import * as React from "react";
import { useFormContext, get } from "react-hook-form";

const inputBase =
  "block w-full rounded-md border border-white/[0.10] bg-white/[0.04] " +
  "px-3 py-2 text-sm text-white placeholder:text-cloud/40 " +
  "focus:border-teal focus:outline-none focus:ring-1 focus:ring-teal " +
  "disabled:cursor-not-allowed disabled:opacity-50 " +
  "transition-colors duration-150";

const errorRing =
  "border-red/50 focus:border-red focus:ring-red";

export type FieldProps = {
  label: React.ReactNode;
  required?: boolean;
  helper?: React.ReactNode;
  error?: React.ReactNode;
  charCount?: React.ReactNode;
  htmlFor?: string;
  children: React.ReactNode;
  className?: string;
};

export function Field({
  label,
  required,
  helper,
  error,
  charCount,
  htmlFor,
  children,
  className,
}: FieldProps) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <label
        htmlFor={htmlFor}
        className="block text-sm font-medium text-cloud"
      >
        {label}
        {required && (
          <span className="ml-0.5 text-red" aria-hidden>
            *
          </span>
        )}
      </label>
      {helper && <p className="text-xs text-cloud/60">{helper}</p>}
      {children}
      {(error || charCount) && (
        <div className="flex items-center justify-between gap-2">
          {error ? <p className="text-xs text-red-300">{error}</p> : <span />}
          {charCount && <p className="text-xs text-cloud/50 tabular-nums">{charCount}</p>}
        </div>
      )}
    </div>
  );
}

export type InputProps = React.InputHTMLAttributes<HTMLInputElement> & {
  invalid?: boolean;
};

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input({ className, invalid, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={`${inputBase} ${invalid ? errorRing : ""} ${className ?? ""}`}
        {...rest}
      />
    );
  },
);

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement> & {
  invalid?: boolean;
};

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  function Textarea({ className, invalid, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={`${inputBase} resize-none ${invalid ? errorRing : ""} ${className ?? ""}`}
        {...rest}
      />
    );
  },
);

export function FormField({
  name,
  ...fieldProps
}: { name: string } & FieldProps) {
  const { formState: { errors } } = useFormContext();
  const error = get(errors, name)?.message as string | undefined;
  return <Field error={error} {...fieldProps} />;
}

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement> & {
  invalid?: boolean;
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  function Select({ className, invalid, children, ...rest }, ref) {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={`${inputBase} appearance-none pr-9 ${invalid ? errorRing : ""} ${className ?? ""}`}
          {...rest}
        >
          {children}
        </select>
        <svg
          className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-cloud/60"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden
        >
          <path
            d="M6 8l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    );
  },
);
