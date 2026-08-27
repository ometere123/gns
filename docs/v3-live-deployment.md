# GNS v3 live testnet deployment evidence

This record contains observed Studionet and Arc Testnet results for the `v3-arc-usdc` branch. Contract deployment source was frozen before the live proof; later commits contain documentation, public evidence, and deployment-tooling changes only.

## Source and networks

- Deployment source revision: `b09652b2456178c18d65221ca7a20c195efcf82a`
- Arc Testnet chain: `5042002`
- Arc RPC: `https://rpc.testnet.arc.network`
- Arc explorer: `https://testnet.arcscan.app`
- Arc USDC: `0x3600000000000000000000000000000000000000`
- GenLayer network: Studionet, chain `61999`

## Arc payment router

- Address: `0x33201336B112947BAcC3Fd6522B3093fb35cB2f4`
- Deployment transaction: `0x7fff9b0efbd24148be9d2e528b4769490d5f0c6ed86ffa4dcafe4db26e684b15`
- Explorer: https://testnet.arcscan.app/address/0x33201336B112947BAcC3Fd6522B3093fb35cB2f4
- Deployer/admin/treasury: `0x231EF01E282385eC2E22394469f1C8c6C28Fd6b1`
- Version: `1.0.0-arc-usdc`
- Registration price: `5000000` USDC base units/year
- Renewal price: `3000000` USDC base units/year
- Runtime size: `5,713` bytes
- Source SHA-256 (`evm/GNSPaymentRouter.sol`): `B9CF5FD4F776A056FF4E4F6266902FA78482281C5DDC6C3D8C2F5E87C59A07BB`
- Final reads: paused `false`; pending admin and treasury are zero; total collected `13000000`; total withdrawn `0`; payment count `3`; treasury balance `13000000`.

The collected total includes an earlier unconsumed test registration payment made before the fresh registry deployment, plus the proof registration and renewal. Payment-time pricing is honored for an unused valid receipt; a matching current reservation and one-time receipt consumption are still required.

## GenLayer registry

- Address: `0xea09197914a8Bc92623D2465E36e91DaD1877C75`
- Deployment transaction: `0x9857c185cfebe78696008054a99fc66f2ee93e4ddaa2bb1056969beb26f946a5`
- Explorer: https://explorer-studio.genlayer.com/address/0xea09197914a8Bc92623D2465E36e91DaD1877C75
- Deployer/admin: `0x231EF01E282385eC2E22394469f1C8c6C28Fd6b1`
- Version: `2.1.1-arc-usdc-reservations`
- Bound Arc router: `0x33201336B112947BAcC3Fd6522B3093fb35cB2f4`
- Source SHA-256 (`contracts/GNSRegistry.py`): `7D8ACE0FACED2AE8CCFE7C80B7CB4A43B1A1D685F44A1EF28497A4660E197D66`
- Deployment was `FINALIZED` with leader execution `SUCCESS`.

## GenLayer authenticity

- Address: `0xedaDa430a3514A1607283223C5e9EF4336Cf78B5`
- Deployment transaction: `0x5964fbb1f05a0c2c227e66275c8f50833797dc7d4958c8a930f1d3a7f47fa97a`
- Explorer: https://explorer-studio.genlayer.com/address/0xedaDa430a3514A1607283223C5e9EF4336Cf78B5
- Deployer: `0x231EF01E282385eC2E22394469f1C8c6C28Fd6b1`
- Registry dependency: `0xea09197914a8Bc92623D2465E36e91DaD1877C75`
- Policy: `gns-auth-v2`
- Source SHA-256 (`contracts/GNSAuthenticity.py`): `AC8A212D432C6CEA1C8EFDD0C361B90F753CD38C92C350DDE7FE502BF50E2DC9`

## Cross-chain registration and renewal

