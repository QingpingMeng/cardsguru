import type { Benefit, Card, Catalog, Issuer } from './schema';
import type { OwnedCard } from '@/lib/data/schema';

export interface CatalogIndex {
  issuersById: Map<string, Issuer>;
  cardsById: Map<string, Card>;
  benefitsById: Map<string, Benefit>;
  /** benefitId -> owning cardId */
  cardIdByBenefitId: Map<string, string>;
}

/** Build lookup maps for O(1) access to cards, benefits, and issuers. */
export function indexCatalog(catalog: Catalog): CatalogIndex {
  const issuersById = new Map<string, Issuer>();
  const cardsById = new Map<string, Card>();
  const benefitsById = new Map<string, Benefit>();
  const cardIdByBenefitId = new Map<string, string>();

  for (const issuer of catalog.issuers) issuersById.set(issuer.id, issuer);
  for (const card of catalog.cards) {
    cardsById.set(card.id, card);
    for (const benefit of card.benefits) {
      benefitsById.set(benefit.id, benefit);
      cardIdByBenefitId.set(benefit.id, card.id);
    }
  }

  return { issuersById, cardsById, benefitsById, cardIdByBenefitId };
}

export function getIssuerName(catalog: Catalog, issuerId: string): string {
  return catalog.issuers.find((i) => i.id === issuerId)?.name ?? issuerId;
}

/**
 * Filter catalog cards by a free-text query. Whitespace-separated terms are
 * AND-matched (case-insensitively) against the card name, its issuer's name,
 * and its network — so "amex gold" matches an American Express card named
 * "Gold Card". An empty or whitespace-only query returns every card.
 */
export function searchCards(catalog: Catalog, query: string): Card[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return catalog.cards;
  return catalog.cards.filter((card) => {
    const haystack = [card.name, getIssuerName(catalog, card.issuerId), card.network ?? '']
      .join(' ')
      .toLowerCase();
    return terms.every((term) => haystack.includes(term));
  });
}

/** Total advertised annual value of a card's monetary recurring credits. */
export function annualBenefitValue(card: Card): number {
  const perYear: Record<Benefit['frequency'], number> = {
    monthly: 12,
    quarterly: 4,
    semiannual: 2,
    annual: 1,
    one_time: 1,
  };
  return card.benefits.reduce((sum, b) => {
    if (!b.value) return sum;
    return sum + b.value.amount * perYear[b.frequency];
  }, 0);
}

/** Whether a benefit is currently offered given a reference date (respects validTo). */
export function isBenefitActive(benefit: Benefit, on: Date = new Date()): boolean {
  if (benefit.validFrom && new Date(benefit.validFrom) > on) return false;
  if (benefit.validTo && new Date(benefit.validTo) < on) return false;
  return true;
}

export type ProductChangeDirection = 'upgrade' | 'downgrade' | 'change';

/**
 * Classify a product change (upgrade / downgrade / lateral) between two catalog
 * products. Annual fee is the clearest signal, so it decides first; when fees are
 * equal or unknown we fall back to total advertised annual benefit value, and
 * finally to a neutral 'change' when neither can tell them apart.
 */
export function productChangeDirection(from: Card, to: Card): ProductChangeDirection {
  if (from.annualFee != null && to.annualFee != null && from.annualFee !== to.annualFee) {
    return to.annualFee > from.annualFee ? 'upgrade' : 'downgrade';
  }
  const byValue = annualBenefitValue(to) - annualBenefitValue(from);
  if (byValue > 0) return 'upgrade';
  if (byValue < 0) return 'downgrade';
  return 'change';
}

/**
 * Describe an owned card's most recent product change for display, e.g.
 * "Upgraded from Amex Gold". Returns undefined when the card has no lineage.
 */
export function describeLineage(catalog: Catalog, card: OwnedCard): string | undefined {
  const prev = card.productHistory[card.productHistory.length - 1];
  if (!prev) return undefined;
  const fromCard = catalog.cards.find((c) => c.id === prev.catalogCardId);
  const toCard = catalog.cards.find((c) => c.id === card.catalogCardId);
  const fromName = fromCard?.name ?? prev.catalogCardId;
  if (!fromCard || !toCard) return `Changed from ${fromName}`;
  const dir = productChangeDirection(fromCard, toCard);
  const verb = dir === 'upgrade' ? 'Upgraded' : dir === 'downgrade' ? 'Downgraded' : 'Changed';
  return `${verb} from ${fromName}`;
}
