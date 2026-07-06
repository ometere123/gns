import fs from "node:fs";
import path from "node:path";
import { accountFor, findAddressDeep, loadTestEnv, makeClient, updateLocalContractAddress, waitAccepted } from "./gns-test-utils.mjs";

loadTestEnv();

const deployer = accountFor("DEPLOYER");
const client = makeClient(deployer);
const code = fs.readFileSync(path.join(process.cwd(), "contracts", "GNSRegistry.py"), "utf8");

console.log(`Deploying GNSRegistry with ${deployer.address}`);
const tx = await client.deployContract({ account: deployer, code, args: [] });
const receipt = await waitAccepted(client, tx, "deploy");
const address = findAddressDeep(receipt) || findAddressDeep(tx);

if (!address) {
  console.log(JSON.stringify({ tx, receipt }, null, 2));
  throw new Error("Deployment accepted but contract address was not found in the SDK response. Copy it from Studio/explorer and update .env.local manually.");
}

updateLocalContractAddress(address);
console.log(`GNS deployed: ${address}`);
console.log("Updated .env.local NEXT_PUBLIC_GNS_CONTRACT_ADDRESS");
