import { describe, expect, it } from 'vitest';
import { plain } from '../../src/ui/text.js';

describe('plain', () => {
  it('neutralizes masked links, mentions and formatting', () => {
    expect(plain('[Free](https://evil.test)')).toBe('\\[Free\\]\\(https://evil.test\\)');
    expect(plain('<@123> **bold**')).toBe('\\<@123\\> \\*\\*bold\\*\\*');
    expect(plain('a\\b')).toBe('a\\\\b');
  });

  it('keeps ordinary titles untouched', () => {
    expect(plain("7 Wonders: Duel — l'édition 2026!")).toBe("7 Wonders: Duel — l'édition 2026!");
  });
});
