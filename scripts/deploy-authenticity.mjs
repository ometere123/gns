import fs from "node:fs";
import path from "node:path";
import {
  accountFor,
  findAddressDeep,
  loadTestEnv,
  makeClient,
  requireEnv,
  updateLocalAuthenticityAddress,
  waitFinalized,
} from "./gns-test-utils.mjs";

loadTestEnv();

const deployer = accountFor("DEPLOYER");
const registry = requireEnv("NEXT_PUBLIC_GNS_CONTRACT_ADDRESS");
const client = makeClient(deployer);
const code = fs.readFileSync(
  path.join(process.cwd(), "contracts", "GNSAuthenticity.py"),
  "utf8"
);

console.log(`Deploying GNSAuthenticity with ${deployer.address}`);
console.log(`Registry dependency: ${registry}`);

if (typeof client.initializeConsensusSmartContract === "function") {
  await client.initializeConsensusSmartContract();
}

const tx = await client.deployContract({
  account: deployer,
  code,
  args: [registry],
});
const receipt = await waitFinalized(client, tx, "deploy authenticity");

// On Studionet the canonical deployment address is receipt.data.contract_address.
// Keep the recursive finder only as a compatibility fallback for older SDK shapes.
const canonicalAddress =
  receipt?.data?.contract_address ||
  receipt?.data?.contractAddress ||
  receipt?.contractAddress ||
  "";
const address = canonicalAddress || findAddressDeep(receipt) || findAddressDeep(tx);

if (!address || !/^0x[a-fA-F0-9]{40}$/.test(String(address))) {
  console.log(JSON.stringify({ tx, receipt }, null, 2));
  throw new Error(
    "Deployment finalized successfully but the authenticity contract address could not be identified safely."
  );
}

updateLocalAuthenticityAddress(String(address));
console.log(`GNS authenticity deployed and finalized: ${address}`);
console.log("Updated .env.local NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS");
