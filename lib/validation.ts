import { z } from 'zod';
export const transactionSchema = z.object({ title: z.string().trim().min(1).max(100), amount: z.coerce.number().positive().max(100000000), kind: z.enum(['expense', 'income']), category: z.string().trim().min(1).max(50), date: z.string().date(), notes: z.string().max(500).optional() });
export const taskSchema = z.object({ title: z.string().trim().min(1).max(150), dueDate: z.string().date(), recurring: z.enum(['none', 'daily', 'weekly', 'monthly']), reminder: z.boolean() });
export const categorySchema = z.object({ name: z.string().trim().min(1).max(50), color: z.string().trim().min(4).max(20).optional() });
export const budgetSchema = z.object({ categoryId: z.string().trim().min(1).max(120), limit: z.coerce.number().positive().max(100000000), month: z.string().regex(/^\d{4}-\d{2}$/) });
export const goalSchema = z.object({ name: z.string().trim().min(1).max(100), target: z.coerce.number().positive().max(100000000), saved: z.coerce.number().nonnegative().max(100000000), targetDate: z.string().date().optional().or(z.literal('')) });
export const profileSchema = z.object({ displayName: z.string().trim().max(100).optional(), currency: z.string().trim().min(3).max(3).default('INR') });
export const formatMoney = (n: number, currency = 'INR') => {
  const code = (currency || 'INR').toUpperCase();
  const locale = code === 'INR' ? 'en-IN' : 'en-US';
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: code, maximumFractionDigits: 0 }).format(n);
  } catch {
    return `${code} ${n.toLocaleString()}`;
  }
};
export const money = (n: number, currency = 'INR') => formatMoney(n, currency);
