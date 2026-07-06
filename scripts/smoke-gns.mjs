import { accountFor, genToWei, loadTestEnv, makeClient, requireEnv, uniqueLabel, waitAccepted } from "./gns-test-utils.mjs";

loadTestEnv();

const contract = requireEnv("NEXT_PUBLIC_GNS_CONTRACT_ADDRESS");
const deployer = accountFor("DEPLOYER");
const alice = accountFor("TEST_ALICE");
const builder = accountFor("TEST_BUILDER");
const reporter = accountFor("TEST_REPORTER");

const readClient = makeClient(deployer);
const adminClient = makeClient(deployer);
const aliceClient = makeClient(alice);
const builderClient = makeClient(builder);
const reporterClient = makeClient(reporter);

async function read(functionName, args = []) {
  return readClient.readContract({ address: contract, functionName, args, stateStatus: "accepted" });
}

async function write(client, account, label, functionName, args = [], value) {
  const tx = await client.writeContract({
    account,
    address: contract,
    functionName,
    args,
    ...(value !== undefined ? { value } : {}),
  });
  return waitAccepted(client, tx, label);
}

function parse(raw, fallback) {
  if (!raw) return fallback;
  if (typeof raw !== "string") return raw;
  try { return JSON.parse(raw); } catch { return fallback; }
}

const aliceLabel = process.env.GNS_ALICE_LABEL || "papito";
const builderLabel = process.env.GNS_BUILDER_LABEL || "meritra";
const aliceName = `${aliceLabel}.gen`;
const subLabel = "agent";
const subName = `${subLabel}.${aliceName}`;

const identities = {
  alice: {
    name: aliceName,
    owner: alice.address,
    records: {
      website: "https://papito.xyz",
      x: "@papito_dele",
      github: "https://github.com/ometere123",
      discord: "papito#0420",
      email: "hello@papito.xyz",
      contract: "0x0000000000000000000000000000000000000001",
      agent: `https://agents.papito.xyz/${aliceLabel}`,
      description: "Papito identity record for Omodamola Papito Adeleke, wallet routing, agent discovery, and GenLayer app operations.",
    },
  },
  builder: {
    name: `${builderLabel}.gen`,
    owner: builder.address,
    records: {
      website: "https://github.com/ometere123/meritra",
      x: "@papito_dele",
      github: "https://github.com/ometere123/meritra",
      description: "Meritra project identity for trustless AI-consensus research grant review on GenLayer.",
    },
  },
};

console.log(`Testing GNS contract ${contract}`);
console.log(`Admin/deployer ${deployer.address}`);
console.log(`Alice ${alice.address}`);
console.log(`Builder ${builder.address}`);
console.log(`Reporter ${reporter.address}`);

const version = await read("contract_version");
console.log(`contract_version: ${version}`);

const price = BigInt(String(await read("quote_registration", [1])));
console.log(`one-year price: ${price} wei`);

await write(aliceClient, alice, "register alice", "register", [aliceLabel, 1, alice.address], price);
await write(aliceClient, alice, "set alice records", "set_records", [aliceName, JSON.stringify(identities.alice.records)]);
await write(aliceClient, alice, "set alice primary", "set_primary_name", [aliceName]);
await write(aliceClient, alice, "create agent subname", "create_subname", [aliceName, subLabel, alice.address]);
await write(aliceClient, alice, "transfer subname", "transfer_subname", [subName, builder.address]);

await write(builderClient, builder, "register builder", "register", [builderLabel, 1, builder.address], price);
await write(builderClient, builder, "set builder records", "set_records", [identities.builder.name, JSON.stringify(identities.builder.records)]);

await write(aliceClient, alice, "fetch papito pinned evidence", "verify_name_url", [aliceName, "evidence", "https://raw.githubusercontent.com/ometere123/meritra/08527711b26788c4224aacf2b28bfbb1d7208ab0/README.md"]);
await write(builderClient, builder, "fetch meritra pinned evidence", "verify_name_url", [identities.builder.name, "evidence", "https://raw.githubusercontent.com/ometere123/meritra/08527711b26788c4224aacf2b28bfbb1d7208ab0/README.md"]);

