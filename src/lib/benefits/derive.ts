import type { Benefit, Card, Catalog } from '@/lib/catalog/schema';
import { indexCatalog, isBenefitActive } from '@/lib/catalog/helpers';
import { AUTO_PERIOD_KEY, cardAnchorDate, type Completion, type OwnedCard } from '@/lib/data/schema';
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
  const cards = withoutDeleted(input.cards).filter((c) => !c.archived);
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
