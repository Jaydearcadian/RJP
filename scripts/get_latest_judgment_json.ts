#!/usr/bin/env npx tsx

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { toPlainJsonValue } from "./lib/format_genlayer_result.js";
import { interpretJudgmentDomain } from "./lib/domain_interpretation.js";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const subjectId = process.env.SUBJECT_ID || process.argv[3];

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!subjectId) {
  throw new Error("Missing SUBJECT_ID env var or argv[3]");
}

const normalizedPrivateKey = normalizePrivateKey(privateKey);
const account = createAccount(normalizedPrivateKey);
const client = createClient({
  chain: {
    ...studionet,
    rpcUrls: {
      default: { http: [rpcUrl] },
    },
  },
  account,
});

async function main() {
  const judgment = await client.readContract(({
    address: rjpAddress as `0x${string}`,
    functionName: "get_latest_judgment",
    args: [subjectId],
    stateStatus: "accepted",
  } as any));

  const normalized = toPlainJsonValue(judgment) as Record<string, unknown>;

  console.log(
    JSON.stringify(
      {
        ...normalized,
        domain_interpretation: interpretJudgmentDomain({
          domain_id: String(normalized.domain_id || ""),
          claim_type: String(normalized.claim_type || ""),
          outcome: String(normalized.outcome || ""),
          risk_flags: normalized.risk_flags,
          summary: String(normalized.summary || ""),
          case_id: String(normalized.case_id || ""),
        }),
      },
      null,
      2,
    ),
  );
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed as `0x${string}`;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
