# Deploying GNSRegistry to GenLayer

The MVP already points at the deployed Studionet contract `0x141c3e53ae4Ad24B07405CC0fb4D12ccc3A3007A`. Follow this guide if you want to redeploy your own copy.

## Studionet target

- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Explorer: `https://explorer-studio.genlayer.com/`

## Steps

1. Open <https://studio.genlayer.com/>.
2. Connect a wallet that holds Studionet test GEN.
3. Click **New Contract** and paste the full contents of `contracts/GNSRegistry.py`.
4. Compile and deploy.
5. Copy the deployed contract address.
6. In this project edit `.env.local`:

   ```
   NEXT_PUBLIC_GNS_CONTRACT_ADDRESS=0xYourNewContract
   NEXT_PUBLIC_GENLAYER_RPC_URL=https://studio.genlayer.com/api
   NEXT_PUBLIC_CHAIN_NAME=studionet
   NEXT_PUBLIC_CHAIN_ID=61999
   NEXT_PUBLIC_EXPLORER_URL=https://explorer-studio.genlayer.com/
   ```

7. Restart `npm run dev`.

## Smoke test

In the GenLayer Studio console, call `contract_version` — it should return `"1.0.1"`. Then `register("test", 1, "0xYourAddress")` and verify with `resolve("test")`.

## Notes

- Do not commit `.env.local`.
- Never paste a private key into this repo or the Studio UI text fields.
