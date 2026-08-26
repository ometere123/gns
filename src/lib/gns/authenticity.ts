"use client";

import {
  GNS_AUTHENTICITY_CONTRACT_ADDRESS,
  GNS_CONTRACT_ADDRESS,
  isAuthenticityConfigured,
  readViewAt,
  writeMethodAt,
} from "@/lib/genlayer/client";
import { normaliseName } from "@/lib/utils";
import type {
  AuthenticityChallenge,
  AuthenticityClaim,
  AuthenticityClaimType,
  AuthenticityVerdict,
  EvidenceSource,
  NamespaceVerification,
  WalletBoundAttestation,
} from "./authenticity-types";

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw as T;
  if (typeof raw === "string") {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function requireAuthenticity(): string {
  if (!isAuthenticityConfigured()) {
    throw new Error(
      "GNS authenticity is not configured. Set NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS."
    );
  }
  return GNS_AUTHENTICITY_CONTRACT_ADDRESS;
}

async function readFinalized<T>(
  functionName: string,
  args: unknown[] = []
): Promise<T> {
  return readViewAt<T>(requireAuthenticity(), functionName, args, "finalized");
}

async function writeFinalized(
  functionName: string,
  args: unknown[] = []
): Promise<unknown> {
  return writeMethodAt(requireAuthenticity(), functionName, args, undefined, {
    waitStatus: "FINALIZED",
    strictWait: true,
    retries: 120,
    interval: 3000,
  });
}

export { isAuthenticityConfigured };

export async function getAuthenticityPolicyVersion(): Promise<string> {
  return String(await readFinalized<string>("get_policy_version"));
}

export async function getAuthenticityRegistryAddress(): Promise<string> {
  return String(await readFinalized<string>("get_registry_address"));
}

export async function getNamespaceAuthenticityClaim(
  name: string
): Promise<AuthenticityClaim | null> {
  const raw = await readFinalized<string>("get_namespace_claim", [
    normaliseName(name),
  ]);
  const parsed = parseJson<AuthenticityClaim | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as AuthenticityClaim).id) return null;
  return parsed as AuthenticityClaim;
}

export async function getAuthenticityClaim(
  claimId: string
): Promise<AuthenticityClaim | null> {
  const raw = await readFinalized<string>("get_claim", [claimId]);
  const parsed = parseJson<AuthenticityClaim | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as AuthenticityClaim).id) return null;
  return parsed as AuthenticityClaim;
}

export async function getNamespaceVerification(
  name: string
): Promise<NamespaceVerification> {
  const raw = await readFinalized<string>("get_namespace_verification", [
    normaliseName(name),
  ]);
  return parseJson<NamespaceVerification>(raw, {
    status: "UNVERIFIED",
    claim_id: "",
    verdict_id: "",
    subject_hash: "",
    policy_version: "",
  });
}

export async function getAuthenticityChallenge(
  challengeId: string
): Promise<AuthenticityChallenge | null> {
  const raw = await readFinalized<string>("get_challenge", [challengeId]);
  const parsed = parseJson<AuthenticityChallenge | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as AuthenticityChallenge).id) return null;
  return parsed as AuthenticityChallenge;
}

export async function getAuthenticityVerdict(
  verdictId: string
): Promise<AuthenticityVerdict | null> {
  const raw = await readFinalized<string>("get_verdict", [verdictId]);
  const parsed = parseJson<AuthenticityVerdict | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as AuthenticityVerdict).id) return null;
  return parsed as AuthenticityVerdict;
}

export async function createAuthenticityClaim(
  name: string,
  claimType: AuthenticityClaimType,
  evidence: EvidenceSource[],
  context: string
): Promise<AuthenticityClaim> {
  await writeFinalized("create_claim", [
    normaliseName(name),
    claimType,
    JSON.stringify(evidence),
    context,
  ]);

  const claim = await getNamespaceAuthenticityClaim(name);
  if (!claim) throw new Error("Finalized claim could not be read back.");
  return claim;
}

export function buildWalletBoundAttestation(
  claim: AuthenticityClaim,
  options?: { issuedAt?: number; ttlSeconds?: number }
): WalletBoundAttestation {
  if (!GNS_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_GNS_CONTRACT_ADDRESS is not configured.");
  }
  const issuedAt = options?.issuedAt ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.min(
    Math.max(options?.ttlSeconds ?? 3600, 60),
    7 * 24 * 60 * 60
  );
  return {
    protocol: "gns-claim-v2",
    namespace: claim.namespace,
    wallet: claim.owner.toLowerCase(),
    registry: GNS_CONTRACT_ADDRESS.toLowerCase(),
    authenticity_contract: requireAuthenticity().toLowerCase(),
    claim_id: claim.id,
    challenge: claim.challenge,
    policy_version: claim.policy_version,
    issued_at: issuedAt,
    expires_at: issuedAt + ttlSeconds,
  };
}

export function serializeWalletBoundAttestation(
  claim: AuthenticityClaim,
  options?: { issuedAt?: number; ttlSeconds?: number }
): string {
  return JSON.stringify(buildWalletBoundAttestation(claim, options), null, 2);
}

export async function verifyAuthenticityClaim(
  claimId: string
): Promise<{ claim: AuthenticityClaim; verdict: AuthenticityVerdict }> {
  await writeFinalized("verify_claim", [claimId]);
  const claim = await getAuthenticityClaim(claimId);
  if (!claim) throw new Error("Finalized claim could not be read back.");
  if (!claim.verdict_id) throw new Error("Finalized claim has no verdict id.");
  const verdict = await getAuthenticityVerdict(claim.verdict_id);
  if (!verdict) throw new Error("Finalized claim verdict could not be read.");
  return { claim, verdict };
}

export async function challengeAuthenticityClaim(
  claimId: string,
  reasonCode: string,
  evidence: EvidenceSource[],
  context: string
): Promise<AuthenticityChallenge> {
  await writeFinalized("challenge_claim", [
    claimId,
    reasonCode,
    JSON.stringify(evidence),
    context,
  ]);
  const claim = await getAuthenticityClaim(claimId);
  if (!claim?.active_challenge_id) {
    throw new Error("Finalized challenge has no challenge id.");
  }
  const challenge = await getAuthenticityChallenge(claim.active_challenge_id);
  if (!challenge) throw new Error("Finalized challenge could not be read back.");
  return challenge;
}

export async function resolveAuthenticityChallenge(
  challengeId: string
): Promise<{ challenge: AuthenticityChallenge; verdict: AuthenticityVerdict }> {
  await writeFinalized("resolve_challenge", [challengeId]);
  const challenge = await getAuthenticityChallenge(challengeId);
  if (!challenge) throw new Error("Finalized challenge could not be read back.");
  if (!challenge.verdict_id) {
    throw new Error("Finalized challenge resolution has no verdict id.");
  }
  const verdict = await getAuthenticityVerdict(challenge.verdict_id);
  if (!verdict) throw new Error("Finalized challenge verdict could not be read.");
  return { challenge, verdict };
}

export async function refreshNamespaceAuthenticity(
  name: string
): Promise<NamespaceVerification> {
  await writeFinalized("refresh_namespace_status", [normaliseName(name)]);
  return getNamespaceVerification(name);
}
