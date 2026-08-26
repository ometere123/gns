"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LoadingState } from "@/components/States";
import { AddressText } from "@/components/AddressText";
import {
  challengeAuthenticityClaim,
  getAuthenticityChallenge,
  getAuthenticityClaim,
  getAuthenticityVerdict,
  getNamespaceAuthenticityClaim,
  isAuthenticityConfigured,
  resolveAuthenticityChallenge,
} from "@/lib/gns/authenticity";
import { useWallet } from "@/lib/wallet/WalletProvider";
import type {
  AuthenticityChallenge,
  AuthenticityClaim,
  AuthenticityVerdict,
} from "@/lib/gns/authenticity-types";

const REASONS = [
  "IMPERSONATION",
  "OWNERSHIP_CHANGED",
  "MISREPRESENTATION",
  "PHISHING",
  "STALE_EVIDENCE",
  "CONTRADICTORY_EVIDENCE",
];

function tone(status?: string): "green" | "blue" | "amber" | "red" | "grey" {
  if (status === "VERIFIED" || status === "UPHOLD") return "green";
  if (status === "OPEN" || status === "CHALLENGED") return "blue";
  if (status === "REVOKE" || status === "REVOKED" || status === "REJECTED") return "red";
  if (status === "INSUFFICIENT_EVIDENCE" || status === "INCONCLUSIVE" || status === "STALE") return "amber";
  return "grey";
}

