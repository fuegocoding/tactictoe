'use client';

import Link from 'next/link';
import { Grip, Table2, Grid3x3, Target, Ban, Asterisk, Type, Hash, BookOpen, ArrowLeft, Eye, Box, Layers, Swords, Shuffle, Network } from 'lucide-react';
import styles from './page.module.css';

const LEARN_DATA = [
  {
    id: 'standard_3x3',
    label: 'Standard Tic-Tac-Toe',
    Icon: Grid3x3,
    description: 'The global classic you know and love.',
    rules: [
      'Played on a 3×3 grid.',
      'Players take turns placing their mark (X or O).',
      'The first player to get 3 of their marks in a row (up, down, across, or diagonally) wins.',
      'If all 9 squares are full and no player has 3 in a row, the game is a draw.'
    ]
  },
  {
    id: 'ultimate_ttt',
    label: 'Ultimate Tic-Tac-Toe',
    Icon: Table2,
    description: 'A fractal game nested within itself. Deep strategy.',
    rules: [
      'Played on a large 3×3 board, where each square contains a smaller 3×3 board.',
      'To win the game, you must win 3 smaller boards in a row to claim the large squares.',
      'CRITICAL RULE: The local cell you pick dictates which local board your opponent must play in next!',
      'For example, if you play in the top-right square of a local board, your opponent is forced to play their next move anywhere in the top-right local board.',
      'If a player is sent to a board that is already won or full, they may play anywhere on the grid.'
    ]
  },
  {
    id: 'gomoku',
    label: 'Gomoku',
    Icon: Grip,
    description: 'Also known as Five in a Row.',
    rules: [
      'Played on a massive 15×15 grid.',
      'Players take turns placing their mark (X or O) on any empty intersection.',
      'The winner is the first player to form an unbroken chain of exactly five stones horizontally, vertically, or diagonally.',
      'Overlines (6 or more in a row) do not count as a win in strict rules, but in this variant, building 5 is all it takes.'
    ]
  },
  {
    id: 'misere_ttt',
    label: 'Misère Tic-Tac-Toe',
    Icon: Target,
    description: 'Tic-Tac-Toe, but winning is losing.',
    rules: [
      'Played on a standard 3×3 grid.',
      'Instead of trying to get 3 in a row, you must force your opponent to do so!',
      'The first player to get 3 of their marks in a row LOSES the game.'
    ]
  },
  {
    id: 'notakto',
    label: 'Notakto',
    Icon: Ban,
    description: 'A neutral variant where both players play as X.',
    rules: [
      'Played on a standard 3×3 grid.',
      'On your turn, you place an X (no O exists).',
      'The first player to create a 3-in-a-row of Xs LOSES the game.',
      'It is a game of careful avoidance and setting up traps.'
    ]
  },
  {
    id: 'wild_ttt',
    label: 'Wild Tic-Tac-Toe',
    Icon: Asterisk,
    description: 'Absolute freedom. Choose your symbol every turn.',
    rules: [
      'Played on a standard 3×3 grid.',
      'On every turn, the current player can choose to place EITHER an X or an O.',
      'The first player to complete any 3-in-a-row (either X-X-X or O-O-O) immediately wins.',
      'You can win using your opponent’s previously laid symbols.'
    ]
  },
  {
    id: 'sos_ttt',
    label: 'SOS Tic-Tac-Toe',
    Icon: Type,
    description: 'A word-building twist played on an 8×8 grid.',
    rules: [
      'Instead of X and O, players choose to place either an S or an O on their turn.',
      'The goal is to create the sequence S-O-S horizontally, vertically, or diagonally.',
      'If you successfully form an S-O-S, you score 1 point AND you get to take another turn immediately.',
      'The game ends when the board is full. The player with the most S-O-S sequences wins.'
    ]
  },
  {
    id: 'numerical_ttt',
    label: 'Numerical Tic-Tac-Toe',
    Icon: Hash,
    description: 'A math-based evolution of the classic game.',
    rules: [
      'Player 1 uses Odd numbers: 1, 3, 5, 7, 9.',
      'Player 2 uses Even numbers: 2, 4, 6, 8.',
      'Numbers can only be used once per game.',
      'The first player to make a line (horizontal, vertical, diagonal) of 3 numbers that sum EXACTLY to 15 wins.',
      'For example, 2 + 9 + 4 = 15 is a winning line.'
    ]
  },
  {
    id: 'vanishing_ttt',
    label: 'Vanishing Tic-Tac-Toe',
    Icon: Eye,
    description: 'A memory-test twist where pieces disappear before your eyes.',
    rules: [
      'Played on a standard 3×3 grid with normal win rules.',
      'After a piece has been on the board for 6 moves, it vanishes from view — but is still there!',
      'Vanished pieces still block cell placement and still count toward win detection.',
      'You must remember where all the hidden pieces are to plan your strategy.',
      'First player to get 3-in-a-row (including hidden pieces) wins.'
    ]
  },
  {
    id: 'ttt_3d',
    label: '3D Tic-Tac-Toe',
    Icon: Layers,
    description: 'Classic Tic-Tac-Toe extended into three dimensions.',
    rules: [
      'Played on a 3×3×3 cube displayed as three separate 3×3 layers.',
      'Win by getting 3-in-a-row along any axis: within a single layer, through all three layers vertically, or diagonally through space.',
      'There are 49 possible winning lines in the 3D cube.',
      'Think beyond flat rows — diagonals through all three layers are the key to victory.',
      'Use layer coordinates (e.g. L1, L2, L3) to track your position.'
    ]
  },
  {
    id: 'ttt_4d',
    label: '4D Tic-Tac-Toe',
    Icon: Box,
    description: 'The ultimate mind-bender: Tic-Tac-Toe in four dimensions.',
    rules: [
      'Played on a 3×3×3×3 grid (81 cells), displayed as a 3×3 meta-grid of 3×3 mini-grids.',
      'Each outer panel corresponds to a position in two dimensions; each cell inside it spans the other two.',
      'Win by getting 3-in-a-row along any of the 4D directions — lines can span any combination of the four axes.',
      'There are hundreds of possible winning lines. Visualising 4D space is the ultimate challenge.',
      'Coordinate notation: [d1, d2, d3, d4] — each value 1, 2, or 3.'
    ]
  },
  {
    id: 'order_chaos',
    label: 'Order and Chaos',
    Icon: Shuffle,
    description: 'An asymmetric game of creation versus prevention, invented by Stephen Sniderman.',
    rules: [
      'Played on a 6×6 grid. Player roles are Order (X) and Chaos (O).',
      'On EACH turn, the active player may place EITHER an X or an O on any empty cell.',
      'Order wins if any 5-in-a-row of the same symbol (X or O) appears anywhere on the board.',
      'Chaos wins if the board fills up without any 5-in-a-row of a single symbol.',
      'Both players can place either symbol — choosing which symbol is a key part of strategy.',
      'Order plays first.'
    ]
  },
  {
    id: 'tactic_toe',
    label: 'Tactic Toe',
    Icon: Swords,
    description: '3D Tic-Tac-Toe with randomly placed obstacles that can be moved.',
    rules: [
      'Played on a 3×3×3 grid (same as 3D TTT) with 8 randomly placed obstacles at the start.',
      'Obstacles block placement — you cannot place your mark on an obstacle cell.',
      'On your turn, you may either: (1) place your mark on any empty, non-obstacle cell, OR (2) move any obstacle to any other empty cell.',
      'Moving obstacles is a tactical tool — reshape the battlefield to create or block winning lines!',
      'Win by getting 3-in-a-row in any 3D direction (obstacles do not form winning lines).',
      'Each match has a unique random obstacle layout, making every game different.'
    ]
  },
  {
    id: 'ultimate_3d',
    label: 'Ultimate 3D Tic-Tac-Toe',
    Icon: Network,
    description: 'Ultimate TTT expanded into three dimensions — a 729-cell strategic behemoth.',
    rules: [
      'Played on a 3×3×3 meta-grid (27 macro-cells), each containing its own 3×3×3 micro-board (27 cells) — 729 total cells.',
      'Win a macro-cell by getting 3-in-a-row in that macro-cell\'s micro-board using 3D win lines.',
      'Win the game by getting 3-in-a-row of won macro-cells in the meta-grid using 3D win lines.',
      'CONSTRAINT RULE: The micro-cell you play in determines which macro-cell your opponent must play in next.',
      'For example, playing micro-cell 13 forces your opponent into macro-cell 13 next turn.',
      'If the forced macro-cell is already won or drawn, your opponent may play in any available macro-cell.',
      'Use the Meta-Layer (L1/L2/L3) and Micro-Layer (m1/m2/m3) pickers to navigate the 3D structure.',
      'There are 49 win lines in each 3D board. Mastering 3D spatial reasoning is the key to victory.'
    ]
  }
];

export default function LearnPage() {
  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div className={styles.iconWrap}>
          <BookOpen size={32} className={styles.headerIcon} />
        </div>
        <h1 className={styles.title}>Game Rules Library</h1>
        <p className={styles.subtitle}>Master the variants. Learn the win conditions.</p>
      </div>

      <div className={styles.grid}>
        {LEARN_DATA.map(({ id, label, Icon, description, rules }) => (
          <div key={id} id={id} className={styles.card}>
            <div className={styles.cardHeader}>
              <div className={styles.cardIcon}>
                <Icon size={24} strokeWidth={2} />
              </div>
              <h2 className={styles.cardTitle}>{label}</h2>
            </div>
            
            <p className={styles.cardDesc}>{description}</p>
            
            <ul className={styles.rulesList}>
              {rules.map((rule, i) => (
                <li key={i}>{rule}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <Link href="/" className={styles.backLink}>
        <ArrowLeft size={16} /> Return to Lobby
      </Link>
    </div>
  );
}
