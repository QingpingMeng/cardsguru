import { describe, it, expect } from 'vitest';
import {
  getPeriod,
  daysUntilReset,
  evaluateBenefit,
  type Period,
} from './periodEngine';

/** Build a local-time date (avoids timezone flakiness from ISO strings). */
const d = (y: number, m: number, day: number) => new Date(y, m - 1, day);

describe('getPeriod — calendar anchor', () => {
  it('monthly', () => {
    const p = getPeriod({ frequency: 'monthly', resetAnchor: 'calendar', referenceDate: d(2025, 1, 15) });
    expect(p.key).toBe('2025-01');
    expect(p.start).toEqual(d(2025, 1, 1));
    expect(p.end).toEqual(d(2025, 2, 1));
  });

  it('monthly at the very last day still belongs to that month', () => {
    const p = getPeriod({ frequency: 'monthly', resetAnchor: 'calendar', referenceDate: d(2025, 1, 31) });
    expect(p.key).toBe('2025-01');
    expect(daysUntilReset(p, d(2025, 1, 31))).toBe(1);
  });

  it('quarterly aligns to Jan/Apr/Jul/Oct', () => {
    const p = getPeriod({ frequency: 'quarterly', resetAnchor: 'calendar', referenceDate: d(2025, 5, 10) });
    expect(p.key).toBe('2025-Q2');
    expect(p.start).toEqual(d(2025, 4, 1));
    expect(p.end).toEqual(d(2025, 7, 1));
  });

  it('semiannual splits the year in half', () => {
    const h2 = getPeriod({ frequency: 'semiannual', resetAnchor: 'calendar', referenceDate: d(2025, 8, 1) });
    expect(h2.key).toBe('2025-H2');
    expect(h2.start).toEqual(d(2025, 7, 1));
    expect(h2.end).toEqual(d(2026, 1, 1));

    const h1 = getPeriod({ frequency: 'semiannual', resetAnchor: 'calendar', referenceDate: d(2025, 3, 1) });
    expect(h1.key).toBe('2025-H1');
  });

  it('annual is the calendar year', () => {
    const p = getPeriod({ frequency: 'annual', resetAnchor: 'calendar', referenceDate: d(2025, 3, 3) });
    expect(p.key).toBe('2025');
    expect(p.start).toEqual(d(2025, 1, 1));
    expect(p.end).toEqual(d(2026, 1, 1));
  });
});

describe('getPeriod — anniversary anchor', () => {
  it('annual membership year rolls on the anniversary day', () => {
    const anchorDate = d(2022, 3, 15);
    const before = getPeriod({ frequency: 'annual', resetAnchor: 'anniversary', anchorDate, referenceDate: d(2025, 3, 14) });
    expect(before.start).toEqual(d(2024, 3, 15));
    expect(before.end).toEqual(d(2025, 3, 15));

    const onDay = getPeriod({ frequency: 'annual', resetAnchor: 'anniversary', anchorDate, referenceDate: d(2025, 3, 15) });
    expect(onDay.start).toEqual(d(2025, 3, 15));
    expect(onDay.end).toEqual(d(2026, 3, 15));
  });

  it('monthly anniversary resets on the anchor day-of-month', () => {
    const anchorDate = d(2022, 3, 15);
    const after = getPeriod({ frequency: 'monthly', resetAnchor: 'anniversary', anchorDate, referenceDate: d(2025, 6, 20) });
    expect(after.start).toEqual(d(2025, 6, 15));
    expect(after.end).toEqual(d(2025, 7, 15));

    const beforeDay = getPeriod({ frequency: 'monthly', resetAnchor: 'anniversary', anchorDate, referenceDate: d(2025, 6, 10) });
    expect(beforeDay.start).toEqual(d(2025, 5, 15));
    expect(beforeDay.end).toEqual(d(2025, 6, 15));
  });

  it('quarterly anniversary steps every 3 months from the anchor month', () => {
    const anchorDate = d(2022, 3, 15); // boundaries: Mar/Jun/Sep/Dec 15
    const p = getPeriod({ frequency: 'quarterly', resetAnchor: 'anniversary', anchorDate, referenceDate: d(2025, 7, 1) });
    expect(p.start).toEqual(d(2025, 6, 15));
    expect(p.end).toEqual(d(2025, 9, 15));
  });

  it('produces a stable, unique key per occurrence', () => {
    const anchorDate = d(2022, 3, 15);
    const p = getPeriod({ frequency: 'annual', resetAnchor: 'anniversary', anchorDate, referenceDate: d(2025, 6, 1) });
    expect(p.key).toBe('anniv-2025-03-15');
  });

  it('throws when an anniversary anchor is missing its anchorDate', () => {
    expect(() =>
      getPeriod({ frequency: 'annual', resetAnchor: 'anniversary', referenceDate: d(2025, 1, 1) }),
    ).toThrow(/anchorDate is required/);
  });

  it('handles day clamping for anchors on the 31st', () => {
    const anchorDate = d(2022, 1, 31);
    const p = getPeriod({ frequency: 'monthly', resetAnchor: 'anniversary', anchorDate, referenceDate: d(2025, 2, 15) });
    // Invariants must hold even when February clamps the boundary.
    expect(p.start.getTime()).toBeLessThanOrEqual(d(2025, 2, 15).getTime());
    expect(p.end.getTime()).toBeGreaterThan(d(2025, 2, 15).getTime());
  });
});

