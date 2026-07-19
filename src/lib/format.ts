import type { BenefitFrequency, Money, ResetAnchor } from '@/lib/catalog/schema';

const FREQUENCY_LABELS: Record<BenefitFrequency, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  semiannual: 'Semi-annual',
  annual: 'Annual',
  one_time: 'One-time',
};

export function formatFrequency(frequency: BenefitFrequency): string {
  return FREQUENCY_LABELS[frequency];
}

export function formatResetAnchor(anchor: ResetAnchor): string {
  return anchor === 'anniversary' ? 'cardmember year' : 'calendar';
}

export function formatMoney(money?: Money): string | null {
  if (!money) return null;
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: money.currency || 'USD',
      maximumFractionDigits: money.amount % 1 === 0 ? 0 : 2,
    }).format(money.amount);
  } catch {
    return `$${money.amount}`;
  }
}

const DATE_FMT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const DATE_FMT_SHORT = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

export function formatDate(value: string | Date, opts?: { withYear?: boolean }): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return '—';
  return (opts?.withYear === false ? DATE_FMT_SHORT : DATE_FMT).format(date);
}

/** Window shown on a benefit card, e.g. "Dec 1 – Dec 31". */
export function formatPeriodWindow(start: Date, end: Date): string {
  const lastDay = new Date(end.getTime() - 24 * 60 * 60 * 1000);
  return `${DATE_FMT_SHORT.format(start)} – ${DATE_FMT_SHORT.format(lastDay)}`;
}

export function formatDaysRemaining(days: number): string {
  if (days < 0) return 'Expired';
  if (days === 0) return 'Ends today';
  if (days === 1) return '1 day left';
  return `${days} days left`;
}

/** Relative "last synced" label. */
export function formatRelativeTime(iso?: string): string {
  if (!iso) return 'never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'never';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return formatDate(iso);
}
