import {
  CardsFileSchema,
  CompletionsFileSchema,
  ProfileSchema,
  createProfile,
  nowIso,
  type Completion,
  type OwnedCard,
  type Profile,
} from '@/lib/data/schema';
import type { LocalStore } from '@/lib/data/db';
import { mergeRecords, mergeSingle } from './merge';
import { ConflictError, type SyncProvider } from './types';

export const FILES = {
  profile: 'profile.json',
  cards: 'cards.json',
  completions: 'completions.json',
} as const;

export interface SyncResult {
  pushedProfile: boolean;
  pushedCards: boolean;
  pushedCompletions: boolean;
  at: string;
}

function canonical<T>(items: readonly T[], key: (t: T) => string): string {
  return JSON.stringify([...items].sort((a, b) => key(a).localeCompare(key(b))));
}

/**
 * Reconciles the local IndexedDB store with a remote SyncProvider using
 * last-write-wins per record. Safe to run repeatedly and offline-tolerant
 * (throws transport errors up to the caller, having already persisted merges locally).
 */
export class SyncEngine {
  constructor(
    private readonly store: LocalStore,
    private readonly provider: SyncProvider,
  ) {}

  /** Create the three data files in the remote repo if they don't exist yet. */
  async ensureInitialized(): Promise<void> {
    const profile = (await this.store.getProfile()) ?? createProfile();
    await this.store.setProfile(profile);

    if (!(await this.provider.readFile(FILES.profile))) {
      await this.provider.writeFile(FILES.profile, profile);
    }
    if (!(await this.provider.readFile(FILES.cards))) {
      await this.provider.writeFile(FILES.cards, CardsFileSchema.parse({ cards: [] }));
    }
    if (!(await this.provider.readFile(FILES.completions))) {
      await this.provider.writeFile(FILES.completions, CompletionsFileSchema.parse({ completions: [] }));
    }
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      pushedProfile: false,
      pushedCards: false,
      pushedCompletions: false,
      at: nowIso(),
    };

    result.pushedProfile = await this.syncProfile();
    result.pushedCards = await this.syncCards();
    result.pushedCompletions = await this.syncCompletions();

    await this.store.kvSet('lastSyncAt', result.at);
    return result;
  }

  private async syncProfile(): Promise<boolean> {
    return this.withConflictRetry(FILES.profile, async () => {
      const remote = await this.provider.readFile(FILES.profile);
      const remoteProfile = remote?.content ? ProfileSchema.parse(remote.content) : null;
      const localProfile = (await this.store.getProfile()) ?? null;

      const merged: Profile =
        localProfile && remoteProfile
          ? mergeSingle(localProfile, remoteProfile)
          : (localProfile ?? remoteProfile ?? createProfile());

      await this.store.setProfile(merged);

      const changed = JSON.stringify(merged) !== JSON.stringify(remoteProfile);
      if (changed) await this.provider.writeFile(FILES.profile, merged, remote?.sha);
      return changed;
    });
  }

  private async syncCards(): Promise<boolean> {
    return this.withConflictRetry(FILES.cards, async () => {
      const remote = await this.provider.readFile(FILES.cards);
      const remoteCards = remote?.content
        ? CardsFileSchema.parse(remote.content).cards
        : [];
      const localCards = await this.store.getAllCards();

      const merged = mergeRecords<OwnedCard>(localCards, remoteCards, (c) => c.userCardId);
      await this.store.putCards(merged);

      const changed =
        canonical(merged, (c) => c.userCardId) !== canonical(remoteCards, (c) => c.userCardId);
      if (changed) {
        await this.provider.writeFile(
          FILES.cards,
          CardsFileSchema.parse({ cards: merged, updatedAt: nowIso() }),
          remote?.sha,
        );
      }
      return changed;
    });
  }

  private async syncCompletions(): Promise<boolean> {
    return this.withConflictRetry(FILES.completions, async () => {
      const remote = await this.provider.readFile(FILES.completions);
      const remoteCompletions = remote?.content
        ? CompletionsFileSchema.parse(remote.content).completions
        : [];
      const localCompletions = await this.store.getAllCompletions();

      const merged = mergeRecords<Completion>(localCompletions, remoteCompletions, (c) => c.id);
      await this.store.putCompletions(merged);

      const changed =
        canonical(merged, (c) => c.id) !== canonical(remoteCompletions, (c) => c.id);
      if (changed) {
        await this.provider.writeFile(
          FILES.completions,
          CompletionsFileSchema.parse({ completions: merged, updatedAt: nowIso() }),
          remote?.sha,
        );
      }
      return changed;
    });
  }

  /** Retry a file sync once if the remote changed underneath us mid-write. */
  private async withConflictRetry(_path: string, op: () => Promise<boolean>): Promise<boolean> {
    try {
      return await op();
    } catch (err) {
      if (err instanceof ConflictError) {
        return op();
      }
      throw err;
    }
  }
}
