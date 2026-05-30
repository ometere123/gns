"use client";
import Link from "next/link";
import { Card } from "./ui/Card";
import { Badge } from "./Badge";
import { Button } from "./ui/Button";
import type { GnsName } from "@/lib/types";
import { daysUntil, formatExpiry } from "@/lib/utils";

export function DashboardNameCard({ name }: { name: GnsName }) {
  const days = daysUntil(name.expires_at);
  const recordCount = Object.values(name.records || {}).filter(Boolean).length;
  return (
    <Card>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href={`/name/${encodeURIComponent(name.full_name)}`}>
            <h3 className="text-lg font-semibold text-ink hover:text-primary">{name.full_name}</h3>
          </Link>
          <div className="mt-1 flex items-center gap-2">
            <Badge tone={name.is_subname ? "grey" : "blue"}>
              {name.is_subname ? "Subname" : "Root"}
            </Badge>
            <Badge tone={name.status === "flagged" ? "red" : "green"}>{name.status}</Badge>
          </div>
        </div>
        <div className="text-right text-sm">
          <p className="text-muted">Expires in</p>
          <p className="text-ink font-medium">{days} days</p>
          <p className="text-xs text-muted">{formatExpiry(name.expires_at)}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">Records: {recordCount}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={`/manage/${encodeURIComponent(name.full_name)}`}>
          <Button size="sm">Manage</Button>
        </Link>
        <Link href={`/subnames/${encodeURIComponent(name.full_name)}`}>
          <Button size="sm" variant="secondary">Subnames</Button>
        </Link>
        <Link href={`/name/${encodeURIComponent(name.full_name)}`}>
          <Button size="sm" variant="ghost">Profile</Button>
        </Link>
      </div>
    </Card>
  );
}
