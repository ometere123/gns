import type { ReactNode } from "react";
import { classNames } from "@/lib/utils";

export function Card({
  children,
  className,
  padding = "md",
}: {
  children: ReactNode;
  className?: string;
  padding?: "sm" | "md" | "lg" | "none";
}) {
  const pads: Record<string, string> = {
    none: "",
    sm: "p-4",
    md: "p-6",
    lg: "p-8",
  };
  return (
    <div
      className={classNames(
        "rounded-2xl border border-borderGrey bg-white",
        pads[padding],
        className
      )}
    >
      {children}
    </div>
  );
}
