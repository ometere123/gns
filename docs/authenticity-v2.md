# GNS Authenticity v2

## Purpose

GNS v2 separates deterministic namespace infrastructure from the GenLayer-specific trust problem.

The registry answers deterministic questions such as:

- who owns a `.gen` namespace;
- which address it resolves to;
- which records the owner stored;
- whether a name is expired;
- which subnames exist.

`GNSAuthenticity` answers the judgment question:

> Does the current wallet controlling this namespace have sufficient fresh, independently retrievable evidence to legitimately claim the project, agent, organization, or public identity attached to it?

It also resolves evidence-based challenges to previously verified claims.

## Mapping to the prior review

### 1. “Stable URL content is treated as proof of ownership”

V2 does not treat successful fetches or stable bytes as ownership proof.

A positive claim requires a source-bound wallet attestation containing:

- protocol version;
- namespace;
- current registry-owner wallet;
- configured registry contract;
- dedicated authenticity contract;
- claim id;
- unique challenge nonce;
- policy version;
- issue time;
- expiry time.

The attestation must be fetched from a source authorized by current registry records. A valid JSON document hosted on an unrelated HTTPS domain is rejected.

### 2. “Several identity and project reviews do not fetch their cited evidence”

Every v2 verdict-bearing path fetches evidence during its own nondeterministic execution.

`verify_claim()` fetches the entire claimant manifest.

`resolve_challenge()` fetches:

- the claimant's original evidence again; and
- the challenger's evidence.

Stored URL strings and old response hashes are not substitutes for fresh verdict-time evidence.

### 3. “A name service based on IC is not a proper GenLayer use case”

The name service is no longer presented as the GenLayer-specific use case.

`GNSRegistry` remains namespace infrastructure.

`GNSAuthenticity` is a separate contract whose reason for using GenLayer is evidence interpretation and dispute adjudication under validator consensus.

## Trust boundaries

### Trusted deterministic state

Before nondeterministic execution begins, the authenticity contract snapshots:

- namespace;
- current registry owner;
- primary address;
- registered identity sources;
- configured registry address;
- policy version;
- claim/challenge state;
- transaction time.

Nondeterministic leader/validator functions receive these snapshots as plain values and do not depend on mutable contract storage.

### Untrusted inputs

The following are always treated as untrusted:

- claimant context;
- challenger context;
- fetched webpage content;
- fetched repository content;
- arbitrary text inside attestations beyond the fields checked deterministically.

Prompts explicitly instruct the model not to follow instructions embedded in untrusted evidence.

## Source authorization

A wallet-bound attestation only counts if its URL is authorized by the namespace's current registry records.

Supported source relationships in the current policy:

1. **Registered website** — the attestation URL equals the website record or is beneath its path.
2. **Registered agent endpoint** — the attestation URL equals the agent endpoint or is beneath its path.
3. **Registered GitHub repository** — the attestation is under the registered repository URL or the matching `raw.githubusercontent.com/<owner>/<repo>/...` path.

This prevents a claimant from copying valid-looking JSON to an unrelated host and calling it proof.

## Claim state machine

```text
UNVERIFIED
    │
    ▼
PENDING_EVIDENCE
    │ verify_claim
    ├──────────────► VERIFIED
    ├──────────────► REJECTED
    └──────────────► INSUFFICIENT_EVIDENCE

VERIFIED
    │ challenge_claim
    ▼
CHALLENGED
    │ resolve_challenge
    ├──────────────► VERIFIED / UPHOLD
    ├──────────────► REVOKED
    └──────────────► INCONCLUSIVE
```

Creating a newer claim supersedes the older namespace claim. An open challenge against a superseded claim is also marked superseded.

## Subject binding

A claim records a subject hash over:

```text
namespace
registry address
current registry owner
primary address
website record
github record
x record
agent record
policy version
```

The hash is recalculated from the live registry state before verification and challenge resolution.

A different owner or changed identity record therefore cannot inherit the old authenticity claim.

## Evidence freshness

Attestations have bounded validity.

Current policy:

- issue time required;
- expiry required;
- expiry must be after issue time;
- maximum lifetime: seven days;
- future issue-time skew: five minutes;
- expired attestations are invalid.

The earliest valid attestation expiry is recorded with the verdict. A previously `VERIFIED` namespace becomes effectively `STALE` when the evidence expires.

## Positive verification algorithm

`verify_claim(claim_id)` performs:

