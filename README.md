# GNS — GenLayer Naming Service

Readable names for the intelligent contract economy. Register `.gen` names for wallets, contracts, AI agents, and apps on GenLayer.

## Tech Stack

- Next.js (App Router) + React 18
- TypeScript (strict)
- Tailwind CSS
- `genlayer-js` 1.1.7
- Python GenLayer Intelligent Contract (`contracts/GNSRegistry.py`)
- Injected wallet (e.g. MetaMask) — no WalletConnect, no Supabase, no backend DB

## Features

- Search and register `.gen` names
- Resolve names → wallet addresses (and reverse lookup)
- Manage profile records: avatar, website, X, GitHub, Discord, email, contract, agent endpoint, description
- Subnames (`pay.papito.gen`, `agent.papito.gen`)
- Set primary name (reverse record)
- Renew and transfer names
- Report suspicious names (impersonation, phishing, fake support, brand misuse, squatting)
- AI protection layer architected in the contract (`ai_review_name`, `ai_review_report`, `ai_verify_project_claim`, `ai_suggest_names`) — to be enabled in the UI later

## Pages

- `/` Landing
- `/search` Availability + suggestions
- `/register/[name]` Registration flow
- `/name/[name]` Public profile
- `/dashboard` Owned names
- `/manage/[name]` Records, renew, transfer
- `/subnames/[name]` Subname management
- `/resolve` Forward + reverse lookup
- `/disputes` Report submission + recent reports
- `/about` Docs / FAQ

## Environment

Copy `.env.example` to `.env.local` and edit if needed:

```
NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=0xfC5c1B1DAF6eFFc1B857E69832b3180894225395
NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
NEXT_PUBLIC_CHAIN_NAME=studionet
NEXT_PUBLIC_CHAIN_ID=61999
NEXT_PUBLIC_EXPLORER_URL=https://explorer-studio.genlayer.com/
```

The deployed Studionet contract address (payable v1.1.0) is pre-filled. If you redeploy, replace this value.

## Paid registration

GNS v1.1.0 charges real GEN for registrations and renewals.

- Default price: **5 GEN / year**.
- `register` and `renew` are both `@gl.public.write.payable`. The frontend reads `quote_registration(years)` / `quote_renewal(years)` and passes that exact wei amount as `value` on the write call.
- 1 GEN = 10^18 wei.
- Fees accrue inside the contract. The admin withdraws them to the configured **treasury** address — they are never sent anywhere else.
- The admin can change the price at any time via `admin_set_price_per_year(new_price_wei)` from the `/admin` page.
- The admin can move the treasury via `admin_set_treasury(new_treasury)`.
- The admin can withdraw available balance via `admin_withdraw(amount_wei)`. Funds go to the current treasury, full stop.

## Install & Run

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

```bash
npm run lint
npm run build
```

## Deploy / Re-deploy the contract

See [`docs/deploy-genlayer.md`](docs/deploy-genlayer.md). Quick version:

1. Open <https://studio.genlayer.com/>.
2. Paste `contracts/GNSRegistry.py`.
3. Deploy on Studionet (Chain ID 61999).
4. Copy the contract address into `NEXT_PUBLIC_GNS_CONTRACT_ADDRESS`.
5. Restart `npm run dev`.

## Limitations

- `.gen` names are protocol-level names inside GNS / GenLayer. They are **not** public DNS top-level domains unless later connected to DNS or browser infrastructure.
- The AI review methods are wired in as **AI-assisted beta** features — they call the on-chain Equivalence Principle but are not a substitute for human review.

## Architecture

- `src/lib/genlayer/client.ts` — thin wrapper around `genlayer-js`, lazy-loaded
- `src/lib/gns/contract.ts` — typed read/write surface (`searchName`, `registerName`, `setRecords`, …)
- `src/lib/wallet/WalletProvider.tsx` — injected wallet connection (no WalletConnect)
- `src/components/*` — UI primitives and feature components
- `contracts/GNSRegistry.py` — source-of-truth registry
