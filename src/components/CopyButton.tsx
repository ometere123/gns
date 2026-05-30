"use client";
import { useState } from "react";

export function CopyButton({ value, label = "Copy" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* noop */
    }
  };
  return (
    <button
      type="button"
      onClick={onCopy}
      className="inline-flex items-center rounded-md border border-borderGrey bg-white px-2 py-1 text-xs font-medium text-primary hover:bg-softblue"
    >
      {copied ? "Copied" : label}
    </button>
  );
}
