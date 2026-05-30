"use client";
import type { InputHTMLAttributes } from "react";
import { classNames } from "@/lib/utils";

type Props = InputHTMLAttributes<HTMLInputElement> & { label?: string; hint?: string; error?: string };

export function Input({ label, hint, error, className, id, ...rest }: Props) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink dark:text-white">
          {label}
        </label>
      )}
      <input
        id={inputId}
        {...rest}
        className={classNames(
          "h-11 w-full rounded-lg border bg-white px-4 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40",
          error ? "border-red-300" : "border-borderGrey dark:border-white/10",
          className
        )}
      />
      {error ? (
        <p className="mt-1 text-xs text-red-600">{error}</p>
      ) : hint ? (
        <p className="mt-1 text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}
