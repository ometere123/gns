from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Patch target missing in {path}: {old[:100]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"Patch target count in {path}: {text.count(old)}")
    p.write_text(text.replace(old, new, 1))


contract = "contracts/GNSAuthenticity.py"

replace_once(
    contract,
    '''        elif reason_code == "CLAIMANT_ATTESTATION_NO_LONGER_VALID":\n            # Loss of fresh claimant proof is staleness, not proof of fraud.\n            claim["status"] = "INSUFFICIENT_EVIDENCE"\n            verification["status"] = "STALE"\n            verification["invalidation_reason"] = reason_code\n            verification["evidence_expires_at"] = 0\n''',
    '''        elif decision == "STALE":\n            # Loss of fresh claimant proof is staleness, not proof of fraud.\n            claim["status"] = "INSUFFICIENT_EVIDENCE"\n            verification["status"] = "STALE"\n            verification["invalidation_reason"] = reason_code\n            verification["evidence_expires_at"] = 0\n''',
)

replace_once(
    contract,
    '''        if int(attestation.get("count", 0)) < 1:\n            return {\n                "decision": "INSUFFICIENT_EVIDENCE",\n                "reason_code": "CLAIMANT_ATTESTATION_NO_LONGER_VALID",\n                "summary": "The previously verified source-bound wallet attestation can no longer be validated; freshness must be restored before the identity can remain authoritative.",\n                "evidence_digest": combined_digest,\n                "evidence_expires_at": 0,\n            }\n''',
    '''        if int(attestation.get("count", 0)) < 1:\n            return {\n                "decision": "STALE",\n                "reason_code": "CLAIMANT_ATTESTATION_NO_LONGER_VALID",\n                "summary": "The previously verified source-bound wallet attestation can no longer be validated; freshness must be restored before the identity can remain authoritative.",\n                "evidence_digest": combined_digest,\n                "evidence_expires_at": 0,\n            }\n''',
)

# There are exactly two validator comparisons: positive claim and challenge.
old_cmp = '''            return str(leader.get("decision", "")) == str(\n                validator.get("decision", "")\n            )\n'''
new_cmp = '''            return (\n                str(leader.get("decision", ""))\n                == str(validator.get("decision", ""))\n                and int(leader.get("evidence_expires_at", 0))\n                == int(validator.get("evidence_expires_at", 0))\n            )\n'''
p = Path(contract)
text = p.read_text()
if text.count(old_cmp) != 2:
    raise SystemExit(f"Expected 2 validator comparison blocks, found {text.count(old_cmp)}")
p.write_text(text.replace(old_cmp, new_cmp))

# Type-level truth: STALE can be the deterministic resolution of a challenge.
types = "src/lib/gns/authenticity-types.ts"
replace_once(
    types,
    '''  challenge_status?: "OPEN" | "UPHOLD" | "REVOKE" | "INSUFFICIENT_EVIDENCE";\n''',
    '''  challenge_status?: "OPEN" | "UPHOLD" | "REVOKE" | "STALE" | "INSUFFICIENT_EVIDENCE";\n''',
)
replace_once(
    types,
    '''  status: "OPEN" | "UPHOLD" | "REVOKE" | "INSUFFICIENT_EVIDENCE";\n''',
    '''  status: "OPEN" | "UPHOLD" | "REVOKE" | "STALE" | "INSUFFICIENT_EVIDENCE";\n''',
)
replace_once(
    types,
    '''    | "UPHOLD"\n    | "REVOKE";\n''',
    '''    | "UPHOLD"\n    | "REVOKE"\n    | "STALE";\n''',
)

# Regression test now exercises STALE as an explicit decision-bearing field.
test_path = "tests/direct/test_authenticity_security.py"
replace_once(
    test_path,
    '''        "INSUFFICIENT_EVIDENCE",\n        "CLAIMANT_ATTESTATION_NO_LONGER_VALID",\n''',
    '''        "STALE",\n        "CLAIMANT_ATTESTATION_NO_LONGER_VALID",\n''',
)

# Add a static regression guard that equivalence checks expiry in both consensus paths.
p = Path(test_path)
text = p.read_text()
extra = r'''


def test_consensus_compares_expiry_as_state_bearing_field():
    source = Path("contracts/GNSAuthenticity.py").read_text()
    comparison = 'and int(leader.get("evidence_expires_at", 0))'
    assert source.count(comparison) == 2
'''
if "test_consensus_compares_expiry_as_state_bearing_field" not in text:
    p.write_text(text.rstrip() + extra + "\n")

Path(__file__).unlink()
print("Applied consensus-field hardening")
