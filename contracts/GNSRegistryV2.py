# v0.2.17
# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
from datetime import datetime, timezone
import json
import hashlib


ROOT_SUFFIX = ".gen"
CONTRACT_VERSION = "2.0.0-authenticity-alpha"
DEFAULT_POLICY_VERSION = "gns-auth-v2"
MAX_EVIDENCE_SOURCES = 5
MAX_URL_LEN = 300
MAX_BODY_CHARS = 24000
MAX_CONTEXT_CHARS = 4000
MAX_ATTESTATION_LIFETIME_SECONDS = 7 * 24 * 60 * 60
MAX_CLOCK_SKEW_SECONDS = 300


class GNSRegistryV2(gl.Contract):
    """
    GNS v2 — evidence-based namespace authenticity and dispute adjudication.

    The namespace registry remains deterministic infrastructure. GenLayer is used
    where it is actually required: deciding whether a wallet-controlled namespace
    legitimately represents a claimed project/agent/organization/public identity,
    and resolving challenges against those claims from independently retrieved
    evidence.

    Trust model:
    - Registering a .gen name is NOT verification.
    - Positive verification can only be requested by the current namespace owner.
    - Every verdict-bearing path retrieves cited evidence inside the transaction.
    - Evidence must bind itself to namespace + owner wallet + this contract +
      claim id + challenge nonce + policy version.
    - Validators independently reproduce the evidence-grounded decision and must
      agree on decision-bearing fields.
    - Owner / identity-record changes invalidate the active verification.
    """

    admin: str
    policy_version: str

    names: TreeMap[str, str]
    owner_names: TreeMap[str, str]
    claims: TreeMap[str, str]
    namespace_claims: TreeMap[str, str]
    challenges: TreeMap[str, str]
    verdicts: TreeMap[str, str]

    name_counter: u256
    claim_counter: u256
    challenge_counter: u256
    verdict_counter: u256

    def __init__(self) -> None:
        self.admin = self._sender()
        self.policy_version = DEFAULT_POLICY_VERSION

        self.names = TreeMap()
        self.owner_names = TreeMap()
        self.claims = TreeMap()
        self.namespace_claims = TreeMap()
        self.challenges = TreeMap()
        self.verdicts = TreeMap()

        self.name_counter = u256(0)
        self.claim_counter = u256(0)
        self.challenge_counter = u256(0)
        self.verdict_counter = u256(0)

    # ---------------------------------------------------------------------
    # Basic helpers
    # ---------------------------------------------------------------------

    def _sender(self) -> str:
        return str(gl.message.sender_address).lower()

    def _self_address(self) -> str:
        return str(gl.message.contract_address).lower()

    def _now(self) -> int:
        raw = str(gl.message_raw["datetime"])
        clean = raw.replace("Z", "+00:00")
        return int(datetime.fromisoformat(clean).timestamp())

    def _dump(self, value) -> str:
        return json.dumps(value, sort_keys=True, separators=(",", ":"))

    def _load(self, raw: str, fallback):
        if raw == "":
            return fallback
        try:
            return json.loads(raw)
        except Exception:
            return fallback

    def _sha256_text(self, value: str) -> str:
        return hashlib.sha256(value.encode("utf-8")).hexdigest()

    def _normalise_name(self, label_or_name: str) -> str:
        raw = str(label_or_name).strip().lower()
        if raw.endswith(ROOT_SUFFIX):
            return raw
        return raw + ROOT_SUFFIX

    def _strip_suffix(self, label_or_name: str) -> str:
        raw = str(label_or_name).strip().lower()
        if raw.endswith(ROOT_SUFFIX):
            return raw[: len(raw) - len(ROOT_SUFFIX)]
        return raw

    def _valid_label(self, label: str) -> bool:
        clean = str(label).strip().lower()
        if len(clean) < 3 or len(clean) > 32:
            return False
        if clean == "gen" or "." in clean:
            return False
        if clean.startswith("-") or clean.endswith("-"):
            return False
        allowed = "abcdefghijklmnopqrstuvwxyz0123456789-"
        for ch in clean:
            if ch not in allowed:
                return False
        return True

    def _clean_address(self, address: str, label: str) -> str:
        clean = str(address).strip().lower()
        if len(clean) != 42 or not clean.startswith("0x"):
            raise gl.vm.UserError("Invalid " + label)
        allowed = "0123456789abcdef"
        for ch in clean[2:]:
            if ch not in allowed:
                raise gl.vm.UserError("Invalid " + label)
        return clean

    def _name_obj(self, namespace: str):
        return self._load(self.names.get(namespace, ""), None)

    def _claim_obj(self, claim_id: str):
        return self._load(self.claims.get(str(claim_id), ""), None)

    def _challenge_obj(self, challenge_id: str):
        return self._load(self.challenges.get(str(challenge_id), ""), None)

    def _save_name(self, namespace: str, obj) -> None:
        self.names[namespace] = self._dump(obj)

    def _save_claim(self, claim_id: str, obj) -> None:
        self.claims[str(claim_id)] = self._dump(obj)

    def _save_challenge(self, challenge_id: str, obj) -> None:
        self.challenges[str(challenge_id)] = self._dump(obj)

    def _require_admin(self) -> None:
        if self._sender() != str(self.admin).lower():
            raise gl.vm.UserError("Only admin can perform this action")

    def _require_name(self, namespace: str):
        obj = self._name_obj(namespace)
        if obj is None:
            raise gl.vm.UserError("Namespace does not exist")
        return obj

    def _require_owner(self, namespace: str):
        obj = self._require_name(namespace)
        if str(obj.get("owner", "")).lower() != self._sender():
            raise gl.vm.UserError("Only the namespace owner can perform this action")
        return obj

    def _owner_names(self, owner: str):
        return self._load(self.owner_names.get(owner.lower(), ""), [])

    def _add_owner_name(self, owner: str, namespace: str) -> None:
        arr = self._owner_names(owner)
        if namespace not in arr:
            arr.append(namespace)
        self.owner_names[owner.lower()] = self._dump(arr)

    def _remove_owner_name(self, owner: str, namespace: str) -> None:
        arr = self._owner_names(owner)
        self.owner_names[owner.lower()] = self._dump(
            [item for item in arr if item != namespace]
        )

    def _subject_hash(self, namespace: str, name_obj, policy_version: str) -> str:
        subject = {
            "namespace": namespace,
            "owner": str(name_obj.get("owner", "")).lower(),
            "primary_address": str(name_obj.get("primary_address", "")).lower(),
            "records": {
                "website": str(name_obj.get("records", {}).get("website", "")),
                "github": str(name_obj.get("records", {}).get("github", "")),
                "x": str(name_obj.get("records", {}).get("x", "")),
                "agent": str(name_obj.get("records", {}).get("agent", "")),
            },
            "policy_version": policy_version,
        }
        return self._sha256_text(self._dump(subject))

    def _invalidate_verification(self, namespace: str, name_obj, reason: str) -> None:
        verification = name_obj.get("verification", {})
        if verification.get("status", "UNVERIFIED") == "VERIFIED":
            verification["status"] = "STALE"
            verification["invalidated_at"] = self._now()
            verification["invalidation_reason"] = reason
            name_obj["verification"] = verification
            self._save_name(namespace, name_obj)

    # ---------------------------------------------------------------------
    # Evidence model
    # ---------------------------------------------------------------------

    def _parse_manifest(self, evidence_manifest_json: str):
        if len(evidence_manifest_json) > 6000:
            raise gl.vm.UserError("Evidence manifest is too large")
        manifest = self._load(evidence_manifest_json, None)
        if manifest is None or not isinstance(manifest, list):
            raise gl.vm.UserError("Evidence manifest must be a JSON array")
        if len(manifest) < 1 or len(manifest) > MAX_EVIDENCE_SOURCES:
            raise gl.vm.UserError("Evidence manifest must contain 1 to 5 sources")

        normalized = []
        for entry in manifest:
            if not isinstance(entry, dict):
                raise gl.vm.UserError("Each evidence source must be an object")
            source_type = str(entry.get("type", "")).strip().lower()
            url = str(entry.get("url", "")).strip()
            if source_type not in ["website", "github", "attestation", "other"]:
                raise gl.vm.UserError("Unsupported evidence source type")
            if not url.startswith("https://") or len(url) > MAX_URL_LEN:
                raise gl.vm.UserError("Every evidence URL must be https")
            normalized.append({"type": source_type, "url": url})
        return normalized

    def _fetch_source(self, source) -> dict:
        result = {
            "type": source["type"],
            "url": source["url"],
            "ok": False,
            "status_code": 0,
            "body": "",
            "sha256": "",
            "error": "",
        }
        try:
            response = gl.nondet.web.request(source["url"], method="GET")
            status_code = int(response.status_code)
            body_bytes = response.body
            try:
                body_text = body_bytes.decode("utf-8")
            except Exception:
                body_text = str(body_bytes)

            result["status_code"] = status_code
            if len(body_text) > MAX_BODY_CHARS:
                body_text = body_text[:MAX_BODY_CHARS]
            result["body"] = body_text
            result["sha256"] = self._sha256_text(body_text)
            result["ok"] = status_code >= 200 and status_code < 300
        except Exception as exc:
            result["error"] = str(exc)[:300]
        return result

    def _fetch_all(self, manifest) -> list:
        fetched = []
        for source in manifest:
            fetched.append(self._fetch_source(source))
        return fetched

    def _attestation_check(
        self,
        fetched_sources,
        namespace: str,
        owner: str,
        claim_id: str,
        challenge_nonce: str,
        policy_version: str,
        expected_registry: str,
        now_ts: int,
    ) -> dict:
        valid = 0
        invalid = 0
        reasons = []

        for source in fetched_sources:
            if not source.get("ok", False):
                invalid += 1
                reasons.append("FETCH_FAILED:" + str(source.get("url", "")))
                continue

            body = str(source.get("body", "")).strip()
            parsed = self._load(body, None)
            if parsed is None or not isinstance(parsed, dict):
                invalid += 1
                reasons.append("ATTESTATION_NOT_JSON:" + str(source.get("url", "")))
                continue

            source_ok = True
            if str(parsed.get("protocol", "")) != "gns-claim-v2":
                source_ok = False
            if str(parsed.get("namespace", "")).strip().lower() != namespace:
                source_ok = False
            if str(parsed.get("wallet", "")).strip().lower() != owner:
                source_ok = False
            if str(parsed.get("claim_id", "")) != str(claim_id):
                source_ok = False
            if str(parsed.get("challenge", "")) != challenge_nonce:
                source_ok = False
            if str(parsed.get("policy_version", "")) != policy_version:
                source_ok = False

            registry = str(parsed.get("registry", "")).strip().lower()
            if expected_registry != "" and registry != expected_registry:
                source_ok = False

            try:
                issued_at = int(parsed.get("issued_at", 0))
                expires_at = int(parsed.get("expires_at", 0))
                if issued_at <= 0 or expires_at <= 0:
                    source_ok = False
                if issued_at > now_ts + MAX_CLOCK_SKEW_SECONDS:
                    source_ok = False
                if expires_at <= now_ts:
                    source_ok = False
                if expires_at <= issued_at:
                    source_ok = False
                if expires_at - issued_at > MAX_ATTESTATION_LIFETIME_SECONDS:
                    source_ok = False
            except Exception:
                source_ok = False

            if source_ok:
                valid += 1
            else:
                invalid += 1
                reasons.append("ATTESTATION_BINDING_FAILED:" + str(source.get("url", "")))

        return {
            "valid_attestations": valid,
            "invalid_sources": invalid,
            "reasons": reasons,
        }

    def _evidence_digest(self, fetched_sources) -> str:
        digests = []
        for item in fetched_sources:
            digests.append({
                "type": item.get("type", ""),
                "url": item.get("url", ""),
                "ok": bool(item.get("ok", False)),
                "status_code": int(item.get("status_code", 0)),
                "sha256": item.get("sha256", ""),
            })
        return self._sha256_text(self._dump(digests))

    def _safe_decision_json(self, raw, fallback_reason: str) -> dict:
        try:
            if isinstance(raw, dict):
                parsed = raw
            else:
                parsed = json.loads(
                    str(raw).replace("```json", "").replace("```", "").strip()
                )
            decision = str(parsed.get("decision", "")).upper()
            if decision not in [
                "VERIFIED",
                "REJECTED",
                "INSUFFICIENT_EVIDENCE",
                "UPHOLD",
                "REVOKE",
            ]:
                raise ValueError("invalid decision")
            reason_code = str(parsed.get("reason_code", "")).strip().upper()
            if reason_code == "" or len(reason_code) > 80:
                raise ValueError("invalid reason code")
            return {
                "decision": decision,
                "reason_code": reason_code,
                "summary": str(parsed.get("summary", ""))[:500],
            }
        except Exception:
            return {
                "decision": "INSUFFICIENT_EVIDENCE",
                "reason_code": fallback_reason,
                "summary": "Consensus output could not be parsed safely.",
            }

    # ---------------------------------------------------------------------
    # Deterministic namespace layer
    # ---------------------------------------------------------------------

    @gl.public.write
    def register(self, label: str, primary_address: str) -> str:
        clean_label = self._strip_suffix(label)
        if not self._valid_label(clean_label):
            raise gl.vm.UserError("Invalid namespace label")

        namespace = clean_label + ROOT_SUFFIX
        if self._name_obj(namespace) is not None:
            raise gl.vm.UserError("Namespace is already registered")

        owner = self._sender()
        address = self._clean_address(primary_address, "primary address")
        now = self._now()

        obj = {
            "label": clean_label,
            "namespace": namespace,
            "owner": owner,
            "primary_address": address,
            "records": {
                "website": "",
                "github": "",
                "x": "",
                "agent": "",
                "description": "",
            },
            "created_at": now,
            "verification": {
                "status": "UNVERIFIED",
                "claim_id": "",
                "verdict_id": "",
                "subject_hash": "",
                "policy_version": self.policy_version,
            },
        }
        self._save_name(namespace, obj)
        self._add_owner_name(owner, namespace)
        self.name_counter += u256(1)
        return self._dump({"success": True, "namespace": namespace})

    @gl.public.write
    def transfer(self, label_or_name: str, new_owner: str) -> str:
        namespace = self._normalise_name(label_or_name)
        obj = self._require_owner(namespace)
        old_owner = str(obj.get("owner", "")).lower()
        clean_new_owner = self._clean_address(new_owner, "new owner")
        if clean_new_owner == old_owner:
            raise gl.vm.UserError("New owner must differ from current owner")

        obj["owner"] = clean_new_owner
        self._invalidate_verification(namespace, obj, "OWNER_CHANGED")
        self._save_name(namespace, obj)
        self._remove_owner_name(old_owner, namespace)
        self._add_owner_name(clean_new_owner, namespace)
        return self._dump({"success": True, "namespace": namespace, "owner": clean_new_owner})

    @gl.public.write
    def set_primary_address(self, label_or_name: str, primary_address: str) -> str:
        namespace = self._normalise_name(label_or_name)
        obj = self._require_owner(namespace)
        address = self._clean_address(primary_address, "primary address")
        if address != str(obj.get("primary_address", "")).lower():
            obj["primary_address"] = address
            self._invalidate_verification(namespace, obj, "PRIMARY_ADDRESS_CHANGED")
            self._save_name(namespace, obj)
        return self._dump({"success": True, "namespace": namespace})

    @gl.public.write
    def set_identity_records(self, label_or_name: str, records_json: str) -> str:
        namespace = self._normalise_name(label_or_name)
        obj = self._require_owner(namespace)
        incoming = self._load(records_json, None)
        if incoming is None or not isinstance(incoming, dict):
            raise gl.vm.UserError("records_json must be an object")

        allowed = ["website", "github", "x", "agent", "description"]
        changed_identity = False
        records = obj.get("records", {})
        for key in incoming:
            if key not in allowed:
                raise gl.vm.UserError("Unsupported record key: " + str(key))
            value = str(incoming[key]).strip()
            if len(value) > 500:
                raise gl.vm.UserError("Record value too long")
            if key in ["website", "github", "x", "agent"] and records.get(key, "") != value:
                changed_identity = True
            records[key] = value

        obj["records"] = records
        if changed_identity:
            self._invalidate_verification(namespace, obj, "IDENTITY_RECORDS_CHANGED")
        self._save_name(namespace, obj)
        return self._dump({"success": True, "namespace": namespace})

    # ---------------------------------------------------------------------
    # Claim lifecycle
    # ---------------------------------------------------------------------

    @gl.public.write
    def create_claim(
        self,
        label_or_name: str,
        claim_type: str,
        evidence_manifest_json: str,
        context: str,
    ) -> str:
        namespace = self._normalise_name(label_or_name)
        name_obj = self._require_owner(namespace)

        clean_type = str(claim_type).strip().lower()
        if clean_type not in ["project", "agent", "organization", "public_identity"]:
            raise gl.vm.UserError("Unsupported claim type")
        if len(context) > MAX_CONTEXT_CHARS:
            raise gl.vm.UserError("Claim context is too long")

        manifest = self._parse_manifest(evidence_manifest_json)
        self.claim_counter += u256(1)
        claim_id = str(int(self.claim_counter))
        nonce = self._sha256_text(
            namespace
            + "|"
            + self._sender()
            + "|"
            + claim_id
            + "|"
            + str(self._now())
        )[:32]

        subject_hash = self._subject_hash(namespace, name_obj, self.policy_version)
        claim = {
            "id": claim_id,
            "namespace": namespace,
            "claim_type": clean_type,
            "owner": self._sender(),
            "status": "PENDING_EVIDENCE",
            "policy_version": self.policy_version,
            "challenge": nonce,
            "subject_hash": subject_hash,
            "evidence_manifest": manifest,
            "context": context,
            "created_at": self._now(),
            "verified_at": 0,
            "verdict_id": "",
            "active_challenge_id": "",
        }
        self._save_claim(claim_id, claim)
        self.namespace_claims[namespace] = claim_id

        return self._dump({
            "success": True,
            "claim_id": claim_id,
            "challenge": nonce,
            "attestation_protocol": "gns-claim-v2",
            "policy_version": self.policy_version,
        })

    def _evaluate_positive_claim(
        self,
        claim,
        name_snapshot,
        current_subject_hash: str,
        expected_registry: str,
        now_ts: int,
    ) -> dict:
        namespace = str(claim.get("namespace", ""))
        current_owner = str(name_snapshot.get("owner", "")).lower()

        if current_owner != str(claim.get("owner", "")).lower():
            return {
                "decision": "REJECTED",
                "reason_code": "OWNER_CHANGED",
                "summary": "Claim owner no longer controls the namespace.",
                "evidence_digest": "",
            }

        if current_subject_hash != str(claim.get("subject_hash", "")):
            return {
                "decision": "REJECTED",
                "reason_code": "SUBJECT_CHANGED",
                "summary": "Identity-relevant namespace state changed after claim creation.",
                "evidence_digest": "",
            }

        fetched = self._fetch_all(claim.get("evidence_manifest", []))
        digest = self._evidence_digest(fetched)
        check = self._attestation_check(
            fetched,
            namespace,
            current_owner,
            str(claim.get("id", "")),
            str(claim.get("challenge", "")),
            str(claim.get("policy_version", "")),
            expected_registry,
            now_ts,
        )

        if int(check.get("valid_attestations", 0)) < 1:
            return {
                "decision": "REJECTED",
                "reason_code": "NO_WALLET_BOUND_ATTESTATION",
                "summary": "No retrieved source contained a valid wallet-bound GNS attestation.",
                "evidence_digest": digest,
            }

        successful_sources = 0
        for item in fetched:
            if bool(item.get("ok", False)):
                successful_sources += 1

        claim_type = str(claim.get("claim_type", ""))
        if claim_type in ["project", "organization", "public_identity"] and successful_sources < 2:
            return {
                "decision": "INSUFFICIENT_EVIDENCE",
                "reason_code": "CORROBORATION_REQUIRED",
                "summary": "This claim type requires a wallet-bound attestation plus at least one additional retrievable source.",
                "evidence_digest": digest,
            }

        evidence_for_prompt = []
        for item in fetched:
            evidence_for_prompt.append({
                "type": item.get("type", ""),
                "url": item.get("url", ""),
                "ok": item.get("ok", False),
                "body": item.get("body", ""),
            })

        prompt = (
            "You adjudicate a GNS namespace authenticity claim.\n"
            "The contract has already confirmed that at least one retrieved source "
            "contains a valid wallet-bound attestation for this exact namespace, "
            "wallet, registry, claim id, challenge, and policy version.\n\n"
            "Decide whether the independently retrieved evidence corpus supports "
            "the claimed identity type. Do not rely on URL names alone. Treat "
            "missing, contradictory, or irrelevant sources conservatively.\n\n"
            "Namespace: " + namespace + "\n"
            "Owner wallet: " + current_owner + "\n"
            "Claim type: " + str(claim.get("claim_type", "")) + "\n"
            "Context: " + str(claim.get("context", "")) + "\n"
            "Fetched evidence: " + self._dump(evidence_for_prompt) + "\n\n"
            "Return ONLY JSON: "
            '{"decision":"VERIFIED|REJECTED|INSUFFICIENT_EVIDENCE",'
            '"reason_code":"UPPER_SNAKE_CASE","summary":"short explanation"}'
        )
        raw = gl.nondet.exec_prompt(prompt, response_format="json")
        judged = self._safe_decision_json(raw, "INVALID_MODEL_OUTPUT")
        if judged["decision"] not in ["VERIFIED", "REJECTED", "INSUFFICIENT_EVIDENCE"]:
            judged["decision"] = "INSUFFICIENT_EVIDENCE"
        judged["evidence_digest"] = digest
        return judged

    @gl.public.write
    def verify_claim(self, claim_id: str) -> str:
        claim = self._claim_obj(claim_id)
        if claim is None:
            raise gl.vm.UserError("Claim does not exist")
        if str(claim.get("status", "")) not in [
            "PENDING_EVIDENCE",
            "REJECTED",
            "INSUFFICIENT_EVIDENCE",
        ]:
            raise gl.vm.UserError("Claim is not eligible for verification")

        if self._sender() != str(claim.get("owner", "")).lower():
            raise gl.vm.UserError("Only the claim owner can request verification")

        namespace = str(claim.get("namespace", ""))
        if self.namespace_claims.get(namespace, "") != str(claim_id):
            raise gl.vm.UserError("Claim has been superseded by a newer namespace claim")

        name_snapshot = self._require_name(namespace)
        policy_snapshot = str(claim.get("policy_version", ""))
        if policy_snapshot != str(self.policy_version):
            raise gl.vm.UserError("Claim policy is stale; create a new claim")
        current_subject_hash = self._subject_hash(
            namespace, name_snapshot, policy_snapshot
        )
        expected_registry = self._self_address()
        now_ts = self._now()

        def leader_fn():
            return self._evaluate_positive_claim(
                claim,
                name_snapshot,
                current_subject_hash,
                expected_registry,
                now_ts,
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            validator = self._evaluate_positive_claim(
                claim,
                name_snapshot,
                current_subject_hash,
                expected_registry,
                now_ts,
            )
            leader = leader_result.calldata
            return str(leader.get("decision", "")) == str(
                validator.get("decision", "")
            )

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.verdict_counter += u256(1)
        verdict_id = str(int(self.verdict_counter))
        verdict = {
            "id": verdict_id,
            "kind": "CLAIM_VERIFICATION",
            "claim_id": str(claim_id),
            "namespace": namespace,
            "decision": result.get("decision", "INSUFFICIENT_EVIDENCE"),
            "reason_code": result.get("reason_code", "UNKNOWN"),
            "summary": result.get("summary", ""),
            "evidence_digest": result.get("evidence_digest", ""),
            "policy_version": policy_snapshot,
            "subject_hash": claim.get("subject_hash", ""),
            "created_at": self._now(),
        }
        self.verdicts[verdict_id] = self._dump(verdict)

        decision = verdict["decision"]
        claim["status"] = decision
        claim["verdict_id"] = verdict_id
        if decision == "VERIFIED":
            claim["verified_at"] = self._now()
        self._save_claim(str(claim_id), claim)

        name_obj = self._require_name(namespace)
        if decision == "VERIFIED":
            name_obj["verification"] = {
                "status": "VERIFIED",
                "claim_id": str(claim_id),
                "verdict_id": verdict_id,
                "subject_hash": claim.get("subject_hash", ""),
                "policy_version": policy_snapshot,
                "verified_at": self._now(),
                "invalidation_reason": "",
            }
        else:
            name_obj["verification"] = {
                "status": decision,
                "claim_id": str(claim_id),
                "verdict_id": verdict_id,
                "subject_hash": claim.get("subject_hash", ""),
                "policy_version": policy_snapshot,
                "verified_at": 0,
                "invalidation_reason": "",
            }
        self._save_name(namespace, name_obj)

        return self._dump({"success": True, "verdict": verdict})

    # ---------------------------------------------------------------------
    # Challenge lifecycle
    # ---------------------------------------------------------------------

    @gl.public.write
    def challenge_claim(
        self,
        claim_id: str,
        reason_code: str,
        evidence_manifest_json: str,
        context: str,
    ) -> str:
        claim = self._claim_obj(claim_id)
        if claim is None:
            raise gl.vm.UserError("Claim does not exist")
        namespace = str(claim.get("namespace", ""))
        if self.namespace_claims.get(namespace, "") != str(claim_id):
            raise gl.vm.UserError("Only the latest namespace claim can be challenged")
        if str(claim.get("status", "")) != "VERIFIED":
            raise gl.vm.UserError("Only a verified claim can be challenged")
        if str(claim.get("active_challenge_id", "")) != "":
            raise gl.vm.UserError("Claim already has an active challenge")

        clean_reason = str(reason_code).strip().upper()
        if clean_reason not in [
            "IMPERSONATION",
            "OWNERSHIP_CHANGED",
            "MISREPRESENTATION",
            "PHISHING",
            "STALE_EVIDENCE",
            "CONTRADICTORY_EVIDENCE",
        ]:
            raise gl.vm.UserError("Unsupported challenge reason")
        if len(context) > MAX_CONTEXT_CHARS:
            raise gl.vm.UserError("Challenge context is too long")

        manifest = self._parse_manifest(evidence_manifest_json)
        self.challenge_counter += u256(1)
        challenge_id = str(int(self.challenge_counter))

        challenge = {
            "id": challenge_id,
            "claim_id": str(claim_id),
            "namespace": claim.get("namespace", ""),
            "challenger": self._sender(),
            "reason_code": clean_reason,
            "evidence_manifest": manifest,
            "context": context,
            "status": "OPEN",
            "created_at": self._now(),
            "verdict_id": "",
        }
        self._save_challenge(challenge_id, challenge)

        claim["active_challenge_id"] = challenge_id
        claim["status"] = "CHALLENGED"
        self._save_claim(str(claim_id), claim)

        name_obj = self._require_name(namespace)
        verification = name_obj.get("verification", {})
        verification["status"] = "CHALLENGED"
        verification["challenge_id"] = challenge_id
        name_obj["verification"] = verification
        self._save_name(namespace, name_obj)

        return self._dump({"success": True, "challenge_id": challenge_id})

    def _evaluate_challenge(
        self,
        claim,
        challenge,
        name_snapshot,
        current_subject_hash: str,
        expected_registry: str,
        now_ts: int,
    ) -> dict:
        namespace = str(claim.get("namespace", ""))
        claimant_fetched = self._fetch_all(claim.get("evidence_manifest", []))
        challenger_fetched = self._fetch_all(challenge.get("evidence_manifest", []))

        claimant_digest = self._evidence_digest(claimant_fetched)
        challenger_digest = self._evidence_digest(challenger_fetched)
        combined_digest = self._sha256_text(claimant_digest + "|" + challenger_digest)

        current_owner = str(name_snapshot.get("owner", "")).lower()
        claimant_binding = self._attestation_check(
            claimant_fetched,
            namespace,
            current_owner,
            str(claim.get("id", "")),
            str(claim.get("challenge", "")),
            str(claim.get("policy_version", "")),
            expected_registry,
            now_ts,
        )

        if current_owner != str(claim.get("owner", "")).lower():
            return {
                "decision": "REVOKE",
                "reason_code": "OWNER_CHANGED",
                "summary": "The namespace is no longer controlled by the originally verified wallet.",
                "evidence_digest": combined_digest,
            }

        if current_subject_hash != str(claim.get("subject_hash", "")):
            return {
                "decision": "REVOKE",
                "reason_code": "SUBJECT_CHANGED",
                "summary": "Identity-relevant namespace state changed after verification.",
                "evidence_digest": combined_digest,
            }

        if int(claimant_binding.get("valid_attestations", 0)) < 1:
            return {
                "decision": "REVOKE",
                "reason_code": "CLAIMANT_ATTESTATION_NO_LONGER_VALID",
                "summary": "The previously verified wallet-bound attestation can no longer be validated.",
                "evidence_digest": combined_digest,
            }

        prompt = (
            "You resolve a challenge against a previously verified GNS identity claim.\n"
            "Both claimant and challenger sources below were independently fetched "
            "inside this verdict transaction. The claimant still has at least one "
            "valid wallet-bound attestation. Decide whether the challenge proves "
            "that the claim should be revoked, or whether the existing verification "
            "should be upheld. If the evidence is genuinely inconclusive, return "
            "INSUFFICIENT_EVIDENCE. Do not trust URL names or claimant/challenger "
            "assertions without support in the fetched content.\n\n"
            "Namespace: " + namespace + "\n"
            "Claim type: " + str(claim.get("claim_type", "")) + "\n"
            "Challenge reason: " + str(challenge.get("reason_code", "")) + "\n"
            "Claim context: " + str(claim.get("context", "")) + "\n"
            "Challenge context: " + str(challenge.get("context", "")) + "\n"
            "Claimant fetched evidence: " + self._dump(claimant_fetched) + "\n"
            "Challenger fetched evidence: " + self._dump(challenger_fetched) + "\n\n"
            "Return ONLY JSON: "
            '{"decision":"UPHOLD|REVOKE|INSUFFICIENT_EVIDENCE",'
            '"reason_code":"UPPER_SNAKE_CASE","summary":"short explanation"}'
        )
        raw = gl.nondet.exec_prompt(prompt, response_format="json")
        judged = self._safe_decision_json(raw, "INVALID_MODEL_OUTPUT")
        if judged["decision"] not in ["UPHOLD", "REVOKE", "INSUFFICIENT_EVIDENCE"]:
            judged["decision"] = "INSUFFICIENT_EVIDENCE"
        judged["evidence_digest"] = combined_digest
        return judged

    @gl.public.write
    def resolve_challenge(self, challenge_id: str) -> str:
        challenge = self._challenge_obj(challenge_id)
        if challenge is None:
            raise gl.vm.UserError("Challenge does not exist")
        if str(challenge.get("status", "")) != "OPEN":
            raise gl.vm.UserError("Challenge is not open")

        claim_id = str(challenge.get("claim_id", ""))
        claim = self._claim_obj(claim_id)
        if claim is None:
            raise gl.vm.UserError("Referenced claim does not exist")

        namespace = str(claim.get("namespace", ""))
        name_snapshot = self._require_name(namespace)
        policy_snapshot = str(claim.get("policy_version", ""))
        current_subject_hash = self._subject_hash(
            namespace, name_snapshot, policy_snapshot
        )
        expected_registry = self._self_address()
        now_ts = self._now()

        def leader_fn():
            return self._evaluate_challenge(
                claim,
                challenge,
                name_snapshot,
                current_subject_hash,
                expected_registry,
                now_ts,
            )

        def validator_fn(leader_result) -> bool:
            if not isinstance(leader_result, gl.vm.Return):
                return False
            validator = self._evaluate_challenge(
                claim,
                challenge,
                name_snapshot,
                current_subject_hash,
                expected_registry,
                now_ts,
            )
            leader = leader_result.calldata
            return str(leader.get("decision", "")) == str(
                validator.get("decision", "")
            )

        result = gl.vm.run_nondet_unsafe(leader_fn, validator_fn)

        self.verdict_counter += u256(1)
        verdict_id = str(int(self.verdict_counter))
        verdict = {
            "id": verdict_id,
            "kind": "CHALLENGE_RESOLUTION",
            "challenge_id": str(challenge_id),
            "claim_id": claim_id,
            "namespace": namespace,
            "decision": result.get("decision", "INSUFFICIENT_EVIDENCE"),
            "reason_code": result.get("reason_code", "UNKNOWN"),
            "summary": result.get("summary", ""),
            "evidence_digest": result.get("evidence_digest", ""),
            "policy_version": policy_snapshot,
            "created_at": self._now(),
        }
        self.verdicts[verdict_id] = self._dump(verdict)

        decision = verdict["decision"]
        challenge["status"] = decision
        challenge["verdict_id"] = verdict_id
        self._save_challenge(str(challenge_id), challenge)

        claim["active_challenge_id"] = ""
        name_obj = self._require_name(namespace)

        if decision == "REVOKE":
            claim["status"] = "REVOKED"
            verification = name_obj.get("verification", {})
            verification["status"] = "REVOKED"
            verification["verdict_id"] = verdict_id
            verification["revoked_at"] = self._now()
            verification["revocation_reason"] = verdict["reason_code"]
            name_obj["verification"] = verification
        elif decision == "UPHOLD":
            claim["status"] = "VERIFIED"
            verification = name_obj.get("verification", {})
            verification["status"] = "VERIFIED"
            verification["verdict_id"] = verdict_id
            verification["last_challenge_resolved_at"] = self._now()
            name_obj["verification"] = verification
        else:
            claim["status"] = "INSUFFICIENT_EVIDENCE"
            verification = name_obj.get("verification", {})
            verification["status"] = "INCONCLUSIVE"
            verification["verdict_id"] = verdict_id
            name_obj["verification"] = verification

        self._save_claim(claim_id, claim)
        self._save_name(namespace, name_obj)

        return self._dump({"success": True, "verdict": verdict})

    # ---------------------------------------------------------------------
    # Views
    # ---------------------------------------------------------------------

    @gl.public.view
    def contract_version(self) -> str:
        return CONTRACT_VERSION

    @gl.public.view
    def get_policy_version(self) -> str:
        return self.policy_version

    @gl.public.view
    def resolve(self, label_or_name: str) -> str:
        namespace = self._normalise_name(label_or_name)
        obj = self._name_obj(namespace)
        if obj is None:
            return "{}"

        verification = obj.get("verification", {})
        if verification.get("status", "") == "VERIFIED":
            expected = str(verification.get("subject_hash", ""))
            policy = str(verification.get("policy_version", self.policy_version))
            if policy != str(self.policy_version):
                verification["status"] = "STALE"
                verification["invalidation_reason"] = "POLICY_VERSION_CHANGED"
                obj["verification"] = verification
            elif expected != self._subject_hash(namespace, obj, policy):
                verification["status"] = "STALE"
                verification["invalidation_reason"] = "SUBJECT_HASH_MISMATCH"
                obj["verification"] = verification

        return self._dump(obj)

    @gl.public.view
    def owner_of(self, label_or_name: str) -> str:
        namespace = self._normalise_name(label_or_name)
        obj = self._name_obj(namespace)
        if obj is None:
            return ""
        return str(obj.get("owner", "")).lower()

    @gl.public.view
    def get_claim(self, claim_id: str) -> str:
        return self.claims.get(str(claim_id), "{}")

    @gl.public.view
    def get_namespace_claim(self, label_or_name: str) -> str:
        namespace = self._normalise_name(label_or_name)
        claim_id = self.namespace_claims.get(namespace, "")
        if claim_id == "":
            return "{}"
        return self.claims.get(claim_id, "{}")

    @gl.public.view
    def get_challenge(self, challenge_id: str) -> str:
        return self.challenges.get(str(challenge_id), "{}")

    @gl.public.view
    def get_verdict(self, verdict_id: str) -> str:
        return self.verdicts.get(str(verdict_id), "{}")

    @gl.public.view
    def get_names_by_owner(self, owner: str) -> str:
        return self.owner_names.get(str(owner).lower(), "[]")

    @gl.public.view
    def get_total_names(self) -> u256:
        return self.name_counter

    @gl.public.view
    def get_total_claims(self) -> u256:
        return self.claim_counter

    @gl.public.view
    def get_total_challenges(self) -> u256:
        return self.challenge_counter

    @gl.public.view
    def get_total_verdicts(self) -> u256:
        return self.verdict_counter

    # ---------------------------------------------------------------------
    # Governance
    # ---------------------------------------------------------------------

    @gl.public.write
    def admin_set_policy_version(self, new_policy_version: str) -> str:
        self._require_admin()
        clean = str(new_policy_version).strip()
        if len(clean) < 3 or len(clean) > 80:
            raise gl.vm.UserError("Invalid policy version")
        self.policy_version = clean
        return self._dump({"success": True, "policy_version": clean})

    @gl.public.write
    def admin_transfer_admin(self, new_admin: str) -> str:
        self._require_admin()
        self.admin = self._clean_address(new_admin, "new admin")
        return self._dump({"success": True, "admin": self.admin})
