from pathlib import Path


def replace_once(path: str, old: str, new: str) -> None:
    p = Path(path)
    text = p.read_text()
    if old not in text:
        raise SystemExit(f"Expected patch target not found in {path}: {old[:80]!r}")
    if text.count(old) != 1:
        raise SystemExit(f"Expected exactly one patch target in {path}, found {text.count(old)}")
    p.write_text(text.replace(old, new, 1))


contract = "contracts/GNSAuthenticity.py"

# 1) Fail closed without bare Python exceptions (keeps GenVM lint warning-free).
replace_once(
    contract,
    '''            if decision not in allowed:\n                raise ValueError("invalid decision")\n            if reason_code == "" or len(reason_code) > 80:\n                raise ValueError("invalid reason")\n            return {\n                "decision": decision,\n                "reason_code": reason_code,\n                "summary": str(parsed.get("summary", ""))[:500],\n            }\n''',
    '''            if decision not in allowed or reason_code == "" or len(reason_code) > 80:\n                return {\n                    "decision": "INSUFFICIENT_EVIDENCE",\n                    "reason_code": fallback_reason,\n                    "summary": "Consensus output did not satisfy the verdict schema.",\n                }\n            return {\n                "decision": decision,\n                "reason_code": reason_code,\n                "summary": str(parsed.get("summary", ""))[:500],\n            }\n''',
)

# 2) Missing/expired claimant proof means the prior claim is no longer freshly
#    supportable; it is not affirmative evidence of impersonation and must not
#    be converted into REVOKE by a challenger.
replace_once(
    contract,
    '''        if int(attestation.get("count", 0)) < 1:\n            return {\n                "decision": "REVOKE",\n                "reason_code": "CLAIMANT_ATTESTATION_NO_LONGER_VALID",\n                "summary": "The previously verified source-bound wallet attestation is no longer valid.",\n                "evidence_digest": combined_digest,\n                "evidence_expires_at": 0,\n            }\n''',
    '''        if int(attestation.get("count", 0)) < 1:\n            return {\n                "decision": "INSUFFICIENT_EVIDENCE",\n                "reason_code": "CLAIMANT_ATTESTATION_NO_LONGER_VALID",\n                "summary": "The previously verified source-bound wallet attestation can no longer be validated; freshness must be restored before the identity can remain authoritative.",\n                "evidence_digest": combined_digest,\n                "evidence_expires_at": 0,\n            }\n''',
)

# 3) Add explicit deterministic state-transition helpers. They are deliberately
#    separate from nondeterministic evaluation so Direct Mode can regression-test
#    the burden-of-proof semantics without mocking web/LLM calls.
anchor = '''    def _evaluate_claim(\n'''
helpers = '''    def _open_challenge_state(self, claim, verification, challenge_id: str):\n        claim["active_challenge_id"] = challenge_id\n        claim["status"] = "CHALLENGED"\n        verification["challenge_id"] = challenge_id\n        verification["challenge_status"] = "OPEN"\n        # Do not overwrite verification["status"]. A challenge is an allegation,\n        # not a revocation. The existing finalized verdict remains authoritative\n        # until a later finalized resolution proves otherwise.\n        return {"claim": claim, "verification": verification}\n\n    def _apply_challenge_resolution_state(\n        self,\n        claim,\n        verification,\n        challenge_id: str,\n        verdict_id: str,\n        decision: str,\n        reason_code: str,\n        evidence_expires_at: int,\n        now_ts: int,\n    ):\n        claim["active_challenge_id"] = ""\n        verification["last_challenge_id"] = challenge_id\n        verification["last_challenge_verdict_id"] = verdict_id\n        verification["challenge_id"] = ""\n        verification["challenge_status"] = decision\n\n        if decision == "REVOKE":\n            claim["status"] = "REVOKED"\n            verification["status"] = "REVOKED"\n            verification["verdict_id"] = verdict_id\n            verification["revoked_at"] = now_ts\n            verification["revocation_reason"] = reason_code\n            verification["evidence_expires_at"] = 0\n        elif decision == "UPHOLD":\n            claim["status"] = "VERIFIED"\n            verification["status"] = "VERIFIED"\n            verification["last_challenge_resolved_at"] = now_ts\n            if evidence_expires_at > 0:\n                verification["evidence_expires_at"] = evidence_expires_at\n        elif reason_code == "CLAIMANT_ATTESTATION_NO_LONGER_VALID":\n            # Loss of fresh claimant proof is staleness, not proof of fraud.\n            claim["status"] = "INSUFFICIENT_EVIDENCE"\n            verification["status"] = "STALE"\n            verification["invalidation_reason"] = reason_code\n            verification["evidence_expires_at"] = 0\n        else:\n            # The challenger did not meet the burden for revocation. Preserve the\n            # prior finalized verification instead of allowing challenge griefing.\n            claim["status"] = "VERIFIED"\n            verification["status"] = "VERIFIED"\n            verification["last_challenge_resolved_at"] = now_ts\n            if evidence_expires_at > 0:\n                verification["evidence_expires_at"] = evidence_expires_at\n\n        return {"claim": claim, "verification": verification}\n\n'''
replace_once(contract, anchor, helpers + anchor)

