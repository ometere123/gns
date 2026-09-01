import json
import re


REGISTRY = "0x" + "1" * 40
OWNER = "0x" + "2" * 40
CHALLENGER = "0x" + "3" * 40
NAMESPACE = "proof.gen"
ATTESTATION_URL = (
    "https://raw.githubusercontent.com/ometere123/gns-lifecycle-test/"
    "main/gns-claim.json"
)
CORROBORATION_URL = "https://github.com/ometere123/gns-lifecycle-test"
CHALLENGE_URL = "https://challenge.example/evidence.json"


def deploy(direct_deploy):
    return direct_deploy(
        "contracts/GNSAuthenticity.py",
        REGISTRY,
        sdk_version="v0.2.16",
    )


def snapshot():
    return {
        "full_name": NAMESPACE,
        "owner": OWNER,
        "primary_address": OWNER,
        "status": "active",
        "records": {
            "website": "",
            "github": "https://github.com/ometere123/gns-lifecycle-test",
            "x": "@proof",
            "agent": "",
        },
    }


def manifest():
    return json.dumps(
        [
            {"type": "attestation", "url": ATTESTATION_URL},
            {"type": "github", "url": CORROBORATION_URL},
        ]
    )


def challenge_manifest():
    return json.dumps([{"type": "other", "url": CHALLENGE_URL}])


def install_claim_mocks(direct_vm, attestation_body):
    # Direct Mode mock_web matches the requested URL pattern. Exact URLs keep this
    # lifecycle test honest and avoid accidentally missing the source-bound proof.
    direct_vm.mock_web(
        re.escape(ATTESTATION_URL),
        {"status": 200, "body": json.dumps(attestation_body)},
    )
    direct_vm.mock_web(
        re.escape(CORROBORATION_URL),
        {
            "status": 200,
            "body": "Public project repository controlled by the namespace claimant.",
        },
    )


def test_public_claim_verify_challenge_resolve_lifecycle(direct_vm, direct_deploy):
    """Exercise the public authenticity state machine, not private transition helpers.

    The registry snapshot is injected because Direct Mode is in-process and does
    not provide a second deployed contract behind gl.get_contract_at. Web and LLM
    calls remain real public-path calls under Direct Mode mocks, and the captured
    validator comparator is executed after both verdict-bearing methods.
    """

    contract = deploy(direct_deploy)
    stable_snapshot = snapshot()
    contract._registry_snapshot = lambda namespace: stable_snapshot

    direct_vm.sender = OWNER
    created = json.loads(
        contract.create_claim(
            NAMESPACE,
            "project",
            manifest(),
            "This namespace represents the public lifecycle-test project.",
        )
    )
    assert created["success"] is True
    assert created["claim_id"] == "1"
    assert created["namespace"] == NAMESPACE

    claim = json.loads(contract.get_claim("1"))
    issued_at = int(claim["created_at"])
    attestation = {
        "protocol": "gns-claim-v2",
        "namespace": NAMESPACE,
        "wallet": OWNER,
        "registry": REGISTRY,
        "authenticity_contract": created["authenticity_contract"],
        "claim_id": "1",
        "challenge": created["challenge"],
        "policy_version": "gns-auth-v2",
        "issued_at": issued_at,
        "expires_at": issued_at + 3600,
    }

    install_claim_mocks(direct_vm, attestation)
    direct_vm.strict_mocks = True
    direct_vm.check_pickling = True
    direct_vm.mock_llm(
        re.escape("CLAIM TYPE: project"),
        json.dumps(
            {
                "decision": "VERIFIED",
                "reason_code": "PUBLIC_SOURCES_MATCH",
                "summary": "The wallet-bound attestation and public repository support the claim.",
            }
        ),
    )

    verified_raw = contract.verify_claim("1")
    verified = json.loads(verified_raw)
    assert verified["success"] is True
    assert verified["verdict"]["decision"] == "VERIFIED", json.dumps(verified["verdict"], sort_keys=True)
    assert int(verified["verdict"]["evidence_expires_at"]) == issued_at + 3600
    assert direct_vm.run_validator() is True

    verification = json.loads(contract.get_namespace_verification(NAMESPACE))
    assert verification["status"] == "VERIFIED"
    assert verification["claim_id"] == "1"

    direct_vm.sender = CHALLENGER
    opened = json.loads(
        contract.challenge_claim(
            "1",
            "MISREPRESENTATION",
            challenge_manifest(),
            "Controlled test challenge with retrievable but non-defeating evidence.",
        )
    )
    assert opened["success"] is True
    assert opened["challenge_id"] == "1"

    still_verified = json.loads(contract.get_namespace_verification(NAMESPACE))
    assert still_verified["status"] == "VERIFIED"
    assert still_verified["challenge_status"] == "OPEN"

    direct_vm.clear_mocks()
    install_claim_mocks(direct_vm, attestation)
    direct_vm.mock_web(
        re.escape(CHALLENGE_URL),
        {
            "status": 200,
            "body": "The challenger supplies no evidence that defeats the controlled public claim.",
        },
    )
    direct_vm.mock_llm(
        re.escape("CHALLENGE REASON: MISREPRESENTATION"),
        json.dumps(
            {
                "decision": "UPHOLD",
                "reason_code": "CHALLENGE_NOT_SUBSTANTIATED",
                "summary": "The claimant remains supported and the challenge is not substantiated.",
            }
        ),
    )

    resolved = json.loads(contract.resolve_challenge("1"))
    assert resolved["success"] is True
    assert resolved["verdict"]["decision"] == "UPHOLD", resolved["verdict"]
    assert direct_vm.run_validator() is True

    final_claim = json.loads(contract.get_claim("1"))
    final_challenge = json.loads(contract.get_challenge("1"))
    final_verification = json.loads(contract.get_namespace_verification(NAMESPACE))

    assert final_claim["status"] == "VERIFIED"
    assert final_claim["active_challenge_id"] == ""
    assert final_challenge["status"] == "UPHOLD"
    assert final_verification["status"] == "VERIFIED"
    assert final_verification["challenge_status"] == "UPHOLD"
    assert final_verification["last_challenge_id"] == "1"
    assert int(contract.get_total_claims()) == 1
    assert int(contract.get_total_challenges()) == 1
    assert int(contract.get_total_verdicts()) == 2
