async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function mockUpsert() {
  await sleep(50); // Simulate network/DB latency
}

const achievements = [
  { conditionCode: 'first_game' },
  { conditionCode: 'first_win' },
  { conditionCode: 'win_10' },
  { conditionCode: 'win_50' },
  { conditionCode: 'ultimate_win' },
  { conditionCode: 'gomoku_win' },
  { conditionCode: 'draw_game' }
];

async function runSequential() {
  const start = performance.now();
  for (const a of achievements) {
    await mockUpsert();
  }
  const end = performance.now();
  return end - start;
}

async function runConcurrent() {
  const start = performance.now();
  await Promise.all(
    achievements.map((a) => mockUpsert())
  );
  const end = performance.now();
  return end - start;
}

async function main() {
  console.log('Running benchmark...');
  const seqTime = await runSequential();
  console.log(`Sequential approach took: ${seqTime.toFixed(2)}ms`);

  const concTime = await runConcurrent();
  console.log(`Concurrent approach took: ${concTime.toFixed(2)}ms`);

  const improvement = ((seqTime - concTime) / seqTime) * 100;
  console.log(`Improvement: ${improvement.toFixed(2)}%`);
}

main().catch(console.error);
