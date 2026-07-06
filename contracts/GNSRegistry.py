# v0.2.17
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from datetime import datetime, timezone
import json
import hashlib


ROOT_SUFFIX = ".gen"
SECONDS_PER_YEAR = 31536000
GEN_DECIMALS = 1000000000000000000
DEFAULT_PRICE_PER_YEAR_WEI = 5 * GEN_DECIMALS
CONTRACT_VERSION = "1.3.0-web-evidence"


@gl.evm.contract_interface
class _TreasuryRecipient:
    class View:
        pass

    class Write:
        pass


class GNSRegistry(gl.Contract):
    """
    GNS — GenLayer Naming Service

    Payable GenLayer-native naming protocol for .gen names.

    Examples:
    - papito.gen
    - bountylens.gen
    - pay.papito.gen
    - agent.papito.gen

    Core features:
    - Paid .gen name registration
    - Paid renewal
    - Protocol treasury
    - Admin withdrawal
    - Resolve names to addresses
    - Set profile/project/agent records
    - Reverse lookup address -> primary .gen name
    - Transfer names
    - Create subnames
    - Report suspicious names
    - AI review suspicious names and disputes
    """

    admin: str
    treasury: str

    names: TreeMap[str, str]
    owner_names: TreeMap[str, str]
    reverse_records: TreeMap[str, str]
    parent_subnames: TreeMap[str, str]
    reports: TreeMap[str, str]
    ai_reviews: TreeMap[str, str]
    web_evidence: TreeMap[str, str]

    name_counter: u256
    report_counter: u256
    review_counter: u256
    evidence_counter: u256

    price_per_year_wei: u256
    total_protocol_revenue: u256
    total_withdrawn: u256

    def __init__(self) -> None:
        self.admin = str(gl.message.sender_address).lower()
        self.treasury = str(gl.message.sender_address).lower()

        self.names = TreeMap()
        self.owner_names = TreeMap()
        self.reverse_records = TreeMap()
        self.parent_subnames = TreeMap()
        self.reports = TreeMap()
        self.ai_reviews = TreeMap()
        self.web_evidence = TreeMap()

        self.name_counter = u256(0)
        self.report_counter = u256(0)
        self.review_counter = u256(0)
        self.evidence_counter = u256(0)

        self.price_per_year_wei = u256(DEFAULT_PRICE_PER_YEAR_WEI)
        self.total_protocol_revenue = u256(0)
        self.total_withdrawn = u256(0)

    # -------------------------------------------------------------------------
    # Receive plain GEN transfers
    # -------------------------------------------------------------------------

    @gl.public.write.payable
    def __receive__(self) -> str:
        value = gl.message.value
        self.total_protocol_revenue = self.total_protocol_revenue + value

        return self._success("GEN received by GNS treasury contract", {
            "amount": str(int(value)),
            "contract_balance": str(int(self.balance)),
        })

    # -------------------------------------------------------------------------
    # Internal helpers
    # -------------------------------------------------------------------------

    def _sender(self) -> str:
        return str(gl.message.sender_address).lower()

    def _now(self) -> int:
        return int(datetime.now(timezone.utc).timestamp())

    def _json_dump(self, data) -> str:
        return json.dumps(data, separators=(",", ":"))

    def _success(self, message: str, data) -> str:
        return self._json_dump({
            "success": True,
            "message": message,
            "data": data,
        })

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
        allowed = [
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

        for item in allowed:
            if key == item:
                return True

        return False

    def _normalise_full_name(self, label_or_name: str) -> str:
        raw = label_or_name.strip().lower()

        if raw.endswith(ROOT_SUFFIX):
            return raw

        return raw + ROOT_SUFFIX

    def _strip_root_suffix(self, label_or_name: str) -> str:
        raw = label_or_name.strip().lower()

        if raw.endswith(ROOT_SUFFIX):
            return raw[0:len(raw) - len(ROOT_SUFFIX)]

        return raw

    def _is_valid_root_label(self, label: str) -> bool:
        if label is None:
            return False

        label = label.strip().lower()

        if len(label) < 3:
            return False

        if len(label) > 32:
            return False

        if label == "gen":
            return False

        if "." in label:
            return False

        if label.startswith("-") or label.endswith("-"):
            return False

        allowed = "abcdefghijklmnopqrstuvwxyz0123456789-"

        for ch in label:
            if ch not in allowed:
                return False

        return True

    def _is_valid_sub_label(self, label: str) -> bool:
        if label is None:
            return False

        label = label.strip().lower()

        if len(label) < 2:
            return False

        if len(label) > 32:
            return False

        if "." in label:
            return False

        if label.startswith("-") or label.endswith("-"):
            return False

        allowed = "abcdefghijklmnopqrstuvwxyz0123456789-"

        for ch in label:
            if ch not in allowed:
                return False

        return True

    def _name_exists(self, full_name: str) -> bool:
        raw = self.names.get(full_name, "")
        return raw != ""

    def _get_name_obj(self, full_name: str):
        raw = self.names.get(full_name, "")

        if raw == "":
            return None

        return json.loads(raw)

    def _save_name_obj(self, full_name: str, obj) -> None:
        self.names[full_name] = self._json_dump(obj)

    def _is_expired_obj(self, obj) -> bool:
        try:
            return int(obj.get("expires_at", 0)) < self._now()
        except Exception:
            return False

    def _address_key(self, address: str) -> str:
        return address.strip().lower()

    def _clean_address(self, address: str, label: str) -> str:
        if address is None:
            raise gl.vm.UserError(label + " is required")

        clean = str(address).strip().lower()

        if clean == "":
            raise gl.vm.UserError(label + " is required")

        if not clean.startswith("0x") or len(clean) != 42:
            raise gl.vm.UserError("Invalid " + label.lower())

        allowed = "0123456789abcdef"
        body = clean[2:]

        for ch in body:
            if ch not in allowed:
                raise gl.vm.UserError("Invalid " + label.lower())

        return clean

    def _get_owner_names(self, owner: str):
        raw = self.owner_names.get(owner.lower(), "[]")
        return json.loads(raw)

    def _save_owner_names(self, owner: str, arr) -> None:
        self.owner_names[owner.lower()] = self._json_dump(arr)

    def _add_owner_name(self, owner: str, full_name: str) -> None:
        owner_key = owner.lower()
        arr = self._get_owner_names(owner_key)

        found = False
        for item in arr:
            if item == full_name:
                found = True

        if not found:
            arr.append(full_name)

        self._save_owner_names(owner_key, arr)

    def _remove_owner_name(self, owner: str, full_name: str) -> None:
        owner_key = owner.lower()
        arr = self._get_owner_names(owner_key)
        updated = []

        for item in arr:
            if item != full_name:
                updated.append(item)

        self._save_owner_names(owner_key, updated)

    def _get_subnames_array(self, parent_name: str):
        raw = self.parent_subnames.get(parent_name, "[]")
        return json.loads(raw)

    def _save_subnames_array(self, parent_name: str, arr) -> None:
        self.parent_subnames[parent_name] = self._json_dump(arr)

    def _add_subname_to_parent(self, parent_name: str, subname: str) -> None:
        arr = self._get_subnames_array(parent_name)

        found = False
        for item in arr:
            if item == subname:
                found = True

        if not found:
            arr.append(subname)

        self._save_subnames_array(parent_name, arr)

    def _require_existing_name(self, full_name: str):
        obj = self._get_name_obj(full_name)

        if obj is None:
            raise gl.vm.UserError("Name does not exist")

        return obj

    def _require_owner(self, full_name: str):
        obj = self._require_existing_name(full_name)

        if obj.get("owner", "").lower() != self._sender():
            raise gl.vm.UserError("Only the name owner can perform this action")

        return obj

    def _require_admin(self) -> None:
        if str(gl.message.sender_address).lower() != self.admin.lower():
            raise gl.vm.UserError("Only admin can perform this action")

    def _record_value_ok(self, value: str) -> bool:
        if value is None:
            return False

        if len(value) > 500:
            return False

        return True

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
        amount_paid_wei: u256,
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
            "amount_paid_wei": str(int(amount_paid_wei)),
            "records": self._empty_records(),
            "ai_status": {
                "risk": "unreviewed",
                "verified": False,
                "last_review_id": "",
            },
        }

    def _valid_report_status(self, status: str) -> bool:
        allowed = ["open", "reviewed", "flagged", "dismissed"]

        for item in allowed:
            if status == item:
                return True

        return False

    def _valid_risk_status(self, risk: str) -> bool:
        allowed = ["unreviewed", "low", "medium", "high", "critical"]

        for item in allowed:
            if risk == item:
                return True

        return False

    def _is_fetchable_url(self, url: str) -> bool:
        clean = str(url).strip().lower()
        return clean.startswith("https://") and len(clean) <= 300

    def _exec_prompt_json(self, prompt: str) -> str:
        res = gl.nondet.exec_prompt(prompt)
        return res.replace("```json", "").replace("```", "").strip()

    def _safe_ai_json(self, raw: str):
        try:
            return json.loads(raw)
        except Exception:
            return {
                "risk": "medium",
                "verdict": "insufficient_evidence",
                "verified": False,
                "summary": "The AI response could not be parsed safely.",
                "reasons": ["Invalid or incomplete AI JSON response."],
                "recommended_action": "manual_review",
            }

    def _quote_years(self, years: u256) -> u256:
        return self.price_per_year_wei * years

    # -------------------------------------------------------------------------
    # Public view methods — pricing and treasury
    # -------------------------------------------------------------------------

    @gl.public.view
    def contract_version(self) -> str:
        return CONTRACT_VERSION

    @gl.public.view
    def get_price_per_year(self) -> u256:
        return self.price_per_year_wei

    @gl.public.view
    def quote_registration(self, years: u256) -> u256:
        if years < u256(1) or years > u256(5):
            raise gl.vm.UserError("Duration must be between 1 and 5 years")

        return self._quote_years(years)

    @gl.public.view
    def quote_renewal(self, years: u256) -> u256:
        if years < u256(1) or years > u256(5):
            raise gl.vm.UserError("Duration must be between 1 and 5 years")

        return self._quote_years(years)

    @gl.public.view
    def get_treasury(self) -> str:
        return str(self.treasury).lower()

    @gl.public.view
    def get_admin(self) -> str:
        return str(self.admin).lower()

    @gl.public.view
    def get_total_protocol_revenue(self) -> u256:
        return self.total_protocol_revenue

    @gl.public.view
    def get_total_withdrawn(self) -> u256:
        return self.total_withdrawn

    @gl.public.view
    def get_contract_balance(self) -> u256:
        return self.balance

    # -------------------------------------------------------------------------
    # Public view methods — registry
    # -------------------------------------------------------------------------

    @gl.public.view
    def normalize_name(self, label_or_name: str) -> str:
        return self._normalise_full_name(label_or_name)

    @gl.public.view
    def is_available(self, label_or_name: str) -> bool:
        full_name = self._normalise_full_name(label_or_name)
        raw = self.names.get(full_name, "")

        if raw == "":
            return True

        obj = json.loads(raw)

        if self._is_expired_obj(obj):
            return True

        return False

    @gl.public.view
    def owner_of(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)

        if obj is None:
            return ""

        return obj.get("owner", "")

    @gl.public.view
    def resolve(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)

        if obj is None:
            return "{}"

        if self._is_expired_obj(obj):
            obj["status"] = "expired"

        return self._json_dump(obj)

    @gl.public.view
    def resolve_address(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)

        if obj is None:
            return ""

        if self._is_expired_obj(obj):
            return ""

        return obj.get("primary_address", "")

    @gl.public.view
    def reverse_lookup(self, address: str) -> str:
        key = self._address_key(address)
        return self.reverse_records.get(key, "")

    @gl.public.view
    def get_records(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)

        if obj is None:
            return "{}"

        return self._json_dump(obj.get("records", {}))

    @gl.public.view
    def get_names_by_owner(self, owner: str) -> str:
        return self.owner_names.get(owner.lower(), "[]")

    @gl.public.view
    def get_my_names(self) -> str:
        return self.owner_names.get(self._sender(), "[]")

    @gl.public.view
    def get_subnames(self, parent_name: str) -> str:
        parent = self._normalise_full_name(parent_name)
        return self.parent_subnames.get(parent, "[]")

    @gl.public.view
    def get_report(self, report_id: str) -> str:
        return self.reports.get(report_id, "{}")

    @gl.public.view
    def get_ai_review(self, review_id: str) -> str:
        return self.ai_reviews.get(review_id, "{}")

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
    def get_total_evidence(self) -> u256:
        return self.evidence_counter

    @gl.public.view
    def get_web_evidence(self, evidence_id: str) -> str:
        return self.web_evidence.get(evidence_id, "{}")

    @gl.public.view
    def get_name_status(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)

        if obj is None:
            return "not_found"

        if self._is_expired_obj(obj):
            return "expired"

        return obj.get("status", "active")

    @gl.public.view
    def get_ai_status(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._get_name_obj(full_name)

        if obj is None:
            return "{}"

        return self._json_dump(obj.get("ai_status", {}))

    # -------------------------------------------------------------------------
    # Payable registry write methods
    # -------------------------------------------------------------------------

    @gl.public.write.payable
    def register(self, label: str, years: u256, primary_address: str) -> str:
        clean_label = self._strip_root_suffix(label)

        if not self._is_valid_root_label(clean_label):
            raise gl.vm.UserError("Invalid name label")

        if years < u256(1) or years > u256(5):
            raise gl.vm.UserError("Registration duration must be between 1 and 5 years")

        if primary_address.strip() == "":
            raise gl.vm.UserError("Primary address is required")

        required_payment = self._quote_years(years)
        amount_paid = gl.message.value

        if amount_paid < required_payment:
            raise gl.vm.UserError("Insufficient GEN sent for registration")

        full_name = clean_label + ROOT_SUFFIX

        existing_raw = self.names.get(full_name, "")
        if existing_raw != "":
            existing_obj = json.loads(existing_raw)
            if not self._is_expired_obj(existing_obj):
                raise gl.vm.UserError("Name is not available")

        owner = self._sender()
        now = self._now()
        expiry = now + (int(years) * SECONDS_PER_YEAR)

        obj = self._make_name_object(
            clean_label,
            full_name,
            "",
            False,
            owner,
            primary_address,
            now,
            expiry,
            amount_paid,
        )

        self._save_name_obj(full_name, obj)
        self._add_owner_name(owner, full_name)

        address_key = self._address_key(primary_address)
        existing_reverse = self.reverse_records.get(address_key, "")

        if existing_reverse == "":
            self.reverse_records[address_key] = full_name

        self.name_counter += u256(1)
        self.total_protocol_revenue = self.total_protocol_revenue + amount_paid

        return self._success("Name registered", {
            "name": obj,
            "required_payment_wei": str(int(required_payment)),
            "amount_paid_wei": str(int(amount_paid)),
            "contract_balance_wei": str(int(self.balance)),
        })

    @gl.public.write.payable
    def renew(self, label_or_name: str, years: u256) -> str:
        full_name = self._normalise_full_name(label_or_name)

        if years < u256(1) or years > u256(5):
            raise gl.vm.UserError("Renewal duration must be between 1 and 5 years")

        required_payment = self._quote_years(years)
        amount_paid = gl.message.value

        if amount_paid < required_payment:
            raise gl.vm.UserError("Insufficient GEN sent for renewal")

        obj = self._require_owner(full_name)

        now = self._now()
        current_expiry = int(obj.get("expires_at", now))

        if current_expiry < now:
            current_expiry = now

        obj["expires_at"] = current_expiry + (int(years) * SECONDS_PER_YEAR)
        obj["status"] = "active"

        previous_paid = int(obj.get("amount_paid_wei", "0"))
        obj["amount_paid_wei"] = str(previous_paid + int(amount_paid))

        self._save_name_obj(full_name, obj)
        self.total_protocol_revenue = self.total_protocol_revenue + amount_paid

        return self._success("Name renewed", {
            "name": obj,
            "required_payment_wei": str(int(required_payment)),
            "amount_paid_wei": str(int(amount_paid)),
            "contract_balance_wei": str(int(self.balance)),
        })

    # -------------------------------------------------------------------------
    # Registry management methods
    # -------------------------------------------------------------------------

    @gl.public.write
    def transfer(self, label_or_name: str, new_owner: str) -> str:
        full_name = self._normalise_full_name(label_or_name)

        if new_owner.strip() == "":
            raise gl.vm.UserError("New owner is required")

        obj = self._require_owner(full_name)

        old_owner = obj.get("owner", "").lower()
        clean_new_owner = new_owner.strip().lower()

        obj["owner"] = clean_new_owner

        self._save_name_obj(full_name, obj)
        self._remove_owner_name(old_owner, full_name)
        self._add_owner_name(clean_new_owner, full_name)

        return self._success("Name transferred", obj)

    @gl.public.write
    def set_primary_address(self, label_or_name: str, address: str) -> str:
        full_name = self._normalise_full_name(label_or_name)

        if address.strip() == "":
            raise gl.vm.UserError("Address is required")

        obj = self._require_owner(full_name)

        old_address = obj.get("primary_address", "").lower()
        new_address = address.strip().lower()

        obj["primary_address"] = new_address

        self._save_name_obj(full_name, obj)

        old_reverse = self.reverse_records.get(old_address, "")
        if old_reverse == full_name:
            self.reverse_records[old_address] = ""

        self.reverse_records[new_address] = full_name

        return self._success("Primary address updated", obj)

    @gl.public.write
    def set_primary_name(self, label_or_name: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        self._require_owner(full_name)

        sender = self._sender()
        self.reverse_records[sender] = full_name

        return self._success("Primary name set", {
            "address": sender,
            "name": full_name,
        })

    @gl.public.write
    def set_records(self, label_or_name: str, records_json: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_owner(full_name)

        incoming = json.loads(records_json)
        records = obj.get("records", self._empty_records())

        for key in incoming:
            if not self._allowed_record_key(key):
                raise gl.vm.UserError("Unsupported record key: " + key)

            value = str(incoming[key])

            if not self._record_value_ok(value):
                raise gl.vm.UserError("Record value is too long")

            records[key] = value

        obj["records"] = records

        self._save_name_obj(full_name, obj)

        return self._success("Records updated", obj)

    @gl.public.write
    def clear_record(self, label_or_name: str, key: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_owner(full_name)

        if not self._allowed_record_key(key):
            raise gl.vm.UserError("Unsupported record key")

        records = obj.get("records", self._empty_records())
        records[key] = ""

        obj["records"] = records

        self._save_name_obj(full_name, obj)

        return self._success("Record cleared", obj)

    # -------------------------------------------------------------------------
    # Subname methods
    # -------------------------------------------------------------------------

    @gl.public.write
    def create_subname(self, parent_name: str, sub_label: str, primary_address: str) -> str:
        parent = self._normalise_full_name(parent_name)
        clean_sub = sub_label.strip().lower()

        if not self._is_valid_sub_label(clean_sub):
            raise gl.vm.UserError("Invalid subname label")

        if primary_address.strip() == "":
            raise gl.vm.UserError("Primary address is required")

        parent_obj = self._require_owner(parent)

        if self._is_expired_obj(parent_obj):
            raise gl.vm.UserError("Parent name is expired")

        full_subname = clean_sub + "." + parent

        existing_raw = self.names.get(full_subname, "")
        if existing_raw != "":
            raise gl.vm.UserError("Subname already exists")

        owner = self._sender()
        now = self._now()
        parent_expiry = int(parent_obj.get("expires_at", now))

        obj = self._make_name_object(
            clean_sub,
            full_subname,
            parent,
            True,
            owner,
            primary_address,
            now,
            parent_expiry,
            u256(0),
        )

        self._save_name_obj(full_subname, obj)
        self._add_owner_name(owner, full_subname)
        self._add_subname_to_parent(parent, full_subname)

        self.name_counter += u256(1)

        return self._success("Subname created", obj)

    @gl.public.write
    def transfer_subname(self, subname: str, new_owner: str) -> str:
        full_name = self._normalise_full_name(subname)

        if new_owner.strip() == "":
            raise gl.vm.UserError("New owner is required")

        obj = self._require_owner(full_name)

        if not obj.get("is_subname", False):
            raise gl.vm.UserError("This method is only for subnames")

        old_owner = obj.get("owner", "").lower()
        clean_new_owner = new_owner.strip().lower()

        obj["owner"] = clean_new_owner

        self._save_name_obj(full_name, obj)
        self._remove_owner_name(old_owner, full_name)
        self._add_owner_name(clean_new_owner, full_name)

        return self._success("Subname transferred", obj)

    # -------------------------------------------------------------------------
    # Report methods
    # -------------------------------------------------------------------------

    @gl.public.write
    def report_name(
        self,
        label_or_name: str,
        reason: str,
        evidence_url: str,
        comment: str,
    ) -> str:
        full_name = self._normalise_full_name(label_or_name)

        if reason.strip() == "":
            raise gl.vm.UserError("Report reason is required")

        if len(reason) > 80:
            raise gl.vm.UserError("Reason is too long")

        if len(evidence_url) > 300:
            raise gl.vm.UserError("Evidence URL is too long")

        if len(comment) > 700:
            raise gl.vm.UserError("Comment is too long")

        self.report_counter += u256(1)
        report_id = str(int(self.report_counter))

        exists = self._name_exists(full_name)

        report = {
            "id": report_id,
            "name": full_name,
            "name_exists": exists,
            "reporter": self._sender(),
            "reason": reason,
            "evidence_url": evidence_url,
            "comment": comment,
            "status": "open",
            "created_at": self._now(),
            "ai_review_id": "",
        }

        self.reports[report_id] = self._json_dump(report)

        return self._success("Report submitted", report)

    @gl.public.write
    def admin_set_report_status(self, report_id: str, status: str) -> str:
        self._require_admin()

        if not self._valid_report_status(status):
            raise gl.vm.UserError("Invalid report status")

        raw = self.reports.get(report_id, "")

        if raw == "":
            raise gl.vm.UserError("Report does not exist")

        report = json.loads(raw)
        report["status"] = status

        self.reports[report_id] = self._json_dump(report)

        return self._success("Report status updated", report)
    @gl.public.write
    def verify_name_url(self, label_or_name: str, evidence_type: str, url: str) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_owner(full_name)

        clean_type = str(evidence_type).strip().lower()
        clean_url = str(url).strip()

        allowed_types = ["website", "github", "x", "agent", "evidence"]
        found_type = False
        for item in allowed_types:
            if clean_type == item:
                found_type = True

        if not found_type:
            raise gl.vm.UserError("Unsupported evidence type")

        if not self._is_fetchable_url(clean_url):
            raise gl.vm.UserError("Evidence URL must be an https URL up to 300 chars")

        def fetch_task() -> str:
            result = {"ok": False, "sha256": "", "bytes": 0, "error": ""}
            try:
                response = gl.nondet.web.request(clean_url, method="GET")
                body = response.body
                result["sha256"] = hashlib.sha256(body).hexdigest()
                result["bytes"] = len(body)
                result["ok"] = True
            except Exception as e:
                result["error"] = str(e)
            return json.dumps(result, sort_keys=True, separators=(",", ":"))

        fetch_result_raw = gl.eq_principle.strict_eq(fetch_task)
        fetch_result = json.loads(fetch_result_raw)

        self.evidence_counter += u256(1)
        evidence_id = str(int(self.evidence_counter))
        status = "VERIFIED" if bool(fetch_result.get("ok", False)) else "FAILED_FETCH"

        evidence = {
            "id": evidence_id,
            "name": full_name,
            "evidence_type": clean_type,
            "url": clean_url,
            "status": status,
            "sha256": str(fetch_result.get("sha256", "")),
            "bytes": int(fetch_result.get("bytes", 0)),
            "error": str(fetch_result.get("error", "")),
            "verified": status == "VERIFIED",
            "verified_at": self._now(),
            "consensus_method": "strict_eq_web_request",
            "requested_by": self._sender(),
        }

        self.web_evidence[evidence_id] = self._json_dump(evidence)

        existing = obj.get("web_evidence", [])
        existing.append(evidence_id)
        obj["web_evidence"] = existing
        self._save_name_obj(full_name, obj)

        return self._success("URL evidence fetched by validators", evidence)


    # -------------------------------------------------------------------------
    # AI / Intelligent review methods
    #
    # High-stakes identity, verification, and dispute decisions use
    # prompt_comparative so validators independently judge the verdict-bearing
    # fields. Non-mutating creative suggestions may remain non-comparative.
    # -------------------------------------------------------------------------

    @gl.public.write
    def ai_review_name(
        self,
        label_or_name: str,
        claim: str,
        evidence_url: str,
        extra_context: str,
    ) -> str:
        full_name = self._normalise_full_name(label_or_name)

        if len(claim) > 700:
            raise gl.vm.UserError("Claim is too long")

        if len(evidence_url) > 300:
            raise gl.vm.UserError("Evidence URL is too long")

        if len(extra_context) > 1200:
            raise gl.vm.UserError("Extra context is too long")

        obj = self._get_name_obj(full_name)

        name_payload = "{}"
        if obj is not None:
            name_payload = self._json_dump(obj)

        prompt = (
            "You are reviewing a GenLayer Naming Service .gen name for identity and impersonation risk.\n\n"
            "Name:\n"
            + full_name
            + "\n\nExisting name data:\n"
            + name_payload
            + "\n\nClaim:\n"
            + claim
            + "\n\nEvidence URL:\n"
            + evidence_url
            + "\n\nExtra context:\n"
            + extra_context
            + """
Return ONLY valid JSON with this exact schema:
{
  "risk": "low" | "medium" | "high" | "critical",
  "verdict": "safe" | "suspicious" | "impersonation_risk" | "phishing_risk" | "insufficient_evidence",
  "verified": true | false,
  "summary": "short summary",
  "reasons": ["reason 1", "reason 2"],
  "recommended_action": "no_action" | "monitor" | "flag" | "manual_review"
}
"""
        )

        result = gl.eq_principle.prompt_comparative(
            lambda: self._exec_prompt_json(prompt),
            "Independently review the supplied GNS name, claim, evidence URL, and context for identity, impersonation, phishing, and verification risk. Validators must agree on risk, verdict, verified, and recommended_action, not only JSON shape. Return only valid JSON with risk, verdict, verified, summary, reasons, and recommended_action."
        )
        parsed = self._safe_ai_json(result)

        risk = str(parsed.get("risk", "medium"))
        if not self._valid_risk_status(risk):
            risk = "medium"

        verified = bool(parsed.get("verified", False))

        self.review_counter += u256(1)
        review_id = str(int(self.review_counter))

        review = {
            "id": review_id,
            "name": full_name,
            "reviewer": "genlayer-ai",
            "consensus_method": "prompt_comparative",
            "requested_by": self._sender(),
            "claim": claim,
            "evidence_url": evidence_url,
            "extra_context": extra_context,
            "result": parsed,
            "created_at": self._now(),
        }

        self.ai_reviews[review_id] = self._json_dump(review)

        if obj is not None:
            obj["ai_status"] = {
                "risk": risk,
                "verified": verified,
                "last_review_id": review_id,
            }

            if risk == "high" or risk == "critical":
                obj["status"] = "flagged"

            self._save_name_obj(full_name, obj)

        return self._success("AI name review completed", review)

    @gl.public.write
    def ai_review_report(self, report_id: str) -> str:
        raw = self.reports.get(report_id, "")

        if raw == "":
            raise gl.vm.UserError("Report does not exist")

        report = json.loads(raw)
        full_name = report.get("name", "")

        obj = self._get_name_obj(full_name)

        name_payload = "{}"
        if obj is not None:
            name_payload = self._json_dump(obj)

        prompt = (
            "You are reviewing a report submitted to GNS, the GenLayer Naming Service.\n\n"
            "Report:\n"
            + self._json_dump(report)
            + "\n\nName data:\n"
            + name_payload
            + """
Return ONLY valid JSON with this exact schema:
{
  "risk": "low" | "medium" | "high" | "critical",
  "verdict": "valid_report" | "invalid_report" | "needs_more_evidence" | "impersonation_risk" | "phishing_risk",
  "verified": true | false,
  "summary": "short summary",
  "reasons": ["reason 1", "reason 2"],
  "recommended_report_status": "reviewed" | "flagged" | "dismissed"
}
"""
        )

        result = gl.eq_principle.prompt_comparative(
            lambda: self._exec_prompt_json(prompt),
            "Independently review the submitted GNS report and existing name data. Validators must agree on risk, verdict, verified, and recommended_report_status before any report or name status is updated. Return only valid JSON with risk, verdict, verified, summary, reasons, and recommended_report_status."
        )
        parsed = self._safe_ai_json(result)

        risk = str(parsed.get("risk", "medium"))
        if not self._valid_risk_status(risk):
            risk = "medium"

        recommended_status = str(parsed.get("recommended_report_status", "reviewed"))

        if not self._valid_report_status(recommended_status):
            recommended_status = "reviewed"

        verified = bool(parsed.get("verified", False))

        self.review_counter += u256(1)
        review_id = str(int(self.review_counter))

        review = {
            "id": review_id,
            "name": full_name,
            "report_id": report_id,
            "reviewer": "genlayer-ai",
            "consensus_method": "prompt_comparative",
            "requested_by": self._sender(),
            "result": parsed,
            "created_at": self._now(),
        }

        self.ai_reviews[review_id] = self._json_dump(review)

        report["status"] = recommended_status
        report["ai_review_id"] = review_id
        self.reports[report_id] = self._json_dump(report)

        if obj is not None:
            obj["ai_status"] = {
                "risk": risk,
                "verified": verified,
                "last_review_id": review_id,
            }

            if recommended_status == "flagged" or risk == "high" or risk == "critical":
                obj["status"] = "flagged"

            self._save_name_obj(full_name, obj)

        return self._success("AI report review completed", {
            "report": report,
            "review": review,
        })

    @gl.public.write
    def ai_verify_project_claim(
        self,
        label_or_name: str,
        project_name: str,
        official_website: str,
        official_x: str,
        official_github: str,
        explanation: str,
    ) -> str:
        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_owner(full_name)

        if len(project_name) > 100:
            raise gl.vm.UserError("Project name is too long")

        if len(official_website) > 300:
            raise gl.vm.UserError("Website URL is too long")

        if len(official_x) > 120:
            raise gl.vm.UserError("X handle is too long")

        if len(official_github) > 300:
            raise gl.vm.UserError("GitHub URL is too long")

        if len(explanation) > 1000:
            raise gl.vm.UserError("Explanation is too long")

        prompt = (
            "You are reviewing a project identity claim for GNS, the GenLayer Naming Service.\n\n"
            "The user owns this .gen name:\n"
            + full_name
            + "\n\nCurrent name object:\n"
            + self._json_dump(obj)
            + "\n\nClaimed project name:\n"
            + project_name
            + "\n\nOfficial website:\n"
            + official_website
            + "\n\nOfficial X:\n"
            + official_x
            + "\n\nOfficial GitHub:\n"
            + official_github
            + "\n\nExplanation:\n"
            + explanation
            + """
Return ONLY valid JSON with this exact schema:
{
  "risk": "low" | "medium" | "high" | "critical",
  "verdict": "verified" | "partially_verified" | "not_verified" | "suspicious",
  "verified": true | false,
  "summary": "short summary",
  "reasons": ["reason 1", "reason 2"],
  "recommended_action": "verify" | "manual_review" | "reject" | "monitor"
}
"""
        )

        result = gl.eq_principle.prompt_comparative(
            lambda: self._exec_prompt_json(prompt),
            "Independently review whether the user-owned GNS name legitimately represents the claimed project identity using the provided website, X, GitHub, and explanation. Validators must agree on risk, verdict, verified, and recommended_action, not only JSON shape. Return only valid JSON with risk, verdict, verified, summary, reasons, and recommended_action."
        )
        parsed = self._safe_ai_json(result)

        risk = str(parsed.get("risk", "medium"))
        if not self._valid_risk_status(risk):
            risk = "medium"

        verified = bool(parsed.get("verified", False))

        self.review_counter += u256(1)
        review_id = str(int(self.review_counter))

        review = {
            "id": review_id,
            "name": full_name,
            "reviewer": "genlayer-ai",
            "consensus_method": "prompt_comparative",
            "requested_by": self._sender(),
            "project_name": project_name,
            "official_website": official_website,
            "official_x": official_x,
            "official_github": official_github,
            "explanation": explanation,
            "result": parsed,
            "created_at": self._now(),
        }

        self.ai_reviews[review_id] = self._json_dump(review)

        obj["ai_status"] = {
            "risk": risk,
            "verified": verified,
            "last_review_id": review_id,
        }

        if risk == "high" or risk == "critical":
            obj["status"] = "flagged"

        self._save_name_obj(full_name, obj)

        return self._success("AI project verification completed", review)

    @gl.public.write
    def ai_suggest_names(self, base_label: str, purpose: str) -> str:
        clean_label = base_label.strip().lower()

        if len(clean_label) < 2:
            raise gl.vm.UserError("Base label is too short")

        if len(clean_label) > 32:
            raise gl.vm.UserError("Base label is too long")

        if len(purpose) > 500:
            raise gl.vm.UserError("Purpose is too long")

        prompt = (
            "You are suggesting names for GNS, the GenLayer Naming Service.\n\n"
            "Base label:\n"
            + clean_label
            + "\n\nPurpose:\n"
            + purpose
            + """
Return ONLY valid JSON with this exact schema:
{
  "suggestions": [
    {
      "name": "example.gen",
      "reason": "short reason"
    }
  ]
}

Rules:
- Suggest 5 names only.
- Every name must end with .gen.
- Use only lowercase letters, numbers, and hyphens.
- Do not suggest names that look like fake support accounts.
- Do not suggest obvious impersonation of known protocols.
- Keep names short and brandable.
"""
        )

        result = gl.eq_principle.prompt_non_comparative(
            lambda: self._exec_prompt_json(prompt),
            "Suggest five safe, brandable .gen names based on the base label and purpose. Return only valid JSON matching the requested schema.",
            "The response must be valid JSON. It must include a suggestions array with exactly five objects. Each object must include name and reason. Every suggested name must end with .gen and use only lowercase letters, numbers, and hyphens. Do not include markdown or extra text."
        )
        parsed = self._safe_ai_json(result)

        self.review_counter += u256(1)
        review_id = str(int(self.review_counter))

        review = {
            "id": review_id,
            "type": "name_suggestions",
            "base_label": clean_label,
            "purpose": purpose,
            "consensus_method": "prompt_non_comparative_advisory",
            "requested_by": self._sender(),
            "result": parsed,
            "created_at": self._now(),
        }

        self.ai_reviews[review_id] = self._json_dump(review)

        return self._success("AI name suggestions completed", review)

    # -------------------------------------------------------------------------
    # Admin treasury methods
    # -------------------------------------------------------------------------

    @gl.public.write
    def admin_set_price_per_year(self, new_price_wei: u256) -> str:
        self._require_admin()

        try:
            price_u256 = u256(int(str(new_price_wei).strip()))
        except Exception:
            raise gl.vm.UserError("Price must be a whole number in wei")

        if price_u256 <= u256(0):
            raise gl.vm.UserError("Price must be greater than zero")

        self.price_per_year_wei = price_u256

        return self._success("Price per year updated", {
            "price_per_year_wei": str(int(self.price_per_year_wei)),
        })

    @gl.public.write
    def admin_set_treasury(self, new_treasury: str) -> str:
        self._require_admin()

        clean_treasury = self._clean_address(new_treasury, "Treasury address")
        self.treasury = clean_treasury

        return self._success("Treasury updated", {
            "treasury": self.treasury,
        })

    @gl.public.write
    def admin_withdraw(self, amount: u256) -> str:
        self._require_admin()

        try:
            amount_u256 = u256(int(str(amount).strip()))
        except Exception:
            raise gl.vm.UserError("Withdrawal amount must be a whole number in wei")

        try:
            balance_u256 = u256(int(str(self.balance).strip()))
        except Exception:
            raise gl.vm.UserError("Could not read contract balance")

        if amount_u256 <= u256(0):
            raise gl.vm.UserError("Withdrawal amount must be greater than zero")

        if amount_u256 > balance_u256:
            raise gl.vm.UserError("Insufficient contract balance")

        _TreasuryRecipient(Address(self.treasury)).emit_transfer(value=amount_u256)

        self.total_withdrawn = self.total_withdrawn + amount_u256
        remaining_balance_wei = int(balance_u256) - int(amount_u256)

        return self._success("Treasury withdrawal emitted", {
            "treasury": str(self.treasury).lower(),
            "amount_wei": str(int(amount_u256)),
            "total_withdrawn_wei": str(int(self.total_withdrawn)),
            "remaining_balance_wei": str(remaining_balance_wei),
        })

    # -------------------------------------------------------------------------
    # Admin registry methods
    # -------------------------------------------------------------------------

    @gl.public.write
    def admin_set_report_status(self, report_id: str, status: str) -> str:
        self._require_admin()

        if not self._valid_report_status(status):
            raise gl.vm.UserError("Invalid report status")

        raw = self.reports.get(report_id, "")

        if raw == "":
            raise gl.vm.UserError("Report does not exist")

        report = json.loads(raw)
        report["status"] = status

        self.reports[report_id] = self._json_dump(report)

        return self._success("Report status updated", report)

    @gl.public.write
    def admin_flag_name(self, label_or_name: str, reason: str) -> str:
        self._require_admin()

        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_existing_name(full_name)

        if len(reason) > 500:
            raise gl.vm.UserError("Reason is too long")

        obj["status"] = "flagged"
        obj["admin_flag_reason"] = reason
        obj["admin_flagged_at"] = self._now()

        self._save_name_obj(full_name, obj)

        return self._success("Name flagged", obj)

    @gl.public.write
    def admin_unflag_name(self, label_or_name: str) -> str:
        self._require_admin()

        full_name = self._normalise_full_name(label_or_name)
        obj = self._require_existing_name(full_name)

        obj["status"] = "active"
        obj["admin_flag_reason"] = ""
        obj["admin_flagged_at"] = 0

        self._save_name_obj(full_name, obj)

        return self._success("Name unflagged", obj)

    @gl.public.write
    def admin_transfer_admin(self, new_admin: str) -> str:
        self._require_admin()

        clean_admin = self._clean_address(new_admin, "New admin address")
        self.admin = clean_admin

        return self._success("Admin transferred", {
            "new_admin": self.admin,
        })
