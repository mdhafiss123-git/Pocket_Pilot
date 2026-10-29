export type Kind = 'expense' | 'income';
export type Category = { id: string; name: string; color?: string };
export type Transaction = {
	id: string;
	title: string;
	amount: number;
	kind: Kind;
	category: string;
	categoryId?: string | null;
	date: string;
	notes?: string;
};
export type Task = {
	id: string;
	title: string;
	dueDate: string;
	completed: boolean;
	recurring: 'none' | 'daily' | 'weekly' | 'monthly';
	reminder: boolean;
};
export type Budget = { id: string; category: string; categoryId?: string | null; limit: number; month: string };
export type Goal = { id: string; name: string; target: number; saved: number; targetDate?: string };
export type Profile = { displayName: string; currency: string };
export type Data = { transactions: Transaction[]; tasks: Task[]; budgets: Budget[]; goals: Goal[]; categories: Category[]; profile?: Profile };
