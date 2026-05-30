"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "./ui/Button";
import { isValidLabel, stripGenSuffix } from "@/lib/utils";

export function NameSearchBar({
  defaultValue = "",
  size = "lg",
}: {
  defaultValue?: string;
  size?: "md" | "lg";
}) {
  const router = useRouter();
  const [value, setValue] = useState(defaultValue);
  const [error, setError] = useState<string | null>(null);

  const submit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const label = stripGenSuffix(value);
    if (!label) {
      setError("Enter a name to search.");
      return;
    }
    if (!isValidLabel(label)) {
      setError("Use 3–32 lowercase letters, numbers, or hyphens (not at the edges).");
      return;
    }
    setError(null);
    router.push(`/search?name=${encodeURIComponent(label)}`);
  };

  return (
    <form onSubmit={submit} className="w-full">
      <div className="flex w-full overflow-hidden rounded-2xl border border-borderGrey bg-white shadow-sm focus-within:ring-2 focus-within:ring-primary/30 dark:border-white/10 dark:bg-white/[0.03]">
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value.toLowerCase())}
          placeholder="Search for a name"
          className={`flex-1 bg-transparent px-5 text-ink placeholder:text-muted focus:outline-none dark:text-white dark:placeholder:text-white/40 ${
            size === "lg" ? "h-14 text-lg" : "h-11 text-sm"
          }`}
        />
        <div className="flex items-center pr-2">
          <span className="mr-2 hidden text-sm text-muted sm:inline">.gen</span>
          <Button type="submit" size={size === "lg" ? "lg" : "md"}>
            Search Name
          </Button>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </form>
  );
}
