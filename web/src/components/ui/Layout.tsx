"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { motion } from "framer-motion";

interface LayoutProps {
  children: ReactNode;
}

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/builder", label: "Builder" },
  { href: "/judgment", label: "Judgment" },
  { href: "/demo", label: "Demo Lab" },
  { href: "/domains", label: "Domains" },
  { href: "/proofs", label: "Proofs" },
];

export function Layout({ children }: LayoutProps) {
  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <motion.nav
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="fixed top-0 left-0 right-0 z-50 bg-[var(--background)]/80 backdrop-blur-lg border-b border-[var(--card-border)]"
      >
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">R</span>
            </div>
            <div>
              <div className="font-bold text-lg">RJP</div>
              <div className="text-xs text-[var(--foreground)]/60">Trust signals for onchain</div>
            </div>
          </Link>
          
          <div className="flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-sm font-medium text-[var(--foreground)]/70 hover:text-[var(--foreground)] transition-colors"
              >
                {link.label}
              </Link>
            ))}
            <Link
              href="/builder"
              className="px-4 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-semibold rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all"
            >
              Try Now
            </Link>
          </div>
        </div>
      </motion.nav>

      {/* Main content */}
      <main className="pt-20">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--card-border)] mt-20">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="grid grid-cols-4 gap-8">
            <div>
              <h4 className="font-bold mb-4">Protocol</h4>
              <ul className="space-y-2 text-sm text-[var(--foreground)]/60">
                <li><Link href="/domains" className="hover:text-[var(--foreground)]">Domain Specs</Link></li>
                <li><Link href="/proofs" className="hover:text-[var(--foreground)]">Proof Bundles</Link></li>
                <li><Link href="https://github.com" className="hover:text-[var(--foreground)]">GitHub</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Live Contracts</h4>
              <ul className="space-y-2 text-sm text-[var(--foreground)]/60 font-mono">
                <li>GenLayer: 0x4a09...0D4f</li>
                <li>Base Mirror: 0x34EB...0606</li>
                <li>Agent Demo: 0x6038...1434</li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">Documentation</h4>
              <ul className="space-y-2 text-sm text-[var(--foreground)]/60">
                <li><Link href="/docs" className="hover:text-[var(--foreground)]">Getting Started</Link></li>
                <li><Link href="/docs/protocol" className="hover:text-[var(--foreground)]">Protocol Spec</Link></li>
                <li><Link href="/docs/api" className="hover:text-[var(--foreground)]">API Reference</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-bold mb-4">About</h4>
              <p className="text-sm text-[var(--foreground)]/60">
                Reasoned Judgment Protocol. Building trust infrastructure for onchain behavior.
              </p>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-[var(--card-border)] text-center text-sm text-[var(--foreground)]/40">
            RJP Protocol • Trust Signals for Onchain Behavior
          </div>
        </div>
      </footer>
    </div>
  );
}
