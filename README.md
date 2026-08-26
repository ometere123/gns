# GNS

GNS is a human-readable `.gen` namespace protocol with evidence-grounded authenticity and disputes.

The v3 architecture deliberately separates three different concerns:

- **GenLayer registry:** deterministic namespace ownership, records, transfers, subnames and Arc-payment receipt consumption.
- **GenLayer authenticity:** evidence retrieval, wallet-bound attestations, authenticity verdicts, challenges and dispute resolution.
- **Arc payment router:** USDC pricing, collection, treasury accounting, withdrawals and payment administration.

GNS does **not** use GEN as its commercial pricing asset. GEN remains a GenLayer network asset wherever GenLayer transaction execution requires it. GNS registration and renewal prices are denominated in USDC on Arc.

## Why Arc

Arc Testnet uses USDC as its gas asset and exposes a 6-decimal USDC ERC-20 interface, which lets a user hold one asset for both GNS payment and Arc transaction fees.

Current v3 constants:

| Item | Value |
| --- | --- |
| Arc chain ID | `5042002` |
| Arc RPC | `https://rpc.testnet.arc.network` |
| Arc explorer | `https://testnet.arcscan.app` |
| Arc test USDC | `0x3600000000000000000000000000000000000000` |
| Payment event | `PaymentRecorded(address,bytes32,uint8,uint16,uint256)` |
| Payment event topic | `0x16246dce28fe193971c235293f898fe6af15aa3539719b24d894793343162838` |

## Payment lifecycle

A browser "paid" flag is never authoritative.

1. The user selects a `.gen` namespace and duration.
2. The frontend reads the price from `GNSPaymentRouter` on Arc.
3. The user approves the exact required USDC amount if allowance is insufficient.
4. The user calls `payRegistration()` or `payRenewal()` on Arc.
5. The router transfers USDC into the contract and emits a receipt bound to:
   - payer;
   - SHA-256 of the canonical lowercase `.gen` namespace;
   - action (`REGISTER` or `RENEW`);
   - duration;
   - amount.
6. The frontend stores the Arc transaction hash and event log index locally so the flow can be resumed without paying twice.
7. The user switches to GenLayer and submits the Arc receipt reference.
8. GenLayer validators independently retrieve the Arc JSON-RPC transaction receipt and latest block.
9. `GNSRegistry` verifies the successful router call, event signature, router address, payer, namespace hash, action, years, positive amount and Arc finality.
10. The receipt key `5042002:<txHash>:<logIndex>` is consumed exactly once.
11. Only then does the GenLayer registration or renewal finalize.

A legitimate Arc receipt is not invalidated merely because the protocol changes prices after the payment was made. Price enforcement happens at the immutable payment router at payment time; the GenLayer side verifies the resulting router receipt.

## Contracts

### `evm/GNSPaymentRouter.sol`

Arc USDC payment rail.

Responsibilities:

- registration and renewal pricing;
- USDC collection;
- payment receipt events;
- separate admin and treasury roles;
- two-step admin transfer;
- two-step treasury transfer;
- pause/unpause payment collection;
- treasury-only partial/full withdrawal;
- total collected / withdrawn accounting.

The Arc admin cannot change `.gen` ownership or authenticity verdicts. The treasury cannot change pricing or protocol administration.

### `contracts/GNSRegistry.py`

GenLayer deterministic namespace registry.

Responsibilities:

- `.gen` ownership and expiry;
- records and primary addresses;
- reverse lookup;
- transfers and subnames;
- reports;
- Arc receipt verification and one-time consumption;
- registration pause;
- two-step GenLayer admin transfer.

The v3 registry has no commercial GEN price, no payable registration path and no GEN treasury withdrawal path.

### `contracts/GNSAuthenticity.py`

GenLayer evidence-grounded trust layer.

Registration proves namespace ownership only. It does **not** prove the real-world identity/project represented by a namespace.

Authenticity v2 adds:

- claim-specific nonce;
- wallet-controlled public attestation;
- subject hash binding to current registry owner/records/policy;
- evidence retrieval inside every verdict-bearing path;
- GitHub/website source binding;
- bounded attestation freshness;
- fail-closed malformed model output;
- validator comparison of decision-critical fields;
- challenge burden-of-proof semantics that do not let weak challenges erase a VERIFIED state.

See [`docs/authenticity-v2.md`](docs/authenticity-v2.md).

## Authority model

