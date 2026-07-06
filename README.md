<p align="center">
  <img src="./public/gns-logo.png" alt="GNS logo" width="140" />
</p>

# GNS - GenLayer Naming Service

Readable names for the intelligent contract economy. GNS lets wallets, contracts, AI agents, apps, and project teams register `.gen` names on GenLayer, attach profile records, create subnames, and use GenLayer's validator network for AI-assisted identity and dispute review.

GNS is not just a profile page. It is a GenLayer-native naming registry where simple registry actions are deterministic, while subjective trust decisions such as identity verification and suspicious-name review go through comparative AI consensus.

## What it is

Connect a wallet, search for a `.gen` name, and register it with GEN on Studionet. Once registered, the owner can attach records such as website, X, GitHub, Discord, email, contract address, agent endpoint, and description. Anyone can resolve the name to its owner, primary address, profile records, AI trust status, and subnames.

The protocol also supports suspicious-name reports and project verification. Those trust-layer decisions are handled inside the GenLayer intelligent contract, not a server or database.

- Human-readable `.gen` names for wallets, contracts, agents, projects, and apps
- Paid registration and renewal with GEN
- Reverse lookup from wallet address to primary `.gen` name
- Profile records for identity, social links, contracts, and agent endpoints
- SoulStamp profile verification for wallet-linked X, GitHub, and Discord accounts
- Validator-agreed URL evidence fetches with stored response hashes
- Subnames such as `agent.papito.gen` and `pay.papito.gen`
- Suspicious-name reports for phishing, impersonation, fake support, brand misuse, and squatting
- Comparative AI trust layer for name review, report review, and project verification
- Admin protocol controls for price, treasury, withdrawals, flags, and report status
- No backend database - registry state lives in the GenLayer contract

## How it works

For name owners:

1. Search for an available `.gen` name.
2. Register it for 1 to 5 years by paying the quoted GEN amount.
3. Set profile records for website, X, GitHub, Discord, email, contract address, agent endpoint, and description.
4. Set the name as the primary reverse record for the connected wallet.
5. Create subnames for payment, agents, apps, or contracts.
6. Transfer names or subnames when ownership changes.
7. Request AI-assisted project verification when the name represents a real project.

For resolvers and users:

1. Resolve a `.gen` name to its owner, primary address, records, status, and AI trust state.
2. Reverse-resolve a wallet address to its primary `.gen` name.
3. Inspect public profile data and subnames.
4. Report suspicious names with a reason, evidence URL, and comment.
5. Read AI review results once comparative consensus has stored a review.

For protocol operators:

1. Connect the admin wallet on `/ops-gns`.
2. Inspect treasury, contract balance, total revenue, total withdrawn, total names, and total reports.
3. Update registration price per year.
4. Update treasury address.
5. Withdraw accumulated GEN to treasury.
6. Flag or unflag names.
7. Update report status.
8. Transfer admin to another address.

## Registry lifecycle

| Stage | What happens |
| --- | --- |
| Search | User checks whether a root `.gen` label is available. |
| Register | Owner pays GEN and receives the name for 1 to 5 years. |
| Configure | Owner sets records, primary address, reverse name, and subnames. |
| Resolve | Anyone reads name data from the contract. |
| Report | A user submits a suspicious-name report with evidence. |
| Review | GenLayer comparative AI consensus can review names, reports, or project claims. |
| Renew | Owner extends expiration by paying the quoted renewal amount. |
| Transfer | Owner moves a name or subname to a new address. |

## GenLayer consensus functions

| Function | What GenLayer does |
| --- | --- |
| `verify_name_url(name, evidence_type, url)` | Validators fetch an HTTPS URL with `gl.nondet.web.request`, agree with `strict_eq`, and store status, byte count, and SHA-256 evidence hash. |
| `ai_review_name(name, claim, evidence_url, extra_context)` | Validators independently review identity, impersonation, phishing, and verification risk for a `.gen` name. |
| `ai_review_report(report_id)` | Validators review a submitted suspicious-name report and recommend `reviewed`, `flagged`, or `dismissed`. |
| `ai_verify_project_claim(name, project_name, website, x, github, explanation)` | Validators review whether the owner-controlled `.gen` name legitimately represents the claimed project identity. |
| `ai_suggest_names(base_label, purpose)` | Advisory name suggestions only. This does not mutate ownership, verification, reports, or funds. |

High-stakes trust functions use `gl.eq_principle.prompt_comparative`. The task function calls `gl.nondet.exec_prompt(prompt)`, and validators compare the substantive JSON result fields before state is written. Stored AI review objects include `consensus_method` for auditability.

`ai_suggest_names` remains advisory because it does not affect ownership, report status, verification, name status, or protocol funds.

## Web evidence and SoulStamp

GNS now has two identity-proof paths:

