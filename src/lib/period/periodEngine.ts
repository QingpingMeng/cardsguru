import { addDays, addMonths, differenceInCalendarDays, differenceInMonths, startOfDay } from 'date-fns';
import type { BenefitFrequency, ResetAnchor } from '@/lib/catalog/schema';

/** Number of whole months in one period of the given frequency (one_time handled separately). */
const MONTHS_PER_PERIOD: Record<Exclude<BenefitFrequency, 'one_time'>, number> = {
  monthly: 1,
  quarterly: 3,
  semiannual: 6,
  annual: 12,
};

/** Calendar-aligned periods anchor to Jan 1 (day 1) so boundaries fall on natural month/quarter/half/year starts. */
const CALENDAR_ANCHOR = new Date(2000, 0, 1);

/** A concrete occurrence of a recurring benefit. Usable during [start, end). */
export interface Period {
  /** Stable, chronologically-sortable identifier for this occurrence. */
  key: string;
  /** Inclusive start of the period (local midnight). */
  start: Date;
  /** Exclusive end of the period — the instant the credit resets (local midnight). */
  end: Date;
  frequency: BenefitFrequency;
  resetAnchor: ResetAnchor;
}

export interface PeriodInput {
  frequency: BenefitFrequency;
  resetAnchor: ResetAnchor;
  /** The date to evaluate "now" against. Defaults to the current time. */
  referenceDate?: Date;
  /** Required when resetAnchor is 'anniversary': the card's opened/anniversary date. */
  anchorDate?: Date;
  /** For one_time benefits: first day the credit is available. */
  validFrom?: Date;
  /** For one_time benefits: last day (inclusive) the credit is available. */
  validTo?: Date;
}

/**
 * Find the period [start, end) containing `ref`, where boundaries occur every
 * `months` months starting from `rawAnchor` (which may be before or after ref).
 * Robust to month-length clamping (e.g. anchor on the 31st).
 */
function anchoredPeriod(ref: Date, months: number, rawAnchor: Date): { start: Date; end: Date } {
  const anchor = startOfDay(rawAnchor);
  const r = startOfDay(ref);

  let k = Math.floor(differenceInMonths(r, anchor) / months);
  let start = addMonths(anchor, k * months);
  while (start > r) {
    k -= 1;
    start = addMonths(anchor, k * months);
  }
  let end = addMonths(anchor, (k + 1) * months);
  while (end <= r) {
    k += 1;
    start = end;
    end = addMonths(anchor, (k + 1) * months);
  }
  return { start, end };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function calendarKey(frequency: Exclude<BenefitFrequency, 'one_time'>, start: Date): string {
  const year = start.getFullYear();
  const month = start.getMonth(); // 0-11
  switch (frequency) {
    case 'monthly':
      return `${year}-${pad2(month + 1)}`;
    case 'quarterly':
      return `${year}-Q${Math.floor(month / 3) + 1}`;
    case 'semiannual':
      return `${year}-H${Math.floor(month / 6) + 1}`;
    case 'annual':
      return `${year}`;
  }
}

function anniversaryKey(start: Date): string {
  return `anniv-${start.getFullYear()}-${pad2(start.getMonth() + 1)}-${pad2(start.getDate())}`;
}

/** Far-future sentinel used as the (open-ended) reset instant for one_time benefits without a validTo. */
const OPEN_ENDED_END = new Date(2999, 0, 1);
/** Distant-past sentinel used as the start for one_time benefits without a validFrom. */
const OPEN_ENDED_START = new Date(2000, 0, 1);

/**
 * Compute the current period for a benefit given its reset rules and a reference date.
 * Throws if an anniversary anchor is requested without an anchorDate.
 */
export function getPeriod(input: PeriodInput): Period {
  const {
    frequency,
    resetAnchor,
    referenceDate = new Date(),
    anchorDate,
    validFrom,
    validTo,
  } = input;

  if (frequency === 'one_time') {
    return {
      key: 'once',
      start: validFrom ? startOfDay(validFrom) : OPEN_ENDED_START,
      // validTo is inclusive, so the reset instant is the day after.
      end: validTo ? startOfDay(addDays(validTo, 1)) : OPEN_ENDED_END,
      frequency,
      resetAnchor,
    };
  }

  const months = MONTHS_PER_PERIOD[frequency];

  if (resetAnchor === 'anniversary') {
    if (!anchorDate) {
      throw new Error(
        `getPeriod: an anchorDate is required for anniversary-anchored ${frequency} benefits`,
      );
    }
    const { start, end } = anchoredPeriod(referenceDate, months, anchorDate);
    return { key: anniversaryKey(start), start, end, frequency, resetAnchor };
  }

  const { start, end } = anchoredPeriod(referenceDate, months, CALENDAR_ANCHOR);
  return { key: calendarKey(frequency, start), start, end, frequency, resetAnchor };
}

/** The instant the current period resets. */
export function nextReset(period: Period): Date {
  return period.end;
}

/**
 * Whole calendar days from `from` until the period resets (counts the current day as 1).
 * Returns a large number for open-ended one_time benefits.
 */
export function daysUntilReset(period: Period, from: Date = new Date()): number {
  return differenceInCalendarDays(period.end, startOfDay(from));
}

export interface BenefitStatus {
  period: Period;
  /** Whole days remaining before the credit resets/expires. */
  daysRemaining: number;
  /** True when the unused credit will reset within the threshold (and hasn't been used). */
  expiringSoon: boolean;
  /** True only for one_time credits whose validTo has passed. */
  expired: boolean;
}

export interface EvaluateInput extends PeriodInput {
  /** Days-before-reset at which an unused credit counts as "expiring soon". */
  thresholdDays: number;
  /** Whether the user has already used this credit in the current period. */
  used: boolean;
}

/** Combine period math with completion state to derive display/notification status. */
export function evaluateBenefit(input: EvaluateInput): BenefitStatus {
  const { thresholdDays, used, referenceDate = new Date() } = input;
  const period = getPeriod(input);
  const daysRemaining = daysUntilReset(period, referenceDate);

  const isOneTime = input.frequency === 'one_time';
  const hasHardExpiry = isOneTime ? Boolean(input.validTo) : true;
  const expired = isOneTime && input.validTo ? daysRemaining < 0 : false;

  const expiringSoon =
    !used && hasHardExpiry && daysRemaining >= 0 && daysRemaining <= thresholdDays;

  return { period, daysRemaining, expiringSoon, expired };
}
