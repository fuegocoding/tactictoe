import { describe, expect, it } from 'vitest';
import { updateRating, rateGame, DEFAULT_RATING } from '../index.js';

describe('updateRating', () => {
  it('increases uncertainty when no games played', () => {
    // Need a player with RD < 350 to see the RD increase, since it caps at 350
    const player = { rating: 1500, rd: 200, volatility: 0.06 };
    const newRating = updateRating(player, []);

    expect(newRating.rating).toBe(player.rating);
    expect(newRating.rd).toBeGreaterThan(player.rd);
    expect(newRating.volatility).toBe(player.volatility);
  });

  it('caps uncertainty at 350 when no games played', () => {
    const player = { ...DEFAULT_RATING }; // RD is 350
    const newRating = updateRating(player, []);

    expect(newRating.rating).toBe(player.rating);
    expect(newRating.rd).toBe(350); // It caps at 350, it doesn't go above
    expect(newRating.volatility).toBe(player.volatility);
  });

  it('updates rating for a single win', () => {
    const player = { ...DEFAULT_RATING };
    const opponent = { ...DEFAULT_RATING };

    const newRating = updateRating(player, [{ opponent, score: 1 }]);

    expect(newRating.rating).toBeGreaterThan(player.rating);
    expect(newRating.rd).toBeLessThan(player.rd);
  });

  it('updates rating for multiple games', () => {
    const player = { rating: 1500, rd: 200, volatility: 0.06 };
    const opponent1 = { rating: 1400, rd: 30, volatility: 0.06 };
    const opponent2 = { rating: 1550, rd: 100, volatility: 0.06 };
    const opponent3 = { rating: 1700, rd: 300, volatility: 0.06 };

    const newRating = updateRating(player, [
      { opponent: opponent1, score: 1 },
      { opponent: opponent2, score: 0 },
      { opponent: opponent3, score: 0 },
    ]);

    expect(newRating.rating).toBeDefined();
    expect(newRating.rd).toBeDefined();
    expect(newRating.volatility).toBeDefined();

    // Check against expected values roughly from Glickman's paper
    // Glickman paper example has rating 1500 -> 1464, RD 200 -> 151
    expect(newRating.rating).toBeCloseTo(1464, -1);
    expect(newRating.rd).toBeCloseTo(151, -1);
  });
});

describe('rateGame', () => {
  it('updates rating for a win', () => {
    const player = { ...DEFAULT_RATING };
    const opponent = { ...DEFAULT_RATING };

    const newRating = rateGame(player, opponent, 'win');

    expect(newRating.rating).toBeGreaterThan(player.rating);
    expect(newRating.rd).toBeLessThan(player.rd);
  });

  it('updates rating for a loss', () => {
    const player = { ...DEFAULT_RATING };
    const opponent = { ...DEFAULT_RATING };

    const newRating = rateGame(player, opponent, 'loss');

    expect(newRating.rating).toBeLessThan(player.rating);
    expect(newRating.rd).toBeLessThan(player.rd);
  });

  it('updates rating for a draw', () => {
    const player = { ...DEFAULT_RATING };
    const opponent = { ...DEFAULT_RATING };

    const newRating = rateGame(player, opponent, 'draw');

    // For two equally rated default players, a draw shouldn't change rating much,
    // but RD should decrease
    expect(newRating.rd).toBeLessThan(player.rd);
    expect(newRating.rating).toBe(player.rating); // With equal ratings, draw keeps it same
  });

  it('rewards underdog wins more than favorite wins', () => {
    const underdog = { ...DEFAULT_RATING, rating: 1200 };
    const favorite = { ...DEFAULT_RATING, rating: 1800 };

    const underdogWin = rateGame(underdog, favorite, 'win');
    const favoriteWin = rateGame(favorite, underdog, 'win');

    const underdogGain = underdogWin.rating - underdog.rating;
    const favoriteGain = favoriteWin.rating - favorite.rating;

    expect(underdogGain).toBeGreaterThan(favoriteGain);
  });

  it('penalizes favorite losses more than underdog losses', () => {
    const underdog = { ...DEFAULT_RATING, rating: 1200 };
    const favorite = { ...DEFAULT_RATING, rating: 1800 };

    const underdogLoss = rateGame(underdog, favorite, 'loss');
    const favoriteLoss = rateGame(favorite, underdog, 'loss');

    const underdogDrop = underdog.rating - underdogLoss.rating;
    const favoriteDrop = favorite.rating - favoriteLoss.rating;

    expect(favoriteDrop).toBeGreaterThan(underdogDrop);
  });

  it('behaves exactly like updateRating with a single game', () => {
    const player = { ...DEFAULT_RATING, rating: 1600 };
    const opponent = { ...DEFAULT_RATING, rating: 1400 };

    const rateGameResult = rateGame(player, opponent, 'win');
    const updateRatingResult = updateRating(player, [{ opponent, score: 1 }]);

    expect(rateGameResult).toEqual(updateRatingResult);

    const rateGameLoss = rateGame(player, opponent, 'loss');
    const updateRatingLoss = updateRating(player, [{ opponent, score: 0 }]);

    expect(rateGameLoss).toEqual(updateRatingLoss);

    const rateGameDraw = rateGame(player, opponent, 'draw');
    const updateRatingDraw = updateRating(player, [{ opponent, score: 0.5 }]);

    expect(rateGameDraw).toEqual(updateRatingDraw);
  });
});
