# GNS Contract

`GNSRegistry.py` is the source of truth for the GenLayer Naming Service.

Deployed (Studionet): `0x44a224BF67a4fB17a3a0f0585958dCCc1dfA1AD2`

Contract version: `1.3.0-web-evidence`

See `../docs/deploy-genlayer.md` for the redeploy steps.

## Surface (summary)

- View: `is_available`, `resolve`, `resolve_address`, `reverse_lookup`, `get_records`, `get_names_by_owner`, `get_subnames`, `get_report`, `get_total_names`, `get_total_reports`, `get_total_evidence`, `get_web_evidence`, `get_name_status`, `get_ai_status`, `contract_version`.
- Write: `register`, `renew`, `transfer`, `set_primary_address`, `set_primary_name`, `set_records`, `clear_record`, `create_subname`, `transfer_subname`, `report_name`, `verify_name_url`, `admin_set_report_status`, `admin_flag_name`, `admin_unflag_name`, `admin_transfer_admin`.
- AI (Equivalence Principle): `ai_review_name`, `ai_review_report`, `ai_verify_project_claim`, `ai_suggest_names`.

## Consensus model

- `ai_review_name`, `ai_review_report`, and `ai_verify_project_claim` use `gl.eq_principle.prompt_comparative` because they can affect verification, risk, report status, or name status.
- `ai_suggest_names` uses `prompt_non_comparative` only as an advisory, non-mutating suggestion tool.
- `verify_name_url` uses `gl.nondet.web.request` and `gl.eq_principle.strict_eq` to store validator-agreed URL evidence and SHA-256 response hashes.
- Stored AI review objects include `consensus_method` for auditability.

## Validation rules

- Labels: 3–32 chars, lowercase letters / digits / hyphen; hyphen not at edges; no dots.
- Subnames: 2–32 chars, same alphabet.
- Records: only the allowed keys; each value ≤ 500 chars.
- Reports: reason ≤ 80, evidence URL ≤ 300, comment ≤ 700.
