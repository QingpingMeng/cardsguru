import { create } from 'zustand';
import { getBuiltInCatalog, fetchRemoteCatalog } from '@/lib/catalog';
import { CatalogSchema, type Catalog } from '@/lib/catalog/schema';
import { getLocalStore, type RepoConfig } from '@/lib/data/db';
import {
  AUTO_PERIOD_KEY,
  CompletionSchema,
  completionId,
  createOwnedCard,
  createProfile,
  nowIso,
  type Completion,
  type CompletionStatus,
  type NewOwnedCardInput,
  type OwnedCard,
  type Profile,
  type Settings,
} from '@/lib/data/schema';
import { AuthError, GitHubSyncProvider, SyncEngine, type ConnectionInfo } from '@/lib/sync';
import { withoutDeleted } from '@/lib/sync/merge';

export type ConnectionStatus = 'loading' | 'disconnected' | 'connected';
export type SyncState = 'idle' | 'syncing' | 'error' | 'offline';

export interface CatalogUpdateResult {
  updated: boolean;
  fromVersion: number;
  toVersion: number;
  message?: string;
}

interface AppState {
  status: ConnectionStatus;
  catalog: Catalog;
  profile: Profile | null;
  cards: OwnedCard[];
  completions: Completion[];
  repoConfig: RepoConfig | null;
  token: string | null;
  sync: { state: SyncState; lastSyncAt?: string; message?: string };

  init: () => Promise<void>;
  connect: (input: RepoConfig & { token: string }) => Promise<ConnectionInfo>;
  disconnect: () => Promise<void>;
  addCard: (input: NewOwnedCardInput) => Promise<void>;
  updateCard: (userCardId: string, patch: Partial<Omit<OwnedCard, 'userCardId'>>) => Promise<void>;
  removeCard: (userCardId: string) => Promise<void>;
  setCompletion: (
    userCardId: string,
    benefitId: string,
    periodKey: string,
    status: CompletionStatus | null,
    amount?: number,
  ) => Promise<void>;
  setAutoBenefit: (userCardId: string, benefitId: string, enabled: boolean) => Promise<void>;
  updateSettings: (patch: Partial<Settings>) => Promise<void>;
  syncNow: () => Promise<void>;
  refreshCatalog: () => Promise<CatalogUpdateResult>;
}

