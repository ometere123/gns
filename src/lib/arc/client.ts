"use client";

export const ARC_CHAIN_ID = 5_042_002;
export const ARC_CHAIN_HEX = `0x${ARC_CHAIN_ID.toString(16)}`;
export const ARC_RPC_URL =
  (process.env.NEXT_PUBLIC_ARC_RPC_URL || "https://rpc.testnet.arc.network").trim();
export const ARC_EXPLORER_URL =
  (process.env.NEXT_PUBLIC_ARC_EXPLORER_URL || "https://testnet.arcscan.app").trim();
export const ARC_USDC_ADDRESS =
  (process.env.NEXT_PUBLIC_ARC_USDC_ADDRESS || "0x3600000000000000000000000000000000000000").trim();
export const ARC_PAYMENT_ROUTER_ADDRESS =
  (process.env.NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS || "").trim();

export const USDC_DECIMALS = 6n;
export const USDC_SCALE = 10n ** USDC_DECIMALS;
export const PAYMENT_EVENT_TOPIC =
  "0x32ff84e5e01a8109e4619e0dde01c2df47463215310a78d3f37ad3d7fc70958b";

const SELECTOR = {
  registrationPricePerYear: "65a4dd91",
  renewalPricePerYear: "a0982efa",
  payRegistration: "b1b63df5",
  payRenewal: "5fe82f02",
  admin: "f851a440",
  pendingAdmin: "26782247",
  treasury: "61d027b3",
  pendingTreasury: "2ed6b75d",
  paused: "5c975abb",
  totalCollected: "e29eb836",
  totalWithdrawn: "4b319713",
  treasuryBalance: "313dab20",
  setPrices: "05fefda7",
  setPaused: "16c38b3c",
  proposeAdmin: "147bf6c4",
  cancelAdminTransfer: "9a387e70",
  acceptAdmin: "0e18b681",
  proposeTreasury: "f110ed67",
  cancelTreasuryTransfer: "fc5d3689",
  acceptTreasury: "e49d2a30",
  withdraw: "2e1a7d4d",
  withdrawAll: "853828b6",
  allowance: "dd62ed3e",
  approve: "095ea7b3",
  balanceOf: "70a08231",
} as const;

export type ArcPaymentReceipt = {
  txHash: string;
  logIndex: number;
  payer: string;
  namespaceHash: string;
  action: number;
  years: number;
  amount: bigint;
  blockNumber: number;
  intentHash: string;
};

export type ArcRouterOverview = {
  admin: string;
  pendingAdmin: string;
  treasury: string;
  pendingTreasury: string;
  paused: boolean;
  registrationPricePerYear: bigint;
  renewalPricePerYear: bigint;
  totalCollected: bigint;
  totalWithdrawn: bigint;
  treasuryBalance: bigint;
};

type EthLike = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type RpcReceipt = {
  transactionHash?: string;
  blockNumber?: string;
  status?: string;
  logs?: Array<{
    address?: string;
    logIndex?: string;
    topics?: string[];
    data?: string;
  }>;
};

function ethereum(): EthLike {
  if (typeof window === "undefined") throw new Error("Browser wallet unavailable.");
  const provider = (window as unknown as { ethereum?: EthLike }).ethereum;
  if (!provider) throw new Error("No injected EVM wallet detected.");
  return provider;
}

function requireAddress(value: string, label: string): string {
  const clean = value.trim().toLowerCase();
  if (!/^0x[0-9a-f]{40}$/.test(clean)) throw new Error(`${label} is not configured correctly.`);
  return clean;
}

function routerAddress(): string {
  return requireAddress(ARC_PAYMENT_ROUTER_ADDRESS, "Arc payment router");
}

function usdcAddress(): string {
  return requireAddress(ARC_USDC_ADDRESS, "Arc USDC address");
}

function word(value: bigint | number): string {
  const v = typeof value === "bigint" ? value : BigInt(value);
  if (v < 0n) throw new Error("Negative ABI integer.");
  return v.toString(16).padStart(64, "0");
}

