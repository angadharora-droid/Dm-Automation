import { describe, expect, it } from 'vitest';
import { findMatchingRule, textMatchesKeyword } from '../src/services/automation/keyword-matcher.js';

describe('textMatchesKeyword', () => {
  it('matches case-insensitively', () => {
    expect(textMatchesKeyword('PRICE', 'price')).toBe(true);
    expect(textMatchesKeyword('Price please', 'price')).toBe(true);
  });

  it('matches with surrounding punctuation and emoji', () => {
    expect(textMatchesKeyword('price?!', 'price')).toBe(true);
    expect(textMatchesKeyword('🔥 price 🔥', 'price')).toBe(true);
    expect(textMatchesKeyword('what is the price.', 'price')).toBe(true);
  });

  it('does not match keywords inside other words', () => {
    expect(textMatchesKeyword('priced to sell', 'price')).toBe(false);
    expect(textMatchesKeyword('overpriced', 'price')).toBe(false);
    expect(textMatchesKeyword('information', 'info')).toBe(false);
  });

  it('matches multi-word phrases as substrings', () => {
    expect(textMatchesKeyword('hey, how much is this?', 'how much')).toBe(true);
    expect(textMatchesKeyword('how many?', 'how much')).toBe(false);
  });

  it('ignores empty keywords', () => {
    expect(textMatchesKeyword('anything', '')).toBe(false);
    expect(textMatchesKeyword('anything', '   ')).toBe(false);
  });
});

describe('findMatchingRule', () => {
  const rules = [
    { id: 'a', keywords: ['price', 'cost'] },
    { id: 'b', keywords: ['link'] },
  ];

  it('returns the first rule with a matching keyword', () => {
    expect(findMatchingRule('send me the LINK', rules)?.id).toBe('b');
    expect(findMatchingRule('what does it cost?', rules)?.id).toBe('a');
  });

  it('returns undefined when nothing matches', () => {
    expect(findMatchingRule('lovely!', rules)).toBeUndefined();
  });
});
