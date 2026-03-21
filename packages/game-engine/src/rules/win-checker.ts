import type { Board, Player } from '../types.js';

const WIN_LINES = [
  [0, 1, 2], // top row
  [3, 4, 5], // middle row
  [6, 7, 8], // bottom row
  [0, 3, 6], // left column
  [1, 4, 7], // center column
  [2, 5, 8], // right column
  [0, 4, 8], // main diagonal
  [2, 4, 6], // anti-diagonal
] as const;

/**
 * Check if a player has won on a 9-cell board.
 * Returns the winning Player, or null if no winner yet.
 */
export function checkBoardWinner(board: Board): Player | null {
  for (const [a, b, c] of WIN_LINES) {
    const cell = board[a];
    if (cell !== null && cell !== undefined && cell === board[b] && cell === board[c]) {
      return cell as Player;
    }
  }
  return null;
}

/**
 * Check if all 9 cells are filled (used to detect draws).
 */
export function isBoardFull(board: Board): boolean {
  return board.every((cell) => cell !== null);
}
