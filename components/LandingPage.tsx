'use client';

import React, { useState } from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  DollarSign,
  Download,
  Lock,
  PieChart,
  Plus,
  ReceiptText,
  ShieldCheck,
  Smartphone,
  Target,
  TrendingDown,
  TrendingUp,
  WalletCards,
  Zap,
} from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { GoogleIcon, PocketPilotLogo } from './Icons';

interface LandingPageProps {
  onSignIn: () => void | Promise<void>;
  authError?: string;
}

export default function LandingPage({ onSignIn, authError }: LandingPageProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'budget' | 'goals'>('overview');
  const [calcIncome, setCalcIncome] = useState(65000);
  const [calcSavingsRate, setCalcSavingsRate] = useState(30);

  const monthlySavings = Math.round((calcIncome * calcSavingsRate) / 100);
  const yearlySavings = monthlySavings * 12;
  const fiveYearGrowth = Math.round(yearlySavings * 5 * 1.15); // with modest compound return

  return (
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)] transition-colors">
      {/* Top Navigation */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2.5">
            <PocketPilotLogo size={28} />
            <span className="text-lg font-semibold tracking-tight">
              Pocket Pilot
            </span>
          </div>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[var(--text-muted)] md:flex">
            <a href="#features" className="hover:text-[var(--text)] transition">
              Features
            </a>
            <a href="#preview" className="hover:text-[var(--text)] transition">
              Live Preview
            </a>
            <a href="#calculator" className="hover:text-[var(--text)] transition">
              Runway Calculator
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm font-medium hover:bg-[var(--surface-soft)] transition cursor-pointer"
            >
              <GoogleIcon size={16} />
              <span className="hidden sm:inline">Continue with</span> Google
            </button>
          </div>
        </div>
      </header>

      {authError && (
        <div className="mx-auto max-w-4xl px-4 pt-4">
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-700 dark:text-rose-300">
            {authError}
          </div>
        </div>
      )}

      {/* Hero Section */}
      <section className="px-4 pt-16 pb-16 sm:px-6 lg:px-8 lg:pt-24 lg:pb-20">
        <div className="mx-auto max-w-3xl text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl lg:text-6xl">
            Master your money with zero friction
          </h1>

          <p className="mx-auto mt-6 max-w-2xl text-base text-[var(--text-muted)] sm:text-lg leading-relaxed">
            Pocket Pilot combines transaction logging, budget guardrails, and savings targets into a clean, private personal finance cockpit.
          </p>

          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <button
              onClick={onSignIn}
              className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--surface-soft)] sm:w-auto transition cursor-pointer"
            >
              <GoogleIcon size={18} />
              <span>Get Started with Google</span>
              <ArrowRight size={16} />
            </button>
            <a
              href="#preview"
              className="inline-flex w-full items-center justify-center gap-2 rounded-md px-5 py-2.5 text-sm font-medium text-[var(--text-muted)] hover:text-[var(--text)] sm:w-auto text-center transition"
            >
              Explore Preview
            </a>
          </div>

          {/* Trust badges */}
          <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-sm text-[var(--text-muted)]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={16} strokeWidth={1.25} />
              Private RLS
            </span>
            <span className="flex items-center gap-1.5">
              <Lock size={16} strokeWidth={1.25} />
              Secure
            </span>
            <span className="flex items-center gap-1.5">
              <Download size={16} strokeWidth={1.25} />
              CSV Export
            </span>
            <span className="flex items-center gap-1.5">
              <Smartphone size={16} strokeWidth={1.25} />
              PWA Ready
            </span>
          </div>
        </div>
      </section>

      {/* Live Interactive Product Preview */}
      <section id="preview" className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-8">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Interactive Dashboard Experience
            </p>
            <h2 className="mt-2 font-[var(--font-display)] text-3xl font-bold sm:text-4xl">
              See Pocket Pilot in action
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Click through the tabs below to test the live cockpit widgets before logging in.
            </p>
          </div>

          {/* Mock App Window */}
          <div className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 overflow-hidden">
            {/* Window bar */}
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-[var(--line)] bg-[var(--surface-soft)] px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--text-muted)]">Pocket Pilot</span>
              </div>
              <div className="flex items-center gap-1">
                {(['overview', 'budget', 'goals'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`rounded-md px-2.5 py-1 text-xs font-medium capitalize transition ${
                      activeTab === tab
                        ? 'bg-[var(--surface)] text-[var(--text)] border border-slate-200 dark:border-[var(--line)]'
                        : 'text-[var(--text-muted)] hover:text-[var(--text)]'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {/* Window Content */}
            <div className="p-5 lg:p-6">
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Portfolio Pulse */}
                  <div className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-5">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="text-xs text-[var(--text-muted)]">
                          Total Available Balance
                        </p>
                        <h3 className="mt-1 text-2xl font-semibold">
                          ₹1,42,850
                        </h3>
                      </div>
                      <span className="text-xs text-[var(--text-muted)]">
                        +14.2% from last month
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 border-t border-slate-200 dark:border-[var(--line)] pt-4 sm:grid-cols-3">
                      <div>
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          <TrendingUp size={14} strokeWidth={1.25} /> Monthly Income
                        </span>
                        <p className="mt-1 text-sm font-medium">₹85,000</p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          <TrendingDown size={14} strokeWidth={1.25} /> Expenses
                        </span>
                        <p className="mt-1 text-sm font-medium">₹34,200</p>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                          <Target size={14} strokeWidth={1.25} /> Net Saved
                        </span>
                        <p className="mt-1 text-sm font-medium">₹50,800</p>
                      </div>
                    </div>
                  </div>

                  {/* Velocity breakdown cards */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Recent Activity</span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {[
                          { title: 'Freelance Design Retainer', cat: 'Income', amt: '+₹25,000', tone: 'text-[var(--text)]' },
                          { title: 'Fresh Groceries Market', cat: 'Groceries', amt: '-₹1,420', tone: 'text-[var(--text)]' },
                          { title: 'Electricity & Fiber Bill', cat: 'Utilities', amt: '-₹2,100', tone: 'text-[var(--text)]' },
                          { title: 'Dinner with Team', cat: 'Dining', amt: '-₹1,850', tone: 'text-[var(--text)]' },
                        ].map((row, idx) => (
                          <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-slate-200 dark:border-[var(--line)] last:border-0">
                            <div>
                              <p className="text-[var(--text)]">{row.title}</p>
                              <p className="text-[var(--text-muted)]">{row.cat}</p>
                            </div>
                            <span className={`${row.tone}`}>{row.amt}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Category Velocity</span>
                        <span className="text-xs text-[var(--text-muted)]">Under Budget</span>
                      </div>
                      <div className="mt-3 space-y-2.5">
                        {[
                          { name: 'Groceries', current: '₹8,200', max: '₹12,000', pct: '68%' },
                          { name: 'Dining & Cafes', current: '₹4,500', max: '₹6,000', pct: '75%' },
                          { name: 'Utilities', current: '₹3,200', max: '₹4,000', pct: '80%' },
                          { name: 'Transport', current: '₹1,400', max: '₹3,000', pct: '46%' },
                        ].map((item, idx) => (
                          <div key={idx}>
                            <div className="flex justify-between text-xs mb-1">
                              <span>{item.name}</span>
                              <span className="text-[var(--text-muted)]">{item.current} / {item.max}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-[var(--surface-soft)] overflow-hidden">
                              <div className="h-full rounded-full bg-[var(--text)] opacity-60" style={{ width: item.pct }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'budget' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { name: 'Groceries & Household', spent: '₹8,200', cap: '₹12,000', pct: 68 },
                    { name: 'Dining & Takeout', spent: '₹5,800', cap: '₹6,000', pct: 96 },
                    { name: 'Entertainment & Subscriptions', spent: '₹1,200', cap: '₹2,500', pct: 48 },
                    { name: 'Travel & Commute', spent: '₹1,400', cap: '₹3,000', pct: 46 },
                  ].map((b, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <b className="text-sm font-medium">{b.name}</b>
                      </div>
                      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{b.spent} / {b.cap}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-soft)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--text)] opacity-60" style={{ width: `${b.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'goals' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  {[
                    { name: '6-Month Emergency Fund', current: '₹1,80,000', target: '₹2,50,000', pct: 72 },
                    { name: 'Japan Travel Fund 2027', current: '₹95,000', target: '₹1,50,000', pct: 63 },
                    { name: 'MacBook Pro Upgrade', current: '₹1,20,000', target: '₹1,40,000', pct: 85 },
                    { name: 'Index Fund Investment', current: '₹3,50,000', target: '₹5,00,000', pct: 70 },
                  ].map((g, i) => (
                    <div key={i} className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-4">
                      <div className="flex items-center justify-between">
                        <b className="text-sm font-medium">{g.name}</b>
                        <span className="text-xs text-[var(--text-muted)]">{g.pct}%</span>
                      </div>
                      <p className="mt-1.5 text-xs text-[var(--text-muted)]">{g.current} of {g.target}</p>
                      <div className="mt-2 h-1.5 rounded-full bg-[var(--surface-soft)] overflow-hidden">
                        <div className="h-full rounded-full bg-[var(--text)] opacity-60" style={{ width: `${g.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Interactive Savings Runway Calculator */}
      <section id="calculator" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Calculate your wealth runway
            </h2>
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Adjust income and savings rate to see projected growth.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 grid gap-6 md:grid-cols-2 p-5 sm:p-6">
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Monthly Take-Home Income</span>
                  <span className="font-medium">
                    ₹{calcIncome.toLocaleString('en-IN')}
                  </span>
                </div>
                <input
                  type="range"
                  min="20000"
                  max="500000"
                  step="5000"
                  value={calcIncome}
                  onChange={(e) => setCalcIncome(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                  <span>₹20k</span>
                  <span>₹5,00,000</span>
                </div>
              </div>

              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span>Target Savings Ratio</span>
                  <span className="font-medium">
                    {calcSavingsRate}%
                  </span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="70"
                  step="5"
                  value={calcSavingsRate}
                  onChange={(e) => setCalcSavingsRate(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-[var(--text-muted)] mt-1">
                  <span>10%</span>
                  <span>70%</span>
                </div>
              </div>
            </div>

            {/* Projected Outputs */}
            <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-5">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-[var(--text-muted)]">
                    Monthly Savings
                  </p>
                  <p className="text-xl font-medium">
                    ₹{monthlySavings.toLocaleString('en-IN')} / mo
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[var(--text-muted)]">
                    1-Year Total
                  </p>
                  <p className="text-xl font-medium">
                    ₹{yearlySavings.toLocaleString('en-IN')}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-[var(--text-muted)]">
                    5-Year Projected (8% CAGR)
                  </p>
                  <p className="text-xl font-medium">
                    ₹{fiveYearGrowth.toLocaleString('en-IN')}
                  </p>
                </div>
              </div>

              <button
                onClick={onSignIn}
                className="mt-5 flex items-center justify-center gap-2 rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] py-2 text-sm font-medium hover:bg-[var(--surface-soft)] transition cursor-pointer"
              >
                <GoogleIcon size={16} />
                <span>Start Tracking</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Grid */}
      <section id="features" className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-semibold sm:text-4xl">
              Features
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                icon: ReceiptText,
                title: 'Transaction Logging',
                desc: 'Add expenses and income quickly with smart categories.',
              },
              {
                icon: WalletCards,
                title: 'Budget Limits',
                desc: 'Set monthly caps with visual progress tracking.',
              },
              {
                icon: Target,
                title: 'Savings Goals',
                desc: 'Track progress towards financial milestones.',
              },
              {
                icon: ShieldCheck,
                title: 'Row Level Security',
                desc: 'Data isolated per authenticated account.',
              },
              {
                icon: Download,
                title: 'CSV Export',
                desc: 'Export records for analysis or accounting.',
              },
              {
                icon: Smartphone,
                title: 'PWA Ready',
                desc: 'Install as an app on desktop or mobile.',
              },
            ].map((feature, i) => {
              const Icon = feature.icon;
              return (
                <div key={i} className="rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-4">
                  <div className="mb-3">
                    <Icon size={18} strokeWidth={1.25} />
                  </div>
                  <h3 className="text-sm font-medium">{feature.title}</h3>
                  <p className="mt-1 text-xs text-[var(--text-muted)] leading-relaxed">{feature.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="px-4 py-12 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-3xl rounded-xl border border-slate-200 bg-white/70 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/70 p-6 sm:p-8 text-center">
          <h2 className="text-2xl font-semibold sm:text-3xl">
            Ready to start?
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-sm text-[var(--text-muted)]">
            Secure Google sign-in with private data storage.
          </p>
          <div className="mt-5 flex justify-center">
            <button
              onClick={onSignIn}
              className="inline-flex items-center gap-2 rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-5 py-2.5 text-sm font-medium hover:bg-[var(--surface-soft)] transition cursor-pointer"
            >
              <GoogleIcon size={18} />
              <span>Continue with Google</span>
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-[var(--line)] py-6 px-4 sm:px-6 lg:px-8 text-xs text-[var(--text-muted)]">
        <div className="mx-auto max-w-6xl flex items-center justify-between">
          <div className="flex items-center gap-2">
            <PocketPilotLogo size={18} />
            <span className="font-medium text-[var(--text)]">Pocket Pilot</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
