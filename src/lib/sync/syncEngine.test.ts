import 'fake-indexeddb/auto';
import { describe, it, expect } from 'vitest';
import { LocalStore } from '@/lib/data/db';
import { createOwnedCard } from '@/lib/data/schema';
import { SyncEngine } from './syncEngine';
import { ConflictError, type ConnectionInfo, type RemoteFile, type SyncProvider, type WriteResult } from './types';

/** In-memory SyncProvider that emulates GitHub's SHA-based optimistic concurrency. */
class InMemoryProvider implements SyncProvider {
  files = new Map<string, { content: unknown; sha: string }>();
  private counter = 0;

  async readFile(path: string): Promise<RemoteFile | null> {
    const f = this.files.get(path);
    return f ? { content: f.content, sha: f.sha } : null;
  }

  async writeFile(path: string, content: unknown, sha?: string): Promise<WriteResult> {
    const cur = this.files.get(path);
    if (cur && sha && cur.sha !== sha) throw new ConflictError(path);
    if (cur && !sha) throw new ConflictError(path); // creating over an existing file
    const newSha = `sha-${++this.counter}`;
    this.files.set(path, { content: JSON.parse(JSON.stringify(content)), sha: newSha });
    return { sha: newSha };
  }

  async checkConnection(): Promise<ConnectionInfo> {
    return { ok: true, repo: 'octo/data', canWrite: true };
  }
}

let n = 0;
const dbName = () => `cardsguru-sync-${Date.now()}-${n++}`;

describe('SyncEngine', () => {
  it('pushes local records to an empty remote', async () => {
    const store = await LocalStore.open(dbName());
    const provider = new InMemoryProvider();
    const engine = new SyncEngine(store, provider);

    const card = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1234' });
    await store.putCard(card);

    const res = await engine.sync();
    expect(res.pushedCards).toBe(true);
    expect(provider.files.has('cards.json')).toBe(true);
    store.close();
  });

  it('pulls remote records onto a fresh device', async () => {
    const provider = new InMemoryProvider();
    const storeA = await LocalStore.open(dbName());
    const engineA = new SyncEngine(storeA, provider);
    const card = createOwnedCard({ catalogCardId: 'amex-gold', last4: '5555' });
    await storeA.putCard(card);
    await engineA.sync();

    const storeB = await LocalStore.open(dbName());
    const engineB = new SyncEngine(storeB, provider);
    await engineB.sync();

    const cards = await storeB.getAllCards();
    expect(cards.map((c) => c.userCardId)).toContain(card.userCardId);
    storeA.close();
    storeB.close();
  });

  it('merges independent edits from two devices (union)', async () => {
    const provider = new InMemoryProvider();
    const storeA = await LocalStore.open(dbName());
    const storeB = await LocalStore.open(dbName());
    const engineA = new SyncEngine(storeA, provider);
    const engineB = new SyncEngine(storeB, provider);

    const cardA = createOwnedCard({ catalogCardId: 'amex-platinum', last4: '1111' });
    const cardB = createOwnedCard({ catalogCardId: 'venture-x', last4: '2222' });
    await storeA.putCard(cardA);
    await storeB.putCard(cardB);

    await engineA.sync(); // A pushes cardA
    await engineB.sync(); // B pulls cardA, pushes both
    await engineA.sync(); // A pulls cardB

    const a = (await storeA.getAllCards()).map((c) => c.last4).sort();
    const b = (await storeB.getAllCards()).map((c) => c.last4).sort();
    expect(a).toEqual(['1111', '2222']);
    expect(b).toEqual(['1111', '2222']);
    storeA.close();
    storeB.close();
  });

  it('is idempotent when nothing changed', async () => {
    const store = await LocalStore.open(dbName());
    const provider = new InMemoryProvider();
    const engine = new SyncEngine(store, provider);
    await store.putCard(createOwnedCard({ catalogCardId: 'amex-green', last4: '4321' }));

    await engine.sync();
    const second = await engine.sync();
    expect(second.pushedCards).toBe(false);
    expect(second.pushedCompletions).toBe(false);
    store.close();
  });
});