1. `verify_name_url` performs real validator web fetching with `gl.nondet.web.request`, then stores a strict-equivalence evidence record. This is strongest for stable URLs such as commit-pinned raw GitHub files, project-controlled static pages, JSON attestations, or other byte-stable documents.
2. SoulStamp integration reads the existing SoulStamp contract at `0x3108dafFCBC24E261137056c56aFCAE17677BDfB` and checks whether the GNS name owner has active SoulStamp links for the X, GitHub, or Discord records shown on the profile.

This is the right split: GNS resolves names and stores project records, while SoulStamp proves which social accounts belong to which wallet. Dynamic pages such as normal GitHub profile HTML can differ between validator fetches and may fail strict byte equality; pinned raw files or explicit attestation endpoints are preferred for on-chain evidence.

## Deterministic contract functions

| Function | Purpose |
| --- | --- |
| `register(label, years, primary_address)` | Payable registration for a root `.gen` name. |
| `renew(name, years)` | Payable renewal for an existing name. |
| `transfer(name, new_owner)` | Transfer a root name to a new owner. |
| `set_primary_address(name, address)` | Update the address a name resolves to. |
| `set_primary_name(name)` | Set reverse lookup for the sender wallet. |
| `set_records(name, records_json)` | Update profile/project/agent records. |
| `clear_record(name, key)` | Clear one record key. |
| `create_subname(parent, sub_label, primary_address)` | Create a subname under an owned root name. |
| `transfer_subname(subname, new_owner)` | Transfer a subname to another owner. |
| `report_name(name, reason, evidence_url, comment)` | Submit a suspicious-name report. |
| `verify_name_url(name, evidence_type, url)` | Owner-only HTTPS evidence fetch and hash storage. |
| `get_total_evidence()` | Read total stored web evidence records. |
| `get_web_evidence(evidence_id)` | Read one stored web evidence record. |
| `admin_set_price_per_year(price_wei)` | Admin updates yearly registration price. |
| `admin_set_treasury(address)` | Admin updates withdrawal treasury. |
| `admin_withdraw(amount_wei)` | Admin withdraws accrued GEN to treasury. |
| `admin_flag_name(name, reason)` | Admin flags a registered name. |
| `admin_unflag_name(name)` | Admin clears a flag. |
| `admin_set_report_status(report_id, status)` | Admin updates report status. |

## Contract

| Field | Value |
| --- | --- |
| Network | GenLayer Studionet |
| Chain ID | `61999` |
| RPC | `https://studio.genlayer.com/api` |
| Explorer | `https://explorer-studio.genlayer.com/` |
| Current contract | `0x44a224BF67a4fB17a3a0f0585958dCCc1dfA1AD2` |
| Contract version | `1.3.0-web-evidence` |
| SoulStamp contract | `0x3108dafFCBC24E261137056c56aFCAE17677BDfB` |
| SoulStamp app | `https://soulstamp-gen.vercel.app` |
| Source | `contracts/GNSRegistry.py` |
| Default price | `5 GEN / year` |

## Tested identities

The latest Studionet smoke test used production-shaped identity records:

| Identity | Name | Owner role | Purpose |
| --- | --- | --- | --- |
| Papito | `papito.gen` | `TEST_ALICE` | Omodamola "Papito" Adeleke identity, primary wallet, profile, and agent routing record. |
| Meritra | `meritra.gen` | `TEST_BUILDER` | Project identity for research grant review and GenLayer bounty workflows. |
| Agent subname | `agent.papito.gen` | Transferred to `TEST_BUILDER` | Demonstrates delegated agent or app ownership under a parent name. |

The test registered names, set records, set reverse lookup, created a subname, transferred the subname, submitted a report, reviewed the report, fetched pinned web evidence, and ran comparative AI review flows. Papito test records use `@papito_dele` as the X handle.

## Latest test result

| Check | Result |
| --- | --- |
| Deploy `GNSRegistry.py` | Passed |
| `contract_version` | `1.3.0-web-evidence` |
| Register `papito.gen` | Passed |
| Set Papito records | Passed |
| Set Papito primary reverse record | Passed |
| Create `agent.papito.gen` | Passed |
| Transfer `agent.papito.gen` | Passed |
| Register `meritra.gen` | Passed |
| Set Meritra records | Passed |
| `verify_name_url` pinned Papito/Meritra evidence | Passed |
| Submit suspicious-name report | Passed |
| Admin mark report reviewed | Passed |
| Resolve names | Passed |
| Reverse lookup | Passed |
| Owner-name lists | Passed |
| Parent subname list | Passed |
| `ai_review_report` comparative review | Passed |
| `ai_verify_project_claim` comparative review | Passed |
| `ai_review_name` comparative review | Passed with SoulStamp-backed Papito identity records |
| Stored AI reviews on latest AI run | `5` total, including 3 Papito/SoulStamp-backed reviews |

