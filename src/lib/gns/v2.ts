"use client";

import {
  GNS_V2_CONTRACT_ADDRESS,
  isV2Configured,
  readViewAt,
  writeMethodAt,
} from "@/lib/genlayer/client";
import { normaliseName } from "@/lib/utils";
import type {
  GnsV2Attestation,
  GnsV2Challenge,
  GnsV2Claim,
  GnsV2ClaimType,
  GnsV2EvidenceSource,
  GnsV2Namespace,
  GnsV2Records,
  GnsV2Verdict,
} from "./v2-types";

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

function requireV2(): string {
  if (!isV2Configured()) {
    throw new Error(
      "GNS v2 is not configured. Set NEXT_PUBLIC_GNS_V2_CONTRACT_ADDRESS."
    );
  }
  return GNS_V2_CONTRACT_ADDRESS;
}

async function readFinalized<T>(
  functionName: string,
  args: unknown[] = []
): Promise<T> {
  return readViewAt<T>(requireV2(), functionName, args, "finalized");
}

async function writeFinalized(
  functionName: string,
  args: unknown[] = []
): Promise<unknown> {
  return writeMethodAt(requireV2(), functionName, args, undefined, {
    waitStatus: "FINALIZED",
    strictWait: true,
    retries: 120,
    interval: 3000,
  });
}

export { isV2Configured };

export async function resolveNamespaceV2(
  name: string
): Promise<GnsV2Namespace | null> {
  const raw = await readFinalized<string>("resolve", [normaliseName(name)]);
  const parsed = parseJson<GnsV2Namespace | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as GnsV2Namespace).namespace) return null;
  return parsed as GnsV2Namespace;
}

export async function getNamespaceClaimV2(
  name: string
): Promise<GnsV2Claim | null> {
  const raw = await readFinalized<string>("get_namespace_claim", [
    normaliseName(name),
  ]);
  const parsed = parseJson<GnsV2Claim | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as GnsV2Claim).id) return null;
  return parsed as GnsV2Claim;
}

export async function getClaimV2(
  claimId: string
): Promise<GnsV2Claim | null> {
  const raw = await readFinalized<string>("get_claim", [claimId]);
  const parsed = parseJson<GnsV2Claim | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as GnsV2Claim).id) return null;
  return parsed as GnsV2Claim;
}

export async function getChallengeV2(
  challengeId: string
): Promise<GnsV2Challenge | null> {
  const raw = await readFinalized<string>("get_challenge", [challengeId]);
  const parsed = parseJson<GnsV2Challenge | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as GnsV2Challenge).id) return null;
  return parsed as GnsV2Challenge;
}

export async function getVerdictV2(
  verdictId: string
): Promise<GnsV2Verdict | null> {
  const raw = await readFinalized<string>("get_verdict", [verdictId]);
  const parsed = parseJson<GnsV2Verdict | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!parsed || !(parsed as GnsV2Verdict).id) return null;
  return parsed as GnsV2Verdict;
}

export async function getPolicyVersionV2(): Promise<string> {
  return String(await readFinalized<string>("get_policy_version"));
}

export async function registerNamespaceV2(
  label: string,
  primaryAddress: string
): Promise<GnsV2Namespace | null> {
  await writeFinalized("register", [
    normaliseName(label).replace(/\.gen$/, ""),
    primaryAddress,
  ]);
  return resolveNamespaceV2(label);
}

export async function setIdentityRecordsV2(
  name: string,
  records: GnsV2Records
): Promise<GnsV2Namespace | null> {
  await writeFinalized("set_identity_records", [
    normaliseName(name),
    JSON.stringify(records),
  ]);
  return resolveNamespaceV2(name);
}

export async function setPrimaryAddressV2(
  name: string,
  primaryAddress: string
): Promise<GnsV2Namespace | null> {
  await writeFinalized("set_primary_address", [
    normaliseName(name),
    primaryAddress,
  ]);
  return resolveNamespaceV2(name);
}

