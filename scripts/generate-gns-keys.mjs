import fs from "node:fs";
import path from "node:path";
import { createAccount, generatePrivateKey } from "genlayer-js";

const roles = ["DEPLOYER", "TEST_ALICE", "TEST_BUILDER", "TEST_REPORTER"];
const out = path.join(process.cwd(), ".env.test-wallets.local");

if (fs.existsSync(out) && process.env.GNS_OVERWRITE_KEYS !== "1") {
  throw new Error(`${out} already exists. Set GNS_OVERWRITE_KEYS=1 to replace these disposable test wallets.`);
}

const lines = ["# Disposable Studionet test wallets for GNS. Do not commit or fund with mainnet assets."];
const wallets = [];

for (const role of roles) {
  const privateKey = generatePrivateKey();
  const account = createAccount(privateKey);
  lines.push(`${role}_PRIVATE_KEY=${privateKey}`);
  lines.push(`${role}_ADDRESS=${account.address}`);
  wallets.push({ role, address: account.address });
}

fs.writeFileSync(out, lines.join("\n") + "\n", { encoding: "utf8", mode: 0o600 });
console.log(JSON.stringify({ file: out, wallets }, null, 2));