There is intentionally no omnipotent admin.

| Role | Can do | Cannot do |
| --- | --- | --- |
| GenLayer registry admin | pause new registrations, propose registry admin, moderate deterministic reports/flags | withdraw Arc USDC, manufacture authenticity verdicts |
| Arc router admin | set prices, pause payments, propose Arc admin/treasury | modify `.gen` ownership, withdraw treasury funds unless also treasury |
| Arc treasury | withdraw collected USDC, accept a proposed treasury role | change prices, namespaces, authenticity or admins |
| Namespace owner | manage owned namespace and create authenticity claim | change protocol pricing/treasury/admin |
| GenLayer authenticity consensus | adjudicate evidence-grounded authenticity/challenges | take custody of Arc USDC |

Admin and treasury transfers are two-step proposals requiring acceptance by the destination wallet.

## Frontend

Next.js 15 frontend with no separately hosted application backend.

Paid actions expose the actual cross-chain lifecycle:

> **Pay on Arc → Finalize on GenLayer**

The Arc receipt is stored only as resumable browser state; GenLayer still independently verifies it from Arc RPC.

Operational controls at `/ops-gns` are also split by on-chain role. UI access checks are convenience only; contract permissions remain authoritative.

## Local configuration

Copy `.env.example` to `.env.local` and fill the deployed addresses:

```bash
NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=
NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS=
NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS=
```

Network defaults are already provided for Studionet and Arc Testnet.

Never commit private keys, seed phrases, keystore passwords or `.env.local`.

## Build and test

### GenLayer

```bash
pip install -r requirements-dev.txt
genvm-lint check contracts/GNSRegistry.py
genvm-lint check contracts/GNSAuthenticity.py
python -m py_compile contracts/GNSRegistry.py contracts/GNSAuthenticity.py
pytest tests/direct -v
```

### Arc router

```bash
forge fmt --check
forge build --sizes
forge test -vvv
```

### Frontend

```bash
npm ci
npm audit --audit-level=high
npm run build
```

The same checks run in GitHub Actions on `v3-arc-usdc`.

## Deployment order

Do not deploy the GenLayer registry first. Its Arc payment-router address is immutable by design.

1. Deploy `GNSPaymentRouter` on Arc Testnet using a controlled admin and treasury wallet.
2. Set `NEXT_PUBLIC_ARC_PAYMENT_ROUTER_ADDRESS` locally.
3. Deploy fresh `GNSRegistry.py`; constructor binds the Arc router.
4. Deploy fresh `GNSAuthenticity.py` against the new registry.
5. Configure the frontend with all three addresses.
6. Run a real Arc USDC registration → GenLayer finalization lifecycle.
7. Set truthful public GitHub evidence on that new namespace.
8. Run authenticity claim → verification → controlled challenge → challenge resolution.
9. Record only actually observed addresses, tx hashes, claim IDs and verdicts in the deployment evidence document.

Detailed Arc deployment and smoke procedure: [`docs/arc-usdc.md`](docs/arc-usdc.md).

## Deployment status

**v3 Arc/USDC architecture is currently implementation/test stage.**

The previous v2 registry/authenticity deployments are historical proof for the authenticity recovery branch and are **not** v3 deployment addresses. Do not configure the v3 frontend with an old registry merely to make it appear deployed.

A fresh v3 deployment is required because:

- the registry constructor now binds an Arc router;
- registration/renewal signatures changed;
- the old registry commercial model used GEN;
- final deployment proof must correspond exactly to final reviewed source.

## Reviewer feedback addressed by the architecture

The original authenticity rejection identified three core weaknesses. V2/v3 address them directly:

1. **Stable URL content is not ownership proof.** Authenticity requires a claim-specific, wallet-bound attestation under a registered source.
2. **Verdict-bearing reviews must fetch cited evidence.** Claim verification and challenge resolution retrieve their evidence inside validator execution.
3. **A deterministic name service alone is not the GenLayer use case.** Namespace infrastructure is deterministic; GenLayer's differentiated role is live-evidence authenticity/dispute adjudication and independent verification of Arc payment facts before state mutation.

## Branch policy

- `v2-authenticity-adjudication` preserves the audited authenticity-recovery baseline.
- `v3-arc-usdc` contains the Arc USDC commercial architecture.
- Do not merge v3 to `main` until final CI, live Arc/GenLayer lifecycle proof and independent audit are complete.
