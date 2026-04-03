#!/usr/bin/env npx tsx

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";
import { interpretHandshakeDomain } from "./lib/domain_interpretation.js";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const demoAddress = process.env.BASE_AGENT_DEMO_ADDRESS || process.argv[2];
const subjectId = process.env.SUBJECT_ID || process.argv[3];
const actionType = process.env.ACTION_TYPE || process.argv[4] || "trade";

if (!demoAddress) {
  throw new Error("Missing BASE_AGENT_DEMO_ADDRESS env var or argv[2]");
}
if (!subjectId) {
  throw new Error("Missing SUBJECT_ID env var or argv[3]");
}

const demoAbi = [
  {
    type: "function",
    name: "previewActionHandshake",
    stateMutability: "view",
    inputs: [
      { name: "subjectId", type: "string" },
      { name: "actionType", type: "string" },
    ],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "state", type: "string" },
          { name: "recommendedAction", type: "string" },
          { name: "reasonCode", type: "string" },
          { name: "reason", type: "string" },
          { name: "allowed", type: "bool" },
          { name: "caseId", type: "string" },
          { name: "claimType", type: "string" },
          { name: "outcome", type: "string" },
          { name: "revision", type: "uint64" },
          { name: "validUntilSourceBlock", type: "uint64" },
          { name: "freshnessWindowBlocks", type: "uint32" },
          { name: "summary", type: "string" },
        ],
      },
    ],
  },
] as const;

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

type HandshakePreview = {
  state: string;
  recommendedAction: string;
  reasonCode: string;
  reason: string;
  allowed: boolean;
  caseId: string;
  claimType: string;
  outcome: string;
  revision: bigint;
  validUntilSourceBlock: bigint;
  freshnessWindowBlocks: number | bigint;
  summary: string;
};

async function main() {
  const preview = (await client.readContract(({
    address: demoAddress as `0x${string}`,
    abi: demoAbi,
    functionName: "previewActionHandshake",
    args: [subjectId, actionType],
  } as any))) as HandshakePreview;

  const normalized = {
    subject_id: subjectId,
    action_type: actionType,
    state: preview.state,
    recommended_action: preview.recommendedAction,
    reason_code: preview.reasonCode,
    reason: preview.reason,
    allowed: preview.allowed,
    case_id: preview.caseId,
    claim_type: preview.claimType,
    outcome: preview.outcome,
    revision: Number(preview.revision),
    valid_until_source_block: Number(preview.validUntilSourceBlock),
    freshness_window_blocks: Number(preview.freshnessWindowBlocks),
    summary: preview.summary,
  };

  console.log(
    JSON.stringify(
      {
        ...normalized,
        domain_interpretation: interpretHandshakeDomain(normalized),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
