# GNS

GNS is a human-readable `.gen` namespace protocol with evidence-grounded authenticity and disputes.

The v3 architecture separates three concerns:

- **GenLayer registry:** authoritative `.gen` ownership, expiry, records, reverse lookup, transfers, subnames, registration reservations and one-time Arc receipt consumption.
- **GenLayer authenticity:** evidence retrieval, wallet-bound attestations, authenticity verdicts, challenges and dispute resolution.
- **Arc payment router:** USDC pricing, collection, treasury accounting, withdrawals and payment administration.

**The `.gen` names themselves remain on GenLayer.** Arc never owns, resolves, transfers or adjudicates a namespace. Arc is only the commercial USDC payment rail for registration and renewal.

GNS does not use GEN as its commercial pricing asset. GEN remains a GenLayer network asset wherever GenLayer transaction execution requires it; GNS registration and renewal prices are denominated in USDC on Arc.

## Arc Testnet

| Item | Value |
| --- | --- |
| Chain ID | `5042002` |
| RPC | `https://rpc.testnet.arc.network` |
| Explorer | `https://testnet.arcscan.app` |
| Test USDC ERC-20 | `0x3600000000000000000000000000000000000000` |
| USDC ERC-20 decimals | `6` |
| Native gas asset | USDC |
| Finality | deterministic BFT finality |

Arc's native representation uses 18-decimal precision while the USDC ERC-20 interface uses 6 decimals. GNS commercial amounts are ERC-20 USDC base units.

## Registration lifecycle

A successful Arc payment is **not** namespace ownership. Ownership exists only after the GenLayer registry finalizes the registration.

1. User chooses an available canonical lowercase `.gen` namespace, duration and primary address.
2. The wallet calls `reserve_registration(...)` on GenLayer.
3. GenLayer finalizes a short reservation bound to wallet, namespace, duration and primary address.
4. Only after that reservation exists does the frontend enable Arc payment.
5. The frontend reads the current registration price from `GNSPaymentRouter`.
6. User approves the exact required USDC allowance if necessary.
7. User creates a GenLayer-bound payment intent and calls `payRegistration(namespace, years, intentHash)` on Arc.
8. The router transfers USDC and emits `PaymentRecorded(address,bytes32,uint8,uint16,uint256,bytes32)`.
9. The frontend stores the Arc transaction hash and payment-event log index so an interrupted flow can resume without another payment.
10. User returns to GenLayer and calls `register(...)` with the Arc receipt reference.
11. GenLayer validators independently fetch the Arc transaction receipt through JSON-RPC.
12. `GNSRegistry` verifies successful execution, configured router, event signature, payer, SHA-256 namespace hash, action, duration and positive amount.
13. The registry re-checks the active matching reservation and consumes `5042002:<txHash>:<logIndex>` exactly once.
14. Only then is `.gen` ownership created on GenLayer.

The reservation prevents the ordinary cross-chain race in which two wallets could otherwise pay Arc for the same still-unfinalized namespace.

Arc uses deterministic finality: once a transaction receipt is in a committed block it is irreversible, so the registry does not compare a moving latest-block number between GenLayer validators.

## Renewal lifecycle

Renewal remains owner-gated on GenLayer:

> **Pay USDC on Arc → verify receipt on GenLayer → extend expiry on GenLayer**

A legitimate router receipt does not become invalid merely because the Arc admin changes pricing after payment. Price enforcement occurs at the router when USDC is collected; GenLayer verifies the resulting immutable payment event.

## Contracts

### `evm/GNSPaymentRouter.sol`

Arc USDC payment rail:

- independent registration and renewal prices;
- USDC collection and payment events;
- payment pause;
- separate admin and treasury roles;
- two-step admin transfer;
- two-step treasury transfer;
- treasury-only partial/full withdrawal;
- collection and withdrawal accounting;
- reentrancy protection and safe ERC-20 calls.

The Arc admin cannot modify `.gen` ownership or authenticity verdicts. The treasury cannot change protocol pricing or namespace state.

### `contracts/GNSRegistry.py`

GenLayer namespace source of truth. Current v3 version: `2.2.0-arc-usdc-intents`.

Responsibilities include ownership, expiry, records, reverse lookup, transfers, subnames, registration reservations, deterministic reports/admin controls, Arc receipt verification and one-time receipt consumption.

The v3 registry has no commercial GEN price, no payable registration path and no GEN treasury withdrawal path.

Expired owners cannot mutate expired names. Reverse lookup fails closed for expired names, and expired re-registration cleans stale owner/reverse state.

### `contracts/GNSAuthenticity.py`

Separate GenLayer evidence-grounded trust layer. Registration proves namespace ownership only; it does **not** prove the real-world identity, organization, project or brand represented by the namespace.

The authenticity layer requires claim-specific wallet-bound public attestations, fetches cited evidence inside verdict-bearing paths, fails closed on malformed judgment output and preserves an existing VERIFIED state when a challenge is weak or inconclusive.

