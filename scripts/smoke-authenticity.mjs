import {
  accountFor,
  loadTestEnv,
  makeClient,
  requireEnv,
  waitFinalized,
} from "./gns-test-utils.mjs";

loadTestEnv();

const registry = requireEnv("NEXT_PUBLIC_GNS_CONTRACT_ADDRESS");
const authenticity = requireEnv("NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS");
const role = process.env.GNS_AUTH_ROLE || "TEST_ALICE";
const account = accountFor(role);
const client = makeClient(account);
const mode = (process.env.GNS_AUTH_SMOKE_MODE || "inspect").toLowerCase();

function parse(raw, fallback = null) {
  if (raw == null) return fallback;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(String(raw));
  } catch {
    return fallback;
  }
}

async function read(address, functionName, args = []) {
  return client.readContract({
    address,
    functionName,
    args,
    stateStatus: "finalized",
  });
}

async function write(functionName, args = []) {
  const tx = await client.writeContract({
    account,
    address: authenticity,
    functionName,
    args,
  });
  return waitFinalized(client, tx, functionName);
}

function buildAttestation(claim) {
  const issuedAt = Math.floor(Date.now() / 1000);
  const ttl = Math.min(
    Math.max(Number(process.env.GNS_AUTH_ATTESTATION_TTL || 3600), 60),
    7 * 24 * 60 * 60
  );
  return {
    protocol: "gns-claim-v2",
    namespace: claim.namespace,
    wallet: String(claim.owner).toLowerCase(),
    registry: registry.toLowerCase(),
    authenticity_contract: authenticity.toLowerCase(),
    claim_id: String(claim.id),
    challenge: String(claim.challenge),
    policy_version: String(claim.policy_version),
    issued_at: issuedAt,
    expires_at: issuedAt + ttl,
  };
}

async function inspect() {
  const version = await read(authenticity, "contract_version");
  const configuredRegistry = await read(authenticity, "get_registry_address");
  const policy = await read(authenticity, "get_policy_version");

  console.log(`authenticity contract: ${authenticity}`);
  console.log(`contract_version: ${version}`);
  console.log(`registry: ${configuredRegistry}`);
  console.log(`policy: ${policy}`);
  console.log(`caller role: ${role} (${account.address})`);

  if (String(configuredRegistry).toLowerCase() !== registry.toLowerCase()) {
    throw new Error(
      `Authenticity registry mismatch: contract=${configuredRegistry}, env=${registry}`
    );
  }

  const name = process.env.GNS_AUTH_NAME;
  if (name) {
    const registryState = parse(await read(registry, "resolve", [name]), {});
    const claim = parse(await read(authenticity, "get_namespace_claim", [name]), {});
    const verification = parse(
      await read(authenticity, "get_namespace_verification", [name]),
      {}
    );
    console.log("registry namespace:", JSON.stringify(registryState, null, 2));
    console.log("latest claim:", JSON.stringify(claim, null, 2));
    console.log("verification:", JSON.stringify(verification, null, 2));
  }
}

async function createClaim() {
  const name = requireEnv("GNS_AUTH_NAME");
  const attestationUrl = requireEnv("GNS_AUTH_ATTESTATION_URL");
  const corroborating = process.env.GNS_AUTH_CORROBORATING_URL || "";
  const claimType = process.env.GNS_AUTH_CLAIM_TYPE || "project";
  const context = process.env.GNS_AUTH_CONTEXT || "Authenticity lifecycle smoke claim.";

  const registryState = parse(await read(registry, "resolve", [name]), null);
  if (!registryState?.owner) {
    throw new Error(`Registry namespace ${name} was not found.`);
  }
  if (String(registryState.owner).toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `${role} is not the current registry owner. owner=${registryState.owner}, caller=${account.address}`
    );
  }

  const manifest = [
    { type: "attestation", url: attestationUrl },
    ...(corroborating && corroborating !== attestationUrl
      ? [{ type: "other", url: corroborating }]
      : []),
  ];

  await write("create_claim", [name, claimType, JSON.stringify(manifest), context]);
  const claim = parse(await read(authenticity, "get_namespace_claim", [name]), null);
  if (!claim?.id) throw new Error("Claim finalized but could not be read back.");

  console.log(`claim created: #${claim.id} (${claim.status})`);
  console.log(`publish at: ${attestationUrl}`);
  console.log("\nExact wallet-bound attestation JSON:\n");
  console.log(JSON.stringify(buildAttestation(claim), null, 2));
  console.log(
    "\nAfter publishing that JSON at the claim's attestation URL, run with GNS_AUTH_SMOKE_MODE=verify and GNS_AUTH_CLAIM_ID=" +
      claim.id
  );
}