export async function transferNamespaceV2(
  name: string,
  newOwner: string
): Promise<GnsV2Namespace | null> {
  await writeFinalized("transfer", [normaliseName(name), newOwner]);
  return resolveNamespaceV2(name);
}

export async function createClaimV2(
  name: string,
  claimType: GnsV2ClaimType,
  evidence: GnsV2EvidenceSource[],
  context: string
): Promise<GnsV2Claim> {
  await writeFinalized("create_claim", [
    normaliseName(name),
    claimType,
    JSON.stringify(evidence),
    context,
  ]);

  const claim = await getNamespaceClaimV2(name);
  if (!claim) {
    throw new Error("Claim finalized but could not be read back.");
  }
  return claim;
}

export function buildWalletBoundAttestationV2(
  claim: GnsV2Claim,
  options?: {
    issuedAt?: number;
    ttlSeconds?: number;
  }
): GnsV2Attestation {
  const issuedAt = options?.issuedAt ?? Math.floor(Date.now() / 1000);
  const ttlSeconds = Math.min(
    Math.max(options?.ttlSeconds ?? 3600, 60),
    7 * 24 * 60 * 60
  );

  return {
    protocol: "gns-claim-v2",
    namespace: claim.namespace,
    wallet: claim.owner.toLowerCase(),
    registry: requireV2().toLowerCase(),
    claim_id: claim.id,
    challenge: claim.challenge,
    policy_version: claim.policy_version,
    issued_at: issuedAt,
    expires_at: issuedAt + ttlSeconds,
  };
}

export function serializeWalletBoundAttestationV2(
  claim: GnsV2Claim,
  options?: {
    issuedAt?: number;
    ttlSeconds?: number;
  }
): string {
  return JSON.stringify(buildWalletBoundAttestationV2(claim, options), null, 2);
}

export async function verifyClaimV2(
  claimId: string
): Promise<{ claim: GnsV2Claim; verdict: GnsV2Verdict }> {
  await writeFinalized("verify_claim", [claimId]);

  const claim = await getClaimV2(claimId);
  if (!claim) throw new Error("Verified claim could not be read back.");
  if (!claim.verdict_id) {
    throw new Error("Verification finalized without a verdict id.");
  }

  const verdict = await getVerdictV2(claim.verdict_id);
  if (!verdict) throw new Error("Finalized verification verdict could not be read.");
  return { claim, verdict };
}

export async function challengeClaimV2(
  claimId: string,
  reasonCode: string,
  evidence: GnsV2EvidenceSource[],
  context: string
): Promise<GnsV2Challenge> {
  const existing = await getClaimV2(claimId);
  if (!existing) throw new Error("Claim does not exist.");

  await writeFinalized("challenge_claim", [
    claimId,
    reasonCode,
    JSON.stringify(evidence),
    context,
  ]);

  const claim = await getClaimV2(claimId);
  const challengeId = claim?.active_challenge_id;
  if (!challengeId) {
    throw new Error("Challenge finalized but no active challenge id was stored.");
  }

  const challenge = await getChallengeV2(challengeId);
  if (!challenge) throw new Error("Finalized challenge could not be read back.");
  return challenge;
}

export async function resolveChallengeV2(
  challengeId: string
): Promise<{ challenge: GnsV2Challenge; verdict: GnsV2Verdict }> {
  await writeFinalized("resolve_challenge", [challengeId]);

  const challenge = await getChallengeV2(challengeId);
  if (!challenge) throw new Error("Resolved challenge could not be read back.");
  if (!challenge.verdict_id) {
    throw new Error("Challenge resolution finalized without a verdict id.");
  }

  const verdict = await getVerdictV2(challenge.verdict_id);
  if (!verdict) throw new Error("Finalized challenge verdict could not be read.");
  return { challenge, verdict };
}
