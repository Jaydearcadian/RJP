#!/usr/bin/env node

const { ethers } = require("ethers");
const { createAccount, createClient } = require("genlayer-js");
const { studionet } = require("genlayer-js/chains");

const privateKey = process.env.PRIVATE_KEY;
const genlayerRpcUrl =
  process.env.GENLAYER_RPC_URL || "https://studio.genlayer.com/api";
const zkSyncRpcUrl =
  process.env.ZKSYNC_RPC_URL || "https://sepolia.era.zksync.dev";
const bridgeReceiverIcAddress = process.env.BRIDGE_RECEIVER_IC_ADDRESS;
const zkSyncBridgeReceiverAddress = process.env.ZKSYNC_BRIDGE_RECEIVER_ADDRESS;
const maxMessages = Number.parseInt(process.env.MAX_MESSAGES || "1", 10);

if (!privateKey) {
  throw new Error("Missing PRIVATE_KEY env var");
}
if (!bridgeReceiverIcAddress) {
  throw new Error("Missing BRIDGE_RECEIVER_IC_ADDRESS env var");
}
if (!zkSyncBridgeReceiverAddress) {
  throw new Error("Missing ZKSYNC_BRIDGE_RECEIVER_ADDRESS env var");
}

const normalizedPrivateKey = privateKey.startsWith("0x")
  ? privateKey
  : `0x${privateKey}`;

const account = createAccount(normalizedPrivateKey);
const zkSyncProvider = new ethers.JsonRpcProvider(zkSyncRpcUrl);
const zkSyncWallet = new ethers.Wallet(normalizedPrivateKey, zkSyncProvider);
const genlayerClient = createClient({
  chain: {
    ...studionet,
    rpcUrls: {
      default: { http: [genlayerRpcUrl] },
    },
  },
  account,
});

const BRIDGE_RECEIVER_ABI = [
  "function getPendingGenLayerMessages() external view returns (bytes32[] messageIds, tuple(bytes32 messageId, uint32 srcChainId, address srcSender, address targetContract, bytes data, bool relayed)[] messages)",
  "function markMessageRelayed(bytes32 messageId) external",
];

async function main() {
  const receiver = new ethers.Contract(
    zkSyncBridgeReceiverAddress,
    BRIDGE_RECEIVER_ABI,
    zkSyncWallet,
  );

  console.log("Relaying pending zkSync -> GenLayer messages");
  console.log(`  zkSync receiver: ${zkSyncBridgeReceiverAddress}`);
  console.log(`  GenLayer BridgeReceiver: ${bridgeReceiverIcAddress}`);
  console.log(`  Relayer wallet: ${account.address}`);

  const [messageIds, messages] = await receiver.getPendingGenLayerMessages();
  console.log(`  Pending messages: ${messageIds.length}`);

  const count = Math.min(messages.length, maxMessages);
  for (let index = 0; index < count; index += 1) {
    const message = messages[index];
    const messageId = message.messageId;

    console.log(`\nProcessing ${messageId}`);
    console.log(`  Source chain: ${message.srcChainId}`);
    console.log(`  Source sender: ${message.srcSender}`);
    console.log(`  Target contract: ${message.targetContract}`);

    const dataBytes = ethers.getBytes(message.data);
    const txHash = await genlayerClient.writeContract({
      address: bridgeReceiverIcAddress,
      functionName: "receive_message",
      args: [
        messageId,
        Number(message.srcChainId),
        message.srcSender,
        message.targetContract,
        dataBytes,
      ],
    });

    console.log(`  GenLayer TX: ${txHash}`);

    await genlayerClient.waitForTransactionReceipt({
      hash: txHash,
      status: "ACCEPTED",
      retries: 30,
    });

    const markTx = await receiver.markMessageRelayed(messageId);
    console.log(`  zkSync markRelayed TX: ${markTx.hash}`);
    await markTx.wait();
    console.log("  Done");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
