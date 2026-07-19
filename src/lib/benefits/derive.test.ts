import { describe, it, expect } from 'vitest';
import { CatalogSchema } from '@/lib/catalog/schema';
import { CompletionSchema, completionId, autoCompletionId, AUTO_PERIOD_KEY, createOwnedCard } from '@/lib/data/schema';
import { deriveBenefits, expiringSoon, groupByFrequency } from './derive';

const catalog = CatalogSchema.parse({
  schemaVersion: 1,
  catalogVersion: 1,
  updatedAt: '2025-01-01T00:00:00.000Z',
  issuers: [{ id: 'amex', name: 'American Express' }],
  cards: [
    {
      id: 'amex-platinum',
      issuerId: 'amex',
      name: 'Platinum',
      network: 'amex',
      benefits: [
        { id: 'amex-platinum:uber', title: 'Uber Cash', frequency: 'monthly', value: { amount: 15 } },
        { id: 'amex-platinum:airline', title: 'Airline Fee', frequency: 'annual', value: { amount: 200 } },
      ],
    },
  ],
});

const ref = new Date(2025, 11, 28); // Dec 28, 2025

describe('deriveBenefits', () => {
  it('expands owned cards into their current-period benefits', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [], thresholdDays: 7, referenceDate: ref });
    expect(derived).toHaveLength(2);
    expect(derived.map((d) => d.periodKey).sort()).toEqual(['2025', '2025-12']);
  });

  it('marks a benefit used when a completion exists for its period', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const completion = CompletionSchema.parse({
      id: completionId(card.userCardId, 'amex-platinum:uber', '2025-12'),
      userCardId: card.userCardId,
      benefitId: 'amex-platinum:uber',
      periodKey: '2025-12',
      status: 'used',
    });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [completion], thresholdDays: 7, referenceDate: ref });
    const uber = derived.find((d) => d.benefit.id === 'amex-platinum:uber')!;
    expect(uber.used).toBe(true);
    expect(uber.status.expiringSoon).toBe(false);
  });

  it('treats a "set & forget" benefit as auto-used without adding extra rows', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const autoMarker = CompletionSchema.parse({
      id: autoCompletionId(card.userCardId, 'amex-platinum:airline'),
      userCardId: card.userCardId,
      benefitId: 'amex-platinum:airline',
      periodKey: AUTO_PERIOD_KEY,
      status: 'used',
    });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [autoMarker], thresholdDays: 7, referenceDate: ref });
    // The sentinel does not create its own benefit occurrence.
    expect(derived).toHaveLength(2);
    const airline = derived.find((d) => d.benefit.id === 'amex-platinum:airline')!;
    expect(airline.auto).toBe(true);
    expect(airline.used).toBe(true);
    expect(airline.status.expiringSoon).toBe(false);
    // Other benefits are unaffected.
    expect(derived.find((d) => d.benefit.id === 'amex-platinum:uber')!.auto).toBe(false);
  });

  it('turning off "set & forget" (tombstoned sentinel) restores manual state', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const disabledAuto = CompletionSchema.parse({
      id: autoCompletionId(card.userCardId, 'amex-platinum:airline'),
      userCardId: card.userCardId,
      benefitId: 'amex-platinum:airline',
      periodKey: AUTO_PERIOD_KEY,
      status: 'used',
      deleted: true,
    });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [disabledAuto], thresholdDays: 7, referenceDate: ref });
    const airline = derived.find((d) => d.benefit.id === 'amex-platinum:airline')!;
    expect(airline.auto).toBe(false);
    expect(airline.used).toBe(false);
  });

  it('flags an unused annual credit expiring at year-end', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [], thresholdDays: 7, referenceDate: ref });
    const soon = expiringSoon(derived);
    expect(soon.map((d) => d.benefit.id)).toContain('amex-platinum:airline');
  });

  it('ignores archived cards and deleted completions', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const archived = { ...card, archived: true };
    expect(deriveBenefits({ catalog, cards: [archived], completions: [], thresholdDays: 7, referenceDate: ref })).toHaveLength(0);

    const deletedCompletion = CompletionSchema.parse({
      id: completionId(card.userCardId, 'amex-platinum:uber', '2025-12'),
      userCardId: card.userCardId,
      benefitId: 'amex-platinum:uber',
      periodKey: '2025-12',
      status: 'used',
      deleted: true,
    });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [deletedCompletion], thresholdDays: 7, referenceDate: ref });
    expect(derived.find((d) => d.benefit.id === 'amex-platinum:uber')!.used).toBe(false);
  });

  it('groups benefits by reset cycle in order', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [], thresholdDays: 7, referenceDate: ref });
    const groups = groupByFrequency(derived);
    expect(groups.map((g) => g.frequency)).toEqual(['monthly', 'annual']);
  });
});
