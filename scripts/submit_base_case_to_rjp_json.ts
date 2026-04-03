#!/usr/bin/env npx tsx

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import os from "os";
import path from "path";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";

import { toPlainJsonValue } from "./lib/format_genlayer_result.js";

const privateKey = process.env.PRIVATE_KEY;
const rpcUrl = process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const rjpAddress = process.env.RJP_CONTRACT_ADDRESS || process.argv[2];
const casePayloadRaw = process.env.CASE_PAYLOAD || process.argv[3];
const mode = (process.env.MODE || process.argv[4] || "submit-and-evaluate").toLowerCase();
const writeRetryCount = Number(process.env.WRITE_RETRY_COUNT || 2);
const writeRetryBackoffMs = Number(process.env.WRITE_RETRY_BACKOFF_MS || 2000);

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!rjpAddress) {
  throw new Error("Missing RJP_CONTRACT_ADDRESS env var or argv[2]");
}
if (!casePayloadRaw) {
  throw new Error("Missing CASE_PAYLOAD env var or argv[3]");
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
  const casePayload = JSON.parse(casePayloadRaw);
  const subjectId = extractSubjectId(casePayload);
  const domainId = String(casePayload.domain_id || "").trim();
  const caseId = String(casePayload.case_id || "").trim();

  if (!subjectId) {
    throw new Error("Case payload missing subject_id");
  }
  if (mode !== "submit-only" && mode !== "submit-and-evaluate") {
    throw new Error(`Unsupported mode: ${mode}`);
  }

  const evidenceHash = await submitEvidenceWithRetry(subjectId, caseId, casePayload);

  let judgmentHash: string | null = null;
  let judgment: unknown = null;

  if (mode === "submit-and-evaluate") {
    judgmentHash = await evaluateLatestEvidenceWithRetry(subjectId, caseId);

    judgment = await client.readContract(({
      address: rjpAddress as `0x${string}`,
      functionName: "get_latest_judgment",
      args: [subjectId],
      stateStatus: "accepted",
    } as any));
  }

  console.log(
    JSON.stringify(
      {
        subject_id: subjectId,
        domain_id: domainId || null,
        case_id: caseId || null,
        submit_tx: evidenceHash,
        evaluate_tx: judgmentHash,
        judgment: judgment ? toPlainJsonValue(judgment) : null,
      },
      null,
      2,
    ),
  );
}

async function submitEvidenceWithRetry(
  subjectId: string,
  caseId: string,
  casePayload: Record<string, unknown>,
): Promise<string | null> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= writeRetryCount; attempt += 1) {
    try {
      const evidenceHash = await client.writeContract({
        address: rjpAddress as `0x${string}`,
        functionName: "submit_evidence",
        args: [subjectId, "", JSON.stringify(casePayload)],
        value: 0n,
      } as any);

      await client.waitForTransactionReceipt({
        hash: evidenceHash,
        status: "ACCEPTED" as any,
        retries: 30,
      } as any);
      return evidenceHash;
    } catch (error) {
      lastError = error;
      const evidence = await readLatestEvidence(subjectId);
      if (matchesCaseId(evidence, caseId)) {
        return null;
      }
      if (attempt >= writeRetryCount) {
        break;
      }
      await sleep(writeRetryBackoffMs * (attempt + 1));
    }
  }

  throw lastError;
}


async function evaluateLatestEvidenceWithRetry(
  subjectId: string,
  caseId: string,
): Promise<string | null> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= writeRetryCount; attempt += 1) {
    try {
      const judgmentHash = await client.writeContract({
        address: rjpAddress as `0x${string}`,
        functionName: "evaluate_latest_evidence",
        args: [subjectId],
        value: 0n,
      } as any);

      await client.waitForTransactionReceipt({
        hash: judgmentHash,
        status: "ACCEPTED" as any,
        retries: 30,
      } as any);
      return judgmentHash;
    } catch (error) {
      lastError = error;
      const judgment = await readLatestJudgment(subjectId);
      if (matchesCaseId(judgment, caseId)) {
        return null;
      }
      if (attempt >= writeRetryCount) {
        break;
      }
      await sleep(writeRetryBackoffMs * (attempt + 1));
    }
  }

  throw lastError;
}


async function readLatestEvidence(subjectId: string): Promise<Record<string, unknown>> {
  const evidence = await client.readContract(({
    address: rjpAddress as `0x${string}`,
    functionName: "get_latest_evidence",
    args: [subjectId],
    stateStatus: "accepted",
  } as any));
  return toPlainJsonValue(evidence) as Record<string, unknown>;
}


async function readLatestJudgment(subjectId: string): Promise<Record<string, unknown>> {
  const judgment = await client.readContract(({
    address: rjpAddress as `0x${string}`,
    functionName: "get_latest_judgment",
    args: [subjectId],
    stateStatus: "accepted",
  } as any));
  return toPlainJsonValue(judgment) as Record<string, unknown>;
}


function matchesCaseId(payload: Record<string, unknown>, caseId: string): boolean {
  if (!payload || payload.exists !== true) {
    return false;
  }
  return String(payload.case_id || "").trim() === caseId;
}


function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePrivateKey(value: string): `0x${string}` {
  const trimmed = value.trim();
  const prefixed = trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
  return prefixed as `0x${string}`;
}

function extractSubjectId(casePayload: Record<string, unknown>): string {
  const legacy = String(casePayload.subject_id || "").trim();
  if (legacy) {
    return legacy;
  }
  const subjectScope = casePayload.subject_scope as Record<string, unknown> | undefined;
  return String(subjectScope?.subject_id || "").trim();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
