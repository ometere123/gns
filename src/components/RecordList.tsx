import type { GnsRecords } from "@/lib/types";
import { Card } from "./ui/Card";
import { CopyButton } from "./CopyButton";

const LABELS: Record<keyof GnsRecords, string> = {
  avatar: "Avatar",
  website: "Website",
  x: "X",
  github: "GitHub",
  discord: "Discord",
  email: "Email",
  contract: "Contract",
  agent: "Agent Endpoint",
  description: "Description",
};

const URL_KEYS: Array<keyof GnsRecords> = ["website", "github", "agent", "avatar"];

export function RecordList({ records }: { records: GnsRecords }) {
  const entries = (Object.keys(LABELS) as Array<keyof GnsRecords>).filter(
    (k) => records?.[k]
  );
  if (entries.length === 0) {
    return (
      <Card className="text-sm text-muted">No records set.</Card>
    );
  }
  return (
    <Card padding="none">
      <ul className="divide-y divide-borderGrey">
        {entries.map((k) => {
          const value = String(records[k]);
          const isUrl = URL_KEYS.includes(k);
          return (
            <li key={k} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-muted">{LABELS[k]}</p>
                {isUrl && /^https?:\/\//i.test(value) ? (
                  <a
                    href={value}
                    target="_blank"
                    rel="noreferrer"
                    className="block truncate text-sm text-primary hover:underline"
                  >
                    {value}
                  </a>
                ) : (
                  <p className="truncate text-sm text-ink">{value}</p>
                )}
              </div>
              <CopyButton value={value} />
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
