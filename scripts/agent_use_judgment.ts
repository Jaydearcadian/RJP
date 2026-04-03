#!/usr/bin/env npx tsx

import { performance } from "node:perf_hooks";

import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { toPlainJsonValue } from "./lib/format_genlayer_result";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const subjectId = process.env.SUBJECT_ID || process.argv[3];
const actionType = process.env.ACTION_TYPE || process.argv[4] || "trade";
const shouldAttempt =
  (process.env.ATTEMPT_ACTION || process.argv[5] || "false").toLowerCase() === "true";
const currentSourceBlockRaw = process.env.CURRENT_SOURCE_BLOCK || process.argv[6] || "";

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!subjectId) {
  throw new Error("Missing SUBJECT_ID env var or argv[3]");
}

const currentSourceBlock =
  currentSourceBlockRaw.trim().length > 0 ? Number(currentSourceBlockRaw) : null;
if (currentSourceBlockRaw.trim().length > 0 && !Number.isFinite(currentSourceBlock)) {
  throw new Error("CURRENT_SOURCE_BLOCK must be a finite number when provided");
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
  const startedAt = performance.now();
  const decisionStartedAt = performance.now();
  const readFunctionName =
    currentSourceBlock === null ? "get_agent_decision" : "get_agent_decision_with_source_block";
  const readArgs =
    currentSourceBlock === null ? [subjectId, actionType] : [subjectId, actionType, currentSourceBlock];
  const agentDecision = await client.readContract({
    address: rjpAddress as `0x${string}`,
    functionName: readFunctionName,
    args: readArgs,
    stateStatus: "accepted",
  });
  const decisionMs = performance.now() - decisionStartedAt;

  const result: Record<string, unknown> = {
    subject_id: subjectId,
    action_type: actionType,
    current_source_block: currentSourceBlock,
    decision: toPlainJsonValue(agentDecision),
    timings_ms: {
      [readFunctionName]: Math.round(decisionMs),
      total_read_path: Math.round(performance.now() - startedAt),
    },
  };

  const decisionValue = toPlainJsonValue(agentDecision) as { allowed?: boolean } | undefined;
  if (shouldAttempt) {
    const writeStartedAt = performance.now();
    const writeFunctionName =
      currentSourceBlock === null ? "attempt_guarded_action" : "attempt_guarded_action_with_source_block";
    const writeArgs =
      currentSourceBlock === null ? [subjectId, actionType] : [subjectId, actionType, currentSourceBlock];
    const hash = await client.writeContract({
      address: rjpAddress as `0x${string}`,
      functionName: writeFunctionName,
      args: writeArgs,
    });
    await client.waitForTransactionReceipt({
      hash,
      status: "ACCEPTED",
      retries: 100,
    });
    result.attempt = {
      tx_hash: hash,
      allowed_before_write: decisionValue?.allowed ?? null,
      elapsed_ms: Math.round(performance.now() - writeStartedAt),
    };
  }

  console.log(JSON.stringify(result, null, 2));
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