# 4) A challenge can only be opened against a currently effective verification.
replace_once(
    contract,
    '''        if str(claim.get("active_challenge_id", "")) != "":\n            raise gl.vm.UserError("Claim already has an active challenge")\n\n        clean_reason = str(reason_code).strip().upper()\n''',
    '''        if str(claim.get("active_challenge_id", "")) != "":\n            raise gl.vm.UserError("Claim already has an active challenge")\n        effective_verification = self._effective_verification(namespace)\n        if str(effective_verification.get("status", "")) != "VERIFIED":\n            raise gl.vm.UserError("Namespace does not have a current verified authenticity state")\n\n        clean_reason = str(reason_code).strip().upper()\n''',
)

# 5) Opening a challenge preserves the finalized verification status and only
#    attaches an OPEN challenge marker.
replace_once(
    contract,
    '''        claim["active_challenge_id"] = challenge_id\n        claim["status"] = "CHALLENGED"\n        self.claims[str(claim_id)] = self._dump(claim)\n        verification = self._verification_obj(namespace)\n        verification["status"] = "CHALLENGED"\n        verification["challenge_id"] = challenge_id\n        self.namespace_verifications[namespace] = self._dump(verification)\n''',
    '''        transition = self._open_challenge_state(\n            claim, effective_verification, challenge_id\n        )\n        claim = transition["claim"]\n        verification = transition["verification"]\n        self.claims[str(claim_id)] = self._dump(claim)\n        self.namespace_verifications[namespace] = self._dump(verification)\n''',
)

# 6) Resolution has an explicit burden of proof: only REVOKE removes a verified
#    state; weak/inconclusive challenges preserve it, while loss of claimant proof
#    makes it STALE rather than fraudulently REVOKED.
replace_once(
    contract,
    '''        claim["active_challenge_id"] = ""\n        verification = self._verification_obj(namespace)\n        verification["verdict_id"] = verdict_id\n\n        if decision == "REVOKE":\n            claim["status"] = "REVOKED"\n            verification["status"] = "REVOKED"\n            verification["revoked_at"] = self._now()\n            verification["revocation_reason"] = verdict["reason_code"]\n            verification["evidence_expires_at"] = 0\n        elif decision == "UPHOLD":\n            claim["status"] = "VERIFIED"\n            verification["status"] = "VERIFIED"\n            verification["last_challenge_resolved_at"] = self._now()\n            verification["evidence_expires_at"] = int(\n                verdict.get("evidence_expires_at", 0)\n            )\n        else:\n            claim["status"] = "INSUFFICIENT_EVIDENCE"\n            verification["status"] = "INCONCLUSIVE"\n        self.claims[claim_id] = self._dump(claim)\n        self.namespace_verifications[namespace] = self._dump(verification)\n''',
    '''        verification = self._verification_obj(namespace)\n        transition = self._apply_challenge_resolution_state(\n            claim,\n            verification,\n            str(challenge_id),\n            verdict_id,\n            decision,\n            str(verdict.get("reason_code", "UNKNOWN")),\n            int(verdict.get("evidence_expires_at", 0)),\n            self._now(),\n        )\n        claim = transition["claim"]\n        verification = transition["verification"]\n        self.claims[claim_id] = self._dump(claim)\n        self.namespace_verifications[namespace] = self._dump(verification)\n''',
)

# Type surface for public pending/resolved challenge metadata.
types = "src/lib/gns/authenticity-types.ts"
replace_once(
    types,
    '''  challenge_id?: string;\n  invalidation_reason?: string;\n''',
    '''  challenge_id?: string;\n  challenge_status?: "OPEN" | "UPHOLD" | "REVOKE" | "INSUFFICIENT_EVIDENCE";\n  last_challenge_id?: string;\n  last_challenge_verdict_id?: string;\n  invalidation_reason?: string;\n''',
)

