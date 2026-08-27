"use client";

import {
  GNS_CONTRACT_ADDRESS,
  isConfigured,
  readView,
  writeMethod,
  writeMethodAt,
} from "@/lib/genlayer/client";
import { normaliseName } from "@/lib/utils";
import type {
  GnsName,
  GnsRecords,
  GnsReport,
  ContractWriteResult,
  SearchResult,
  AiReview,
  AiSuggestion,
} from "@/lib/types";

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

function asWriteResult(raw: unknown): ContractWriteResult {
  const parsed = parseJson<Partial<ContractWriteResult>>(raw, {
    success: true,
    message: "Transaction finalized",
  });
  return {
    success: Boolean(parsed.success ?? true),
    message: String(parsed.message ?? "Transaction finalized"),
    data: parsed.data,
  };
}

async function finalizedRegistryWrite(
  functionName: string,
  args: unknown[]
): Promise<ContractWriteResult> {
  if (!GNS_CONTRACT_ADDRESS) {
    throw new Error("NEXT_PUBLIC_GNS_CONTRACT_ADDRESS is not configured.");
  }
  const raw = await writeMethodAt(
    GNS_CONTRACT_ADDRESS,
    functionName,
    args,
    undefined,
    {
      waitStatus: "FINALIZED",
      strictWait: true,
      retries: 160,
      interval: 3000,
    }
  );
  return asWriteResult(raw);
}

export { isConfigured };

export type ArcPaymentConfig = {
  chain_id: number;
  rpc_url: string;
  router: string;
  event_topic: string;
  deterministic_finality: boolean;
  reservation_ttl_seconds: number;
  renewal_intent_ttl_seconds: number;
  registrations_paused: boolean;
};

export type RegistrationReservation = {
  namespace: string;
  reserver: string;
  years: number;
  primary_address: string;
  created_at: number;
  expires_at: number;
  intent_hash: string;
};

export async function isAvailable(name: string): Promise<boolean> {
  return Boolean(await readView<boolean>("is_available", [normaliseName(name)]));
}

export async function resolveName(name: string): Promise<GnsName | null> {
  const raw = await readView<string>("resolve", [normaliseName(name)]);
  const parsed = parseJson<GnsName | Record<string, never>>(
    raw,
    {} as Record<string, never>
  );
  return parsed && (parsed as GnsName).full_name ? (parsed as GnsName) : null;
}

export async function searchName(query: string): Promise<SearchResult> {
  const fullName = normaliseName(query);
  if (!fullName) return { query, fullName, available: false, name: null };
  const [available, name] = await Promise.all([
    isAvailable(fullName),
    resolveName(fullName),
  ]);
  return {
    query,
    fullName,
    available,
    name: available ? null : name,
  };
}

export async function resolveAddress(name: string): Promise<string> {
  return String(
    (await readView<string>("resolve_address", [normaliseName(name)])) || ""
  );
}

export async function reverseLookup(address: string): Promise<string> {
  return String(
    (await readView<string>("reverse_lookup", [address.toLowerCase()])) || ""
  );
}

export async function getNamesByOwner(owner: string): Promise<string[]> {
  return parseJson<string[]>(
    await readView<string>("get_names_by_owner", [owner.toLowerCase()]),
    []
  );
}

export async function getSubnames(parentName: string): Promise<string[]> {
  return parseJson<string[]>(
    await readView<string>("get_subnames", [normaliseName(parentName)]),
    []
  );
}

export async function getRecords(name: string): Promise<GnsRecords> {
  return parseJson<GnsRecords>(
    await readView<string>("get_records", [normaliseName(name)]),
    {}
  );
}

export async function getTotalNames(): Promise<number> {
  try {
    return Number(await readView<number | string>("get_total_names", [])) || 0;
  } catch {
    return 0;
  }
}

export async function getTotalReports(): Promise<number> {
  try {
    return Number(await readView<number | string>("get_total_reports", [])) || 0;
  } catch {
    return 0;
  }
}

export async function getReport(id: string): Promise<GnsReport | null> {
  const parsed = parseJson<GnsReport | Record<string, never>>(
    await readView<string>("get_report", [id]),
    {} as Record<string, never>
  );
  return parsed && (parsed as GnsReport).id ? (parsed as GnsReport) : null;
}

export async function getAdmin(): Promise<string> {
  return String((await readView<string>("get_admin", [])) || "");
}

export async function getPendingAdmin(): Promise<string> {
  return String((await readView<string>("get_pending_admin", [])) || "");
}

export async function getArcPaymentConfig(): Promise<ArcPaymentConfig> {
  return parseJson<ArcPaymentConfig>(
    await readView<string>("get_arc_payment_config", []),
    {
      chain_id: 0,
      rpc_url: "",
      router: "",
      event_topic: "",
      deterministic_finality: false,
      reservation_ttl_seconds: 0,
      renewal_intent_ttl_seconds: 0,
      registrations_paused: false,
    }
  );
}

