import fs from "node:fs";
import path from "node:path";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

const ROOT = process.cwd();
const TEST_ENV = path.join(ROOT, ".env.test-wallets.local");
const LOCAL_ENV = path.join(ROOT, ".env.local");

export function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  const raw = fs.readFileSync(file, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

export function loadTestEnv() {
  loadEnvFile(LOCAL_ENV);
  loadEnvFile(TEST_ENV);
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Check ${TEST_ENV}`);
  return value;
}

export function accountFor(role) {
  return createAccount(requireEnv(`${role}_PRIVATE_KEY`));
}

export function makeClient(account) {
  return createClient({ chain: studionet, account });
}

export async function waitAccepted(client, tx, label) {
  const hash = typeof tx === "string" ? tx : tx?.hash;
  if (!hash) return tx;
  console.log(`${label}: ${hash}`);
  if (typeof client.waitForTransactionReceipt !== "function") return tx;
  const receipt = await client.waitForTransactionReceipt({
    hash,
    status: "ACCEPTED",
    retries: 80,
    interval: 3000,
  });
  return receipt;
}

export function findAddressDeep(value) {
  if (!value) return "";
  if (typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value)) return value;
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findAddressDeep(item);
      if (found) return found;
    }
  }
  if (typeof value === "object") {
    for (const key of ["contractAddress", "address", "createdContractAddress", "recipient"]) {
      const found = findAddressDeep(value[key]);
      if (found) return found;
    }
    for (const item of Object.values(value)) {
      const found = findAddressDeep(item);
      if (found) return found;
    }
  }
  return "";
}

export function updateLocalContractAddress(address) {
  let raw = fs.existsSync(LOCAL_ENV) ? fs.readFileSync(LOCAL_ENV, "utf8") : "";
  const line = `NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=${address}`;
  if (/^NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=.*$/m.test(raw)) {
    raw = raw.replace(/^NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=.*$/m, line);
  } else {
    raw += `${raw.endsWith("\n") || raw.length === 0 ? "" : "\n"}${line}\n`;
  }
  fs.writeFileSync(LOCAL_ENV, raw);
}

export function genToWei(gen) {
  const [whole, frac = ""] = String(gen).split(".");
  const fracPadded = (frac + "0".repeat(18)).slice(0, 18);
  return BigInt(whole || "0") * 10n ** 18n + BigInt(fracPadded || "0");
}

export function uniqueLabel(prefix) {
  const stamp = Date.now().toString(36).slice(-7);
  return `${prefix}${stamp}`.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32);
}
