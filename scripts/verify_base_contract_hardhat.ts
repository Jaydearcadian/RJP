#!/usr/bin/env npx tsx

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const hardhatRoot = "/tmp/genlayer-studio-bridge-boilerplate/smart-contracts";
const verificationSourcesDir = path.join(hardhatRoot, "verification-sources");
const verificationConfigPath = path.join(hardhatRoot, "hardhat.rjp.verify.config.ts");
const contractKind = (process.env.CONTRACT_KIND || process.argv[2] || "").trim();
const contractAddress = (process.env.CONTRACT_ADDRESS || process.argv[3] || "").trim();

if (!contractKind) {
  throw new Error("Missing CONTRACT_KIND env var or argv[2]");
}
if (!contractAddress) {
  throw new Error("Missing CONTRACT_ADDRESS env var or argv[3]");
}

async function main() {
  const etherscanApiKey = process.env.ETHERSCAN_API_KEY || "";
  if (!etherscanApiKey) {
    throw new Error("Missing ETHERSCAN_API_KEY env var for BaseScan verification");
  }

  const contractSpec = prepareContractSources(contractKind);
  ensureVerificationConfig();

  console.log("Running Hardhat BaseScan verification:");
  console.log(`  Kind: ${contractKind}`);
  console.log(`  Address: ${contractAddress}`);
  console.log(`  Hardhat root: ${hardhatRoot}`);
  console.log(`  Contract: ${contractSpec.fqName}`);

  const args = [
    "hardhat",
    "verify",
    "--config",
    verificationConfigPath,
    "--network",
    "baseSepoliaTestnet",
    contractAddress,
    ...contractSpec.constructorArgs,
  ];

  execFileSync("npx", args, {
    cwd: hardhatRoot,
    stdio: "inherit",
    env: {
      ...process.env,
      ETHERSCAN_API_KEY: etherscanApiKey,
      PRIVATE_KEY: process.env.BASE_PRIVATE_KEY || process.env.PRIVATE_KEY || "",
      BASE_SEPOLIA_RPC_URL: process.env.BASE_RPC_URL || "https://sepolia.base.org",
    },
  });
}

function prepareContractSources(kind: string): { fqName: string; constructorArgs: string[] } {
  fs.mkdirSync(verificationSourcesDir, { recursive: true });

  if (kind === "mirror") {
    copyContract("BaseJudgmentMirror.sol");
    const initialPublisher =
      process.env.INITIAL_PUBLISHER || "0x3D1539c26aabCe1B1aCa28Fb9D8fD70670391D5C";
    return {
      fqName: "BaseJudgmentMirror.sol:BaseJudgmentMirror",
      constructorArgs: [initialPublisher],
    };
  }

  if (kind === "agent-demo") {
    copyContract("BaseJudgmentMirror.sol");
    copyContract("BaseAgentActionDemo.sol");
    const mirrorAddress =
      process.env.BASE_MIRROR_ADDRESS || "0x34EBfd4FcC379b14Cdd602485417a5C088228606";
    return {
      fqName: "BaseAgentActionDemo.sol:BaseAgentActionDemo",
      constructorArgs: [mirrorAddress],
    };
  }

  throw new Error(`Unsupported CONTRACT_KIND: ${kind}`);
}

function copyContract(filename: string) {
  const sourcePath = path.resolve("evm", filename);
  const destinationPath = path.join(verificationSourcesDir, filename);
  fs.copyFileSync(sourcePath, destinationPath);
}

function ensureVerificationConfig() {
  const configSource = `import "@nomicfoundation/hardhat-toolbox";
import '@matterlabs/hardhat-zksync';
import * as dotenv from "dotenv";
import { subtask, HardhatUserConfig } from "hardhat/config";
import { TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD } from "hardhat/builtin-tasks/task-names";

dotenv.config();

subtask(TASK_COMPILE_SOLIDITY_GET_SOLC_BUILD, async (args, _hre, runSuper) => {
  if (args.solcVersion === "0.8.26") {
    const solc = require("solc");
    return {
      compilerPath: require.resolve("solc/soljson.js"),
      isSolcJs: true,
      version: "0.8.26",
      longVersion: solc.version(),
    };
  }

  return runSuper();
});

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.26",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  paths: {
    sources: "./verification-sources",
  },
  networks: {
    baseSepoliaTestnet: {
      url: process.env.BASE_SEPOLIA_RPC_URL || "https://sepolia.base.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      chainId: 84532,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
    customChains: [
      {
        network: "baseSepoliaTestnet",
        chainId: 84532,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api?chainid=84532",
          browserURL: "https://sepolia.basescan.org",
        },
      },
    ],
  },
  sourcify: {
    enabled: false,
  },
};

export default config;
`;

  fs.writeFileSync(verificationConfigPath, configSource);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
