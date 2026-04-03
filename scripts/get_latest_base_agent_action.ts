#!/usr/bin/env npx tsx

import { createPublicClient, http } from "viem";
import { baseSepolia } from "viem/chains";

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const demoAddress = process.env.BASE_AGENT_DEMO_ADDRESS || process.argv[2];

if (!demoAddress) {
  throw new Error("Missing BASE_AGENT_DEMO_ADDRESS env var or argv[2]");
}

const demoAbi = [
  {
    type: "function",
    name: "getLatestAction",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "actor", type: "address" },
          { name: "subjectId", type: "string" },
          { name: "actionType", type: "string" },
          { name: "allowed", type: "bool" },
          { name: "state", type: "string" },
          { name: "recommendedAction", type: "string" },
          { name: "reasonCode", type: "string" },
          { name: "reason", type: "string" },
          { name: "caseId", type: "string" },
          { name: "claimType", type: "string" },
          { name: "outcome", type: "string" },
          { name: "revision", type: "uint64" },
          { name: "validUntilSourceBlock", type: "uint64" },
          { name: "freshnessWindowBlocks", type: "uint32" },
          { name: "summary", type: "string" },
          { name: "recordedAt", type: "uint256" },
        ],
      },
    ],
  },
] as const;

const client = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

async function main() {
  const latest = await client.readContract({
    address: demoAddress as `0x${string}`,
    abi: demoAbi,
    functionName: "getLatestAction",
  });

  console.log(
    JSON.stringify(
      {
        actor: latest.actor,
        subject_id: latest.subjectId,
        action_type: latest.actionType,
        allowed: latest.allowed,
        state: latest.state,
        recommended_action: latest.recommendedAction,
        reason_code: latest.reasonCode,
        reason: latest.reason,
        case_id: latest.caseId,
        claim_type: latest.claimType,
        outcome: latest.outcome,
        revision: Number(latest.revision),
        valid_until_source_block: Number(latest.validUntilSourceBlock),
        freshness_window_blocks: Number(latest.freshnessWindowBlocks),
        summary: latest.summary,
        recorded_at: Number(latest.recordedAt),
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
