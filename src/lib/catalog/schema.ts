import { z } from 'zod';

/**
 * How often a benefit's usage window resets.
 *
 * The reset *length* (frequency) composes with the reset *anchor* (calendar vs.
 * card anniversary). For example an annual credit that resets on the cardmember
 * anniversary is `frequency: 'annual'` + `resetAnchor: 'anniversary'` — this is
 * what is often called a "membership-year" credit.
 */
export const BenefitFrequencySchema = z.enum([
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'one_time',
]);
export type BenefitFrequency = z.infer<typeof BenefitFrequencySchema>;

export const ResetAnchorSchema = z.enum(['calendar', 'anniversary']);
export type ResetAnchor = z.infer<typeof ResetAnchorSchema>;

export const BenefitCategorySchema = z.enum([
  'travel',
  'hotel',
  'airline',
  'dining',
  'rideshare',
  'streaming',
  'entertainment',
  'shopping',
  'grocery',
  'wellness',
  'rewards',
  'other',
]);
export type BenefitCategory = z.infer<typeof BenefitCategorySchema>;

export const CardNetworkSchema = z.enum(['amex', 'visa', 'mastercard', 'discover']);
export type CardNetwork = z.infer<typeof CardNetworkSchema>;

export const MoneySchema = z.object({
  amount: z.number().nonnegative(),
  currency: z.string().default('USD'),
});
export type Money = z.infer<typeof MoneySchema>;

export const BenefitSchema = z.object({
  /** Globally unique, stable id — conventionally `${cardId}:${slug}`. */
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().default(''),
  category: BenefitCategorySchema.default('other'),
  /** Monetary value of the credit per period. Omitted for non-monetary perks. */
  value: MoneySchema.optional(),
  /** Human-readable cap/limit note, e.g. "up to $25 across two orders". */
  cap: z.string().optional(),
  frequency: BenefitFrequencySchema,
  resetAnchor: ResetAnchorSchema.default('calendar'),
  /** Whether the cardholder must enroll/activate before the credit applies. */
  enrollmentRequired: z.boolean().default(false),
  sourceUrl: z.string().url().optional(),
  terms: z.string().optional(),
  /** ISO date (YYYY-MM-DD) this benefit definition became effective. */
  validFrom: z.string().optional(),
  /** ISO date (YYYY-MM-DD) this benefit is known to end / stop being offered. */
  validTo: z.string().optional(),
});
export type Benefit = z.infer<typeof BenefitSchema>;

export const CardSchema = z.object({
  id: z.string().min(1),
  issuerId: z.string().min(1),
  name: z.string().min(1),
  network: CardNetworkSchema.optional(),
  annualFee: z.number().nonnegative().optional(),
  productUrl: z.string().url().optional(),
  /** Key selecting a card-art gradient rendered by the UI (used as a fallback). */
  artRef: z.string().optional(),
  /**
   * Optional URL to an official, issuer-hosted product image. Rendered over the
   * gradient when present; the gradient shows while it loads or if it fails.
   */
  imageUrl: z.string().url().optional(),
  benefits: z.array(BenefitSchema).default([]),
});
export type Card = z.infer<typeof CardSchema>;

export const IssuerSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
});
export type Issuer = z.infer<typeof IssuerSchema>;

export const CatalogSchema = z.object({
  /** Bumped when the *shape* of the catalog changes (breaking). */
  schemaVersion: z.number().int().positive(),
  /** Bumped on every data change; used by the update module to detect newer data. */
  catalogVersion: z.number().int().nonnegative(),
  /** ISO timestamp of the last data change. */
  updatedAt: z.string(),
  issuers: z.array(IssuerSchema),
  cards: z.array(CardSchema),
});
export type Catalog = z.infer<typeof CatalogSchema>;

/** The schema version this build understands. */
export const CURRENT_SCHEMA_VERSION = 1;
