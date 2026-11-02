'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import {
  ArrowUpRight,
  BarChart3,
  Bell,
  Calculator,
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
import {
  clearOfflineQueue,
  enqueueOfflineTransaction,
  readOfflineQueue,
  updateOfflineTransaction,
  writeOfflineQueue,
  type QueuedTransaction,
} from '@/lib/offline-queue';
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
  loadNotificationSettings,
  loadUserData,
  saveNotificationSettings,
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

type DateRangePreset = 'today' | 'week' | 'month' | 'lastMonth' | 'year' | 'custom';

const DATE_RANGE_OPTIONS: { value: DateRangePreset; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Last 7 days' },
  { value: 'month', label: 'This month' },
  { value: 'lastMonth', label: 'Last month' },
  { value: 'year', label: 'This year' },
  { value: 'custom', label: 'Custom range' },
];

function localDateString(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const today = () => localDateString(new Date());

function reminderErrorMessage(err: unknown, fallback: string) {
  const message = err instanceof Error ? err.message : '';
  if (/user_notification_settings|schema cache|does not exist|relation/i.test(message)) {
    return 'Daily reminder settings are unavailable right now. You can keep using the app and retry later.';
  }
  return message || fallback;
}

function getDateRange(preset: DateRangePreset, customStart: string, customEnd: string) {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const monthEnd = (y: number, m: number) => new Date(y, m + 1, 0).getDate();

  if (preset === 'today') {
    const date = localDateString(now);
    return { start: date, end: date, label: 'Today' };
  }

  if (preset === 'week') {
    const start = new Date(now);
    start.setDate(start.getDate() - 6);
    return { start: localDateString(start), end: localDateString(now), label: 'Last 7 days' };
  }

  if (preset === 'month') {
    return {
      start: localDateString(new Date(year, month, 1)),
      end: localDateString(now),
      label: 'This month',
    };
  }

  if (preset === 'lastMonth') {
    const anchor = new Date(year, month - 1, 1);
    return {
      start: localDateString(anchor),
      end: localDateString(
        new Date(anchor.getFullYear(), anchor.getMonth(), monthEnd(anchor.getFullYear(), anchor.getMonth()))
      ),
      label: 'Last month',
    };
  }

  if (preset === 'year') {
    return { start: `${year}-01-01`, end: localDateString(now), label: 'This year' };
  }

  const fallback = localDateString(now);
  let start = customStart || fallback;
  let end = customEnd || fallback;
  if (start > end) [start, end] = [end, start];
  return { start, end, label: 'Custom range' };
}

function formatRangeDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return value;
  return new Date(year, month - 1, day).toLocaleDateString('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function buildSpendingSeries(
  expenses: Pick<Transaction, 'date' | 'amount'>[],
  preset: DateRangePreset,
  startDate: string,
  endDate: string
): { day: string; spending: number }[] {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const sumFor = (matches: (date: string) => boolean) =>
    expenses.filter((item) => matches(item.date)).reduce((sum, item) => sum + item.amount, 0);

  if (preset === 'year' || totalDays > 31) {
    const series: { day: string; spending: number }[] = [];
    let cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (cursor.getTime() <= end.getTime()) {
      const monthKey = cursor.toISOString().slice(0, 7);
      series.push({
        day: cursor.toLocaleDateString('en', { month: 'short', timeZone: 'UTC' }),
        spending: sumFor((date) => date.startsWith(monthKey)),
      });
      cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, 1));
    }
    return series;
  }

  const series: { day: string; spending: number }[] = [];
  for (let time = start.getTime(); time <= end.getTime(); time += 86_400_000) {
    const date = new Date(time);
    const dateKey = date.toISOString().slice(0, 10);
    series.push({
      day:
        totalDays <= 7
          ? date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })
          : String(date.getUTCDate()),
      spending: sumFor((itemDate) => itemDate === dateKey),
    });
  }
  return series;
}

function calculateExpression(expression: string): number | null {
  const tokens = expression.match(/\d+\.?\d*|\.\d+|[+\-*/]/g);
  if (!tokens || !tokens.length) return null;

  const numbers: number[] = [];
  const operators: string[] = [];
  const precedence: Record<string, number> = { '+': 1, '-': 1, '*': 2, '/': 2 };
  let expectNumber = true;

  const apply = () => {
    const operator = operators.pop();
    const right = numbers.pop();
    const left = numbers.pop();
    if (!operator || left === undefined || right === undefined) return false;

    if (operator === '+') numbers.push(left + right);
    else if (operator === '-') numbers.push(left - right);
    else if (operator === '*') numbers.push(left * right);
    else if (operator === '/') {
      if (right === 0) return false;
      numbers.push(left / right);
    }
    return true;
  };

  for (const token of tokens) {
    if (/^\d/.test(token) || token.startsWith('.')) {
      if (!expectNumber) return null;
      numbers.push(Number(token));
      expectNumber = false;
    } else {
      if (expectNumber) return null;
      while (operators.length && precedence[operators[operators.length - 1]] >= precedence[token]) {
        if (!apply()) return null;
      }
      operators.push(token);
      expectNumber = true;
    }
  }

  if (expectNumber) return null;
  while (operators.length) {
    if (!apply()) return null;
  }

  return numbers.length === 1 && Number.isFinite(numbers[0]) ? numbers[0] : null;
}