export async function getRegistrationReservation(
  name: string
): Promise<RegistrationReservation | null> {
  const parsed = parseJson<RegistrationReservation | Record<string, never>>(
    await readView<string>("get_registration_reservation", [normaliseName(name)]),
    {} as Record<string, never>
  );
  return parsed && (parsed as RegistrationReservation).namespace
    ? (parsed as RegistrationReservation)
    : null;
}

export async function getTotalPaymentsConsumed(): Promise<number> {
  return (
    Number(await readView<number | string>("get_total_payments_consumed", [])) || 0
  );
}

export async function isPaymentConsumed(
  txHash: string,
  logIndex: number
): Promise<boolean> {
  return Boolean(
    await readView<boolean>("is_payment_consumed", [txHash, logIndex])
  );
}

export async function reserveRegistration(
  name: string,
  years: number,
  primaryAddress: string
): Promise<ContractWriteResult> {
  const label = normaliseName(name).replace(/\.gen$/, "");
  return finalizedRegistryWrite("reserve_registration", [
    label,
    years,
    primaryAddress,
  ]);
}

export async function cancelRegistrationReservation(
  name: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("cancel_registration_reservation", [
    normaliseName(name),
  ]);
}

export async function createRenewalIntent(name: string, years: number): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("create_renewal_intent", [normaliseName(name), years]);
}

export async function registerName(
  name: string,
  years: number,
  primaryAddress: string,
  arcTxHash: string,
  arcLogIndex: number
): Promise<ContractWriteResult> {
  const label = normaliseName(name).replace(/\.gen$/, "");
  return finalizedRegistryWrite("register", [
    label,
    years,
    primaryAddress,
    arcTxHash,
    arcLogIndex,
  ]);
}

export async function renewName(
  name: string,
  years: number,
  arcTxHash: string,
  arcLogIndex: number
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("renew", [
    normaliseName(name),
    years,
    arcTxHash,
    arcLogIndex,
  ]);
}

export function transferName(
  name: string,
  newOwner: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("transfer", [normaliseName(name), newOwner]);
}

export function setRecords(
  name: string,
  records: GnsRecords
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("set_records", [
    normaliseName(name),
    JSON.stringify(records),
  ]);
}

export function setPrimaryAddress(
  name: string,
  address: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("set_primary_address", [normaliseName(name), address]);
}

export function setPrimaryName(name: string): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("set_primary_name", [normaliseName(name)]);
}

export function createSubname(
  parent: string,
  subLabel: string,
  primaryAddress: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("create_subname", [
    normaliseName(parent),
    subLabel,
    primaryAddress,
  ]);
}

export function transferSubname(
  subname: string,
  newOwner: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("transfer_subname", [normaliseName(subname), newOwner]);
}

export async function getTotalReviews(): Promise<number> {
  try {
    return Number(await readView<number | string>("get_total_reviews", [])) || 0;
  } catch {
    return 0;
  }
}

export async function getAiReview(
  reviewId: string
): Promise<AiReview | null> {
  if (!reviewId) return null;
  const parsed = parseJson<AiReview | Record<string, never>>(
    await readView<string>("get_ai_review", [reviewId]),
    {} as Record<string, never>
  );
  return parsed && (parsed as AiReview).id ? (parsed as AiReview) : null;
}

async function fetchLatestReview(): Promise<AiReview | null> {
  const total = await getTotalReviews();
  return total ? getAiReview(String(total)) : null;
}

export async function aiSuggestNames(
  baseLabel: string,
  purpose: string
): Promise<AiSuggestion[]> {
  await writeMethod("ai_suggest_names", [baseLabel, purpose]);
  const review = await fetchLatestReview();
  const result = review?.result as unknown as
    | { suggestions?: AiSuggestion[] }
    | undefined;
  return result?.suggestions && Array.isArray(result.suggestions)
    ? result.suggestions
    : [];
}

export function adminSetRegistrationsPaused(
  paused: boolean
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("admin_set_registrations_paused", [paused]);
}

export function adminProposeAdmin(
  newAdmin: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("admin_propose_admin", [newAdmin]);
}

export function adminCancelAdminTransfer(): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("admin_cancel_admin_transfer", []);
}

export function acceptRegistryAdmin(): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("accept_admin", []);
}

export function adminFlagName(
  name: string,
  reason: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("admin_flag_name", [normaliseName(name), reason]);
}

export function adminUnflagName(name: string): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("admin_unflag_name", [normaliseName(name)]);
}

export function adminSetReportStatus(
  reportId: string,
  status: string
): Promise<ContractWriteResult> {
  return finalizedRegistryWrite("admin_set_report_status", [reportId, status]);
}
