import {
  accountFor,
  loadTestEnv,
  makeClient,
  requireEnv,
} from "./gns-test-utils.mjs";

loadTestEnv();

const contract = requireEnv("NEXT_PUBLIC_GNS_CONTRACT_ADDRESS");
const expectedRouter = requireEnv("NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS").toLowerCase();
const reader = accountFor("DEPLOYER");
const client = makeClient(reader);

async function read(functionName, args = []) {
  return client.readContract({
    address: contract,
    functionName,
    args,
    stateStatus: "finalized",
  });
}

function parse(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw !== "string") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

console.log(`Inspecting GNS v3 registry ${contract}`);
console.log(`Expected Arc router ${expectedRouter}`);

const version = String(await read("contract_version"));
if (version !== "2.1.0-arc-usdc-reservations") {
  throw new Error(`Unexpected registry version: ${version}`);
}

const config = parse(await read("get_arc_payment_config"), null);
if (!config) throw new Error("Arc payment configuration was not returned.");
if (Number(config.chain_id) !== 5_042_002) {
  throw new Error(`Unexpected Arc chain id: ${config.chain_id}`);
}
if (String(config.router || "").toLowerCase() !== expectedRouter) {
  throw new Error(`Registry router mismatch: ${config.router}`);
}
if (!config.deterministic_finality) {
  throw new Error("Registry does not report deterministic Arc finality policy.");
}
if (Number(config.reservation_ttl_seconds) <= 0) {
  throw new Error("Registration reservation TTL is not configured.");
}

console.log(`PASS: version ${version}`);
console.log(`PASS: Arc chain ${config.chain_id}`);
console.log(`PASS: Arc router bound to ${config.router}`);
console.log(`PASS: reservation TTL ${config.reservation_ttl_seconds}s`);
console.log(`Registration pause: ${Boolean(config.registrations_paused)}`);
console.log(`Names: ${Number(await read("get_total_names"))}`);
console.log(`Consumed Arc receipts: ${Number(await read("get_total_payments_consumed"))}`);

const smokeName = String(process.env.GNS_SMOKE_NAME || "").trim().toLowerCase();
if (smokeName) {
  const resolved = parse(await read("resolve", [smokeName]), null);
  if (!resolved?.full_name) throw new Error(`${smokeName} does not resolve on the fresh registry.`);
  console.log(`PASS: ${smokeName} owner ${resolved.owner}`);
  console.log(`PASS: ${smokeName} expires ${resolved.expires_at}`);

  const reservation = parse(await read("get_registration_reservation", [smokeName]), {});
  if (reservation?.namespace) {
    console.log(`INFO: active registration reservation ${JSON.stringify(reservation)}`);
  }
}

const arcTx = String(process.env.GNS_SMOKE_ARC_TX || "").trim();
const arcLog = String(process.env.GNS_SMOKE_ARC_LOG_INDEX || "").trim();
if (arcTx || arcLog) {
  if (!/^0x[0-9a-fA-F]{64}$/.test(arcTx) || !/^\d+$/.test(arcLog)) {
    throw new Error("GNS_SMOKE_ARC_TX and GNS_SMOKE_ARC_LOG_INDEX must be supplied together and be valid.");
  }
  const consumed = Boolean(await read("is_payment_consumed", [arcTx, Number(arcLog)]));
  if (!consumed) throw new Error(`Arc receipt ${arcTx}:${arcLog} has not been consumed.`);
  const payment = parse(await read("get_consumed_payment", [arcTx, Number(arcLog)]), null);
  console.log(`PASS: Arc receipt consumed exactly as registry state: ${JSON.stringify(payment)}`);
}

console.log("GNS v3 deployment inspection completed successfully.");
