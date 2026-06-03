import { truncateAddress } from "@/lib/utils";
import { CopyButton } from "./CopyButton";

export function AddressText({
  value,
  showCopy = true,
  className,
}: {
  value: string;
  showCopy?: boolean;
  className?: string;
}) {
  if (!value) return <span className="text-muted">-</span>;
  return (
    <span className={`inline-flex items-center gap-2 ${className || ""}`}>
      <span className="font-mono text-sm text-ink">{truncateAddress(value)}</span>
      {showCopy && <CopyButton value={value} />}
    </span>
  );
}
