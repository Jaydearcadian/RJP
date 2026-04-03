# { "Depends": "py-genlayer:latest" }

import json
import hashlib
import typing
from dataclasses import dataclass

from genlayer import *

ALLOWED_RISK_FLAGS = (
    "SPARSE_ACTIVITY",
    "FAILED_TX",
    "BROAD_COUNTERPARTY_SPREAD",
    "UNBOUNDED_APPROVAL",
    "FLAGGED_INTERACTION",
    "MALFORMED_MODEL_OUTPUT",
)

PROTOCOL_DOMAIN_ID = "counterparty_trust.base_trade_v1"
PROTOCOL_PERMISSION_DOMAIN_ID = "protocol_safety.base_erc20_permission_v1"
SUPPORTED_PROTOCOL_DOMAINS = (
    PROTOCOL_DOMAIN_ID,
    PROTOCOL_PERMISSION_DOMAIN_ID,
)
PROTOCOL_CASE_SCHEMA_VERSION = "rjp.case_object.v1"
COMPACT_PROTOCOL_CASE_SCHEMA_VERSION = "rjp.case_object.compact_submission.v1"
PROTOCOL_ASSESSMENT_SCHEMA_VERSION = "rjp.assessment_artifact.v1"
PROTOCOL_JUDGMENT_SCHEMA_VERSION = "rjp.judgment_object.v1"
PLACEHOLDER_PROTOCOL_TIMESTAMP = "1970-01-01T00:00:00Z"


@allow_storage
@dataclass
class EvidenceRecord:
    subject_id: str
    domain_id: str
    case_id: str
    claim_type: str
    subject_type: str
    target_type: str
    target_contract: str
    target_protocol: str
    target_context_json: str
    domain_spec_hash: str
    evidence_policy_hash: str
    sequence: u32
    case_schema_version: str
    extractor_version: str
    manifest_schema_version: str
    manifest_root: str
    evidence_manifest_hash: str
    manifest_item_count: u32
    case_hash: str
    evidence_anchor: str
    source_network: str
    source_chain_id: u32
    source_label: str
    start_block: u32
    end_block: u32
    start_block_hash: str
    end_block_hash: str
    tx_count: u32
    failed_tx_count: u32
    unique_counterparties: u32
    unbounded_approval_count: u32
    high_risk_flags: u32
    notes: str
    ingress_kind: str
    bridge_message_id: str
    bridge_source_chain_id: u32
    bridge_source_sender: str


@allow_storage
@dataclass
class JudgmentRecord:
    subject_id: str
    domain_id: str
    case_id: str
    claim_type: str
    domain_spec_hash: str
    evaluation_spec_hash: str
    model_policy_hash: str
    revision: u32
    evidence_sequence: u32
    case_schema_version: str
    extractor_version: str
    manifest_schema_version: str
    manifest_root: str
    manifest_item_count: u32
    freshness_window_blocks: u32
    valid_until_source_block: u32
    outcome: str
    confidence_ppm: u32
    reason_code: str
    assessment_hash: str
    case_hash: str
    risk_flags_json: str
    summary: str
    source_network: str
    source_chain_id: u32
    source_label: str
    start_block: u32
    end_block: u32
    start_block_hash: str
    end_block_hash: str
    evidence_anchor: str


@allow_storage
@dataclass
class AssessmentArtifactRecord:
    subject_id: str
    domain_id: str
    case_id: str
    assessment_hash: str
    revision: u32
    evidence_sequence: u32
    domain_spec_hash: str
    evaluation_spec_hash: str
    model_policy_hash: str
    parent_revision_hash: str
    evidence_root: str
    outcome_enum: str
    confidence_ppm: u32
    outcome_payload_json: str
    outcome_payload_hash: str
    evaluated_at: str


@allow_storage
@dataclass
class ActionRecord:
    actor: str
    subject_id: str
    action_type: str
    allowed: bool
    reason: str
    source_network: str
    source_chain_id: u32
    evidence_anchor: str
    judgment_revision: u32