function defaultCatalogUrl(): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}catalog/catalog.json`.replace(/\/{2,}/g, '/');
}

export const useAppStore = create<AppState>((set, get) => {
  function buildProvider(): GitHubSyncProvider | null {
    const { token, repoConfig } = get();
    if (!token || !repoConfig) return null;
    return new GitHubSyncProvider({ token, ...repoConfig });
  }

  async function reloadFromLocal(): Promise<void> {
    const store = await getLocalStore();
    const [profile, cards, completions] = await Promise.all([
      store.getProfile(),
      store.getAllCards(),
      store.getAllCompletions(),
    ]);
    set({
      profile: profile ?? null,
      cards: withoutDeleted(cards).filter((c) => !c.deleted),
      completions: withoutDeleted(completions),
    });
  }

  async function backgroundSync(): Promise<void> {
    if (get().status !== 'connected') return;
    if (get().sync.state === 'syncing') return;
    await get().syncNow();
  }

  // Periodic catalog refresh: on launch, check the app repo for a newer catalog
  // at most once per interval so we pick up benefit changes / new card releases
  // without hitting the network on every load.
  async function maybeAutoRefreshCatalog(): Promise<void> {
    const CHECK_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12h
    try {
      const store = await getLocalStore();
      const last = await store.kvGet<string>('catalogCheckedAt');
      if (last && Date.now() - new Date(last).getTime() < CHECK_INTERVAL_MS) return;
      await get().refreshCatalog();
      await store.kvSet('catalogCheckedAt', nowIso());
    } catch {
      // best-effort; manual "Check for updates" remains available.
    }
  }

  return {
    status: 'loading',
    catalog: getBuiltInCatalog(),
    profile: null,
    cards: [],
    completions: [],
    repoConfig: null,
    token: null,
    sync: { state: 'idle' },

    async init() {
      const store = await getLocalStore();
      const [token, repoConfig, lastSyncAt, cachedCatalog] = await Promise.all([
        store.kvGet<string>('pat'),
        store.kvGet<RepoConfig>('repoConfig'),
        store.kvGet<string>('lastSyncAt'),
        store.kvGet<unknown>('catalogCache'),
      ]);

      let catalog = getBuiltInCatalog();
      if (cachedCatalog) {
        const parsed = CatalogSchema.safeParse(cachedCatalog);
        if (parsed.success && parsed.data.catalogVersion >= catalog.catalogVersion) {
          catalog = parsed.data;
        }
      }

      await reloadFromLocal();
      set({
        catalog,
        token: token ?? null,
        repoConfig: repoConfig ?? null,
        status: token && repoConfig ? 'connected' : 'disconnected',
        sync: { state: 'idle', lastSyncAt },
      });

      void backgroundSync();
      void maybeAutoRefreshCatalog();
    },

    async connect(input) {
      const provider = new GitHubSyncProvider(input);
      const info = await provider.checkConnection();
      if (!info.ok || !info.canWrite) return info;

      const store = await getLocalStore();
      const repoConfig: RepoConfig = {
        owner: input.owner,
        repo: input.repo,
        branch: input.branch,
        basePath: input.basePath,
      };
      await store.kvSet('pat', input.token);
      await store.kvSet('repoConfig', repoConfig);

      if (!(await store.getProfile())) await store.setProfile(createProfile());

      set({ token: input.token, repoConfig, status: 'connected' });

      const engine = new SyncEngine(store, provider);
      set({ sync: { ...get().sync, state: 'syncing' } });
      try {
        await engine.ensureInitialized();
        const res = await engine.sync();
        await reloadFromLocal();
        set({ sync: { state: 'idle', lastSyncAt: res.at } });
      } catch (err) {
        set({ sync: { state: 'error', message: errorMessage(err) } });
      }
      return info;
    },

    async disconnect() {
      const store = await getLocalStore();
      await store.clearAll();
      set({
        status: 'disconnected',
        token: null,
        repoConfig: null,
        profile: null,
        cards: [],
        completions: [],
        sync: { state: 'idle' },
      });
    },

    async addCard(input) {
      const store = await getLocalStore();
      const card = createOwnedCard(input);
      await store.putCard(card);
      await reloadFromLocal();
      void backgroundSync();
    },

    async updateCard(userCardId, patch) {
      const store = await getLocalStore();
      const all = await store.getAllCards();
      const current = all.find((c) => c.userCardId === userCardId);
      if (!current) return;
      await store.putCard({ ...current, ...patch, userCardId, updatedAt: nowIso() });
      await reloadFromLocal();
      void backgroundSync();
    },

    async removeCard(userCardId) {
      const store = await getLocalStore();
      const all = await store.getAllCards();
      const current = all.find((c) => c.userCardId === userCardId);
      if (!current) return;
      await store.putCard({ ...current, deleted: true, updatedAt: nowIso() });
      await reloadFromLocal();
      void backgroundSync();
    },

    async setCompletion(userCardId, benefitId, periodKey, status, amount) {
      const store = await getLocalStore();
      const id = completionId(userCardId, benefitId, periodKey);
      const existing = (await store.getAllCompletions()).find((c) => c.id === id);
      const ts = nowIso();

      if (status === null) {
        if (existing) await store.putCompletion({ ...existing, deleted: true, updatedAt: ts });
      } else {
        const completion = CompletionSchema.parse({
          id,
          userCardId,
          benefitId,
          periodKey,
          status,
          amount,
          completedAt: existing?.completedAt ?? ts,
          updatedAt: ts,
          deleted: false,
        } satisfies Partial<Completion>);
        await store.putCompletion(completion);
      }
      await reloadFromLocal();
      void backgroundSync();
    },

    async setAutoBenefit(userCardId, benefitId, enabled) {
      // "Set & forget" is stored as a sentinel-period completion so it reuses the
      // existing completion persistence, sync, and last-write-wins merge.
      await get().setCompletion(userCardId, benefitId, AUTO_PERIOD_KEY, enabled ? 'used' : null);
    },

    async updateSettings(patch) {
      const store = await getLocalStore();
      const current = (await store.getProfile()) ?? createProfile();
      const next: Profile = {
        ...current,
        settings: { ...current.settings, ...patch },
        updatedAt: nowIso(),
      };
      await store.setProfile(next);
      set({ profile: next });
      void backgroundSync();
    },

    async syncNow() {
      const provider = buildProvider();
      if (!provider) return;
      const store = await getLocalStore();
      set({ sync: { ...get().sync, state: 'syncing' } });
      try {
        const engine = new SyncEngine(store, provider);
        const res = await engine.sync();
        await reloadFromLocal();
        set({ sync: { state: 'idle', lastSyncAt: res.at } });
      } catch (err) {
        if (err instanceof AuthError) {
          set({ sync: { state: 'error', message: 'GitHub token rejected — reconnect in Settings.' } });
        } else if (isNetworkError(err)) {
          set({ sync: { state: 'offline', lastSyncAt: get().sync.lastSyncAt } });
        } else {
          set({ sync: { state: 'error', message: errorMessage(err) } });
        }
      }
    },

    async refreshCatalog() {
      const store = await getLocalStore();
      const current = get().catalog;
      const url = get().profile?.settings.catalogUrl ?? defaultCatalogUrl();
      try {
        const remote = await fetchRemoteCatalog(url);
        if (remote.catalogVersion > current.catalogVersion) {
          await store.kvSet('catalogCache', remote);
          set({ catalog: remote });
          return { updated: true, fromVersion: current.catalogVersion, toVersion: remote.catalogVersion };
        }
        return { updated: false, fromVersion: current.catalogVersion, toVersion: remote.catalogVersion };
      } catch (err) {
        return {
          updated: false,
          fromVersion: current.catalogVersion,
          toVersion: current.catalogVersion,
          message: errorMessage(err),
        };
      }
    },
  };
});

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof Error && /network|fetch|failed to fetch/i.test(err.message));
}
