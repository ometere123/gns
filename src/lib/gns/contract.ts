"use client";

import { readView, writeMethod, isConfigured } from "@/lib/genlayer/client";
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
  const parsed = parseJson<Partial<ContractWriteResult>>(raw, { success: true, message: "OK" });
  return {
    success: Boolean(parsed.success ?? true),
    message: String(parsed.message ?? "OK"),
    data: parsed.data,
  };
}

export { isConfigured };

export async function isAvailable(name: string): Promise<boolean> {
  const v = await readView<boolean>("is_available", [normaliseName(name)]);
  return Boolean(v);
}

export async function resolveName(name: string): Promise<GnsName | null> {
  const raw = await readView<string>("resolve", [normaliseName(name)]);
  const parsed = parseJson<GnsName | Record<string, never>>(raw, {} as Record<string, never>);
  if (!parsed || !(parsed as GnsName).full_name) return null;
  return parsed as GnsName;
}

export async function searchName(query: string): Promise<SearchResult> {
  const fullName = normaliseName(query);
  if (!fullName) return { query, fullName, available: false, name: null };
  const name = await resolveName(fullName);
  if (name) return { query, fullName, available: false, name };
  return { query, fullName, available: true, name: null };
}

export async function resolveAddress(name: string): Promise<string> {
  const v = await readView<string>("resolve_address", [normaliseName(name)]);
  return String(v || "");
}

export async function reverseLookup(address: string): Promise<string> {
  const v = await readView<string>("reverse_lookup", [address.toLowerCase()]);
  return String(v || "");
}

export async function getNamesByOwner(owner: string): Promise<string[]> {
  const raw = await readView<string>("get_names_by_owner", [owner.toLowerCase()]);
  return parseJson<string[]>(raw, []);
}

export async function getSubnames(parentName: string): Promise<string[]> {
  const raw = await readView<string>("get_subnames", [normaliseName(parentName)]);
  return parseJson<string[]>(raw, []);
}

export async function getRecords(name: string): Promise<GnsRecords> {
  const raw = await readView<string>("get_records", [normaliseName(name)]);
  return parseJson<GnsRecords>(raw, {});
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
  const raw = await readView<string>("get_report", [id]);
  const parsed = parseJson<GnsReport | Record<string, never>>(raw, {} as Record<string, never>);
  if (!parsed || !(parsed as GnsReport).id) return null;
  return parsed as GnsReport;
}

export const GEN_DECIMALS = 18n;
export const ONE_GEN_WEI = 10n ** GEN_DECIMALS;

function toBigInt(v: unknown): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return BigInt(Math.floor(v));
  if (typeof v === "string") {
    const trimmed = v.trim();
    if (!trimmed) return 0n;
    try {
      return BigInt(trimmed);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

export function weiToGen(wei: bigint): string {
  if (wei === 0n) return "0";
  const whole = wei / ONE_GEN_WEI;
  const remainder = wei % ONE_GEN_WEI;
  if (remainder === 0n) return whole.toString();
  const frac = remainder.toString().padStart(18, "0").replace(/0+$/, "").slice(0, 4);
  return frac ? `${whole}.${frac}` : whole.toString();
}

export function genToWei(amount: string | number): bigint {
  const s = String(amount).trim();
  if (!s) return 0n;
  const [whole, frac = ""] = s.split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * ONE_GEN_WEI + BigInt(fracPadded || "0");
}

export async function getPricePerYear(): Promise<bigint> {
  return toBigInt(await readView<unknown>("get_price_per_year", []));
}

export async function quoteRegistration(years: number): Promise<bigint> {
  try {
    return toBigInt(await readView<unknown>("quote_registration", [years]));
  } catch {
    return (await getPricePerYear()) * BigInt(years);
  }
}

export async function quoteRenewal(years: number): Promise<bigint> {
  try {
    return toBigInt(await readView<unknown>("quote_renewal", [years]));
  } catch {
    return (await getPricePerYear()) * BigInt(years);
  }
}

export async function getTreasury(): Promise<string> {
  try {
    return String((await readView<string>("get_treasury", [])) || "");
  } catch {
    return "";
  }
}

export async function getAdmin(): Promise<string> {
  try {
    return String((await readView<string>("get_admin", [])) || "");
  } catch {
    return "";
  }
}

export async function getContractBalance(): Promise<bigint> {
  try {
    return toBigInt(await readView<unknown>("get_contract_balance", []));
  } catch {
    return 0n;
  }
}

export async function getTotalProtocolRevenue(): Promise<bigint> {
  try {
    return toBigInt(await readView<unknown>("get_total_protocol_revenue", []));
  } catch {
    return 0n;
  }
}

export async function getTotalWithdrawn(): Promise<bigint> {
  try {
    return toBigInt(await readView<unknown>("get_total_withdrawn", []));
  } catch {
    return 0n;
  }
}

export async function registerName(
  name: string,
  years: number,
  primaryAddress: string
): Promise<ContractWriteResult> {
  const label = normaliseName(name).replace(/\.gen$/, "");
  const value = await quoteRegistration(years);
  return asWriteResult(await writeMethod("register", [label, years, primaryAddress], value));
}

export async function renewName(name: string, years: number): Promise<ContractWriteResult> {
  const value = await quoteRenewal(years);
  return asWriteResult(await writeMethod("renew", [normaliseName(name), years], value));
}

export async function transferName(name: string, newOwner: string): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("transfer", [normaliseName(name), newOwner]));
}

