#!/usr/bin/env npx tsx

import { readFileSync } from "node:fs";
import path from "node:path";

import { keccak256, recoverMessageAddress, stringToHex } from "viem";

import { canonicalizeJson } from "./lib/canonical_json.js";

const reportFile = process.env.REPORT_FILE || process.argv[2];

if (!reportFile) {
  throw new Error("Missing REPORT_FILE env var or argv[2]");
}

type SignedReport = {
  report: Record<string, unknown>;
  attestation?: {
    scheme?: string | null;
    report_hash?: string | null;
    signer?: string | null;
    signature?: string | null;
    signed_at?: string | null;
  };
};

async function main() {
  const payload = JSON.parse(
    readFileSync(path.resolve(reportFile), "utf8"),
  ) as SignedReport;

  if (!payload.report) {
    throw new Error("Signed report is missing the report field");
  }

  const attestation = payload.attestation ?? {};
  const canonicalReport = canonicalizeJson(payload.report);
  const computedHash = keccak256(stringToHex(canonicalReport));

  let recoveredSigner: string | null = null;
  let signatureValid = false;
  if (attestation.signature) {
    recoveredSigner = await recoverMessageAddress({
      message: canonicalReport,
      signature: attestation.signature as `0x${string}`,
    });
    signatureValid =
      !!attestation.signer &&
      recoveredSigner.toLowerCase() === String(attestation.signer).toLowerCase();
  }

  console.log(
    JSON.stringify(
      {
        report_hash_matches: computedHash === attestation.report_hash,
        computed_report_hash: computedHash,
        attested_report_hash: attestation.report_hash ?? null,
        signer_matches: signatureValid,
        attested_signer: attestation.signer ?? null,
        recovered_signer: recoveredSigner,
        has_signature: Boolean(attestation.signature),
        scheme: attestation.scheme ?? null,
        signed_at: attestation.signed_at ?? null,
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
