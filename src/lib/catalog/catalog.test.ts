import { describe, it, expect } from 'vitest';
import { getBuiltInCatalog } from './loadCatalog';
import { indexCatalog, annualBenefitValue } from './helpers';

describe('bundled catalog', () => {
  const catalog = getBuiltInCatalog();

  it('validates against the schema', () => {
    expect(catalog.schemaVersion).toBe(1);
    expect(catalog.catalogVersion).toBeGreaterThanOrEqual(1);
    expect(catalog.cards.length).toBeGreaterThanOrEqual(10);
  });

  it('has unique card ids', () => {
    const ids = catalog.cards.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has globally unique benefit ids prefixed by their card id', () => {
    const seen = new Set<string>();
    for (const card of catalog.cards) {
      for (const benefit of card.benefits) {
        expect(seen.has(benefit.id)).toBe(false);
        seen.add(benefit.id);
        expect(benefit.id.startsWith(`${card.id}:`)).toBe(true);
      }
    }
  });

  it('references only issuers that exist', () => {
    const issuerIds = new Set(catalog.issuers.map((i) => i.id));
    for (const card of catalog.cards) {
      expect(issuerIds.has(card.issuerId)).toBe(true);
    }
  });

  it('gives every card at least one recurring benefit', () => {
    for (const card of catalog.cards) {
      expect(card.benefits.length).toBeGreaterThan(0);
    }
  });

  it('indexes cards and benefits', () => {
    const index = indexCatalog(catalog);
    expect(index.cardsById.get('amex-platinum')?.name).toBe('The Platinum Card');
    expect(index.benefitsById.get('amex-gold:uber-cash')?.value?.amount).toBe(10);
    expect(index.cardIdByBenefitId.get('amex-gold:uber-cash')).toBe('amex-gold');
  });

  it('computes a positive annual value for cards with monetary credits', () => {
    const platinum = catalog.cards.find((c) => c.id === 'amex-platinum')!;
    // Uber 15*12 + Digital 20*12 + Saks 50*2 + Airline 200 + Hotel 200 + Walmart 12.95*12 + CLEAR 199
    expect(annualBenefitValue(platinum)).toBeGreaterThan(1000);
  });
});
