#!/usr/bin/env npx tsx

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

import { createPublicClient, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { baseSepolia } from "viem/chains";

const require = createRequire(import.meta.url);
const solc = require("/tmp/genlayer-studio-bridge-boilerplate/smart-contracts/node_modules/solc");

const baseRpcUrl = process.env.BASE_RPC_URL || "https://sepolia.base.org";
const basePrivateKey = process.env.BASE_PRIVATE_KEY || process.argv[2];

if (!basePrivateKey) {
  throw new Error("Missing BASE_PRIVATE_KEY env var or argv[2]");
}

const account = privateKeyToAccount(normalizePrivateKey(basePrivateKey));
const basePublicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});
const baseWalletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(baseRpcUrl),
});

async function main() {
  const { abi, bytecode } = compileContract();

  console.log("Deploying BaseAgentDirectDemo to Base Sepolia:");
  console.log(`  Deployer: ${account.address}`);

  const hash = await baseWalletClient.deployContract({
    abi,
    bytecode,
    chain: baseSepolia,
    account,
  });

  const receipt = await basePublicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) {
    throw new Error("Deployment receipt missing contractAddress");
  }

  const deployment = {
    contract: "BaseAgentDirectDemo",
    network: "baseSepoliaTestnet",
    chainId: 84532,
    address: receipt.contractAddress,
    deploymentHash: hash,
    params: {},
    timestamp: new Date().toISOString(),
  };

  const deploymentPath = path.resolve("deployments/base-sepolia/BaseAgentDirectDemo.current.json");
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, `${JSON.stringify(deployment, null, 2)}\n`);

  console.log(JSON.stringify(deployment, null, 2));
}

function compileContract(): { abi: any; bytecode: `0x${string}` } {
  const contractPath = path.resolve("evm/BaseAgentDirectDemo.sol");
  const input = {
    language: "Solidity",
    sources: {
      "BaseAgentDirectDemo.sol": { content: fs.readFileSync(contractPath, "utf8") },
    },
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

  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    const errors = output.errors.filter((entry: any) => entry.severity === "error");
    if (errors.length > 0) {
      throw new Error(errors.map((entry: any) => entry.formattedMessage).join("\n"));
    }
  }

  const contract = output.contracts["BaseAgentDirectDemo.sol"]["BaseAgentDirectDemo"];
  return {
    abi: contract.abi,
    bytecode: `0x${contract.evm.bytecode.object}`,
  };
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