The earlier `1.2.2-comparative-two-arg` deployment stored all three AI review types, but it did not include real URL fetching. The current deployment prioritizes the stronger evidence model: deterministic registry actions plus strict fetched evidence, with SoulStamp handling social account ownership. The latest Papito test proves this path end to end: active SoulStamp proofs for X `papito_dele` and GitHub `ometere123`, GNS records on `papito902odb.gen`, strict web evidence, suspicious report dismissal, name review, report review, and project claim verification.

## Test wallets

Disposable Studionet test wallets were generated locally and stored in `.env.test-wallets.local`, which is ignored by git. Do not use these wallets for mainnet funds.

| Role | Address |
| --- | --- |
| `DEPLOYER` | `0x231EF01E282385eC2E22394469f1C8c6C28Fd6b1` |
| `TEST_ALICE` | `0x5feD116262DEB9Cb58B808C060D0F4D2809b6e7c` |
| `TEST_BUILDER` | `0x268a14Adb45e9CCcdf950fB1e4c2aC4f226b6eF5` |
| `TEST_REPORTER` | `0x6e27b7B7992c1310Ee2876A711ace934818125A5` |

## Tech stack

| Layer | Tech |
| --- | --- |
| Intelligent contract | GenLayer Python, `gl.eq_principle.prompt_comparative`, `gl.nondet.exec_prompt`, payable writes |
| Web evidence | `gl.nondet.web.request`, `gl.eq_principle.strict_eq`, SHA-256 response hashes |
| Profile verification | Existing SoulStamp contract and app |
| Frontend | Next.js 15 App Router, React 18, TypeScript, Tailwind CSS |
| Web3 | `genlayer-js` 1.1.7 |
| Wallet | Injected wallet such as MetaMask |
| Storage | None - all registry state lives in the GenLayer contract |
| Testing | Node scripts using local private-key accounts from `genlayer-js` |

## Repository

```text
contracts/
  GNSRegistry.py          GenLayer intelligent contract and registry source of truth

scripts/
  generate-gns-keys.mjs   Generates disposable Studionet test wallets
  deploy-gns.mjs          Deploys the contract and updates .env.local
  smoke-gns.mjs           Runs deterministic and optional AI smoke tests
  gns-test-utils.mjs      Shared deployment and test helpers

src/
  app/                    Next.js routes
    page.tsx              Landing and search entry
    search/               Availability and suggestions
    register/[name]/      Registration flow
    name/[name]/          Public profile and AI trust status
    dashboard/            Owned names
    manage/[name]/        Records, primary name, renew, transfer
    subnames/[name]/      Subname creation and management
    resolve/              Forward and reverse lookup
    disputes/             Report submission and recent report lookup
    ops-gns/              Admin protocol controls
    about/                FAQ and product explanation
  components/             Shared UI and feature components
  lib/genlayer/           GenLayer client wrapper
  lib/gns/                Typed contract read/write surface
  lib/soulstamp/          Read-only SoulStamp identity verification client
  lib/wallet/             Injected wallet provider
```

## Getting started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

```bash
NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=0x44a224BF67a4fB17a3a0f0585958dCCc1dfA1AD2
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_CHAIN_NAME=studionet
NEXT_PUBLIC_CHAIN_ID=61999
NEXT_PUBLIC_EXPLORER_URL=https://explorer-studio.genlayer.com/
NEXT_PUBLIC_OPS_ADDRESS=
NEXT_PUBLIC_SOULSTAMP_CONTRACT_ADDRESS=0x3108dafFCBC24E261137056c56aFCAE17677BDfB
NEXT_PUBLIC_SOULSTAMP_APP_URL=https://soulstamp-gen.vercel.app
```

`.env.local` is ignored and should contain the active deployed contract address.

## Deployment

Generate disposable test wallets if needed:

```bash
npm run keys:gns
```

Deploy the contract:

```bash
npm run deploy:gns
```

The deploy script reads `contracts/GNSRegistry.py`, deploys it with `DEPLOYER_PRIVATE_KEY`, and updates `NEXT_PUBLIC_GNS_CONTRACT_ADDRESS` in `.env.local`.

Run deterministic smoke tests:

```bash
npm run smoke:gns
```

Run deterministic plus comparative AI smoke tests:

```bash
$env:GNS_RUN_AI='1'; npm run smoke:gns
```

## Important notes

- `.gen` names are protocol-level names inside GNS and GenLayer. They are not public DNS top-level domains unless later connected to DNS or browser infrastructure.
- AI review is an assistive trust layer. It can flag, verify, or recommend action, but protocol operators can still perform human review through admin controls.
- Do not commit `.env.local` or `.env.test-wallets.local`.
- Do not fund generated test keys with mainnet assets.
- For public demos, use project identities you control or clearly mark as test identities. Do not use GNS to impersonate real people, protocols, or support accounts.

## Disclaimer

GNS provides decentralized naming, profile records, and AI-assisted identity review for the GenLayer ecosystem. It is not public DNS, legal identity verification, trademark adjudication, or a regulated trust service unless adopted by the relevant organization.
