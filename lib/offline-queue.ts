import type { Kind } from '@/lib/types';

export const OFFLINE_TRANSACTION_QUEUE_KEY = 'pocket-pilot:offline-transactions';

export type OfflineTransactionAction = 'create' | 'update';

export type QueuedTransaction = {
  queueId: string;
  userId: string;
  action: OfflineTransactionAction;
  transactionId?: string;
  title: string;
  amount: number;
  kind: Kind;
  category: string;
  categoryId?: string | null;
  date: string;
  notes?: string;
  queuedAt: string;
};

function isQueuedTransaction(value: unknown): value is QueuedTransaction {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<QueuedTransaction>;
  return (
    typeof item.queueId === 'string' &&
    typeof item.userId === 'string' &&
    (item.action === 'create' || item.action === 'update') &&
    typeof item.title === 'string' &&
    typeof item.amount === 'number' &&
    Number.isFinite(item.amount) &&
    (item.kind === 'income' || item.kind === 'expense') &&
    typeof item.category === 'string' &&
    typeof item.date === 'string' &&
    typeof item.queuedAt === 'string' &&
    (item.transactionId === undefined || typeof item.transactionId === 'string')
  );
}

function createQueueId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `q_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function readOfflineQueue(): QueuedTransaction[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(OFFLINE_TRANSACTION_QUEUE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isQueuedTransaction);
  } catch {
    return [];
  }
}

export function writeOfflineQueue(queue: QueuedTransaction[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_TRANSACTION_QUEUE_KEY, JSON.stringify(queue));
  } catch {
    /* Storage may be full or disabled; the UI still reports the failure path. */
  }
}

export function clearOfflineQueue() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_TRANSACTION_QUEUE_KEY);
  } catch {
    /* Ignore unavailable storage. */
  }
}

export function enqueueOfflineTransaction(
  input: Omit<QueuedTransaction, 'queueId' | 'queuedAt'>
): QueuedTransaction {
  const entry: QueuedTransaction = {
    ...input,
    queueId: createQueueId(),
    queuedAt: new Date().toISOString(),
  };
  writeOfflineQueue([...readOfflineQueue(), entry]);
  return entry;
}

export function updateOfflineTransaction(
  queueId: string,
  updates: Partial<Pick<QueuedTransaction, 'title' | 'amount' | 'kind' | 'category' | 'categoryId' | 'date' | 'notes'>>
) {
  const queue = readOfflineQueue().map((item) =>
    item.queueId === queueId ? { ...item, ...updates } : item
  );
  writeOfflineQueue(queue);
}

export function countOfflineQueue(userId?: string) {
  const queue = readOfflineQueue();
  return userId ? queue.filter((item) => item.userId === userId).length : queue.length;
}
