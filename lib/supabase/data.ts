import { SupabaseClient } from '@supabase/supabase-js';
import { Category, Data, Goal, Profile, Task, Transaction } from '@/lib/types';

type CategoryRow = { id: string; name: string; color: string | null };
type TransactionRow = {
  id: string;
  title: string;
  amount: number;
  kind: 'income' | 'expense';
  occurred_on: string;
  notes: string | null;
  category_id: string | null;
  categories: { name: string } | { name: string }[] | null;
};
type BudgetRow = {
  id: string;
  amount: number;
  month: string;
  category_id: string;
  categories: { name: string } | { name: string }[] | null;
};
type GoalRow = { id: string; name: string; target_amount: number; saved_amount: number; target_date: string | null };
type TaskRow = {
  id: string;
  title: string;
  due_on: string;
  completed: boolean;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly';
  reminder_at: string | null;
};
type ProfileRow = { display_name: string | null; currency: string | null };

function pickName(joined: { name: string } | { name: string }[] | null, fallback: string) {
  if (!joined) return fallback;
  if (Array.isArray(joined)) return joined[0]?.name ?? fallback;
  return joined.name;
}

function toMonthDate(month: string) {
  return `${month}-01`;
}

export async function loadUserData(client: SupabaseClient, userId: string): Promise<Data> {
  const [profileRes, categoriesRes, transactionsRes, budgetsRes, goalsRes, tasksRes] = await Promise.all([
    client.from('profiles').select('display_name,currency').eq('id', userId).maybeSingle<ProfileRow>(),
    client.from('categories').select('id,name,color').order('name', { ascending: true }).returns<CategoryRow[]>(),
    client
      .from('transactions')
      .select('id,title,amount,kind,occurred_on,notes,category_id,categories(name)')
      .order('occurred_on', { ascending: false })
      .returns<TransactionRow[]>(),
    client
      .from('budgets')
      .select('id,amount,month,category_id,categories(name)')
      .order('month', { ascending: false })
      .returns<BudgetRow[]>(),
    client.from('savings_goals').select('id,name,target_amount,saved_amount,target_date').order('created_at', { ascending: false }).returns<GoalRow[]>(),
    client.from('tasks').select('id,title,due_on,completed,recurrence,reminder_at').order('due_on', { ascending: true }).returns<TaskRow[]>(),
  ]);

  for (const result of [profileRes, categoriesRes, transactionsRes, budgetsRes, goalsRes, tasksRes]) {
    if (result.error) throw new Error(result.error.message);
  }

  const categories: Category[] = (categoriesRes.data ?? []).map((c) => ({ id: c.id, name: c.name, color: c.color ?? '#18a882' }));
  const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

  const transactions: Transaction[] = (transactionsRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    amount: Number(t.amount),
    kind: t.kind,
    date: t.occurred_on,
    notes: t.notes ?? undefined,
    categoryId: t.category_id,
    category: t.category_id ? categoryMap.get(t.category_id) ?? pickName(t.categories, 'Uncategorized') : 'Uncategorized',
  }));

  const budgets = (budgetsRes.data ?? []).map((b) => ({
    id: b.id,
    categoryId: b.category_id,
    category: categoryMap.get(b.category_id) ?? pickName(b.categories, 'Uncategorized'),
    limit: Number(b.amount),
    month: b.month.slice(0, 7),
  }));

  const goals: Goal[] = (goalsRes.data ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    target: Number(g.target_amount),
    saved: Number(g.saved_amount),
    targetDate: g.target_date ?? '',
  }));

  const tasks: Task[] = (tasksRes.data ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    dueDate: t.due_on,
    completed: t.completed,
    recurring: t.recurrence,
    reminder: Boolean(t.reminder_at),
  }));

  const profile: Profile = {
    displayName: profileRes.data?.display_name ?? '',
    currency: profileRes.data?.currency ?? 'INR',
  };

  return {
    categories,
    transactions,
    budgets,
    goals,
    tasks,
    profile,
  };
}

export async function saveProfile(client: SupabaseClient, userId: string, profile: Profile) {
  const { error } = await client.from('profiles').upsert({ id: userId, display_name: profile.displayName || null, currency: profile.currency }, { onConflict: 'id' });
  if (error) throw new Error(error.message);
}

export async function createCategory(client: SupabaseClient, userId: string, input: { name: string; color?: string }) {
  const { error } = await client.from('categories').insert({ user_id: userId, name: input.name, color: input.color ?? '#18a882' });
  if (error) throw new Error(error.message);
}

