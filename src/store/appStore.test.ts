import { describe, it, expect, beforeAll } from 'vitest';
import { useAppStore } from './appStore';
import { getBuiltInCatalog } from '@/lib/catalog';

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
});
