import { describe, it, expect } from 'vitest';
import { CatalogSchema } from '@/lib/catalog/schema';
import { CompletionSchema, completionId, autoCompletionId, AUTO_PERIOD_KEY, createOwnedCard } from '@/lib/data/schema';
import { deriveBenefits, expiringSoon, groupBenefits, groupByFrequency } from './derive';

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

  it('ignores closed cards (kept for history, not tracked)', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const closed = { ...card, closedDate: '2025-06-01' };
    expect(
      deriveBenefits({ catalog, cards: [closed], completions: [], thresholdDays: 7, referenceDate: ref }),
    ).toHaveLength(0);
  });

  it('tracks the new product after a product change', () => {
    // Same account (userCardId) now points at a different product; benefits follow it.
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const changed = { ...card, catalogCardId: 'chase-sapphire' };
    const derived = deriveBenefits({
      catalog: multiCardCatalog,
      cards: [changed],
      completions: [],
      thresholdDays: 7,
      referenceDate: ref,
    });
    expect(derived.map((d) => d.benefit.id).sort()).toEqual([
      'chase-sapphire:dining',
      'chase-sapphire:travel',
    ]);
  });

  it('groups benefits by reset cycle in order', () => {
    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    const derived = deriveBenefits({ catalog, cards: [card], completions: [], thresholdDays: 7, referenceDate: ref });
    const groups = groupByFrequency(derived);
    expect(groups.map((g) => g.frequency)).toEqual(['monthly', 'annual']);
  });
});

const multiCardCatalog = CatalogSchema.parse({
  schemaVersion: 1,
  catalogVersion: 1,
  updatedAt: '2025-01-01T00:00:00.000Z',
  issuers: [
    { id: 'amex', name: 'American Express' },
    { id: 'chase', name: 'Chase' },
  ],
  cards: [
    {
      id: 'amex-platinum',
      issuerId: 'amex',
      name: 'Platinum',
      network: 'amex',
      benefits: [
        { id: 'amex-platinum:uber', title: 'Uber Cash', frequency: 'monthly', category: 'rideshare', value: { amount: 15 } },
        { id: 'amex-platinum:airline', title: 'Airline Fee', frequency: 'annual', category: 'airline', value: { amount: 200 } },
      ],
    },
    {
      id: 'chase-sapphire',
      issuerId: 'chase',
      name: 'Sapphire Reserve',
      network: 'visa',
      benefits: [
        { id: 'chase-sapphire:dining', title: 'Dining Credit', frequency: 'monthly', category: 'dining', value: { amount: 25 } },
        { id: 'chase-sapphire:travel', title: 'Travel Credit', frequency: 'annual', category: 'travel', value: { amount: 300 } },
      ],
    },
  ],
});

describe('groupBenefits', () => {
  const amex = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234', nickname: 'Weekender' });
  const chase = createOwnedCard({ catalogCardId: 'chase-sapphire', last4: '5678' });
  const derived = deriveBenefits({
    catalog: multiCardCatalog,
    cards: [amex, chase],
    completions: [],
    thresholdDays: 7,
    referenceDate: ref,
  });

  it('groups by card in owned-card order, using nickname or card name', () => {
    const sections = groupBenefits(derived, 'card');
    expect(sections.map((s) => s.key)).toEqual([amex.userCardId, chase.userCardId]);
    expect(sections.map((s) => s.title)).toEqual(['Weekender', 'Sapphire Reserve']);
    expect(sections.map((s) => s.subtitle)).toEqual(['•••• 1234', '•••• 5678']);
    expect(sections.map((s) => s.items.length)).toEqual([2, 2]);
    // Card grouping exposes the card + catalog card so the header can render art.
    expect(sections[0].card?.userCardId).toBe(amex.userCardId);
    expect(sections[0].catalogCard?.id).toBe('amex-platinum');
  });

  it('groups by category in catalog order, omitting empty categories', () => {
    const sections = groupBenefits(derived, 'category');
    expect(sections.map((s) => s.key)).toEqual(['travel', 'airline', 'dining', 'rideshare']);
    expect(sections.map((s) => s.title)).toEqual(['Travel', 'Airline', 'Dining', 'Rideshare']);
    expect(sections.every((s) => s.items.length === 1)).toBe(true);
    expect(sections.find((s) => s.key === 'dining')!.items[0].benefit.id).toBe('chase-sapphire:dining');
  });

  it('groups by reset cycle with human-friendly titles', () => {
    const sections = groupBenefits(derived, 'frequency');
    expect(sections.map((s) => s.key)).toEqual(['monthly', 'annual']);
    expect(sections.map((s) => s.title)).toEqual(['Monthly', 'Annual']);
    expect(sections.map((s) => s.items.length)).toEqual([2, 2]);
  });
});
