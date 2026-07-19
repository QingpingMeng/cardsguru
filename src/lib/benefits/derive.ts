import type { Benefit, BenefitCategory, Card, Catalog } from '@/lib/catalog/schema';
import { indexCatalog, isBenefitActive } from '@/lib/catalog/helpers';
import { AUTO_PERIOD_KEY, cardAnchorDate, type Completion, type OwnedCard } from '@/lib/data/schema';
import { formatCategory, formatFrequency } from '@/lib/format';
import { evaluateBenefit, type BenefitStatus } from '@/lib/period/periodEngine';
import { withoutDeleted } from '@/lib/sync/merge';

export interface DerivedBenefit {
  card: OwnedCard;
  catalogCard: Card;
  benefit: Benefit;
  periodKey: string;
  used: boolean;
  /** "Set & forget": auto-used every period until the user turns it off. */
  auto: boolean;
  completion?: Completion;
  status: BenefitStatus;
}

export interface DeriveInput {
  catalog: Catalog;
  cards: readonly OwnedCard[];
  completions: readonly Completion[];
  thresholdDays: number;
  referenceDate?: Date;
}

/**
 * Expand each owned card into its current-period benefit occurrences, joined with
 * completion state and period/expiry status. Pure — the single source of truth the
 * dashboard, expiring-soon list, and notifications all read from.
 */
export function deriveBenefits(input: DeriveInput): DerivedBenefit[] {
  const { catalog, thresholdDays, referenceDate = new Date() } = input;
  const index = indexCatalog(catalog);
  const cards = withoutDeleted(input.cards).filter((c) => !c.archived && !c.closedDate);
  const completions = withoutDeleted(input.completions);

  const out: DerivedBenefit[] = [];

  for (const card of cards) {
    const catalogCard = index.cardsById.get(card.catalogCardId);
    if (!catalogCard) continue;

    // Fall back to the date the card was added if no open/anniversary date is set.
    const anchorDate = cardAnchorDate(card) ?? new Date(card.addedAt);

    for (const benefit of catalogCard.benefits) {
      if (!isBenefitActive(benefit, referenceDate)) continue;

      const status = evaluateBenefit({
        frequency: benefit.frequency,
        resetAnchor: benefit.resetAnchor,
        thresholdDays,
        used: false, // recomputed below once we know completion state
        referenceDate,
        anchorDate,
        validFrom: benefit.validFrom ? new Date(benefit.validFrom) : undefined,
        validTo: benefit.validTo ? new Date(benefit.validTo) : undefined,
      });

      const periodKey = status.period.key;
      const auto = completions.some(
        (c) =>
          c.userCardId === card.userCardId &&
          c.benefitId === benefit.id &&
          c.periodKey === AUTO_PERIOD_KEY &&
          c.status === 'used',
      );
      const completion = completions.find(
        (c) => c.userCardId === card.userCardId && c.benefitId === benefit.id && c.periodKey === periodKey,
      );
      const used = auto || completion?.status === 'used';

      out.push({
        card,
        catalogCard,
        benefit,
        periodKey,
        used,
        auto,
        completion,
        // Re-evaluate expiringSoon with the real used flag.
        status: { ...status, expiringSoon: !used && status.expiringSoon },
      });
    }
  }

  return out;
}

/** Benefits whose unused credit will reset within the threshold, soonest first. */
export function expiringSoon(derived: readonly DerivedBenefit[]): DerivedBenefit[] {
  return derived
    .filter((d) => d.status.expiringSoon)
    .sort((a, b) => a.status.daysRemaining - b.status.daysRemaining);
}

export type BenefitGroup = { frequency: Benefit['frequency']; items: DerivedBenefit[] };

const FREQUENCY_ORDER: Benefit['frequency'][] = [
  'monthly',
  'quarterly',
  'semiannual',
  'annual',
  'one_time',
];

/** Group derived benefits by reset cycle in a stable, human-friendly order. */
export function groupByFrequency(derived: readonly DerivedBenefit[]): BenefitGroup[] {
  return FREQUENCY_ORDER.map((frequency) => ({
    frequency,
    items: derived.filter((d) => d.benefit.frequency === frequency),
  })).filter((g) => g.items.length > 0);
}

/** Dimension the dashboard aggregates benefits by. */
export type GroupBy = 'frequency' | 'card' | 'category';

/**
 * A rendered section of the dashboard: a heading plus the benefits under it.
 * `card`/`catalogCard` are populated only when grouping by card, so the header
 * can show the card art.
 */
export interface BenefitSection {
  /** Stable key for React and per-section collapse state. */
  key: string;
  title: string;
  /** Secondary heading text, e.g. a masked last-4 when grouping by card. */
  subtitle?: string;
  card?: OwnedCard;
  catalogCard?: Card;
  items: DerivedBenefit[];
}

const CATEGORY_ORDER: BenefitCategory[] = [
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
];

function sectionsByCard(derived: readonly DerivedBenefit[]): BenefitSection[] {
  const order: string[] = [];
  const byCard = new Map<string, DerivedBenefit[]>();
  for (const d of derived) {
    const key = d.card.userCardId;
    let items = byCard.get(key);
    if (!items) {
      items = [];
      byCard.set(key, items);
      order.push(key);
    }
    items.push(d);
  }
  return order.map((key) => {
    const items = byCard.get(key)!;
    const { card, catalogCard } = items[0];
    return {
      key,
      title: card.nickname || catalogCard.name,
      subtitle: `•••• ${card.last4}`,
      card,
      catalogCard,
      items,
    };
  });
}

function sectionsByCategory(derived: readonly DerivedBenefit[]): BenefitSection[] {
  return CATEGORY_ORDER.map((category) => ({
    key: category,
    title: formatCategory(category),
    items: derived.filter((d) => d.benefit.category === category),
  })).filter((s) => s.items.length > 0);
}

/**
 * Aggregate derived benefits into ordered, renderable sections for the chosen
 * dimension. Empty sections are omitted so the dashboard only shows what applies.
 */
export function groupBenefits(derived: readonly DerivedBenefit[], groupBy: GroupBy): BenefitSection[] {
  if (groupBy === 'card') return sectionsByCard(derived);
  if (groupBy === 'category') return sectionsByCategory(derived);
  return groupByFrequency(derived).map((g) => ({
    key: g.frequency,
    title: formatFrequency(g.frequency),
    items: g.items,
  }));
}
