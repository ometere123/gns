# GNS GenLayer contracts

GNS v3 keeps namespace state and authenticity on GenLayer while using Arc only for USDC payment collection.

## `GNSRegistry.py`

Version: `2.1.0-arc-usdc-reservations`

The registry is authoritative for `.gen` ownership, expiry, records, transfers, reverse lookup and subnames.

Commercial flow:

1. reserve an available root namespace on GenLayer;
2. pay registration or renewal USDC through the configured Arc router;
3. submit the Arc transaction hash + payment-event log index to GenLayer;
4. validators fetch that Arc receipt themselves;
5. the registry validates router, tx success, payer, namespace hash, action, duration and positive amount;
6. the receipt key is consumed exactly once before namespace state changes.

Registration reservations are wallet/namespace/duration/primary-address bound and expire automatically. They prevent the ordinary cross-chain race where two wallets could otherwise pay for the same still-unfinalized name.

The registry has no commercial GEN price, payable registration method or GEN treasury withdrawal path.

## `GNSAuthenticity.py`

Version: `2.0.0-authenticity-alpha`
Policy: `gns-auth-v2`

Registration proves namespace ownership only. Authenticity is a separate evidence-grounded GenLayer judgment flow using claim-specific wallet attestations, verdict-path evidence retrieval and challenge resolution.

See `../docs/authenticity-v2.md`.

## Deployment

Historical v2 addresses do not represent this v3 source. Deploy the Arc router first, then a fresh registry bound to that router, then a fresh authenticity contract bound to the new registry.

See `../docs/arc-usdc.md` and `../docs/deploy-genlayer.md`.
