import { describe, it, expect } from 'vitest';
import { updateRating, DEFAULT_RATING, Rating, MatchResult } from './index';

describe('Glicko-2 updateRating', () => {
  it('should return increased uncertainty when no games are played', () => {
    // We use a lower initial RD so we can actually see it increase up to the max (350).
    const playerWithLowRd: Rating = { ...DEFAULT_RATING, rd: 200 };
    const result = updateRating(playerWithLowRd, []);

    expect(result.rating).toBe(playerWithLowRd.rating); // rating doesn't change
    expect(result.volatility).toBe(playerWithLowRd.volatility); // volatility doesn't change
    expect(result.rd).toBeGreaterThan(playerWithLowRd.rd); // uncertainty increases
  });

  it('should handle single win against same rating', () => {
    const player: Rating = { ...DEFAULT_RATING };
    const opponent: Rating = { ...DEFAULT_RATING };

    const results: MatchResult[] = [
      { opponent, score: 1 }
    ];

    const result = updateRating(player, results);

    expect(result.rating).toBeGreaterThan(player.rating);
    expect(result.rd).toBeLessThan(player.rd);
  });

  it('should handle single loss against same rating', () => {
    const player: Rating = { ...DEFAULT_RATING };
    const opponent: Rating = { ...DEFAULT_RATING };

    const results: MatchResult[] = [
      { opponent, score: 0 }
    ];

    const result = updateRating(player, results);

    expect(result.rating).toBeLessThan(player.rating);
    expect(result.rd).toBeLessThan(player.rd);
  });

  it('should handle single draw against same rating', () => {
    const player: Rating = { ...DEFAULT_RATING };
    const opponent: Rating = { ...DEFAULT_RATING };

    const results: MatchResult[] = [
      { opponent, score: 0.5 }
    ];

    const result = updateRating(player, results);

    // For a draw against same rating, the new rating should be the same
    expect(result.rating).toBe(player.rating);
    expect(result.rd).toBeLessThan(player.rd);
  });

  it('should compute the classic Glicko-2 example correctly', () => {
    // Reference: http://www.glicko.net/glicko/glicko2.pdf section 3 "Example of the Glicko-2 system"
    // Note: The example uses a system constant τ = 0.5.

    const player: Rating = {
      rating: 1500,
      rd: 200,
      volatility: 0.06
    };

    const results: MatchResult[] = [
      { opponent: { rating: 1400, rd: 30, volatility: 0.06 }, score: 1 },
      { opponent: { rating: 1550, rd: 100, volatility: 0.06 }, score: 0 },
      { opponent: { rating: 1700, rd: 300, volatility: 0.06 }, score: 0 }
    ];

    const result = updateRating(player, results);

    // According to the document:
    // New rating ≈ 1464
    // New RD ≈ 151.52 (rounds to 152)
    // New volatility ≈ 0.05999

    expect(result.rating).toBe(1464);
    expect(result.rd).toBe(152);
    expect(result.volatility).toBeCloseTo(0.05999, 4);
  });
});
