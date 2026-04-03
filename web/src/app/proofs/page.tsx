"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";

interface ProofBundle {
  id: string;
  timestamp: string;
  subjects: Array<{ address: string; domain: string }>;
  contracts: {
    genlayer: string;
    baseMirror: string;
  };
}

const GITHUB_REPO_BASE =
  process.env.NEXT_PUBLIC_GITHUB_REPO_BASE ||
  "https://github.com/Jaydearcadian/RJP";
const GITHUB_BRANCH = process.env.NEXT_PUBLIC_GITHUB_BRANCH || "main";

function proofBundleTreeUrl(bundleId = ""): string {
  const suffix = bundleId ? `/${bundleId}` : "";
  return `${GITHUB_REPO_BASE}/tree/${GITHUB_BRANCH}/proof_bundles${suffix}`;
}

function proofBundleFileUrl(bundleId: string, filePath: string): string {
  const normalizedPath = filePath.replace(/^\/+/, "");
  return `${GITHUB_REPO_BASE}/blob/${GITHUB_BRANCH}/proof_bundles/${bundleId}/${normalizedPath}`;
}

export default function ProofsPage() {
  const [proofBundles, setProofBundles] = useState<ProofBundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const bundles: ProofBundle[] = [
      {
        id: "proof-bundle-20260401-165310Z",
        timestamp: "2026-04-01T16:53:10Z",
        subjects: [
          { address: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001", domain: "counterparty_trust.base_trade_v1" },
          { address: "0x3d1539c26aabce1b1aca28fb9d8fd70670391d5c", domain: "counterparty_trust.base_trade_v1" },
        ],
        contracts: {
          genlayer: "0x4a099B06141Ca3464318c28C4D2884B85d070D4f",
          baseMirror: "0x34EBfd4FcC379b14Cdd602485417a5C088228606",
        },
      },
      {
        id: "proof-bundle-20260401-165047Z",
        timestamp: "2026-04-01T16:50:47Z",
        subjects: [
          { address: "0x0000000000000000000000000000000000000b0b", domain: "protocol_safety.base_erc20_permission_v1" },
        ],
        contracts: {
          genlayer: "0x4a099B06141Ca3464318c28C4D2884B85d070D4f",
          baseMirror: "0x34EBfd4FcC379b14Cdd602485417a5C088228606",
        },
      },
      {
        id: "proof-bundle-20260330-060845Z",
        timestamp: "2026-03-30T06:08:45Z",
        subjects: [
          { address: "0xdeaddeaddeaddeaddeaddeaddeaddeaddead0001", domain: "counterparty_trust.base_trade_v1" },
        ],
        contracts: {
          genlayer: "0x4a099B06141Ca3464318c28C4D2884B85d070D4f",
          baseMirror: "0x34EBfd4FcC379b14Cdd602485417a5C088228606",
        },
      },
    ];
    setProofBundles(bundles);
    setLoading(false);
  }, []);

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Proof Viewer</h1>
          <p className="text-xl text-[var(--foreground)]/60">
            Explore frozen proof packages. Verify evidence artifacts, case objects, and judgment records.
          </p>
        </motion.div>

        {/* What is a Proof Bundle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <Card hover={false}>
            <h2 className="text-xl font-bold mb-4">What is a Proof Bundle?</h2>
            <div className="text-[var(--foreground)]/70 space-y-4">
              <p>
                A <strong>proof bundle</strong> is a frozen snapshot of the entire trust evaluation flow:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li>CaseObject with evidence manifest and Merkle root</li>
                <li>AssessmentArtifact with evaluation payload</li>
                <li>JudgmentObject with compact trust primitive</li>
                <li>On-chain receipts and transaction hashes</li>
                <li>Verification status against live contracts</li>
              </ul>
            </div>
          </Card>
        </motion.div>

        {/* Proof Bundles List */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">Available Proof Bundles</h2>
            <a
              href={proofBundleTreeUrl()}
              target="_blank"
              rel="noreferrer"
              className="text-sm text-[var(--accent)] hover:underline"
            >
              View all proof bundles on GitHub
            </a>
          </div>

          {loading ? (
            <Card>
              <div className="text-center py-8 text-[var(--foreground)]/40">Loading...</div>
            </Card>
          ) : (
            <div className="space-y-4">
              {proofBundles.map((bundle) => (
                <motion.div
                  key={bundle.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card>
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h3 className="font-bold font-mono">{bundle.id}</h3>
                        <div className="text-sm text-[var(--foreground)]/60">{bundle.timestamp}</div>
                      </div>
                      <div className="flex gap-2">
                        <span className="badge badge-success">Verified</span>
                        <a
                          href={proofBundleTreeUrl(bundle.id)}
                          target="_blank"
                          rel="noreferrer"
                          className="px-3 py-1 text-xs bg-[var(--accent)] text-white rounded hover:opacity-80 transition-opacity"
                        >
                          Open on GitHub
                        </a>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedBundle(selectedBundle === bundle.id ? null : bundle.id)}
                      className="text-sm text-[var(--accent)] hover:underline mb-4"
                    >
                      {selectedBundle === bundle.id ? "Hide details" : "Show details"}
                    </button>

                    {selectedBundle === bundle.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        className="space-y-4"
                      >
                        <div className="grid md:grid-cols-2 gap-4">
                          <div>
                            <div className="text-sm text-[var(--foreground)]/60 mb-2">Subjects</div>
                            <div className="space-y-2">
                              {bundle.subjects.map((subject, i) => (
                                <a
                                  key={i}
                                  href={`/judgment?subject=${subject.address}`}
                                  className="block font-mono text-xs bg-[var(--background)] rounded p-3 hover:border-[var(--accent)] border border-transparent transition-colors"
                                >
                                  <div className="truncate">{subject.address}</div>
                                  <div className="text-[var(--foreground)]/40 mt-1">{subject.domain}</div>
                                </a>
                              ))}
                            </div>
                          </div>
                          <div>
                            <div className="text-sm text-[var(--foreground)]/60 mb-2">Contracts</div>
                            <div className="space-y-2 font-mono text-xs">
                              <a
                                href={`https://sepolia.basescan.org/address/${bundle.contracts.baseMirror}`}
                                target="_blank"
                                className="block bg-[var(--background)] rounded p-3 hover:border-[var(--accent)] border border-transparent transition-colors"
                              >
                                <div className="text-[var(--foreground)]/40 mb-1">Base Mirror</div>
                                <div className="truncate">{bundle.contracts.baseMirror}</div>
                              </a>
                              <div className="bg-[var(--background)] rounded p-3">
                                <div className="text-[var(--foreground)]/40 mb-1">GenLayer RJP</div>
                                <div className="truncate">{bundle.contracts.genlayer}</div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-[var(--card-border)]">
                          <h4 className="font-medium mb-3">Bundle Contents</h4>
                          <div className="grid md:grid-cols-2 gap-2 font-mono text-sm">
                            <a
                              href={proofBundleFileUrl(bundle.id, "manifest.json")}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[var(--background)] rounded p-3 flex items-center justify-between hover:border-[var(--accent)] border border-transparent transition-colors"
                            >
                              <span>manifest.json</span>
                              <span className="text-green-400">View</span>
                            </a>
                            <a
                              href={proofBundleFileUrl(bundle.id, "cases/clean.case.json")}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[var(--background)] rounded p-3 flex items-center justify-between hover:border-[var(--accent)] border border-transparent transition-colors"
                            >
                              <span>cases/clean.case.json</span>
                              <span className="text-green-400">View</span>
                            </a>
                            <a
                              href={proofBundleFileUrl(bundle.id, "cases/risky.case.json")}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[var(--background)] rounded p-3 flex items-center justify-between hover:border-[var(--accent)] border border-transparent transition-colors"
                            >
                              <span>cases/risky.case.json</span>
                              <span className="text-green-400">View</span>
                            </a>
                            <a
                              href={proofBundleFileUrl(bundle.id, "genlayer/clean.judgment.json")}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[var(--background)] rounded p-3 flex items-center justify-between hover:border-[var(--accent)] border border-transparent transition-colors"
                            >
                              <span>genlayer/clean.judgment.json</span>
                              <span className="text-green-400">View</span>
                            </a>
                            <a
                              href={proofBundleFileUrl(bundle.id, "genlayer/risky.judgment.json")}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[var(--background)] rounded p-3 flex items-center justify-between hover:border-[var(--accent)] border border-transparent transition-colors"
                            >
                              <span>genlayer/risky.judgment.json</span>
                              <span className="text-green-400">View</span>
                            </a>
                            <a
                              href={proofBundleFileUrl(bundle.id, "verifications/clean.verify.json")}
                              target="_blank"
                              rel="noreferrer"
                              className="bg-[var(--background)] rounded p-3 flex items-center justify-between hover:border-[var(--accent)] border border-transparent transition-colors"
                            >
                              <span>verifications/clean.verify.json</span>
                              <span className="text-green-400">View</span>
                            </a>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Verification Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-12"
        >
          <Card hover={false}>
            <h2 className="text-xl font-bold mb-4">Verification Status</h2>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium mb-3">What is verified?</h3>
                <ul className="space-y-2 text-sm text-[var(--foreground)]/70">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Manifest root matches live contract storage
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Assessment hash matches judgment record
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Base mirror reflects GenLayer judgment state
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Handshake outcomes match expected behavior
                  </li>
                </ul>
              </div>
              <div>
                <h3 className="font-medium mb-3">How to verify?</h3>
                <ol className="space-y-2 text-sm text-[var(--foreground)]/70 list-decimal list-inside">
                  <li>Open the proof bundle directory</li>
                  <li>Run <code className="bg-[var(--background)] px-1 rounded">python3 scripts/verify_base_case.py</code></li>
                  <li>Compare manifest root with on-chain <code className="bg-[var(--background)] px-1 rounded">case_hash</code></li>
                  <li>Read mirrored judgment from Base mirror contract</li>
                  <li>Run handshake preview and compare with bundle outcomes</li>
                </ol>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
