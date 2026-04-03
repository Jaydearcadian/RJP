"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { Layout } from "@/components/ui/Layout";
import { Card } from "@/components/ui/Card";
import { DEMO_SUBJECTS, DOMAIN_OPTIONS } from "@/types/protocol";

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/10 via-purple-500/5 to-transparent" />
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'linear-gradient(rgba(99, 102, 241, 0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(99, 102, 241, 0.1) 1px, transparent 1px)',
          backgroundSize: '60px 60px'
        }} />
        
        <div className="max-w-7xl mx-auto px-6 pt-24 pb-20 relative">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--card-bg)] border border-[var(--card-border)] mb-8"
            >
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-sm font-medium">Live on GenLayer + Base Sepolia</span>
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
            >
              <span className="gradient-text">Trust Signals</span>
              <br />
              <span>for Onchain Behavior</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="text-xl md:text-2xl text-[var(--foreground)]/60 max-w-3xl mx-auto mb-12"
            >
              From wallet activity to reproducible evidence, bounded judgment, and compact consumption.
              One protocol for counterparty trust, protocol safety, and domain-specific trust signals.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="flex flex-wrap items-center justify-center gap-4"
            >
              <Link
                href="/builder"
                className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg hover:shadow-xl glow"
              >
                Try With Your Wallet
              </Link>
              <Link
                href="/demo"
                className="px-8 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] font-semibold rounded-xl hover:border-[var(--accent)] transition-all"
              >
                View Demo Subjects
              </Link>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 border-y border-[var(--card-border)]">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="grid grid-cols-2 md:grid-cols-4 gap-8"
          >
            {[
              { label: "Evidence Artifacts", value: "100%" },
              { label: "Judgment Revisioned", value: "Yes" },
              { label: "Domains Live", value: "2" },
              { label: "Avg Read Latency", value: "~344ms" },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <div className="text-3xl md:text-4xl font-bold gradient-text mb-2">{stat.value}</div>
                <div className="text-sm text-[var(--foreground)]/60">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
            <p className="text-xl text-[var(--foreground)]/60 max-w-2xl mx-auto">
              Evidence → Judgment → Consumption. Three layers, one trust signal.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              { step: 1, title: "Build Evidence", desc: "Reproducible artifacts from wallet activity. Manifest + Merkle root." },
              { step: 2, title: "Form Judgment", desc: "GenLayer evaluates evidence in LLM or deterministic mode. Revisioned judgments." },
              { step: 3, title: "Consume Trust", desc: "Base mirror exposes compact judgment state. Agents and contracts react." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <Card className="h-full">
                  <div className="text-sm text-[var(--accent)] font-semibold mb-2">Step {item.step}</div>
                  <h3 className="text-xl font-bold mb-2">{item.title}</h3>
                  <p className="text-[var(--foreground)]/60">{item.desc}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Domains */}
      <section className="py-20 bg-[var(--card-bg)]/50">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Domain-Specific Trust</h2>
            <p className="text-xl text-[var(--foreground)]/60">Each domain answers a specific trust question.</p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-8">
            {Object.entries(DOMAIN_OPTIONS).map(([domainId, domain], i) => (
              <motion.div
                key={domainId}
                initial={{ opacity: 0, x: i === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
              >
                <Card className="h-full">
                  <h3 className="text-xl font-bold mb-1">{domain.label}</h3>
                  <div className="text-xs text-[var(--foreground)]/40 font-mono mb-3">{domainId}</div>
                  <p className="text-[var(--foreground)]/60 mb-4">{domain.tagline}</p>
                  <div className="flex gap-4 text-sm">
                    <div><span className="text-[var(--foreground)]/40">Action:</span> <span className="font-mono">{domain.actionType}</span></div>
                  </div>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Demo Subjects */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Live Demo Subjects</h2>
            <p className="text-xl text-[var(--foreground)]/60">Pinned benchmark subjects for trust evaluation.</p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {DEMO_SUBJECTS.map((subject, i) => (
              <motion.div
                key={subject.subject}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full" hover={false}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold">{subject.label}</h3>
                    <span className={`badge ${i === 0 ? 'badge-success' : i === 1 ? 'badge-danger' : 'badge-info'}`}>
                      {i === 0 ? 'SAFE' : i === 1 ? 'UNSAFE' : 'TEST'}
                    </span>
                  </div>
                  <div className="font-mono text-xs text-[var(--foreground)]/60 mb-3 break-all">
                    {subject.subject}
                  </div>
                  <p className="text-xs text-[var(--foreground)]/40">{subject.note}</p>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Build Trust Signals?</h2>
            <p className="text-xl text-[var(--foreground)]/60 mb-8">
              Fetch your own evidence, inspect protocol objects, and run the demo benchmark.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/builder"
                className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all shadow-lg glow"
              >
                Start Building
              </Link>
              <Link
                href="/domains"
                className="px-8 py-4 bg-[var(--card-bg)] border border-[var(--card-border)] font-semibold rounded-xl hover:border-[var(--accent)] transition-all"
              >
                Explore Domains
              </Link>
            </div>
          </motion.div>
        </div>
      </section>
    </Layout>
  );
}
