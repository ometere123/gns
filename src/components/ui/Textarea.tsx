"use client";
import type { TextareaHTMLAttributes } from "react";
import { classNames } from "@/lib/utils";

type Props = TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; hint?: string };

export function Textarea({ label, hint, className, id, ...rest }: Props) {
  const inputId = id || rest.name;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={inputId} className="mb-1.5 block text-sm font-medium text-ink dark:text-white">
          {label}
        </label>
      )}
      <textarea
        id={inputId}
        {...rest}
        className={classNames(
          "min-h-[100px] w-full rounded-lg border border-borderGrey bg-white px-4 py-3 text-sm text-ink placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary/40 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder:text-white/40",
          className
        )}
      />
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
