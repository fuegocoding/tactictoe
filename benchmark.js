// benchmark.js
const { performance } = require('perf_hooks');

const NUM_COSMETICS = 10000;
const NUM_USER_COSMETICS = 5000;

// Generate mock data
const cosmetics = Array.from({ length: NUM_COSMETICS }, (_, i) => ({
  id: `cosmetic_${i}`,
  name: `Cosmetic ${i}`,
  price: i % 2 === 0 ? 100 : 0,
  requiredScore: i % 3 === 0 ? 500 : 0,
}));

const userCosmetics = Array.from({ length: NUM_USER_COSMETICS }, (_, i) => ({
  id: `uc_${i}`,
  cosmeticId: `cosmetic_${i * 2}`, // User owns every even cosmetic up to 10000
  isEquipped: i % 10 === 0,
}));

const maxScore = 1500;

function originalLogic() {
  return cosmetics.map((c) => {
    const uc = userCosmetics.find((u) => u.cosmeticId === c.id);
    const isUnlocked = c.price > 0 ? !!uc : c.requiredScore <= 0 || maxScore >= c.requiredScore || !!uc;
    return {
      ...c,
      isUnlocked,
      isEquipped: uc?.isEquipped ?? false,
    };
  });
}

function optimizedLogic() {
  const userCosmeticsMap = new Map(userCosmetics.map((u) => [u.cosmeticId, u]));
  return cosmetics.map((c) => {
    const uc = userCosmeticsMap.get(c.id);
    const isUnlocked = c.price > 0 ? !!uc : c.requiredScore <= 0 || maxScore >= c.requiredScore || !!uc;
    return {
      ...c,
      isUnlocked,
      isEquipped: uc?.isEquipped ?? false,
    };
  });
}

function runBenchmark() {
  const startOriginal = performance.now();
  const resultOriginal = originalLogic();
  const endOriginal = performance.now();

  const startOptimized = performance.now();
  const resultOptimized = optimizedLogic();
  const endOptimized = performance.now();

  console.log(`Original logic execution time: ${(endOriginal - startOriginal).toFixed(2)} ms`);
  console.log(`Optimized logic execution time: ${(endOptimized - startOptimized).toFixed(2)} ms`);

  // verify they return the same results
  const isSame = JSON.stringify(resultOriginal) === JSON.stringify(resultOptimized);
  console.log(`Results are identical: ${isSame}`);
}

runBenchmark();
