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
    name: "getPolicyModel",
    stateMutability: "view",
    inputs: [],
    outputs: [
      {
        type: "tuple",
        components: [
          { name: "statePrimary", type: "bool" },
          { name: "recommendationIsHint", type: "bool" },
          { name: "previewIsAdvisory", type: "bool" },
          { name: "attemptActionIsEnforced", type: "bool" },
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
  const model = await client.readContract({
    address: demoAddress as `0x${string}`,
    abi: demoAbi,
    functionName: "getPolicyModel",
  });

  console.log(
    JSON.stringify(
      {
        state_is_primary: model.statePrimary,
        recommendation_is_hint: model.recommendationIsHint,
        preview_is_advisory: model.previewIsAdvisory,
        attempt_action_is_enforced: model.attemptActionIsEnforced,
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