const CALCULATOR_KEYS = [
  '7',
  '8',
  '9',
  '/',
  '4',
  '5',
  '6',
  '*',
  '1',
  '2',
  '3',
  '-',
  '0',
  '.',
  '=',
  '+',
];

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<Data | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const offlineSyncInFlight = useRef(false);

  const [view, setView] = useState<View>('Dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const [transactionDraft, setTransactionDraft] = useState<Transaction | null>(null);
  const [taskDraft, setTaskDraft] = useState<Task | null>(null);
  const [budgetDraftId, setBudgetDraftId] = useState<string | null>(null);
  const [goalDraft, setGoalDraft] = useState<Goal | null>(null);
  const [dashboardRange, setDashboardRange] = useState<DateRangePreset>('week');
  const [dashboardCustomStart, setDashboardCustomStart] = useState(today());
  const [dashboardCustomEnd, setDashboardCustomEnd] = useState(today());

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

  function applyLocalTransaction(
    draft: Transaction,
    values: Pick<Transaction, 'title' | 'amount' | 'kind' | 'category' | 'date' | 'notes'>,
    optimisticId?: string
  ) {
    setData((previous) => {
      if (!previous) return previous;

      const categoryId = resolveCategoryId(values.category) ?? draft.categoryId;

      if (draft.id) {
        return {
          ...previous,
          transactions: previous.transactions.map((transaction) =>
            transaction.id === draft.id
              ? {
                  ...transaction,
                  title: values.title,
                  amount: values.amount,
                  kind: values.kind,
                  category: values.category,
                  categoryId,
                  date: values.date,
                  notes: values.notes,
                }
              : transaction
          ),
        };
      }

      const optimistic: Transaction = {
        id: `offline-${optimisticId ?? Date.now()}`,
        title: values.title,
        amount: values.amount,
        kind: values.kind,
        category: values.category,
        categoryId,
        date: values.date,
        notes: values.notes,
      };

      return { ...previous, transactions: [optimistic, ...previous.transactions] };
    });
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

  useEffect(() => {
    if (!session || !supabase) return;

    const client = supabase;
    const userId = session.user.id;
    let cancelled = false;

    async function syncOfflineQueue() {
      if (
        offlineSyncInFlight.current ||
        typeof navigator === 'undefined' ||
        !navigator.onLine
      ) {
        return;
      }

      const pending = readOfflineQueue().filter((item) => item.userId === userId);
      if (!pending.length) return;

      offlineSyncInFlight.current = true;
      setDataLoading(true);
      setError('');

      const syncedIds = new Set<string>();
      const failures: QueuedTransaction[] = [];

      for (const item of pending) {
        if (cancelled) break;

        try {
          const categoryId =
            item.categoryId ?? (await ensureCategory(client, userId, item.category));

          const payload = {
            title: item.title,
            amount: item.amount,
            kind: item.kind,
            categoryId,
            date: item.date,
            notes: item.notes,
          };

          if (item.action === 'update' && item.transactionId) {
            await updateTransaction(client, item.transactionId, payload);
          } else {
            await createTransaction(client, userId, payload);
          }

          syncedIds.add(item.queueId);
        } catch (err) {
          console.error('Failed to sync offline transaction:', err);
          failures.push(item);
        }
      }

      const remaining = readOfflineQueue().filter((item) => !syncedIds.has(item.queueId));
      if (remaining.length) {
        writeOfflineQueue(remaining);
      } else {
        clearOfflineQueue();
      }

      if (!cancelled) {
        if (syncedIds.size > 0) {
          await reloadData(userId);
          toast(
            `Synced ${syncedIds.size} offline transaction${syncedIds.size === 1 ? '' : 's'}.`
          );
        }

        if (failures.length) {
          setError(
            `${failures.length} offline transaction${
              failures.length === 1 ? '' : 's'
            } could not be synced and remain queued.`
          );
        }

        setDataLoading(false);
      }

      offlineSyncInFlight.current = false;
    }

    const handleOnline = () => {
      void syncOfflineQueue();
    };

    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      void syncOfflineQueue();
    }

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
  }, [session?.user?.id]);

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

  const activeRange = useMemo(
    () => getDateRange(dashboardRange, dashboardCustomStart, dashboardCustomEnd),
    [dashboardRange, dashboardCustomStart, dashboardCustomEnd]
  );

  const rangeTransactions = useMemo(
    () =>
      appData.transactions.filter(
        (transaction) => transaction.date >= activeRange.start && transaction.date <= activeRange.end
      ),
    [appData.transactions, activeRange.start, activeRange.end]
  );

  const rangeExpenses = useMemo(
    () => rangeTransactions.filter((transaction) => transaction.kind === 'expense'),
    [rangeTransactions]
  );

  const rangeIncome = useMemo(
    () => rangeTransactions.filter((transaction) => transaction.kind === 'income'),
    [rangeTransactions]
  );

  const rangeSpent = rangeExpenses.reduce((sum, transaction) => sum + transaction.amount, 0);
  const rangeEarned = rangeIncome.reduce((sum, transaction) => sum + transaction.amount, 0);
  const rangeBalance = rangeEarned - rangeSpent;

  const spending = useMemo(
    () => buildSpendingSeries(rangeExpenses, dashboardRange, activeRange.start, activeRange.end),
    [rangeExpenses, dashboardRange, activeRange.start, activeRange.end]
  );

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
    <div className="min-h-screen text-slate-900 lg:grid lg:grid-cols-[272px_1fr] dark:text-slate-100">
      <div
        aria-hidden={!mobileOpen}
        className={`fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          mobileOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-72 max-w-[85vw] flex-col overflow-y-auto border-r border-slate-200 bg-white/95 p-3.5 backdrop-blur-xl transition-transform duration-300 dark:border-slate-800 dark:bg-slate-900/95 lg:sticky lg:top-0 lg:h-screen lg:w-auto lg:max-w-none lg:translate-x-0 lg:border-slate-200/80 lg:bg-white/70 lg:p-4 lg:dark:border-slate-800 lg:dark:bg-slate-950/40 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-5 flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 p-2.5 dark:border-slate-800 dark:bg-slate-900/60">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-emerald-500/10 ring-1 ring-emerald-500/20">
            <PocketPilotLogo size={24} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Pocket Pilot</p>
            <p className="truncate text-xs text-slate-500 dark:text-slate-400">{session.user.email}</p>
          </div>
          <button
            className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation menu"
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400 dark:text-slate-500">
          Workspace
        </p>

        <nav className="space-y-1">
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
                className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  active
                    ? 'bg-emerald-500/10 text-emerald-700 ring-1 ring-inset ring-emerald-500/20 dark:text-emerald-300'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-100'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.6} />
                <span>{n}</span>
                {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-500" />}
              </button>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="mb-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 dark:border-slate-800 dark:bg-slate-900/50">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">Private & secure</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
              Your records are protected with row level security.
            </p>
          </div>
          <button
            onClick={() => setShowSignOutModal(true)}
            className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
          >
            <LogoutIcon size={18} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      <main className="flex min-h-screen min-w-0 flex-col">
        <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/70">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex min-w-0 items-center gap-3">
              <button
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white lg:hidden"
                onClick={() => setMobileOpen((v) => !v)}
                aria-label="Toggle navigation menu"
              >
                <Menu size={19} strokeWidth={1.75} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-[10px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
                  Pocket Pilot
                </p>
                <h1 className="truncate text-lg font-semibold leading-tight text-slate-900 dark:text-white sm:text-xl">
                  {view}
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <ThemeToggle />
              <button
                onClick={() => setShowSignOutModal(true)}
                className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white/70 text-slate-600 transition hover:border-rose-200 hover:bg-rose-500/10 hover:text-rose-600 active:scale-95 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-300 dark:hover:border-rose-500/30 dark:hover:bg-rose-500/10 dark:hover:text-rose-400"
                aria-label="Sign out"
                title="Sign out"
              >
                <LogoutIcon size={18} />
              </button>
            </div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-5 pb-28 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
          {dataLoading && (
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-900/70 dark:text-slate-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              Syncing your data...
            </div>
          )}
          {error && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50/80 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-300">
              <span>{error}</span>
              <button onClick={() => setError('')} className="shrink-0 rounded-md p-1 hover:bg-rose-500/10" aria-label="Dismiss error">
                <X size={14} strokeWidth={1.75} />
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

        <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-slate-200 bg-white/90 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1.5 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:hidden">
          <div className="mx-auto flex max-w-lg items-center justify-between gap-0.5">
            {mobileNavList.map((n) => {
              const Icon = icons[n];
              const active = view === n;
              return (
                <button
                  key={n}
                  onClick={() => setView(n)}
                  className={`flex min-h-12 flex-1 flex-col items-center justify-center gap-1 rounded-xl px-1 py-1 text-[10px] font-medium transition active:scale-95 ${
                    active
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100'
                  }`}
                >
                  <Icon size={18} strokeWidth={active ? 2.2 : 1.7} />
                  <span>{n}</span>
                </button>
              );
            })}
          </div>
        </nav>

        {notice && (
          <div
            role="status"
            className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-xl border border-slate-200 bg-white/95 px-4 py-3 text-xs font-medium text-slate-800 shadow-xl backdrop-blur-xl dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100 lg:bottom-8"
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
            className="fixed bottom-24 right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-emerald-500 text-slate-950 shadow-xl shadow-emerald-500/30 transition hover:scale-105 hover:bg-emerald-400 active:scale-95 lg:bottom-8 lg:right-8"
            aria-label={view === 'Tasks' ? 'Add task' : 'Add transaction'}
          >
            <Plus size={22} strokeWidth={2.25} />
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

            const values = parsed.data;
            const offline = typeof navigator !== 'undefined' && !navigator.onLine;

            if (offline) {
              if (!session) throw new Error('Sign in again to save this transaction.');

              if (draft.id.startsWith('offline-')) {
                updateOfflineTransaction(draft.id.slice('offline-'.length), {
                  title: values.title,
                  amount: values.amount,
                  kind: values.kind,
                  category: values.category,
                  categoryId: resolveCategoryId(values.category),
                  date: values.date,
                  notes: values.notes,
                });
                applyLocalTransaction(draft, values);
                setTransactionDraft(null);
                toast('Saved offline. Will sync when back online.');
                return;
              }

              const queued = enqueueOfflineTransaction({
                userId: session.user.id,
                action: draft.id ? 'update' : 'create',
                transactionId: draft.id || undefined,
                title: values.title,
                amount: values.amount,
                kind: values.kind,
                category: values.category,
                categoryId: resolveCategoryId(values.category),
                date: values.date,
                notes: values.notes,
              });

              applyLocalTransaction(draft, values, queued.queueId);
              setTransactionDraft(null);
              toast('Saved offline. Will sync when back online.');
              return;
            }

            const client = getClient();
            let catId = resolveCategoryId(values.category);

            if (!catId && session) {
              catId = await ensureCategory(client, session.user.id, values.category);
            }

            const payload = {
              title: values.title,
              amount: values.amount,
              kind: values.kind,
              categoryId: catId,
              date: values.date,
              notes: values.notes,
            };

            if (draft.id) {
              await runCloudAction(
                () => updateTransaction(client, draft.id, payload),
                'Transaction updated.'
              );
            } else {
              await runCloudAction(
                () => createTransaction(client, session.user.id, payload),
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
    const savingsRate =
      rangeEarned > 0 ? Math.max(0, Math.round((rangeBalance / rangeEarned) * 100)) : 0;
    const recent = [...rangeTransactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 4);

    return (
      <div className="space-y-5 sm:space-y-6">
        <section className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              Financial overview
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 dark:text-white sm:text-3xl">
              Welcome back
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Here is how your money is moving for {activeRange.label.toLowerCase()}.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center xl:justify-end">
            <label className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 dark:border-slate-800 dark:bg-slate-900/60">
              <CalendarDays size={15} className="text-emerald-600 dark:text-emerald-400" />
              <span className="sr-only">Dashboard date range</span>
              <select
                aria-label="Dashboard date range"
                value={dashboardRange}
                onChange={(e) => setDashboardRange(e.target.value as DateRangePreset)}
                className="bg-transparent text-xs font-semibold text-slate-700 outline-none dark:text-slate-200"
              >
                {DATE_RANGE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {dashboardRange === 'custom' && (
              <div className="flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white/70 px-3 text-[11px] text-slate-500 dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
                <input
                  type="date"
                  aria-label="Custom range start date"
                  value={dashboardCustomStart}
                  max={dashboardCustomEnd}
                  onChange={(e) => setDashboardCustomStart(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 outline-none dark:text-slate-200"
                />
                <span>to</span>
                <input
                  type="date"
                  aria-label="Custom range end date"
                  value={dashboardCustomEnd}
                  min={dashboardCustomStart}
                  onChange={(e) => setDashboardCustomEnd(e.target.value)}
                  className="bg-transparent font-medium text-slate-700 outline-none dark:text-slate-200"
                />
              </div>
            )}
            <button onClick={openAddTransaction} className="btn-primary w-full sm:w-auto">
              <Plus size={16} strokeWidth={2.25} /> Quick add
            </button>
          </div>
        </section>

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Net Balance" value={money(rangeBalance, userCurrency)} hint={`${savingsRate}% savings rate`} icon={WalletCards} tone="sky" />
          <StatCard label="Income" value={money(rangeEarned, userCurrency)} hint={`${rangeIncome.length} income entries`} icon={TrendingUp} tone="emerald" />
          <StatCard label="Spent" value={money(rangeSpent, userCurrency)} hint={`${rangeExpenses.length} expense entries`} icon={TrendingDown} tone="rose" />
          <StatCard label="Net Saved" value={money(rangeBalance, userCurrency)} hint={rangeBalance >= 0 ? 'On track this period' : 'Spending exceeds income'} icon={ArrowUpRight} tone="violet" />
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
          <div className="surface-card p-4 sm:p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Spending Velocity</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Expense trend over time</p>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                  <CalendarDays size={12} strokeWidth={2} /> {activeRange.label}
                </span>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                  {activeRange.start === activeRange.end
                    ? formatRangeDate(activeRange.start)
                    : `${formatRangeDate(activeRange.start)} – ${formatRangeDate(activeRange.end)}`}
                </p>
              </div>
            </div>
            <Chart data={spending} currency={userCurrency} />
          </div>

          <div className="surface-card flex flex-col p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Focus Queue</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Upcoming tasks</p>
              </div>
              <button onClick={openAddTask} className="icon-btn" aria-label="Add task">
                <Plus size={16} strokeWidth={2} />
              </button>
            </div>
            <div className="mt-4 flex-1 space-y-2.5">
              {pendingTasks.slice(0, 5).map((task) => (
                <div key={task.id} className="surface-inset flex items-center gap-3 px-3 py-2.5">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{task.title}</p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">Due {task.dueDate}</p>
                  </div>
                  <span className="rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold capitalize text-emerald-600 dark:text-emerald-400">
                    {task.recurring === 'none' ? 'Once' : task.recurring}
                  </span>
                </div>
              ))}
              {!pendingTasks.length && (
                <div className="grid min-h-32 place-items-center rounded-xl border border-dashed border-slate-200 px-4 text-center dark:border-slate-800">
                  <p className="text-xs text-slate-500 dark:text-slate-400">All clear. Nothing on your plate.</p>
                </div>
              )}
            </div>
            <button
              onClick={() => setView('Tasks')}
              className="mt-4 inline-flex min-h-10 items-center gap-1 self-start rounded-lg px-1 text-xs font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              View all tasks <ArrowUpRight size={13} strokeWidth={2} />
            </button>
          </div>
        </section>

        <section className="surface-card p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Recent Activity</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Latest money movements</p>
            </div>
            <button onClick={() => setView('Transactions')} className="text-xs font-semibold text-emerald-600 transition hover:text-emerald-500 dark:text-emerald-400 dark:hover:text-emerald-300">
              View all
            </button>
          </div>
          {recent.length ? (
            <div className="grid gap-2.5 md:grid-cols-2">
              {recent.map((t) => (
                <div key={t.id} className="surface-inset flex items-center gap-3 p-3">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${t.kind === 'income' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                    {t.kind === 'income' ? <TrendingUp size={16} strokeWidth={1.75} /> : <TrendingDown size={16} strokeWidth={1.75} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{t.category} · {t.date}</p>
                  </div>
                  <p className={`shrink-0 text-xs font-semibold ${t.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                    {t.kind === 'income' ? '+' : '-'}{money(t.amount, userCurrency)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-slate-200 py-8 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              No transactions yet. Add your first entry to get started.
            </p>
          )}
        </section>
      </div>
    );
  }

  function Transactions() {
    const sorted = [...appData.transactions].sort((a, b) => b.date.localeCompare(a.date));
    return (
      <section className="surface-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Income and Expenses</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Your complete transaction ledger</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => downloadCsv(csv(appData.transactions))} className="btn-secondary flex-1 sm:flex-none">
              <Download size={15} strokeWidth={1.75} /> Export CSV
            </button>
            <button onClick={openAddTransaction} className="btn-primary flex-1 sm:flex-none">
              <Plus size={15} strokeWidth={2} /> New
            </button>
          </div>
        </div>

        {sorted.length ? (
          <>
            <div className="mt-5 hidden overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 md:block">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 dark:bg-slate-950/50 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 font-semibold">Title</th>
                    <th className="px-4 py-3 font-semibold">Category</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    <th className="px-4 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((t) => (
                    <tr key={t.id} className="border-t border-slate-200/80 transition hover:bg-slate-50/70 dark:border-slate-800 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{t.date}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{t.title}</td>
                      <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{t.category}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize ${
                          t.kind === 'income'
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                        }`}>
                          {t.kind}
                        </span>
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${t.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                        {t.kind === 'income' ? '+' : '-'}{money(t.amount, userCurrency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => setTransactionDraft(t)} className="icon-btn h-8 w-8" aria-label="Edit transaction"><Pencil size={14} strokeWidth={1.75} /></button>
                          <button onClick={() => void deleteEntity('transaction', t.id)} className="icon-btn h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" aria-label="Delete transaction"><Trash2 size={14} strokeWidth={1.75} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-4 space-y-2.5 md:hidden">
              {sorted.map((t) => (
                <div key={t.id} className="surface-inset flex items-center gap-3 p-3">
                  <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.kind === 'income' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'}`}>
                    {t.kind === 'income' ? <TrendingUp size={17} strokeWidth={1.75} /> : <TrendingDown size={17} strokeWidth={1.75} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                    <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{t.category} · {t.date}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-semibold ${t.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {t.kind === 'income' ? '+' : '-'}{money(t.amount, userCurrency)}
                    </p>
                    <div className="mt-1 flex justify-end gap-1">
                      <button onClick={() => setTransactionDraft(t)} className="rounded-md p-1 text-slate-500 hover:bg-slate-200/70 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Edit transaction"><Pencil size={13} strokeWidth={1.75} /></button>
                      <button onClick={() => void deleteEntity('transaction', t.id)} className="rounded-md p-1 text-slate-500 hover:bg-rose-500/10 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400" aria-label="Delete transaction"><Trash2 size={13} strokeWidth={1.75} /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-800">
            <ReceiptText size={28} className="mx-auto text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
            <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">No transactions yet</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Log your first income or expense to see it here.</p>
          </div>
        )}
      </section>
    );
  }

  function Budgets() {
    const month = today().slice(0, 7);
    return (
      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Budgets</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Category spending caps for this month</p>
          </div>
          <button className="btn-primary w-full sm:w-auto" onClick={() => setBudgetDraftId('')}>
            <Plus size={15} strokeWidth={2} /> Add budget
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {appData.budgets.map((b) => {
            const used = expenses.filter((e) => e.categoryId === b.categoryId && e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0);
            const rawRatio = b.limit > 0 ? (used / b.limit) * 100 : 0;
            const ratio = Math.min(100, rawRatio);
            const over = rawRatio >= 100;
            const warning = rawRatio >= 80 && !over;
            return (
              <div className="surface-card p-5 transition hover:border-slate-300 dark:hover:border-slate-700" key={b.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{b.category}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {money(used, userCurrency)} of {money(b.limit, userCurrency)}
                    </p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                    over
                      ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : warning
                        ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                        : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                  }`}>
                    {over ? 'Over limit' : `${Math.round(rawRatio)}%`}
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div
                    className={`h-full rounded-full bg-gradient-to-r ${
                      over ? 'from-rose-500 to-rose-400' : warning ? 'from-amber-500 to-amber-400' : 'from-emerald-500 to-emerald-400'
                    }`}
                    style={{ width: `${ratio}%` }}
                  />
                </div>
                <div className="mt-4 flex items-center justify-end gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <button onClick={() => setBudgetDraftId(b.id)} className="icon-btn h-8 w-8" aria-label="Edit budget"><Pencil size={14} strokeWidth={1.75} /></button>
                  <button onClick={() => void deleteEntity('budget', b.id)} className="icon-btn h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" aria-label="Delete budget"><Trash2 size={14} strokeWidth={1.75} /></button>
                </div>
              </div>
            );
          })}
          {!appData.budgets.length && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-800">
              <WalletCards size={28} className="mx-auto text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">No budgets yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Create a cap to keep each category in check.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  function Goals() {
    return (
      <section>
        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Goals</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Savings milestones you are working toward</p>
          </div>
          <button className="btn-primary w-full sm:w-auto" onClick={() => setGoalDraft({ id: '', name: '', target: 0, saved: 0, targetDate: '' })}>
            <Plus size={15} strokeWidth={2} /> Add goal
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {appData.goals.map((g) => {
            const ratio = g.target > 0 ? Math.min(100, (g.saved / g.target) * 100) : 0;
            return (
              <div className="surface-card p-5 transition hover:border-slate-300 dark:hover:border-slate-700" key={g.id}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{g.name}</p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {money(g.saved, userCurrency)} of {money(g.target, userCurrency)}
                    </p>
                  </div>
                  <span className="rounded-full bg-sky-500/10 px-2 py-1 text-[10px] font-semibold text-sky-600 dark:text-sky-400">
                    {ratio.toFixed(0)}%
                  </span>
                </div>
                <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-400" style={{ width: `${ratio}%` }} />
                </div>
                <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">
                    {g.targetDate ? `Target ${g.targetDate}` : 'No target date'}
                  </span>
                  <div className="flex items-center gap-1">
                    <button onClick={() => setGoalDraft(g)} className="icon-btn h-8 w-8" aria-label="Edit goal"><Pencil size={14} strokeWidth={1.75} /></button>
                    <button onClick={() => void deleteEntity('goal', g.id)} className="icon-btn h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" aria-label="Delete goal"><Trash2 size={14} strokeWidth={1.75} /></button>
                  </div>
                </div>
              </div>
            );
          })}
          {!appData.goals.length && (
            <div className="col-span-full rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-800">
              <Target size={28} className="mx-auto text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">No goals yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Set a savings target and watch it grow.</p>
            </div>
          )}
        </div>
      </section>
    );
  }

  function TasksView() {
    const open = appData.tasks.filter((t) => !t.completed);
    const done = appData.tasks.filter((t) => t.completed);
    return (
      <section className="surface-card p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tasks</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {open.length} open · {done.length} completed
            </p>
          </div>
          <button onClick={openAddTask} className="btn-primary w-full sm:w-auto">
            <Plus size={15} strokeWidth={2} /> Add task
          </button>
        </div>
        <div className="mt-5 space-y-2.5">
          {appData.tasks.map((t) => (
            <label
              key={t.id}
              className={`group flex items-center gap-3 rounded-xl border p-3.5 transition ${
                t.completed
                  ? 'border-slate-200/70 bg-slate-50/60 dark:border-slate-800/60 dark:bg-slate-950/30'
                  : 'border-slate-200 bg-white hover:border-emerald-400/50 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-emerald-500/40'
              }`}
            >
              <input
                type="checkbox"
                checked={t.completed}
                onChange={() => updateTaskCompletion(t)}
                className="h-5 w-5 shrink-0 rounded border-slate-300 accent-emerald-500 dark:border-slate-600"
              />
              <div className="min-w-0 flex-1">
                <p className={`truncate text-sm font-medium ${t.completed ? 'line-through text-slate-400 dark:text-slate-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {t.title}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Due {t.dueDate}</span>
                  {t.recurring !== 'none' && (
                    <span className="rounded-full bg-slate-100 px-1.5 py-0.5 font-medium capitalize dark:bg-slate-800">
                      {t.recurring}
                    </span>
                  )}
                  {t.reminder && (
                    <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 font-medium text-amber-600 dark:text-amber-400">
                      Reminder
                    </span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <button onClick={(e) => { e.preventDefault(); setTaskDraft(t); }} className="icon-btn h-8 w-8" aria-label="Edit task"><Pencil size={14} strokeWidth={1.75} /></button>
                <button onClick={(e) => { e.preventDefault(); void deleteEntity('task', t.id); }} className="icon-btn h-8 w-8 hover:bg-rose-500/10 hover:text-rose-600 dark:hover:text-rose-400" aria-label="Delete task"><Trash2 size={14} strokeWidth={1.75} /></button>
              </div>
            </label>
          ))}
          {!appData.tasks.length && (
            <div className="rounded-xl border border-dashed border-slate-200 py-14 text-center dark:border-slate-800">
              <CheckCircle2 size={28} className="mx-auto text-slate-300 dark:text-slate-600" strokeWidth={1.25} />
              <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">No tasks yet</p>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Add a reminder to stay on top of your money goals.</p>
            </div>
          )}
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
    const monthLabel = now.toLocaleDateString('en', { month: 'long', year: 'numeric' });

    const dailyExpenseMap = useMemo(() => {
      const map = new Map<string, number>();
      expenses.forEach((e) => {
        map.set(e.date, (map.get(e.date) || 0) + e.amount);
      });
      return map;
    }, [expenses]);

    const selectedDateTxns = selectedDate ? appData.transactions.filter((t) => t.date === selectedDate) : [];

    return (
      <section className="surface-card p-4 sm:p-6">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Calendar</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">{monthLabel} · Daily expense summary</p>
          </div>
          <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
            This month
          </span>
        </div>
        <div className="grid grid-cols-7 gap-1.5 text-center sm:gap-2">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="py-1.5 text-[11px] font-semibold uppercase text-slate-400 dark:text-slate-500">{d}</div>
          ))}
          {blanks.map((b) => <div key={`b${b}`} />)}
          {days.map((day) => {
            const dateStr = new Date(year, month, day).toISOString().slice(0, 10);
            const total = dailyExpenseMap.get(dateStr) || 0;
            const isToday = dateStr === today();
            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`flex min-h-16 flex-col rounded-xl border p-1.5 text-left transition active:scale-95 sm:min-h-20 sm:p-2 ${
                  isToday
                    ? 'border-emerald-500/60 bg-emerald-500/5 ring-1 ring-emerald-500/20'
                    : 'border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700'
                }`}
              >
                <span className={`text-[11px] font-semibold ${isToday ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-700 dark:text-slate-300'}`}>
                  {day}
                </span>
                {total > 0 && (
                  <span className="mt-auto truncate text-[9px] font-medium text-rose-500 dark:text-rose-400 sm:text-[10px]">
                    -{money(total, userCurrency)}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {selectedDate && (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={() => setSelectedDate(null)}>
            <div
              className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl sm:p-5"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-white">{selectedDate}</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {selectedDateTxns.length} transaction{selectedDateTxns.length === 1 ? '' : 's'}
                  </p>
                </div>
                <button onClick={() => setSelectedDate(null)} className="icon-btn" aria-label="Close day summary"><X size={16} strokeWidth={1.75} /></button>
              </div>
              <div className="mt-3 max-h-[55vh] space-y-2 overflow-auto">
                {selectedDateTxns.length ? selectedDateTxns.map((t) => (
                  <div key={t.id} className="surface-inset flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-900 dark:text-slate-100">{t.title}</p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{t.category}</p>
                    </div>
                    <span className={`shrink-0 text-xs font-semibold ${t.kind === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-900 dark:text-slate-100'}`}>
                      {t.kind === 'income' ? '+' : '-'}{money(t.amount, userCurrency)}
                    </span>
                  </div>
                )) : (
                  <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    No transactions on this day.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </section>
    );
  }

  function Reports() {
    const groups = categories.map((c) => ({ category: c.name, total: expenses.filter((e) => e.categoryId === c.id || e.category.toLowerCase() === c.name.toLowerCase()).reduce((sum, e) => sum + e.amount, 0) })).filter((x) => x.total > 0);
    const savingsRate = earned > 0 ? Math.max(0, Math.round((balance / earned) * 100)) : 0;
    return (
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="surface-card p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Spending by Category</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">Where your money goes</p>
            </div>
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {groups.length} categories
            </span>
          </div>
          <div className="space-y-4">
            {groups.map((g) => {
              const pct = Math.min(100, (g.total / (spent || 1)) * 100);
              return (
                <div key={g.category}>
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-slate-700 dark:text-slate-200">{g.category}</span>
                    <span className="shrink-0 text-slate-500 dark:text-slate-400">{money(g.total, userCurrency)} · {Math.round(pct)}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-sky-400" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {!groups.length && (
              <p className="rounded-xl border border-dashed border-slate-200 py-10 text-center text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
                No spending data yet.
              </p>
            )}
          </div>
        </div>
        <div className="surface-card p-5">
          <div className="mb-5">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Analytics</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">A quick snapshot of your activity</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="surface-inset p-4">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Transactions</p>
              <p className="mt-1.5 text-xl font-semibold text-slate-900 dark:text-white">{appData.transactions.length}</p>
            </div>
            <div className="surface-inset p-4">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Savings Rate</p>
              <p className="mt-1.5 text-xl font-semibold text-emerald-600 dark:text-emerald-400">{savingsRate}%</p>
            </div>
            <div className="surface-inset p-4">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Income</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{money(earned, userCurrency)}</p>
            </div>
            <div className="surface-inset p-4">
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">Total Spent</p>
              <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">{money(spent, userCurrency)}</p>
            </div>
          </div>
          <button onClick={() => downloadCsv(csv(appData.transactions))} className="btn-secondary mt-5 w-full">
            <Download size={15} strokeWidth={1.75} /> Download CSV
          </button>
        </div>
      </section>
    );
  }

  function SettingsPage() {
    const [displayName, setDisplayName] = useState(appData.profile?.displayName || activeUser?.user_metadata?.full_name || '');
    const [selectedCurrency, setSelectedCurrency] = useState(userCurrency);
    const [saving, setSaving] = useState(false);
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderTime, setReminderTime] = useState('09:00');
    const [reminderLoading, setReminderLoading] = useState(true);
    const [reminderSaving, setReminderSaving] = useState(false);
    const [reminderError, setReminderError] = useState('');
    const [reminderReloadToken, setReminderReloadToken] = useState(0);
    const [notificationPermission, setNotificationPermission] =
      useState<NotificationPermission>('default');

    useEffect(() => {
      let cancelled = false;

      setReminderError('');

      if (!activeUser || !supabase) {
        setReminderLoading(false);
        return;
      }

      if (typeof Notification !== 'undefined') {
        setNotificationPermission(Notification.permission);
      }

      setReminderLoading(true);

      loadNotificationSettings(supabase, activeUser.id)
        .then((settings) => {
          if (cancelled) return;
          setReminderEnabled(settings.enabled);
          setReminderTime(settings.time);
        })
        .catch((err) => {
          if (cancelled) return;
          setReminderEnabled(false);
          setReminderTime('09:00');
          setReminderError(
            reminderErrorMessage(err, 'Daily reminder settings are temporarily unavailable.')
          );
        })
        .finally(() => {
          if (!cancelled) setReminderLoading(false);
        });

      return () => {
        cancelled = true;
      };
    }, [activeUser?.id, reminderReloadToken]);

    async function handleReminderToggle(next: boolean) {
      if (next && typeof Notification !== 'undefined') {
        try {
          const permission =
            Notification.permission === 'default'
              ? await Notification.requestPermission()
              : Notification.permission;
          setNotificationPermission(permission);
          if (permission !== 'granted') {
            toast('Browser notifications are blocked. Enable them in your browser settings.');
          }
        } catch {
          toast('Could not request notification permission.');
        }
      }
      setReminderEnabled(next);
    }

    async function handleSaveReminder() {
      if (!activeUser) return;
      setReminderSaving(true);
      setReminderError('');

      try {
        if (
          reminderEnabled &&
          typeof Notification !== 'undefined' &&
          Notification.permission === 'default'
        ) {
          setNotificationPermission(await Notification.requestPermission());
        }

        const client = getClient();
        await saveNotificationSettings(client, activeUser.id, {
          enabled: reminderEnabled,
          time: reminderTime,
        });
        toast('Daily reminder settings saved.');
      } catch (err) {
        setReminderError(
          reminderErrorMessage(err, 'Could not save reminder settings. Please try again.')
        );
      } finally {
        setReminderSaving(false);
      }
    }

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
      <div className="space-y-5">
        <div className="surface-card p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <User size={20} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">Profile</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">Manage your account and display preferences</p>
            </div>
          </div>
          <form onSubmit={handleSaveProfile} className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Email address</label>
              <input className="field opacity-70" value={activeUser?.email ?? ''} disabled />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Display name</label>
              <input className="field" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Display name" />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Preferred currency</label>
              <select className="field" value={selectedCurrency} onChange={(e) => setSelectedCurrency(e.target.value)}>
                {SUPPORTED_CURRENCIES.map((curr) => (
                  <option key={curr.code} value={curr.code}>{curr.code} · {curr.name}</option>
                ))}
              </select>
            </div>
            <div className="flex sm:col-span-2 sm:justify-end">
              <button type="submit" disabled={saving} className="btn-primary w-full sm:w-auto">
                {saving ? 'Saving...' : 'Save changes'}
              </button>
            </div>
          </form>
        </div>

        <div className="surface-card p-5 sm:p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Bell size={20} strokeWidth={1.75} />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">Daily Reminder</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Get a gentle nudge to review your money each day.
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reminderEnabled}
              aria-label="Toggle daily reminder"
              onClick={() => void handleReminderToggle(!reminderEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition ${
                reminderEnabled
                  ? 'border-emerald-500 bg-emerald-500'
                  : 'border-slate-300 bg-slate-200 dark:border-slate-700 dark:bg-slate-800'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                  reminderEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
            <div>
              <label
                htmlFor="reminder-time"
                className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300"
              >
                Reminder time
              </label>
              <input
                id="reminder-time"
                type="time"
                className="field max-w-[180px]"
                value={reminderTime}
                onChange={(e) => setReminderTime(e.target.value)}
                disabled={reminderLoading}
                required
              />
              <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
                {reminderLoading
                  ? 'Loading your reminder preferences...'
                  : notificationPermission === 'granted'
                    ? 'Browser notifications are enabled.'
                    : notificationPermission === 'denied'
                      ? 'Notifications are blocked in your browser settings.'
                      : 'You will be asked for notification permission when you enable this reminder.'}
              </p>
              {reminderError && (
                <div
                  role="status"
                  className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-amber-500/20 bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-300"
                >
                  <span className="min-w-0 flex-1">{reminderError}</span>
                  <button
                    type="button"
                    onClick={() => setReminderReloadToken((token) => token + 1)}
                    className="font-semibold underline underline-offset-2 hover:text-amber-900 dark:hover:text-amber-200"
                  >
                    Retry
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => void handleSaveReminder()}
              disabled={reminderSaving || reminderLoading}
              className="btn-primary w-full sm:w-auto"
            >
              {reminderSaving ? 'Saving...' : 'Save reminder'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div className="surface-card flex flex-col p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <MessageSquare size={18} strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Help & Support</h3>
            </div>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Need a hand with budgets, exports, or your account? Our support team usually replies within 24 hours.
            </p>
            <button onClick={() => setShowSupportModal(true)} className="btn-secondary mt-4 w-full">
              <MessageSquare size={15} strokeWidth={1.75} /> Contact support
            </button>
          </div>

          <div className="surface-card flex flex-col p-5">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 size={18} strokeWidth={1.75} />
              </div>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Data & Privacy</h3>
            </div>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
              Your financial records are private to your account and protected with row level security.
            </p>
            <div className="mt-4 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-3 py-2.5 text-[11px] font-medium text-emerald-700 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Securely synced and encrypted in transit
            </div>
          </div>
        </div>
      </div>
    );
  }
}

const statTones = {
  emerald: {
    badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    bar: 'from-emerald-500 to-emerald-400',
    dot: 'bg-emerald-500',
  },
  rose: {
    badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    bar: 'from-rose-500 to-rose-400',
    dot: 'bg-rose-500',
  },
  sky: {
    badge: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    bar: 'from-sky-500 to-sky-400',
    dot: 'bg-sky-500',
  },
  violet: {
    badge: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    bar: 'from-violet-500 to-violet-400',
    dot: 'bg-violet-500',
  },
} as const;

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ElementType;
  tone: keyof typeof statTones;
}) {
  const colors = statTones[tone];
  return (
    <div className="surface-card relative overflow-hidden p-4 sm:p-5">
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${colors.bar} opacity-80`} />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-2 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums dark:text-white">
            {value}
          </p>
        </div>
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${colors.badge}`}>
          <Icon size={18} strokeWidth={1.75} />
        </span>
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        <span className={`h-1.5 w-1.5 rounded-full ${colors.dot}`} />
        {hint}
      </p>
    </div>
  );
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
  const [calcOpen, setCalcOpen] = useState(false);
  const [calcExpression, setCalcExpression] = useState('');
  const [calcError, setCalcError] = useState('');

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

  function toggleCalculator() {
    if (!calcOpen) {
      setCalcExpression(value.amount ? String(value.amount) : '');
      setCalcError('');
    }
    setCalcOpen((open) => !open);
  }

  function pressCalculatorKey(key: string) {
    setCalcError('');

    if (key === 'C') {
      setCalcExpression('');
      return;
    }

    if (key === 'backspace') {
      setCalcExpression((expression) => expression.slice(0, -1));
      return;
    }

    if (key === '=') {
      const result = calculateExpression(calcExpression);
      if (result === null) {
        setCalcError('Invalid expression');
        return;
      }
      const rounded = Math.round(result * 100) / 100;
      setCalcExpression(String(rounded));
      setValue((current) => ({ ...current, amount: rounded }));
      return;
    }

    if (key === '+' || key === '-' || key === '*' || key === '/') {
      setCalcExpression((expression) => {
        if (!expression) return key === '-' ? '-' : expression;
        if (/[+\-*/]$/.test(expression)) return `${expression.slice(0, -1)}${key}`;
        return `${expression}${key}`;
      });
      return;
    }

    if (key === '.') {
      setCalcExpression((expression) => {
        const lastNumber = expression.split(/[+\-*/]/).pop() ?? '';
        if (lastNumber.includes('.')) return expression;
        return lastNumber ? `${expression}.` : `${expression}0.`;
      });
      return;
    }

    setCalcExpression((expression) => `${expression}${key}`);
  }

  return (
    <Modal title={draft.id ? 'Edit Transaction' : 'Add Transaction'} close={onClose}>
      <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave(value); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <div>
          <span className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Transaction type</span>
          <div className="grid grid-cols-2 gap-1.5 rounded-2xl border border-slate-200 bg-slate-100/80 p-1.5 dark:border-slate-800 dark:bg-slate-950/50">
            <button
              type="button"
              aria-pressed={value.kind === 'income'}
              onClick={() => handleKindChange('income')}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                value.kind === 'income'
                  ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/25'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200'
              }`}
            >
              <TrendingUp size={16} strokeWidth={2} /> Income
            </button>
            <button
              type="button"
              aria-pressed={value.kind === 'expense'}
              onClick={() => handleKindChange('expense')}
              className={`inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
                value.kind === 'expense'
                  ? 'bg-rose-500 text-white shadow-md shadow-rose-500/25'
                  : 'text-slate-500 hover:bg-white/70 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800/70 dark:hover:text-slate-200'
              }`}
            >
              <TrendingDown size={16} strokeWidth={2} /> Expense
            </button>
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Title</label>
          <input className="field" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} placeholder="e.g. Grocery run" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Amount ({currency})</label>
          <div className="relative">
            <input
              className="field pr-12"
              type="number"
              value={value.amount || ''}
              onChange={(e) => setValue({ ...value, amount: Number(e.target.value) })}
              placeholder="0"
              required
            />
            <button
              type="button"
              onClick={toggleCalculator}
              aria-label="Toggle quick calculator"
              aria-expanded={calcOpen}
              className={`absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg transition ${
                calcOpen
                  ? 'bg-emerald-500 text-slate-950'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white'
              }`}
            >
              <Calculator size={16} strokeWidth={1.9} />
            </button>
          </div>
          {calcOpen && (
            <div className="mt-2 rounded-2xl border border-slate-200 bg-slate-50/80 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-950/60">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400 dark:text-slate-500">
                  Quick calculator
                </p>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => pressCalculatorKey('backspace')}
                    className="grid h-7 w-7 place-items-center rounded-md text-xs font-semibold text-slate-500 hover:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-slate-800"
                    aria-label="Backspace"
                  >
                    ⌫
                  </button>
                  <button
                    type="button"
                    onClick={() => pressCalculatorKey('C')}
                    className="grid h-7 w-7 place-items-center rounded-md text-xs font-semibold text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
                    aria-label="Clear calculator"
                  >
                    C
                  </button>
                </div>
              </div>
              <div className="mt-2 min-h-10 overflow-x-auto rounded-lg bg-white px-3 py-2 text-right font-mono text-sm font-semibold text-slate-900 dark:bg-slate-900 dark:text-white">
                {calcExpression ? calcExpression.replace(/\*/g, '×').replace(/\//g, '÷') : '0'}
              </div>
              {calcError && (
                <p className="mt-1.5 text-[11px] font-medium text-rose-600 dark:text-rose-400">
                  {calcError}
                </p>
              )}
              <div className="mt-2 grid grid-cols-4 gap-1.5">
                {CALCULATOR_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => pressCalculatorKey(key)}
                    className={`grid h-9 place-items-center rounded-lg text-sm font-semibold transition active:scale-95 ${
                      key === '='
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : key === '+' || key === '-' || key === '*' || key === '/'
                          ? 'bg-slate-200/80 text-slate-700 hover:bg-slate-300/80 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700'
                          : 'bg-white text-slate-800 hover:bg-slate-100 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800'
                    }`}
                  >
                    {key === '*' ? '×' : key === '/' ? '÷' : key}
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] text-slate-400 dark:text-slate-500">
                Press = to fill the amount.
              </p>
            </div>
          )}
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label>
          <select className="field" value={value.category} onChange={(e) => setValue({ ...value, category: e.target.value })}>
            {categoryOptions.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Date</label>
          <input className="field" type="date" value={value.date} onChange={(e) => setValue({ ...value, date: e.target.value })} required />
        </div>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Save transaction'}</button>
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
      <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave(value); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Task title</label>
          <input className="field" value={value.title} onChange={(e) => setValue({ ...value, title: e.target.value })} placeholder="e.g. Review monthly budget" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Due date</label>
            <input className="field" type="date" value={value.dueDate} onChange={(e) => setValue({ ...value, dueDate: e.target.value })} required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Repeat</label>
            <select className="field" value={value.recurring} onChange={(e) => setValue({ ...value, recurring: e.target.value as Task['recurring'] })}>
              <option value="none">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <label className="flex min-h-11 items-center gap-2.5 rounded-xl border border-slate-200 px-3 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
          <input type="checkbox" checked={value.reminder} onChange={(e) => setValue({ ...value, reminder: e.target.checked })} className="h-4 w-4 rounded accent-emerald-500" />
          Enable reminder
        </label>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Save task'}</button>
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
      <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave({ categoryId, limit, month }); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Category</label>
          <select className="field" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Monthly limit ({currency})</label>
          <input className="field" type="number" value={limit || ''} onChange={(e) => setLimit(Number(e.target.value))} placeholder="0" required />
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Month</label>
          <input className="field" type="month" value={month} onChange={(e) => setMonth(e.target.value)} required />
        </div>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Save budget'}</button>
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
      <form className="space-y-3.5" onSubmit={async (e) => { e.preventDefault(); setSaving(true); setError(''); try { await onSave(value); } catch (err) { setError(err instanceof Error ? err.message : 'Failed'); } finally { setSaving(false); } }}>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Goal name</label>
          <input className="field" value={value.name} onChange={(e) => setValue({ ...value, name: e.target.value })} placeholder="e.g. Emergency fund" required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Target ({currency})</label>
            <input className="field" type="number" value={value.target || ''} onChange={(e) => setValue({ ...value, target: Number(e.target.value) })} placeholder="0" required />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Saved ({currency})</label>
            <input className="field" type="number" value={value.saved || ''} onChange={(e) => setValue({ ...value, saved: Number(e.target.value) })} placeholder="0" required />
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-slate-300">Target date</label>
          <input className="field" type="date" value={value.targetDate ?? ''} onChange={(e) => setValue({ ...value, targetDate: e.target.value })} />
        </div>
        {error && <p className="rounded-lg bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-400">{error}</p>}
        <button className="btn-primary w-full" disabled={saving}>{saving ? 'Saving...' : 'Save goal'}</button>
      </form>
    </Modal>
  );
}

function Modal({ title, close, children }: { title: string; close: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/70 backdrop-blur-sm sm:items-center sm:p-4" onClick={close}>
      <div
        className="w-full max-w-md rounded-t-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900 sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3.5 dark:border-slate-800 sm:px-5">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h2>
          <button onClick={close} className="icon-btn h-8 w-8" aria-label="Close dialog"><X size={16} strokeWidth={1.75} /></button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-5">{children}</div>
      </div>
    </div>
  );
}