function addressWord(address: string): string {
  return requireAddress(address, "Address").slice(2).padStart(64, "0");
}

function boolWord(value: boolean): string {
  return word(value ? 1n : 0n);
}

function utf8Hex(value: string): string {
  const bytes = new TextEncoder().encode(value);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

function encodeStringUint16(selector: string, text: string, years: number): string {
  const body = utf8Hex(text);
  const byteLength = BigInt(body.length / 2);
  const paddedLength = Math.ceil(body.length / 64) * 64;
  const tail = word(byteLength) + body.padEnd(paddedLength, "0");
  return `0x${selector}${word(64)}${word(years)}${tail}`;
}

function encodeStringUint16Bytes32(selector: string, text: string, years: number, intentHash: string): string {
  if (!/^0x[0-9a-fA-F]{64}$/.test(intentHash)) throw new Error("Malformed Arc payment intent.");
  const body = utf8Hex(text);
  const byteLength = BigInt(body.length / 2);
  const paddedLength = Math.ceil(body.length / 64) * 64;
  const tail = word(byteLength) + body.padEnd(paddedLength, "0");
  return `0x${selector}${word(96)}${word(years)}${intentHash.slice(2).toLowerCase()}${tail}`;
}

function encodeTwoUint(selector: string, first: bigint, second: bigint): string {
  return `0x${selector}${word(first)}${word(second)}`;
}

function encodeAddress(selector: string, address: string): string {
  return `0x${selector}${addressWord(address)}`;
}

function encodeUint(selector: string, value: bigint): string {
  return `0x${selector}${word(value)}`;
}

function encodeBool(selector: string, value: boolean): string {
  return `0x${selector}${boolWord(value)}`;
}

function parseUint(hex: unknown): bigint {
  const raw = String(hex || "0x0");
  if (!/^0x[0-9a-fA-F]*$/.test(raw)) throw new Error("Malformed Arc RPC integer.");
  return BigInt(raw === "0x" ? "0x0" : raw);
}

function parseAddressWord(hex: unknown): string {
  const clean = String(hex || "").toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(clean)) throw new Error("Malformed Arc address result.");
  return `0x${clean.slice(-40)}`;
}

function parseBool(hex: unknown): boolean {
  return parseUint(hex) !== 0n;
}

async function publicRpc<T>(method: string, params: unknown[]): Promise<T> {
  const response = await fetch(ARC_RPC_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  if (!response.ok) throw new Error(`Arc RPC HTTP ${response.status}.`);
  const body = (await response.json()) as { result?: T; error?: { message?: string } };
  if (body.error) throw new Error(body.error.message || "Arc RPC returned an error.");
  return body.result as T;
}

async function ethCall(to: string, data: string): Promise<string> {
  return publicRpc<string>("eth_call", [{ to, data }, "latest"]);
}

async function sendTransaction(from: string, to: string, data: string): Promise<string> {
  const hash = await ethereum().request({
    method: "eth_sendTransaction",
    params: [{ from: requireAddress(from, "Sender"), to: requireAddress(to, "Target"), data }],
  });
  const clean = String(hash || "");
  if (!/^0x[0-9a-fA-F]{64}$/.test(clean)) throw new Error("Arc wallet returned no transaction hash.");
  return clean;
}

export async function switchToArc(): Promise<void> {
  const provider = ethereum();
  try {
    await provider.request({ method: "wallet_switchEthereumChain", params: [{ chainId: ARC_CHAIN_HEX }] });
  } catch (error) {
    if ((error as { code?: number })?.code !== 4902) throw error;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: ARC_CHAIN_HEX,
          chainName: "Arc Testnet",
          nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
          rpcUrls: [ARC_RPC_URL],
          blockExplorerUrls: [ARC_EXPLORER_URL],
        },
      ],
    });
  }
}

