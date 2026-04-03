import { readFileSync } from "fs";
import path from "path";
import { GenLayerClient, TransactionHash, TransactionStatus } from "genlayer-js/types";

export default async function main(client: GenLayerClient<any>) {
  const filePath = path.resolve(process.cwd(), "contracts/reasoned_judgment_pass.py");

  try {
    const contractCode = new Uint8Array(readFileSync(filePath));

    await client.initializeConsensusSmartContract();

    const deployTransaction = await client.deployContract({
      code: contractCode,
      args: [],
    });

    const receipt = await client.waitForTransactionReceipt({
      hash: deployTransaction as TransactionHash,
      status: TransactionStatus.ACCEPTED,
      retries: 200,
    });

    if (receipt.consensus_data?.leader_receipt[0]?.execution_result !== "SUCCESS") {
      throw new Error(`Deployment failed. Receipt: ${JSON.stringify(receipt)}`);
    }

    console.log("ReasonedJudgmentPass deployed.", {
      transactionHash: deployTransaction,
      contractAddress: receipt.data?.contract_address,
    });
  } catch (error) {
    throw new Error(`Error during deployment: ${error}`);
  }
}