- Namespace: `gnsv3tar9qma.gen`
- Owner and shared Arc/GenLayer wallet: `0x231EF01E282385eC2E22394469f1C8c6C28Fd6b1`
- Reservation transaction: `0x3b1c8b2fe2aad1365f7d49c87e0e39fc8af7a49fa214bf062c0eeede0cd55c72`
- Reservation expiry: `1787790575`
- Registration approval transaction: `0xafc0004d0c21c1b26fd829b25bd34d745be073d3af74e9f84b1df3078994e18a`
- Arc registration payment: `0x4062be57193568edaf417a6947b080ec318104be1d21f61bdb13fe6ca259d990`
- Registration PaymentRecorded log index: `34`
- Registration amount: `5000000` USDC base units
- GenLayer registration transaction: `0xfcdd1bf3822fc81fd3d8f6c3e178d24f6a1db75ba83a83ef1493f0eb8394b26a`
- Consumed receipt proof: `is_payment_consumed(...) == true`; finalized namespace payment metadata records the expected payer, router, chain, action, duration, amount and namespace hash.
- Registration replay transaction: `0xeebcbeb1bba8322102121e517ea3077b2409876ff661877a2d5a5cce6dc9edac`; finalized with leader execution `ERROR` as expected for a consumed receipt.
- Expiry before renewal: `1819324897`
- Renewal approval transaction: `0xce8450151e097a5d04baca40345fad5c3dfcd020e841c7ce2f1645c465f2d555`
- Arc renewal payment: `0x0de1901587e2e9ea2f04e8749f7cfc26900cdba7ad7372ede0a3c5f198fa03ec`
- Renewal PaymentRecorded log index: `10`
- GenLayer renewal transaction: `0xede67cf8bccbc46b71433e220df17496b1dbd9261550a4b72da03d73ed364825`
- Expiry after renewal: `1850860897` (`old expiry + 31536000`)
- Renewal replay transaction: `0x11f95a2f9210bebcbb2a548dd3f20fc0d5e3f8011d8ee33c23a902aa65397e07` (finalized with leader execution `ERROR` as expected).

## Authenticity claim and challenge

- GitHub record: `https://github.com/ometere123/gns`
- Claim type: `project`
- Claim ID: `1`
- Claim creation transaction: `0x110853d2fdc460e31283051250e632608166287ff2c88311b2f0dc6abf936d32`
- Public attestation URL: https://raw.githubusercontent.com/ometere123/gns/v3-arc-usdc/gns-claim.json
- Anonymous attestation retrieval: HTTP `200`, valid JSON, exact byte match, no redirect or authentication.
- Corroborating URL: https://github.com/ometere123/gns (anonymous HTTP `200`).
- Verification transaction: `0x12337fbf7a3978fa57d6a6b51e7eba7a4c60a2102dca98bb1c5768e30f4c38e5`
- Verification verdict: `1`, decision `VERIFIED`, reason `ATTESTATION_VALIDATED`
- Evidence expiry: `1787793171`
- Challenger: `0x268a14adb45e9cccdf950fb1e4c2ac4f226b6ef5`
- Challenge ID: `1`
- Challenge transaction: `0xec1d40da12db7bc689b1ef7a2caaf9f1053f11e454d08274d80bf24e91ecca87`
- Challenge evidence: `https://github.com/ometere123/gns`
- While open, the challenge was `OPEN` and authoritative namespace verification remained `VERIFIED`.
- Resolution transaction: `0xb8a5560a16200d36e1a7cbd7eada8a39a5798b8157ff9ed25ac441ea6ab0bf2d`
- Resolution verdict: `2`, decision `UPHOLD`, reason `NO_MATERIAL_CONTRADICTION`
- Final authoritative namespace status: `VERIFIED`; active challenge cleared.

## Validation and release notes

