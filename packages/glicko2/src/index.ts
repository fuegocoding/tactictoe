// Glicko-2 Algorithm
// Reference: http://www.glicko.net/glicko/glicko2.pdf (Glickman 2012)

const GLICKO2_SCALE = 173.7178; // Convert Glicko-1 to Glicko-2 scale

export interface Rating {
  rating: number;       // μ in Glicko-1 scale (e.g. 1500)
  rd: number;           // φ in Glicko-1 scale (e.g. 350 for new player, 50 for established)
  volatility: number;   // σ (e.g. 0.06)
}

export interface MatchResult {
  opponent: Rating;
  score: 0 | 0.5 | 1;  // 0 = loss, 0.5 = draw, 1 = win
}

export const DEFAULT_RATING: Rating = {
  rating: 1500,
  rd: 350,
  volatility: 0.06,
};

// Constraint on volatility change (τ). Lower = more conservative.
const TAU = 0.5;

function toGlicko2(r: number): number { return (r - 1500) / GLICKO2_SCALE; }
function toGlicko1(r: number): number { return r * GLICKO2_SCALE + 1500; }
function toGlicko2Rd(rd: number): number { return rd / GLICKO2_SCALE; }
function toGlicko1Rd(rd: number): number { return rd * GLICKO2_SCALE; }

function g(phi: number): number {
  return 1 / Math.sqrt(1 + (3 * phi * phi) / (Math.PI * Math.PI));
}

function E(mu: number, muJ: number, phiJ: number): number {
  return 1 / (1 + Math.exp(-g(phiJ) * (mu - muJ)));
}

/**
 * Update a player's rating after a set of results in one rating period.
 * For single-game updates, pass a single result in the array.
 */
export function updateRating(player: Rating, results: MatchResult[]): Rating {
  const mu = toGlicko2(player.rating);
  const phi = toGlicko2Rd(player.rd);
  const sigma = player.volatility;

  if (results.length === 0) {
    // No games played — increase uncertainty only
    const phiStar = Math.sqrt(phi * phi + sigma * sigma);
    return { ...player, rd: Math.min(toGlicko1Rd(phiStar), 350) };
  }

  // Step 3: compute v (estimated variance)
  let v = 0;
  for (const { opponent, score: _ } of results) {
    const muJ = toGlicko2(opponent.rating);
    const phiJ = toGlicko2Rd(opponent.rd);
    const eVal = E(mu, muJ, phiJ);
    const gVal = g(phiJ);
    v += gVal * gVal * eVal * (1 - eVal);
  }
  v = 1 / v;

  // Step 4: compute delta (estimated improvement)
  let delta = 0;
  for (const { opponent, score } of results) {
    const muJ = toGlicko2(opponent.rating);
    const phiJ = toGlicko2Rd(opponent.rd);
    delta += g(phiJ) * (score - E(mu, muJ, phiJ));
  }
  delta *= v;

  // Step 5: update volatility σ' (Illinois algorithm)
  const a = Math.log(sigma * sigma);
  const f = (x: number) => {
    const eX = Math.exp(x);
    const phiSq = phi * phi;
    const dSq = delta * delta;
    const num1 = eX * (dSq - phiSq - v - eX);
    const den1 = 2 * Math.pow(phiSq + v + eX, 2);
    const num2 = x - a;
    const den2 = TAU * TAU;
    return num1 / den1 - num2 / den2;
  };

  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) {
    B = Math.log(delta * delta - phi * phi - v);
  } else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }

  let fA = f(A);
  let fB = f(B);
  const EPSILON = 1e-6;
  while (Math.abs(B - A) > EPSILON) {
    const C = A + (A - B) * fA / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) { A = B; fA = fB; }
    else { fA /= 2; }
    B = C;
    fB = fC;
  }

  const sigmaNew = Math.exp(A / 2);

  // Step 6: update RD
  const phiStar = Math.sqrt(phi * phi + sigmaNew * sigmaNew);

  // Step 7: update rating
  const phiNew = 1 / Math.sqrt(1 / (phiStar * phiStar) + 1 / v);
  let muNew = mu;
  for (const { opponent, score } of results) {
    const muJ = toGlicko2(opponent.rating);
    const phiJ = toGlicko2Rd(opponent.rd);
    muNew += phiNew * phiNew * g(phiJ) * (score - E(mu, muJ, phiJ));
  }

  return {
    rating: Math.round(toGlicko1(muNew)),
    rd: Math.round(toGlicko1Rd(phiNew)),
    volatility: sigmaNew,
  };
}

/** Convenience: compute rating change for a single game result. */
export function rateGame(
  player: Rating,
  opponent: Rating,
  outcome: 'win' | 'draw' | 'loss'
): Rating {
  const scoreMap = { win: 1, draw: 0.5, loss: 0 } as const;
  return updateRating(player, [{ opponent, score: scoreMap[outcome] }]);
}