# Public UI: keep VERIFIED as the primary badge but disclose an open challenge.
status = "src/components/AuthenticityStatusCard.tsx"
replace_once(
    status,
    '''        <Badge tone={tone(status)}>{status}</Badge>\n''',
    '''        <div className="flex flex-wrap items-center gap-2">\n          <Badge tone={tone(status)}>{status}</Badge>\n          {verification?.challenge_status === "OPEN" && (\n            <Badge tone="blue">Challenge pending</Badge>\n          )}\n        </div>\n''',
)
replace_once(
    status,
    '''      {verification?.invalidation_reason && status === "STALE" && (\n''',
    '''      {verification?.challenge_status === "OPEN" && status === "VERIFIED" && (\n        <p className="text-sm text-muted">\n          A challenge is open, but the prior finalized verification remains authoritative unless a finalized resolution revokes it.\n        </p>\n      )}\n\n      {verification?.invalidation_reason && status === "STALE" && (\n''',
)

# Direct Mode regression tests for burden-of-proof semantics.
test_path = Path("tests/direct/test_authenticity_security.py")
test_text = test_path.read_text()
extra_tests = r'''


def verified_state():
    return {
        "status": "VERIFIED",
        "claim_id": "7",
        "verdict_id": "11",
        "subject_hash": "subject",
        "policy_version": "gns-auth-v2",
        "evidence_expires_at": NOW + 3600,
    }


def verified_claim():
    return {
        "id": "7",
        "namespace": "meritra.gen",
        "status": "VERIFIED",
        "active_challenge_id": "",
    }


def test_open_challenge_does_not_remove_finalized_verification(direct_deploy):
    contract = deploy(direct_deploy)
    transition = contract._open_challenge_state(verified_claim(), verified_state(), "9")
    assert transition["claim"]["status"] == "CHALLENGED"
    assert transition["verification"]["status"] == "VERIFIED"
    assert transition["verification"]["challenge_status"] == "OPEN"


def test_inconclusive_challenge_preserves_prior_verification(direct_deploy):
    contract = deploy(direct_deploy)
    transition = contract._apply_challenge_resolution_state(
        verified_claim(),
        verified_state(),
        "9",
        "12",
        "INSUFFICIENT_EVIDENCE",
        "NO_RETRIEVABLE_CHALLENGER_EVIDENCE",
        NOW + 3600,
        NOW,
    )
    assert transition["claim"]["status"] == "VERIFIED"
    assert transition["verification"]["status"] == "VERIFIED"
    assert transition["verification"]["verdict_id"] == "11"
    assert transition["verification"]["last_challenge_verdict_id"] == "12"


def test_only_revoke_replaces_authoritative_verdict(direct_deploy):
    contract = deploy(direct_deploy)
    transition = contract._apply_challenge_resolution_state(
        verified_claim(),
        verified_state(),
        "9",
        "12",
        "REVOKE",
        "IMPERSONATION_PROVEN",
        0,
        NOW,
    )
    assert transition["claim"]["status"] == "REVOKED"
    assert transition["verification"]["status"] == "REVOKED"
    assert transition["verification"]["verdict_id"] == "12"


def test_lost_claimant_attestation_becomes_stale_not_revoked(direct_deploy):
    contract = deploy(direct_deploy)
    transition = contract._apply_challenge_resolution_state(
        verified_claim(),
        verified_state(),
        "9",
        "12",
        "INSUFFICIENT_EVIDENCE",
        "CLAIMANT_ATTESTATION_NO_LONGER_VALID",
        0,
        NOW,
    )
    assert transition["claim"]["status"] == "INSUFFICIENT_EVIDENCE"
    assert transition["verification"]["status"] == "STALE"
    assert transition["verification"]["verdict_id"] == "11"
'''
if "test_open_challenge_does_not_remove_finalized_verification" in test_text:
    raise SystemExit("Hardening regression tests already present")
test_path.write_text(test_text.rstrip() + extra_tests + "\n")

# Remove this one-shot script from the final tree. The workflow remains until
# the caller removes it after confirming the bot commit landed.
Path(__file__).unlink()
print("Applied GNS authenticity hardening patch")