- Pre-deployment CI run: [33024828677](https://github.com/ometere123/gns/actions/runs/33024828677), green on `b09652b2456178c18d65221ca7a20c195efcf82a`.
- Direct Mode: `37 passed`.
- Foundry: `17 passed`.
- npm audit: `0` vulnerabilities at high threshold.
- Production build: passed.
- The redirect behavior of `gl.nondet.web.request` was not independently established by this live flow; no redirect-trampoline guarantee is claimed.
- The v2 registry is historical. v3 is a fresh testnet generation; no ownership migration was fabricated.
- Unconsumed Arc payments have no permissionless refund/recovery path in this testnet release. Production hardening should add escrow, expiry/refund recovery, or payment-intent settlement.

## Current generation-2 deployment (intent-bound receipts)

- Deployment source commit: `30d8a55` (contract source was frozen before deployment; later commits contain evidence/docs only).
- Arc router: `0x7D6EBe8032F46e36344255B46Af2729450E66181`; deployment tx `0x493d89804f4947688b2777d4ccecee69627b7365a9c6d960ad3c8bae2da46465`; version `1.1.0-arc-usdc-intents`; admin/treasury `0x231EF01E282385eC2E22394469f1C8c6C28Fd6b1`; prices `5000000`/`3000000` USDC base units/year.
- GenLayer registry: `0xC4a7eBa85099E5018B1AdE939a47b42558c4729d`; deployment tx `0x364b4ab8ea8231ae417bacc6df44b5bad79dcac47255712e17d1243a396505f9`; version `2.2.0-arc-usdc-intents`; bound router above.
- GNSAuthenticity: `0x777C16142C951cf44589D24201573d12A431532c`; deployment tx `0x6f46f802aa6e3ce2b1c37b762e73e72d826fa4fdccde06b02a8190dd2d16466e`; version `2.1.0-authenticity-refresh`; registry dependency above; policy `gns-auth-v2`.
- Namespace: `gnsv31787841878.gen`; owner/shared Arc payer `0x231EF01E282385eC2E22394469f1C8c6C28Fd6b1`.
- Reservation tx `0x1dde587638344d89d481430b4c46bc58c14bf067856b2c5db5eb18b8172ba260`; reservation expiry `1787843693`; registration intent hash `0x4ebd13816f7711b19bc3eb6d949fdfbf019e17b477b6af66e81c7228504c9af6`.
- Arc registration payment tx `0x2e1d59bb9fd6c8d90b96d02b53e6614506e9f00d236e936fdbf1f193ab27f590`, PaymentRecorded log index `31`, amount `5000000`; GenLayer registration tx `0x2bc84db7bc2903cf5fedeac9c601cbbc9753966b4f8bd2d20eff606674ab13d9`; consumed proof `true`.
- Renewal intent hash `0x25540f5d534ee23eb4681b6766b48ab1d39225a2cafa099ec9c53a51ae609f49`; Arc renewal tx `0x8ec7ddc01e3e28e3feb6fe5e2528b156af784374769c5dd3c8d2aab78419fbf8`, log index `23`, amount `3000000`; GenLayer renewal tx `0x16c92c0732e544e62312adef99e79d640f5108d491c1db1ca989f122e06ab6b8`; expiry `1819377983` → `1850913983`.
- Truthful GitHub record: `https://github.com/ometere123/gns`; record tx `0x11e9a97c2a4bb0950fbd6521bf7a72bb447c9a4b83eb3bcb39901ea87f29621e`.
- Claim `1`, create tx `0x032a5454e7fccf7b4927376e866757fa2d724d716db58d565ef674aca151da07`; attestation URL `https://raw.githubusercontent.com/ometere123/gns/v3-arc-usdc/evidence/v3-gen2-gns-claim.json`; anonymous retrieval HTTP 200; corroborating URL `https://github.com/ometere123/gns`.
- Verification tx `0xc2941b5cfad596009098ebf16e8464385a019ff7478cbdcc88646f24fe2f0bd9`; verdict `1`, decision `VERIFIED`, reason `VALID_ATTESTATION`, evidence expiry `1788360693`.
- Challenger `0x268a14adb45e9cccdf950fb1e4c2ac4f226b6ef5`; challenge `1`, tx `0x409f7505f1063d210e168a14d7270b361a4c9c2a922f5917ad3e3118df5fedd6`; benign evidence `https://github.com/ometere123/gns`; VERIFIED remained authoritative while OPEN.
- Resolution tx `0xc77795a391494a92ceb420b75eac1a1684b774aa1d4be7378db584ccc0c390f8`; verdict `2`, decision `UPHOLD`; final authoritative state `VERIFIED`, active challenge cleared.
- Current source hashes: router `pending final re-computation`; registry `pending final re-computation`; authenticity `pending final re-computation`.
- CI for the frozen source: [33083018380](https://github.com/ometere123/gns/actions/runs/33083018380), green. The post-proof documentation/evidence tip is tracked separately from deployed source.
