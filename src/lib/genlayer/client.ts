"use client";

// GenLayer client wrapper for the GNS frontend.
//
// Registry compatibility:
// - readView/writeMethod keep the existing NEXT_PUBLIC_GNS_CONTRACT_ADDRESS API.
//
// Authenticity layer:
// - readViewAt/writeMethodAt support an explicit contract address.
// - verdict-bearing writes require FINALIZED and successful execution; FINALIZED
//   with FINISHED_WITH_ERROR is never presented as a successful trust result.

export const GNS_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_GNS_CONTRACT_ADDRESS || "").trim();
export const GNS_AUTHENTICITY_CONTRACT_ADDRESS =
  (process.env.NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS || "").trim();
export const GENLAYER_RPC_URL =
  (process.env.NEXT_PUBLIC_GENLAYER_RPC_URL || "https://studio.genlayer.com/api").trim();
export const CHAIN_NAME =
  (process.env.NEXT_PUBLIC_CHAIN_NAME || "studionet").trim();
export const EXPLORER_URL =
  (process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer-studio.genlayer.com/").trim();

export function isConfigured(): boolean {
  return GNS_CONTRACT_ADDRESS.length > 0;
}

export function isAuthenticityConfigured(): boolean {
  return GNS_AUTHENTICITY_CONTRACT_ADDRESS.length > 0;
}

type ReceiptStatus = "ACCEPTED" | "FINALIZED";
type StateStatus = "accepted" | "finalized";

type AnyClient = {
  readContract: (args: {
    address: string;
    functionName: string;
    args: unknown[];
    stateStatus?: string;
  }) => Promise<unknown>;
  writeContract: (args: {
    address: string;
    functionName: string;
    args: unknown[];
    value?: bigint;
  }) => Promise<unknown>;
  waitForTransactionReceipt?: (args: {
    hash: string;
    status?: string;
    retries?: number;
    interval?: number;
  }) => Promise<unknown>;
  connect?: (chainName: string) => Promise<unknown>;
  initializeConsensusSmartContract?: () => Promise<unknown>;
};

let cachedReadClient: AnyClient | null = null;
let cachedWriteClient: AnyClient | null = null;
let cachedWriteAddress: string | null = null;
let cachedWriteConnected = false;

async function loadGenlayer(): Promise<Record<string, unknown> | null> {
  try {
    const mod = (await import("genlayer-js")) as unknown as Record<string, unknown>;
    return mod;
  } catch {
    return null;
  }
}

async function loadChain(): Promise<unknown> {
  try {
    const mod = (await import("genlayer-js/chains")) as unknown as Record<string, unknown>;
    return (
      mod.studionet ||
      mod.studio ||
      mod.testnetAsimov ||
      mod.localnet ||
      mod.simulator ||
      null
    );
  } catch {
    const root = await loadGenlayer();
    if (!root) return null;
    const chains = (root.chains || root) as Record<string, unknown>;
    return (
      chains.studionet ||
      chains.studio ||
      chains.testnetAsimov ||
      chains.localnet ||
      chains.simulator ||
      null
    );
  }
}

export async function getReadClient(): Promise<AnyClient | null> {
  if (cachedReadClient) return cachedReadClient;
  const mod = await loadGenlayer();
  if (!mod) return null;
  const createClient = mod.createClient as
    | ((args: { chain: unknown }) => AnyClient)
    | undefined;
  if (!createClient) return null;
  try {
    const chain = await loadChain();
    cachedReadClient = createClient({ chain });
    return cachedReadClient;
  } catch (e) {
    console.error("GenLayer read client init failed", e);
    return null;
  }
}

export async function getWriteClient(address?: string): Promise<AnyClient | null> {
  if (typeof window === "undefined") return null;
  const eth = (window as unknown as { ethereum?: unknown }).ethereum;
  if (!eth) return null;
  if (cachedWriteClient && cachedWriteAddress === (address || null)) {
    return cachedWriteClient;
  }
  const mod = await loadGenlayer();
  if (!mod) return null;
  const createClient = mod.createClient as
    | ((args: {
        chain: unknown;
        account?: unknown;
        provider?: unknown;
      }) => AnyClient)
    | undefined;
  if (!createClient) return null;
  try {
    const chain = await loadChain();
    cachedWriteClient = createClient({
      chain,
      account: address,
      provider: eth,
    });
    cachedWriteAddress = address || null;
    cachedWriteConnected = false;
    return cachedWriteClient;
  } catch (e) {
    console.error("GenLayer write client init failed", e);
    return null;
  }
}

async function ensureConnected(client: AnyClient): Promise<void> {
  if (cachedWriteConnected) return;
  if (typeof client.connect === "function") {
    try {
      await client.connect(CHAIN_NAME);
      cachedWriteConnected = true;
      return;
    } catch (e) {
      console.warn("client.connect failed, attempting without explicit connect", e);
    }
  }
  if (typeof client.initializeConsensusSmartContract === "function") {
    try {
      await client.initializeConsensusSmartContract();
    } catch (e) {
      console.warn("initializeConsensusSmartContract failed", e);
    }
  }
  cachedWriteConnected = true;
}

function requireContractAddress(address: string, envName: string): string {
  const clean = address.trim();
  if (!clean) throw new Error(`${envName} is not configured.`);
  return clean;
}

function executionResultName(receipt: unknown): string {
  if (!receipt || typeof receipt !== "object") return "";
  const value = receipt as Record<string, unknown>;
  const consensus = value.consensus_data as Record<string, unknown> | undefined;
  const leaderReceipt = consensus?.leader_receipt;
  let rawLeaderResult = "";
  if (Array.isArray(leaderReceipt) && leaderReceipt.length > 0) {
    const first = leaderReceipt[0];
    if (first && typeof first === "object") {
      rawLeaderResult = String(
        (first as Record<string, unknown>).execution_result || ""
      );
    }
  }
  return String(
    value.txExecutionResultName ??
      value.tx_execution_result_name ??
      value.executionResultName ??
      value.execution_result_name ??
      rawLeaderResult ??
      ""
  ).toUpperCase();
}

function assertSuccessfulFinalizedReceipt(receipt: unknown, hash: string): void {
  const result = executionResultName(receipt);
  if (!result) {
    throw new Error(
      `Transaction ${hash} finalized without an execution-result field. GNS refuses to treat finality alone as success.`
    );
  }
  if (result !== "FINISHED_WITH_RETURN" && result !== "SUCCESS") {
    throw new Error(`Transaction ${hash} finalized with execution result ${result}.`);
  }
}

export async function readViewAt<T = unknown>(
  contractAddress: string,
  functionName: string,
  args: unknown[] = [],
  stateStatus: StateStatus = "accepted"
): Promise<T> {
  const address = requireContractAddress(contractAddress, "Contract address");
  const client = await getReadClient();
  if (!client) throw new Error("GenLayer client unavailable in this environment.");
  const out = await client.readContract({
    address,
    functionName,
    args,
    stateStatus,
  });
  return out as T;
}

export async function readView<T = unknown>(
  functionName: string,
  args: unknown[] = []
): Promise<T> {
  return readViewAt<T>(
    requireContractAddress(
      GNS_CONTRACT_ADDRESS,
      "NEXT_PUBLIC_GNS_CONTRACT_ADDRESS"
    ),
    functionName,
    args,
    "accepted"
  );
}

function getConnectedAddress(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.localStorage.getItem("gns:address") || undefined;
}

export async function writeMethodAt(
  contractAddress: string,
  functionName: string,
  args: unknown[] = [],
  value?: bigint,
  options?: {
    waitStatus?: ReceiptStatus;
    strictWait?: boolean;
    retries?: number;
    interval?: number;
  }
): Promise<unknown> {
  const target = requireContractAddress(contractAddress, "Contract address");
  const address = getConnectedAddress();
  const client = await getWriteClient(address);
  if (!client) throw new Error("Connect an injected wallet to send transactions.");
  await ensureConnected(client);

  const tx = (await client.writeContract({
    address: target,
    functionName,
    args,
    ...(value !== undefined ? { value } : {}),
  })) as { hash?: string } | string;

  const hash = typeof tx === "string" ? tx : tx?.hash;
  if (!hash) {
    throw new Error("GenLayer write returned no transaction hash.");
  }
  if (!client.waitForTransactionReceipt) {
    if (options?.strictWait) {
      throw new Error("GenLayer client cannot confirm transaction finality.");
    }
    return tx;
  }

  try {
    const waitStatus = options?.waitStatus || "ACCEPTED";
    const receipt = await client.waitForTransactionReceipt({
      hash,
      status: waitStatus,
      retries: options?.retries ?? 50,
      interval: options?.interval ?? 3000,
    });
    if (waitStatus === "FINALIZED") {
      assertSuccessfulFinalizedReceipt(receipt, hash);
    }
  } catch (e) {
    if (options?.strictWait) throw e;
    console.warn("waitForTransactionReceipt timed out, failed, or execution reverted", e);
  }
  return tx;
}

export async function writeMethod(
  functionName: string,
  args: unknown[] = [],
  value?: bigint
): Promise<unknown> {
  return writeMethodAt(
    requireContractAddress(
      GNS_CONTRACT_ADDRESS,
      "NEXT_PUBLIC_GNS_CONTRACT_ADDRESS"
    ),
    functionName,
    args,
    value,
    { waitStatus: "ACCEPTED", strictWait: false }
  );
}
