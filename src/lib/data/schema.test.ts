import { describe, it, expect } from 'vitest';
import { OwnedCardSchema, createOwnedCard } from './schema';

describe('OwnedCard last4/last5 identifier', () => {
  const base = { userCardId: 'u1', catalogCardId: 'amex-platinum' };

  it('accepts a 4-digit identifier (non-Amex networks)', () => {
    expect(OwnedCardSchema.safeParse({ ...base, last4: '1234' }).success).toBe(true);
  });

  it('accepts a 5-digit identifier (Amex)', () => {
    expect(OwnedCardSchema.safeParse({ ...base, last4: '12345' }).success).toBe(true);
    expect(createOwnedCard({ catalogCardId: 'amex-platinum', last4: '12345' }).last4).toBe('12345');
  });

  it('rejects identifiers shorter than 4 or longer than 5 digits', () => {
    expect(OwnedCardSchema.safeParse({ ...base, last4: '123' }).success).toBe(false);
    expect(OwnedCardSchema.safeParse({ ...base, last4: '123456' }).success).toBe(false);
  });

  it('rejects non-numeric identifiers', () => {
    expect(OwnedCardSchema.safeParse({ ...base, last4: '12a4' }).success).toBe(false);
  });
});
