# Deploying GNS v3 to GenLayer

Deploy the Arc USDC payment router first. `GNSRegistry` permanently binds that router address in its constructor.

## Studionet target

- Chain ID: `61999`
- RPC: `https://studio.genlayer.com/api`
- Explorer: `https://explorer-studio.genlayer.com/`

## Registry

Set the fresh Arc router address locally, then run:

```bash
npm run deploy:gns
```

The deployment script passes the Arc router constructor argument, waits for `FINALIZED`, requires successful execution and records the resulting registry address locally.

Verify:

- `contract_version()` returns `2.1.1-arc-usdc-reservations`;
- `get_arc_payment_config()` returns Arc chain ID `5042002` and the exact router;
- reservation TTL is non-zero;
- `get_admin()` is the intended registry admin.

## Authenticity

After the new registry address is configured:

```bash
npm run deploy:authenticity
```

Verify that the authenticity contract points to the new registry and reports policy `gns-auth-v2`.

## Live smoke sequence

1. reserve an available `.gen` registration on GenLayer;
2. pay USDC on Arc;
3. finalize registration on GenLayer using the Arc tx hash and event log index;
4. confirm the payment receipt is consumed;
5. confirm the namespace resolves to the expected owner;
6. run `npm run smoke:gns` with the observed namespace/receipt values;
7. complete the separate authenticity claim and challenge lifecycle.

Do not reuse historical v2 deployment addresses as v3 proof.