async function verifyClaim() {
  const claimId = requireEnv("GNS_AUTH_CLAIM_ID");
  const before = parse(await read(authenticity, "get_claim", [claimId]), null);
  if (!before?.id) throw new Error(`Claim ${claimId} does not exist.`);
  if (String(before.owner).toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(`Only claim wallet ${before.owner} can request positive verification.`);
  }

  await write("verify_claim", [claimId]);
  const claim = parse(await read(authenticity, "get_claim", [claimId]), null);
  if (!claim?.verdict_id) throw new Error("Verification finalized without a verdict id.");
  const verdict = parse(
    await read(authenticity, "get_verdict", [claim.verdict_id]),
    null
  );
  if (!verdict?.id) throw new Error("Finalized verdict could not be read back.");

  console.log("claim:", JSON.stringify(claim, null, 2));
  console.log("verdict:", JSON.stringify(verdict, null, 2));
  console.log(
    "namespace verification:",
    String(await read(authenticity, "get_namespace_verification", [claim.namespace]))
  );
}

async function createChallenge() {
  const claimId = requireEnv("GNS_AUTH_CLAIM_ID");
  const evidenceUrl = requireEnv("GNS_AUTH_CHALLENGE_EVIDENCE_URL");
  const second = process.env.GNS_AUTH_CHALLENGE_EVIDENCE_URL_2 || "";
  const reason = process.env.GNS_AUTH_CHALLENGE_REASON || "CONTRADICTORY_EVIDENCE";
  const context = process.env.GNS_AUTH_CHALLENGE_CONTEXT || "Authenticity challenge smoke flow.";
  const manifest = [
    { type: "other", url: evidenceUrl },
    ...(second && second !== evidenceUrl ? [{ type: "other", url: second }] : []),
  ];

  await write("challenge_claim", [claimId, reason, JSON.stringify(manifest), context]);
  const claim = parse(await read(authenticity, "get_claim", [claimId]), null);
  if (!claim?.active_challenge_id) {
    throw new Error("Challenge finalized without an active challenge id.");
  }
  const challenge = parse(
    await read(authenticity, "get_challenge", [claim.active_challenge_id]),
    null
  );
  console.log("challenge:", JSON.stringify(challenge, null, 2));
  console.log(
    `Resolve with GNS_AUTH_SMOKE_MODE=resolve and GNS_AUTH_CHALLENGE_ID=${claim.active_challenge_id}`
  );
}

async function resolveChallenge() {
  const challengeId = requireEnv("GNS_AUTH_CHALLENGE_ID");
  await write("resolve_challenge", [challengeId]);
  const challenge = parse(
    await read(authenticity, "get_challenge", [challengeId]),
    null
  );
  if (!challenge?.verdict_id) {
    throw new Error("Challenge finalized without a verdict id.");
  }
  const verdict = parse(
    await read(authenticity, "get_verdict", [challenge.verdict_id]),
    null
  );
  console.log("challenge:", JSON.stringify(challenge, null, 2));
  console.log("verdict:", JSON.stringify(verdict, null, 2));
}

switch (mode) {
  case "inspect":
    await inspect();
    break;
  case "create":
    await createClaim();
    break;
  case "verify":
    await verifyClaim();
    break;
  case "challenge":
    await createChallenge();
    break;
  case "resolve":
    await resolveChallenge();
    break;
  default:
    throw new Error(
      `Unknown GNS_AUTH_SMOKE_MODE=${mode}. Use inspect, create, verify, challenge, or resolve.`
    );
}