class ReasonedJudgmentPass(gl.Contract):
    owner: Address
    bridge_receiver: Address
    domain_id: str
    evaluation_mode: str
    prompt_profile: str
    default_freshness_window_blocks: u32
    latest_evidence_by_subject: TreeMap[str, EvidenceRecord]
    evidence_count_by_subject: TreeMap[str, u32]
    evidence_log: DynArray[EvidenceRecord]
    latest_judgment_by_subject: TreeMap[str, JudgmentRecord]
    revision_count_by_subject: TreeMap[str, u32]
    judgment_log: DynArray[JudgmentRecord]
    latest_assessment_by_subject: TreeMap[str, AssessmentArtifactRecord]
    assessment_log: DynArray[AssessmentArtifactRecord]
    action_log: DynArray[ActionRecord]

    def __init__(
        self,
        bridge_receiver: str = "",
        evaluation_mode: str = "deterministic",
        default_freshness_window_blocks: int = 50000,
        prompt_profile: str = "standard",
    ):
        self.owner = gl.message.sender_address
        if len(bridge_receiver.strip()) > 0:
            self.bridge_receiver = Address(bridge_receiver)
        else:
            self.bridge_receiver = self.owner
        self.domain_id = "EXECUTION_INTEGRITY_V1"
        self.evaluation_mode = self._normalize_evaluation_mode(evaluation_mode)
        self.prompt_profile = self._normalize_prompt_profile(prompt_profile)
        self.default_freshness_window_blocks = u32(
            self._normalize_freshness_window_blocks(default_freshness_window_blocks)
        )

    @gl.public.view
    def get_domain(self) -> str:
        return self.domain_id

    @gl.public.view
    def get_owner(self) -> str:
        return str(self.owner)

    @gl.public.view
    def get_bridge_receiver(self) -> str:
        return str(self.bridge_receiver)

    @gl.public.view
    def get_evaluation_mode(self) -> str:
        return self.evaluation_mode

    @gl.public.view
    def get_prompt_profile(self) -> str:
        return self.prompt_profile

    @gl.public.view
    def get_default_freshness_window_blocks(self) -> int:
        return int(self.default_freshness_window_blocks)

    @gl.public.write
    def set_bridge_receiver(self, bridge_receiver: str):
        self._only_owner()
        self.bridge_receiver = Address(bridge_receiver)

    @gl.public.write
    def set_evaluation_mode(self, evaluation_mode: str):
        self._only_owner()
        self.evaluation_mode = self._normalize_evaluation_mode(evaluation_mode)

    @gl.public.write
    def set_prompt_profile(self, prompt_profile: str):
        self._only_owner()
        self.prompt_profile = self._normalize_prompt_profile(prompt_profile)

    @gl.public.write
    def set_default_freshness_window_blocks(self, freshness_window_blocks: int):
        self._only_owner()
        self.default_freshness_window_blocks = u32(
            self._normalize_freshness_window_blocks(freshness_window_blocks)
        )

    @gl.public.view
    def get_evidence_count(self, subject_id: str) -> int:
        subject_key = self._normalize_subject_id(subject_id)
        if subject_key not in self.evidence_count_by_subject:
            return 0
        return int(self.evidence_count_by_subject[subject_key])

    @gl.public.view
    def get_latest_evidence(self, subject_id: str) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if subject_key not in self.latest_evidence_by_subject:
            return {"exists": False, "subject_id": subject_key}
        return self._evidence_to_dict(self.latest_evidence_by_subject[subject_key])

    @gl.public.view
    def get_latest_case_object(self, subject_id: str) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if subject_key not in self.latest_evidence_by_subject:
            return {"exists": False, "subject_id": subject_key}
        return self._case_object_to_dict(self.latest_evidence_by_subject[subject_key])

    @gl.public.view
    def get_evidence(self, subject_id: str, sequence: int) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if sequence <= 0:
            return {"exists": False, "subject_id": subject_key, "sequence": sequence}

        for index in range(len(self.evidence_log)):
            record = self.evidence_log[index]
            if record.subject_id == subject_key and int(record.sequence) == sequence:
                return self._evidence_to_dict(record)

        return {"exists": False, "subject_id": subject_key, "sequence": sequence}

    @gl.public.view
    def get_case_object(self, subject_id: str, sequence: int) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if sequence <= 0:
            return {"exists": False, "subject_id": subject_key, "sequence": sequence}

        record = self._find_evidence_record(subject_key, sequence)
        if record is None:
            return {"exists": False, "subject_id": subject_key, "sequence": sequence}
        return self._case_object_to_dict(record)

    @gl.public.view
    def get_revision_count(self, subject_id: str) -> int:
        subject_key = self._normalize_subject_id(subject_id)
        if subject_key not in self.revision_count_by_subject:
            return 0
        return int(self.revision_count_by_subject[subject_key])

    @gl.public.view
    def get_latest_judgment(self, subject_id: str) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if subject_key not in self.latest_judgment_by_subject:
            return {"exists": False, "subject_id": subject_key}
        return self._judgment_to_dict(self.latest_judgment_by_subject[subject_key])

    @gl.public.view
    def get_latest_judgment_object(self, subject_id: str) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if subject_key not in self.latest_judgment_by_subject:
            return {"exists": False, "subject_id": subject_key}
        return self._judgment_object_to_dict(self.latest_judgment_by_subject[subject_key])

    @gl.public.view
    def get_latest_assessment_artifact(self, subject_id: str) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if subject_key not in self.latest_assessment_by_subject:
            return {"exists": False, "subject_id": subject_key}
        return self._assessment_record_to_dict(self.latest_assessment_by_subject[subject_key])

    @gl.public.view
    def get_judgment(self, subject_id: str, revision: int) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if revision <= 0:
            return {"exists": False, "subject_id": subject_key, "revision": revision}

        for index in range(len(self.judgment_log)):
            record = self.judgment_log[index]
            if record.subject_id == subject_key and int(record.revision) == revision:
                return self._judgment_to_dict(record)

        return {"exists": False, "subject_id": subject_key, "revision": revision}

    @gl.public.view
    def get_judgment_object(self, subject_id: str, revision: int) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if revision <= 0:
            return {"exists": False, "subject_id": subject_key, "revision": revision}

        for index in range(len(self.judgment_log)):
            record = self.judgment_log[index]
            if record.subject_id == subject_key and int(record.revision) == revision:
                return self._judgment_object_to_dict(record)

        return {"exists": False, "subject_id": subject_key, "revision": revision}

    @gl.public.view
    def get_assessment_artifact(self, subject_id: str, revision: int) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if revision <= 0:
            return {"exists": False, "subject_id": subject_key, "revision": revision}

        for index in range(len(self.assessment_log)):
            record = self.assessment_log[index]
            if record.subject_id == subject_key and int(record.revision) == revision:
                return self._assessment_record_to_dict(record)
        return {"exists": False, "subject_id": subject_key, "revision": revision}

    @gl.public.view
    def get_supported_domains(self) -> list[str]:
        return list(SUPPORTED_PROTOCOL_DOMAINS)

    @gl.public.view
    def get_domain_spec(self, domain_id: str) -> dict[str, typing.Any]:
        normalized = self._normalize_domain_id(domain_id)
        if normalized not in SUPPORTED_PROTOCOL_DOMAINS:
            return {"exists": False, "domain_id": normalized}
        return self._domain_spec_for_id(normalized)

    @gl.public.view
    def can_execute(self, subject_id: str, action_type: str) -> dict[str, typing.Any]:
        return self._can_execute_internal(subject_id, action_type, None)

    @gl.public.view
    def can_execute_with_source_block(
        self, subject_id: str, action_type: str, current_source_block: int
    ) -> dict[str, typing.Any]:
        return self._can_execute_internal(subject_id, action_type, current_source_block)

    def _can_execute_internal(
        self,
        subject_id: str,
        action_type: str,
        current_source_block: int | None,
    ) -> dict[str, typing.Any]:
        handshake = self._build_handshake_decision(
            subject_id,
            action_type,
            current_source_block,
        )
        return {
            "allowed": bool(handshake["allowed"]),
            "reason": str(handshake["reason"]),
            "subject_id": str(handshake["subject_id"]),
            "action_type": str(handshake["action_type"]),
            "freshness_checked": bool(handshake["freshness_checked"]),
            "state": str(handshake["state"]),
            "recommended_action": str(handshake["recommended_action"]),
            "recommended_action_is_hint": bool(handshake["recommended_action_is_hint"]),
            "state_is_primary": bool(handshake["state_is_primary"]),
            "enforcement_mode": str(handshake["enforcement_mode"]),
            "reason_code": str(handshake["reason_code"]),
            "current_source_block": handshake.get("current_source_block"),
            "valid_until_source_block": handshake.get("valid_until_source_block"),
        }

    @gl.public.view
    def get_handshake_state(self, subject_id: str, action_type: str) -> dict[str, typing.Any]:
        return self._build_handshake_decision(subject_id, action_type, None)

    @gl.public.view
    def get_handshake_state_with_source_block(
        self, subject_id: str, action_type: str, current_source_block: int
    ) -> dict[str, typing.Any]:
        return self._build_handshake_decision(subject_id, action_type, current_source_block)

    @gl.public.view
    def get_agent_decision(self, subject_id: str, action_type: str) -> dict[str, typing.Any]:
        return self._get_agent_decision_internal(subject_id, action_type, None)

    @gl.public.view
    def get_agent_decision_with_source_block(
        self, subject_id: str, action_type: str, current_source_block: int
    ) -> dict[str, typing.Any]:
        return self._get_agent_decision_internal(subject_id, action_type, current_source_block)

    def _get_agent_decision_internal(
        self,
        subject_id: str,
        action_type: str,
        current_source_block: int | None,
    ) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        action_name = self._normalize_action_type(action_type)
        gate = self._can_execute_internal(subject_key, action_name, current_source_block)

        if subject_key not in self.latest_judgment_by_subject:
            return {
                "exists": False,
                "subject_id": subject_key,
                "action_type": action_name,
                "allowed": bool(gate["allowed"]),
                "reason": str(gate["reason"]),
                "freshness_checked": bool(gate["freshness_checked"]),
                "handshake": self._build_handshake_decision(
                    subject_key,
                    action_name,
                    current_source_block,
                ),
            }

        latest = self.latest_judgment_by_subject[subject_key]
        return {
            "exists": True,
            "subject_id": subject_key,
            "action_type": action_name,
            "allowed": bool(gate["allowed"]),
            "reason": str(gate["reason"]),
            "freshness_checked": bool(gate["freshness_checked"]),
            "handshake": self._build_handshake_decision(
                subject_key,
                action_name,
                current_source_block,
            ),
            "judgment": self._judgment_to_dict(latest),
        }

    @gl.public.view
    def get_action_count(self) -> int:
        return len(self.action_log)

    @gl.public.view
    def get_action(self, index: int) -> dict[str, typing.Any]:
        if index < 0 or index >= len(self.action_log):
            return {"exists": False, "index": index}

        action = self.action_log[index]
        return {
            "exists": True,
            "actor": action.actor,
            "subject_id": action.subject_id,
            "action_type": action.action_type,
            "allowed": action.allowed,
            "reason": action.reason,
            "source_network": action.source_network,
            "source_chain_id": int(action.source_chain_id),
            "evidence_anchor": action.evidence_anchor,
            "judgment_revision": int(action.judgment_revision),
        }

    @gl.public.write
    def submit_evidence(
        self,
        subject_id: str,
        evidence_uri: str = "",
        evidence_text: str = "",
    ) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if len(subject_key) == 0:
            raise gl.vm.UserError("subject_id is required")

        record = self._store_evidence_from_inputs(
            subject_key,
            evidence_uri,
            evidence_text,
            "manual",
            "",
            0,
            "",
        )
        return self._evidence_to_dict(record)

    @gl.public.write
    def submit_case(
        self,
        subject_id: str,
        case_uri: str = "",
        case_text: str = "",
    ) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if len(subject_key) == 0:
            raise gl.vm.UserError("subject_id is required")

        self._store_evidence_from_inputs(
            subject_key,
            case_uri,
            case_text,
            "manual",
            "",
            0,
            "",
        )
        return self.evaluate_latest_evidence(subject_key)

    @gl.public.write
    def process_bridge_message(
        self, message_id: str, source_chain_id: int, source_sender: str, message: bytes
    ) -> dict[str, typing.Any]:
        if gl.message.sender_address != self.bridge_receiver:
            raise gl.vm.UserError("Only BridgeReceiver")

        message_text = gl.evm.decode(str, message)
        case_payload = self._normalize_case_payload(message_text, "")
        record = self._store_evidence_record(
            case_payload,
            "bridge",
            message_id,
            source_chain_id,
            source_sender,
        )
        return self._evidence_to_dict(record)

    @gl.public.write
    def evaluate_latest_evidence(self, subject_id: str) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        if len(subject_key) == 0:
            raise gl.vm.UserError("subject_id is required")
        if subject_key not in self.latest_evidence_by_subject:
            raise gl.vm.UserError("no evidence for subject_id")

        record = self._evaluate_evidence_record(self.latest_evidence_by_subject[subject_key])
        return self._judgment_to_dict(record)

    @gl.public.write
    def attempt_guarded_action(self, subject_id: str, action_type: str) -> bool:
        decision = self.can_execute(subject_id, action_type)
        return self._record_action_attempt(subject_id, action_type, decision)

    @gl.public.write
    def attempt_guarded_action_with_source_block(
        self, subject_id: str, action_type: str, current_source_block: int
    ) -> bool:
        decision = self.can_execute_with_source_block(subject_id, action_type, current_source_block)
        return self._record_action_attempt(subject_id, action_type, decision)

    def _record_action_attempt(
        self, subject_id: str, action_type: str, decision: dict[str, typing.Any]
    ) -> bool:
        subject_key = self._normalize_subject_id(subject_id)
        action_name = self._normalize_action_type(action_type)

        if subject_key in self.latest_judgment_by_subject:
            latest = self.latest_judgment_by_subject[subject_key]
            source_network = latest.source_network
            source_chain_id = latest.source_chain_id
            evidence_anchor = latest.evidence_anchor
            judgment_revision = latest.revision
        else:
            source_network = "unknown"
            source_chain_id = u32(0)
            evidence_anchor = "no-judgment"
            judgment_revision = u32(0)

        self.action_log.append(
            ActionRecord(
                actor=str(gl.message.sender_address),
                subject_id=subject_key,
                action_type=action_name,
                allowed=bool(decision["allowed"]),
                reason=str(decision["reason"]),
                source_network=source_network,
                source_chain_id=source_chain_id,
                evidence_anchor=evidence_anchor,
                judgment_revision=judgment_revision,
            )
        )

        return bool(decision["allowed"])

    def _store_evidence_from_inputs(
        self,
        expected_subject_id: str,
        evidence_uri: str,
        evidence_text: str,
        ingress_kind: str,
        bridge_message_id: str,
        bridge_source_chain_id: int,
        bridge_source_sender: str,
    ) -> EvidenceRecord:
        evidence_uri = evidence_uri.strip()
        evidence_text = evidence_text.strip()

        if len(evidence_uri) == 0 and len(evidence_text) == 0:
            raise gl.vm.UserError("evidence_uri or evidence_text is required")

        if len(evidence_uri) > 0:
            case_payload = self._load_case_from_uri(expected_subject_id, evidence_uri)
        else:
            case_payload = self._load_case_from_text(expected_subject_id, evidence_text)

        return self._store_evidence_record(
            case_payload,
            ingress_kind,
            bridge_message_id,
            bridge_source_chain_id,
            bridge_source_sender,
        )

    def _store_evidence_record(
        self,
        case_payload: dict[str, typing.Any],
        ingress_kind: str,
        bridge_message_id: str,
        bridge_source_chain_id: int,
        bridge_source_sender: str,
    ) -> EvidenceRecord:
        subject_key = str(case_payload["subject_id"])
        current_sequence = self.evidence_count_by_subject.get(subject_key, u32(0))
        next_sequence = current_sequence + u32(1)
        case_source = self._serialize_case_payload(case_payload)
        case_hash = self._stable_hash(case_source)
        evidence_anchor = self._build_evidence_anchor(case_payload)

        record = EvidenceRecord(
            subject_id=subject_key,
            domain_id=str(case_payload["domain_id"]),
            case_id=str(case_payload["case_id"]),
            claim_type=str(case_payload["claim_type"]),
            subject_type=str(case_payload["subject_type"]),
            target_type=str(case_payload["target_type"]),
            target_contract=str(case_payload["target_contract"]),
            target_protocol=str(case_payload["target_protocol"]),
            target_context_json=str(case_payload["target_context_json"]),
            domain_spec_hash=str(case_payload["domain_spec_hash"]),
            evidence_policy_hash=str(case_payload["evidence_policy_hash"]),
            sequence=next_sequence,
            case_schema_version=str(case_payload["case_schema_version"]),
            extractor_version=str(case_payload["extractor_version"]),
            manifest_schema_version=str(case_payload["manifest_schema_version"]),
            manifest_root=str(case_payload["manifest_root"]),
            evidence_manifest_hash=str(case_payload["evidence_manifest_hash"]),
            manifest_item_count=u32(int(case_payload["manifest_item_count"])),
            case_hash=case_hash,
            evidence_anchor=evidence_anchor,
            source_network=str(case_payload["source_network"]),
            source_chain_id=u32(int(case_payload["source_chain_id"])),
            source_label=str(case_payload["source_label"]),
            start_block=u32(int(case_payload["start_block"])),
            end_block=u32(int(case_payload["end_block"])),
            start_block_hash=str(case_payload["start_block_hash"]),
            end_block_hash=str(case_payload["end_block_hash"]),
            tx_count=u32(int(case_payload["features"]["tx_count"])),
            failed_tx_count=u32(int(case_payload["features"]["failed_tx_count"])),
            unique_counterparties=u32(int(case_payload["features"]["unique_counterparties"])),
            unbounded_approval_count=u32(int(case_payload["features"]["unbounded_approval_count"])),
            high_risk_flags=u32(int(case_payload["features"]["high_risk_flags"])),
            notes=str(case_payload["notes"]),
            ingress_kind=self._normalize_ingress_kind(ingress_kind),
            bridge_message_id=self._normalize_bridge_message_id(bridge_message_id),
            bridge_source_chain_id=u32(self._normalize_chain_id(bridge_source_chain_id)),
            bridge_source_sender=self._normalize_bridge_source_sender(bridge_source_sender),
        )

        self.latest_evidence_by_subject[subject_key] = record
        self.evidence_count_by_subject[subject_key] = next_sequence
        self.evidence_log.append(record)
        return record

    def _evaluate_evidence_record(self, evidence: EvidenceRecord) -> JudgmentRecord:
        if self.evaluation_mode == "llm":
            guardrail_result = self._maybe_guardrail_judgment(evidence)
            if guardrail_result is not None:
                outcome, confidence_ppm, risk_flags_json, summary, reason_code = guardrail_result
            else:
                prompt_material = self._serialize_prompt_material(evidence)
                raw_result = self._evaluate_prompt(evidence, prompt_material)
                outcome, confidence_ppm, risk_flags_json, summary, reason_code = self._parse_judgment_result(raw_result)
        else:
            outcome, confidence_ppm, risk_flags_json, summary, reason_code = self._deterministic_judgment(evidence)

        self._assert_allowed_domain_outcome(evidence.domain_id, outcome)

        current_revision = self.revision_count_by_subject.get(evidence.subject_id, u32(0))
        next_revision = current_revision + u32(1)
        freshness_window_blocks = self.default_freshness_window_blocks
        valid_until_source_block = u32(
            int(evidence.end_block) + int(self.default_freshness_window_blocks)
        )
        prior_assessment_hash = ""
        if evidence.subject_id in self.latest_assessment_by_subject:
            prior_assessment_hash = self.latest_assessment_by_subject[evidence.subject_id].assessment_hash

        outcome_payload = {
            "tx_count": int(evidence.tx_count),
            "failed_tx_count": int(evidence.failed_tx_count),
            "unique_counterparties": int(evidence.unique_counterparties),
            "unbounded_approval_count": int(evidence.unbounded_approval_count),
            "flagged_interaction_count": int(evidence.high_risk_flags),
            "reason_code": reason_code,
            "risk_flags": json.loads(risk_flags_json),
            "reason_summary": summary,
        }
        outcome_payload_json = json.dumps(outcome_payload, sort_keys=True)
        outcome_payload_hash = self._stable_hash(outcome_payload_json)
        assessment_material = {
            "schema_version": PROTOCOL_ASSESSMENT_SCHEMA_VERSION,
            "case_id": evidence.case_id,
            "subject_id": evidence.subject_id,
            "domain_id": evidence.domain_id,
            "domain_spec_hash": evidence.domain_spec_hash,
            "parent_revision_hash": prior_assessment_hash if len(prior_assessment_hash) > 0 else None,
            "evidence_root": evidence.manifest_root,
            "evaluation_spec_hash": self._evaluation_spec_hash_for_domain(evidence.domain_id),
            "model_policy_hash": self._model_policy_hash_for_domain(evidence.domain_id),
            "outcome_enum": outcome,
            "confidence_ppm": int(confidence_ppm),
            "outcome_payload_hash": outcome_payload_hash,
            "evaluated_at": PLACEHOLDER_PROTOCOL_TIMESTAMP,
            "revision": int(next_revision),
        }
        assessment_hash = self._stable_hash(json.dumps(assessment_material, sort_keys=True))
        assessment_record = AssessmentArtifactRecord(
            subject_id=evidence.subject_id,
            domain_id=evidence.domain_id,
            case_id=evidence.case_id,
            assessment_hash=assessment_hash,
            revision=next_revision,
            evidence_sequence=evidence.sequence,
            domain_spec_hash=evidence.domain_spec_hash,
            evaluation_spec_hash=self._evaluation_spec_hash_for_domain(evidence.domain_id),
            model_policy_hash=self._model_policy_hash_for_domain(evidence.domain_id),
            parent_revision_hash=prior_assessment_hash,
            evidence_root=evidence.manifest_root,
            outcome_enum=outcome,
            confidence_ppm=u32(confidence_ppm),
            outcome_payload_json=outcome_payload_json,
            outcome_payload_hash=outcome_payload_hash,
            evaluated_at=PLACEHOLDER_PROTOCOL_TIMESTAMP,
        )

        record = JudgmentRecord(
            subject_id=evidence.subject_id,
            domain_id=evidence.domain_id,
            case_id=evidence.case_id,
            claim_type=evidence.claim_type,
            domain_spec_hash=evidence.domain_spec_hash,
            evaluation_spec_hash=self._evaluation_spec_hash_for_domain(evidence.domain_id),
            model_policy_hash=self._model_policy_hash_for_domain(evidence.domain_id),
            revision=next_revision,
            evidence_sequence=evidence.sequence,
            case_schema_version=evidence.case_schema_version,
            extractor_version=evidence.extractor_version,
            manifest_schema_version=evidence.manifest_schema_version,
            manifest_root=evidence.manifest_root,
            manifest_item_count=evidence.manifest_item_count,
            freshness_window_blocks=freshness_window_blocks,
            valid_until_source_block=valid_until_source_block,
            outcome=outcome,
            confidence_ppm=u32(confidence_ppm),
            reason_code=reason_code,
            assessment_hash=assessment_hash,
            case_hash=evidence.case_hash,
            risk_flags_json=risk_flags_json,
            summary=summary,
            source_network=evidence.source_network,
            source_chain_id=evidence.source_chain_id,
            source_label=evidence.source_label,
            start_block=evidence.start_block,
            end_block=evidence.end_block,
            start_block_hash=evidence.start_block_hash,
            end_block_hash=evidence.end_block_hash,
            evidence_anchor=evidence.evidence_anchor,
        )

        self.latest_assessment_by_subject[evidence.subject_id] = assessment_record
        self.assessment_log.append(assessment_record)
        self.latest_judgment_by_subject[evidence.subject_id] = record
        self.revision_count_by_subject[evidence.subject_id] = next_revision
        self.judgment_log.append(record)
        return record

    def _deterministic_judgment(self, evidence: EvidenceRecord) -> tuple[str, int, str, str, str]:
        tx_count = int(evidence.tx_count)
        failed_tx_count = int(evidence.failed_tx_count)
        unique_counterparties = int(evidence.unique_counterparties)
        unbounded_approval_count = int(evidence.unbounded_approval_count)
        high_risk_flags = int(evidence.high_risk_flags)

        if tx_count <= 0:
            return (
                "INSUFFICIENT_DATA",
                150000,
                self._serialize_risk_flags(["SPARSE_ACTIVITY"]),
                "No outgoing Base activity was found in the submitted evidence window.",
                "SPARSE_ACTIVITY",
            )

        if high_risk_flags > 0:
            return (
                "UNSAFE",
                970000,
                self._serialize_risk_flags(["FLAGGED_INTERACTION"]),
                f"High-risk Base interactions detected: {high_risk_flags} flagged transaction(s).",
                "FLAGGED_INTERACTION",
            )

        if unbounded_approval_count > 0:
            return (
                "UNSAFE",
                940000,
                self._serialize_risk_flags(["UNBOUNDED_APPROVAL"]),
                f"Unbounded ERC-20 approvals detected: {unbounded_approval_count} approval transaction(s).",
                "UNBOUNDED_APPROVAL",
            )

        if failed_tx_count >= 2:
            return (
                "CAUTION",
                820000,
                self._serialize_risk_flags(["FAILED_TX"]),
                f"Repeated failed transactions detected: {failed_tx_count} failure(s) in the evidence window.",
                "FAILED_TX",
            )

        if failed_tx_count == 1:
            return (
                "CAUTION",
                740000,
                self._serialize_risk_flags(["FAILED_TX"]),
                "One failed transaction was detected, so the subject is not yet low-risk.",
                "FAILED_TX",
            )

        if unique_counterparties >= 8:
            return (
                "CAUTION",
                700000,
                self._serialize_risk_flags(["BROAD_COUNTERPARTY_SPREAD"]),
                f"Broad counterparty spread detected across {unique_counterparties} counterparties.",
                "BROAD_COUNTERPARTY_SPREAD",
            )

        return (
            "SAFE",
            900000,
            self._serialize_risk_flags([]),
            (
                f"Low-risk activity: {tx_count} successful txs, no failures, "
                "unbounded approvals, or high-risk flags."
            ),
            "SAFE_BASELINE",
        )

    def _maybe_guardrail_judgment(
        self, evidence: EvidenceRecord
    ) -> tuple[str, int, str, str, str] | None:
        tx_count = int(evidence.tx_count)
        failed_tx_count = int(evidence.failed_tx_count)
        unique_counterparties = int(evidence.unique_counterparties)
        unbounded_approval_count = int(evidence.unbounded_approval_count)
        high_risk_flags = int(evidence.high_risk_flags)

        if tx_count <= 0:
            return self._deterministic_judgment(evidence)
        if high_risk_flags > 0:
            return self._deterministic_judgment(evidence)
        if unbounded_approval_count > 0:
            return self._deterministic_judgment(evidence)
        if (
            tx_count >= 10
            and failed_tx_count == 0
            and unique_counterparties < 8
            and unbounded_approval_count == 0
            and high_risk_flags == 0
        ):
            return self._deterministic_judgment(evidence)
        return None

    def _evaluate_prompt(self, evidence: EvidenceRecord, prompt_material: str) -> str:
        def evaluate_case() -> str:
            prompt = self._build_prompt(evidence, prompt_material)
            result = gl.nondet.exec_prompt(prompt)
            return self._prompt_result_to_text(result)

        return gl.eq_principle.prompt_comparative(
            evaluate_case,
            (
                "The JSON outcome, confidence_ppm, risk_flags, and optional summary "
                "must represent the same judgment."
            ),
        )

    def _build_prompt(self, evidence: EvidenceRecord, prompt_material: str) -> str:
        if self.prompt_profile == "isolated_minimal":
            return self._build_isolated_minimal_prompt(evidence)
        if self.prompt_profile == "domain_compact":
            return self._build_domain_compact_prompt(evidence)
        return self._build_standard_prompt(evidence, prompt_material)

    def _build_standard_prompt(self, evidence: EvidenceRecord, prompt_material: str) -> str:
        return f"""You are evaluating whether a subject should receive a bounded protocol capability from Base activity evidence.

Prompt profile: standard

Domain ID: {evidence.domain_id}
Case ID: {evidence.case_id}
Claim type: {evidence.claim_type}
Case schema version: {self._normalize_prompt_value(prompt_material, "case_schema_version")}
Extractor version: {self._normalize_prompt_value(prompt_material, "extractor_version")}

Read the normalized Base evidence and return a bounded judgment.

Rules:
- Allowed outcomes: SAFE, CAUTION, UNSAFE, INSUFFICIENT_DATA
- Allowed risk_flags: {", ".join(ALLOWED_RISK_FLAGS)}
- Use INSUFFICIENT_DATA if the evidence is malformed, missing, or too weak
- Do not invent evidence or risk flags that are not supported by the normalized features
- Treat the evidence commitment metadata as authoritative provenance for the case
- Use risk_flags only from the allowed list above
- confidence_ppm must be an integer from 0 to 1000000
- summary is optional and must be at most 160 characters if present

Policy guidance:
- if unbounded_approval_count > 0, prefer UNSAFE with UNBOUNDED_APPROVAL
- if high_risk_flags > 0, prefer UNSAFE with FLAGGED_INTERACTION
- if tx_count == 0, prefer INSUFFICIENT_DATA with SPARSE_ACTIVITY
- if failed_tx_count > 0 and no severe flags exist, prefer CAUTION with FAILED_TX
- if unique_counterparties is unusually high without severe flags, prefer CAUTION with BROAD_COUNTERPARTY_SPREAD

Normalized Base evidence:
{prompt_material[:4000]}

Return valid JSON only in this exact shape:
{{
  "outcome": "SAFE | CAUTION | UNSAFE | INSUFFICIENT_DATA",
  "confidence_ppm": 0,
  "risk_flags": ["ALLOWED_FLAG"],
  "summary": "optional short explanation"
}}"""

    def _build_domain_compact_prompt(self, evidence: EvidenceRecord) -> str:
        if evidence.domain_id == PROTOCOL_PERMISSION_DOMAIN_ID:
            return self._build_domain_compact_permission_prompt(evidence)
        return self._build_domain_compact_counterparty_prompt(evidence)

    def _build_domain_compact_counterparty_prompt(self, evidence: EvidenceRecord) -> str:
        return f"""Classify one counterparty-trust case and return strict JSON only.

Prompt profile: domain_compact
Domain ID: {evidence.domain_id}
Case ID: {evidence.case_id}
Claim type: {evidence.claim_type}

Normalized fields:
{{
  "tx_count": {int(evidence.tx_count)},
  "failed_tx_count": {int(evidence.failed_tx_count)},
  "unique_counterparties": {int(evidence.unique_counterparties)},
  "unbounded_approval_count": {int(evidence.unbounded_approval_count)},
  "flagged_interaction_count": {int(evidence.high_risk_flags)}
}}

Allowed outcomes: SAFE, CAUTION, UNSAFE, INSUFFICIENT_DATA
Allowed risk_flags: {", ".join(ALLOWED_RISK_FLAGS)}

Compact rules:
- tx_count == 0 -> INSUFFICIENT_DATA with SPARSE_ACTIVITY
- flagged_interaction_count > 0 -> UNSAFE with FLAGGED_INTERACTION
- unbounded_approval_count > 0 -> UNSAFE with UNBOUNDED_APPROVAL
- failed_tx_count > 0 -> CAUTION with FAILED_TX
- unique_counterparties >= 8 -> CAUTION with BROAD_COUNTERPARTY_SPREAD
- otherwise SAFE

Return valid JSON only in this exact shape:
{{
  "outcome": "SAFE | CAUTION | UNSAFE | INSUFFICIENT_DATA",
  "confidence_ppm": 0,
  "risk_flags": ["ALLOWED_FLAG"]
}}"""

    def _build_domain_compact_permission_prompt(self, evidence: EvidenceRecord) -> str:
        return f"""Classify one ERC-20 permission-safety case and return strict JSON only.

Prompt profile: domain_compact
Domain ID: {evidence.domain_id}
Case ID: {evidence.case_id}
Claim type: {evidence.claim_type}

Normalized fields:
{{
  "tx_count": {int(evidence.tx_count)},
  "failed_tx_count": {int(evidence.failed_tx_count)},
  "unbounded_approval_count": {int(evidence.unbounded_approval_count)},
  "flagged_interaction_count": {int(evidence.high_risk_flags)}
}}

Allowed outcomes: SAFE, CAUTION, UNSAFE, INSUFFICIENT_DATA
Allowed risk_flags: {", ".join(ALLOWED_RISK_FLAGS)}

Compact rules:
- tx_count == 0 -> INSUFFICIENT_DATA with SPARSE_ACTIVITY
- unbounded_approval_count > 0 -> UNSAFE with UNBOUNDED_APPROVAL
- flagged_interaction_count > 0 -> UNSAFE with FLAGGED_INTERACTION
- failed_tx_count > 0 -> CAUTION with FAILED_TX
- otherwise SAFE

Return valid JSON only in this exact shape:
{{
  "outcome": "SAFE | CAUTION | UNSAFE | INSUFFICIENT_DATA",
  "confidence_ppm": 0,
  "risk_flags": ["ALLOWED_FLAG"]
}}"""

    def _build_isolated_minimal_prompt(self, evidence: EvidenceRecord) -> str:
        return f"""Classify one normalized Base case and return strict JSON.

Prompt profile: isolated_minimal
Domain ID: {evidence.domain_id}
Case ID: {evidence.case_id}
Claim type: {evidence.claim_type}

Use only these normalized fields:
{{
  "tx_count": {int(evidence.tx_count)},
  "failed_tx_count": {int(evidence.failed_tx_count)},
  "unique_counterparties": {int(evidence.unique_counterparties)},
  "unbounded_approval_count": {int(evidence.unbounded_approval_count)},
  "flagged_interaction_count": {int(evidence.high_risk_flags)}
}}

Allowed outcomes: SAFE, CAUTION, UNSAFE, INSUFFICIENT_DATA
Allowed risk_flags: {", ".join(ALLOWED_RISK_FLAGS)}

Hard rules:
- if tx_count == 0, return INSUFFICIENT_DATA and include SPARSE_ACTIVITY
- if unbounded_approval_count > 0, return UNSAFE and include UNBOUNDED_APPROVAL
- if flagged_interaction_count > 0, return UNSAFE and include FLAGGED_INTERACTION
- if failed_tx_count > 0 and no stronger rule applies, return CAUTION and include FAILED_TX
- otherwise return SAFE

Return valid JSON only in this exact shape:
{{
  "outcome": "SAFE | CAUTION | UNSAFE | INSUFFICIENT_DATA",
  "confidence_ppm": 0,
  "risk_flags": ["ALLOWED_FLAG"]
}}"""

    def _parse_judgment_result(self, raw: str) -> tuple[str, int, str, str, str]:
        cleaned = self._strip_code_fences(raw)

        try:
            parsed = json.loads(cleaned)
        except Exception:
            extracted = self._extract_json_object(cleaned)
            if extracted is None:
                return (
                    "INSUFFICIENT_DATA",
                    0,
                    self._serialize_risk_flags(["MALFORMED_MODEL_OUTPUT"]),
                    "Model output was not valid JSON.",
                    "MALFORMED_MODEL_OUTPUT",
                )
            try:
                parsed = json.loads(extracted)
            except Exception:
                return (
                    "INSUFFICIENT_DATA",
                    0,
                    self._serialize_risk_flags(["MALFORMED_MODEL_OUTPUT"]),
                    "Model output was not valid JSON.",
                    "MALFORMED_MODEL_OUTPUT",
                )

        if not isinstance(parsed, dict):
            return (
                "INSUFFICIENT_DATA",
                0,
                self._serialize_risk_flags(["MALFORMED_MODEL_OUTPUT"]),
                "Model output was not a JSON object.",
                "MALFORMED_MODEL_OUTPUT",
            )

        outcome = self._normalize_outcome(str(parsed.get("outcome", "")))
        confidence_ppm = self._normalize_confidence_bucket(parsed.get("confidence_ppm", 0))
        risk_flags_json = self._normalize_risk_flags(parsed.get("risk_flags", []))
        summary = self._normalize_summary(parsed.get("summary"))
        reason_code = self._derive_reason_code(outcome, risk_flags_json)

        return outcome, confidence_ppm, risk_flags_json, summary, reason_code

    def _load_case_from_uri(
        self,
        expected_subject_id: str,
        case_uri: str,
    ) -> dict[str, typing.Any]:
        def fetch_case() -> str:
            response = gl.nondet.web.get(case_uri)
            return self._decode_web_body(response.body)

        case_material = gl.eq_principle.strict_eq(fetch_case)
        return self._normalize_case_payload(case_material, expected_subject_id)

    def _load_case_from_text(
        self,
        expected_subject_id: str,
        case_text: str,
    ) -> dict[str, typing.Any]:
        return self._normalize_case_payload(case_text, expected_subject_id)

    def _normalize_case_payload(
        self,
        raw_case: str,
        expected_subject_id: str,
    ) -> dict[str, typing.Any]:
        try:
            parsed = json.loads(raw_case)
        except Exception:
            raise gl.vm.UserError("case payload must be valid JSON")

        if not isinstance(parsed, dict):
            raise gl.vm.UserError("case payload must be a JSON object")

        schema_version = self._normalize_schema_version(parsed.get("schema_version", ""))
        is_case_object = schema_version in (
            PROTOCOL_CASE_SCHEMA_VERSION,
            COMPACT_PROTOCOL_CASE_SCHEMA_VERSION,
        )

        if is_case_object:
            subject_scope = parsed.get("subject_scope", {})
            target_scope = parsed.get("target_scope", {})
            observation_window = parsed.get("observation_window", {})
            features = parsed.get("feature_summary", {})
            evidence_manifest = parsed.get("evidence_manifest", {})
            source = {
                "network": observation_window.get("source_network", ""),
                "chain_id": observation_window.get("source_chain_id", 0),
                "source_label": parsed.get("source", {}).get("source_label", ""),
            }
            window = {
                "start_block": observation_window.get("observed_from_block", 0),
                "end_block": observation_window.get("observed_to_block", 0),
                "start_block_hash": observation_window.get("observed_from_block_hash", ""),
                "end_block_hash": observation_window.get("observed_to_block_hash", ""),
            }
            if (
                not isinstance(subject_scope, dict)
                or not isinstance(target_scope, dict)
                or not isinstance(observation_window, dict)
                or not isinstance(features, dict)
                or not isinstance(evidence_manifest, dict)
            ):
                raise gl.vm.UserError(
                    "case object requires subject_scope, target_scope, observation_window, feature_summary, and evidence_manifest objects"
                )
            payload_subject = self._normalize_subject_id(str(subject_scope.get("subject_id", "")))
        else:
            source = parsed.get("source", {})
            window = parsed.get("window", {})
            features = parsed.get("features", {})
            evidence_manifest = parsed.get("evidence_manifest", {})
            if (
                not isinstance(source, dict)
                or not isinstance(window, dict)
                or not isinstance(features, dict)
                or not isinstance(evidence_manifest, dict)
            ):
                raise gl.vm.UserError(
                    "case payload requires source, window, features, and evidence_manifest objects"
                )
            payload_subject = self._normalize_subject_id(str(parsed.get("subject_id", "")))

        if len(expected_subject_id) > 0:
            if len(payload_subject) == 0:
                payload_subject = expected_subject_id
            if payload_subject != expected_subject_id:
                raise gl.vm.UserError("payload subject_id must match method subject_id")
        elif len(payload_subject) == 0:
            raise gl.vm.UserError("payload subject_id is required")

        case_schema_version = schema_version
        extractor_version = self._normalize_schema_version(parsed.get("extractor_version", ""))
        manifest_schema_version = self._normalize_schema_version(
            evidence_manifest.get("schema_version", "")
        )
        manifest_root = self._normalize_manifest_root(evidence_manifest.get("merkle_root", ""))
        evidence_manifest_hash = self._normalize_commitment_hash(
            parsed.get("evidence_manifest_hash", "")
        )
        manifest_item_count = self._normalize_nonnegative_int(
            parsed.get("evidence_manifest_item_count", evidence_manifest.get("item_count", 0))
        )

        source_network = self._normalize_source_network(
            source.get("network") or source.get("chain") or ""
        )
        source_chain_id = self._normalize_chain_id(source.get("chain_id", 0))
        source_label = self._normalize_source_label(
            source.get("source_label") or source.get("rpc_label") or ""
        )
        start_block = self._normalize_block_number(window.get("start_block", 0))
        end_block = self._normalize_block_number(window.get("end_block", 0))
        start_block_hash = self._normalize_block_hash(window.get("start_block_hash", ""))
        end_block_hash = self._normalize_block_hash(window.get("end_block_hash", ""))
        notes = self._normalize_note(str(parsed.get("notes", "")))

        if len(source_network) == 0:
            raise gl.vm.UserError("source network is required")
        if source_chain_id == 0:
            raise gl.vm.UserError("source chain_id is required")
        if len(case_schema_version) == 0:
            raise gl.vm.UserError("case schema_version is required")
        if len(extractor_version) == 0:
            raise gl.vm.UserError("extractor_version is required")
        if len(manifest_schema_version) == 0:
            raise gl.vm.UserError("evidence_manifest schema_version is required")
        if len(manifest_root) == 0:
            raise gl.vm.UserError("evidence_manifest merkle_root is required")
        if is_case_object and len(evidence_manifest_hash) == 0:
            raise gl.vm.UserError("evidence_manifest_hash is required for case objects")
        if end_block < start_block:
            raise gl.vm.UserError("end_block must be >= start_block")

        normalized_features = {
            "tx_count": self._normalize_nonnegative_int(features.get("tx_count", 0)),
            "failed_tx_count": self._normalize_nonnegative_int(features.get("failed_tx_count", 0)),
            "unique_counterparties": self._normalize_nonnegative_int(features.get("unique_counterparties", 0)),
            "unbounded_approval_count": self._normalize_nonnegative_int(features.get("unbounded_approval_count", 0)),
            "high_risk_flags": self._normalize_nonnegative_int(
                features.get("high_risk_flags", features.get("flagged_interaction_count", 0))
            ),
        }
        if manifest_item_count != normalized_features["tx_count"]:
            raise gl.vm.UserError("manifest item_count must match tx_count")

        domain_id = self._normalize_domain_id(parsed.get("domain_id", self.domain_id))
        case_id = self._normalize_case_id(
            parsed.get(
                "case_id",
                self._default_case_id(domain_id, payload_subject, start_block, end_block),
            )
        )
        claim_type = self._normalize_claim_type(
            parsed.get("claim_type", "execution_integrity_assessment")
        )
        if is_case_object:
            subject_type = self._normalize_subject_type(parsed.get("subject_scope", {}).get("subject_type", "wallet"))
            target_type = self._normalize_target_type(parsed.get("target_scope", {}).get("target_type", "wallet_contract_pair"))
            target_contract = self._normalize_target_contract(parsed.get("target_scope", {}).get("target_contract", ""))
            target_protocol = self._normalize_target_protocol(parsed.get("target_scope", {}).get("target_protocol", ""))
            target_context_json = self._normalize_json_object_text(parsed.get("target_scope", {}).get("target_context", {}))
            source_reference = parsed.get("source_reference", {})
            if not isinstance(source_reference, dict):
                raise gl.vm.UserError("source_reference must be an object")
            domain_spec_hash = self._normalize_commitment_hash(source_reference.get("domain_spec_hash", ""))
            evidence_policy_hash = self._normalize_commitment_hash(source_reference.get("evidence_policy_hash", ""))
            self._validate_protocol_case_payload(
                domain_id=domain_id,
                claim_type=claim_type,
                subject_type=subject_type,
                source_network=source_network,
                target_type=target_type,
                target_contract=target_contract,
                target_protocol=target_protocol,
                target_context_json=target_context_json,
                domain_spec_hash=domain_spec_hash,
                evidence_policy_hash=evidence_policy_hash,
                features=normalized_features,
            )
        else:
            subject_type = "wallet"
            target_type = "wallet"
            target_contract = ""
            target_protocol = "base_activity"
            target_context_json = "{}"
            domain_spec_hash = ""
            evidence_policy_hash = ""

        return {
            "subject_id": payload_subject,
            "domain_id": domain_id,
            "case_id": case_id,
            "claim_type": claim_type,
            "subject_type": subject_type,
            "target_type": target_type,
            "target_contract": target_contract,
            "target_protocol": target_protocol,
            "target_context_json": target_context_json,
            "domain_spec_hash": domain_spec_hash,
            "evidence_policy_hash": evidence_policy_hash,
            "case_schema_version": case_schema_version,
            "extractor_version": extractor_version,
            "manifest_schema_version": manifest_schema_version,
            "manifest_root": manifest_root,
            "evidence_manifest_hash": (
                evidence_manifest_hash if len(evidence_manifest_hash) > 0 else self._stable_hash(json.dumps(evidence_manifest, sort_keys=True))
            ),
            "manifest_item_count": manifest_item_count,
            "source_network": source_network,
            "source_chain_id": source_chain_id,
            "source_label": source_label,
            "start_block": start_block,
            "end_block": end_block,
            "start_block_hash": start_block_hash,
            "end_block_hash": end_block_hash,
            "features": normalized_features,
            "notes": notes,
        }

    def _normalize_subject_id(self, subject_id: str) -> str:
        return " ".join(subject_id.strip().split())[:80]

    def _normalize_domain_id(self, domain_id: typing.Any) -> str:
        normalized = " ".join(str(domain_id).strip().split())
        if len(normalized) == 0:
            return self.domain_id
        return normalized[:96]

    def _normalize_case_id(self, case_id: typing.Any) -> str:
        normalized = " ".join(str(case_id).strip().split())
        return normalized[:180]

    def _default_case_id(
        self, domain_id: str, subject_id: str, start_block: int, end_block: int
    ) -> str:
        return f"{domain_id}:{subject_id}:{start_block}-{end_block}"

    def _normalize_claim_type(self, claim_type: typing.Any) -> str:
        normalized = " ".join(str(claim_type).strip().split())
        if len(normalized) == 0:
            return "execution_integrity_assessment"
        return normalized[:96]

    def _normalize_subject_type(self, subject_type: typing.Any) -> str:
        normalized = " ".join(str(subject_type).strip().split()).lower()
        if len(normalized) == 0:
            return "wallet"
        return normalized[:48]

    def _normalize_target_type(self, target_type: typing.Any) -> str:
        normalized = " ".join(str(target_type).strip().split()).lower()
        if len(normalized) == 0:
            return "wallet"
        return normalized[:48]

    def _normalize_target_contract(self, target_contract: typing.Any) -> str:
        normalized = str(target_contract).strip().lower()
        return normalized[:80]

    def _normalize_target_protocol(self, target_protocol: typing.Any) -> str:
        normalized = " ".join(str(target_protocol).strip().split()).lower()
        return normalized[:80]

    def _normalize_json_object_text(self, value: typing.Any) -> str:
        try:
            return json.dumps(value, sort_keys=True)
        except Exception:
            return "{}"

    def _normalize_commitment_hash(self, value: typing.Any) -> str:
        normalized = str(value).strip().lower()
        return normalized[:80]

    def _normalize_action_type(self, action_type: str) -> str:
        normalized = " ".join(action_type.strip().split())
        if len(normalized) == 0:
            return "UNSPECIFIED_ACTION"
        return normalized[:80]

    def _normalize_evaluation_mode(self, evaluation_mode: str) -> str:
        normalized = " ".join(evaluation_mode.strip().split()).lower()
        if normalized == "llm":
            return "llm"
        return "deterministic"

    def _normalize_prompt_profile(self, prompt_profile: str) -> str:
        normalized = " ".join(prompt_profile.strip().split()).lower()
        if normalized == "isolated_minimal":
            return "isolated_minimal"
        if normalized == "domain_compact":
            return "domain_compact"
        return "standard"

    def _normalize_outcome(self, outcome: str) -> str:
        normalized = outcome.strip().upper()
        if normalized in ("SAFE", "CAUTION", "UNSAFE", "INSUFFICIENT_DATA"):
            return normalized
        return "INSUFFICIENT_DATA"

    def _normalize_confidence(self, value: typing.Any) -> int:
        try:
            confidence = int(value)
        except Exception:
            return 0

        if confidence < 0:
            return 0
        if confidence > 1_000_000:
            return 1_000_000
        return confidence

    def _normalize_confidence_bucket(self, value: typing.Any) -> int:
        confidence = self._normalize_confidence(value)
        if confidence <= 250000:
            return 150000
        if confidence <= 775000:
            return 650000
        return 900000

    def _normalize_source_network(self, network: str) -> str:
        normalized = " ".join(str(network).strip().split()).lower()
        return normalized[:40]

    def _normalize_schema_version(self, version: typing.Any) -> str:
        normalized = " ".join(str(version).strip().split())
        return normalized[:64]

    def _normalize_manifest_root(self, manifest_root: typing.Any) -> str:
        normalized = str(manifest_root).strip().lower()
        if len(normalized) == 0:
            return ""
        return normalized[:80]

    def _normalize_source_label(self, label: str) -> str:
        normalized = " ".join(str(label).strip().split())
        if len(normalized) == 0:
            return "unspecified-source"
        return normalized[:80]

    def _normalize_chain_id(self, chain_id: typing.Any) -> int:
        try:
            value = int(chain_id)
        except Exception:
            return 0
        if value < 0:
            return 0
        return value

    def _normalize_block_number(self, block_number: typing.Any) -> int:
        try:
            value = int(block_number)
        except Exception:
            return 0
        if value < 0:
            return 0
        return value

    def _normalize_freshness_window_blocks(self, freshness_window_blocks: typing.Any) -> int:
        try:
            value = int(freshness_window_blocks)
        except Exception:
            return 0
        if value < 0:
            return 0
        if value > 1_000_000:
            return 1_000_000
        return value

    def _normalize_nonnegative_int(self, value: typing.Any) -> int:
        try:
            number = int(value)
        except Exception:
            return 0
        if number < 0:
            return 0
        return number

    def _domain_spec_for_id(self, domain_id: str) -> dict[str, typing.Any]:
        if domain_id == PROTOCOL_DOMAIN_ID:
            return {
                "exists": True,
                "schema_version": "rjp.domain_spec.v1",
                "domain_id": PROTOCOL_DOMAIN_ID,
                "subject_scope": {
                    "subject_type": "wallet",
                    "allowed_subject_networks": ["base-sepolia", "base-mainnet"],
                },
                "target_scope": {
                    "target_type": "wallet_contract_pair",
                    "target_network": "base-sepolia",
                    "target_contracts": ["0x4200000000000000000000000000000000000006"],
                    "target_protocols": ["erc20", "base-trade-flow"],
                    "target_context_keys": ["action_type", "spender", "asset_symbol"],
                },
                "window_policy": {
                    "mode": "rolling",
                    "default_window_blocks": 5000,
                    "max_window_blocks": 50000,
                    "freshness_window_blocks": 50000,
                },
                "judgment_outcomes": ["SAFE", "CAUTION", "UNSAFE", "INSUFFICIENT_DATA"],
                "evaluation_spec": {
                    "evaluation_spec_id": "counterparty_trade_eval_v1",
                    "claim_type": "counterparty_trade_readiness",
                    "required_features": [
                        "tx_count",
                        "failed_tx_count",
                        "unique_counterparties",
                        "unbounded_approval_count",
                        "flagged_interaction_count",
                    ],
                },
                "policy_hashes": {
                    "domain_spec_hash": "0x35f3f3b605d54f91ad87e327787208214eda4dc1e585b10b2dc0cff253de6dea",
                    "evidence_policy_hash": "0xd0be88441e4411f1029dca72a9b3082736b09656bedc9246e07ca7d6e7a0935a",
                    "evaluation_spec_hash": "0x6196f5f0e30698d8453e1f5cafa00e4ff1fa34b897e2a1cf4d2758980acd30a4",
                    "model_policy_hash": "0x4605471b6114d47a31b7c91bd7faffd32e14bbef97be2f7119b29a93d9fc48b4",
                    "equivalence_profile_hash": "0x1a1099fb17f9af869ce2528e44c4d45a911036cabe8fcc2424ad92e900eb4299",
                    "revision_policy_hash": "0x06c644bf671bc037962ce4f0824fe47aca7951c7051a917a5183feff28837f68",
                },
            }
        if domain_id == PROTOCOL_PERMISSION_DOMAIN_ID:
            return {
                "exists": True,
                "schema_version": "rjp.domain_spec.v1",
                "domain_id": PROTOCOL_PERMISSION_DOMAIN_ID,
                "subject_scope": {
                    "subject_type": "wallet",
                    "allowed_subject_networks": ["base-sepolia", "base-mainnet"],
                },
                "target_scope": {
                    "target_type": "wallet_contract_pair",
                    "target_network": "base-sepolia",
                    "target_contracts": ["0x4200000000000000000000000000000000000006"],
                    "target_protocols": ["erc20", "erc20-permission"],
                    "target_context_keys": ["action_type", "spender", "asset_symbol"],
                },
                "window_policy": {
                    "mode": "rolling",
                    "default_window_blocks": 5000,
                    "max_window_blocks": 50000,
                    "freshness_window_blocks": 50000,
                },
                "judgment_outcomes": ["SAFE", "CAUTION", "UNSAFE", "INSUFFICIENT_DATA"],
                "evaluation_spec": {
                    "evaluation_spec_id": "erc20_permission_safety_eval_v1",
                    "claim_type": "erc20_permission_safety",
                    "required_features": [
                        "tx_count",
                        "failed_tx_count",
                        "unique_counterparties",
                        "unbounded_approval_count",
                        "flagged_interaction_count",
                    ],
                },
                "policy_hashes": {
                    "domain_spec_hash": "0xca76e3a0393e72a94c2485f6290fc9c2f940b8abfd4ab9719aae3a0b81f20f99",
                    "evidence_policy_hash": "0x798fd545b9af478b90c837c14c7323b289f9cd8718c476b8d8ee6fd151d7081a",
                    "evaluation_spec_hash": "0xa7a091d2b6134a9c5e7ad6a1758ce0fcfc130cc03f2beaacb69c52f586590580",
                    "model_policy_hash": "0xf75148e39ed8c9975ccfdb82a53796f597073c03cf83aba19863c5e2e7d5d986",
                    "equivalence_profile_hash": "0x3b9fe2d80869378d4adee7f46ca41e93b8753d59e02475f4c5edc66ba12d22e9",
                    "revision_policy_hash": "0x90f897517be54c63c53dedae86381d7dff51d46fc37e6e0e2386dd71f807e393",
                },
            }
        raise gl.vm.UserError("unsupported domain_id")

    def _validate_protocol_case_payload(
        self,
        domain_id: str,
        claim_type: str,
        subject_type: str,
        source_network: str,
        target_type: str,
        target_contract: str,
        target_protocol: str,
        target_context_json: str,
        domain_spec_hash: str,
        evidence_policy_hash: str,
        features: dict[str, int],
    ):
        domain_spec = self._domain_spec_for_id(domain_id)
        if claim_type != str(domain_spec["evaluation_spec"]["claim_type"]):
            raise gl.vm.UserError("claim_type does not match domain")
        if subject_type != str(domain_spec["subject_scope"]["subject_type"]):
            raise gl.vm.UserError("subject_type does not match domain")
        if source_network not in typing.cast(list[str], domain_spec["subject_scope"]["allowed_subject_networks"]):
            raise gl.vm.UserError("source_network is not allowed by domain")
        if target_type != str(domain_spec["target_scope"]["target_type"]):
            raise gl.vm.UserError("target_type does not match domain")
        if target_contract not in typing.cast(list[str], domain_spec["target_scope"]["target_contracts"]):
            raise gl.vm.UserError("target_contract is not allowed by domain")
        if target_protocol not in typing.cast(list[str], domain_spec["target_scope"]["target_protocols"]):
            raise gl.vm.UserError("target_protocol is not allowed by domain")
        if domain_spec_hash != str(domain_spec["policy_hashes"]["domain_spec_hash"]):
            raise gl.vm.UserError("domain_spec_hash does not match domain")
        if evidence_policy_hash != str(domain_spec["policy_hashes"]["evidence_policy_hash"]):
            raise gl.vm.UserError("evidence_policy_hash does not match domain")
        try:
            target_context = json.loads(target_context_json)
        except Exception:
            raise gl.vm.UserError("target_context must be valid JSON")
        if not isinstance(target_context, dict):
            raise gl.vm.UserError("target_context must be a JSON object")
        for key in typing.cast(list[str], domain_spec["target_scope"]["target_context_keys"]):
            if key not in target_context:
                raise gl.vm.UserError("target_context is missing required domain keys")
        for feature_key in typing.cast(list[str], domain_spec["evaluation_spec"]["required_features"]):
            if feature_key == "flagged_interaction_count":
                if "high_risk_flags" not in features:
                    raise gl.vm.UserError("required feature flagged_interaction_count missing")
            elif feature_key not in features:
                raise gl.vm.UserError("required feature missing for domain")

    def _assert_allowed_domain_outcome(self, domain_id: str, outcome: str):
        if domain_id not in SUPPORTED_PROTOCOL_DOMAINS:
            if outcome in ("SAFE", "CAUTION", "UNSAFE", "INSUFFICIENT_DATA"):
                return
            raise gl.vm.UserError("outcome is not allowed by domain")
        domain_spec = self._domain_spec_for_id(domain_id)
        if outcome not in typing.cast(list[str], domain_spec["judgment_outcomes"]):
            raise gl.vm.UserError("outcome is not allowed by domain")

    def _normalize_block_hash(self, block_hash: typing.Any) -> str:
        normalized = str(block_hash).strip().lower()
        if len(normalized) == 0:
            return "0x0"
        return normalized[:80]

    def _normalize_note(self, note: str) -> str:
        normalized = " ".join(note.strip().split())
        return normalized[:240]

    def _normalize_risk_flags(self, risk_flags: typing.Any) -> str:
        normalized_flags: list[str] = []

        if not isinstance(risk_flags, list):
            return self._serialize_risk_flags([])

        for value in risk_flags:
            normalized = " ".join(str(value).strip().split()).upper()
            if normalized in ALLOWED_RISK_FLAGS and normalized not in normalized_flags:
                normalized_flags.append(normalized)

        return self._serialize_risk_flags(normalized_flags)

    def _serialize_risk_flags(self, risk_flags: list[str]) -> str:
        return json.dumps(risk_flags, sort_keys=True)

    def _normalize_summary(self, summary: typing.Any) -> str:
        normalized = " ".join(str(summary or "").strip().split())
        if len(normalized) == 0:
            return ""
        return normalized[:160]

    def _normalize_reason_code(self, reason_code: typing.Any) -> str:
        normalized = " ".join(str(reason_code).strip().split()).upper().replace("-", "_").replace(" ", "_")
        return normalized[:64]

    def _derive_reason_code(self, outcome: str, risk_flags_json: str) -> str:
        try:
            risk_flags = json.loads(risk_flags_json)
        except Exception:
            risk_flags = []
        if isinstance(risk_flags, list) and len(risk_flags) > 0:
            return self._normalize_reason_code(str(risk_flags[0]))
        if outcome == "SAFE":
            return "SAFE_BASELINE"
        if outcome == "CAUTION":
            return "CAUTION_REVIEW"
        if outcome == "UNSAFE":
            return "UNSAFE_DENY"
        return "INSUFFICIENT_DATA"

    def _normalize_ingress_kind(self, ingress_kind: str) -> str:
        normalized = " ".join(ingress_kind.strip().split()).lower()
        if len(normalized) == 0:
            return "manual"
        return normalized[:32]

    def _normalize_bridge_message_id(self, bridge_message_id: str) -> str:
        normalized = str(bridge_message_id).strip()
        return normalized[:100]

    def _normalize_bridge_source_sender(self, bridge_source_sender: str) -> str:
        normalized = str(bridge_source_sender).strip().lower()
        return normalized[:80]

    def _strip_code_fences(self, raw: str) -> str:
        cleaned = raw.strip()
        cleaned = cleaned.replace("```json", "")
        cleaned = cleaned.replace("```", "")
        return cleaned.strip()

    def _extract_json_object(self, raw: str) -> str | None:
        start_index = raw.find("{")
        end_index = raw.rfind("}")
        if start_index < 0 or end_index < 0 or end_index <= start_index:
            return None
        return raw[start_index : end_index + 1]

    def _serialize_case_payload(self, case_payload: dict[str, typing.Any]) -> str:
        return json.dumps(case_payload, sort_keys=True)

    def _find_evidence_record(self, subject_id: str, sequence: int) -> EvidenceRecord | None:
        for index in range(len(self.evidence_log)):
            record = self.evidence_log[index]
            if record.subject_id == subject_id and int(record.sequence) == sequence:
                return record
        return None

    def _evaluation_spec_hash_for_domain(self, domain_id: str) -> str:
        if domain_id not in SUPPORTED_PROTOCOL_DOMAINS:
            return ""
        return str(self._domain_spec_for_id(domain_id)["policy_hashes"]["evaluation_spec_hash"])

    def _model_policy_hash_for_domain(self, domain_id: str) -> str:
        if domain_id not in SUPPORTED_PROTOCOL_DOMAINS:
            return ""
        return str(self._domain_spec_for_id(domain_id)["policy_hashes"]["model_policy_hash"])

    def _serialize_prompt_material(self, evidence: EvidenceRecord) -> str:
        prompt_material = {
            "subject_id": evidence.subject_id,
            "domain_id": evidence.domain_id,
            "case_id": evidence.case_id,
            "claim_type": evidence.claim_type,
            "evidence_sequence": int(evidence.sequence),
            "case_schema_version": evidence.case_schema_version,
            "extractor_version": evidence.extractor_version,
            "subject_scope": {
                "subject_type": evidence.subject_type,
                "subject_id": evidence.subject_id,
            },
            "target_scope": {
                "target_type": evidence.target_type,
                "target_contract": evidence.target_contract,
                "target_protocol": evidence.target_protocol,
                "target_context": json.loads(evidence.target_context_json),
            },
            "source": {
                "network": evidence.source_network,
                "chain_id": int(evidence.source_chain_id),
                "source_label": evidence.source_label,
            },
            "window": {
                "start_block": int(evidence.start_block),
                "end_block": int(evidence.end_block),
                "start_block_hash": evidence.start_block_hash,
                "end_block_hash": evidence.end_block_hash,
            },
            "features": {
                "tx_count": int(evidence.tx_count),
                "failed_tx_count": int(evidence.failed_tx_count),
                "unique_counterparties": int(evidence.unique_counterparties),
                "unbounded_approval_count": int(evidence.unbounded_approval_count),
                "high_risk_flags": int(evidence.high_risk_flags),
            },
            "notes": evidence.notes,
            "provenance": {
                "manifest_schema_version": evidence.manifest_schema_version,
                "manifest_root": evidence.manifest_root,
                "manifest_item_count": int(evidence.manifest_item_count),
                "default_freshness_window_blocks": int(self.default_freshness_window_blocks),
                "ingress_kind": evidence.ingress_kind,
                "bridge_message_id": evidence.bridge_message_id,
                "bridge_source_chain_id": int(evidence.bridge_source_chain_id),
                "bridge_source_sender": evidence.bridge_source_sender,
                "case_hash": evidence.case_hash,
                "evidence_anchor": evidence.evidence_anchor,
                "domain_spec_hash": evidence.domain_spec_hash,
                "evidence_policy_hash": evidence.evidence_policy_hash,
            },
        }
        return json.dumps(prompt_material, sort_keys=True)

    def _normalize_prompt_value(self, prompt_material: str, key: str) -> str:
        try:
            parsed = json.loads(prompt_material)
        except Exception:
            return "unknown"
        return str(parsed.get(key, "unknown"))

    def _stable_hash(self, text: str) -> str:
        digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
        return f"0x{digest}"

    def _decode_web_body(self, body: bytes | None) -> str:
        if body is None:
            return ""
        return body.decode("utf-8", errors="replace")

    def _prompt_result_to_text(self, result: typing.Any) -> str:
        if isinstance(result, dict):
            return json.dumps(result, sort_keys=True)
        return str(result).strip()

    def _build_evidence_anchor(self, case_payload: dict[str, typing.Any]) -> str:
        return (
            f"{case_payload['source_network']}:{case_payload['source_chain_id']}:"
            f"{case_payload['start_block']}-{case_payload['end_block']}:"
            f"{case_payload['manifest_root'][:18]}"
        )

    def _evidence_to_dict(self, record: EvidenceRecord) -> dict[str, typing.Any]:
        return {
            "exists": True,
            "subject_id": record.subject_id,
            "domain_id": record.domain_id,
            "case_id": record.case_id,
            "claim_type": record.claim_type,
            "subject_type": record.subject_type,
            "target_type": record.target_type,
            "target_contract": record.target_contract,
            "target_protocol": record.target_protocol,
            "target_context": json.loads(record.target_context_json),
            "domain_spec_hash": record.domain_spec_hash,
            "evidence_policy_hash": record.evidence_policy_hash,
            "sequence": int(record.sequence),
            "case_schema_version": record.case_schema_version,
            "extractor_version": record.extractor_version,
            "manifest_schema_version": record.manifest_schema_version,
            "manifest_root": record.manifest_root,
            "evidence_manifest_hash": record.evidence_manifest_hash,
            "manifest_item_count": int(record.manifest_item_count),
            "case_hash": record.case_hash,
            "evidence_anchor": record.evidence_anchor,
            "source_network": record.source_network,
            "source_chain_id": int(record.source_chain_id),
            "source_label": record.source_label,
            "start_block": int(record.start_block),
            "end_block": int(record.end_block),
            "start_block_hash": record.start_block_hash,
            "end_block_hash": record.end_block_hash,
            "features": {
                "tx_count": int(record.tx_count),
                "failed_tx_count": int(record.failed_tx_count),
                "unique_counterparties": int(record.unique_counterparties),
                "unbounded_approval_count": int(record.unbounded_approval_count),
                "high_risk_flags": int(record.high_risk_flags),
            },
            "notes": record.notes,
            "ingress_kind": record.ingress_kind,
            "bridge_message_id": record.bridge_message_id,
            "bridge_source_chain_id": int(record.bridge_source_chain_id),
            "bridge_source_sender": record.bridge_source_sender,
        }

    def _case_object_to_dict(self, record: EvidenceRecord) -> dict[str, typing.Any]:
        return {
            "exists": True,
            "schema_version": record.case_schema_version,
            "case_id": record.case_id,
            "domain_id": record.domain_id,
            "subject_scope": {
                "subject_type": record.subject_type,
                "subject_id": record.subject_id,
            },
            "target_scope": {
                "target_type": record.target_type,
                "target_contract": record.target_contract,
                "target_protocol": record.target_protocol,
                "target_context": json.loads(record.target_context_json),
            },
            "observation_window": {
                "source_network": record.source_network,
                "source_chain_id": int(record.source_chain_id),
                "observed_from_block": int(record.start_block),
                "observed_to_block": int(record.end_block),
                "observed_from_block_hash": record.start_block_hash,
                "observed_to_block_hash": record.end_block_hash,
                "selection_mode": "pinned_range",
            },
            "claim_type": record.claim_type,
            "extractor_version": record.extractor_version,
            "evidence_root": record.manifest_root,
            "evidence_manifest_hash": record.evidence_manifest_hash,
            "evidence_manifest_item_count": int(record.manifest_item_count),
            "evidence_manifest": {
                "schema_version": record.manifest_schema_version,
                "item_count": int(record.manifest_item_count),
                "merkle_root": record.manifest_root,
            },
            "evidence_anchor": record.evidence_anchor,
            "feature_summary": {
                "tx_count": int(record.tx_count),
                "failed_tx_count": int(record.failed_tx_count),
                "unique_counterparties": int(record.unique_counterparties),
                "unbounded_approval_count": int(record.unbounded_approval_count),
                "flagged_interaction_count": int(record.high_risk_flags),
                "high_risk_flags": int(record.high_risk_flags),
            },
            "created_at": "",
            "source_reference": {
                "domain_spec_hash": record.domain_spec_hash,
                "evidence_policy_hash": record.evidence_policy_hash,
            },
            "notes": record.notes,
        }

    def _judgment_to_dict(self, record: JudgmentRecord) -> dict[str, typing.Any]:
        return {
            "exists": True,
            "schema_version": PROTOCOL_JUDGMENT_SCHEMA_VERSION,
            "subject_id": record.subject_id,
            "domain_id": record.domain_id,
            "case_id": record.case_id,
            "claim_type": record.claim_type,
            "domain_spec_hash": record.domain_spec_hash,
            "evaluation_spec_hash": record.evaluation_spec_hash,
            "model_policy_hash": record.model_policy_hash,
            "revision": int(record.revision),
            "evidence_sequence": int(record.evidence_sequence),
            "case_schema_version": record.case_schema_version,
            "extractor_version": record.extractor_version,
            "manifest_schema_version": record.manifest_schema_version,
            "manifest_root": record.manifest_root,
            "manifest_item_count": int(record.manifest_item_count),
            "freshness_window_blocks": int(record.freshness_window_blocks),
            "valid_until_source_block": int(record.valid_until_source_block),
            "outcome": record.outcome,
            "outcome_enum": record.outcome,
            "confidence_ppm": int(record.confidence_ppm),
            "reason_code": record.reason_code,
            "assessment_hash": record.assessment_hash,
            "case_hash": record.case_hash,
            "risk_flags": json.loads(record.risk_flags_json),
            "summary": record.summary,
            "finalized_at": PLACEHOLDER_PROTOCOL_TIMESTAMP,
            "valid_until": {
                "basis": "source_block",
                "source_network": record.source_network,
                "source_chain_id": int(record.source_chain_id),
                "source_block": int(record.valid_until_source_block),
            },
            "source_network": record.source_network,
            "source_chain_id": int(record.source_chain_id),
            "source_label": record.source_label,
            "start_block": int(record.start_block),
            "end_block": int(record.end_block),
            "start_block_hash": record.start_block_hash,
            "end_block_hash": record.end_block_hash,
            "evidence_anchor": record.evidence_anchor,
        }

    def _judgment_object_to_dict(self, record: JudgmentRecord) -> dict[str, typing.Any]:
        return {
            "exists": True,
            "schema_version": PROTOCOL_JUDGMENT_SCHEMA_VERSION,
            "subject_id": record.subject_id,
            "domain_id": record.domain_id,
            "case_id": record.case_id,
            "claim_type": record.claim_type,
            "assessment_hash": record.assessment_hash,
            "outcome_enum": record.outcome,
            "confidence_ppm": int(record.confidence_ppm),
            "reason_code": record.reason_code,
            "risk_flags": json.loads(record.risk_flags_json),
            "summary": record.summary,
            "revision": int(record.revision),
            "finalized_at": PLACEHOLDER_PROTOCOL_TIMESTAMP,
            "valid_until": {
                "basis": "source_block",
                "source_network": record.source_network,
                "source_chain_id": int(record.source_chain_id),
                "source_block": int(record.valid_until_source_block),
            },
        }

    def _assessment_record_to_dict(self, record: AssessmentArtifactRecord) -> dict[str, typing.Any]:
        try:
            outcome_payload = json.loads(record.outcome_payload_json)
        except Exception:
            outcome_payload = {}
        if not isinstance(outcome_payload, dict):
            outcome_payload = {}
        return {
            "exists": True,
            "schema_version": PROTOCOL_ASSESSMENT_SCHEMA_VERSION,
            "case_id": record.case_id,
            "subject_id": record.subject_id,
            "domain_id": record.domain_id,
            "domain_spec_hash": record.domain_spec_hash,
            "parent_revision_hash": record.parent_revision_hash if len(record.parent_revision_hash) > 0 else None,
            "evidence_root": record.evidence_root,
            "evaluation_spec_hash": record.evaluation_spec_hash,
            "model_policy_hash": record.model_policy_hash,
            "outcome_enum": record.outcome_enum,
            "confidence_ppm": int(record.confidence_ppm),
            "outcome_payload": outcome_payload,
            "outcome_payload_hash": record.outcome_payload_hash,
            "evaluated_at": record.evaluated_at,
            "assessment_hash": record.assessment_hash,
            "revision": int(record.revision),
        }

    def _assessment_artifact_to_dict(self, judgment: JudgmentRecord) -> dict[str, typing.Any]:
        if judgment.subject_id not in self.latest_assessment_by_subject:
            return {
                "exists": False,
                "subject_id": judgment.subject_id,
                "revision": int(judgment.revision),
            }
        latest = self.latest_assessment_by_subject[judgment.subject_id]
        if int(latest.revision) != int(judgment.revision):
            for index in range(len(self.assessment_log)):
                candidate = self.assessment_log[index]
                if candidate.subject_id == judgment.subject_id and int(candidate.revision) == int(judgment.revision):
                    return self._assessment_record_to_dict(candidate)
            return {
                "exists": False,
                "subject_id": judgment.subject_id,
                "revision": int(judgment.revision),
            }
        return self._assessment_record_to_dict(latest)

    def _freshness_status(
        self, judgment: JudgmentRecord, current_source_block: int | None
    ) -> dict[str, typing.Any]:
        if current_source_block is None:
            return {
                "fresh": False,
                "reason": "freshness not checked",
            }

        normalized_current_source_block = self._normalize_block_number(current_source_block)
        if normalized_current_source_block > int(judgment.valid_until_source_block):
            return {
                "fresh": False,
                "reason": "judgment is stale",
            }

        return {
            "fresh": True,
            "reason": "judgment is fresh",
        }

    def _build_handshake_decision(
        self,
        subject_id: str,
        action_type: str,
        current_source_block: int | None,
    ) -> dict[str, typing.Any]:
        subject_key = self._normalize_subject_id(subject_id)
        action_name = self._normalize_action_type(action_type)
        freshness_checked = current_source_block is not None

        if subject_key not in self.latest_judgment_by_subject:
            return {
                "exists": False,
                "subject_id": subject_key,
                "action_type": action_name,
                "allowed": False,
                "state": "NO_JUDGMENT",
                "recommended_action": "REFRESH",
                "recommended_action_is_hint": True,
                "state_is_primary": True,
                "enforcement_mode": "ENFORCED_GATE",
                "reason_code": "NO_JUDGMENT",
                "reason": "no judgment",
                "freshness_checked": freshness_checked,
            }

        latest = self.latest_judgment_by_subject[subject_key]
        judgment_dict = self._judgment_to_dict(latest)
        valid_until_source_block = int(latest.valid_until_source_block)
        handshake: dict[str, typing.Any] = {
            "exists": True,
            "subject_id": subject_key,
            "action_type": action_name,
            "freshness_checked": freshness_checked,
            "state_is_primary": True,
            "recommended_action_is_hint": True,
            "enforcement_mode": "ENFORCED_GATE",
            "valid_until_source_block": valid_until_source_block,
            "judgment": judgment_dict,
        }

        if current_source_block is not None:
            handshake["current_source_block"] = int(current_source_block)

        freshness = self._freshness_status(latest, current_source_block)
        if freshness_checked and not freshness["fresh"]:
            handshake.update(
                {
                    "allowed": False,
                    "state": "STALE",
                    "recommended_action": "REFRESH",
                    "reason_code": "JUDGMENT_STALE",
                    "reason": str(freshness["reason"]),
                }
            )
            return handshake

        if latest.outcome == "SAFE":
            handshake.update(
                {
                    "allowed": True,
                    "state": "SAFE",
                    "recommended_action": "ALLOW",
                    "reason_code": (
                        "SAFE_FRESH"
                        if freshness_checked
                        else "SAFE_NO_FRESHNESS_CHECK"
                    ),
                    "reason": (
                        "latest outcome is SAFE and judgment is fresh"
                        if freshness_checked
                        else "latest outcome is SAFE"
                    ),
                }
            )
            return handshake

        if latest.outcome == "CAUTION":
            handshake.update(
                {
                    "allowed": False,
                    "state": "CAUTION",
                    "recommended_action": "REVIEW",
                    "reason_code": "OUTCOME_CAUTION",
                    "reason": "latest outcome is CAUTION",
                }
            )
            return handshake

        if latest.outcome == "INSUFFICIENT_DATA":
            handshake.update(
                {
                    "allowed": False,
                    "state": "INSUFFICIENT_DATA",
                    "recommended_action": "REFRESH",
                    "reason_code": "OUTCOME_INSUFFICIENT_DATA",
                    "reason": "latest outcome is INSUFFICIENT_DATA",
                }
            )
            return handshake

        handshake.update(
            {
                "allowed": False,
                "state": "UNSAFE",
                "recommended_action": "DENY",
                "reason_code": "OUTCOME_UNSAFE",
                "reason": f"latest outcome is {latest.outcome}",
            }
        )
        return handshake

    def _only_owner(self):
        if gl.message.sender_address != self.owner:
            raise gl.vm.UserError("Only owner can perform this action")
