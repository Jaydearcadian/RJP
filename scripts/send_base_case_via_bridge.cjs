#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

let dotenv;
try {
  dotenv = require("dotenv");
  dotenv.config();
} catch (_error) {
  // Optional. Environment variables may already be set by the caller.
}

const { ethers } = require("ethers");

const BRIDGE_SENDER_ABI = [
  "function quoteSendToGenLayer(address _targetContract, bytes _data, bytes _options) view returns (uint256 nativeFee, uint256 lzTokenFee)",
  "function sendToGenLayer(address _targetContract, bytes _data, bytes _options) payable returns (bytes32 messageId)",
  "event MessageSentToGenLayer(bytes32 indexed messageId, address indexed sender, address targetContract, bytes data, uint256 nonce)",
];


function main() {
  run().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}


async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const inputPath = args.input || process.env.CASE_FILE;
  const bridgeSenderAddress = args.bridgeSender || process.env.BRIDGE_SENDER_ADDRESS;
  const targetContract = args.targetContract || process.env.TARGET_CONTRACT;
  const rpcUrl = args.rpcUrl || process.env.RPC_URL || process.env.BASE_RPC_URL;
  const privateKey = args.privateKey || process.env.PRIVATE_KEY;
  const quoteOnly = Boolean(args.quoteOnly);
  const receiveGas = parsePositiveInteger(
    args.receiveGas || process.env.LZ_RECEIVE_GAS || "2000000",
    "receive gas",
  );

  if (!inputPath) {
    throw new Error("Missing --input or CASE_FILE");
  }
  if (!bridgeSenderAddress) {
    throw new Error("Missing --bridge-sender or BRIDGE_SENDER_ADDRESS");
  }
  if (!targetContract) {
    throw new Error("Missing --target-contract or TARGET_CONTRACT");
  }
  if (!rpcUrl) {
    throw new Error("Missing --rpc-url or RPC_URL");
  }
  const rawCase = readInput(inputPath);
  const parsedCase = JSON.parse(rawCase);
  validateCasePayload(parsedCase);
  const canonicalCase = JSON.stringify(canonicalize(parsedCase));

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = privateKey
    ? new ethers.Wallet(privateKey, provider)
    : ethers.Wallet.createRandom().connect(provider);
  const bridgeSender = new ethers.Contract(
    bridgeSenderAddress,
    BRIDGE_SENDER_ABI,
    wallet,
  );

  const encodedMessage = ethers.AbiCoder.defaultAbiCoder().encode(
    ["string"],
    [canonicalCase],
  );
  const options = buildLayerZeroOptions(args.lzOptionsHex || process.env.LZ_OPTIONS_HEX, receiveGas);

  const network = await provider.getNetwork();
  const [nativeFee, lzTokenFee] = await bridgeSender.quoteSendToGenLayer(
    targetContract,
    encodedMessage,
    options,
  );

  console.log("Bridge send configuration:");
  console.log(`  Subject: ${parsedCase.subject_id}`);
  console.log(`  Source network: ${parsedCase.source.network}`);
  console.log(`  Window: ${parsedCase.window.start_block}-${parsedCase.window.end_block}`);
  console.log(`  Signer: ${wallet.address}`);
  console.log(`  RPC chain id: ${network.chainId.toString()}`);
  console.log(`  BridgeSender: ${bridgeSenderAddress}`);
  console.log(`  Target contract: ${targetContract}`);
  console.log(`  Encoded message bytes: ${ethers.getBytes(encodedMessage).length}`);
  console.log(`  LayerZero native fee: ${ethers.formatEther(nativeFee)} ETH`);
  console.log(`  LayerZero token fee: ${lzTokenFee.toString()}`);

  if (quoteOnly) {
    console.log("Quote only mode enabled; no transaction sent.");
    return;
  }

  if (!privateKey) {
    throw new Error("Missing --private-key or PRIVATE_KEY for live send");
  }

  const tx = await bridgeSender.sendToGenLayer(
    targetContract,
    encodedMessage,
    options,
    { value: nativeFee },
  );
  console.log(`Transaction hash: ${tx.hash}`);

  const receipt = await tx.wait();
  const event = findMessageSentEvent(bridgeSender, receipt.logs);

  if (event) {
    console.log(`Message ID: ${event.args.messageId}`);
    console.log(`Nonce: ${event.args.nonce.toString()}`);
  } else {
    console.log("MessageSentToGenLayer event not found in receipt logs.");
  }
}


