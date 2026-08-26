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

const tx = await client.deployContract({
  account: deployer,
  code,
  args: [registry],
});
const receipt = await waitFinalized(client, tx, "deploy authenticity");
const address = findAddressDeep(receipt) || findAddressDeep(tx);

if (!address) {
  console.log(JSON.stringify({ tx, receipt }, null, 2));
  throw new Error(
    "Deployment finalized but the authenticity contract address was not found in the SDK response."
  );
}

updateLocalAuthenticityAddress(address);
console.log(`GNS authenticity deployed and finalized: ${address}`);
console.log("Updated .env.local NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS");
