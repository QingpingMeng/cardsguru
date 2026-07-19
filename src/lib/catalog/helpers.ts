import type { Benefit, Card, Catalog, Issuer } from './schema';

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