export async function waitForArcReceipt(hash: string): Promise<RpcReceipt> {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const receipt = await publicRpc<RpcReceipt | null>("eth_getTransactionReceipt", [hash]);
    if (receipt?.blockNumber) {
      if (parseUint(receipt.status || "0x0") !== 1n) throw new Error("Arc transaction reverted.");
      return receipt;
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  throw new Error("Arc transaction was not finalized in time. You can resume with its transaction hash.");
}

export function formatUsdc(amount: bigint): string {
  const whole = amount / USDC_SCALE;
  const fraction = (amount % USDC_SCALE).toString().padStart(6, "0").replace(/0+$/, "");
  return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function usdcToBaseUnits(value: string): bigint {
  const clean = value.trim();
  if (!/^\d+(\.\d{0,6})?$/.test(clean)) throw new Error("Enter a valid USDC amount with at most 6 decimals.");
  const [whole, fraction = ""] = clean.split(".");
  return BigInt(whole) * USDC_SCALE + BigInt((fraction + "000000").slice(0, 6));
}

export async function getArcUsdcBalance(address: string): Promise<bigint> {
  return parseUint(await ethCall(usdcAddress(), `0x${SELECTOR.balanceOf}${addressWord(address)}`));
}

export async function getRegistrationPricePerYear(): Promise<bigint> {
  return parseUint(await ethCall(routerAddress(), `0x${SELECTOR.registrationPricePerYear}`));
}

export async function getRenewalPricePerYear(): Promise<bigint> {
  return parseUint(await ethCall(routerAddress(), `0x${SELECTOR.renewalPricePerYear}`));
}

export async function quoteArcRegistration(years: number): Promise<bigint> {
  return (await getRegistrationPricePerYear()) * BigInt(years);
}

export async function quoteArcRenewal(years: number): Promise<bigint> {
  return (await getRenewalPricePerYear()) * BigInt(years);
}

async function allowance(owner: string): Promise<bigint> {
  return parseUint(
    await ethCall(
      usdcAddress(),
      `0x${SELECTOR.allowance}${addressWord(owner)}${addressWord(routerAddress())}`
    )
  );
}

export async function ensureArcUsdcAllowance(owner: string, required: bigint): Promise<string | null> {
  if ((await allowance(owner)) >= required) return null;
  await switchToArc();
  const hash = await sendTransaction(
    owner,
    usdcAddress(),
    `0x${SELECTOR.approve}${addressWord(routerAddress())}${word(required)}`
  );
  await waitForArcReceipt(hash);
  return hash;
}

function parsePaymentReceipt(receipt: RpcReceipt, expectedAction: number): ArcPaymentReceipt {
  const router = routerAddress();
  for (const log of receipt.logs || []) {
    const topics = log.topics || [];
    if (String(log.address || "").toLowerCase() !== router) continue;
    if (topics.length !== 4 || String(topics[0]).toLowerCase() !== PAYMENT_EVENT_TOPIC) continue;
    const action = Number(parseUint(topics[3]));
    if (action !== expectedAction) continue;

    const data = String(log.data || "").replace(/^0x/, "");
    if (data.length !== 192) throw new Error("Malformed Arc payment event data.");
    const years = Number(BigInt(`0x${data.slice(0, 64)}`));
    const amount = BigInt(`0x${data.slice(64, 128)}`);
    return {
      txHash: String(receipt.transactionHash || ""),
      logIndex: Number(parseUint(log.logIndex || "0x0")),
      payer: parseAddressWord(topics[1]),
      namespaceHash: String(topics[2]).toLowerCase(),
      action,
      years,
      amount,
      blockNumber: Number(parseUint(receipt.blockNumber || "0x0")),
      intentHash: `0x${data.slice(128, 192)}`,
    };
  }
  throw new Error("Arc transaction did not emit the expected GNS payment receipt.");
}

async function pay(owner: string, name: string, years: number, intentHash: string, action: 1 | 2): Promise<ArcPaymentReceipt> {
  const normalized = name.trim().toLowerCase();
  const quote = action === 1 ? await quoteArcRegistration(years) : await quoteArcRenewal(years);
  const balance = await getArcUsdcBalance(owner);
  if (balance < quote) throw new Error(`Insufficient Arc USDC. Need ${formatUsdc(quote)} USDC.`);

  await ensureArcUsdcAllowance(owner, quote);
  await switchToArc();
  const selector = action === 1 ? SELECTOR.payRegistration : SELECTOR.payRenewal;
  const hash = await sendTransaction(owner, routerAddress(), encodeStringUint16Bytes32(selector, normalized, years, intentHash));
  return parsePaymentReceipt(await waitForArcReceipt(hash), action);
}

export function payArcRegistration(owner: string, name: string, years: number, intentHash: string): Promise<ArcPaymentReceipt> {
  return pay(owner, name, years, intentHash, 1);
}

export function payArcRenewal(owner: string, name: string, years: number, intentHash: string): Promise<ArcPaymentReceipt> {
  return pay(owner, name, years, intentHash, 2);
}

export async function readArcRouterOverview(): Promise<ArcRouterOverview> {
  const router = routerAddress();
  const call = (selector: string) => ethCall(router, `0x${selector}`);
  const [admin, pendingAdmin, treasury, pendingTreasury, paused, reg, renewal, collected, withdrawn, balance] = await Promise.all([
    call(SELECTOR.admin),
    call(SELECTOR.pendingAdmin),
    call(SELECTOR.treasury),
    call(SELECTOR.pendingTreasury),
    call(SELECTOR.paused),
    call(SELECTOR.registrationPricePerYear),
    call(SELECTOR.renewalPricePerYear),
    call(SELECTOR.totalCollected),
    call(SELECTOR.totalWithdrawn),
    call(SELECTOR.treasuryBalance),
  ]);
  return {
    admin: parseAddressWord(admin),
    pendingAdmin: parseAddressWord(pendingAdmin),
    treasury: parseAddressWord(treasury),
    pendingTreasury: parseAddressWord(pendingTreasury),
    paused: parseBool(paused),
    registrationPricePerYear: parseUint(reg),
    renewalPricePerYear: parseUint(renewal),
    totalCollected: parseUint(collected),
    totalWithdrawn: parseUint(withdrawn),
    treasuryBalance: parseUint(balance),
  };
}

async function routerWrite(from: string, data: string): Promise<string> {
  await switchToArc();
  const hash = await sendTransaction(from, routerAddress(), data);
  await waitForArcReceipt(hash);
  return hash;
}

export function arcSetPrices(from: string, registration: bigint, renewal: bigint): Promise<string> {
  return routerWrite(from, encodeTwoUint(SELECTOR.setPrices, registration, renewal));
}
export function arcSetPaused(from: string, paused: boolean): Promise<string> {
  return routerWrite(from, encodeBool(SELECTOR.setPaused, paused));
}
export function arcProposeAdmin(from: string, next: string): Promise<string> {
  return routerWrite(from, encodeAddress(SELECTOR.proposeAdmin, next));
}
export function arcCancelAdminTransfer(from: string): Promise<string> {
  return routerWrite(from, `0x${SELECTOR.cancelAdminTransfer}`);
}
export function arcAcceptAdmin(from: string): Promise<string> {
  return routerWrite(from, `0x${SELECTOR.acceptAdmin}`);
}
export function arcProposeTreasury(from: string, next: string): Promise<string> {
  return routerWrite(from, encodeAddress(SELECTOR.proposeTreasury, next));
}
export function arcCancelTreasuryTransfer(from: string): Promise<string> {
  return routerWrite(from, `0x${SELECTOR.cancelTreasuryTransfer}`);
}
export function arcAcceptTreasury(from: string): Promise<string> {
  return routerWrite(from, `0x${SELECTOR.acceptTreasury}`);
}
export function arcWithdraw(from: string, amount: bigint): Promise<string> {
  return routerWrite(from, encodeUint(SELECTOR.withdraw, amount));
}
export function arcWithdrawAll(from: string): Promise<string> {
  return routerWrite(from, `0x${SELECTOR.withdrawAll}`);
}

export function arcExplorerTx(hash: string): string {
  return `${ARC_EXPLORER_URL.replace(/\/$/, "")}/tx/${hash}`;
}
