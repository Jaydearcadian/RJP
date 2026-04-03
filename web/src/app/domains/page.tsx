"use client";

import { motion } from "framer-motion";
import { Layout } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { DOMAIN_OPTIONS } from "@/types/protocol";

// Import the actual domain specs
const domainSpecs = {
  "counterparty_trust.base_trade_v1": {
    outcomes: ["SAFE", "CAUTION", "UNSAFE", "INSUFFICIENT_DATA"],
    claimType: "counterparty_trade_readiness",
    subjectType: "wallet",
    targetType: "wallet_contract_pair",
    networks: ["base-sepolia", "base-mainnet"],
    windowPolicy: {
      mode: "rolling",
      defaultWindowBlocks: 5000,
      maxWindowBlocks: 50000,
      freshnessWindowBlocks: 50000,
    },
    features: [
      "tx_count",
      "failed_tx_count",
      "unique_counterparties",
      "unbounded_approval_count",
      "flagged_interaction_count",
    ],
  },
  "protocol_safety.base_erc20_permission_v1": {
    outcomes: ["SAFE", "CAUTION", "UNSAFE", "INSUFFICIENT_DATA"],
    claimType: "erc20_permission_safety",
    subjectType: "wallet",
    targetType: "wallet_contract_pair",
    networks: ["base-sepolia", "base-mainnet"],
    windowPolicy: {
      mode: "rolling",
      defaultWindowBlocks: 100,
      maxWindowBlocks: 50000,
      freshnessWindowBlocks: 50000,
    },
    features: [
      "approval_breadth",
      "spender_specific_risk",
      "unbounded_approvals",
      "failed_approval_actions",
    ],
  },
};

