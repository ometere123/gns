# Arc USDC deployment and lifecycle

This is the operational runbook for GNS v3. Never place a private key, seed phrase or keystore password in repository history or shell examples.

## Network

Arc Testnet:

- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.network`
- Explorer: `https://testnet.arcscan.app`
- Test USDC ERC-20: `0x3600000000000000000000000000000000000000`
- USDC ERC-20 decimals: `6`
- Native gas asset: USDC
- Native representation: 18-decimal internal precision
- Finality: deterministic BFT finality; one committed block is final

GNS router event:

`PaymentRecorded(address,bytes32,uint8,uint16,uint256)`

Topic:

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

Record the exact git SHA before deployment. If contract source changes later, redeploy; an older address cannot prove the newer source.

## 2. Prepare a controlled Arc account

Prefer an encrypted local Foundry keystore instead of a raw key in shell history:

```bash
cast wallet import gns-arc-deployer --interactive
```

Fund the account with Arc Testnet USDC. Arc uses USDC for gas, so a separate volatile native token is not required.

The initial Arc admin and treasury may be the same controlled wallet for a testnet deployment. Production should normally separate them and use team-controlled multisigs.

## 3. Choose test pricing

The router constructor accepts 6-decimal ERC-20 USDC base units.

Example:

- registration: `5 USDC/year` → `5000000`
- renewal: `3 USDC/year` → `3000000`

Pricing is mutable by Arc admin. A receipt already emitted by the configured router remains redeemable once if pricing changes after the payment; GenLayer verifies the immutable receipt rather than retroactively repricing the user.

## 4. Deploy the Arc router

```bash
export ARC_RPC_URL=https://rpc.testnet.arc.network
export ARC_USDC=0x3600000000000000000000000000000000000000
export ARC_ADMIN=<controlled-address>
export ARC_TREASURY=<controlled-address-or-team-treasury>
```

Deploy with the encrypted Foundry account:

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

Record router address, deployment tx, deployer, admin, treasury, prices and exact source SHA.

## 5. Configure v3 locally

```bash
NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS=<deployed-router>
NEXT_PUBLIC_ARC_RPC_URL=https://rpc.testnet.arc.network
NEXT_PUBLIC_ARC_EXPLORER_URL=https://testnet.arcscan.app
NEXT_PUBLIC_ARC_USDC_ADDRESS=0x3600000000000000000000000000000000000000
```

Keep these in `.env.local`. Public contract addresses may be published; private credentials may not.

## 6. Deploy the fresh GenLayer registry

The registry constructor permanently binds the Arc router address.

```bash
npm run deploy:gns
```

The script must:

- read `NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS`;
- deploy `contracts/GNSRegistry.py` with that constructor argument;
- wait for `FINALIZED`;
- require successful execution;
- record the resulting public registry address locally.

Verify `contract_version()` returns `2.1.1-arc-usdc-reservations` and `get_arc_payment_config()` reports the exact Arc router.

## 7. Deploy fresh authenticity

```bash
npm run deploy:authenticity
```

It must bind the new v3 registry, not a historical v2 registry. Confirm policy `gns-auth-v2` and record deployment tx/address.

## 8. Registration smoke test

The safe registration order is deliberately **GenLayer first, then Arc, then GenLayer again**:

1. connect the wallet that will own the namespace;
2. choose canonical `.gen` namespace, duration and primary address;
3. call `reserve_registration(label, years, primaryAddress)` on GenLayer;
4. wait for GenLayer `FINALIZED` + successful execution;
5. read `get_registration_reservation(namespace)` and confirm wallet, years and primary address all match;
6. switch to Arc;
7. approve the router's exact USDC requirement if allowance is insufficient;
8. call `payRegistration(namespace, years)`;
9. wait for the successful Arc receipt;
10. capture the `PaymentRecorded` log index;
11. switch back to GenLayer;
12. call `register(label, years, primaryAddress, arcTxHash, arcLogIndex)`;
13. wait for GenLayer `FINALIZED` + successful execution;
14. confirm `is_payment_consumed(txHash, logIndex) == true`;
15. confirm `get_registration_reservation(namespace) == {}`;
16. confirm `resolve(namespace)` returns the expected owner.

The reservation has a short TTL and is bound to wallet + namespace + duration + primary address. Arc payment must stay disabled when the reservation is missing, expired or does not match the chosen terms.

Security assertions:

- another wallet cannot reserve the same name while an active reservation exists;
- changing reservation terms requires cancellation/re-reservation;
- registration without a matching active reservation must fail;
- a second use of the same `(txHash, logIndex)` must fail;
- wrong GenLayer sender must fail because Arc payer must match;
- wrong namespace, duration or action must fail;
- failed Arc tx must fail;
- receipt/log from another router must fail;
- fabricated browser data must not work because validators fetch the Arc receipt themselves;
- expired owners cannot mutate expired namespaces;
- stale reverse records must not resolve as active ownership.

Arc has deterministic BFT finality and no reorgs after a committed block. The GenLayer consensus path therefore compares stable receipt data only; it must not compare a moving `eth_blockNumber` value between validators.

## 9. Renewal smoke test

Renewal does not create new ownership. The current GenLayer owner pays `payRenewal(namespace, years)` on Arc, then calls registry `renew(...)` with the receipt reference.

Confirm:

- ownership gate applies;
- Arc payer matches GenLayer sender;
- receipt is one-time;
- expiry changes only after finalized GenLayer receipt verification.

## 10. Treasury/admin controls

Only Arc treasury may call `withdraw(amount)` or `withdrawAll()`.

Treasury handover:

1. Arc admin calls `proposeTreasury(newTreasury)`;
2. current treasury remains active;
3. proposed address calls `acceptTreasury()`;
4. only then does the role change.

Arc admin transfer is also two-step. GenLayer registry admin transfer is separate and two-step. None of these roles can manufacture an authenticity verdict.

## 11. Authenticity lifecycle

After a fresh namespace is registered under a controlled wallet:

1. set truthful namespace records;
2. use a public evidence source the owner actually controls, preferably a public GitHub repository if no controlled domain exists;
3. create authenticity claim;
4. publish the exact claim-bound `gns-claim.json` only after the real claim ID/nonce exists;
5. verify anonymous retrieval;
6. call `verify_claim()` and require finalized successful execution;
7. run a benign controlled challenge;
8. confirm opening a challenge does not erase authoritative VERIFIED state;
9. resolve it and record the resulting verdict.

Do not use an unowned domain and do not expose a private repository merely to manufacture proof.

## 12. Validated source state

Current local pre-deployment validation:

- GenVM lint: passed for registry and authenticity;
- Direct Mode: `37/37`;
- Solidity build: passed;
- router runtime: `5,713 bytes`;
- Foundry: `17/17`;
- npm audit: `0 vulnerabilities`;
- Next.js 15.5.24 production build: passed.

No fresh live deployment or CI run is claimed here until the deployment wallet is configured.

## 13. Final evidence record

Before merge/submission, record:

- final source SHA;
- Arc router address + deploy tx;
- Arc USDC address;
- Arc admin + treasury;
- fresh GenLayer registry address + deploy tx;
- fresh authenticity address + deploy tx;
- reservation tx/state;
- registration Arc tx + event log index;
- registration GenLayer tx;
- namespace + owner;
- consumed receipt proof;
- public attestation URL;
- authenticity claim ID/tx;
- verification verdict/tx;
- challenge ID/tx;
- resolution verdict/tx;
- final CI run.

Never fabricate missing proof. Keep any unobserved item explicitly pending.
