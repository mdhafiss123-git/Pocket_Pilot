'use client';

import { useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Download,
  LayoutDashboard,
  ListChecks,
  Menu,
  MessageSquare,
  Pencil,
  Plus,
  ReceiptText,
  Settings,
  Target,
  Trash2,
  TrendingDown,
  TrendingUp,
  User,
  WalletCards,
  X,
} from 'lucide-react';

import Chart from '@/components/Chart';
import ThemeToggle from '@/components/ThemeToggle';
import LandingPage from '@/components/LandingPage';
import SignOutModal from '@/components/SignOutModal';
import HelpSupportModal from '@/components/HelpSupportModal';
import { LogoutIcon, PocketPilotLogo } from '@/components/Icons';
import { csv, downloadCsv } from '@/lib/export';
import { Category, Data, Goal, Profile, Task, Transaction } from '@/lib/types';
import {
  budgetSchema,
  goalSchema,
  money,
  profileSchema,
  taskSchema,
  transactionSchema,
} from '@/lib/validation';
import { configured, supabase } from '@/lib/supabase/client';
import {
  createBudget,
  createGoal,
  createTask,
  createTransaction,
  deleteBudget,
  deleteGoal,
  deleteTask,
  deleteTransaction,
  ensureCategory,
  loadUserData,
  saveProfile,
  updateBudget,
  updateGoal,
  updateTask,
  updateTransaction,
} from '@/lib/supabase/data';

type View =
  | 'Dashboard'
  | 'Transactions'
  | 'Budgets'
  | 'Goals'
  | 'Tasks'
  | 'Calendar'
  | 'Reports'
  | 'Settings';

const icons: Record<View, React.ElementType> = {
  Dashboard: LayoutDashboard,
  Transactions: ReceiptText,
  Budgets: WalletCards,
  Goals: Target,
  Tasks: ListChecks,
  Calendar: CalendarDays,
  Reports: BarChart3,
  Settings,
};

const EXPENSE_CATEGORIES = [
  'Groceries',
  'Utilities',
  'Dining',
  'Entertainment',
  'Transport',
  'Health',
  'Shopping',
  'Others',
] as const;

const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Bonus',
  'Gifts',
  'Others',
] as const;

const SUPPORTED_CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
  { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
] as const;

