import fs from "node:fs";
import path from "node:path";
import {
  accountFor,
  findAddressDeep,
  loadTestEnv,
  makeClient,
  requireEnv,
  updateLocalContractAddress,
  waitFinalized,
} from "./gns-test-utils.mjs";

loadTestEnv();

const deployer = accountFor("DEPLOYER");
const client = makeClient(deployer);
const code = fs.readFileSync(path.join(process.cwd(), "contracts", "GNSRegistry.py"), "utf8");
const arcRouter = requireEnv("NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS");

console.log(`Deploying GNSRegistry with ${deployer.address}`);
console.log(`Binding immutable Arc payment router ${arcRouter}`);
const tx = await client.deployContract({ account: deployer, code, args: [arcRouter] });
const receipt = await waitFinalized(client, tx, "GNSRegistry deploy");
const canonicalAddress =
  receipt?.data?.contract_address ||
  receipt?.data?.contractAddress ||
  receipt?.contractAddress ||
  "";
const address = canonicalAddress || findAddressDeep(receipt) || findAddressDeep(tx);

if (!address) {
  console.log(JSON.stringify({ tx, receipt }, null, 2));
  throw new Error("Deployment finalized but the registry address was not found in the SDK response.");
}

updateLocalContractAddress(address);
console.log(`GNSRegistry v3 deployed: ${address}`);
console.log("Updated .env.local NEXT_PUBLIC_GNS_CONTRACT_ADDRESS");
console.log("Next: deploy GNSAuthenticity against this fresh registry with npm run deploy:authenticity.");
