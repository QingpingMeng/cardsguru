import { describe, it, expect } from 'vitest';
import { formatCategory, formatFrequency } from './format';

describe('formatCategory', () => {
  it('maps each benefit category to a human label', () => {
    expect(formatCategory('travel')).toBe('Travel');
    expect(formatCategory('rideshare')).toBe('Rideshare');
    expect(formatCategory('other')).toBe('Other');
  });
});

describe('formatFrequency', () => {
  it('maps reset cycles to human labels', () => {
    expect(formatFrequency('monthly')).toBe('Monthly');
    expect(formatFrequency('semiannual')).toBe('Semi-annual');
    expect(formatFrequency('one_time')).toBe('One-time');
  });
});
