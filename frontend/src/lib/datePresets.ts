// Shared quick date-range presets for filters (Purchase Orders, Sales Report, …).
export type DatePreset = 'all' | 'today' | 'yesterday' | '7' | '15' | '30' | 'month' | 'custom';

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: '7', label: '7 days ago' },
  { key: '15', label: '15 days ago' },
  { key: '30', label: '30 days ago' },
  { key: 'month', label: 'Current Month' },
  { key: 'custom', label: 'Customize Date' },
];

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

// Returns the {from, to} range (YYYY-MM-DD) for a preset. 'custom' returns null
// so the caller keeps the existing manual range and reveals the inputs.
export function presetRange(p: DatePreset): { from: string; to: string } | null {
  const now = new Date();
  const today = ymd(now);
  switch (p) {
    case 'all':
      return { from: '', to: '' };
    case 'today':
      return { from: today, to: today };
    case 'yesterday': {
      const y = ymd(addDays(now, -1));
      return { from: y, to: y };
    }
    case '7':
      return { from: ymd(addDays(now, -7)), to: today };
    case '15':
      return { from: ymd(addDays(now, -15)), to: today };
    case '30':
      return { from: ymd(addDays(now, -30)), to: today };
    case 'month':
      return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case 'custom':
      return null;
  }
}
