"use client";

import { getReadClient } from "@/lib/genlayer/client";
import type {
  GnsRecords,
  SoulStampIdentity,
  SoulStampLinkedAccount,
  SoulStampMatch,
  SoulStampPlatform,
} from "@/lib/types";

export const SOULSTAMP_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_SOULSTAMP_CONTRACT_ADDRESS || "").trim();

export const SOULSTAMP_APP_URL =
  (process.env.NEXT_PUBLIC_SOULSTAMP_APP_URL || "https://soulstamp-gen.vercel.app").trim();

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

export function isSoulStampConfigured(): boolean {
  return SOULSTAMP_CONTRACT_ADDRESS.length > 0;
}

export async function getSoulStampIdentity(address: string): Promise<SoulStampIdentity | null> {
  if (!isSoulStampConfigured() || !address) return null;
  const client = await getReadClient();
  if (!client) throw new Error("GenLayer client unavailable in this environment.");
  const raw = await client.readContract({
    address: SOULSTAMP_CONTRACT_ADDRESS,
    functionName: "get_identity",
    args: [address.toLowerCase()],
    stateStatus: "accepted",
  });
  const identity = parseJson<SoulStampIdentity | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  if (!identity || !("found" in identity)) return null;
  return {
    found: Boolean(identity.found),
    owner: String(identity.owner || address).toLowerCase(),
    linked_accounts: Array.isArray(identity.linked_accounts) ? identity.linked_accounts : [],
    reputation_score: Number(identity.reputation_score || 0),
    is_flagged: Boolean(identity.is_flagged),
    flag_reason: String(identity.flag_reason || ""),
    verification_count: Number(identity.verification_count || 0),
  };
}

function normalizeUsername(value?: string): string {
  if (!value) return "";
  const trimmed = value.trim();
  if (!trimmed) return "";
  try {
    const url = new URL(trimmed);
    const parts = url.pathname.split("/").filter(Boolean);
    return (parts[0] || "").replace(/^@/, "").toLowerCase();
  } catch {
    return trimmed.replace(/^@/, "").toLowerCase();
  }
}

function activeStatus(account?: SoulStampLinkedAccount): boolean {
  const status = String(account?.proof_status || "ACTIVE").toUpperCase();
  return status === "ACTIVE";
}

function findAccount(
  identity: SoulStampIdentity | null,
  platform: SoulStampPlatform,
  expected: string
): SoulStampLinkedAccount | undefined {
  return identity?.linked_accounts.find((account) => {
    return (
      account.platform === platform &&
      normalizeUsername(account.username || account.profile_url) === expected
    );
  });
}

function buildMatch(
  identity: SoulStampIdentity | null,
  platform: SoulStampPlatform,
  label: string,
  expected: string,
  configured: boolean
): SoulStampMatch {
  if (!configured) {
    return {
      platform,
      label,
      expected,
      status: "unconfigured",
      matched: false,
      message: "SoulStamp contract is not configured.",
    };
  }
  const account = findAccount(identity, platform, expected);
  if (!identity?.found || !account) {
    return {
      platform,
      label,
      expected,
      status: "missing",
      matched: false,
      message: "Not linked on SoulStamp for this wallet.",
    };
  }
  if (identity.is_flagged || !activeStatus(account)) {
    return {
      platform,
      label,
      expected,
      account,
      status: identity.is_flagged ? "flagged" : "inactive",
      matched: false,
      message: identity.is_flagged
        ? identity.flag_reason || "SoulStamp identity is flagged."
        : `SoulStamp proof is ${account.proof_status || "inactive"}.`,
    };
  }
  return {
    platform,
    label,
    expected,
    account,
    status: "verified",
    matched: true,
    message: "Wallet and account match an active SoulStamp proof.",
  };
}

export function buildSoulStampMatches(
  identity: SoulStampIdentity | null,
  records: GnsRecords,
  configured = isSoulStampConfigured()
): SoulStampMatch[] {
  const checks: Array<[SoulStampPlatform, string, string]> = [
    ["twitter", "X", normalizeUsername(records.x)],
    ["github", "GitHub", normalizeUsername(records.github)],
    ["discord", "Discord", normalizeUsername(records.discord)],
  ];
  return checks
    .filter(([, , expected]) => expected.length > 0)
    .map(([platform, label, expected]) => buildMatch(identity, platform, label, expected, configured));
}
