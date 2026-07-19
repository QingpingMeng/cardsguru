import { describe, it, expect, beforeAll } from 'vitest';
import { useAppStore } from './appStore';
import { getBuiltInCatalog } from '@/lib/catalog';
import { deriveBenefits } from '@/lib/benefits';

/**
 * Exercises the store against the real IndexedDB-backed LocalStore (fake-indexeddb
 * in tests) while disconnected — the local-first path every screen depends on.
 */
describe('appStore (local-first)', () => {
  const catalog = getBuiltInCatalog();
  const card = catalog.cards[0];
  const benefit = card.benefits[0];

  beforeAll(async () => {
    await useAppStore.getState().init();
  });

  it('starts disconnected with the bundled catalog', () => {
    const s = useAppStore.getState();
    expect(s.status).toBe('disconnected');
    expect(s.catalog.cards.length).toBeGreaterThan(0);
  });

  it('adds a card, marks a benefit used, and undoes it', async () => {
    await useAppStore.getState().addCard({ catalogCardId: card.id, last4: '1234' });
    const added = useAppStore.getState().cards;
    expect(added).toHaveLength(1);
    const userCardId = added[0].userCardId;
    expect(added[0].last4).toBe('1234');

    await useAppStore.getState().setCompletion(userCardId, benefit.id, '2025-01', 'used');
    const used = useAppStore.getState().completions;
    expect(used).toHaveLength(1);
    expect(used[0].status).toBe('used');

    await useAppStore.getState().setCompletion(userCardId, benefit.id, '2025-01', null);
    // Tombstoned completions are filtered out of the UI-facing list.
    expect(useAppStore.getState().completions).toHaveLength(0);
  });

  it('persists settings changes', async () => {
    await useAppStore.getState().updateSettings({ notifThresholdDays: 14 });
    expect(useAppStore.getState().profile?.settings.notifThresholdDays).toBe(14);
  });

  it('changes a card product in place, recording lineage and keeping history', async () => {
    const other = catalog.cards.find((c) => c.id !== card.id)!;
    const store = useAppStore.getState();
    await store.addCard({ catalogCardId: card.id, last4: '4321' });
    const mine = useAppStore.getState().cards.find((c) => c.last4 === '4321')!;

    await store.setCompletion(mine.userCardId, benefit.id, '2025-02', 'used');
    await store.changeCardProduct(mine.userCardId, other.id, { last4: '4321' });

    const changed = useAppStore.getState().cards.find((c) => c.userCardId === mine.userCardId)!;
    expect(changed.catalogCardId).toBe(other.id);
    expect(changed.productHistory).toHaveLength(1);
    expect(changed.productHistory[0].catalogCardId).toBe(card.id);
    // The completion for the old product's benefit is preserved (history intact).
    const preserved = useAppStore
      .getState()
      .completions.find((c) => c.userCardId === mine.userCardId && c.benefitId === benefit.id);
    expect(preserved?.status).toBe('used');
  });

  it('closes a card (kept, untracked) and reopens it', async () => {
    const store = useAppStore.getState();
    await store.addCard({ catalogCardId: card.id, last4: '9999' });
    const mine = useAppStore.getState().cards.find((c) => c.last4 === '9999')!;

    await store.closeCard(mine.userCardId, '2025-03-15');
    const closed = useAppStore.getState().cards.find((c) => c.userCardId === mine.userCardId)!;
    // Still present in the store (so History keeps its context) but marked closed.
    expect(closed.closedDate).toBe('2025-03-15');
    expect(closed.archived).toBe(true);
    expect(
      deriveBenefits({ catalog, cards: [closed], completions: [], thresholdDays: 7 }),
    ).toHaveLength(0);

    await store.reopenCard(mine.userCardId);
    const reopened = useAppStore.getState().cards.find((c) => c.userCardId === mine.userCardId)!;
    expect(reopened.closedDate).toBeUndefined();
    expect(reopened.archived).toBe(false);
  });
});