export async function setRecords(name: string, records: GnsRecords): Promise<ContractWriteResult> {
  return asWriteResult(
    await writeMethod("set_records", [normaliseName(name), JSON.stringify(records)])
  );
}

export async function setPrimaryAddress(name: string, address: string): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("set_primary_address", [normaliseName(name), address]));
}

export async function setPrimaryName(name: string): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("set_primary_name", [normaliseName(name)]));
}

export async function createSubname(
  parent: string,
  subLabel: string,
  primaryAddress: string
): Promise<ContractWriteResult> {
  return asWriteResult(
    await writeMethod("create_subname", [normaliseName(parent), subLabel, primaryAddress])
  );
}

export async function transferSubname(
  subname: string,
  newOwner: string
): Promise<ContractWriteResult> {
  return asWriteResult(
    await writeMethod("transfer_subname", [normaliseName(subname), newOwner])
  );
}

// Legacy registry AI verdict writes are intentionally NOT exposed here anymore.
// Authoritative identity verification and disputes live in authenticity.ts.
// The one remaining AI method is advisory name generation; it cannot mutate
// ownership, verification, dispute status, or protocol funds.

export async function getTotalReviews(): Promise<number> {
  try {
    return Number(await readView<number | string>("get_total_reviews", [])) || 0;
  } catch {
    return 0;
  }
}

export async function getAiReview(reviewId: string): Promise<AiReview | null> {
  if (!reviewId) return null;
  const raw = await readView<string>("get_ai_review", [reviewId]);
  const parsed = parseJson<AiReview | Record<string, never>>(raw, {} as Record<string, never>);
  if (!parsed || !(parsed as AiReview).id) return null;
  return parsed as AiReview;
}

async function fetchLatestReview(): Promise<AiReview | null> {
  const total = await getTotalReviews();
  if (!total) return null;
  return getAiReview(String(total));
}

export async function aiSuggestNames(
  baseLabel: string,
  purpose: string
): Promise<AiSuggestion[]> {
  await writeMethod("ai_suggest_names", [baseLabel, purpose]);
  const review = await fetchLatestReview();
  const result = review?.result as unknown as { suggestions?: AiSuggestion[] } | undefined;
  return result?.suggestions && Array.isArray(result.suggestions) ? result.suggestions : [];
}

export async function adminWithdraw(amountWei: bigint): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("admin_withdraw", [amountWei.toString()]));
}

export async function adminSetPricePerYear(newPriceWei: bigint): Promise<ContractWriteResult> {
  return asWriteResult(
    await writeMethod("admin_set_price_per_year", [newPriceWei.toString()])
  );
}

export async function adminSetTreasury(newTreasury: string): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("admin_set_treasury", [newTreasury]));
}

export async function adminFlagName(name: string, reason: string): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("admin_flag_name", [normaliseName(name), reason]));
}

export async function adminUnflagName(name: string): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("admin_unflag_name", [normaliseName(name)]));
}

export async function adminSetReportStatus(
  reportId: string,
  status: string
): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("admin_set_report_status", [reportId, status]));
}

export async function adminTransferAdmin(newAdmin: string): Promise<ContractWriteResult> {
  return asWriteResult(await writeMethod("admin_transfer_admin", [newAdmin]));
}