export default function DomainsPage() {
  return (
    <Layout>
      <div className="max-w-7xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-12"
        >
          <h1 className="text-4xl font-bold mb-4">Domain Explorer</h1>
          <p className="text-xl text-[var(--foreground)]/60">
            Each domain defines a specific trust question with its own evaluation policy, outcomes, and consumption model.
          </p>
        </motion.div>

        {/* What is a Domain */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <Card hover={false}>
            <h2 className="text-xl font-bold mb-4">What is a Domain?</h2>
            <div className="text-[var(--foreground)]/70 space-y-4">
              <p>
                A <strong>DomainSpec</strong> defines the semantic boundary for judgment. Each domain answers
                a specific trust question with its own:
              </p>
              <ul className="list-disc list-inside space-y-2 ml-4">
                <li><strong>Evidence Policy</strong> - What data is admissible and how it's selected</li>
                <li><strong>Evaluation Spec</strong> - What features are required and how they map to outcomes</li>
                <li><strong>Model Policy</strong> - Whether evaluation uses LLM consensus or deterministic rules</li>
                <li><strong>Equivalence Profile</strong> - When two judgments are considered equivalent</li>
                <li><strong>Revision Policy</strong> - How judgments evolve over time</li>
              </ul>
              <p>
                The key insight: <em>not one generic reputation score, but domain-specific trust signals</em>.
              </p>
            </div>
          </Card>
        </motion.div>

        {/* Protocol Objects */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold mb-6">Protocol Objects</h2>
          <div className="grid md:grid-cols-4 gap-4">
            {[
              { name: "DomainSpec", desc: "Semantic boundary and policy" },
              { name: "CaseObject", desc: "Reproducible evidence artifact" },
              { name: "AssessmentArtifact", desc: "Evaluation record and payload" },
              { name: "JudgmentObject", desc: "Compact trust primitive" },
            ].map((obj) => (
              <Card key={obj.name} hover={false}>
                <div className="font-mono text-sm text-[var(--accent)] mb-2">{obj.name}</div>
                <div className="text-sm text-[var(--foreground)]/60">{obj.desc}</div>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Domains */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <h2 className="text-2xl font-bold mb-6">Live Domains</h2>
          <div className="space-y-8">
            {Object.entries(DOMAIN_OPTIONS).map(([domainId, domain], i) => {
              const spec = domainSpecs[domainId as keyof typeof domainSpecs];
              return (
                <motion.div
                  key={domainId}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + i * 0.1 }}
                >
                  <Card>
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-2xl font-bold mb-1">{domain.label}</h3>
                        <div className="font-mono text-xs text-[var(--foreground)]/40">{domainId}</div>
                      </div>
                      <span className="px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-sm font-medium">
                        Active
                      </span>
                    </div>

                    <p className="text-[var(--foreground)]/60 mb-6">{domain.tagline}</p>

                    <div className="grid md:grid-cols-2 gap-6">
                      {/* Outcomes */}
                      <div>
                        <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]/80">Possible Outcomes</h4>
                        <div className="flex flex-wrap gap-2">
                          {spec.outcomes.map((outcome) => (
                            <span
                              key={outcome}
                              className={`badge ${
                                outcome === "SAFE"
                                  ? "badge-success"
                                  : outcome === "CAUTION"
                                  ? "badge-warning"
                                  : outcome === "UNSAFE"
                                  ? "badge-danger"
                                  : "badge-info"
                              }`}
                            >
                              {outcome}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Claim Type */}
                      <div>
                        <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]/80">Claim Type</h4>
                        <div className="font-mono text-sm bg-[var(--background)] rounded p-2">
                          {spec.claimType}
                        </div>
                      </div>

                      {/* Window Policy */}
                      <div>
                        <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]/80">Window Policy</h4>
                        <div className="text-sm space-y-1">
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground)]/60">Mode</span>
                            <span className="font-mono">{spec.windowPolicy.mode}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground)]/60">Default Window</span>
                            <span className="font-mono">{spec.windowPolicy.defaultWindowBlocks.toLocaleString()} blocks</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-[var(--foreground)]/60">Freshness</span>
                            <span className="font-mono">{spec.windowPolicy.freshnessWindowBlocks.toLocaleString()} blocks</span>
                          </div>
                        </div>
                      </div>

                      {/* Features */}
                      <div>
                        <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]/80">Required Features</h4>
                        <div className="flex flex-wrap gap-2">
                          {spec.features.map((feature) => (
                            <span
                              key={feature}
                              className="px-2 py-1 bg-[var(--accent)]/10 text-[var(--accent)] rounded text-xs font-mono"
                            >
                              {feature}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Networks */}
                    <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
                      <h4 className="text-sm font-medium mb-3 text-[var(--foreground)]/80">Supported Networks</h4>
                      <div className="flex gap-2">
                        {spec.networks.map((network) => (
                          <span
                            key={network}
                            className="px-3 py-1 bg-[var(--background)] border border-[var(--card-border)] rounded text-sm"
                          >
                            {network}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Consumer Question */}
                    <div className="mt-4 p-4 bg-[var(--background)] rounded-lg">
                      <div className="text-sm text-[var(--foreground)]/60 mb-1">Primary Consumer Question</div>
                      <div className="font-medium">
                        {domainId === "counterparty_trust.base_trade_v1"
                          ? "Should this wallet be trusted as a trading counterparty in this observation window?"
                          : "Is this ERC-20 approval posture safe for the wallet and spender in this observation window?"}
                      </div>
                    </div>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Consumption Rules */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-12"
        >
          <Card hover={false}>
            <h2 className="text-xl font-bold mb-4">Hot-Path Consumption Rules</h2>
            <div className="text-[var(--foreground)]/70 mb-6">
              <p>For all domains, the consumption flow follows this pattern:</p>
            </div>
            <div className="space-y-4">
              {[
                { state: "SAFE", action: "Allow when fresh", color: "text-green-400" },
                { state: "CAUTION", action: "Review or tighten policy", color: "text-amber-400" },
                { state: "UNSAFE", action: "Deny the interaction", color: "text-red-400" },
                { state: "INSUFFICIENT_DATA", action: "Refresh or collect more evidence", color: "text-blue-400" },
                { state: "STALE", action: "Refresh before execution-grade trust", color: "text-amber-400" },
                { state: "NO_JUDGMENT", action: "Collect and submit a case first", color: "text-gray-400" },
              ].map((rule) => (
                <div key={rule.state} className="flex items-center justify-between p-3 bg-[var(--background)] rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className={`font-mono font-bold ${rule.color}`}>{rule.state}</span>
                  </div>
                  <div className="text-sm text-[var(--foreground)]/60">{rule.action}</div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      </div>
    </Layout>
  );
}