1. Verify the claim exists and is the latest claim for the namespace.
2. Require the caller to be the claim wallet.
3. Require the claim policy version to still be current.
4. Read the namespace from the configured registry.
5. Recalculate the subject hash.
6. Snapshot deterministic state and time.
7. Enter explicit GenLayer nondeterministic consensus.
8. Each execution fetches all evidence URLs.
9. Ignore failed HTTP responses for proof purposes.
10. Find at least one attestation that:
    - comes from an authorized registered source;
    - binds to the correct wallet, namespace, registry, authenticity contract, claim id, nonce and policy;
    - passes freshness rules.
11. For project/organization/public-identity claims, require at least one additional retrievable source.
12. Ask the LLM only the remaining subjective question: whether the corpus substantively supports the claimed relationship.
13. Fail malformed/disallowed model output to `INSUFFICIENT_EVIDENCE`.
14. Validators independently reproduce the decision.
15. Consensus compares the decision-bearing outcome.
16. Store the finalized verdict provenance, evidence digest and evidence expiry.

## Challenge algorithm

`resolve_challenge(challenge_id)` performs:

1. Verify the open challenge references the latest claim.
2. Re-read current registry state.
3. Recalculate the subject hash.
4. Fetch the claimant's original evidence again.
5. Fetch all challenger evidence.
6. Revoke deterministically if:
   - the registry owner changed;
   - identity-bound registry state changed; or
   - the original source-bound wallet attestation is no longer valid.
7. Return insufficient evidence if no challenger source can be retrieved.
8. Otherwise ask validators whether the fresh challenger corpus materially defeats the claim.
9. Finalize `UPHOLD`, `REVOKE`, or `INSUFFICIENT_EVIDENCE`.

The challenger cannot obtain a revocation merely by submitting accusatory text.

## Equivalence design

V2 uses explicit leader/validator execution rather than a generic one-shot review wrapper.

The implementation deliberately does not require exact equality of volatile webpage bytes or free-form prose. Dynamic pages can differ harmlessly between validator fetches.

The consensus-critical comparison focuses on the final decision. The leader still stores an evidence digest and structured reason code for auditability.

Deterministic proof checks are performed before LLM judgment wherever possible.

## Finality

The authenticity frontend uses strict `FINALIZED` waits for authoritative writes:

- claim creation;
- verification;
- challenge creation;
- challenge resolution;
- explicit status refresh.

A timeout/finality failure is surfaced rather than silently treated as success.

This prevents an `ACCEPTED` transaction from being displayed as final authenticity state.

## Legacy registry AI methods

The currently deployed `GNSRegistry.py` still contains older experimental functions such as project/name/report AI review. They remain in the source because the deployed registry already exposes them.

They are not authoritative in v2:

- the v2 public profile does not read `ai_status.verified` as identity verification;
- the management UI does not call legacy project verification;
- the disputes UI does not call legacy report review;
- `src/lib/gns/contract.ts` no longer exports those verdict-mutating write helpers.

The advisory name-suggestion method may remain because it has no trust-state consequence.

## Security test matrix

The Direct Mode suite targets at least these cases:

| Case | Expected |
| --- | --- |
| duplicate evidence URL | reject manifest |
| non-HTTPS evidence | reject manifest |
| registered website attestation | eligible proof |
| registered GitHub raw attestation | eligible proof |
| arbitrary host with copied JSON | not ownership proof |
| wrong wallet | reject attestation |
| wrong claim id | reject replay |
| wrong nonce | reject replay |
| wrong registry | reject binding |
| wrong authenticity contract | reject binding |
| expired attestation | reject |
| overlong attestation lifetime | reject |
| 404/failed fetch | never count as proof |
| malformed model output | insufficient evidence |
| disallowed model decision | insufficient evidence |

Studionet smoke testing is separate because full lifecycle testing requires two contracts and a claim-specific attestation to be published after claim creation.

## Deployment sequence

1. Use the existing deployed GNS registry or deploy a registry instance.
2. Set `NEXT_PUBLIC_GNS_CONTRACT_ADDRESS`.
3. Deploy the authenticity contract:

```bash
npm run deploy:authenticity
```

4. The script waits for finality and sets `NEXT_PUBLIC_GNS_AUTHENTICITY_CONTRACT_ADDRESS` in `.env.local`.
5. Run inspection smoke checks:

```bash
npm run smoke:authenticity
```

6. Create a real claim from an owner wallet, publish its generated attestation on the registered source, then execute the verification mode described by the smoke helper / frontend.

## Non-goals

GNS authenticity does not claim to provide:

- legal identity;
- trademark ownership adjudication;
- public DNS ownership;
- official GenLayer endorsement of a project;
- permanent verification independent of changing evidence.

It provides a transparent, evidence-grounded protocol verdict tied to the current namespace state and declared policy.
