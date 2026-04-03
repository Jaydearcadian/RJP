"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Layout } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { DOMAIN_OPTIONS, LIVE_CONTRACTS } from "@/types/protocol";
import type { BuildCaseRequest, EvidenceSummaryResponse, BuildCaseResponse, BuildAndEvaluateResponse, HealthResponse, PublishMirrorResponse } from "@/lib/api";
import { buildCase, getEvidenceSummary, getCurrentBlock, getHealth, buildAndEvaluate, publishToBaseMirror } from "@/lib/api";

// Local storage keys
const STORAGE_KEYS = {
  summary: "rjp_last_summary",
  caseObject: "rjp_last_case",
  judgment: "rjp_last_judgment",
};

// Log entry type
interface LogEntry {
  timestamp: string;
  level: 'info' | 'error' | 'success';
  step: string;
  message: string;
  details?: unknown;
}

export default function BuilderPage() {
  // Form state
  const [subject, setSubject] = useState("");
  const [network, setNetwork] = useState("base-sepolia");
  const [domainId, setDomainId] = useState("counterparty_trust.base_trade_v1");
  const [windowMode, setWindowMode] = useState<"relative" | "custom">("relative");
  const [relativeSize, setRelativeSize] = useState(1000);
  const [startBlock, setStartBlock] = useState<number>(0);
  const [endBlock, setEndBlock] = useState<number>(0);

  // API state
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [currentBlock, setCurrentBlock] = useState<number | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Result state (persisted)
  const [summary, setSummary] = useState<EvidenceSummaryResponse | null>(null);
  const [caseObject, setCaseObject] = useState<BuildCaseResponse | null>(null);
  const [judgment, setJudgment] = useState<BuildAndEvaluateResponse | null>(null);
  const [publishResult, setPublishResult] = useState<PublishMirrorResponse | null>(null);

  // UI state
  const [showRawJson, setShowRawJson] = useState(false);
  const [showLogs, setShowLogs] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Helper to add log entries
  const addLog = (level: LogEntry['level'], step: string, message: string, details?: unknown) => {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      step,
      message,
      details,
    };
    setLogs(prev => [...prev.slice(-50), entry]); // Keep last 50 entries
  };

  // Load persisted state on mount
  useEffect(() => {
    const savedSummary = localStorage.getItem(STORAGE_KEYS.summary);
    const savedCase = localStorage.getItem(STORAGE_KEYS.caseObject);
    const savedJudgment = localStorage.getItem(STORAGE_KEYS.judgment);

    if (savedSummary) {
      try { setSummary(JSON.parse(savedSummary)); } catch {}
    }
    if (savedCase) {
      try { setCaseObject(JSON.parse(savedCase)); } catch {}
    }
    if (savedJudgment) {
      try { setJudgment(JSON.parse(savedJudgment)); } catch {}
    }
  }, []);

  // Update relative size when domain changes
  useEffect(() => {
    const domain = DOMAIN_OPTIONS[domainId];
    if (domain) {
      setRelativeSize(domain.defaultRelativeSize);
    }
  }, [domainId]);

  // Persist state
  useEffect(() => {
    if (summary) {
      localStorage.setItem(STORAGE_KEYS.summary, JSON.stringify(summary));
    }
  }, [summary]);

  useEffect(() => {
    if (caseObject) {
      localStorage.setItem(STORAGE_KEYS.caseObject, JSON.stringify(caseObject));
    }
  }, [caseObject]);

  useEffect(() => {
    if (judgment) {
      localStorage.setItem(STORAGE_KEYS.judgment, JSON.stringify(judgment));
    }
  }, [judgment]);

  // Step 1: Fetch health and current block
  const handleFetchBlock = async () => {
    setLoading("fetch");
    setError(null);
    addLog('info', 'fetch', 'Fetching health and current block...');

    try {
      // Fetch health first
      const healthRes = await getHealth();
      setHealth(healthRes);
      addLog('success', 'fetch', `Health check passed, submit_enabled=${healthRes.submit_enabled}`);

      // Then fetch current block
      const blockRes = await getCurrentBlock(network);
      setCurrentBlock(blockRes.current_block);
      addLog('success', 'fetch', `Current block: ${blockRes.current_block}`);

      // Suggest window based on domain
      const domain = DOMAIN_OPTIONS[domainId];
      const end = blockRes.current_block;
      const start = Math.max(end - (domain?.defaultRelativeSize || 1000) + 1, 0);
      setEndBlock(end);
      setStartBlock(start);
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to fetch block";
      addLog('error', 'fetch', errorMessage, e);
      if (errorMessage.includes("TLS") || errorMessage.includes("network")) {
        setError(`Network/TLS Error: ${errorMessage}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(null);
    }
  };

  // Step 2: Build Evidence Summary
  const handleBuildSummary = async () => {
    if (!subject.trim()) {
      setError("Please enter a wallet address");
      addLog('error', 'summary', 'Missing subject address');
      return;
    }

    // Clear ALL previous results before starting new build
    setLoading("summary");
    setError(null);
    setSummary(null);
    setCaseObject(null);
    setJudgment(null);
    addLog('info', 'summary', `Building evidence summary for ${subject.trim()}, domain=${domainId}, blocks=${relativeSize}`);

    try {
      const request: BuildCaseRequest = {
        subject: subject.trim(),
        network,
        domain_id: domainId,
        window_mode: windowMode,
        current_block: currentBlock || undefined,
        relative_size: relativeSize,
        start_block: windowMode === "custom" ? startBlock : undefined,
        end_block: windowMode === "custom" ? endBlock : undefined,
        block_batch_size: 10,
        receipt_batch_size: 10,
        timeout: 120,
      };
      const res = await getEvidenceSummary(request);
      setSummary(res);
      addLog('success', 'summary', `Evidence summary built successfully`, { case_id: res.case?.case_id, verification: res.verification?.ok });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to build evidence summary";
      addLog('error', 'summary', errorMessage, e);
      if (errorMessage.includes("TLS") || errorMessage.includes("RPC")) {
        setError(`RPC/TLS Error: ${errorMessage}`);
      } else {
        setError(errorMessage);
      }
    } finally {
      setLoading(null);
    }
  };

  // Step 3: Build CaseObject
  const handleBuildCase = async () => {
    if (!subject.trim()) {
      setError("Please enter a wallet address");
      addLog('error', 'case', 'Missing subject address');
      return;
    }

    // Clear ALL previous results before starting new build
    setLoading("case");
    setError(null);
    setSummary(null);
    setCaseObject(null);
    setJudgment(null);
    addLog('info', 'case', `Building CaseObject for ${subject.trim()}, domain=${domainId}`);

    try {
      const request: BuildCaseRequest = {
        subject: subject.trim(),
        network,
        domain_id: domainId,
        window_mode: windowMode,
        current_block: currentBlock || undefined,
        relative_size: relativeSize,
        start_block: windowMode === "custom" ? startBlock : undefined,
        end_block: windowMode === "custom" ? endBlock : undefined,
        block_batch_size: 10,
        receipt_batch_size: 10,
        timeout: 120,
      };
      const res = await buildCase(request);
      setCaseObject(res);
      addLog('success', 'case', `CaseObject built successfully`, { case_id: res.case_payload?.case_id, verification: res.verification?.ok });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to build case object";
      addLog('error', 'case', errorMessage, e);
      setError(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  // Step 4: Build and Evaluate Judgment (only if submit_enabled)
  const handleBuildJudgment = async () => {
    if (!health?.submit_enabled) {
      setError("Live evaluation is disabled: submit_enabled is false. Check your environment configuration (PRIVATE_KEY, GENLAYER_RPC_URL, RJP_CONTRACT_ADDRESS).");
      addLog('error', 'judgment', 'Submit not enabled - missing environment credentials');
      return;
    }

    if (!subject.trim()) {
      setError("Please enter a wallet address");
      addLog('error', 'judgment', 'Missing subject address');
      return;
    }

    // Clear ALL previous results before starting new build
    setLoading("judgment");
    setError(null);
    setSummary(null);
    setCaseObject(null);
    setJudgment(null);
    addLog('info', 'judgment', `Submitting to GenLayer for ${subject.trim()}, domain=${domainId}`);

    try {
      const request: BuildCaseRequest = {
        subject: subject.trim(),
        network,
        domain_id: domainId,
        window_mode: windowMode,
        current_block: currentBlock || undefined,
        relative_size: relativeSize,
        start_block: windowMode === "custom" ? startBlock : undefined,
        end_block: windowMode === "custom" ? endBlock : undefined,
        block_batch_size: 10,
        receipt_batch_size: 10,
        timeout: 120,
      };
      const res = await buildAndEvaluate(request);
      setJudgment(res);
      addLog('success', 'judgment', `Judgment evaluated successfully`, { outcome: res.evaluation?.result?.judgment?.outcome, submit_tx: res.evaluation?.result?.submit_tx });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to build and evaluate judgment";
      addLog('error', 'judgment', errorMessage, e);
      setError(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  // Step 5: Publish judgment to Base mirror
  const handlePublishMirror = async () => {
    if (!judgment?.case_payload || !judgment?.evaluation?.result?.judgment) {
      setError("No judgment to publish. Build and evaluate a judgment first.");
      addLog('error', 'publish', 'No judgment available to publish');
      return;
    }

    setLoading("publish");
    setError(null);
    setPublishResult(null);
    addLog('info', 'publish', 'Publishing judgment to Base mirror...');

    try {
      const res = await publishToBaseMirror({
        case_payload: judgment.case_payload,
        judgment: judgment.evaluation.result.judgment,
      });
      setPublishResult(res);
      if (res.ok) {
        addLog('success', 'publish', 'Judgment published to Base mirror', res.result);
      } else {
        addLog('error', 'publish', res.error || 'Publish failed');
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Failed to publish to mirror";
      addLog('error', 'publish', errorMessage, e);
      setError(errorMessage);
    } finally {
      setLoading(null);
    }
  };

  // Reset outputs but keep config
  const handleReset = () => {
    setSummary(null);
    setCaseObject(null);
    setJudgment(null);
    setPublishResult(null);
    setError(null);
    setLogs([]);
    localStorage.removeItem(STORAGE_KEYS.summary);
    localStorage.removeItem(STORAGE_KEYS.caseObject);
    localStorage.removeItem(STORAGE_KEYS.judgment);
  };

  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Evidence Builder</h1>
          <p className="text-xl text-[var(--foreground)]/60">
            Build reproducible evidence artifacts and live judgment objects.
          </p>
        </motion.div>

        {/* Live Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <Card hover={false}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <div>
                  <div className="text-xs text-[var(--foreground)]/40 mb-1">API Status</div>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${health?.ok ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="text-sm font-medium">{health?.ok ? 'Connected' : 'Not Connected'}</span>
                  </div>
                </div>
                <div>
                  <div className="text-xs text-[var(--foreground)]/40 mb-1">Submit Enabled</div>
                  <span className={`badge ${health?.submit_enabled ? 'badge-success' : 'badge-danger'}`}>
                    {health?.submit_enabled ? 'Yes' : 'No'}
                  </span>
                </div>
                <div>
                  <div className="text-xs text-[var(--foreground)]/40 mb-1">Current Block</div>
                  <span className="font-mono text-sm">
                    {currentBlock ? currentBlock.toLocaleString() : 'Not fetched'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleFetchBlock}
                disabled={loading === "fetch"}
                className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg text-sm font-medium disabled:opacity-50"
              >
                {loading === "fetch" ? "Fetching..." : "Refresh Status"}
              </button>
            </div>
          </Card>

          {/* Error Logs Dropdown */}
          {logs.length > 0 && (
            <Card hover={false} className="mt-4">
              <button
                onClick={() => setShowLogs(!showLogs)}
                className="flex items-center justify-between w-full text-left"
              >
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <span className="text-sm font-medium">Build Logs ({logs.length})</span>
                  {logs.some(l => l.level === 'error') && (
                    <span className="badge badge-danger text-xs">{logs.filter(l => l.level === 'error').length} errors</span>
                  )}
                </div>
                <svg className={`w-4 h-4 transition-transform ${showLogs ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {showLogs && (
                <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
                  {logs.slice().reverse().map((log, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-lg text-xs font-mono ${
                        log.level === 'error' ? 'bg-red-500/10 border border-red-500/20' :
                        log.level === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                        'bg-[var(--background)] border border-[var(--card-border)]'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`badge ${log.level === 'error' ? 'badge-danger' : log.level === 'success' ? 'badge-success' : 'badge-info'} text-xs`}>
                          {log.level.toUpperCase()}
                        </span>
                        <span className="text-[var(--foreground)]/60">{log.step}</span>
                        <span className="text-[var(--foreground)]/40 ml-auto">{log.timestamp.split('T')[1]?.split('.')[0]}</span>
                      </div>
                      <div className={log.level === 'error' ? 'text-red-400' : 'text-[var(--foreground)]'}>
                        {log.message}
                      </div>
                      {log.details ? (
                        <pre className="mt-1 text-[var(--foreground)]/60 overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      ) : null}
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Form */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="h-fit">
              <h2 className="text-xl font-bold mb-6">Build Parameters</h2>

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

                {/* Network */}
                <div>
                  <label className="block text-sm font-medium mb-2">Network</label>
                  <select
                    value={network}
                    onChange={(e) => setNetwork(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    <option value="base-sepolia">Base Sepolia</option>
                    <option value="base-mainnet">Base Mainnet</option>
                  </select>
                </div>

                {/* Domain */}
                <div>
                  <label className="block text-sm font-medium mb-2">Domain</label>
                  <select
                    value={domainId}
                    onChange={(e) => setDomainId(e.target.value)}
                    className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
                  >
                    {Object.entries(DOMAIN_OPTIONS).map(([id, domain]) => (
                      <option key={id} value={id}>
                        {domain.label} ({domain.actionType})
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-xs text-[var(--foreground)]/40">
                    {DOMAIN_OPTIONS[domainId]?.recommendedWindowLabel}
                  </p>
                </div>

                {/* Window Mode */}
                <div>
                  <label className="block text-sm font-medium mb-2">Window Mode</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setWindowMode("relative")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        windowMode === "relative"
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--background)] border border-[var(--card-border)]"
                      }`}
                    >
                      Relative
                    </button>
                    <button
                      onClick={() => setWindowMode("custom")}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        windowMode === "custom"
                          ? "bg-[var(--accent)] text-white"
                          : "bg-[var(--background)] border border-[var(--card-border)]"
                      }`}
                    >
                      Custom
                    </button>
                  </div>
                </div>

                {/* Window Size */}
                {windowMode === "relative" ? (
                  <div>
                    <label className="block text-sm font-medium mb-2">Relative Size (blocks)</label>
                    <input
                      type="number"
                      value={relativeSize}
                      onChange={(e) => setRelativeSize(parseInt(e.target.value) || 1000)}
                      className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg font-mono text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
                    />
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Start Block</label>
                      <input
                        type="number"
                        value={startBlock}
                        onChange={(e) => setStartBlock(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg font-mono text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">End Block</label>
                      <input
                        type="number"
                        value={endBlock}
                        onChange={(e) => setEndBlock(parseInt(e.target.value) || 0)}
                        className="w-full px-4 py-3 bg-[var(--background)] border border-[var(--card-border)] rounded-lg font-mono text-sm focus:border-[var(--accent)] focus:outline-none transition-colors"
                      />
                    </div>
                  </div>
                )}

                {/* Suggested Window */}
                {currentBlock && (
                  <div className="p-4 bg-[var(--background)] rounded-lg">
                    <div className="text-xs text-[var(--foreground)]/40 mb-2">Suggested Window</div>
                    <div className="font-mono text-sm">
                      {startBlock.toLocaleString()} → {endBlock.toLocaleString()}
                      <span className="text-[var(--foreground)]/40 ml-2">
                        ({(endBlock - startBlock + 1).toLocaleString()} blocks)
                      </span>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-lg text-sm text-red-400">
                    {error}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                  <button
                    onClick={handleBuildSummary}
                    disabled={loading !== null || !subject.trim()}
                    className="w-full px-6 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] font-semibold rounded-xl hover:border-[var(--accent)] transition-all disabled:opacity-50"
                  >
                    {loading === "summary" ? "Building..." : "1. Build Evidence Summary"}
                  </button>

                  <button
                    onClick={handleBuildCase}
                    disabled={loading !== null || !subject.trim() || !summary}
                    className="w-full px-6 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] font-semibold rounded-xl hover:border-[var(--accent)] transition-all disabled:opacity-50"
                  >
                    {loading === "case" ? "Building..." : "2. Build CaseObject"}
                  </button>

                  <button
                    onClick={handleBuildJudgment}
                    disabled={loading !== null || !subject.trim() || !caseObject || !health?.submit_enabled}
                    className="w-full px-6 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg disabled:opacity-50"
                  >
                    {loading === "judgment" ? "Evaluating..." : "3. Build & Evaluate JudgmentObject"}
                    {!health?.submit_enabled && <span className="block text-xs opacity-70">(Disabled: submit_enabled=false)</span>}
                  </button>

                  <button
                    onClick={handlePublishMirror}
                    disabled={loading !== null || !judgment?.evaluation?.result?.judgment}
                    className="w-full px-6 py-4 bg-gradient-to-r from-green-500 to-teal-500 text-white font-semibold rounded-xl hover:from-green-600 hover:to-teal-600 transition-all shadow-lg disabled:opacity-50"
                  >
                    {loading === "publish" ? "Publishing..." : "4. Publish to Base Mirror"}
                    {!judgment?.evaluation?.result?.judgment && <span className="block text-xs opacity-70">(Build judgment first)</span>}
                  </button>

                  <button
                    onClick={handleReset}
                    className="w-full px-4 py-2 text-sm text-[var(--foreground)]/60 hover:text-[var(--foreground)] transition-colors"
                  >
                    Reset Outputs
                  </button>
                </div>
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
            {/* Loading indicator for Evidence Summary */}
            {loading === "summary" && (
              <Card>
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-full max-w-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Building Evidence Summary</span>
                      <span className="text-xs text-[var(--foreground)]/40">This may take a while...</span>
                    </div>
                    <div className="w-full bg-[var(--background)] rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full animate-pulse" style={{ width: '60%' }} />
                    </div>
                    <p className="text-xs text-[var(--foreground)]/40 mt-3 text-center">
                      Fetching blocks in batches, extracting transactions, building evidence manifest...
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {/* Evidence Summary */}
            {summary && loading !== "summary" && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Evidence Summary</h3>
                  <span className={`badge ${summary.verification?.ok ? 'badge-success' : 'badge-danger'}`}>
                    {summary.verification?.ok ? 'Verified' : 'Failed'}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-[var(--background)] rounded-lg p-3">
                    <div className="text-xl font-bold">{Number(((summary.summary as Record<string, unknown>)?.feature_summary as Record<string, unknown>)?.tx_count ?? 0)}</div>
                    <div className="text-xs text-[var(--foreground)]/60">Transactions</div>
                  </div>
                  <div className="bg-[var(--background)] rounded-lg p-3">
                    <div className="text-xl font-bold">{Number(((summary.summary as Record<string, unknown>)?.feature_summary as Record<string, unknown>)?.failed_tx_count ?? 0)}</div>
                    <div className="text-xs text-[var(--foreground)]/60">Failed TXs</div>
                  </div>
                  <div className="bg-[var(--background)] rounded-lg p-3">
                    <div className="text-xl font-bold">{Number(((summary.summary as Record<string, unknown>)?.feature_summary as Record<string, unknown>)?.unique_counterparties ?? 0)}</div>
                    <div className="text-xs text-[var(--foreground)]/60">Counterparties</div>
                  </div>
                  <div className="bg-[var(--background)] rounded-lg p-3">
                    <div className="text-xl font-bold">{Number((summary.summary as Record<string, unknown>)?.observed_to_block ?? 0) - Number((summary.summary as Record<string, unknown>)?.observed_from_block ?? 0) + 1}</div>
                    <div className="text-xs text-[var(--foreground)]/60">Blocks</div>
                  </div>
                </div>

                <div className="mb-4">
                  <div className="text-xs text-[var(--foreground)]/40 mb-1">Risk Signals</div>
                  {Number(((summary.summary as Record<string, unknown>)?.feature_summary as Record<string, unknown>)?.high_risk_flags ?? 0) > 0 ? (
                    <span className="badge badge-warning">High Risk Flags: {String(((summary.summary as Record<string, unknown>)?.feature_summary as Record<string, unknown>)?.high_risk_flags)}</span>
                  ) : Number(((summary.summary as Record<string, unknown>)?.feature_summary as Record<string, unknown>)?.tx_count ?? 0) === 0 ? (
                    <span className="badge badge-info">Sparse Activity</span>
                  ) : (
                    <span className="badge badge-success">None Detected</span>
                  )}
                </div>

                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-[var(--accent)] hover:underline"
                >
                  {showRawJson ? 'Hide' : 'Show'} Raw JSON
                </button>
                {showRawJson && (
                  <pre className="mt-2 p-3 bg-[var(--background)] rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(summary, null, 2)}
                  </pre>
                )}
              </Card>
            )}

            {/* CaseObject */}
            {loading === "case" && (
              <Card>
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-full max-w-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Building CaseObject</span>
                      <span className="text-xs text-[var(--foreground)]/40">Processing...</span>
                    </div>
                    <div className="w-full bg-[var(--background)] rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full animate-pulse" style={{ width: '70%' }} />
                    </div>
                    <p className="text-xs text-[var(--foreground)]/40 mt-3 text-center">
                      Building full audit case with evidence manifest and verification...
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {caseObject && loading !== "case" && (
              <Card>
                <h3 className="text-lg font-bold mb-4">CaseObject</h3>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">subject_id</span>
                    <span className="font-mono text-xs">{caseObject.subject_id}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">network</span>
                    <span className="font-mono">{caseObject.network}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">window</span>
                    <span className="font-mono">{caseObject.window.start_block} → {caseObject.window.end_block}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">verification</span>
                    <span className={`badge ${caseObject.verification?.ok ? 'badge-success' : 'badge-danger'}`}>
                      {caseObject.verification?.ok ? 'OK' : 'FAILED'}
                    </span>
                  </div>

                  {caseObject.case_payload && (
                    <>
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">case_id</span>
                        <span className="font-mono text-xs break-all">{String(caseObject.case_payload.case_id || 'N/A')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">domain_id</span>
                        <span className="font-mono text-xs">{String(caseObject.case_payload.domain_id || 'N/A')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">case_hash</span>
                        <span className="font-mono text-xs break-all">{String(caseObject.case_payload?.case_hash || 'N/A')}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">evidence_merkle_root</span>
                        <span className="font-mono text-xs break-all">{String(((caseObject.case_payload as Record<string, unknown>)?.evidence_manifest as Record<string, unknown>)?.merkle_root || caseObject.case_payload?.evidence_root || 'N/A')}</span>
                      </div>
                    </>
                  )}
                </div>

                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-[var(--accent)] hover:underline mt-4"
                >
                  {showRawJson ? 'Hide' : 'Show'} Raw JSON
                </button>
                {showRawJson && (
                  <pre className="mt-2 p-3 bg-[var(--background)] rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(caseObject, null, 2)}
                  </pre>
                )}
              </Card>
            )}

            {/* Compact Submission Case */}
            {(caseObject?.submission_case || summary?.submission_case) && !loading && (
              <Card>
                <h3 className="text-lg font-bold mb-4">Compact Submission Case</h3>
                <p className="text-xs text-[var(--foreground)]/60 mb-4">
                  This is the compact artifact used for live submission to GenLayer.
                </p>

                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">case_id</span>
                    <span className="font-mono text-xs break-all">
                      {String((caseObject?.submission_case || summary?.submission_case)?.case_id || 'N/A')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">domain_id</span>
                    <span className="font-mono text-xs">
                      {String((caseObject?.submission_case || summary?.submission_case)?.domain_id || 'N/A')}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--foreground)]/60">subject_id</span>
                    <span className="font-mono text-xs">
                      {String(
                        ((caseObject?.submission_case || summary?.submission_case) as { subject_scope?: { subject_id?: string } })?.subject_scope?.subject_id || 'N/A'
                      )}
                    </span>
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
                    {JSON.stringify(caseObject?.submission_case || summary?.submission_case, null, 2)}
                  </pre>
                )}
              </Card>
            )}

            {/* JudgmentObject */}
            {loading === "judgment" && (
              <Card>
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="w-full max-w-md">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium">Building & Evaluating Judgment</span>
                      <span className="text-xs text-[var(--foreground)]/40">Submitting to GenLayer...</span>
                    </div>
                    <div className="w-full bg-[var(--background)] rounded-full h-2 overflow-hidden">
                      <div className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full animate-pulse" style={{ width: '80%' }} />
                    </div>
                    <p className="text-xs text-[var(--foreground)]/40 mt-3 text-center">
                      Submitting case to GenLayer RJP contract and waiting for evaluation...
                    </p>
                  </div>
                </div>
              </Card>
            )}

            {judgment && loading !== "judgment" && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">JudgmentObject</h3>
                  {judgment.evaluation.result?.judgment && (
                    <span className={`badge ${
                      (judgment.evaluation.result.judgment as Record<string, unknown>)?.outcome === 'SAFE' ? 'badge-success' :
                      (judgment.evaluation.result.judgment as Record<string, unknown>)?.outcome === 'UNSAFE' ? 'badge-danger' :
                      'badge-warning'
                    }`}>
                      {String((judgment.evaluation.result.judgment as Record<string, unknown>)?.outcome || 'UNKNOWN')}
                    </span>
                  )}
                </div>

                {judgment.evaluation.result?.judgment ? (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground)]/60">subject_id</span>
                      <span className="font-mono text-xs">{judgment.evaluation.result?.subject_id}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground)]/60">domain_id</span>
                      <span className="font-mono text-xs">{judgment.evaluation.result?.domain_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground)]/60">case_id</span>
                      <span className="font-mono text-xs break-all">{judgment.evaluation.result?.case_id || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--foreground)]/60">submit_tx</span>
                      <span className="font-mono text-xs break-all">{judgment.evaluation.result?.submit_tx}</span>
                    </div>
                    {judgment.evaluation.result?.evaluate_tx && (
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">evaluate_tx</span>
                        <span className="font-mono text-xs break-all">{judgment.evaluation.result?.evaluate_tx}</span>
                      </div>
                    )}

                    {(judgment.evaluation.result?.judgment as Record<string, unknown>) && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-[var(--foreground)]/60">outcome</span>
                          <span className="font-mono">{String((judgment.evaluation.result.judgment as Record<string, unknown>)?.outcome || 'N/A')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--foreground)]/60">confidence_ppm</span>
                          <span className="font-mono">{String((judgment.evaluation.result.judgment as Record<string, unknown>)?.confidence_ppm || 'N/A')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--foreground)]/60">revision</span>
                          <span className="font-mono">{String((judgment.evaluation.result.judgment as Record<string, unknown>)?.revision || 'N/A')}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[var(--foreground)]/60">reason_code</span>
                          <span className="font-mono">{String((judgment.evaluation.result.judgment as Record<string, unknown>)?.reason_code || 'N/A')}</span>
                        </div>
                        <div>
                          <div className="text-[var(--foreground)]/60 mb-1">risk_flags</div>
                          <div className="flex flex-wrap gap-1">
                            {Array.isArray((judgment.evaluation.result.judgment as Record<string, unknown>)?.risk_flags) ?
                              ((judgment.evaluation.result.judgment as Record<string, unknown>).risk_flags as string[]).map((flag: string, i: number) => (
                                <span key={i} className="badge badge-warning">{flag}</span>
                              )) :
                              <span className="text-[var(--foreground)]/40">None</span>
                            }
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--foreground)]/60">
                    No judgment returned. Check evaluate_tx for status.
                  </div>
                )}

                <button
                  onClick={() => setShowRawJson(!showRawJson)}
                  className="text-xs text-[var(--accent)] hover:underline mt-4"
                >
                  {showRawJson ? 'Hide' : 'Show'} Raw JSON
                </button>
                {showRawJson && (
                  <pre className="mt-2 p-3 bg-[var(--background)] rounded-lg text-xs overflow-x-auto">
                    {JSON.stringify(judgment, null, 2)}
                  </pre>
                )}
              </Card>
            )}

            {/* Publish Result */}
            {publishResult && (
              <Card>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-bold">Mirror Publish Result</h3>
                  <span className={`badge ${publishResult.ok ? 'badge-success' : 'badge-danger'}`}>
                    {publishResult.ok ? 'Published' : 'Failed'}
                  </span>
                </div>

                {publishResult.result ? (
                  <div className="space-y-3 text-sm">
                    {publishResult.result.tx_hash && (
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">tx_hash</span>
                        <span className="font-mono text-xs break-all">{publishResult.result.tx_hash}</span>
                      </div>
                    )}
                    {publishResult.result.subject_id && (
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">subject_id</span>
                        <span className="font-mono text-xs">{publishResult.result.subject_id}</span>
                      </div>
                    )}
                    {publishResult.result.mirror_address && (
                      <div className="flex justify-between">
                        <span className="text-[var(--foreground)]/60">mirror_address</span>
                        <span className="font-mono text-xs break-all">{publishResult.result.mirror_address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-sm text-red-400">{publishResult.error || 'Unknown error'}</div>
                )}
              </Card>
            )}

            {/* Empty State */}
            {!summary && !caseObject && !judgment && (
              <Card>
                <div className="text-center py-12 text-[var(--foreground)]/40">
                  <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p>Fetch current block and build evidence to see results</p>
                </div>
              </Card>
            )}
          </motion.div>
        </div>

        {/* Contract Addresses */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8"
        >
          <Card hover={false}>
            <h3 className="text-lg font-bold mb-4">Live Contract Addresses</h3>
            <div className="grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-[var(--foreground)]/40 mb-1">GenLayer RJP</div>
                <div className="font-mono text-xs">{LIVE_CONTRACTS.genlayer.rjp}</div>
              </div>
              <div>
                <div className="text-[var(--foreground)]/40 mb-1">Base Mirror</div>
                <div className="font-mono text-xs">{LIVE_CONTRACTS.baseSepolia.mirror}</div>
              </div>
              <div>
                <div className="text-[var(--foreground)]/40 mb-1">Base Agent Demo</div>
                <div className="font-mono text-xs">{LIVE_CONTRACTS.baseSepolia.agentDemo}</div>
              </div>
              <div>
                <div className="text-[var(--foreground)]/40 mb-1">Base Direct Demo</div>
                <div className="font-mono text-xs">{LIVE_CONTRACTS.baseSepolia.directDemo}</div>
              </div>
            </div>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
