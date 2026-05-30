import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";

type Tone = "blue" | "grey" | "amber" | "red" | "green";

const tones: Record<Tone, string> = {
  blue: "bg-softblue text-primary border-primary/20",
  grey: "bg-section text-muted border-borderGrey",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  red: "bg-red-50 text-red-700 border-red-200",
  green: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export function Badge({
  children,
  tone = "blue",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={classNames(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
    >
      {children}
    </span>
  );
}