const today = () => new Date().toISOString().slice(0, 10);

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<Data | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [view, setView] = useState<View>('Dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const [transactionDraft, setTransactionDraft] = useState<Transaction | null>(null);
  const [taskDraft, setTaskDraft] = useState<Task | null>(null);
  const [budgetDraftId, setBudgetDraftId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<Goal | null>(null);
  const [spendingRange, setSpendingRange] = useState<'today' | 'week' | 'month' | 'lastMonth' | 'year'>('week');

  const userCurrency = data?.profile?.currency || 'INR';

  function getClient() {
    if (!supabase) throw new Error('Supabase client is not configured.');
    return supabase;
  }

  useEffect(() => {
    const t = localStorage.theme;
    document.documentElement.classList.toggle(
      'dark',
      t === 'dark' || (!t && matchMedia('(prefers-color-scheme: dark)').matches)
    );

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get('error_description') || params.get('error');
      if (urlError) {
        setError(decodeURIComponent(urlError));
        const cleanUrl = window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }
  }, []);

  useEffect(() => {
    if (!configured || !supabase) {
      setAuthLoading(false);
      return;
    }

    const client = supabase;
    let mounted = true;

    async function initAuth() {
      try {
        const { data: sessionData, error: sessionErr } = await client.auth.getSession();
        if (sessionErr) console.warn('getSession error:', sessionErr);

        let active = sessionData.session ?? null;

        if (!active) {
          const { data: userData } = await client.auth.getUser();
          if (userData?.user) {
            const { data: refreshed } = await client.auth.getSession();
            active = refreshed.session ?? null;
          }
        }

        if (!mounted) return;
        setSession(active);
        if (active) {
          await reloadData(active.user.id);
        }
      } catch (err) {
        console.error('Error during auth initialization:', err);
      } finally {
        if (mounted) {
          setAuthLoading(false);
        }
      }
    }

    void initAuth();

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange(async (event, nextSession) => {
      if (!mounted) return;
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
        setSession(nextSession ?? null);
        if (nextSession) {
          await reloadData(nextSession.user.id);
        }
        setAuthLoading(false);
      } else if (event === 'SIGNED_OUT') {
        setSession(null);
        setData(null);
        setAuthLoading(false);
      } else if (event === 'INITIAL_SESSION') {
        if (nextSession) {
          setSession(nextSession);
          await reloadData(nextSession.user.id);
          setAuthLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  function toast(message: string) {
    setNotice(message);
    setTimeout(() => setNotice(''), 3000);
  }

  async function reloadData(userId: string) {
    if (!supabase) return;
    setDataLoading(true);
    setError('');
    try {
      const loaded = await loadUserData(supabase, userId);
      setData(loaded);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load user financial records.');
    } finally {
      setDataLoading(false);
    }
  }

  async function runCloudAction(action: () => Promise<void>, successMessage: string) {
    if (!supabase || !session) return;
    setError('');
    setDataLoading(true);
    try {
      await action();
      await reloadData(session.user.id);
      toast(successMessage);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error syncing changes with Supabase.');
    } finally {
      setDataLoading(false);
    }
  }

  async function signInWithGoogle() {
    if (!supabase) {
      setError('Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and KEY.');
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: {
          prompt: 'select_account',
          access_type: 'offline',
        },
      },
    });
    if (signInError) setError(signInError.message);
  }

  async function handleSignOut() {
    if (!supabase) return;
    setIsSigningOut(true);
    try {
      const { error: signOutError } = await supabase.auth.signOut();
      if (signOutError) {
        setError(signOutError.message);
      } else {
        setSession(null);
        setData(null);
        setShowSignOutModal(false);
        toast('Signed out securely.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign out.');
    } finally {
      setIsSigningOut(false);
    }
  }

  function openAddTransaction() {
    const defaultCategory = EXPENSE_CATEGORIES[0];
    setTransactionDraft({
      id: '',
      title: '',
      amount: 0,
      kind: 'expense',
      category: defaultCategory,
      date: today(),
    });
  }

  function openAddTask() {
    setTaskDraft({
      id: '',
      title: '',
      dueDate: today(),
      completed: false,
      recurring: 'none',
      reminder: false,
    });
  }

  const activeUser = session?.user;
  const appData: Data = data ?? {
    categories: [],
    transactions: [],
    budgets: [],
    goals: [],
    tasks: [],
    profile: { displayName: activeUser?.user_metadata?.full_name ?? '', currency: 'INR' },
  };

  const categories = appData.categories;
  const expenses = appData.transactions.filter((x) => x.kind === 'expense');
  const income = appData.transactions.filter((x) => x.kind === 'income');
  const spent = expenses.reduce((sum, x) => sum + x.amount, 0);
  const earned = income.reduce((sum, x) => sum + x.amount, 0);
  const balance = earned - spent;

  const spending = useMemo(() => {
    const now = new Date();
    if (spendingRange === 'today') {
      const date = now.toISOString().slice(0, 10);
      return [
        {
          day: now.toLocaleDateString('en', { weekday: 'short' }),
          spending: expenses.filter((x) => x.date === date).reduce((sum, x) => sum + x.amount, 0),
        },
      ];
    } else if (spendingRange === 'week') {
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(d.getDate() - 6 + i);
        const date = d.toISOString().slice(0, 10);
        return {
          day: d.toLocaleDateString('en', { weekday: 'short' }),
          spending: expenses.filter((x) => x.date === date).reduce((sum, x) => sum + x.amount, 0),
        };
      });
    } else if (spendingRange === 'month') {
      const days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth(), i + 1);
        const date = d.toISOString().slice(0, 10);
        return {
          day: String(i + 1),
          spending: expenses.filter((x) => x.date === date).reduce((sum, x) => sum + x.amount, 0),
        };
      });
    } else if (spendingRange === 'lastMonth') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const days = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      return Array.from({ length: days }, (_, i) => {
        const date = new Date(d.getFullYear(), d.getMonth(), i + 1).toISOString().slice(0, 10);
        return {
          day: String(i + 1),
          spending: expenses.filter((x) => x.date === date).reduce((sum, x) => sum + x.amount, 0),
        };
      });
    } else if (spendingRange === 'year') {
      return Array.from({ length: 12 }, (_, i) => {
        const monthExpenses = expenses.filter((x) => {
          const xd = new Date(x.date);
          return xd.getFullYear() === now.getFullYear() && xd.getMonth() === i;
        });
        return {
          day: new Date(now.getFullYear(), i).toLocaleDateString('en', { month: 'short' }),
          spending: monthExpenses.reduce((sum, x) => sum + x.amount, 0),
        };
      });
    }
    return [];
  }, [spendingRange, expenses]);

  if (authLoading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[var(--bg)] p-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <PocketPilotLogo size={40} />
          <p className="text-sm text-[var(--text-muted)]">Loading Pocket Pilot...</p>
        </div>
      </main>
    );
  }

  if (!session) {
    return <LandingPage onSignIn={signInWithGoogle} authError={error} />;
  }

  const pendingTasks = appData.tasks.filter((t) => !t.completed);
  const newestTransaction = [...appData.transactions].sort((a, b) =>
    b.date.localeCompare(a.date)
  )[0];

  const navList: View[] = [
    'Dashboard',
    'Transactions',
    'Budgets',
    'Goals',
    'Tasks',
    'Calendar',
    'Reports',
    'Settings',
  ];

  const mobileNavList: View[] = ['Dashboard', 'Transactions', 'Budgets', 'Goals', 'Settings'];

  function resolveCategoryId(name: string) {
    return categories.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  }

  function updateTaskCompletion(task: Task) {
    if (!session || !supabase) return;
    const client = getClient();
    void runCloudAction(
      () =>
        updateTask(client, task.id, {
          title: task.title,
          dueDate: task.dueDate,
          recurring: task.recurring,
          reminder: task.reminder,
          completed: !task.completed,
        }),
      'Task updated.'
    );
  }

  async function deleteEntity(
    kind: 'transaction' | 'task' | 'budget' | 'goal',
    id: string
  ) {
    if (!confirm('Are you sure you want to delete this record? This action cannot be undone.')) {
      return;
    }
    if (!session || !supabase) return;
    const client = getClient();
    const map = {
      transaction: () => deleteTransaction(client, id),
      task: () => deleteTask(client, id),
      budget: () => deleteBudget(client, id),
      goal: () => deleteGoal(client, id),
    };
    await runCloudAction(map[kind], 'Item removed.');
  }

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[260px_1fr] bg-slate-50/60 dark:bg-[var(--bg)] text-[var(--text)]">
      <div
        aria-hidden={!mobileOpen}
        className={`fixed inset-0 z-30 bg-slate-950/40 transition lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-4 shadow-sm transition-transform lg:static lg:w-auto lg:translate-x-0 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-5 flex items-center gap-2.5 px-1">
          <PocketPilotLogo size={24} />
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight">Pocket Pilot</p>
            <p className="truncate text-xs text-[var(--text-muted)]">
              {session.user.email}
            </p>
          </div>
        </div>

        <nav className="space-y-0.5">
          {navList.map((n) => {
            const Icon = icons[n];
            const active = view === n;
            return (
              <button
                key={n}
                onClick={() => {
                  setView(n);
                  setMobileOpen(false);
                }}
                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition ${
                  active
                    ? 'bg-[var(--surface-soft)] text-[var(--text)] font-medium'
                    : 'text-[var(--text-muted)] hover:bg-[var(--surface-soft)] hover:text-[var(--text)]'
                }`}
              >
                <Icon size={16} strokeWidth={1.25} />
                <span>{n}</span>
              </button>
            );
          })}
        </nav>

        <div className="mt-6 border-t border-slate-200 dark:border-[var(--line)] pt-3">
          <button
            onClick={() => setShowSignOutModal(true)}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-soft)] transition"
          >
            <LogoutIcon size={16} strokeWidth={1.25} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="min-w-0 flex flex-col min-h-screen">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 dark:border-[var(--line)] bg-white/95 dark:bg-[var(--surface)]/95 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-2.5 lg:px-8">
            <div className="flex min-w-0 items-center gap-2">
              <button
                className="lg:hidden p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] transition-all duration-200"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle navigation menu"
              >
                <Menu size={18} strokeWidth={1.25} />
              </button>
              <h1 className="truncate text-lg font-semibold leading-tight text-zinc-900 dark:text-[var(--text)]">{view}</h1>
            </div>
            <div className="flex items-center gap-1">
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="mx-auto max-w-7xl p-4 pb-24 lg:p-6 flex-1 w-full">
          {dataLoading && <div className="mb-3 text-xs text-[var(--text-muted)]">Syncing...</div>}
          {error && (
            <div className="mb-3 rounded-md border border-rose-200 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 px-3 py-2 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
              <span>{error}</span>
              <button onClick={() => setError('')} className="p-1">
                <X size={14} strokeWidth={1.25} />
              </button>
            </div>
          )}

          {view === 'Dashboard' && <Dashboard />}
          {view === 'Transactions' && <Transactions />}
          {view === 'Budgets' && <Budgets />}
          {view === 'Goals' && <Goals />}
          {view === 'Tasks' && <TasksView />}
          {view === 'Calendar' && <Calendar />}
          {view === 'Reports' && <Reports />}
          {view === 'Settings' && <SettingsPage />}
        </div>

        <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1.5 lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-1">
            {mobileNavList.map((n) => {
              const Icon = icons[n];
              const active = view === n;
              return (
                <button
                  key={n}
                  onClick={() => setView(n)}
                  className={`flex flex-1 flex-col items-center gap-0.5 rounded-md px-1 py-1 text-[10px] transition ${
                    active ? 'text-[var(--text)] font-medium' : 'text-[var(--text-muted)]'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.25} />
                  <span>{n}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {notice && (
          <div
            role="status"
            className="fixed bottom-20 right-4 z-40 rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-3 py-2 text-xs shadow-lg"
          >
            {notice}
          </div>
        )}

        {(view === 'Dashboard' || view === 'Transactions' || view === 'Tasks') && (
          <button
            id="quick-add-btn"
            onClick={() => {
              if (view === 'Dashboard' || view === 'Transactions') {
                openAddTransaction();
              } else if (view === 'Tasks') {
                openAddTask();
              }
            }}
            className="fixed bottom-16 right-4 z-30 lg:bottom-6 lg:right-6 rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-3 py-1.5 text-sm flex items-center gap-1.5"
            aria-label="Add transaction or task"
          >
            <Plus size={16} strokeWidth={1.25} />
            <span>{view === 'Tasks' ? 'Add Task' : 'Add'}</span>
          </button>
        )}
      </main>

      {transactionDraft && (
        <TransactionModal
          data={appData}
          draft={transactionDraft}
          currency={userCurrency}
          onClose={() => setTransactionDraft(null)}
          onSave={async (draft) => {
            const parsed = transactionSchema.safeParse(draft);
            if (!parsed.success) throw new Error(parsed.error.issues[0].message);

            const client = getClient();
            let catId = resolveCategoryId(parsed.data.category);

            if (!catId && session) {
              catId = await ensureCategory(client, session.user.id, parsed.data.category);
            }

            if (draft.id) {
              await runCloudAction(
                () =>
                  updateTransaction(client, draft.id, {
                    title: parsed.data.title,
                    amount: parsed.data.amount,
                    kind: parsed.data.kind,
                    categoryId: catId,
                    date: parsed.data.date,
                    notes: parsed.data.notes,
                  }),
                'Transaction updated.'
              );
            } else {
              await runCloudAction(
                () =>
                  createTransaction(client, session.user.id, {
                    title: parsed.data.title,
                    amount: parsed.data.amount,
                    kind: parsed.data.kind,
                    categoryId: catId,
                    date: parsed.data.date,
                    notes: parsed.data.notes,
                  }),
                'Transaction recorded.'
              );
            }
            setTransactionDraft(null);
          }}
        />
      )}

      {taskDraft && (
        <TaskModal
          draft={taskDraft}
          onClose={() => setTaskDraft(null)}
          onSave={async (draft) => {
            const parsed = taskSchema.safeParse({
              title: draft.title,
              dueDate: draft.dueDate,
              recurring: draft.recurring,
              reminder: draft.reminder,
            });
            if (!parsed.success) throw new Error(parsed.error.issues[0].message);

            const client = getClient();
            if (draft.id) {
              await runCloudAction(
                () =>
                  updateTask(client, draft.id, {
                    ...parsed.data,
                    completed: draft.completed,
                  }),
                'Task updated.'
              );
            } else {
              await runCloudAction(
                () => createTask(client, session.user.id, parsed.data),
                'Task created.'
              );
            }
            setTaskDraft(null);
          }}
        />
      )}

      {budgetDraftId !== null && (
        <BudgetModal
          draft={appData.budgets.find((b) => b.id === budgetDraftId) ?? null}
          categories={categories}
          currency={userCurrency}
          onClose={() => setBudgetDraftId(null)}
          onSave={async (input) => {
            const parsed = budgetSchema.safeParse(input);
            if (!parsed.success) throw new Error(parsed.error.issues[0].message);

            const client = getClient();
            if (budgetDraftId) {
              await runCloudAction(
                () => updateBudget(client, budgetDraftId, parsed.data),
                'Budget updated.'
              );
            } else {
              await runCloudAction(
                () => createBudget(client, session.user.id, parsed.data),
                'Budget created.'
              );
            }
            setBudgetDraftId(null);
          }}
        />
      )}

      {goalDraft && (
        <GoalModal
          draft={goalDraft}
          currency={userCurrency}
          onClose={() => setGoalDraft(null)}
          onSave={async (draft) => {
            const parsed = goalSchema.safeParse(draft);
            if (!parsed.success) throw new Error(parsed.error.issues[0].message);

            const client = getClient();
            if (draft.id) {
              await runCloudAction(
                () => updateGoal(client, draft.id, parsed.data),
                'Goal updated.'
              );
            } else {
              await runCloudAction(
                () => createGoal(client, session.user.id, parsed.data),
                'Goal created.'
              );
            }
            setGoalDraft(null);
          }}
        />
      )}

      <SignOutModal
        isOpen={showSignOutModal}
        onClose={() => setShowSignOutModal(false)}
        onConfirm={handleSignOut}
        isSigningOut={isSigningOut}
      />

      <HelpSupportModal
        isOpen={showSupportModal}
        onClose={() => setShowSupportModal(false)}
        userEmail={session.user.email}
        onSuccessToast={toast}
      />
    </div>
  );

  function Dashboard() {
    return (
      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Net Balance</p>
              <h2 className="mt-1 text-2xl font-semibold text-zinc-900 dark:text-[var(--text)]">{money(balance, userCurrency)}</h2>
            </div>
            <button onClick={openAddTransaction} className="rounded-lg border border-slate-200/80 dark:border-[var(--line)] px-3 py-1.5 text-sm flex items-center gap-1.5 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
              <Plus size={15} strokeWidth={1.25} />
              <span>Quick Add</span>
            </button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200/80 dark:border-[var(--line)] p-4 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
              <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)] flex items-center gap-1.5"><TrendingUp size={14} strokeWidth={1.25} /> Income</p>
              <p className="mt-2 text-base font-medium text-zinc-900 dark:text-[var(--text)]">{money(earned, userCurrency)}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-[var(--line)] p-4 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
              <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)] flex items-center gap-1.5"><TrendingDown size={14} strokeWidth={1.25} /> Spent</p>
              <p className="mt-2 text-base font-medium text-zinc-900 dark:text-[var(--text)]">{money(spent, userCurrency)}</p>
            </div>
            <div className="rounded-xl border border-slate-200/80 dark:border-[var(--line)] p-4 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
              <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)] flex items-center gap-1.5"><ArrowUpRight size={14} strokeWidth={1.25} /> Net Saved</p>
              <p className="mt-2 text-base font-medium text-zinc-900 dark:text-[var(--text)]">{money(balance, userCurrency)}</p>
            </div>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-5 shadow-sm">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-[var(--text)]">Spending Velocity</h3>
                <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Expense trend over time</p>
              </div>
              <select
                value={spendingRange}
                onChange={(e) => setSpendingRange(e.target.value as typeof spendingRange)}
                className="rounded-lg border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] px-2.5 py-1 text-xs hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200"
              >
                <option value="today">Today (1 Day)</option>
                <option value="week">Last 7 Days</option>
                <option value="month">This Month (1 Month)</option>
                <option value="lastMonth">Last Month</option>
                <option value="year">1 Year</option>
              </select>
            </div>
            <Chart data={spending} />
          </div>

          <div className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-5 shadow-sm flex flex-col">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-[var(--text)]">Focus Queue</h3>
                <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Upcoming tasks</p>
              </div>
              <button onClick={openAddTask} className="text-xs text-zinc-500 dark:text-[var(--text-muted)] flex items-center gap-1 hover:text-zinc-900 dark:hover:text-[var(--text)] transition-all duration-200">
                <Plus size={13} strokeWidth={1.25} /> Add task
              </button>
            </div>
            <div className="mt-3 space-y-2 flex-1">
              {pendingTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 dark:border-[var(--line)] px-3 py-2 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
                  <div className="min-w-0">
                    <p className="text-xs truncate text-zinc-900 dark:text-[var(--text)]">{task.title}</p>
                    <p className="text-[11px] text-zinc-500 dark:text-[var(--text-muted)]">Due {task.dueDate}</p>
                  </div>
                </div>
              ))}
              {!pendingTasks.length && <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)] py-2">All clear</p>}
            </div>
            <button onClick={() => setView('Tasks')} className="mt-3 text-xs text-zinc-500 dark:text-[var(--text-muted)] self-start hover:text-zinc-900 dark:hover:text-[var(--text)] transition-all duration-200">View all tasks →</button>
          </div>
        </section>
      </div>
    );
  }

  function Transactions() {
    const sorted = [...appData.transactions].sort((a, b) => b.date.localeCompare(a.date));
    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[var(--text)]">Income and Expenses</h2>
            <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Transaction ledger</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => downloadCsv(csv(appData.transactions))} className="rounded-lg border border-slate-200/80 dark:border-[var(--line)] px-2.5 py-1 text-xs flex items-center gap-1 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
              <Download size={13} strokeWidth={1.25} /> Export CSV
            </button>
            <button onClick={openAddTransaction} className="rounded-lg border border-slate-200/80 dark:border-[var(--line)] px-2.5 py-1 text-xs flex items-center gap-1 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
              <Plus size={13} strokeWidth={1.25} /> New
            </button>
          </div>
        </div>
        {sorted.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-zinc-500 dark:text-[var(--text-muted)]">
                <tr>
                  <th className="py-2 font-medium">Date</th>
                  <th className="py-2 font-medium">Title</th>
                  <th className="py-2 font-medium">Category</th>
                  <th className="py-2 font-medium">Type</th>
                  <th className="py-2 font-medium text-right">Amount</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((t) => (
                  <tr key={t.id} className="border-t border-slate-200/80 dark:border-[var(--line)] hover:bg-slate-50/60 dark:hover:bg-[var(--surface-soft)] transition-all duration-200">
                    <td className="py-2 text-zinc-500 dark:text-[var(--text-muted)]">{t.date}</td>
                    <td className="py-2 text-zinc-900 dark:text-[var(--text)]">{t.title}</td>
                    <td className="py-2 text-zinc-500 dark:text-[var(--text-muted)]">{t.category}</td>
                    <td className="py-2 text-zinc-500 dark:text-[var(--text-muted)] capitalize">{t.kind}</td>
                    <td className="py-2 text-right text-zinc-900 dark:text-[var(--text)]">{t.kind === 'income' ? '+' : '-'}{money(t.amount, userCurrency)}</td>
                    <td className="py-2 text-right">
                      <button onClick={() => setTransactionDraft(t)} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Pencil size={13} strokeWidth={1.25} /></button>
                      <button onClick={() => void deleteEntity('transaction', t.id)} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Trash2 size={13} strokeWidth={1.25} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">No transactions</p>
        )}
      </section>
    );
  }

  function Budgets() {
    const month = today().slice(0, 7);
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[var(--text)]">Budgets</h2>
            <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Category spending caps</p>
          </div>
          <button className="rounded-lg border border-slate-200/80 dark:border-[var(--line)] px-2.5 py-1 text-xs flex items-center gap-1 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200" onClick={() => setBudgetDraftId('')}>
            <Plus size={13} strokeWidth={1.25} /> Add
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {appData.budgets.map((b) => {
            const used = expenses.filter((e) => e.categoryId === b.categoryId && e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
            const ratio = b.limit > 0 ? Math.min(100, (used / b.limit) * 100) : 0;
            return (
              <div className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-4 shadow-sm hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200" key={b.id}>
                <div className="flex items-center justify-between">
                  <b className="text-sm text-zinc-900 dark:text-[var(--text)]">{b.category}</b>
                  <div>
                    <button onClick={() => setBudgetDraftId(b.id)} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Pencil size={13} strokeWidth={1.25} /></button>
                    <button onClick={() => void deleteEntity('budget', b.id)} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Trash2 size={13} strokeWidth={1.25} /></button>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-[var(--text-muted)]">{money(used, userCurrency)} / {money(b.limit, userCurrency)}</p>
                <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-[var(--surface-soft)] overflow-hidden">
                  <div className="h-full bg-zinc-900 dark:bg-[var(--text)]" style={{ width: `${ratio}%` }} />
                </div>
              </div>
            );
          })}
          {!appData.budgets.length && <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">No budgets</p>}
        </div>
      </section>
    );
  }

  function Goals() {
    return (
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[var(--text)]">Goals</h2>
            <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Savings milestones</p>
          </div>
          <button className="rounded-lg border border-slate-200/80 dark:border-[var(--line)] px-2.5 py-1 text-xs flex items-center gap-1 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200" onClick={() => setGoalDraft({ id: '', name: '', target: 0, saved: 0, targetDate: '' })}>
            <Plus size={13} strokeWidth={1.25} /> Add
          </button>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {appData.goals.map((g) => {
            const ratio = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
            return (
              <div className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-4 shadow-sm hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200" key={g.id}>
                <div className="flex items-center justify-between">
                  <b className="text-sm text-zinc-900 dark:text-[var(--text)]">{g.name}</b>
                  <div>
                    <button onClick={() => setGoalDraft(g)} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Pencil size={13} strokeWidth={1.25} /></button>
                    <button onClick={() => void deleteEntity('goal', g.id)} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Trash2 size={13} strokeWidth={1.25} /></button>
                  </div>
                </div>
                <p className="mt-1.5 text-xs text-zinc-500 dark:text-[var(--text-muted)]">{money(g.saved, userCurrency)} / {money(g.target, userCurrency)} ({ratio.toFixed(0)}%)</p>
                <div className="mt-2.5 h-1.5 rounded-full bg-slate-100 dark:bg-[var(--surface-soft)] overflow-hidden">
                  <div className="h-full bg-zinc-900 dark:bg-[var(--text)]" style={{ width: `${ratio}%` }} />
                </div>
              </div>
            );
          })}
          {!appData.goals.length && <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">No goals</p>}
        </div>
      </section>
    );
  }

  function TasksView() {
    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-[var(--text)]">Tasks</h2>
            <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Reminders and planner</p>
          </div>
          <button onClick={openAddTask} className="rounded-lg border border-slate-200/80 dark:border-[var(--line)] px-2.5 py-1 text-xs flex items-center gap-1 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
            <Plus size={13} strokeWidth={1.25} /> Add
          </button>
        </div>
        <div className="space-y-2">
          {appData.tasks.map((t) => (
            <label key={t.id} className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-[var(--line)] px-3 py-2 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
              <input type="checkbox" checked={t.completed} onChange={() => updateTaskCompletion(t)} className="accent-zinc-900" />
              <div className="min-w-0 flex-1">
                <p className={`text-xs ${t.completed ? 'line-through text-zinc-500 dark:text-[var(--text-muted)]' : 'text-zinc-900 dark:text-[var(--text)]'}`}>{t.title}</p>
                <p className="text-[11px] text-zinc-500 dark:text-[var(--text-muted)]">Due {t.dueDate}</p>
              </div>
              <button onClick={(e) => { e.preventDefault(); setTaskDraft(t); }} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Pencil size={13} strokeWidth={1.25} /></button>
              <button onClick={(e) => { e.preventDefault(); void deleteEntity('task', t.id); }} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><Trash2 size={13} strokeWidth={1.25} /></button>
            </label>
          ))}
          {!appData.tasks.length && <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">No tasks</p>}
        </div>
      </section>
    );
  }

  function Calendar() {
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const blanks = Array.from({ length: startDayOfWeek }, (_, i) => i);

    const dailyExpenseMap = useMemo(() => {
      const map = new Map<string, number>();
      expenses.forEach((e) => {
        map.set(e.date, (map.get(e.date) || 0) + e.amount);
      });
      return map;
    }, [expenses]);

    const selectedDateTxns = selectedDate ? appData.transactions.filter((t) => t.date === selectedDate) : [];

    return (
      <section className="rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] p-5 shadow-sm">
        <div className="mb-4">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-[var(--text)]">Calendar</h2>
          <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)]">Daily expense summary</p>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="py-1.5 text-zinc-500 dark:text-[var(--text-muted)]">{d}</div>
          ))}
          {blanks.map((b) => <div key={`b${b}`} />)}
          {days.map((day) => {
            const dateStr = new Date(year, month, day).toISOString().slice(0, 10);
            const total = dailyExpenseMap.get(dateStr) || 0;
            const isToday = dateStr === today();
            return (
              <button key={day} onClick={() => setSelectedDate(dateStr)} className={`min-h-[56px] rounded-xl border border-slate-200/80 dark:border-[var(--line)] p-1.5 text-left hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200 ${isToday ? 'bg-slate-50/60 dark:bg-[var(--surface-soft)]' : ''}`}>
                <div className="text-[11px] text-zinc-900 dark:text-[var(--text)]">{day}</div>
                {total > 0 && <div className="mt-auto text-[10px] text-zinc-500 dark:text-[var(--text-muted)]">-{money(total, userCurrency)}</div>}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-slate-950/40 p-3" onClick={() => setSelectedDate(null)}>
            <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-[var(--line)] bg-white dark:bg-[var(--surface)] shadow-md" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200/80 dark:border-[var(--line)]">
                <p className="text-xs font-medium text-zinc-900 dark:text-[var(--text)]">{selectedDate}</p>
                <button onClick={() => setSelectedDate(null)} className="p-1 hover:bg-slate-50 dark:hover:bg-[var(--surface-soft)] rounded-md transition-all duration-200"><X size={14} strokeWidth={1.25} /></button>
              </div>
              <div className="p-3 space-y-1.5 max-h-[50vh] overflow-auto">
                {selectedDateTxns.length ? selectedDateTxns.map((t) => (
                  <div key={t.id} className="flex justify-between rounded-xl border border-slate-200/80 dark:border-[var(--line)] px-3 py-2 hover:border-slate-300 dark:hover:border-[var(--text-muted)] transition-all duration-200">
                    <div>
                      <p className="text-xs text-zinc-900 dark:text-[var(--text)]">{t.title}</p>
                      <p className="text-[11px] text-zinc-500 dark:text-[var(--text-muted)]">{t.category}</p>
                    </div>
                    <span className="text-xs text-zinc-900 dark:text-[var(--text)]">{t.kind === 'income' ? '+' : '-'}{money(t.amount, userCurrency)}</span>
                  </div>
                )) : <p className="text-xs text-zinc-500 dark:text-[var(--text-muted)] p-2">No transactions</p>}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  function Reports() {
    const groups = categories.map((c) => ({ category: c.name, total: expenses.filter((e) => e.categoryId === c.id || e.category.toLowerCase() === c.name.toLowerCase()).reduce((sum, e) => sum + e.amount, 0) })).filter((x) => x.total > 0);
    return (
      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 dark:border-[var(--line)] p-4">
          <h2 className="text-sm font-medium mb-2">Spending by Category</h2>
          {groups.map((g) => (
            <div key={g.category} className="mb-2">
              <div className="flex justify-between text-xs"><span>{g.category}</span><span>{money(g.total, userCurrency)}</span></div>
              <div className="mt-1 h-1.5 rounded-full bg-[var(--surface-soft)] overflow-hidden">
                <div className="h-full bg-[var(--text)] opacity-60" style={{ width: `${Math.min(100, (g.total / (spent || 1)) * 100)}%` }} />
              </div>
            </div>
          ))}
          {!groups.length && <p className="text-xs text-[var(--text-muted)]">No data</p>}
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-[var(--line)] p-4">
          <h2 className="text-sm font-medium mb-2">Analytics</h2>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-slate-200 dark:border-[var(--line)] p-2"><p className="text-[var(--text-muted)]">Transactions</p><p className="text-sm font-medium">{appData.transactions.length}</p></div>
            <div className="rounded-md border border-slate-200 dark:border-[var(--line)] p-2"><p className="text-[var(--text-muted)]">Savings Rate</p><p className="text-sm font-medium">{earned > 0 ? `${Math.max(0, Math.round((balance / earned) * 100))}%` : '0%'}</p></div>
          </div>
          <button onClick={() => downloadCsv(csv(appData.transactions))} className="mt-3 w-full rounded-md border border-slate-200 dark:border-[var(--line)] px-2 py-1 text-xs flex items-center justify-center gap-1"><Download size={13} strokeWidth={1.25} /> Download CSV</button>
        </div>
      </section>
    );
  }

  function SettingsPage() {
    const [displayName, setDisplayName] = useState(appData.profile?.displayName || activeUser?.user_metadata?.full_name || '');
    const [selectedCurrency, setSelectedCurrency] = useState(userCurrency);
    const [saving, setSaving] = useState(false);

    async function handleSaveProfile(e: React.FormEvent) {
      e.preventDefault();
      if (!activeUser) return;
      setSaving(true);
      setError('');
      try {
        const client = getClient();
        await saveProfile(client, activeUser.id, { displayName, currency: selectedCurrency });
        await reloadData(activeUser.id);
        toast('Profile saved.');
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save profile.');
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-slate-200 dark:border-[var(--line)] p-4">
          <h3 className="text-sm font-medium">Profile</h3>
          <form onSubmit={handleSaveProfile} className="mt-2 space-y-2">
            <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={activeUser?.email ?? ''} disabled />
            <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
            <select className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value)}>
              {SUPPORTED_CURRENCIES.map((curr) => <option key={curr.code} value={curr.code}>{curr.code}</option>)}
            </select>
            <button type="submit" disabled={saving} className="rounded-md border border-slate-200 dark:border-[var(--line)] px-2.5 py-1 text-xs">{saving ? 'Saving...' : 'Save'}</button>
          </form>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-[var(--line)] p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium">Help & Support</h3>
            <button onClick={() => setShowSupportModal(true)} className="rounded-md border border-slate-200 dark:border-[var(--line)] px-2 py-1 text-xs flex items-center gap-1"><MessageSquare size={13} strokeWidth={1.25} /> Contact</button>
          </div>
        </div>
      </div>
    );
  }
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-md border border-slate-200 dark:border-[var(--line)] p-2">
      <button onClick={() => setOpen((v) => !v)} className="w-full text-left text-xs font-medium">{question}</button>
      {open && <p className="mt-1 text-xs text-[var(--text-muted)]">{answer}</p>}
    </div>
  );
}

function TransactionModal({ draft, data, currency, onClose, onSave }: { draft: Transaction; data: Data; currency: string; onClose: () => void; onSave: (draft: Transaction) => Promise<void> }) {
  const [value, setValue] = useState<Transaction>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const categoryOptions = useMemo(() => {
    if (value.kind === 'expense') {
      const existing = data.categories.map((c) => c.name);
      return Array.from(new Set([...EXPENSE_CATEGORIES, ...existing]));
    } else {
      const existing = data.categories.map((c) => c.name);
      return Array.from(new Set([...INCOME_CATEGORIES, ...existing]));
    }
  }, [value.kind, data.categories]);

  function handleKindChange(newKind: Transaction['kind']) {
    const newOptions = newKind === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES;
    const isCurrentValid = (newOptions as readonly string[]).includes(value.category);
    setValue({ ...value, kind: newKind, category: isCurrentValid ? value.category : newOptions[0] });
  }

  return (
    <Modal title={draft.id ? 'Edit Transaction' : 'Add Transaction'} close={onClose}>
      <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave(value); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} placeholder="Title" required />
        <div className="grid grid-cols-2 gap-2">
          <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="number" value={value.amount || ''} onChange={(e) => setValue({ ...value, amount: Number(e.target.value) })} placeholder={`Amount (${currency})`} required />
          <select className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={value.kind} onChange={(e) => handleKindChange(e.target.value as Transaction['kind'])}>
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </div>
        <select className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value })}>
          {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="date" value={value.date} onChange={(e) => setValue({ ...value, date: e.target.value })} required />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] px-2 py-1 text-xs" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </form>
    </Modal>
  );
}

function TaskModal({ draft, onClose, onSave }: { draft: Task; onClose: () => void; onSave: (draft: Task) => Promise<void> }) {
  const [value, setValue] = useState<Task>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal title={draft.id ? 'Edit Task' : 'Add Task'} close={onClose}>
      <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave(value); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} placeholder="Title" required />
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="date" value={value.dueDate} onChange={(e) => setValue({ ...value, dueDate: e.target.value })} required />
        <select className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={value.recurring} onChange={(e) => setValue({ ...value, recurring: e.target.value as Task['recurring'] })}>
          <option value="none">One-time</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={value.reminder} onChange={(e) => setValue({ ...value, reminder: e.target.checked })} /> Reminder</label>
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] px-2 py-1 text-xs" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </form>
    </Modal>
  );
}

function BudgetModal({ draft, categories, currency, onClose, onSave }: { draft: any; categories: Category[]; currency: string; onClose: () => void; onSave: (input: any) => Promise<void> }) {
  const [categoryId, setCategoryId] = useState(draft?.categoryId ?? categories[0]?.id ?? '');
  const [limit, setLimit] = useState(draft?.limit ?? 0);
  const [month, setMonth] = useState(draft?.month ?? today().slice(0, 7));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal title={draft ? 'Edit Budget' : 'Add Budget'} close={onClose}>
      <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave({ categoryId, limit, month }); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <select className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="number" value={limit || ''} onChange={(e) => setLimit(Number(e.target.value))} placeholder={`Limit (${currency})`} required />
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] px-2 py-1 text-xs" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </form>
    </Modal>
  );
}

function GoalModal({ draft, currency, onClose, onSave }: { draft: Goal; currency: string; onClose: () => void; onSave: (draft: Goal) => Promise<void> }) {
  const [value, setValue] = useState<Goal>(draft);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  return (
    <Modal title={draft.id ? 'Edit Goal' : 'Add Goal'} close={onClose}>
      <form className="space-y-2" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave(value); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} placeholder="Name" required />
        <div className="grid grid-cols-2 gap-2">
          <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="number" value={value.target || ''} onChange={(e) => setValue({ ...value, target: Number(e.target.value) })} placeholder="Target" required />
          <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="number" value={value.saved || ''} onChange={(e) => setValue({ ...value, saved: Number(e.target.value) })} placeholder="Saved" required />
        </div>
        <input className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)] px-2 py-1 text-xs" type="date" value={value.targetDate ?? ''} onChange={(e) => setValue({ ...value, targetDate: e.target.value })} />
        {error && <p className="text-xs text-rose-600">{error}</p>}
        <button className="w-full rounded-md border border-slate-200 dark:border-[var(--line)] px-2 py-1 text-xs" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
      </form>
    </Modal>
  );
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/40 p-3">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 dark:border-[var(--line)] bg-[var(--surface)]">
        <div className="flex items-center justify-between px-3 py-2 border-b border-slate-200 dark:border-[var(--line)]">
          <h2 className="text-sm font-medium">{title}</h2>
          <button onClick={close}><X size={14} strokeWidth={1.25} /></button>
        </div>
        <div className="p-3">{children}</div>
      </div>
    </div>
  );
}