await write(reporterClient, reporter, "report suspicious test", "report_name", [identities.builder.name, "brand_misuse", "https://github.com/ometere123/meritra", "Realistic dispute intake test: reporter asks GNS to verify that the BountyLens name is controlled by the project owner."]);
await write(adminClient, deployer, "admin review report", "admin_set_report_status", ["1", "reviewed"]);

const aliceResolved = parse(await read("resolve", [aliceName]), null);
const subResolved = parse(await read("resolve", [subName]), null);
const builderResolved = parse(await read("resolve", [identities.builder.name]), null);
const reverseAlice = await read("reverse_lookup", [alice.address]);
const aliceOwnerNames = parse(await read("get_names_by_owner", [alice.address]), []);
const builderOwnerNames = parse(await read("get_names_by_owner", [builder.address]), []);
const subnames = parse(await read("get_subnames", [aliceName]), []);
const report = parse(await read("get_report", ["1"]), null);
const totalEvidence = Number(await read("get_total_evidence"));
const firstEvidence = parse(await read("get_web_evidence", ["1"]), null);

const checks = [
  ["alice resolved", aliceResolved?.owner?.toLowerCase() === alice.address.toLowerCase()],
  ["alice website record", aliceResolved?.records?.website === identities.alice.records.website],
  ["reverse lookup", reverseAlice === aliceName],
  ["subname exists", subResolved?.full_name === subName],
  ["subname transferred", subResolved?.owner?.toLowerCase() === builder.address.toLowerCase()],
  ["builder resolved", builderResolved?.owner?.toLowerCase() === builder.address.toLowerCase()],
  ["alice owner names", aliceOwnerNames.includes(aliceName)],
  ["builder owner names include builder root", builderOwnerNames.includes(identities.builder.name)],
  ["builder owner names include transferred subname", builderOwnerNames.includes(subName)],
  ["parent subnames", subnames.includes(subName)],
  ["report reviewed", report?.status === "reviewed"],
  ["web evidence stored", totalEvidence >= 2],
  ["web evidence fetched", firstEvidence?.consensus_method === "strict_eq_web_request" && firstEvidence?.status === "VERIFIED"],
];

const failed = checks.filter(([, ok]) => !ok);
for (const [name, ok] of checks) console.log(`${ok ? "PASS" : "FAIL"}: ${name}`);

if (process.env.GNS_RUN_AI === "1") {
  console.log("Running comparative AI review checks. This may be slow and cost test GEN.");
  const reviewsBefore = Number(await read("get_total_reviews"));
  await write(reporterClient, reporter, "ai review name", "ai_review_name", [identities.builder.name, "This name is claimed as the Meritra project identity for GenLayer bounty and agent workflows.", "https://github.com/ometere123/meritra", "The claim should be evaluated against the website, GitHub, wallet owner, and profile records supplied for this GNS deployment test."]);
  await write(reporterClient, reporter, "ai review report", "ai_review_report", ["1"]);
  await write(builderClient, builder, "ai verify project", "ai_verify_project_claim", [identities.builder.name, "Meritra", "https://github.com/ometere123/meritra", "@papito_dele", "https://github.com/ometere123/meritra", "Meritra is being verified as a GenLayer project identity controlled by the deploying team."]);
  const totalReviews = Number(await read("get_total_reviews"));
  console.log(`total AI reviews: ${totalReviews}`);
  if (totalReviews < reviewsBefore + 3) {
    throw new Error(`AI review count did not increase by 3: before=${reviewsBefore}, after=${totalReviews}`);
  }
  const latestReview = parse(await read("get_ai_review", [String(totalReviews)]), null);
  if (latestReview?.consensus_method !== "prompt_comparative") {
    throw new Error("Latest AI review was not stored with prompt_comparative consensus metadata.");
  }
}

if (failed.length) {
  throw new Error(`Smoke test failed: ${failed.map(([name]) => name).join(", ")}`);
}

console.log("GNS smoke test completed successfully.");







