"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "./Badge";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import {
  getAuthenticityVerdict,
  getNamespaceAuthenticityClaim,
  getNamespaceVerification,
  isAuthenticityConfigured,
} from "@/lib/gns/authenticity";
import type {
  AuthenticityClaim,
  AuthenticityVerdict,
  NamespaceVerification,
} from "@/lib/gns/authenticity-types";

function tone(status?: string): "green" | "blue" | "amber" | "red" | "grey" {
  if (status === "VERIFIED") return "green";
  if (status === "PENDING_EVIDENCE" || status === "CHALLENGED") return "blue";
  if (status === "REJECTED" || status === "REVOKED") return "red";
  if (status === "STALE" || status === "INCONCLUSIVE" || status === "INSUFFICIENT_EVIDENCE") return "amber";
  return "grey";
}

function formatUnix(value?: number): string {
  if (!value) return "—";
  try {
    return new Date(value * 1000).toLocaleString();
  } catch {
    return "—";
  }
}

export function AuthenticityStatusCard({ fullName }: { fullName: string }) {
  const configured = isAuthenticityConfigured();
  const [verification, setVerification] = useState<NamespaceVerification | null>(null);
  const [claim, setClaim] = useState<AuthenticityClaim | null>(null);
  const [verdict, setVerdict] = useState<AuthenticityVerdict | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const [nextVerification, nextClaim] = await Promise.all([
        getNamespaceVerification(fullName),
        getNamespaceAuthenticityClaim(fullName),
      ]);
      setVerification(nextVerification);
      setClaim(nextClaim);
      if (nextVerification.verdict_id) {
        setVerdict(await getAuthenticityVerdict(nextVerification.verdict_id));
      } else {
        setVerdict(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Authenticity lookup failed.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, configured]);

  if (!configured) {
    return (
      <Card padding="lg" className="space-y-2">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-ink">Authenticity</h2>
          <Badge tone="grey">Not available</Badge>
        </div>
        <p className="text-sm text-muted">
          This registry entry has no authoritative GNS authenticity verdict. Registry ownership alone is not identity verification.
        </p>
      </Card>
    );
  }

  const status = verification?.status || "UNVERIFIED";

  return (
    <Card padding="lg" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Authenticity</h2>
          <p className="mt-1 text-sm text-muted">
            Evidence-grounded status from the dedicated GNS authenticity contract. Registry ownership by itself does not create this status.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone(status)}>{status}</Badge>
          {verification?.challenge_status === "OPEN" && (
            <Badge tone="blue">Challenge pending</Badge>
          )}
        </div>
      </div>

      {claim && (
        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <div><dt className="text-muted">Claim</dt><dd className="font-medium text-ink">#{claim.id}</dd></div>
          <div><dt className="text-muted">Type</dt><dd className="font-medium text-ink">{claim.claim_type}</dd></div>
          <div><dt className="text-muted">Policy</dt><dd className="font-medium text-ink">{claim.policy_version}</dd></div>
          <div><dt className="text-muted">Evidence valid until</dt><dd className="font-medium text-ink">{formatUnix(verification?.evidence_expires_at)}</dd></div>
        </dl>
      )}

      {verdict && (
        <div className="rounded-lg border border-borderGrey p-4 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-semibold text-ink">Finalized verdict #{verdict.id}</p>
            <Badge tone={tone(verdict.decision)}>{verdict.decision}</Badge>
          </div>
          <p className="mt-2 font-medium text-ink">{verdict.reason_code}</p>
          {verdict.summary && <p className="mt-1 text-muted">{verdict.summary}</p>}
          <p className="mt-3 break-all font-mono text-[11px] text-muted">
            Evidence digest: {verdict.evidence_digest}
          </p>
        </div>
      )}

      {verification?.challenge_status === "OPEN" && status === "VERIFIED" && (
        <p className="text-sm text-muted">
          A challenge is open, but the prior finalized verification remains authoritative unless a finalized resolution revokes it.
        </p>
      )}

      {verification?.invalidation_reason && status === "STALE" && (
        <p className="text-sm text-amber-700">
          Verification is stale: {verification.invalidation_reason}. A fresh owner claim is required.
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" onClick={load} loading={loading}>
          Refresh finalized status
        </Button>
        {claim?.status === "VERIFIED" && (
          <Link href={`/disputes?name=${encodeURIComponent(fullName)}&claim=${encodeURIComponent(claim.id)}`}>
            <Button size="sm" variant="ghost">Challenge claim</Button>
          </Link>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}
