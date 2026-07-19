import { z } from 'zod';

/** Bump when the on-disk user-data shape changes in a breaking way. */
export const USER_SCHEMA_VERSION = 1;

export function nowIso(): string {
  return new Date().toISOString();
}

/** RFC4122 id with a safe fallback for environments lacking crypto.randomUUID. */
export function uuid(): string {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === 'function') return c.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ---- Settings & profile -----------------------------------------------------

export const ThemePreferenceSchema = z.enum(['auto', 'light', 'dark']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const TransparencyPreferenceSchema = z.enum(['auto', 'high', 'low']);
export type TransparencyPreference = z.infer<typeof TransparencyPreferenceSchema>;

export const SettingsSchema = z.object({
  theme: ThemePreferenceSchema.default('auto'),
  transparency: TransparencyPreferenceSchema.default('auto'),
  /** Days before reset at which an unused credit is surfaced as "expiring soon". */
  notifThresholdDays: z.number().int().min(1).max(90).default(7),
  /** Override URL the update module fetches the latest catalog from. */
  catalogUrl: z.string().url().optional(),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const ProfileSchema = z.object({
  schemaVersion: z.number().int().default(USER_SCHEMA_VERSION),
  settings: SettingsSchema.default({}),
  createdAt: z.string().default(nowIso),
  updatedAt: z.string().default(nowIso),
  lastSyncAt: z.string().optional(),
});
export type Profile = z.infer<typeof ProfileSchema>;

// ---- Owned cards ------------------------------------------------------------

export const OwnedCardSchema = z.object({
  /** Stable per-account-instance id (multiple of the same product each get one). */
  userCardId: z.string(),
  /** References a catalog card id. */
  catalogCardId: z.string(),
  /** Last 4–5 digits — disambiguates multiple cards of the same product.
   * Amex uses 5 (its 15-digit numbers collide more often on the last 4). */
  last4: z.string().regex(/^\d{4,5}$/),
  nickname: z.string().max(60).optional(),
  /** 'YYYY-MM-DD' account open date; used as the anniversary anchor. */
  openedDate: z.string().optional(),
  /** Optional explicit anniversary override ('YYYY-MM-DD'); defaults to openedDate. */
  anniversaryDate: z.string().optional(),
  addedAt: z.string().default(nowIso),
  updatedAt: z.string().default(nowIso),
  /** User archived the card (kept for history) but no longer active. */
  archived: z.boolean().default(false),
  /** Sync tombstone — hard-removed on all devices, filtered from reads. */
  deleted: z.boolean().default(false),
});
export type OwnedCard = z.infer<typeof OwnedCardSchema>;

export const CardsFileSchema = z.object({
  schemaVersion: z.number().int().default(USER_SCHEMA_VERSION),
  cards: z.array(OwnedCardSchema).default([]),
  updatedAt: z.string().default(nowIso),
});
export type CardsFile = z.infer<typeof CardsFileSchema>;

// ---- Completions ------------------------------------------------------------

export const CompletionStatusSchema = z.enum(['used', 'skipped']);
export type CompletionStatus = z.infer<typeof CompletionStatusSchema>;

export const CompletionSchema = z.object({
  /** Deterministic id: `${userCardId}:${benefitId}:${periodKey}`. */
  id: z.string(),
  userCardId: z.string(),
  benefitId: z.string(),
  periodKey: z.string(),
  status: CompletionStatusSchema.default('used'),
  amount: z.number().nonnegative().optional(),
  note: z.string().max(280).optional(),
  completedAt: z.string().default(nowIso),
  updatedAt: z.string().default(nowIso),
  /** Sync tombstone for un-marking across devices. */
  deleted: z.boolean().default(false),
});
export type Completion = z.infer<typeof CompletionSchema>;

export const CompletionsFileSchema = z.object({
  schemaVersion: z.number().int().default(USER_SCHEMA_VERSION),
  completions: z.array(CompletionSchema).default([]),
  updatedAt: z.string().default(nowIso),
});
export type CompletionsFile = z.infer<typeof CompletionsFileSchema>;

// ---- Factories & helpers ----------------------------------------------------

export function completionId(userCardId: string, benefitId: string, periodKey: string): string {
  return `${userCardId}:${benefitId}:${periodKey}`;
}

/**
 * Sentinel `periodKey` marking a benefit as "set & forget": a single action (e.g. an
 * always-on subscription) satisfies the credit every period, so it counts as used for
 * the current and all future periods until the user turns it off. Stored as an ordinary
 * completion so it rides the existing sync/merge machinery.
 */
export const AUTO_PERIOD_KEY = 'auto';

/** Deterministic id for a benefit's set-and-forget marker on a specific owned card. */
export function autoCompletionId(userCardId: string, benefitId: string): string {
  return completionId(userCardId, benefitId, AUTO_PERIOD_KEY);
}

export function createProfile(settings?: Partial<Settings>): Profile {
  const ts = nowIso();
  return ProfileSchema.parse({
    settings: SettingsSchema.parse(settings ?? {}),
    createdAt: ts,
    updatedAt: ts,
  });
}

export interface NewOwnedCardInput {
  catalogCardId: string;
  last4: string;
  nickname?: string;
  openedDate?: string;
  anniversaryDate?: string;
}

export function createOwnedCard(input: NewOwnedCardInput): OwnedCard {
  const ts = nowIso();
  return OwnedCardSchema.parse({
    userCardId: uuid(),
    catalogCardId: input.catalogCardId,
    last4: input.last4,
    nickname: input.nickname,
    openedDate: input.openedDate,
    anniversaryDate: input.anniversaryDate,
    addedAt: ts,
    updatedAt: ts,
  });
}

/** The date to use as the anniversary anchor for a card (explicit override or open date). */
export function cardAnchorDate(card: OwnedCard): Date | undefined {
  const raw = card.anniversaryDate ?? card.openedDate;
  return raw ? new Date(raw) : undefined;
}