function parseArgs(argv) {
  const args = {};

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }
    if (token === "--quote-only") {
      args.quoteOnly = true;
      continue;
    }
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }

    const key = token.slice(2);
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) {
      throw new Error(`Missing value for --${key}`);
    }

    args[toCamelCase(key)] = value;
    index += 1;
  }

  return args;
}


function toCamelCase(value) {
  return value.replace(/-([a-z])/g, (_match, char) => char.toUpperCase());
}


function readInput(inputPath) {
  if (inputPath === "-") {
    return fs.readFileSync(0, "utf8");
  }

  const resolvedPath = path.resolve(process.cwd(), inputPath);
  return fs.readFileSync(resolvedPath, "utf8");
}


function canonicalize(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  if (value && typeof value === "object") {
    const result = {};
    for (const key of Object.keys(value).sort()) {
      result[key] = canonicalize(value[key]);
    }
    return result;
  }
  return value;
}


function validateCasePayload(casePayload) {
  if (!casePayload || typeof casePayload !== "object" || Array.isArray(casePayload)) {
    throw new Error("Case payload must be a JSON object.");
  }

  const requiredTopLevel = ["subject_id", "source", "window", "features"];
  for (const key of requiredTopLevel) {
    if (!(key in casePayload)) {
      throw new Error(`Case payload missing required field: ${key}`);
    }
  }

  const requiredSource = ["network", "chain_id", "source_label"];
  for (const key of requiredSource) {
    if (!(key in casePayload.source)) {
      throw new Error(`Case payload source missing required field: ${key}`);
    }
  }

  const requiredWindow = ["start_block", "end_block", "start_block_hash", "end_block_hash"];
  for (const key of requiredWindow) {
    if (!(key in casePayload.window)) {
      throw new Error(`Case payload window missing required field: ${key}`);
    }
  }

  const requiredFeatures = [
    "tx_count",
    "failed_tx_count",
    "unique_counterparties",
    "unbounded_approval_count",
    "high_risk_flags",
  ];
  for (const key of requiredFeatures) {
    if (!(key in casePayload.features)) {
      throw new Error(`Case payload features missing required field: ${key}`);
    }
  }
}


function parsePositiveInteger(value, label) {
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`Invalid ${label}: ${value}`);
  }
  return parsed;
}


function buildLayerZeroOptions(providedOptionsHex, receiveGas) {
  if (providedOptionsHex) {
    return providedOptionsHex;
  }

  let Options;
  try {
    ({ Options } = require("@layerzerolabs/lz-v2-utilities"));
  } catch (_error) {
    throw new Error(
      "Missing @layerzerolabs/lz-v2-utilities. Provide --lz-options-hex or install the bridge boilerplate dependencies.",
    );
  }

  return Options.newOptions()
    .addExecutorLzReceiveOption(receiveGas, 0)
    .toHex();
}


function findMessageSentEvent(contract, logs) {
  for (const log of logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "MessageSentToGenLayer") {
        return parsed;
      }
    } catch (_error) {
      // Ignore unrelated logs.
    }
  }

  return null;
}


function printHelp() {
  console.log(`Usage:
  node scripts/send_base_case_via_bridge.cjs --input case.json [options]

Options:
  --input <path>            Path to the normalized Base evidence JSON. Use "-" for stdin.
  --bridge-sender <addr>    BridgeSender.sol address on Base.
  --target-contract <addr>  GenLayer target contract address.
  --rpc-url <url>           Base RPC URL.
  --private-key <hex>       Private key for the Base sender wallet.
  --receive-gas <int>       LayerZero receive gas limit. Default: 2000000.
  --lz-options-hex <hex>    Prebuilt LayerZero options hex. Overrides --receive-gas.
  --quote-only              Quote the bridge fee without sending a transaction.
  --help                    Show this message.

Environment fallbacks:
  CASE_FILE, BRIDGE_SENDER_ADDRESS, TARGET_CONTRACT, RPC_URL, BASE_RPC_URL,
  PRIVATE_KEY, LZ_RECEIVE_GAS, LZ_OPTIONS_HEX
`);
}


main();
