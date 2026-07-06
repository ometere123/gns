"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/Badge";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import {
  SOULSTAMP_APP_URL,
  buildSoulStampMatches,
  getSoulStampIdentity,
  isSoulStampConfigured,
} from "@/lib/soulstamp/client";
import type { GnsRecords, SoulStampIdentity, SoulStampMatch } from "@/lib/types";

const toneByStatus: Record<SoulStampMatch["status"], "blue" | "grey" | "amber" | "red" | "green"> = {
  verified: "green",
  missing: "grey",
  inactive: "amber",
  flagged: "red",
  unconfigured: "amber",
  error: "red",
};

export function SoulStampVerification({
  owner,
  records,
}: {
  owner: string;
  records: GnsRecords;
}) {
  const [identity, setIdentity] = useState<SoulStampIdentity | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const configured = isSoulStampConfigured();

  useEffect(() => {
    let cancelled = false;
    if (!owner || !configured) {
      setIdentity(null);
      return;
    }
    setLoading(true);
    setError(null);
    getSoulStampIdentity(owner)
      .then((value) => {
        if (!cancelled) setIdentity(value);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "SoulStamp lookup failed.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [owner, configured]);

  const matches = useMemo(
    () => buildSoulStampMatches(identity, records, configured),
    [identity, records, configured]
  );
  const verifiedCount = matches.filter((m) => m.matched).length;
  const hasSocialRecords = matches.length > 0;
  const appUrl = owner ? `${SOULSTAMP_APP_URL}?wallet=${encodeURIComponent(owner)}` : SOULSTAMP_APP_URL;

  if (!hasSocialRecords && configured && !identity?.found) return null;

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-ink">SoulStamp profile verification</h2>
          <p className="mt-1 text-sm text-muted">
            Checks this name owner against active SoulStamp links for X, GitHub, and Discord.
          </p>
        </div>
        <Badge tone={verifiedCount > 0 ? "green" : configured ? "grey" : "amber"}>
          {configured ? `${verifiedCount}/${matches.length || 0} matched` : "Not configured"}
        </Badge>
      </div>

      {loading && <p className="text-sm text-muted">Checking SoulStamp...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && hasSocialRecords && (
        <div className="divide-y divide-borderGrey rounded-md border border-borderGrey">
          {matches.map((match) => (
            <div key={`${match.platform}:${match.expected}`} className="flex flex-wrap items-center justify-between gap-3 p-3">
              <div>
                <p className="text-sm font-medium text-ink">
                  {match.label}: <span className="font-mono">@{match.expected}</span>
                </p>
                <p className="mt-1 text-xs text-muted">{match.message}</p>
              </div>
              <Badge tone={toneByStatus[match.status]}>
                {match.status === "verified" ? "Verified" : match.status}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {!hasSocialRecords && (
        <p className="text-sm text-muted">
          Add an X, GitHub, or Discord record to this GNS name, then link that account to the owner wallet on SoulStamp.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link href={appUrl} target="_blank" rel="noreferrer">
          <Button size="sm" variant="secondary">Verify with SoulStamp</Button>
        </Link>
      </div>
    </Card>
  );
}