function DisputesInner() {
  const params = useSearchParams();
  const configured = isAuthenticityConfigured();
  const { address, connect } = useWallet();
  const [name, setName] = useState(params.get("name") || "");
  const [claim, setClaim] = useState<AuthenticityClaim | null>(null);
  const [challenge, setChallenge] = useState<AuthenticityChallenge | null>(null);
  const [verdict, setVerdict] = useState<AuthenticityVerdict | null>(null);
  const [reason, setReason] = useState(REASONS[0]);
  const [evidenceUrl, setEvidenceUrl] = useState("");
  const [secondEvidenceUrl, setSecondEvidenceUrl] = useState("");
  const [context, setContext] = useState("");
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadChallenge = async (nextClaim: AuthenticityClaim | null) => {
    if (!nextClaim?.active_challenge_id) {
      setChallenge(null);
      return;
    }
    const nextChallenge = await getAuthenticityChallenge(nextClaim.active_challenge_id);
    setChallenge(nextChallenge);
    if (nextChallenge?.verdict_id) {
      setVerdict(await getAuthenticityVerdict(nextChallenge.verdict_id));
    }
  };

  const load = async () => {
    if (!configured) return;
    setLoading(true);
    setError(null);
    try {
      const queryClaim = params.get("claim");
      const nextClaim = queryClaim
        ? await getAuthenticityClaim(queryClaim)
        : name.trim()
        ? await getNamespaceAuthenticityClaim(name.trim())
        : null;
      setClaim(nextClaim);
      setVerdict(null);
      await loadChallenge(nextClaim);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load authenticity claim.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (configured && (params.get("claim") || params.get("name"))) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configured]);

  const submitChallenge = async () => {
    if (!claim) return;
    if (!address) {
      await connect();
      return;
    }
    if (!evidenceUrl.startsWith("https://")) {
      setError("A challenge needs at least one retrievable HTTPS evidence URL.");
      return;
    }
    setBusy("challenge");
    setError(null);
    try {
      const evidence = [
        { type: "other" as const, url: evidenceUrl.trim() },
        ...(secondEvidenceUrl.trim() && secondEvidenceUrl.trim() !== evidenceUrl.trim()
          ? [{ type: "other" as const, url: secondEvidenceUrl.trim() }]
          : []),
      ];
      const nextChallenge = await challengeAuthenticityClaim(
        claim.id,
        reason,
        evidence,
        context
      );
      setChallenge(nextChallenge);
      setClaim(await getAuthenticityClaim(claim.id));
      setVerdict(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge submission failed.");
    } finally {
      setBusy(null);
    }
  };

  const resolveChallenge = async () => {
    if (!challenge) return;
    if (!address) {
      await connect();
      return;
    }
    setBusy("resolve");
    setError(null);
    try {
      const result = await resolveAuthenticityChallenge(challenge.id);
      setChallenge(result.challenge);
      setVerdict(result.verdict);
      if (claim) setClaim(await getAuthenticityClaim(claim.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Challenge resolution failed.");
    } finally {
      setBusy(null);
    }
  };

  if (!configured) {
    return (
      <Card padding="lg" className="space-y-2">
        <h1 className="text-2xl font-semibold text-ink">Authenticity challenges</h1>
        <p className="text-sm text-muted">
          The dedicated GNS authenticity contract is not configured. Legacy name reports are not treated as authoritative authenticity verdicts.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Challenge an authenticity claim</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted">
          Challenges are evidence-based. The resolution transaction re-fetches both the claimant&apos;s original sources and the challenger&apos;s sources before GenLayer validators decide whether to uphold, revoke, or return insufficient evidence.
        </p>
      </div>

      <Card padding="lg" className="space-y-3">
        <Input
          label="Namespace"
          value={name}
          onChange={(e) => setName(e.target.value.toLowerCase())}
          placeholder="project.gen"
        />
        <Button size="sm" variant="secondary" onClick={load} loading={loading}>
          Load latest finalized claim
        </Button>
      </Card>

      {claim && (
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Claim #{claim.id}</p>
              <h2 className="mt-1 text-xl font-semibold text-ink">{claim.namespace}</h2>
            </div>
            <Badge tone={tone(claim.status)}>{claim.status}</Badge>
          </div>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div><dt className="text-muted">Claim type</dt><dd className="text-ink">{claim.claim_type}</dd></div>
            <div><dt className="text-muted">Policy</dt><dd className="text-ink">{claim.policy_version}</dd></div>
            <div><dt className="text-muted">Claim wallet</dt><dd><AddressText value={claim.owner} /></dd></div>
          </dl>
        </Card>
      )}

      {claim?.status === "VERIFIED" && !challenge && (
        <Card padding="lg" className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-ink">Open challenge</h2>
            <p className="mt-1 text-sm text-muted">
              Your text is context only. The verdict is based on evidence validators can retrieve themselves.
            </p>
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-ink">Reason</label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="h-11 w-full rounded-lg border border-borderGrey bg-white px-3 text-sm"
            >
              {REASONS.map((item) => <option key={item}>{item}</option>)}
            </select>
          </div>
          <Input
            label="Evidence URL"
            value={evidenceUrl}
            onChange={(e) => setEvidenceUrl(e.target.value)}
            placeholder="https://..."
          />
          <Input
            label="Second evidence URL (optional)"
            value={secondEvidenceUrl}
            onChange={(e) => setSecondEvidenceUrl(e.target.value)}
            placeholder="https://..."
          />
          <Textarea
            label="Challenge context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Explain what the evidence is intended to show."
          />
          <Button onClick={submitChallenge} loading={busy === "challenge"}>
            Submit finalized challenge
          </Button>
        </Card>
      )}

      {challenge && (
        <Card padding="lg" className="space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Challenge #{challenge.id}</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{challenge.reason_code}</h2>
            </div>
            <Badge tone={tone(challenge.status)}>{challenge.status}</Badge>
          </div>
          <p className="text-sm text-muted">
            Challenger: <AddressText value={challenge.challenger} />
          </p>
          {challenge.status === "OPEN" && (
            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={resolveChallenge} loading={busy === "resolve"}>
                Resolve with GenLayer
              </Button>
              <span className="text-xs text-muted">Resolution waits for FINALIZED consensus.</span>
            </div>
          )}
        </Card>
      )}

      {verdict && (
        <Card padding="lg" className="space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted">Finalized verdict #{verdict.id}</p>
              <h2 className="mt-1 text-lg font-semibold text-ink">{verdict.reason_code}</h2>
            </div>
            <Badge tone={tone(verdict.decision)}>{verdict.decision}</Badge>
          </div>
          {verdict.summary && <p className="text-sm text-muted">{verdict.summary}</p>}
          <p className="break-all font-mono text-[11px] text-muted">
            Evidence digest: {verdict.evidence_digest}
          </p>
        </Card>
      )}

      {!loading && !claim && (
        <Card className="text-sm text-muted">
          No authenticity claim loaded. Enter a namespace above or open this page from a public profile.
        </Card>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

export default function DisputesPage() {
  return (
    <Suspense fallback={<LoadingState />}>
      <DisputesInner />
    </Suspense>
  );
}
