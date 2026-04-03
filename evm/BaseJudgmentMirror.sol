// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract BaseJudgmentMirror {
    address public owner;
    mapping(address => bool) public authorizedPublishers;

    struct JudgmentInput {
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
    }

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

    mapping(bytes32 => JudgmentRecord) public latestBySubjectKey;

    event PublisherAuthorizationUpdated(address indexed publisher, bool authorized);
    event JudgmentPublished(
        bytes32 indexed subjectKey,
        string subjectId,
        uint64 revision,
        string outcome,
        uint64 validUntilSourceBlock,
        bytes32 assessmentHash
    );

    constructor(address initialPublisher) {
        owner = msg.sender;
        authorizedPublishers[msg.sender] = true;
        emit PublisherAuthorizationUpdated(msg.sender, true);

        if (initialPublisher != address(0) && initialPublisher != msg.sender) {
            authorizedPublishers[initialPublisher] = true;
            emit PublisherAuthorizationUpdated(initialPublisher, true);
        }
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyAuthorizedPublisher() {
        require(authorizedPublishers[msg.sender], "Unauthorized publisher");
        _;
    }

    function setPublisher(address publisher, bool authorized) external onlyOwner {
        authorizedPublishers[publisher] = authorized;
        emit PublisherAuthorizationUpdated(publisher, authorized);
    }

    function subjectKeyFor(string calldata subjectId) external pure returns (bytes32) {
        return keccak256(bytes(subjectId));
    }

    function getLatestBySubject(
        string calldata subjectId
    ) external view returns (JudgmentRecord memory) {
        return latestBySubjectKey[keccak256(bytes(subjectId))];
    }

    function publishJudgment(JudgmentInput calldata input) external onlyAuthorizedPublisher {
        bytes32 subjectKey = keccak256(bytes(input.subjectId));
        latestBySubjectKey[subjectKey] = JudgmentRecord({
            subjectId: input.subjectId,
            domainId: input.domainId,
            caseId: input.caseId,
            claimType: input.claimType,
            revision: input.revision,
            outcome: input.outcome,
            confidencePpm: input.confidencePpm,
            freshnessWindowBlocks: input.freshnessWindowBlocks,
            validUntilSourceBlock: input.validUntilSourceBlock,
            assessmentHash: input.assessmentHash,
            caseHash: input.caseHash,
            evidenceAnchorHash: input.evidenceAnchorHash,
            sourceNetwork: input.sourceNetwork,
            sourceChainId: input.sourceChainId,
            riskFlagsJson: input.riskFlagsJson,
            summary: input.summary,
            publishedAt: block.timestamp
        });

        emit JudgmentPublished(
            subjectKey,
            input.subjectId,
            input.revision,
            input.outcome,
            input.validUntilSourceBlock,
            input.assessmentHash
        );
    }
}
