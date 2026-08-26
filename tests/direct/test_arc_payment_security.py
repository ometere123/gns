from pathlib import Path


ROUTER = "0x" + "a" * 40
TX = "0x" + "b" * 64
PAYER = "0x" + "c" * 40


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
    ]
    for guard in required:
        assert guard in source


def test_payment_is_consumed_before_namespace_state_is_saved():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    register = source.index("    def register(")
    renew = source.index("    def renew(")
    owner_ops = source.index("    # owner operations")
    register_body = source[register:renew]
    renew_body = source[renew:owner_ops]
    assert register_body.index("self._consume_payment(payment)") < register_body.index("self._save_name_obj(full_name, obj)")
    assert renew_body.index("self._consume_payment(payment)") < renew_body.index("self._save_name_obj(full_name, obj)")


def test_registry_no_longer_contains_commercial_gen_fee_path():
    source = Path("contracts/GNSRegistry.py").read_text(encoding="utf-8")
    assert "DEFAULT_PRICE_PER_YEAR_WEI" not in source
    assert "admin_withdraw" not in source
    assert "@gl.public.write.payable" not in source
    assert "gl.message.value" not in source
