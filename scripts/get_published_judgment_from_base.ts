#!/usr/bin/env npx tsx

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { interpretJudgmentDomain } from "./lib/domain_interpretation.js";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const baseMirrorAddress = process.env.BASE_MIRROR_ADDRESS || process.argv[2];
const subjectId = process.env.SUBJECT_ID || process.argv[3];

if (!baseMirrorAddress) {
  throw new Error("Missing BASE_MIRROR_ADDRESS env var or argv[2]");
}
if (!subjectId) {
  throw new Error("Missing SUBJECT_ID env var or argv[3]");
}

const mirrorAbi = [
  {
    type: "function",
    name: "getLatestBySubject",
    stateMutability: "view",
    inputs: [{ name: "subjectId", type: "string" }],
    outputs: [
      {
        name: "record",
        type: "tuple",
        components: [
          { name: "subjectId", type: "string" },
          { name: "domainId", type: "string" },
          { name: "caseId", type: "string" },
          { name: "claimType", type: "string" },
          { name: "revision", type: "uint64" },
          { name: "outcome", type: "string" },
          { name: "confidencePpm", type: "uint32" },
          { name: "freshnessWindowBlocks", type: "uint32" },
          { name: "validUntilSourceBlock", type: "uint64" },
          { name: "assessmentHash", type: "bytes32" },
          { name: "caseHash", type: "bytes32" },
          { name: "evidenceAnchorHash", type: "bytes32" },
          { name: "sourceNetwork", type: "string" },
          { name: "sourceChainId", type: "uint64" },
          { name: "riskFlagsJson", type: "string" },
          { name: "summary", type: "string" },
          { name: "publishedAt", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const baseClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

type MirrorRecord = {
  subjectId: string;
  domainId: string;
  caseId: string;
  claimType: string;
  revision: bigint;
  outcome: string;
  confidencePpm: number | bigint;
  freshnessWindowBlocks: number | bigint;
  validUntilSourceBlock: bigint;
  assessmentHash: string;
  caseHash: string;
  evidenceAnchorHash: string;
  sourceNetwork: string;
  sourceChainId: number | bigint;
  riskFlagsJson: string;
  summary: string;
  publishedAt: number | bigint;
};

async function main() {
  const record = (await baseClient.readContract(({
    address: baseMirrorAddress as `0x${string}`,
    abi: mirrorAbi,
    functionName: "getLatestBySubject",
    args: [subjectId],
  } as any))) as MirrorRecord;

  const normalized = {
    subject_id: record.subjectId,
    domain_id: record.domainId,
    case_id: record.caseId,
    claim_type: record.claimType,
    revision: Number(record.revision),
    outcome: record.outcome,
    confidence_ppm: Number(record.confidencePpm),
    freshness_window_blocks: Number(record.freshnessWindowBlocks),
    valid_until_source_block: Number(record.validUntilSourceBlock),
    assessment_hash: record.assessmentHash,
    case_hash: record.caseHash,
    evidence_anchor_hash: record.evidenceAnchorHash,
    source_network: record.sourceNetwork,
    source_chain_id: Number(record.sourceChainId),
    risk_flags: parseRiskFlags(record.riskFlagsJson),
    summary: record.summary,
    published_at: Number(record.publishedAt),
  };

  console.log(
    JSON.stringify(
      {
        ...normalized,
        domain_interpretation: interpretJudgmentDomain(normalized),
      },
      null,
      2,
    ),
  );
}

function parseRiskFlags(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
