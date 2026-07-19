import { describe, it, expect } from 'vitest';
import { getBuiltInCatalog } from '@/lib/catalog';
import { createOwnedCard, type OwnedCard } from '@/lib/data/schema';
import { describeLineage } from './helpers';

describe('describeLineage', () => {
  const catalog = getBuiltInCatalog();

  it('returns undefined for a card with no product history', () => {
    const card = createOwnedCard({ catalogCardId: catalog.cards[0].id, last4: '1111' });
    expect(describeLineage(catalog, card)).toBeUndefined();
  });

  it('does not crash when a legacy row is missing productHistory', () => {
    const card = createOwnedCard({ catalogCardId: catalog.cards[0].id, last4: '1111' });
    // Simulate a row persisted before `productHistory` existed.
    delete (card as { productHistory?: unknown }).productHistory;
    expect(describeLineage(catalog, card as OwnedCard)).toBeUndefined();
  });

  it('describes the most recent product change', () => {
    const from = catalog.cards[0];
    const to = catalog.cards[1];
    const card: OwnedCard = {
      ...createOwnedCard({ catalogCardId: to.id, last4: '2222' }),
      productHistory: [{ catalogCardId: from.id, changedAt: new Date().toISOString() }],
    };
    const label = describeLineage(catalog, card);
    expect(label).toMatch(/^(Upgraded|Downgraded|Changed) from /);
    expect(label).toContain(from.name);
  });
});
