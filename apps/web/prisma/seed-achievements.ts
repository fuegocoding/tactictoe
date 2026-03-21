import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const achievements = [
    {
      name: 'Welcome to the Arena',
      description: 'Play your first game online.',
      conditionCode: 'first_game',
      iconUrl: '🎉',
    },
    {
      name: 'First Blood',
      description: 'Win your first game against a human opponent.',
      conditionCode: 'first_win',
      iconUrl: '🗡️',
    },
    {
      name: 'Veteran',
      description: 'Win 10 games.',
      conditionCode: 'win_10',
      iconUrl: '🎖️',
    },
    {
      name: 'Grandmaster',
      description: 'Win 50 games.',
      conditionCode: 'win_50',
      iconUrl: '👑',
    },
    {
      name: 'Ultimate Strategist',
      description: 'Win an Ultimate Tic-Tac-Toe match.',
      conditionCode: 'ultimate_win',
      iconUrl: '🧠',
    },
    {
      name: 'Five in a Row',
      description: 'Win a Gomoku match.',
      conditionCode: 'gomoku_win',
      iconUrl: '🐉',
    },
    {
      name: 'Unbreakable',
      description: 'Play a game to a draw.',
      conditionCode: 'draw_game',
      iconUrl: '🛡️',
    }
  ];

  for (const a of achievements) {
    await (prisma as any).achievement.upsert({
      where: { conditionCode: a.conditionCode },
      update: a,
      create: a,
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
