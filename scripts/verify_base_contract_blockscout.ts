#!/usr/bin/env npx tsx

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { encodeAbiParameters } from "viem";

const require = createRequire(import.meta.url);
const solc = require("/tmp/genlayer-studio-bridge-boilerplate/smart-contracts/node_modules/solc");

const explorerApiUrl =
  process.env.BLOCKSCOUT_API_URL ||
  "https://sepolia-explorer.base.org/api?module=contract&action=verifysourcecode";
const statusApiBase =
  process.env.BLOCKSCOUT_STATUS_URL ||
  "https://sepolia-explorer.base.org/api?module=contract&action=checkverifystatus";
const contractKind = (process.env.CONTRACT_KIND || process.argv[2] || "").trim();
const contractAddress = (process.env.CONTRACT_ADDRESS || process.argv[3] || "").trim();

if (!contractKind) {
  throw new Error("Missing CONTRACT_KIND env var or argv[2]");
}
if (!contractAddress) {
  throw new Error("Missing CONTRACT_ADDRESS env var or argv[3]");
}

async function main() {
  const payload = buildVerificationPayload(contractKind, contractAddress);

  console.log("Submitting Base Sepolia Blockscout verification:");
  console.log(`  Kind: ${contractKind}`);
  console.log(`  Address: ${contractAddress}`);
  console.log(`  Compiler: ${payload.compilerversion}`);

  const form = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    form.append(key, value);
  }

  const response = await fetch(explorerApiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(`Verification submission failed (${response.status}): ${body}`);
  }

  const parsed = JSON.parse(body) as { status?: string; message?: string; result?: string };
  if (parsed.status !== "1" || !parsed.result) {
    throw new Error(`Unexpected verification response: ${body}`);
  }

  const guid = parsed.result;
  const finalStatus = await pollStatus(guid);

  console.log(
    JSON.stringify(
      {
        address: contractAddress,
        contract_kind: contractKind,
        guid,
        final_status: finalStatus,
      },
      null,
      2,
    ),
  );
}

function buildVerificationPayload(
  kind: string,
  address: string,
): Record<string, string> {
  const compilerVersion = `v${solc.version()}`;

  if (kind === "mirror") {
    const sourcePath = path.resolve("evm/BaseJudgmentMirror.sol");
    const source = fs.readFileSync(sourcePath, "utf8");
    const standardJson = buildStandardJson({
      "BaseJudgmentMirror.sol": source,
    });
    const initialPublisher =
      process.env.INITIAL_PUBLISHER || "0x3D1539c26aabCe1B1aCa28Fb9D8fD70670391D5C";
    const constructorArguments = encodeAbiParameters(
      [{ type: "address" }],
      [initialPublisher as `0x${string}`],
    ).slice(2);

    return {
      codeformat: "solidity-standard-json-input",
      contractaddress: address,
      contractname: "BaseJudgmentMirror.sol:BaseJudgmentMirror",
      compilerversion: compilerVersion,
      sourceCode: JSON.stringify(standardJson),
      constructorArguments,
      licenseType: "mit",
    };
  }

  if (kind === "agent-demo") {
    const sourcePath = path.resolve("evm/BaseAgentActionDemo.sol");
    const source = fs.readFileSync(sourcePath, "utf8");
    const standardJson = buildStandardJson({
      "BaseAgentActionDemo.sol": source,
    });
    const mirrorAddress =
      process.env.BASE_MIRROR_ADDRESS || "0x34EBfd4FcC379b14Cdd602485417a5C088228606";
    const constructorArguments = encodeAbiParameters(
      [{ type: "address" }],
      [mirrorAddress as `0x${string}`],
    ).slice(2);

    return {
      codeformat: "solidity-standard-json-input",
      contractaddress: address,
      contractname: "BaseAgentActionDemo.sol:BaseAgentActionDemo",
      compilerversion: compilerVersion,
      sourceCode: JSON.stringify(standardJson),
      constructorArguments,
      licenseType: "mit",
    };
  }

  throw new Error(`Unsupported CONTRACT_KIND: ${kind}`);
}

function buildStandardJson(sources: Record<string, string>) {
  return {
    language: "Solidity",
    sources: Object.fromEntries(
      Object.entries(sources).map(([name, content]) => [name, { content }]),
    ),
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
      outputSelection: {
        "*": {
          "*": ["abi", "evm.bytecode.object"],
        },
      },
    },
  };
}

async function pollStatus(guid: string): Promise<string> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const url = `${statusApiBase}&guid=${encodeURIComponent(guid)}`;
    const response = await fetch(url);
    const body = await response.text();

    if (!response.ok) {
      throw new Error(`Verification status check failed (${response.status}): ${body}`);
    }

    const parsed = JSON.parse(body) as { status?: string; result?: string };
    const result = parsed.result || "";
    if (result === "Pass - Verified" || result.startsWith("Already Verified")) {
      return result;
    }
    if (result.startsWith("Fail")) {
      throw new Error(`Verification failed: ${result}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  throw new Error("Verification status polling timed out");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
