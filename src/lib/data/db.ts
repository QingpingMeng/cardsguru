import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Completion, OwnedCard, Profile } from './schema';

interface CardsGuruDB extends DBSchema {
  profile: { key: string; value: Profile };
  cards: { key: string; value: OwnedCard };
  completions: { key: string; value: Completion };
  kv: { key: string; value: unknown };
}

export const DB_NAME = 'cardsguru';
const DB_VERSION = 1;
const PROFILE_KEY = 'profile';

/** Well-known keys in the kv store. */
export type KvKey = 'pat' | 'repoConfig' | 'lastSyncAt' | 'dirtyAt' | 'catalogCache' | 'catalogEtag' | 'catalogCheckedAt';

export interface RepoConfig {
  owner: string;
  repo: string;
  branch?: string;
  basePath?: string;
}

export function openCardsGuruDb(name = DB_NAME): Promise<IDBPDatabase<CardsGuruDB>> {
  return openDB<CardsGuruDB>(name, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('profile')) db.createObjectStore('profile');
      if (!db.objectStoreNames.contains('cards')) db.createObjectStore('cards', { keyPath: 'userCardId' });
      if (!db.objectStoreNames.contains('completions')) db.createObjectStore('completions', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    },
  });
}

/**
 * Local-first working store. The UI reads/writes here synchronously-feeling
 * (IndexedDB is fast); the sync engine reconciles it with the remote repo.
 */
export class LocalStore {
  constructor(private readonly db: IDBPDatabase<CardsGuruDB>) {}

  static async open(name = DB_NAME): Promise<LocalStore> {
    return new LocalStore(await openCardsGuruDb(name));
  }

  // profile
  async getProfile(): Promise<Profile | undefined> {
    return this.db.get('profile', PROFILE_KEY);
  }
  async setProfile(profile: Profile): Promise<void> {
    await this.db.put('profile', profile, PROFILE_KEY);
  }

  // cards (includes tombstoned rows; callers filter with withoutDeleted)
  async getAllCards(): Promise<OwnedCard[]> {
    return this.db.getAll('cards');
  }
  async putCard(card: OwnedCard): Promise<void> {
    await this.db.put('cards', card);
  }
  async putCards(cards: OwnedCard[]): Promise<void> {
    const tx = this.db.transaction('cards', 'readwrite');
    await Promise.all([...cards.map((c) => tx.store.put(c)), tx.done]);
  }

  // completions
  async getAllCompletions(): Promise<Completion[]> {
    return this.db.getAll('completions');
  }
  async putCompletion(c: Completion): Promise<void> {
    await this.db.put('completions', c);
  }
  async putCompletions(items: Completion[]): Promise<void> {
    const tx = this.db.transaction('completions', 'readwrite');
    await Promise.all([...items.map((c) => tx.store.put(c)), tx.done]);
  }

  // key-value (config, secrets, sync metadata)
  async kvGet<T = unknown>(key: KvKey): Promise<T | undefined> {
    return this.db.get('kv', key) as Promise<T | undefined>;
  }
  async kvSet(key: KvKey, value: unknown): Promise<void> {
    await this.db.put('kv', value, key);
  }
  async kvDelete(key: KvKey): Promise<void> {
    await this.db.delete('kv', key);
  }

  /** Wipe all local data (used when disconnecting an account). */
  async clearAll(): Promise<void> {
    const tx = this.db.transaction(['profile', 'cards', 'completions', 'kv'], 'readwrite');
    await Promise.all([
      tx.objectStore('profile').clear(),
      tx.objectStore('cards').clear(),
      tx.objectStore('completions').clear(),
      tx.objectStore('kv').clear(),
      tx.done,
    ]);
  }

  close(): void {
    this.db.close();
  }
}

let singleton: Promise<LocalStore> | null = null;

/** App-wide store instance (lazy). */
export function getLocalStore(): Promise<LocalStore> {
  if (!singleton) singleton = LocalStore.open();
  return singleton;
}
