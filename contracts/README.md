# GNS Contract

`GNSRegistry.py` is the source of truth for the GenLayer Naming Service.

Deployed (Studionet): `0x141c3e53ae4Ad24B07405CC0fb4D12ccc3A3007A`

See `../docs/deploy-genlayer.md` for the redeploy steps.

## Surface (summary)

- View: `is_available`, `resolve`, `resolve_address`, `reverse_lookup`, `get_records`, `get_names_by_owner`, `get_subnames`, `get_report`, `get_total_names`, `get_total_reports`, `get_name_status`, `get_ai_status`, `contract_version`.
- Write: `register`, `renew`, `transfer`, `set_primary_address`, `set_primary_name`, `set_records`, `clear_record`, `create_subname`, `transfer_subname`, `report_name`, `admin_set_report_status`, `admin_flag_name`, `admin_unflag_name`, `admin_transfer_admin`.
- AI (Equivalence Principle): `ai_review_name`, `ai_review_report`, `ai_verify_project_claim`, `ai_suggest_names`.

## Validation rules

- Labels: 3–32 chars, lowercase letters / digits / hyphen; hyphen not at edges; no dots.
- Subnames: 2–32 chars, same alphabet.
- Records: only the allowed keys; each value ≤ 500 chars.
- Reports: reason ≤ 80, evidence URL ≤ 300, comment ≤ 700.
