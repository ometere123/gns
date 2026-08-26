import json


REGISTRY = "0x" + "1" * 40
AUTHENTICITY = "0x" + "2" * 40
OWNER = "0x" + "3" * 40
OTHER_WALLET = "0x" + "4" * 40
NOW = 1_787_730_000


def deploy(direct_deploy):
    # The contract's Studionet runner pin is intentionally left unchanged.
    # genlayer-test 0.29.x can mis-resolve that pin to the rc7 bundle, whose
    # legacy asset name is no longer published. Direct Mode supports an
    # explicit SDK bundle; v0.2.16 contains this runner/API family.
    return direct_deploy(
        "contracts/GNSAuthenticity.py",
        REGISTRY,
        sdk_version="v0.2.16",
    )


def registry_snapshot():
    return {
        "full_name": "meritra.gen",
        "owner": OWNER,
        "primary_address": OWNER,
        "status": "active",
        "records": {
            "website": "https://meritra.example",
            "github": "https://github.com/ometere123/meritra",
            "x": "@meritra",
            "agent": "https://agent.meritra.example",
        },
    }


def attestation(**overrides):
    value = {
        "protocol": "gns-claim-v2",
        "namespace": "meritra.gen",
        "wallet": OWNER,
        "registry": REGISTRY,
        "authenticity_contract": AUTHENTICITY,
        "claim_id": "7",
        "challenge": "nonce-7",
        "policy_version": "gns-auth-v2",
        "issued_at": NOW - 60,
        "expires_at": NOW + 3600,
    }
    value.update(overrides)
    return value


def fetched(url, body, *, ok=True, status=200):
    return {
        "type": "attestation",
        "url": url,
        "ok": ok,
        "status_code": status,
        "body": json.dumps(body),
        "sha256": "test",
    }


def check(contract, source):
    return contract._wallet_attestation_result(
        [source],
        registry_snapshot(),
        "meritra.gen",
        OWNER,
        "7",
        "nonce-7",
        "gns-auth-v2",
        REGISTRY,
        AUTHENTICITY,
        NOW,
    )


def test_rejects_duplicate_evidence_urls(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    manifest = json.dumps(
        [
            {"type": "website", "url": "https://meritra.example/proof"},
            {"type": "github", "url": "https://meritra.example/proof"},
        ]
    )
    with direct_vm.expect_revert("Duplicate evidence URLs"):
        contract._parse_manifest(manifest)


def test_rejects_non_https_evidence(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    manifest = json.dumps(
        [{"type": "website", "url": "http://meritra.example/proof"}]
    )
    with direct_vm.expect_revert("Every evidence URL must be https"):
        contract._parse_manifest(manifest)


def test_registered_website_can_host_attestation(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(),
    )
    result = check(contract, source)
    assert result["count"] == 1
    assert result["earliest_expiry"] == NOW + 3600


def test_registered_github_repo_can_host_raw_attestation(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://raw.githubusercontent.com/ometere123/meritra/abc123/gns-claim.json",
        attestation(),
    )
    assert check(contract, source)["count"] == 1


def test_arbitrary_host_cannot_be_ownership_proof(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched("https://attacker.example/claim.json", attestation())
    assert check(contract, source)["count"] == 0


def test_wrong_wallet_cannot_be_ownership_proof(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(wallet=OTHER_WALLET),
    )
    assert check(contract, source)["count"] == 0


def test_wrong_claim_id_cannot_be_replayed(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(claim_id="6"),
    )
    assert check(contract, source)["count"] == 0


def test_wrong_nonce_cannot_be_replayed(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(challenge="old-nonce"),
    )
    assert check(contract, source)["count"] == 0


def test_wrong_registry_or_authenticity_contract_fails_binding(direct_deploy):
    contract = deploy(direct_deploy)
    wrong_registry = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(registry="0x" + "5" * 40),
    )
    wrong_auth = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(authenticity_contract="0x" + "6" * 40),
    )
    assert check(contract, wrong_registry)["count"] == 0
    assert check(contract, wrong_auth)["count"] == 0


def test_expired_attestation_is_not_valid(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(issued_at=NOW - 7200, expires_at=NOW - 1),
    )
    assert check(contract, source)["count"] == 0


def test_attestation_lifetime_is_bounded(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(issued_at=NOW, expires_at=NOW + 8 * 24 * 60 * 60),
    )
    assert check(contract, source)["count"] == 0


def test_failed_http_source_never_counts(direct_deploy):
    contract = deploy(direct_deploy)
    source = fetched(
        "https://meritra.example/.well-known/gns-claim.json",
        attestation(),
        ok=False,
        status=404,
    )
    assert check(contract, source)["count"] == 0


def test_invalid_model_output_fails_closed(direct_deploy):
    contract = deploy(direct_deploy)
    result = contract._safe_decision(
        "not-json",
        ["VERIFIED", "REJECTED", "INSUFFICIENT_EVIDENCE"],
        "INVALID_MODEL_OUTPUT",
    )
    assert result["decision"] == "INSUFFICIENT_EVIDENCE"
    assert result["reason_code"] == "INVALID_MODEL_OUTPUT"


def test_disallowed_model_decision_fails_closed(direct_deploy):
    contract = deploy(direct_deploy)
    result = contract._safe_decision(
        json.dumps({"decision": "TRUST_ME", "reason_code": "OK"}),
        ["VERIFIED", "REJECTED", "INSUFFICIENT_EVIDENCE"],
        "INVALID_MODEL_OUTPUT",
    )
    assert result["decision"] == "INSUFFICIENT_EVIDENCE"
