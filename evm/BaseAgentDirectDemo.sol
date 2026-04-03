// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BaseAgentDirectDemo {
    struct DirectDecision {
        string state;
        string recommendedAction;
        string reasonCode;
        string reason;
        bool allowed;
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
        uint256 recordedAt;
    }

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
        string reason
    );

    function previewAction(
        string calldata subjectId,
        string calldata actionType
    ) external pure returns (DirectDecision memory) {
        subjectId;
        actionType;
        return
            DirectDecision({
                state: "NO_JUDGMENT",
                recommendedAction: "ALLOW",
                reasonCode: "NO_JUDGMENT_CHECK",
                reason: "no judgment check applied",
                allowed: true
            });
    }

    function attemptAction(
        string calldata subjectId,
        string calldata actionType
    ) external returns (bool allowed) {
        DirectDecision memory decision = DirectDecision({
            state: "NO_JUDGMENT",
            recommendedAction: "ALLOW",
            reasonCode: "NO_JUDGMENT_CHECK",
            reason: "no judgment check applied",
            allowed: true
        });

        uint256 actionId = actionCount + 1;
        actionCount = actionId;
        actions[actionId] = ActionRecord({
            actor: msg.sender,
            subjectId: subjectId,
            actionType: actionType,
            allowed: decision.allowed,
            state: decision.state,
            recommendedAction: decision.recommendedAction,
            reasonCode: decision.reasonCode,
            reason: decision.reason,
            recordedAt: block.timestamp
        });

        emit ActionEvaluated(
            actionId,
            msg.sender,
            subjectId,
            actionType,
            decision.allowed,
            decision.state,
            decision.reasonCode,
            decision.reason
        );

        return decision.allowed;
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
                    recordedAt: 0
                });
        }
        return actions[actionCount];
    }
}
