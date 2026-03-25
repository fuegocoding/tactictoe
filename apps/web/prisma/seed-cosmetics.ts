import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // WARNING: Destructive — clears ALL existing cosmetics and user equip history.
  // Safe for dev/fresh environments. Do NOT run against a populated production database.
  await (prisma as any).userCosmetic.deleteMany({});
  await (prisma as any).cosmetic.deleteMany({});

  const cosmetics = [
    // ── Board Themes ──────────────────────────────────────────
    { name: 'Classic', type: 'board', cssValue: '{}', requiredScore: 0 },
    { name: 'Midnight Dark', type: 'board', cssValue: '{"--board-cell-bg":"#1a1a1a","--board-cell-border":"#2a2a2a","--board-active-border":"#f59e0b","--board-inactive-border":"#2a2a2a"}', requiredScore: 200 },
    { name: 'Neon Cyber', type: 'board', cssValue: '{"--board-cell-bg":"#0d0221","--board-cell-border":"#ff0055","--board-active-border":"#00ffff","--board-inactive-border":"#ff0055"}', requiredScore: 600 },
    { name: 'Forest Slate', type: 'board', cssValue: '{"--board-cell-bg":"#1f292e","--board-cell-border":"#4caf50","--board-active-border":"#81c784","--board-inactive-border":"#4caf50"}', requiredScore: 400 },
    { name: 'Cherry Wood', type: 'board', cssValue: '{"--board-cell-bg":"#3b1a17","--board-cell-border":"#8b3a33","--board-active-border":"#e27c6e","--board-inactive-border":"#8b3a33"}', requiredScore: 800 },
    { name: 'Aurum', type: 'board', cssValue: '{"--board-cell-bg":"#111111","--board-cell-border":"#7c5a00","--board-active-border":"#ffd700","--board-inactive-border":"#7c5a00"}', requiredScore: 1200 },

    // ── Piece Skins ───────────────────────────────────────────
    { name: 'Classic', type: 'piece', cssValue: '{"--mark-x":"#1a1a1a","--mark-o":"#d97706"}', requiredScore: 0 },
    { name: 'Donuts', type: 'piece', cssValue: '{"--mark-x":"#c0392b","--mark-o":"#8e5c3a","symbolX":"🍩","symbolO":"🍫"}', requiredScore: 50 },
    { name: 'Space', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#3498db","symbolX":"Rocket","symbolO":"Globe"}', requiredScore: 100 },
    { name: 'Cosmic', type: 'piece', cssValue: '{"--mark-x":"#f1c40f","--mark-o":"#9b59b6","symbolX":"Star","symbolO":"Moon"}', requiredScore: 150 },
    { name: 'Fruit', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#e67e22","symbolX":"🍎","symbolO":"🍊"}', requiredScore: 200 },
    { name: 'Animals', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#e67e22","symbolX":"Cat","symbolO":"Dog"}', requiredScore: 300 },
    { name: 'Plants', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#27ae60","symbolX":"Flower2","symbolO":"TreePine"}', requiredScore: 400 },
    { name: 'Royalty', type: 'piece', cssValue: '{"--mark-x":"#f1c40f","--mark-o":"#95a5a6","symbolX":"Crown","symbolO":"Sword"}', requiredScore: 600 },
    { name: 'Fire & Ice', type: 'piece', cssValue: '{"--mark-x":"#e74c3c","--mark-o":"#3498db","symbolX":"Flame","symbolO":"Snowflake"}', requiredScore: 800 },
    { name: 'Dark Arts', type: 'piece', cssValue: '{"--mark-x":"#8e44ad","--mark-o":"#2c3e50","symbolX":"Skull","symbolO":"Ghost"}', requiredScore: 1200 },

    // ── Win Line Skins ────────────────────────────────────────
    { name: 'Classic Line', type: 'winline', cssValue: '{"--winline-color":"#3b82f6","--winline-width":"0.12","--winline-filter":"none"}', requiredScore: 0 },
    { name: 'Neon Glow', type: 'winline', cssValue: '{"--winline-color":"#00ffcc","--winline-width":"0.14","--winline-filter":"drop-shadow(0 0 0.08px #00ffcc) drop-shadow(0 0 0.2px #00ffcc)"}', requiredScore: 150 },
    { name: 'Fire Line', type: 'winline', cssValue: '{"--winline-color":"#ff4500","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.08px #ff6b35) drop-shadow(0 0 0.25px #ff4500)"}', requiredScore: 400 },
    { name: 'Gold Strike', type: 'winline', cssValue: '{"--winline-color":"#ffd700","--winline-width":"0.15","--winline-filter":"drop-shadow(0 0 0.1px #ffd700) drop-shadow(0 0 0.3px #b8860b)"}', requiredScore: 700 },
    { name: 'Void', type: 'winline', cssValue: '{"--winline-color":"#7c3aed","--winline-width":"0.16","--winline-filter":"drop-shadow(0 0 0.1px #a78bfa) drop-shadow(0 0 0.35px #4c1d95)"}', requiredScore: 1000 },
  ];

  for (const c of cosmetics) {
    await (prisma as any).cosmetic.create({ data: c });
  }

  console.log(`Seeded ${cosmetics.length} cosmetics`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