export async function ensureCategory(client: SupabaseClient, userId: string, categoryName: string, color?: string): Promise<string> {
  const trimmed = categoryName.trim();
  const { data: existing } = await client
    .from('categories')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', trimmed)
    .maybeSingle<{ id: string }>();

  if (existing?.id) return existing.id;

  const { data: created, error } = await client
    .from('categories')
    .insert({ user_id: userId, name: trimmed, color: color ?? '#18a882' })
    .select('id')
    .single<{ id: string }>();

  if (error) {
    const { data: retry } = await client
      .from('categories')
      .select('id')
      .eq('user_id', userId)
      .ilike('name', trimmed)
      .maybeSingle<{ id: string }>();
    if (retry?.id) return retry.id;
    throw new Error(error.message);
  }
  return created.id;
}

export async function updateCategory(client: SupabaseClient, categoryId: string, input: { name: string; color?: string }) {
  const { error } = await client.from('categories').update({ name: input.name, color: input.color ?? '#18a882' }).eq('id', categoryId);
  if (error) throw new Error(error.message);
}

export async function deleteCategory(client: SupabaseClient, categoryId: string) {
  const { error } = await client.from('categories').delete().eq('id', categoryId);
  if (error) throw new Error(error.message);
}

export async function createTransaction(client: SupabaseClient, userId: string, input: { title: string; amount: number; kind: 'income' | 'expense'; categoryId?: string | null; date: string; notes?: string }) {
  const { error } = await client.from('transactions').insert({ user_id: userId, title: input.title, amount: input.amount, kind: input.kind, category_id: input.categoryId ?? null, occurred_on: input.date, notes: input.notes || null });
  if (error) throw new Error(error.message);
}

export async function updateTransaction(client: SupabaseClient, id: string, input: { title: string; amount: number; kind: 'income' | 'expense'; categoryId?: string | null; date: string; notes?: string }) {
  const { error } = await client.from('transactions').update({ title: input.title, amount: input.amount, kind: input.kind, category_id: input.categoryId ?? null, occurred_on: input.date, notes: input.notes || null }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteTransaction(client: SupabaseClient, id: string) {
  const { error } = await client.from('transactions').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

export async function createBudget(client: SupabaseClient, userId: string, input: { categoryId: string; limit: number; month: string }) {
  const { error } = await client.from('budgets').insert({ user_id: userId, category_id: input.categoryId, amount: input.limit, month: toMonthDate(input.month) });
  if (error) throw new Error(error.message);
}

export async function updateBudget(client: SupabaseClient, budgetId: string, input: { categoryId: string; limit: number; month: string }) {
  const { error } = await client.from('budgets').update({ category_id: input.categoryId, amount: input.limit, month: toMonthDate(input.month) }).eq('id', budgetId);
  if (error) throw new Error(error.message);
}

export async function deleteBudget(client: SupabaseClient, budgetId: string) {
  const { error } = await client.from('budgets').delete().eq('id', budgetId);
  if (error) throw new Error(error.message);
}

export async function createGoal(client: SupabaseClient, userId: string, input: { name: string; target: number; saved: number; targetDate?: string }) {
  const { error } = await client.from('savings_goals').insert({ user_id: userId, name: input.name, target_amount: input.target, saved_amount: input.saved, target_date: input.targetDate || null });
  if (error) throw new Error(error.message);
}

export async function updateGoal(client: SupabaseClient, goalId: string, input: { name: string; target: number; saved: number; targetDate?: string }) {
  const { error } = await client.from('savings_goals').update({ name: input.name, target_amount: input.target, saved_amount: input.saved, target_date: input.targetDate || null }).eq('id', goalId);
  if (error) throw new Error(error.message);
}

export async function deleteGoal(client: SupabaseClient, goalId: string) {
  const { error } = await client.from('savings_goals').delete().eq('id', goalId);
  if (error) throw new Error(error.message);
}

export async function createTask(client: SupabaseClient, userId: string, input: { title: string; dueDate: string; recurring: 'none' | 'daily' | 'weekly' | 'monthly'; reminder: boolean }) {
  const { error } = await client.from('tasks').insert({ user_id: userId, title: input.title, due_on: input.dueDate, recurrence: input.recurring, reminder_at: input.reminder ? new Date(`${input.dueDate}T09:00:00.000Z`).toISOString() : null });
  if (error) throw new Error(error.message);
}

export async function updateTask(client: SupabaseClient, taskId: string, input: { title: string; dueDate: string; recurring: 'none' | 'daily' | 'weekly' | 'monthly'; reminder: boolean; completed: boolean }) {
  const { error } = await client.from('tasks').update({ title: input.title, due_on: input.dueDate, recurrence: input.recurring, reminder_at: input.reminder ? new Date(`${input.dueDate}T09:00:00.000Z`).toISOString() : null, completed: input.completed }).eq('id', taskId);
  if (error) throw new Error(error.message);
}

export async function deleteTask(client: SupabaseClient, taskId: string) {
  const { error } = await client.from('tasks').delete().eq('id', taskId);
  if (error) throw new Error(error.message);
}