describe('getPeriod — one_time', () => {
  it('uses validFrom/validTo as the window with an inclusive end', () => {
    const p = getPeriod({
      frequency: 'one_time',
      resetAnchor: 'calendar',
      referenceDate: d(2025, 6, 1),
      validFrom: d(2025, 1, 1),
      validTo: d(2025, 12, 31),
    });
    expect(p.key).toBe('once');
    expect(p.start).toEqual(d(2025, 1, 1));
    expect(p.end).toEqual(d(2026, 1, 1)); // day after inclusive validTo
  });
});

describe('daysUntilReset', () => {
  it('counts calendar days to the reset instant', () => {
    const p: Period = getPeriod({ frequency: 'monthly', resetAnchor: 'calendar', referenceDate: d(2025, 1, 20) });
    expect(daysUntilReset(p, d(2025, 1, 20))).toBe(12); // Jan 20 -> Feb 1
  });
});

describe('evaluateBenefit — expiring soon', () => {
  const base = { frequency: 'monthly', resetAnchor: 'calendar', thresholdDays: 5 } as const;

  it('flags an unused credit near the reset boundary', () => {
    const s = evaluateBenefit({ ...base, used: false, referenceDate: d(2025, 1, 29) });
    expect(s.daysRemaining).toBe(3);
    expect(s.expiringSoon).toBe(true);
    expect(s.expired).toBe(false);
  });

  it('does not flag a used credit', () => {
    const s = evaluateBenefit({ ...base, used: true, referenceDate: d(2025, 1, 29) });
    expect(s.expiringSoon).toBe(false);
  });

  it('does not flag when reset is far away', () => {
    const s = evaluateBenefit({ ...base, used: false, referenceDate: d(2025, 1, 2) });
    expect(s.expiringSoon).toBe(false);
  });

  it('marks a one_time credit expired once validTo has passed', () => {
    const s = evaluateBenefit({
      frequency: 'one_time',
      resetAnchor: 'calendar',
      thresholdDays: 5,
      used: false,
      validTo: d(2025, 1, 1),
      referenceDate: d(2025, 2, 1),
    });
    expect(s.expired).toBe(true);
    expect(s.expiringSoon).toBe(false);
  });

  it('never flags an open-ended one_time credit as expiring', () => {
    const s = evaluateBenefit({
      frequency: 'one_time',
      resetAnchor: 'calendar',
      thresholdDays: 5,
      used: false,
      referenceDate: d(2025, 2, 1),
    });
    expect(s.expiringSoon).toBe(false);
    expect(s.expired).toBe(false);
  });
});