See [`docs/authenticity-v2.md`](docs/authenticity-v2.md).

## Authority model

| Role | Can do | Cannot do |
| --- | --- | --- |
| GenLayer registry admin | pause registrations, propose registry admin, moderate deterministic reports/flags | withdraw Arc USDC, manufacture authenticity verdicts |
| Arc router admin | set prices, pause payments, propose Arc admin/treasury | modify `.gen` ownership, withdraw funds unless also treasury |
| Arc treasury | withdraw collected USDC, accept a treasury proposal | change prices, namespaces, authenticity or admins |
| Namespace owner | manage active owned namespaces and create authenticity claims | change protocol pricing/treasury/admin |
| GenLayer authenticity consensus | adjudicate evidence-grounded claims/challenges | take custody of Arc USDC |

Admin and treasury transfers are two-step proposals requiring acceptance by the destination wallet.

## Frontend

Next.js 15 frontend with no separately hosted application backend.

Registration exposes the real lifecycle:

> **Reserve on GenLayer → Pay on Arc → Finalize on GenLayer**

Renewal exposes:

> **Pay on Arc → Finalize on GenLayer**

Browser-stored Arc receipt state is resumable convenience only. GenLayer independently verifies the receipt from Arc RPC before mutating authoritative namespace state.

Operational controls at `/ops-gns` are split by on-chain role; frontend access checks are convenience only and contract permissions remain authoritative.

## Validation

Current validation and live testnet status:

- GenVM lint: both GenLayer contracts passed;
- Python compile: passed;
- Direct Mode: **41/41 passed**;
- Foundry formatting: passed;
- Solidity 0.8.24 build: passed;
- `GNSPaymentRouter` runtime size: **5,771 bytes**;
- Foundry: **18/18 passed**;
- `npm ci`: passed;
- `npm audit --audit-level=high`: **0 vulnerabilities**;
- Next.js 15.5.24 optimized production build: passed.

GitHub Actions CI run [33091054373](https://github.com/ometere123/gns/actions/runs/33091054373) passed on hardened source SHA `da40114bda2e60028c287c71b712d5de71546c30`. Fresh deployment state and the remaining live funding gate are recorded in [`docs/v3-live-deployment.md`](docs/v3-live-deployment.md).

## Local configuration

Copy `.env.example` to `.env.local` and fill the fresh v3 addresses:

```bash
NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=
NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS=
NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS=
```

Never commit private keys, seed phrases, keystore passwords or `.env.local`.

## Deployment order

The Arc router must be deployed first because the GenLayer registry permanently binds its address.

1. Deploy `GNSPaymentRouter` on Arc Testnet using controlled admin and treasury accounts.
2. Configure `NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS`.
3. Deploy a **fresh** `GNSRegistry.py` with that router constructor argument.
4. Deploy a **fresh** `GNSAuthenticity.py` against the new registry.
5. Configure the frontend with all three addresses.
6. Run a real GenLayer reservation → Arc USDC registration payment → GenLayer registration finalization lifecycle.
7. Confirm the Arc receipt is consumed exactly once and the namespace resolves to the expected owner.
8. Set truthful public evidence under a source the owner actually controls.
9. Run authenticity claim → verification → controlled challenge → resolution.
10. Record only observed addresses, transaction hashes, claim IDs and verdicts.

See [`docs/arc-usdc.md`](docs/arc-usdc.md) and [`docs/deploy-genlayer.md`](docs/deploy-genlayer.md).

## Deployment status

**v3 has fresh hardened Arc Testnet / GenLayer Studionet contracts deployed. The new cross-chain registration, renewal, authenticity, challenge and refresh proof is pending replenishment of the shared wallet’s Arc Testnet USDC; no incomplete flow is represented as successful.**

Historical v2 registry/authenticity addresses are not v3 proof. v3 uses the fresh addresses recorded in the live deployment evidence; no historical v2 ownership migration was fabricated.

Payment intents are domain-separated by protocol, actual registry address, action, namespace, wallet, terms, timestamps, current expiry and nonce. Renewal intents are invalidated by ownership/expiry transitions and cannot be reused after a transfer or stale expiry assumption. Browser payments require a five-minute intent safety margin and bind resumable receipts to the exact intent hash.

For this testnet release, an unconsumed Arc payment has no permissionless refund or recovery path if later GenLayer registration fails permanently; production hardening must address that explicitly. Redirect behavior of `gl.nondet.web.request` was not independently established in the live flow, so no redirect-trampoline guarantee is claimed.

## Branch policy

- `v2-authenticity-adjudication` preserves the audited authenticity-recovery baseline.
- `v3-arc-usdc` contains the Arc USDC commercial architecture.
- Do not merge v3 to `main` until fresh live Arc/GenLayer lifecycle proof and final audit are complete.
