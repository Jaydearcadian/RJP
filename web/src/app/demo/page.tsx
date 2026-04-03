"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { DEMO_SUBJECTS, DOMAIN_OPTIONS, LIVE_CONTRACTS } from "@/types/protocol";
import type { HandshakePreviewResponse } from "@/lib/api";
import { getHandshakePreview } from "@/lib/api";

export default function DemoPage() {
  const [selectedSubject, setSelectedSubject] = useState(DEMO_SUBJECTS[0]);
  const [actionType, setActionType] = useState("trade");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<HandshakePreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRunDemo = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await getHandshakePreview(selectedSubject.subject, selectedSubject.actionType);
      setResult(res);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to run demo");
    } finally {
      setLoading(false);
    }
  };

  const getStateColor = (state: string) => {
    const upper = state.toUpperCase();
    if (upper === "SAFE" || upper === "ALLOW") return "badge-success";
    if (upper === "CAUTION" || upper === "REFRESH") return "badge-warning";
    if (upper === "UNSAFE" || upper === "DENY") return "badge-danger";
    if (upper === "INSUFFICIENT_DATA" || upper === "NO_JUDGMENT") return "badge-info";
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
          <h1 className="text-4xl font-bold mb-4">Demo Lab</h1>
          <p className="text-xl text-[var(--foreground)]/60">
            Run live trust evaluation on pinned benchmark subjects. Compare clean, risky, and safe paths.
          </p>
        </motion.div>

        {/* Live Contracts */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8"
        >
          <Card hover={false}>
            <h2 className="text-lg font-bold mb-4">Live Contracts</h2>
            <div className="grid md:grid-cols-3 gap-4 font-mono text-xs">
              <div className="bg-[var(--background)] rounded p-3">
                <div className="text-[var(--foreground)]/40 mb-1">GenLayer RJP</div>
                <div>{LIVE_CONTRACTS.genlayer.rjp}</div>
              </div>
              <div className="bg-[var(--background)] rounded p-3">
                <div className="text-[var(--foreground)]/40 mb-1">Base Mirror</div>
                <div>{LIVE_CONTRACTS.baseSepolia.mirror}</div>
              </div>
              <div className="bg-[var(--background)] rounded p-3">
                <div className="text-[var(--foreground)]/40 mb-1">Agent Demo</div>
                <div>{LIVE_CONTRACTS.baseSepolia.agentDemo}</div>
              </div>
            </div>
          </Card>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Subject Selection */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <Card className="h-fit">
              <h2 className="text-xl font-bold mb-6">Select Demo Subject</h2>

              <div className="space-y-4">
                {DEMO_SUBJECTS.map((subject) => (
                  <button
                    key={subject.subject}
                    onClick={() => {
                      setSelectedSubject(subject);
                      setResult(null);
                    }}
                    className={`w-full text-left p-4 rounded-lg border transition-all ${
                      selectedSubject.subject === subject.subject
                        ? "border-[var(--accent)] bg-[var(--accent)]/10"
                        : "border-[var(--card-border)] hover:border-[var(--foreground)]/20"
                    }`}
                  >
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-semibold">{subject.label}</span>
                      <span className={`badge ${
                        subject.subject === DEMO_SUBJECTS[0].subject
                          ? 'badge-success'
                          : subject.subject === DEMO_SUBJECTS[1].subject
                          ? 'badge-danger'
                          : 'badge-info'
                      }`}>
                        {subject.subject === DEMO_SUBJECTS[0].subject
                          ? 'SAFE'
                          : subject.subject === DEMO_SUBJECTS[1].subject
                          ? 'UNSAFE'
                          : 'TEST'}
                      </span>
                    </div>
                    <div className="font-mono text-xs text-[var(--foreground)]/60 mb-2 break-all">
                      {subject.subject}
                    </div>
                    <div className="text-sm text-[var(--foreground)]/60">
                      <span className="font-medium">{DOMAIN_OPTIONS[subject.domainId]?.label}</span>
                      <span className="mx-2">•</span>
                      <span>Action: {subject.actionType}</span>
                    </div>
                    <p className="mt-2 text-xs text-[var(--foreground)]/40">{subject.note}</p>
                  </button>
                ))}
              </div>

              {/* Action Type */}
              <div className="mt-6">
                <label className="block text-sm font-medium mb-2">Action Type</label>
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

              {/* Error */}
              {error && (
                <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                  {error}
                </div>
              )}

              {/* Run Button */}
              <button
                onClick={handleRunDemo}
                disabled={loading}
                className="mt-6 w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg disabled:opacity-50"
              >
                {loading ? "Running..." : "Run Handshake Preview"}
              </button>
            </Card>
          </motion.div>

          {/* Results */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="h-fit">
              <h2 className="text-xl font-bold mb-6">Handshake Result</h2>

              {result ? (
                <div className="space-y-6">
                  {/* State */}
                  <div className="flex items-center justify-between p-4 bg-[var(--background)] rounded-lg">
                    <span className="font-medium">State</span>
                    <span className={`text-2xl font-bold ${getStateColor(result.state).replace('badge-', 'text-')}`}>
                      {result.state}
                    </span>
                  </div>

                  {/* Decision */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-[var(--background)] rounded-lg">
                      <div className="text-sm text-[var(--foreground)]/60 mb-1">Recommended Action</div>
                      <div className={`text-xl font-bold ${getStateColor(result.recommended_action).replace('badge-', 'text-')}`}>
                        {result.recommended_action}
                      </div>
                    </div>
                    <div className="p-4 bg-[var(--background)] rounded-lg">
                      <div className="text-sm text-[var(--foreground)]/60 mb-1">Allowed</div>
                      <div className={`text-xl font-bold ${result.allowed ? 'text-green-400' : 'text-red-400'}`}>
                        {result.allowed ? 'Yes' : 'No'}
                      </div>
                    </div>
                  </div>

                  {/* Reason Code */}
                  <div>
                    <div className="text-sm text-[var(--foreground)]/60 mb-1">Reason Code</div>
                    <div className="font-mono text-sm bg-[var(--background)] rounded p-2">
                      {result.reason_code}
                    </div>
                  </div>

                  {/* Reason */}
                  <div>
                    <div className="text-sm text-[var(--foreground)]/60 mb-1">Reason</div>
                    <div className="text-sm bg-[var(--background)] rounded p-2">
                      {result.reason}
                    </div>
                  </div>

                  {/* Summary */}
                  {result.summary && (
                    <div>
                      <div className="text-sm text-[var(--foreground)]/60 mb-1">Summary</div>
                      <div className="text-sm bg-[var(--background)] rounded p-2">
                        {result.summary}
                      </div>
                    </div>
                  )}

                  {/* Domain Interpretation */}
                  {result.domain_interpretation && (
                    <div className="border-t border-[var(--card-border)] pt-4">
                      <div className="text-sm font-medium mb-2">Domain Interpretation</div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-[var(--foreground)]/60">Question</span>
                          <span className="text-right ml-4">
                            {(result.domain_interpretation as Record<string, unknown>).consumer_question as string}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12 text-[var(--foreground)]/40">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  <p>Select a demo subject and run the handshake preview</p>
                </div>
              )}
            </Card>
          </motion.div>
        </div>

        {/* Benchmark Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-8"
        >
          <Card hover={false}>
            <h2 className="text-lg font-bold mb-4">Benchmark Results</h2>
            <div className="grid md:grid-cols-4 gap-4 text-center">
              <div className="bg-[var(--background)] rounded p-4">
                <div className="text-2xl font-bold gradient-text">6</div>
                <div className="text-sm text-[var(--foreground)]/60">Logical Agents</div>
              </div>
              <div className="bg-[var(--background)] rounded p-4">
                <div className="text-2xl font-bold gradient-text">12</div>
                <div className="text-sm text-[var(--foreground)]/60">Runs</div>
              </div>
              <div className="bg-[var(--background)] rounded p-4">
                <div className="text-2xl font-bold gradient-text">~344ms</div>
                <div className="text-sm text-[var(--foreground)]/60">Avg Read Latency</div>
              </div>
              <div className="bg-[var(--background)] rounded p-4">
                <div className="text-2xl font-bold gradient-text">~1479ms</div>
                <div className="text-sm text-[var(--foreground)]/60">Avg Settlement</div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
