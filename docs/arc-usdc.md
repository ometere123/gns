# Arc USDC deployment and lifecycle

This document is the operational runbook for GNS v3. It intentionally avoids embedding any private key in commands, files or repository history.

## Network

Arc Testnet:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Test USDC ERC-20: `0x3600000000000000000000000000000000000000`
- USDC ERC-20 decimals: `6`
- Arc native gas asset: USDC

GNS router event topic:

`PaymentRecorded(address,bytes32,uint8,uint16,uint256)`

`0x16246dce28fe193971c235293f898fe6af15aa3539719b24d894793343162838`

## 1. Validate exact source

```bash
forge fmt --check
forge build --sizes
forge test -vvv

genvm-lint check contracts/GNSRegistry.py
genvm-lint check contracts/GNSAuthenticity.py
python -m py_compile contracts/GNSRegistry.py contracts/GNSAuthenticity.py
pytest tests/direct -v
npm ci
npm audit --audit-level=high
npm run build
```

Record the exact git SHA before deployment.

## 2. Prepare a controlled Arc account

Prefer an encrypted local Foundry keystore instead of a raw private key in shell history.

```bash
cast wallet import gns-arc-deployer --interactive
```

Confirm the address and fund it with Arc Testnet USDC. Because Arc uses USDC for gas, no second native test token is required for Arc transactions.

The initial Arc admin and treasury may be the same controlled wallet for testnet. Production should separate them and should normally use team-controlled multisigs.

## 3. Choose test pricing

The constructor accepts 6-decimal USDC base units.

Example test configuration:

- registration: `5 USDC/year` → `5000000`
- renewal: `3 USDC/year` → `3000000`

Pricing is mutable by the Arc admin after deployment, but a receipt already produced by the configured router remains redeemable once even if prices later change.

## 4. Deploy Arc router

Set convenience shell variables without putting secrets in them:

```bash
export ARC_RPC_URL=https://rpc.testnet.arc.network
export ARC_USDC=0x3600000000000000000000000000000000000000
export ARC_ADMIN=<controlled-address>
export ARC_TREASURY=<controlled-address-or-team-treasury>
```

Deploy using the encrypted Foundry account:

```bash
forge create evm/GNSPaymentRouter.sol:GNSPaymentRouter \
  --rpc-url "$ARC_RPC_URL" \
  --account gns-arc-deployer \
  --broadcast \
  --constructor-args \
    "$ARC_USDC" \
    "$ARC_ADMIN" \
    "$ARC_TREASURY" \
    5000000 \
    3000000
```

Record:

- router address;
- deployment transaction hash;
- deployer;
- admin;
- treasury;
- constructor prices;
- exact source git SHA.

Do not proceed if deployed bytecode/source does not correspond to the reviewed commit.

## 5. Configure local v3 environment

```bash
NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS=<deployed-router>
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app
NEXT_PUBLIC_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Keep those in `.env.local`. Public contract addresses are safe to publish later; private credentials are not.

## 6. Deploy fresh GenLayer registry

The registry constructor permanently binds the Arc router address. This prevents an admin from later redirecting payment verification to an arbitrary router.

Use the existing controlled GenLayer deployment account from the encrypted/local development environment.

```bash
npm run deploy:gns
```

The script:

- reads `NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS`;
- deploys `contracts/GNSRegistry.py` with that constructor argument;
- waits for `FINALIZED`;
- requires successful execution;
- writes the resulting public registry address to `.env.local`.

Record registry deploy tx and contract address.

## 7. Deploy fresh authenticity contract

```bash
npm run deploy:authenticity
```

It must point at the new v3 registry, not the historical v2 registry.

Record authenticity deploy tx/address and confirm `policy_version == gns-auth-v2`.

## 8. Arc registration smoke test

Use the frontend or direct router calls.

Expected frontend sequence:

1. connect namespace-owner wallet;
2. select namespace + duration;
3. switch to Arc;
4. approve router allowance if necessary;
5. `payRegistration(namespace, years)`;
6. wait for successful Arc receipt;
7. capture `PaymentRecorded` log index;
8. switch to GenLayer;
9. call registry `register(label, years, primaryAddress, arcTxHash, arcLogIndex)`;
10. wait for GenLayer `FINALIZED` + successful execution;
11. confirm `is_payment_consumed(txHash, logIndex) == true`;
12. confirm `resolve(namespace)` returns the expected owner.

Security assertions:

- a second use of the same `(txHash, logIndex)` must fail;
- wrong GenLayer sender must fail because payer must match;
- wrong namespace must fail;
- wrong duration/action must fail;
- failed Arc tx must fail;
- a receipt from any other router must fail;
- a fabricated log must never be accepted because validators fetch the Arc receipt themselves.

## 9. Renewal smoke test

Repeat using `payRenewal(namespace, years)` and registry `renew(...)`.

Confirm:

- ownership gate still applies;
- Arc payer matches GenLayer sender;
- receipt is one-time;
- expiry extends only after finalized receipt verification.

## 10. Treasury controls

Only the configured Arc treasury can call:

- `withdraw(amount)`;
- `withdrawAll()`.

Confirm non-treasury calls revert.

Treasury handover:

1. Arc admin calls `proposeTreasury(newTreasury)`;
2. current treasury remains active;
3. proposed address calls `acceptTreasury()`;
4. only then is the role changed.

Admin handover follows the same two-step pattern with `proposeAdmin()` / `acceptAdmin()`.

## 11. Authenticity lifecycle

After a fresh namespace is registered under a wallet the team controls:

1. set truthful namespace records;
2. set a public GitHub repository as the registered GitHub source if no controlled domain exists;
3. create authenticity claim;
4. publish exact claim-bound `gns-claim.json` after obtaining the real claim ID/nonce;
5. verify anonymous raw retrieval;
6. call `verify_claim()`;
7. require finalized successful execution;
8. run a benign controlled challenge;
9. verify opening the challenge does not erase authoritative VERIFIED status;
10. resolve challenge and record the final verdict.

Do not use an unowned domain as evidence. Do not make a private repository public merely to manufacture proof.

## 12. Final evidence record

Before merge/submission, add an observed deployment record containing:

- final git SHA;
- Arc router address + deployment tx;
- Arc USDC address;
- Arc admin + treasury;
- new GenLayer registry address + deployment tx;
- new authenticity address + deployment tx;
- registration Arc tx + event log index;
- registration GenLayer tx;
- namespace + owner;
- consumed receipt proof;
- GitHub attestation URL;
- authenticity claim ID/tx;
- verification verdict/tx;
- challenge ID/tx;
- resolution verdict/tx;
- final CI run.

Never fabricate missing proof. Keep the deployment record explicitly pending until each item is observed.
