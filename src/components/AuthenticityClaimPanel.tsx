"use client";

import { useEffect, useMemo, useState } from "react";
import { Badge } from "./Badge";
import { CopyButton } from "./CopyButton";
import { Button } from "./ui/Button";
import { Card } from "./ui/Card";
import { Input } from "./ui/Input";
import { Textarea } from "./ui/Textarea";
import {
  createAuthenticityClaim,
  getAuthenticityVerdict,
  getNamespaceAuthenticityClaim,
  getNamespaceVerification,
  isAuthenticityConfigured,
  refreshVerifiedAuthenticityClaim,
  serializeWalletBoundAttestation,
  verifyAuthenticityClaim,
} from "@/lib/gns/authenticity";
import type {
  AuthenticityClaim,
  AuthenticityClaimType,
  AuthenticityVerdict,
  NamespaceVerification,
} from "@/lib/gns/authenticity-types";
import type { GnsRecords } from "@/lib/types";

const CLAIM_TYPES: Array<{ value: AuthenticityClaimType; label: string }> = [
  { value: "project", label: "Project" },
  { value: "agent", label: "Agent" },
  { value: "organization", label: "Organization" },
  { value: "public_identity", label: "Public identity" },
];

function githubRawAttestationUrl(value: string): string {
  const clean = String(value || "").trim().replace(/\/$/, "");
  const prefix = "https://github.com/";
  if (!clean.startsWith(prefix)) return "";
  const parts = clean.slice(prefix.length).split("/").filter(Boolean);
  if (parts.length < 2) return "";
  const owner = parts[0];
  const repo = parts[1].replace(/\.git$/, "");
  return `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/gns-claim.json`;
}

function initialAttestationUrl(records: GnsRecords): string {
  const githubRaw = githubRawAttestationUrl(String(records.github || ""));
  if (githubRaw) return githubRaw;

  const website = String(records.website || "").trim().replace(/\/$/, "");
  const websiteGithubRaw = githubRawAttestationUrl(website);
  if (websiteGithubRaw) return websiteGithubRaw;
  if (website.startsWith("https://")) {
    return `${website}/.well-known/gns-claim.json`;
  }
  const agent = String(records.agent || "").trim().replace(/\/$/, "");
  if (agent.startsWith("https://")) {
    return `${agent}/gns-claim.json`;
  }
  return "";
}

function initialCorroboratingUrl(records: GnsRecords): string {
  return String(records.github || records.website || "").trim();
}

function statusTone(status?: string): "green" | "blue" | "amber" | "red" | "grey" {
  if (status === "VERIFIED") return "green";
  if (status === "PENDING_EVIDENCE" || status === "CHALLENGED") return "blue";
  if (status === "STALE" || status === "INCONCLUSIVE" || status === "INSUFFICIENT_EVIDENCE") return "amber";
  if (status === "REJECTED" || status === "REVOKED") return "red";
  return "grey";
}

