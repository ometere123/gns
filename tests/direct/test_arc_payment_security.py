import json
from pathlib import Path


ROUTER = "0x" + "a" * 40
TX = "0x" + "b" * 64
PAYER = "0x" + "c" * 40
OTHER = "0x" + "d" * 40
PRIMARY = "0x" + "e" * 40


def deploy(direct_deploy):
    return direct_deploy(
        "contracts/GNSRegistry.py",
        ROUTER,
        sdk_version="v0.2.16",
    )


def test_arc_constants_are_pinned_to_testnet(direct_deploy):
    contract = deploy(direct_deploy)
    config = contract.get_arc_payment_config()
    assert "5042002" in config
    assert "https://rpc.testnet.arc.network" in config
    assert ROUTER in config.lower()
    assert "deterministic_finality" in config
    assert "reservation_ttl_seconds" in config


def test_payment_key_binds_chain_hash_and_log_index(direct_deploy):
    contract = deploy(direct_deploy)
    assert contract._payment_key(TX, 7) == f"5042002:{TX}:7"
    assert contract._payment_key(TX, 8) != contract._payment_key(TX, 7)


def test_transaction_hash_validation_fails_closed(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    assert contract._normalise_tx_hash(TX.upper().replace("0X", "0x")) == TX
    with direct_vm.expect_revert("Invalid Arc transaction hash"):
        contract._normalise_tx_hash("0x1234")
    with direct_vm.expect_revert("Invalid Arc transaction hash"):
        contract._normalise_tx_hash("0x" + "z" * 64)


def test_indexed_payer_topic_decodes_exact_address(direct_deploy):
    contract = deploy(direct_deploy)
    topic = "0x" + "0" * 24 + PAYER[2:]
    assert contract._topic_address(topic) == PAYER


def test_root_namespace_normalization_matches_arc_router(direct_deploy):
    contract = deploy(direct_deploy)
    assert contract._normalise_full_name("Papito") == "papito.gen"
    assert contract._normalise_full_name("papito.gen") == "papito.gen"
    assert contract._is_valid_root_label("papito")
    assert contract._is_valid_root_label("Papito")
    assert contract._is_valid_root_label("papito-2")
    assert not contract._is_valid_root_label("-papito")
    assert not contract._is_valid_root_label("pa.pito")


def test_reservation_is_wallet_and_terms_bound(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    direct_vm.sender = PAYER
    first = contract.reserve_registration("papito", 2, PRIMARY)
    assert "Registration reserved" in first
    active = contract._active_reservation("papito.gen")
    assert active["reserver"] == PAYER
    assert active["years"] == 2
    assert active["primary_address"] == PRIMARY

    direct_vm.sender = OTHER
    with direct_vm.expect_revert("Name is temporarily reserved by another wallet"):
        contract.reserve_registration("papito", 2, PRIMARY)


def test_reserver_must_keep_same_terms_until_cancel(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    direct_vm.sender = PAYER
    contract.reserve_registration("papito", 1, PRIMARY)
    with direct_vm.expect_revert("Cancel the current reservation"):
        contract.reserve_registration("papito", 2, PRIMARY)
    contract.cancel_registration_reservation("papito.gen")
    assert contract.get_registration_reservation("papito.gen") == "{}"


def test_expired_owner_loses_renewal_and_registration_privilege(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    now = contract._now()
    expired = contract._make_name_object(
        "expired", "expired.gen", "", False, PAYER, PRIMARY,
        now - 100, now - 1, {},
    )
    contract._save_name_obj("expired.gen", expired)
    contract._add_owner_name(PAYER, "expired.gen")
    contract.reverse_records[PRIMARY] = "expired.gen"

    direct_vm.sender = PAYER
    with direct_vm.expect_revert("Name is expired"):
        contract.renew("expired.gen", 1, TX, 0)

    assert contract.owner_of("expired.gen") == ""
    assert contract.reverse_lookup(PRIMARY) == ""
    assert contract.is_available("expired.gen") is True

    # Expiry removes the former owner's privilege; anyone may compete for a
    # fresh reservation once the prior reservation is cancelled.
    reserved = json.loads(contract.reserve_registration("expired.gen", 1, PRIMARY))
    assert reserved["data"]["reserver"] == PAYER
    contract.cancel_registration_reservation("expired.gen")
    direct_vm.sender = OTHER
    reserved_by_other = json.loads(contract.reserve_registration("expired.gen", 1, PRIMARY))
    assert reserved_by_other["data"]["reserver"] == OTHER


def test_registration_requires_matching_active_reservation_source_guard():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    register = source.index("    def register(")
    renew = source.index("    def renew(")
    body = source[register:renew]
    required = [
        'if reservation is None:',
        'if str(reservation.get("reserver", "")).lower() != self._sender():',
        'if int(reservation.get("years", 0)) != int(years):',
        'if str(reservation.get("primary_address", "")).lower() != clean_primary:',
        'self._clear_reservation(full_name)',
    ]
    for guard in required:
        assert guard in body


def test_receipt_security_guards_remain_in_source():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    required = [
        'if self.consumed_payments.get(key, "") != "":',
        'if str(receipt.get("to", "")).lower() != str(self.arc_payment_router).lower():',
        'if str(selected.get("address", "")).lower() != str(self.arc_payment_router).lower():',
        'if str(topics[0]).lower() != ARC_PAYMENT_EVENT_TOPIC:',
        'if payer != self._sender():',
        'if namespace_hash != expected_hash:',
        'if event_action != action:',
        'if event_years != int(years):',
        'if amount <= 0:',
        'if not data.startswith("0x") or len(data) != 194:',
    ]
    for guard in required:
        assert guard in source


def test_arc_consensus_does_not_compare_moving_latest_head():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    start = source.index("    def _fetch_arc_receipt_consensus")
    end = source.index("    def _verify_arc_payment", start)
    body = source[start:end]
    assert "eth_getTransactionReceipt" in body
    assert "eth_blockNumber" not in body
    assert '"transactionHash"' in body
    assert '"blockNumber"' in body
    assert '"logs"' in body


def test_payment_is_consumed_before_namespace_state_is_saved():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    register = source.index("    def register(")
    renew = source.index("    def renew(")
    owner_ops = source.index("    # owner operations")
    register_body = source[register:renew]
    renew_body = source[renew:owner_ops]
    assert register_body.index("self._consume_payment(payment)") < register_body.index("self._save_name_obj(full_name, obj)")
    assert renew_body.index("self._consume_payment(payment)") < renew_body.index("self._save_name_obj(full_name, obj)")


def test_expired_owner_mutations_are_blocked_and_reverse_lookup_fails_closed():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    assert "def _require_active_owner" in source
    for method in ["transfer", "set_primary_address", "set_primary_name", "set_records", "clear_record", "create_subname", "transfer_subname"]:
        start = source.index(f"    def {method}(")
        next_section = source.find("\n    @gl.public", start + 8)
        body = source[start:] if next_section == -1 else source[start:next_section]
        assert "_require_active_owner" in body
    reverse_start = source.index("    def reverse_lookup(")
    reverse_end = source.index("    def get_records(", reverse_start)
    reverse_body = source[reverse_start:reverse_end]
    assert "self._is_expired_obj(obj)" in reverse_body


def test_registry_no_longer_contains_commercial_gen_fee_path():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    assert "DEFAULT_PRICE_PER_YEAR_WEI" not in source
    assert "admin_withdraw" not in source
    assert "@gl.public.write.payable" not in source
    assert "gl.message.value" not in source


def test_reverse_lookup_is_explicit_owner_controlled(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    now = contract._now()
    owner = PAYER
    victim = PRIMARY
    obj = contract._make_name_object(
        "reverse", "reverse.gen", "", False, owner, victim,
        now, now + 1000, {},
    )
    contract._save_name_obj("reverse.gen", obj)
    contract._add_owner_name(owner, "reverse.gen")

    # Forward primary metadata cannot grant reverse identity.
    assert contract.reverse_lookup(victim) == ""
    direct_vm.sender = owner
    contract.set_primary_name("reverse.gen")
    assert contract.reverse_lookup(owner) == "reverse.gen"

    contract.set_primary_address("reverse.gen", OTHER)
    assert contract.reverse_lookup(owner) == "reverse.gen"
    direct_vm.sender = owner
    contract.transfer("reverse.gen", OTHER)
    assert contract.reverse_lookup(owner) == ""
    assert contract.reverse_lookup(OTHER) == ""


def test_intents_are_nonzero_and_registry_domain_separated(direct_vm, direct_deploy):
    first = deploy(direct_deploy)
    direct_vm.sender = PAYER
    reservation = json.loads(first.reserve_registration("domainone", 1, PRIMARY))
    assert reservation["data"]["intent_hash"].startswith("0x")
    assert len(reservation["data"]["intent_hash"]) == 66

    first_hash = first._make_intent_hash(
        "registration", "domainone.gen", PAYER, 1, PRIMARY, 10, 20, 0, 1
    )
    assert first_hash != first._make_intent_hash_for_registry(
        "0x" + "1" * 40, "registration", "domainone.gen", PAYER, 1,
        PRIMARY, 10, 20, 0, 1
    )
    assert first_hash != first._make_intent_hash("registration", "domainone.gen", PAYER, 1,
                                   PRIMARY, 10, 20, 0, 2)


def test_transfer_invalidates_renewal_intent(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    now = contract._now()
    obj = contract._make_name_object(
        "renewal", "renewal.gen", "", False, PAYER, PRIMARY,
        now, now + 1000, {},
    )
    contract._save_name_obj("renewal.gen", obj)
    contract._add_owner_name(PAYER, "renewal.gen")
    direct_vm.sender = PAYER
    created = json.loads(contract.create_renewal_intent("renewal.gen", 1))
    assert created["data"]["intent_hash"]
    contract.transfer("renewal.gen", OTHER)
    assert contract.get_renewal_intent("renewal.gen") == "{}"


def test_expired_subname_replacement_clears_old_owner_reverse(direct_vm, direct_deploy):
    contract = deploy(direct_deploy)
    now = contract._now()
    parent = contract._make_name_object(
        "parent", "parent.gen", "", False, PAYER, PRIMARY,
        now, now + 1000, {},
    )
    contract._save_name_obj("parent.gen", parent)
    contract._add_owner_name(PAYER, "parent.gen")
    expired = contract._make_name_object(
        "child", "child.parent.gen", "parent.gen", True, PAYER, PRIMARY,
        now - 1000, now - 1, {},
    )
    contract._save_name_obj("child.parent.gen", expired)
    contract._add_owner_name(PAYER, "child.parent.gen")
    contract.reverse_records[PAYER] = "child.parent.gen"
    direct_vm.sender = PAYER
    contract.create_subname("parent.gen", "child", OTHER)
    assert contract.reverse_records.get(PAYER, "") == ""
