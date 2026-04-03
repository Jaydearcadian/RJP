"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { DEMO_SUBJECTS, LIVE_CONTRACTS } from "@/types/protocol";
import type { MirrorJudgmentResponse, HandshakePreviewResponse, LatestJudgmentResponse } from "@/lib/api";
import { getMirrorJudgment, getHandshakePreview, getLatestJudgment } from "@/lib/api";

export default function JudgmentPage() {
  const [subject, setSubject] = useState("");
  const [actionType, setActionType] = useState("trade");
  const [loading, setLoading] = useState(false);
  const [mirrorResult, setMirrorResult] = useState<MirrorJudgmentResponse | null>(null);
  const [handshakeResult, setHandshakeResult] = useState<HandshakePreviewResponse | null>(null);
  const [latestResult, setLatestResult] = useState<LatestJudgmentResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showRawJson, setShowRawJson] = useState(false);

  // Step 1: Read mirror first
  // Step 2: Read handshake second  
  // Step 3: Optionally read latest GenLayer judgment
  const handleFetchAll = async () => {
    if (!subject.trim()) {
      setError("Please enter a wallet address");
      return;
    }

    setLoading(true);
    setError(null);
    setMirrorResult(null);
    setHandshakeResult(null);
    setLatestResult(null);

    try {
      // 1. Read Base mirror first
      const mirror = await getMirrorJudgment(subject.trim());
      setMirrorResult(mirror);

      // 2. Read handshake preview second
      const handshake = await getHandshakePreview(subject.trim(), actionType);
      setHandshakeResult(handshake);

      // 3. Optionally read latest GenLayer judgment
      try {
        const latest = await getLatestJudgment(subject.trim());
        setLatestResult(latest);
      } catch {
        // Latest judgment read is optional, may fail if not available
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to fetch judgment";
      if (errorMessage.includes("TLS") || errorMessage.includes("RPC") || errorMessage.includes("network")) {
        setError(`Network/TLS/RPC Error: ${errorMessage}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  const getOutcomeColor = (outcome: string | undefined) => {
    if (!outcome) return "badge-info";
    const upper = outcome.toUpperCase();
    if (upper === "SAFE" || upper === "ALLOW") return "badge-success";
    if (upper === "CAUTION" || upper === "REFRESH") return "badge-warning";
    if (upper === "UNSAFE" || upper === "DENY") return "badge-danger";
    if (upper === "INSUFFICIENT_DATA" || upper === "NO_JUDGMENT" || upper === "STALE") return "badge-info";
    return "badge-info";
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Judgment Explorer</h1>
          <p className="text-xl text-[var(--foreground)]/60">
            Read Base mirror, handshake preview, and optional GenLayer judgment for a subject.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {[
            { label: "Base Mirror", address: LIVE_CONTRACTS.baseSepolia.mirror },
            { label: "Agent Demo", address: LIVE_CONTRACTS.baseSepolia.agentDemo },
            { label: "Direct Demo", address: LIVE_CONTRACTS.baseSepolia.directDemo },
          ].map((contract) => (
            <div key={contract.label} className="p-4 bg-[var(--card-bg)] border border-[var(--card-border)] rounded-lg">
              <div className="text-xs text-[var(--foreground)]/40 mb-1">{contract.label}</div>
              <div className="font-mono text-xs break-all">{contract.address}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="h-fit">
              <h2 className="text-xl font-bold mb-6">Query Subject</h2>

              <div className="space-y-6">
                {/* Subject */}
                <div>
                  <label className="block text-sm font-medium mb-2">Subject Address</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg font-mono text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
                  />
                </div>

                {/* Action Type */}
                <div>
                  <label className="block text-sm font-medium mb-2">Action Type (for handshake)</label>
                  <select
                    value={actionType}
                    onChange={(e) => setActionType(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value="trade">Trade</option>
                    <option value="approve">Approve</option>
                    <option value="transfer">Transfer</option>
                  </select>
                </div>

                {/* Demo Subjects */}
                <div>
                  <label className="block text-sm font-medium mb-2">Demo Subjects</label>
                  <div className="space-y-2">
                    {DEMO_SUBJECTS.map((demo) => (
                      <button
                        key={demo.subject}
                        onClick={() => setSubject(demo.subject)}
                        className="w-full text-left px-3 py-2 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm hover:border-[var(--accent)] transition-colors"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-medium">{demo.label}</span>
                          <span className="text-xs text-[var(--foreground)]/40 font-mono">
                            {demo.subject.slice(0, 10)}...
                          </span>
                        </div>
                        <div className="text-xs text-[var(--foreground)]/40 mt-1">
                          {demo.domainId} · {demo.actionType}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Error */}
                {error && (
                  <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Submit */}
                <button
                  onClick={handleFetchAll}
                  disabled={loading}
                  className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg disabled:opacity-50"
                >
                  {loading ? "Fetching..." : "Read Mirror + Handshake"}
                </button>
              </div>
            </Card>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            {/* Mirror Result */}
            {mirrorResult && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Base Mirror</h3>
                  <span className={`badge ${getOutcomeColor(mirrorResult.outcome)}`}>
                    {mirrorResult.outcome}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">subject_id</span>
                    <span className="font-mono text-xs break-all max-w-[200px] text-right">{mirrorResult.subject_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">domain_id</span>
                    <span className="font-mono text-xs">{mirrorResult.domain_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">case_id</span>
                    <span className="font-mono text-xs break-all max-w-[200px] text-right">{mirrorResult.case_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">claim_type</span>
                    <span className="font-mono text-xs">{mirrorResult.claim_type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">revision</span>
                    <span className="font-mono">{mirrorResult.revision}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">confidence_ppm</span>
                    <span className="font-mono">{(mirrorResult.confidence_ppm / 10000).toFixed(2)}%</span>
                  </div>
                </div>

                {mirrorResult.summary && (
                  <div className="mt-4 p-3 bg-[var(--background)] rounded-lg text-sm">
                    {mirrorResult.summary}
                  </div>
                )}
              </Card>
            )}

            {/* Handshake Result */}
            {handshakeResult && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Handshake Preview</h3>
                  <span className={`badge ${getOutcomeColor(handshakeResult.state)}`}>
                    {handshakeResult.state}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">state</span>
                    <span className="font-mono font-semibold">{handshakeResult.state}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">recommended_action</span>
                    <span className="font-mono font-semibold">{handshakeResult.recommended_action}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">allowed</span>
                    <span className={`badge ${handshakeResult.allowed ? 'badge-success' : 'badge-danger'}`}>
                      {handshakeResult.allowed ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">reason_code</span>
                    <span className="font-mono">{handshakeResult.reason_code}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">outcome</span>
                    <span className={`badge ${getOutcomeColor(handshakeResult.outcome)}`}>
                      {handshakeResult.outcome}
                    </span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-[var(--background)] rounded-lg text-sm">
                  <div className="text-[var(--foreground)]/40 mb-1">Reason</div>
                  {handshakeResult.reason}
                </div>
              </Card>
            )}

            {/* Latest Judgment (optional) */}
            {latestResult && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">GenLayer Judgment</h3>
                  <span className={`badge ${getOutcomeColor(latestResult.outcome)}`}>
                    {latestResult.outcome}
                  </span>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">risk_flags</span>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {latestResult.risk_flags?.map((flag, i) => (
                        <span key={i} className="badge badge-warning text-xs">{flag}</span>
                      ))}
                      {(!latestResult.risk_flags || latestResult.risk_flags.length === 0) && (
                        <span className="text-[var(--foreground)]/40">None</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">freshness_window</span>
                    <span className="font-mono">{latestResult.freshness_window_blocks} blocks</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">valid_until_block</span>
                    <span className="font-mono">{latestResult.valid_until_source_block}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-[var(--accent)] hover:underline mt-4"
                >
                  {showRawJson ? 'Hide' : 'Show'} Raw JSON
                </button>
                {showRawJson && (
                  <pre className="mt-2 p-3 bg-[var(--background)] rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(latestResult, null, 2)}
                  </pre>
                )}
              </Card>
            )}

            {/* Empty State */}
            {!mirrorResult && !handshakeResult && !latestResult && (
              <Card>
                <div className="text-center py-12 text-[var(--foreground)]/40">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-2.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <p>Enter a subject address to read mirror and handshake state</p>
                </div>
              </Card>
            )}
          </motion.div>
        </div>
      </div>
    </Layout>
  );
}
