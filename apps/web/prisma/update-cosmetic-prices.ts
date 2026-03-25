/**
 * Non-destructive script: updates the price field on existing cosmetics by name.
 * Safe to run against a populated database — does NOT delete any data.
 *
 * Usage: npx ts-node --project tsconfig.json prisma/update-cosmetic-prices.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const PRICES: Record<string, number> = {
  // Board themes
  'Classic': 0,
  'Midnight Dark': 100,
  'Forest Slate': 200,
  'Neon Cyber': 350,
  'Cherry Wood': 500,
  'Aurum': 800,
  // Piece skins
  'Donuts': 50,
  'Space': 100,
  'Cosmic': 150,
  'Fruit': 200,
  'Animals': 300,
  'Plants': 400,
  'Royalty': 600,
  'Fire & Ice': 750,
  'Dark Arts': 1000,
  // Win line skins
  'Classic Line': 0,
  'Neon Glow': 100,
  'Fire Line': 300,
  'Gold Strike': 600,
  'Void': 900,
};

async function main() {
  let updated = 0;
  for (const [name, price] of Object.entries(PRICES)) {
    const result = await (prisma as any).cosmetic.updateMany({
      where: { name },
      data: { price, requiredScore: 0 },
    });
    if (result.count > 0) {
      console.log(`  ✓ ${name} → price: ${price}`);
      updated += result.count;
    } else {
      console.log(`  - ${name} not found (skipped)`);
    }
  }
  console.log(`\nDone. Updated ${updated} cosmetic(s).`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