export function AuthenticityClaimPanel({
  fullName,
  owner,
  records,
  isOwner,
}: {
  fullName: string;
  owner: string;
  records: GnsRecords;
  isOwner: boolean;
}) {
  const configured = isAuthenticityConfigured();
  const [claim, setClaim] = useState<AuthenticityClaim | null>(null);
  const [verification, setVerification] = useState<NamespaceVerification | null>(null);
  const [verdict, setVerdict] = useState<AuthenticityVerdict | null>(null);
  const [claimType, setClaimType] = useState<AuthenticityClaimType>("project");
  const [attestationUrl, setAttestationUrl] = useState(() => initialAttestationUrl(records));
  const [corroboratingUrl, setCorroboratingUrl] = useState(() => initialCorroboratingUrl(records));
  const [context, setContext] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attestationIssuedAt, setAttestationIssuedAt] = useState<number | undefined>(undefined);

  const load = async () => {
    if (!configured) return;
    const [nextClaim, nextVerification] = await Promise.all([
      getNamespaceAuthenticityClaim(fullName),
      getNamespaceVerification(fullName),
    ]);
    setClaim(nextClaim);
    setVerification(nextVerification);
    if (nextVerification?.verdict_id) {
      setVerdict(await getAuthenticityVerdict(nextVerification.verdict_id));
    } else {
      setVerdict(null);
    }
  };

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : String(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullName, configured]);

  const attestationJson = useMemo(
    () => (claim ? serializeWalletBoundAttestation(claim, { issuedAt: attestationIssuedAt }) : ""),
    [claim, attestationIssuedAt]
  );

  const createClaim = async () => {
    if (!attestationUrl.startsWith("https://")) {
      setError("Enter the HTTPS URL where you will publish the wallet-bound attestation.");
      return;
    }
    setBusy("create");
    setError(null);
    try {
      const evidence = [
        { type: "attestation" as const, url: attestationUrl.trim() },
        ...(corroboratingUrl.trim() && corroboratingUrl.trim() !== attestationUrl.trim()
          ? [{ type: "other" as const, url: corroboratingUrl.trim() }]
          : []),
      ];
      const next = await createAuthenticityClaim(fullName, claimType, evidence, context);
      setClaim(next);
      setVerification(await getNamespaceVerification(fullName));
      setVerdict(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create authenticity claim.");
    } finally {
      setBusy(null);
    }
  };

  const verify = async () => {
    if (!claim) return;
    setBusy("verify");
    setError(null);
    try {
      const result = await verifyAuthenticityClaim(claim.id);
      setClaim(result.claim);
      setVerdict(result.verdict);
      setVerification(await getNamespaceVerification(fullName));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed.");
    } finally {
      setBusy(null);
    }
  };

  const refreshVerified = async () => {
    if (!claim) return;
    setBusy("refresh");
    setError(null);
    try {
      setAttestationIssuedAt(Math.floor(Date.now() / 1000));
      const result = await refreshVerifiedAuthenticityClaim(claim.id);
      setClaim(result.claim);
      setVerdict(result.verdict);
      setVerification(await getNamespaceVerification(fullName));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Evidence refresh failed.");
    } finally {
      setBusy(null);
    }
  };

  if (!configured) {
    return (
      <Card padding="lg" className="space-y-2">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-ink">Authenticity</h3>
          <Badge tone="amber">v2 not deployed</Badge>
        </div>
        <p className="text-sm text-muted">
          Namespace registration remains available, but authoritative identity verification is disabled until the dedicated GNS authenticity contract is configured.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="lg" className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-ink">Authenticity claim</h3>
          <p className="mt-1 max-w-2xl text-sm text-muted">
            Verification is separate from name ownership. GenLayer validators fetch the cited evidence themselves and only a finalized verdict becomes authoritative.
          </p>
        </div>
        <Badge tone={statusTone(verification?.status)}>
          {verification?.status || "UNVERIFIED"}
        </Badge>
      </div>

      {!claim || claim.status === "SUPERSEDED" ? (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-ink">Claim type</label>
              <select
                value={claimType}
                onChange={(e) => setClaimType(e.target.value as AuthenticityClaimType)}
                className="h-11 w-full rounded-lg border border-borderGrey bg-white px-3 text-sm"
              >
                {CLAIM_TYPES.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>
            <Input
              label="Attestation URL"
              value={attestationUrl}
              onChange={(e) => setAttestationUrl(e.target.value)}
              placeholder="https://project.example/.well-known/gns-claim.json"
            />
          </div>
          <Input
            label="Corroborating evidence URL"
            value={corroboratingUrl}
            onChange={(e) => setCorroboratingUrl(e.target.value)}
            placeholder="https://github.com/org/project"
          />
          <Textarea
            label="Claim context"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            placeholder="Describe the relationship this namespace claims. Context is treated as untrusted evidence, not proof."
          />
          <p className="text-xs text-muted">
            The attestation URL must be under this namespace&apos;s registered website/agent endpoint or registered GitHub repository and must be publicly retrievable by validators. GitHub repo records default to a raw `HEAD/gns-claim.json` URL; private repositories cannot serve as public validator evidence.
          </p>
          <Button onClick={createClaim} loading={busy === "create"} disabled={!isOwner}>
            Create claim
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><p className="text-muted">Claim</p><p className="font-medium text-ink">#{claim.id}</p></div>
            <div><p className="text-muted">Type</p><p className="font-medium text-ink">{claim.claim_type}</p></div>
            <div><p className="text-muted">Owner</p><p className="truncate font-mono text-xs text-ink" title={owner}>{owner}</p></div>
            <div><p className="text-muted">Policy</p><p className="font-medium text-ink">{claim.policy_version}</p></div>
          </div>

          {claim.status === "PENDING_EVIDENCE" || claim.status === "REJECTED" || claim.status === "INSUFFICIENT_EVIDENCE" ? (
            <div className="rounded-lg border border-borderGrey bg-softblue/30 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-ink">Publish this exact attestation</p>
                  <p className="mt-1 text-xs text-muted">
                    Put this JSON at the attestation URL stored in claim #{claim.id}. The proof expires and can be regenerated before verification.
                  </p>
                </div>
                <CopyButton value={attestationJson} label="Copy JSON" />
              </div>
              <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap break-all rounded-md border border-borderGrey bg-white p-3 text-xs text-ink">
                {attestationJson}
              </pre>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <Button onClick={verify} loading={busy === "verify"} disabled={!isOwner}>
                  Verify published evidence
                </Button>
                <span className="text-xs text-muted">This waits for FINALIZED consensus.</span>
              </div>
            </div>
          ) : null}

          {claim.status === "VERIFIED" && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
              <p className="font-medium text-ink">Refresh verified evidence</p>
              <p className="mt-1 text-xs text-muted">
                Generate this fresh six-day attestation, publish it at the claim&apos;s existing source URL, then run the validator-backed refresh. This is separate from recomputing namespace status.
              </p>
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap break-all rounded-md border border-borderGrey bg-white p-3 text-xs text-ink">
                {attestationJson}
              </pre>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <CopyButton value={attestationJson} label="Copy fresh JSON" />
                <Button onClick={refreshVerified} loading={busy === "refresh"} disabled={!isOwner}>
                  Refresh with published evidence
                </Button>
              </div>
              {verification?.evidence_expires_at && (
                <p className="mt-2 text-xs text-muted">
                  Current evidence expires {new Date(verification.evidence_expires_at * 1000).toLocaleString()}.
                </p>
              )}
            </div>
          )}

          {verdict && (
            <div className="rounded-lg border border-borderGrey p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-semibold text-ink">Finalized consensus decision #{verdict.id}</p>
                <Badge tone={statusTone(verdict.decision)}>{verdict.decision}</Badge>
              </div>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wide text-muted">Leader rationale · informational</p>
              <p className="mt-1 text-ink">{verdict.reason_code}</p>
              {verdict.summary && <p className="mt-1 text-muted">{verdict.summary}</p>}
              <p className="mt-3 break-all font-mono text-[11px] text-muted">
                Leader evidence digest · provenance metadata: {verdict.evidence_digest}
              </p>
              <p className="mt-2 text-[11px] text-muted">
                Validators independently compare the consensus decision and evidence expiry; free-form rationale and raw-byte digest are retained as provenance metadata.
              </p>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setClaim(null);
                setVerification(null);
                setVerdict(null);
              }}
              disabled={!isOwner}
            >
              Start replacement claim
            </Button>
            <Button variant="ghost" size="sm" onClick={() => load()} disabled={busy !== null}>
              Refresh finalized state
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
    </Card>
  );
}
