import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { LocalStore } from './db';
import { CompletionSchema, completionId, createOwnedCard, createProfile } from './schema';

let n = 0;
const dbName = () => `cardsguru-test-${Date.now()}-${n++}`;

describe('LocalStore', () => {
  it('stores and retrieves the profile', async () => {
    const store = await LocalStore.open(dbName());
    expect(await store.getProfile()).toBeUndefined();
    const profile = createProfile({ notifThresholdDays: 10 });
    await store.setProfile(profile);
    expect((await store.getProfile())?.settings.notifThresholdDays).toBe(10);
    store.close();
  });

  it('bulk-puts and reads cards keyed by userCardId', async () => {
    const store = await LocalStore.open(dbName());
    const a = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1111' });
    const b = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '2222' });
    await store.putCards([a, b]);
    const all = await store.getAllCards();
    expect(all.map((c) => c.last4).sort()).toEqual(['1111', '2222']);
    store.close();
  });

  it('stores completions and kv values, and clears everything', async () => {
    const store = await LocalStore.open(dbName());
    const card = createOwnedCard({ catalogCardId: 'amex-gold', last4: '9999' });
    await store.putCard(card);
    const c = CompletionSchema.parse({
      id: completionId(card.userCardId, 'amex-gold:uber-cash', '2025-01'),
      userCardId: card.userCardId,
      benefitId: 'amex-gold:uber-cash',
      periodKey: '2025-01',
    });
    await store.putCompletion(c);
    await store.kvSet('lastSyncAt', '2025-01-01T00:00:00.000Z');

    expect(await store.getAllCompletions()).toHaveLength(1);
    expect(await store.kvGet('lastSyncAt')).toBe('2025-01-01T00:00:00.000Z');

    await store.clearAll();
    expect(await store.getAllCards()).toHaveLength(0);
    expect(await store.getAllCompletions()).toHaveLength(0);
    expect(await store.kvGet('lastSyncAt')).toBeUndefined();
    store.close();
  });
});
