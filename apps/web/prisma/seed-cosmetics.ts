import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const cosmetics = [
    // Board Themes
    {
      name: 'Classic Light',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#ffffff","--board-cell-border":"#e5e2db","--board-active-border":"#d97706","--board-inactive-border":"#e5e2db"}',
      requiredScore: 0,
    },
    {
      name: 'Midnight Dark',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#1a1a1a","--board-cell-border":"#2a2a2a","--board-active-border":"#f59e0b","--board-inactive-border":"#2a2a2a"}',
      requiredScore: 10,
    },
    {
      name: 'Neon Cyber',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#0d0221","--board-cell-border":"#ff0055","--board-active-border":"#00ffff","--board-inactive-border":"#ff0055"}',
      requiredScore: 50,
    },
    {
      name: 'Forest Slate',
      type: 'board',
      cssValue: '{"--board-cell-bg":"#1f292e","--board-cell-border":"#4caf50","--board-active-border":"#81c784","--board-inactive-border":"#4caf50"}',
      requiredScore: 30,
    },
    
    // Piece Themes
    {
      name: 'Classic Amber',
      type: 'piece',
      cssValue: '{"--mark-x":"#1a1a1a","--mark-o":"#d97706"}',
      requiredScore: 0,
    },
    {
      name: 'Sapphire & Ruby',
      type: 'piece',
      cssValue: '{"--mark-x":"#ef4444","--mark-o":"#3b82f6"}',
      requiredScore: 10,
    },
    {
      name: 'Neon Pink & Cyan',
      type: 'piece',
      cssValue: '{"--mark-x":"#ff1493","--mark-o":"#00ffff"}',
      requiredScore: 25,
    },
    {
      name: 'Gold & Silver',
      type: 'piece',
      cssValue: '{"--mark-x":"#ffd700","--mark-o":"#c0c0c0"}',
      requiredScore: 50,
    }
  ];

  for (const c of cosmetics) {
    await (prisma as any).cosmetic.create({
      data: c,
    });
  }
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
