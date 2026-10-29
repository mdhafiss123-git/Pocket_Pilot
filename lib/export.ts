import { Transaction } from './types';

export function csv(rows: Transaction[]): string {
  const headers = 'Date,Type,Title,Category,Amount,Notes';
  const lines = rows.map((r) =>
    [r.date, r.kind, r.title, r.category, r.amount, r.notes || '']
      .map((val) => `"${String(val).replaceAll('"', '""')}"`)
      .join(',')
  );
  return [headers, ...lines].join('\n');
}

export function downloadCsv(data: string, filename = 'pocket-pilot-transactions.csv') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([data], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
