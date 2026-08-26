# v0.3.2
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from datetime import datetime
import hashlib
import json


ROOT_SUFFIX = ".gen"
SECONDS_PER_YEAR = 31536000
REGISTRATION_RESERVATION_TTL = 1800
CONTRACT_VERSION = "2.1.1-arc-usdc-reservations"
ARC_CHAIN_ID = 5042002
ARC_RPC_URL = "https://rpc.testnet.arc.network"
ARC_PAYMENT_EVENT_TOPIC = "0x16246dce28fe193971c235293f898fe6af15aa3539719b24d894793343162838"
ACTION_REGISTER = 1
ACTION_RENEW = 2


class GNSRegistry(gl.Contract):
    """GNS deterministic namespace registry with Arc USDC payment receipts.

    Commercial payments happen on Arc. A root registration is first reserved on
    GenLayer, then paid on Arc, then finalized on GenLayer. Validators retrieve
    the Arc receipt themselves, verify the immutable payment-router event, and
    consume the receipt exactly once before namespace state changes.
    """

    admin: str
    pending_admin: str
    arc_payment_router: str
    registrations_paused: bool

    names: TreeMap[str, str]
    owner_names: TreeMap[str, str]
    reverse_records: TreeMap[str, str]
    parent_subnames: TreeMap[str, str]
    registration_reservations: TreeMap[str, str]
    reports: TreeMap[str, str]
    ai_reviews: TreeMap[str, str]
    consumed_payments: TreeMap[str, str]

    name_counter: u256
    report_counter: u256
    review_counter: u256
    payment_counter: u256

    def __init__(self, arc_payment_router: str) -> None:
        self.admin = self._sender()
        self.pending_admin = ""
        self.arc_payment_router = self._clean_address(
            arc_payment_router, "Arc payment router"
        )
        self.registrations_paused = False

        self.names = TreeMap()
        self.owner_names = TreeMap()
        self.reverse_records = TreeMap()
        self.parent_subnames = TreeMap()
        self.registration_reservations = TreeMap()
        self.reports = TreeMap()
        self.ai_reviews = TreeMap()
        self.consumed_payments = TreeMap()

        self.name_counter = u256(0)
        self.report_counter = u256(0)
        self.review_counter = u256(0)
        self.payment_counter = u256(0)

    # ------------------------------------------------------------------
    # deterministic helpers
    # ------------------------------------------------------------------

    def _sender(self) -> str:
        return str(gl.message.sender_address).lower()

    def _now(self) -> int:
        raw = str(gl.message_raw["datetime"])
        return int(datetime.fromisoformat(raw.replace("Z", "+00:00")).timestamp())

    def _dump(self, value) -> str:
        return json.dumps(value, sort_keys=True, separators=(",", ":"))

    def _load(self, raw: str, fallback):
        if raw == "":
            return fallback
        try:
            return json.loads(raw)
        except Exception:
            return fallback

    def _success(self, message: str, data) -> str:
        return self._dump({"success": True, "message": message, "data": data})

    def _clean_address(self, address: str, label: str) -> str:
        clean = str(address).strip().lower()
        if len(clean) != 42 or not clean.startswith("0x"):
            raise gl.vm.UserError("Invalid " + label)
        for ch in clean[2:]:
            if ch not in "0123456789abcdef":
                raise gl.vm.UserError("Invalid " + label)
        return clean

    def _normalise_full_name(self, label_or_name: str) -> str:
        raw = str(label_or_name).strip().lower()
        if raw.endswith(ROOT_SUFFIX):
            return raw
        return raw + ROOT_SUFFIX

    def _strip_root_suffix(self, label_or_name: str) -> str:
        raw = str(label_or_name).strip().lower()
        if raw.endswith(ROOT_SUFFIX):
            return raw[:-len(ROOT_SUFFIX)]
        return raw

    def _is_valid_root_label(self, label: str) -> bool:
        clean = str(label).strip().lower()
        if len(clean) < 3 or len(clean) > 32 or clean == "gen" or "." in clean:
            return False
        if clean.startswith("-") or clean.endswith("-"):
            return False
        for ch in clean:
            if ch not in "abcdefghijklmnopqrstuvwxyz0123456789-":
                return False
        return True

    def _is_valid_sub_label(self, label: str) -> bool:
        clean = str(label).strip().lower()
        if len(clean) < 2 or len(clean) > 32 or "." in clean:
            return False
        if clean.startswith("-") or clean.endswith("-"):
            return False
        for ch in clean:
            if ch not in "abcdefghijklmnopqrstuvwxyz0123456789-":
                return False
        return True

    def _empty_records(self):
        return {
            "avatar": "",
            "website": "",
            "x": "",
            "github": "",
            "discord": "",
            "email": "",
            "contract": "",
            "agent": "",
            "description": "",
        }

    def _allowed_record_key(self, key: str) -> bool:
        return key in [
            "avatar",
            "website",
            "x",
            "github",
            "discord",
            "email",
            "contract",
            "agent",
            "description",
        ]

    def _get_name_obj(self, full_name: str):
        return self._load(self.names.get(full_name, ""), None)

    def _save_name_obj(self, full_name: str, obj) -> None:
        self.names[full_name] = self._dump(obj)

    def _is_expired_obj(self, obj) -> bool:
        try:
            return int(obj.get("expires_at", 0)) <= self._now()
        except Exception:
            return True

    def _require_existing_name(self, full_name: str):
        obj = self._get_name_obj(full_name)
        if obj is None:
            raise gl.vm.UserError("Name does not exist")
        return obj

    def _require_owner(self, full_name: str):
        obj = self._require_existing_name(full_name)
        if str(obj.get("owner", "")).lower() != self._sender():
            raise gl.vm.UserError("Only the name owner can perform this action")
        return obj

    def _require_active_owner(self, full_name: str):
        obj = self._require_owner(full_name)
        if self._is_expired_obj(obj):
            raise gl.vm.UserError("Name is expired")
        return obj

    def _require_admin(self) -> None:
        if self._sender() != str(self.admin).lower():
            raise gl.vm.UserError("Only admin can perform this action")

    def _get_owner_names(self, owner: str):
        return self._load(self.owner_names.get(owner.lower(), ""), [])

    def _save_owner_names(self, owner: str, values) -> None:
        self.owner_names[owner.lower()] = self._dump(values)

    def _add_owner_name(self, owner: str, full_name: str) -> None:
        values = self._get_owner_names(owner)
        if full_name not in values:
            values.append(full_name)
        self._save_owner_names(owner, values)

    def _remove_owner_name(self, owner: str, full_name: str) -> None:
        values = []
        for item in self._get_owner_names(owner):
            if item != full_name:
                values.append(item)
        self._save_owner_names(owner, values)

    def _get_subnames_array(self, parent_name: str):
        return self._load(self.parent_subnames.get(parent_name, ""), [])

    def _add_subname_to_parent(self, parent_name: str, subname: str) -> None:
        values = self._get_subnames_array(parent_name)
        if subname not in values:
            values.append(subname)
        self.parent_subnames[parent_name] = self._dump(values)

    def _make_name_object(
        self,
        label: str,
        full_name: str,
        parent: str,
        is_subname: bool,
        owner: str,
        primary_address: str,
        created_at: int,
        expires_at: int,
        payment,
    ):
        return {
            "label": label,
            "full_name": full_name,
            "parent": parent,
            "is_subname": is_subname,
            "owner": owner.lower(),
            "primary_address": primary_address.lower(),
            "created_at": created_at,
            "expires_at": expires_at,
            "status": "active",
            "payment": payment,
            "records": self._empty_records(),
            "ai_status": {
                "risk": "unreviewed",
                "verified": False,
                "last_review_id": "",
            },
        }

    def _active_reservation(self, full_name: str):
        raw = self.registration_reservations.get(full_name, "")
        reservation = self._load(raw, None)
        if reservation is None:
            return None
        try:
            if int(reservation.get("expires_at", 0)) <= self._now():
                return None
        except Exception:
            return None
        return reservation

    def _clear_reservation(self, full_name: str) -> None:
        self.registration_reservations[full_name] = ""

    def _normalise_tx_hash(self, tx_hash: str) -> str:
        clean = str(tx_hash).strip().lower()
        if len(clean) != 66 or not clean.startswith("0x"):
            raise gl.vm.UserError("Invalid Arc transaction hash")
        for ch in clean[2:]:
            if ch not in "0123456789abcdef":
                raise gl.vm.UserError("Invalid Arc transaction hash")
        return clean

    def _payment_key(self, tx_hash: str, log_index: int) -> str:
        return str(ARC_CHAIN_ID) + ":" + tx_hash + ":" + str(log_index)

    def _hex_int(self, value: str) -> int:
        clean = str(value).strip().lower()
        if not clean.startswith("0x"):
            raise gl.vm.UserError("Malformed Arc RPC integer")
        try:
            return int(clean, 16)
        except Exception:
            raise gl.vm.UserError("Malformed Arc RPC integer")

    def _topic_address(self, topic: str) -> str:
        clean = str(topic).strip().lower()
        if len(clean) != 66 or not clean.startswith("0x"):
            raise gl.vm.UserError("Malformed Arc event topic")
        return "0x" + clean[-40:]

    def _rpc_call_nondet(self, method: str, params):
        response = gl.nondet.web.request(
            ARC_RPC_URL,
            method="POST",
            headers={"content-type": "application/json"},
            body=json.dumps(
                {
                    "jsonrpc": "2.0",
                    "id": 1,
                    "method": method,
                    "params": params,
                }
            ),
        )
        status_code = int(
            getattr(response, "status_code", getattr(response, "status", 0))
        )
        if status_code != 200:
            raise gl.vm.UserError("Arc RPC request failed")
        payload = json.loads(response.body.decode("utf-8"))
        if payload.get("error") is not None:
            raise gl.vm.UserError("Arc RPC returned an error")
        return payload.get("result")

    def _fetch_arc_receipt_consensus(self, tx_hash: str):
        def fetch_stable():
            receipt = self._rpc_call_nondet("eth_getTransactionReceipt", [tx_hash])
            if receipt is None:
                return self._dump({"receipt": None})

            stable_logs = []
            raw_logs = receipt.get("logs", [])
            if isinstance(raw_logs, list):
                for log in raw_logs:
                    if not isinstance(log, dict):
                        continue
                    topics = log.get("topics", [])
                    if not isinstance(topics, list):
                        topics = []
                    stable_logs.append(
                        {
                            "address": str(log.get("address", "")).lower(),
                            "logIndex": str(log.get("logIndex", "")).lower(),
                            "topics": [str(topic).lower() for topic in topics],
                            "data": str(log.get("data", "")).lower(),
                        }
                    )

            normalized = {
                "transactionHash": str(receipt.get("transactionHash", "")).lower(),
                "status": str(receipt.get("status", "")).lower(),
                "to": str(receipt.get("to", "")).lower(),
                "blockNumber": str(receipt.get("blockNumber", "")).lower(),
                "logs": stable_logs,
            }
            return self._dump({"receipt": normalized})

        raw = gl.eq_principle.strict_eq(fetch_stable)
        return self._load(str(raw), None)

    def _verify_arc_payment(
        self,
        full_name: str,
        years: int,
        action: int,
        arc_tx_hash: str,
        arc_log_index: int,
    ):
        if arc_log_index < 0:
            raise gl.vm.UserError("Invalid Arc log index")

        tx_hash = self._normalise_tx_hash(arc_tx_hash)
        key = self._payment_key(tx_hash, arc_log_index)
        if self.consumed_payments.get(key, "") != "":
            raise gl.vm.UserError("Arc payment receipt has already been consumed")

        consensus = self._fetch_arc_receipt_consensus(tx_hash)
        if consensus is None:
            raise gl.vm.UserError("Arc receipt consensus failed")

        receipt = consensus.get("receipt")
        if receipt is None:
            raise gl.vm.UserError("Arc transaction receipt not found")
        if str(receipt.get("transactionHash", "")).lower() != tx_hash:
            raise gl.vm.UserError("Arc receipt transaction hash mismatch")
        if self._hex_int(str(receipt.get("status", "0x0"))) != 1:
            raise gl.vm.UserError("Arc payment transaction failed")
        if str(receipt.get("to", "")).lower() != str(self.arc_payment_router).lower():
            raise gl.vm.UserError("Arc transaction did not call the configured payment router")

        block_number = self._hex_int(str(receipt.get("blockNumber", "0x0")))
        if block_number <= 0:
            raise gl.vm.UserError("Arc payment receipt is not finalized")

        selected = None
        for log in receipt.get("logs", []):
            try:
                idx = self._hex_int(str(log.get("logIndex", "0x0")))
            except Exception:
                continue
            if idx == arc_log_index:
                selected = log
                break

        if selected is None:
            raise gl.vm.UserError("Arc payment log not found")
        if str(selected.get("address", "")).lower() != str(self.arc_payment_router).lower():
            raise gl.vm.UserError("Arc payment log came from an unexpected contract")

        topics = selected.get("topics", [])
        if not isinstance(topics, list) or len(topics) != 4:
            raise gl.vm.UserError("Malformed Arc payment event")
        if str(topics[0]).lower() != ARC_PAYMENT_EVENT_TOPIC:
            raise gl.vm.UserError("Unexpected Arc payment event signature")

        payer = self._topic_address(str(topics[1]))
        expected_hash = "0x" + hashlib.sha256(full_name.encode("utf-8")).hexdigest()
        namespace_hash = str(topics[2]).lower()
        event_action = self._hex_int(str(topics[3]))

        data = str(selected.get("data", "")).lower()
        if not data.startswith("0x") or len(data) != 130:
            raise gl.vm.UserError("Malformed Arc payment event data")
        body = data[2:]
        try:
            event_years = int(body[0:64], 16)
            amount = int(body[64:128], 16)
        except Exception:
            raise gl.vm.UserError("Malformed Arc payment event data")

        if payer != self._sender():
            raise gl.vm.UserError("Arc payer must match the GenLayer sender")
        if namespace_hash != expected_hash:
            raise gl.vm.UserError("Arc payment is bound to a different namespace")
        if event_action != action:
            raise gl.vm.UserError("Arc payment is for a different action")
        if event_years != int(years):
            raise gl.vm.UserError("Arc payment duration mismatch")
        if amount <= 0:
            raise gl.vm.UserError("Arc payment amount must be positive")

        return {
            "key": key,
            "chain_id": ARC_CHAIN_ID,
            "router": str(self.arc_payment_router).lower(),
            "tx_hash": tx_hash,
            "log_index": arc_log_index,
            "payer": payer,
            "namespace_hash": namespace_hash,
            "action": event_action,
            "years": event_years,
            "amount_usdc_base_units": str(amount),
            "arc_block_number": block_number,
        }

    def _consume_payment(self, payment) -> None:
        key = str(payment.get("key", ""))
        if key == "":
            raise gl.vm.UserError("Invalid payment receipt")
        if self.consumed_payments.get(key, "") != "":
            raise gl.vm.UserError("Arc payment receipt has already been consumed")
        self.consumed_payments[key] = self._dump(payment)
        self.payment_counter += u256(1)

    # ------------------------------------------------------------------
    # views
    # ------------------------------------------------------------------

    @gl.public.view
    def contract_version(self) -> str:
        return CONTRACT_VERSION

    @gl.public.view
    def get_admin(self) -> str:
        return str(self.admin).lower()

    @gl.public.view
    def get_pending_admin(self) -> str:
        return str(self.pending_admin).lower()

    @gl.public.view
    def get_arc_payment_config(self) -> str:
        return self._dump(
            {
                "chain_id": ARC_CHAIN_ID,
                "rpc_url": ARC_RPC_URL,
                "router": str(self.arc_payment_router).lower(),
                "event_topic": ARC_PAYMENT_EVENT_TOPIC,
                "deterministic_finality": True,
                "reservation_ttl_seconds": REGISTRATION_RESERVATION_TTL,
                "registrations_paused": bool(self.registrations_paused),
            }
        )

    @gl.public.view
    def get_registration_reservation(self, label_or_name: str) -> str:
        reservation = self._active_reservation(
            self._normalise_full_name(label_or_name)
        )
        if reservation is None:
            return "{}"
        return self._dump(reservation)

    @gl.public.view
    def get_total_payments_consumed(self) -> u256:
        return self.payment_counter

    @gl.public.view
    def get_consumed_payment(self, tx_hash: str, log_index: u256) -> str:
        clean = self._normalise_tx_hash(tx_hash)
        return self.consumed_payments.get(self._payment_key(clean, int(log_index)), "{}")

    @gl.public.view
    def is_payment_consumed(self, tx_hash: str, log_index: u256) -> bool:
        clean = self._normalise_tx_hash(tx_hash)
        return self.consumed_payments.get(self._payment_key(clean, int(log_index)), "") != ""

    @gl.public.view
    def is_available(self, label_or_name: str) -> bool:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)
        return obj is None or self._is_expired_obj(obj)

    @gl.public.view
    def owner_of(self, label_or_name: str) -> str:
        obj = self._get_name_obj(self._normalise_full_name(label_or_name))
        if obj is None or self._is_expired_obj(obj):
            return ""
        return str(obj.get("owner", "")).lower()

    @gl.public.view
    def resolve(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)
        if obj is None:
            return "{}"
        if self._is_expired_obj(obj):
            obj["status"] = "expired"
        return self._dump(obj)

    @gl.public.view
    def resolve_address(self, label_or_name: str) -> str:
        obj = self._get_name_obj(self._normalise_full_name(label_or_name))
        if obj is None or self._is_expired_obj(obj):
            return ""
        return str(obj.get("primary_address", "")).lower()

    @gl.public.view
    def reverse_lookup(self, address: str) -> str:
        full_name = self.reverse_records.get(str(address).strip().lower(), "")
        if full_name == "":
            return ""
        obj = self._get_name_obj(full_name)
        if obj is None or self._is_expired_obj(obj):
            return ""
        return full_name

    @gl.public.view
    def get_records(self, label_or_name: str) -> str:
        obj = self._get_name_obj(self._normalise_full_name(label_or_name))
        if obj is None:
            return "{}"
        return self._dump(obj.get("records", {}))

    @gl.public.view
    def get_names_by_owner(self, owner: str) -> str:
        return self.owner_names.get(str(owner).strip().lower(), "[]")

    @gl.public.view
    def get_my_names(self) -> str:
        return self.owner_names.get(self._sender(), "[]")

    @gl.public.view
    def get_subnames(self, parent_name: str) -> str:
        return self.parent_subnames.get(
            self._normalise_full_name(parent_name), "[]"
        )

    @gl.public.view
    def get_total_names(self) -> u256:
        return self.name_counter

    @gl.public.view
    def get_total_reports(self) -> u256:
        return self.report_counter

    @gl.public.view
    def get_total_reviews(self) -> u256:
        return self.review_counter

    @gl.public.view
    def get_report(self, report_id: str) -> str:
        return self.reports.get(str(report_id), "{}")

    @gl.public.view
    def get_ai_review(self, review_id: str) -> str:
        return self.ai_reviews.get(str(review_id), "{}")

    # ------------------------------------------------------------------
    # registration reservation -> Arc USDC -> GenLayer finalization
    # ------------------------------------------------------------------

    @gl.public.write
    def reserve_registration(
        self,
        label: str,
        years: u256,
        primary_address: str,
    ) -> str:
        if self.registrations_paused:
            raise gl.vm.UserError("New registrations are paused")

        clean_label = self._strip_root_suffix(label)
        if not self._is_valid_root_label(clean_label):
            raise gl.vm.UserError("Invalid name label")
        if years < u256(1) or years > u256(5):
            raise gl.vm.UserError("Registration duration must be between 1 and 5 years")

        full_name = clean_label + ROOT_SUFFIX
        existing = self._get_name_obj(full_name)
        if existing is not None and not self._is_expired_obj(existing):
            raise gl.vm.UserError("Name is not available")

        clean_primary = self._clean_address(primary_address, "primary address")
        current = self._active_reservation(full_name)
        if current is not None:
            current_reserver = str(current.get("reserver", "")).lower()
            if current_reserver != self._sender():
                raise gl.vm.UserError("Name is temporarily reserved by another wallet")
            if (
                int(current.get("years", 0)) == int(years)
                and str(current.get("primary_address", "")).lower() == clean_primary
            ):
                return self._success("Registration already reserved", current)
            raise gl.vm.UserError(
                "Cancel the current reservation before changing registration terms"
            )

        now = self._now()
        reservation = {
            "namespace": full_name,
            "reserver": self._sender(),
            "years": int(years),
            "primary_address": clean_primary,
            "created_at": now,
            "expires_at": now + REGISTRATION_RESERVATION_TTL,
        }
        self.registration_reservations[full_name] = self._dump(reservation)
        return self._success("Registration reserved", reservation)

    @gl.public.write
    def cancel_registration_reservation(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        raw = self.registration_reservations.get(full_name, "")
        reservation = self._load(raw, None)
        if reservation is None:
            return self._success("No registration reservation exists", {})
        if str(reservation.get("reserver", "")).lower() != self._sender():
            raise gl.vm.UserError("Only the reserver can cancel this reservation")
        self._clear_reservation(full_name)
        return self._success("Registration reservation cancelled", {})

    @gl.public.write
    def register(
        self,
        label: str,
        years: u256,
        primary_address: str,
        arc_tx_hash: str,
        arc_log_index: u256,
    ) -> str:
        if self.registrations_paused:
            raise gl.vm.UserError("New registrations are paused")

        clean_label = self._strip_root_suffix(label)
        if not self._is_valid_root_label(clean_label):
            raise gl.vm.UserError("Invalid name label")
        if years < u256(1) or years > u256(5):
            raise gl.vm.UserError("Registration duration must be between 1 and 5 years")

        full_name = clean_label + ROOT_SUFFIX
        existing = self._get_name_obj(full_name)
        if existing is not None and not self._is_expired_obj(existing):
            raise gl.vm.UserError("Name is not available")

        clean_primary = self._clean_address(primary_address, "primary address")
        reservation = self._active_reservation(full_name)
        if reservation is None:
            raise gl.vm.UserError("Create or refresh a GenLayer registration reservation first")
        if str(reservation.get("reserver", "")).lower() != self._sender():
            raise gl.vm.UserError("Registration reservation belongs to another wallet")
        if int(reservation.get("years", 0)) != int(years):
            raise gl.vm.UserError("Registration duration does not match the reservation")
        if str(reservation.get("primary_address", "")).lower() != clean_primary:
            raise gl.vm.UserError("Primary address does not match the reservation")

        payment = self._verify_arc_payment(
            full_name, int(years), ACTION_REGISTER, arc_tx_hash, int(arc_log_index)
        )

        owner = self._sender()
        now = self._now()
        obj = self._make_name_object(
            clean_label,
            full_name,
            "",
            False,
            owner,
            clean_primary,
            now,
            now + int(years) * SECONDS_PER_YEAR,
            payment,
        )

        was_new = existing is None
        if existing is not None:
            old_owner = str(existing.get("owner", "")).lower()
            old_primary = str(existing.get("primary_address", "")).lower()
            if old_owner != "":
                self._remove_owner_name(old_owner, full_name)
            if old_primary != "" and self.reverse_records.get(old_primary, "") == full_name:
                self.reverse_records[old_primary] = ""

        self._consume_payment(payment)
        self._save_name_obj(full_name, obj)
        self._add_owner_name(owner, full_name)
        self.reverse_records[clean_primary] = full_name
        self._clear_reservation(full_name)
        if was_new:
            self.name_counter += u256(1)

        return self._success("Name registered from finalized Arc USDC payment", obj)

    @gl.public.write
    def renew(
        self,
        label_or_name: str,
        years: u256,
        arc_tx_hash: str,
        arc_log_index: u256,
    ) -> str:
        if years < u256(1) or years > u256(5):
            raise gl.vm.UserError("Renewal duration must be between 1 and 5 years")

        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_active_owner(full_name)
        payment = self._verify_arc_payment(
            full_name, int(years), ACTION_RENEW, arc_tx_hash, int(arc_log_index)
        )

        current_expiry = int(obj.get("expires_at", self._now()))
        self._consume_payment(payment)
        obj["expires_at"] = current_expiry + int(years) * SECONDS_PER_YEAR
        obj["status"] = "active"
        obj["last_renewal_payment"] = payment
        self._save_name_obj(full_name, obj)

        return self._success("Name renewed from finalized Arc USDC payment", obj)

    # ------------------------------------------------------------------
    # owner operations
    # ------------------------------------------------------------------

    @gl.public.write
    def transfer(self, label_or_name: str, new_owner: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_active_owner(full_name)
        clean_new_owner = self._clean_address(new_owner, "new owner")
        old_owner = str(obj.get("owner", "")).lower()
        obj["owner"] = clean_new_owner
        self._save_name_obj(full_name, obj)
        self._remove_owner_name(old_owner, full_name)
        self._add_owner_name(clean_new_owner, full_name)
        return self._success("Name transferred", obj)

    @gl.public.write
    def set_primary_address(self, label_or_name: str, address: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_active_owner(full_name)
        clean = self._clean_address(address, "primary address")
        old = str(obj.get("primary_address", "")).lower()
        obj["primary_address"] = clean
        self._save_name_obj(full_name, obj)
        if old != "" and self.reverse_records.get(old, "") == full_name:
            self.reverse_records[old] = ""
        self.reverse_records[clean] = full_name
        return self._success("Primary address updated", obj)

    @gl.public.write
    def set_primary_name(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        self._require_active_owner(full_name)
        self.reverse_records[self._sender()] = full_name
        return self._success(
            "Primary name set", {"address": self._sender(), "name": full_name}
        )

    @gl.public.write
    def set_records(self, label_or_name: str, records_json: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_active_owner(full_name)
        incoming = self._load(records_json, None)
        if incoming is None or not isinstance(incoming, dict):
            raise gl.vm.UserError("Records must be a JSON object")

        records = obj.get("records", self._empty_records())
        for key in incoming:
            if not self._allowed_record_key(str(key)):
                raise gl.vm.UserError("Unsupported record key: " + str(key))
            value = str(incoming[key])
            if len(value) > 500:
                raise gl.vm.UserError("Record value is too long")
            records[str(key)] = value

        obj["records"] = records
        self._save_name_obj(full_name, obj)
        return self._success("Records updated", obj)

    @gl.public.write
    def clear_record(self, label_or_name: str, key: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_active_owner(full_name)
        if not self._allowed_record_key(key):
            raise gl.vm.UserError("Unsupported record key")
        records = obj.get("records", self._empty_records())
        records[key] = ""
        obj["records"] = records
        self._save_name_obj(full_name, obj)
        return self._success("Record cleared", obj)

    @gl.public.write
    def create_subname(
        self, parent_name: str, sub_label: str, primary_address: str
    ) -> str:
        parent = self._normalise_full_name(parent_name)
        parent_obj = self._require_active_owner(parent)

        clean_sub = str(sub_label).strip().lower()
        if not self._is_valid_sub_label(clean_sub):
            raise gl.vm.UserError("Invalid subname label")
        full_subname = clean_sub + "." + parent
        existing = self._get_name_obj(full_subname)
        if existing is not None and not self._is_expired_obj(existing):
            raise gl.vm.UserError("Subname already exists")

        clean_primary = self._clean_address(primary_address, "primary address")
        now = self._now()
        owner = self._sender()
        obj = self._make_name_object(
            clean_sub,
            full_subname,
            parent,
            True,
            owner,
            clean_primary,
            now,
            int(parent_obj.get("expires_at", now)),
            {"type": "parent-grant", "parent": parent},
        )

        was_new = existing is None
        if existing is not None:
            old_owner = str(existing.get("owner", "")).lower()
            old_primary = str(existing.get("primary_address", "")).lower()
            if old_owner != "":
                self._remove_owner_name(old_owner, full_subname)
            if old_primary != "" and self.reverse_records.get(old_primary, "") == full_subname:
                self.reverse_records[old_primary] = ""

        self._save_name_obj(full_subname, obj)
        self._add_owner_name(owner, full_subname)
        self._add_subname_to_parent(parent, full_subname)
        if was_new:
            self.name_counter += u256(1)
        return self._success("Subname created", obj)

    @gl.public.write
    def transfer_subname(self, subname: str, new_owner: str) -> str:
        full_name = self._normalise_full_name(subname)
        obj = self._require_active_owner(full_name)
        if not bool(obj.get("is_subname", False)):
            raise gl.vm.UserError("This method is only for subnames")
        clean_new_owner = self._clean_address(new_owner, "new owner")
        old_owner = str(obj.get("owner", "")).lower()
        obj["owner"] = clean_new_owner
        self._save_name_obj(full_name, obj)
        self._remove_owner_name(old_owner, full_name)
        self._add_owner_name(clean_new_owner, full_name)
        return self._success("Subname transferred", obj)

    # ------------------------------------------------------------------
    # reports + advisory suggestions
    # ------------------------------------------------------------------

    @gl.public.write
    def report_name(
        self,
        label_or_name: str,
        reason: str,
        evidence_url: str,
        comment: str,
    ) -> str:
        full_name = self._normalise_full_name(label_or_name)
        if str(reason).strip() == "" or len(str(reason)) > 80:
            raise gl.vm.UserError("Invalid report reason")
        if len(str(evidence_url)) > 300 or len(str(comment)) > 700:
            raise gl.vm.UserError("Report evidence/comment is too long")

        self.report_counter += u256(1)
        report_id = str(int(self.report_counter))
        report = {
            "id": report_id,
            "name": full_name,
            "name_exists": self._get_name_obj(full_name) is not None,
            "reporter": self._sender(),
            "reason": str(reason),
            "evidence_url": str(evidence_url),
            "comment": str(comment),
            "status": "open",
            "created_at": self._now(),
        }
        self.reports[report_id] = self._dump(report)
        return self._success("Report submitted", report)

    @gl.public.write
    def ai_suggest_names(self, base_label: str, purpose: str) -> str:
        base = str(base_label).strip().lower()
        purpose_clean = str(purpose).strip()
        if len(base) > 60 or len(purpose_clean) > 500:
            raise gl.vm.UserError("Suggestion input is too long")

        prompt = (
            "Suggest exactly 5 concise .gen root labels for this request. "
            "Labels must be 3-32 lowercase characters using only a-z, 0-9 and hyphen, "
            "without leading/trailing hyphen. Return JSON only as "
            "{\"suggestions\":[{\"label\":\"...\",\"reason\":\"...\"}]}. "
            "Base: " + base + "\nPurpose: " + purpose_clean
        )

        def ask():
            raw = gl.nondet.exec_prompt(prompt)
            return str(raw).replace("```json", "").replace("```", "").strip()

        raw = gl.eq_principle.prompt_comparative(
            ask,
            "Return five semantically equivalent valid GNS root-label suggestions. "
            "Validators should agree that every proposed label obeys the stated syntax "
            "and fits the supplied purpose. This is advisory and does not mutate ownership."
        )
        parsed = self._load(str(raw), {"suggestions": []})
        suggestions = []
        if isinstance(parsed, dict):
            items = parsed.get("suggestions", [])
            if isinstance(items, list):
                for item in items:
                    if not isinstance(item, dict):
                        continue
                    label = str(item.get("label", "")).strip().lower()
                    if self._is_valid_root_label(label):
                        suggestions.append(
                            {
                                "label": label,
                                "name": label + ROOT_SUFFIX,
                                "reason": str(item.get("reason", ""))[:180],
                            }
                        )
                    if len(suggestions) >= 5:
                        break

        self.review_counter += u256(1)
        review_id = str(int(self.review_counter))
        review = {
            "id": review_id,
            "type": "name_suggestion",
            "created_at": self._now(),
            "result": {"suggestions": suggestions},
        }
        self.ai_reviews[review_id] = self._dump(review)
        return self._success("Name suggestions generated", review)

    # ------------------------------------------------------------------
    # admin controls
    # ------------------------------------------------------------------

    @gl.public.write
    def admin_set_registrations_paused(self, paused: bool) -> str:
        self._require_admin()
        self.registrations_paused = bool(paused)
        return self._success(
            "Registration pause state updated",
            {"registrations_paused": self.registrations_paused},
        )

    @gl.public.write
    def admin_propose_admin(self, new_admin: str) -> str:
        self._require_admin()
        clean = self._clean_address(new_admin, "new admin")
        if clean == str(self.admin).lower():
            raise gl.vm.UserError("New admin must differ from current admin")
        self.pending_admin = clean
        return self._success(
            "Admin transfer proposed",
            {"admin": str(self.admin).lower(), "pending_admin": clean},
        )

    @gl.public.write
    def admin_cancel_admin_transfer(self) -> str:
        self._require_admin()
        self.pending_admin = ""
        return self._success("Admin transfer cancelled", {})

    @gl.public.write
    def accept_admin(self) -> str:
        if self._sender() != str(self.pending_admin).lower() or self.pending_admin == "":
            raise gl.vm.UserError("Only pending admin can accept")
        previous = str(self.admin).lower()
        self.admin = self._sender()
        self.pending_admin = ""
        return self._success(
            "Admin transferred",
            {"previous_admin": previous, "admin": str(self.admin).lower()},
        )

    @gl.public.write
    def admin_flag_name(self, label_or_name: str, reason: str) -> str:
        self._require_admin()
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_existing_name(full_name)
        obj["status"] = "flagged"
        obj["flag_reason"] = str(reason)[:500]
        self._save_name_obj(full_name, obj)
        return self._success("Name flagged", obj)

    @gl.public.write
    def admin_unflag_name(self, label_or_name: str) -> str:
        self._require_admin()
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_existing_name(full_name)
        obj["status"] = "active"
        obj["flag_reason"] = ""
        self._save_name_obj(full_name, obj)
        return self._success("Name unflagged", obj)

    @gl.public.write
    def admin_set_report_status(self, report_id: str, status: str) -> str:
        self._require_admin()
        clean_status = str(status).strip().lower()
        if clean_status not in ["open", "reviewed", "flagged", "dismissed"]:
            raise gl.vm.UserError("Invalid report status")
        report = self._load(self.reports.get(str(report_id), ""), None)
        if report is None:
            raise gl.vm.UserError("Report not found")
        report["status"] = clean_status
        self.reports[str(report_id)] = self._dump(report)
        return self._success("Report status updated", report)
