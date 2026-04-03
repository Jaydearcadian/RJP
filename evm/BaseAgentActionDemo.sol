// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IBaseJudgmentMirror {
    struct JudgmentRecord {
        string subjectId;
        string domainId;
        string caseId;
        string claimType;
        uint64 revision;
        string outcome;
        uint32 confidencePpm;
        uint32 freshnessWindowBlocks;
        uint64 validUntilSourceBlock;
        bytes32 assessmentHash;
        bytes32 caseHash;
        bytes32 evidenceAnchorHash;
        string sourceNetwork;
        uint64 sourceChainId;
        string riskFlagsJson;
        string summary;
        uint256 publishedAt;
    }

    function getLatestBySubject(
        string calldata subjectId
    ) external view returns (JudgmentRecord memory);
}

contract BaseAgentActionDemo {
    struct PolicyModel {
        bool statePrimary;
        bool recommendationIsHint;
        bool previewIsAdvisory;
        bool attemptActionIsEnforced;
    }

    struct HandshakeDecision {
        string state;
        string recommendedAction;
        string reasonCode;
        string reason;
        bool allowed;
        string caseId;
        string claimType;
        string outcome;
        uint64 revision;
        uint64 validUntilSourceBlock;
        uint32 freshnessWindowBlocks;
        string summary;
    }

    struct ActionRecord {
        address actor;
        string subjectId;
        string actionType;
        bool allowed;
        string state;
        string recommendedAction;
        string reasonCode;
        string reason;
        string caseId;
        string claimType;
        string outcome;
        uint64 revision;
        uint64 validUntilSourceBlock;
        uint32 freshnessWindowBlocks;
        string summary;
        uint256 recordedAt;
    }

    address public owner;
    IBaseJudgmentMirror public immutable mirror;
    uint256 public actionCount;
    mapping(uint256 => ActionRecord) public actions;

    event ActionEvaluated(
        uint256 indexed actionId,
        address indexed actor,
        string subjectId,
        string actionType,
        bool allowed,
        string state,
        string reasonCode,
        string reason,
        string outcome,
        uint64 revision
    );

    constructor(address mirrorAddress) {
        require(mirrorAddress != address(0), "Mirror required");
        owner = msg.sender;
        mirror = IBaseJudgmentMirror(mirrorAddress);
    }

    function attemptAction(
        string calldata subjectId,
        string calldata actionType
    ) external returns (bool allowed) {
        IBaseJudgmentMirror.JudgmentRecord memory judgment = mirror.getLatestBySubject(subjectId);
        HandshakeDecision memory handshake = _buildHandshakeDecision(judgment);
        allowed = handshake.allowed;

        uint256 actionId = actionCount + 1;
        actionCount = actionId;
        actions[actionId] = ActionRecord({
            actor: msg.sender,
            subjectId: subjectId,
            actionType: actionType,
            allowed: handshake.allowed,
            state: handshake.state,
            recommendedAction: handshake.recommendedAction,
            reasonCode: handshake.reasonCode,
            reason: handshake.reason,
            caseId: handshake.caseId,
            claimType: handshake.claimType,
            outcome: handshake.outcome,
            revision: handshake.revision,
            validUntilSourceBlock: handshake.validUntilSourceBlock,
            freshnessWindowBlocks: handshake.freshnessWindowBlocks,
            summary: handshake.summary,
            recordedAt: block.timestamp
        });

        emit ActionEvaluated(
            actionId,
            msg.sender,
            subjectId,
            actionType,
            handshake.allowed,
            handshake.state,
            handshake.reasonCode,
            handshake.reason,
            handshake.outcome,
            handshake.revision
        );
    }

    function previewActionHandshake(
        string calldata subjectId,
        string calldata actionType
    ) external view returns (HandshakeDecision memory) {
        actionType;
        return _buildHandshakeDecision(mirror.getLatestBySubject(subjectId));
    }

    function getPolicyModel() external pure returns (PolicyModel memory) {
        return
            PolicyModel({
                statePrimary: true,
                recommendationIsHint: true,
                previewIsAdvisory: true,
                attemptActionIsEnforced: true
            });
    }

    function getLatestAction() external view returns (ActionRecord memory) {
        if (actionCount == 0) {
            return
                ActionRecord({
                    actor: address(0),
                    subjectId: "",
                    actionType: "",
                    allowed: false,
                    state: "",
                    recommendedAction: "",
                    reasonCode: "",
                    reason: "",
                    caseId: "",
                    claimType: "",
                    outcome: "",
                    revision: 0,
                    validUntilSourceBlock: 0,
                    freshnessWindowBlocks: 0,
                    summary: "",
                    recordedAt: 0
                });
        }
        return actions[actionCount];
    }

    function _buildHandshakeDecision(
        IBaseJudgmentMirror.JudgmentRecord memory judgment
    ) internal view returns (HandshakeDecision memory) {
        if (judgment.revision == 0) {
            return HandshakeDecision({
                state: "NO_JUDGMENT",
                recommendedAction: "REFRESH",
                reasonCode: "NO_MIRRORED_JUDGMENT",
                reason: "no mirrored judgment",
                allowed: false,
                caseId: "",
                claimType: "",
                outcome: "",
                revision: 0,
                validUntilSourceBlock: 0,
                freshnessWindowBlocks: 0,
                summary: ""
            });
        }
        if (judgment.sourceChainId != uint64(block.chainid)) {
            return HandshakeDecision({
                state: "CHAIN_MISMATCH",
                recommendedAction: "DENY",
                reasonCode: "SOURCE_CHAIN_MISMATCH",
                reason: "source chain mismatch",
                allowed: false,
                caseId: judgment.caseId,
                claimType: judgment.claimType,
                outcome: judgment.outcome,
                revision: judgment.revision,
                validUntilSourceBlock: judgment.validUntilSourceBlock,
                freshnessWindowBlocks: judgment.freshnessWindowBlocks,
                summary: judgment.summary
            });
        }
        if (uint256(judgment.validUntilSourceBlock) < block.number) {
            return HandshakeDecision({
                state: "STALE",
                recommendedAction: "REFRESH",
                reasonCode: "JUDGMENT_STALE",
                reason: "judgment is stale",
                allowed: false,
                caseId: judgment.caseId,
                claimType: judgment.claimType,
                outcome: judgment.outcome,
                revision: judgment.revision,
                validUntilSourceBlock: judgment.validUntilSourceBlock,
                freshnessWindowBlocks: judgment.freshnessWindowBlocks,
                summary: judgment.summary
            });
        }
        if (_sameString(judgment.outcome, "CAUTION")) {
            return HandshakeDecision({
                state: "CAUTION",
                recommendedAction: "REVIEW",
                reasonCode: "OUTCOME_CAUTION",
                reason: "latest outcome is CAUTION",
                allowed: false,
                caseId: judgment.caseId,
                claimType: judgment.claimType,
                outcome: judgment.outcome,
                revision: judgment.revision,
                validUntilSourceBlock: judgment.validUntilSourceBlock,
                freshnessWindowBlocks: judgment.freshnessWindowBlocks,
                summary: judgment.summary
            });
        }
        if (_sameString(judgment.outcome, "INSUFFICIENT_DATA")) {
            return HandshakeDecision({
                state: "INSUFFICIENT_DATA",
                recommendedAction: "REFRESH",
                reasonCode: "OUTCOME_INSUFFICIENT_DATA",
                reason: "latest outcome is INSUFFICIENT_DATA",
                allowed: false,
                caseId: judgment.caseId,
                claimType: judgment.claimType,
                outcome: judgment.outcome,
                revision: judgment.revision,
                validUntilSourceBlock: judgment.validUntilSourceBlock,
                freshnessWindowBlocks: judgment.freshnessWindowBlocks,
                summary: judgment.summary
            });
        }
        if (!_sameString(judgment.outcome, "SAFE")) {
            return HandshakeDecision({
                state: "UNSAFE",
                recommendedAction: "DENY",
                reasonCode: "OUTCOME_UNSAFE",
                reason: string.concat("latest outcome is ", judgment.outcome),
                allowed: false,
                caseId: judgment.caseId,
                claimType: judgment.claimType,
                outcome: judgment.outcome,
                revision: judgment.revision,
                validUntilSourceBlock: judgment.validUntilSourceBlock,
                freshnessWindowBlocks: judgment.freshnessWindowBlocks,
                summary: judgment.summary
            });
        }
        return HandshakeDecision({
            state: "SAFE",
            recommendedAction: "ALLOW",
            reasonCode: "SAFE_FRESH",
            reason: "fresh SAFE judgment",
            allowed: true,
            caseId: judgment.caseId,
            claimType: judgment.claimType,
            outcome: judgment.outcome,
            revision: judgment.revision,
            validUntilSourceBlock: judgment.validUntilSourceBlock,
            freshnessWindowBlocks: judgment.freshnessWindowBlocks,
            summary: judgment.summary
        });
    }

    function _sameString(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(bytes(a)) == keccak256(bytes(b));
    }
}
