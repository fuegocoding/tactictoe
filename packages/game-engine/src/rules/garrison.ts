import type { GameRules, Player } from './interface.js';
import type { GameState, Move, MoveResult, TerminalResult, VariantConfig } from '../types.js';
import { isInCheck, getMoveDestinations } from './garrison-check.js';
import type { GarrisonPiece, PieceType } from './garrison-check.js';
import { checkFiveInARow } from './garrison-five.js';

export type { GarrisonPiece, PieceType };

export interface GarrisonState extends GameState {
  variantId: 'garrison';
  pieces: GarrisonPiece[];
  currentPlayer: Player;
  moveCount: number;
  terminal: TerminalResult | null;
}

export type GarrisonMove =
  | { type: 'place'; pieceId: string; to: number }
  | { type: 'move'; pieceId: string; from: number; to: number };

function castState(state: GameState): GarrisonState {
  if (state.variantId !== 'garrison') throw new Error(`Expected garrison, got ${state.variantId}`);
  return state as GarrisonState;
}

function sqRow(sq: number): number { return Math.floor(sq / 8); }
function sqCol(sq: number): number { return sq % 8; }

function areAdjacent(a: number, b: number): boolean {
  return Math.abs(sqRow(a) - sqRow(b)) <= 1 && Math.abs(sqCol(a) - sqCol(b)) <= 1;
}

/** Seeded LCG random number generator; returns values in [0, 1) */
function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function makePieces(xKingSq: number, oKingSq: number): GarrisonPiece[] {
  return [
    { id: 'X_K',  type: 'K', player: 'X', square: xKingSq, captured: false },
    { id: 'X_Q',  type: 'Q', player: 'X', square: -1,      captured: false },
    { id: 'X_R1', type: 'R', player: 'X', square: -1,      captured: false },
    { id: 'X_R2', type: 'R', player: 'X', square: -1,      captured: false },
    { id: 'X_B1', type: 'B', player: 'X', square: -1,      captured: false },
    { id: 'X_B2', type: 'B', player: 'X', square: -1,      captured: false },
    { id: 'X_N1', type: 'N', player: 'X', square: -1,      captured: false },
    { id: 'X_N2', type: 'N', player: 'X', square: -1,      captured: false },
    { id: 'O_K',  type: 'K', player: 'O', square: oKingSq, captured: false },
    { id: 'O_Q',  type: 'Q', player: 'O', square: -1,      captured: false },
    { id: 'O_R1', type: 'R', player: 'O', square: -1,      captured: false },
    { id: 'O_R2', type: 'R', player: 'O', square: -1,      captured: false },
    { id: 'O_B1', type: 'B', player: 'O', square: -1,      captured: false },
    { id: 'O_B2', type: 'B', player: 'O', square: -1,      captured: false },
    { id: 'O_N1', type: 'N', player: 'O', square: -1,      captured: false },
    { id: 'O_N2', type: 'N', player: 'O', square: -1,      captured: false },
  ];
}

/** Apply a move to a pieces array (no validation). Returns new pieces array. */
function applyToPieces(pieces: GarrisonPiece[], move: GarrisonMove): GarrisonPiece[] {
  if (move.type === 'place') {
    return pieces.map(p => p.id === move.pieceId ? { ...p, square: move.to } : p);
  }
  const movingPiece = pieces.find(p => p.id === move.pieceId)!;
  return pieces.map(p => {
    if (p.id === move.pieceId) return { ...p, square: move.to };
    if (p.square === move.to && p.player !== movingPiece.player && !p.captured) {
      return { ...p, captured: true, square: -1 };
    }
    return p;
  });
}

/** Compute all legal GarrisonMoves for `player`, filtering for check safety. */
function computeLegalMoves(player: Player, pieces: GarrisonPiece[]): GarrisonMove[] {
  const result: GarrisonMove[] = [];
  const occupied = new Set(pieces.filter(p => p.square >= 0 && !p.captured).map(p => p.square));

  for (const piece of pieces.filter(p => p.player === player && p.square === -1 && !p.captured)) {
    for (let sq = 0; sq < 64; sq++) {
      if (occupied.has(sq)) continue;
      const m: GarrisonMove = { type: 'place', pieceId: piece.id, to: sq };
      if (!isInCheck(player, applyToPieces(pieces, m))) result.push(m);
    }
  }

  for (const piece of pieces.filter(p => p.player === player && p.square >= 0 && !p.captured)) {
    for (const to of getMoveDestinations(piece, pieces)) {
      const m: GarrisonMove = { type: 'move', pieceId: piece.id, from: piece.square, to };
      if (!isInCheck(player, applyToPieces(pieces, m))) result.push(m);
    }
  }

  return result;
}

function computeTerminal(pieces: GarrisonPiece[], lastMover: Player, nextPlayer: Player): TerminalResult | null {
  if (checkFiveInARow(lastMover, pieces) !== null) return { winner: lastMover, reason: 'win' };
  const nextMoves = computeLegalMoves(nextPlayer, pieces);
  if (nextMoves.length === 0) {
    if (isInCheck(nextPlayer, pieces)) return { winner: lastMover, reason: 'win' };
    return { winner: null, reason: 'draw' };
  }
  return null;
}

export class Garrison implements GameRules {
  initialize(config: VariantConfig): GameState {
    const seed = typeof config['seed'] === 'number' ? config['seed'] : Date.now();
    const rand = lcg(seed);
    let xKingSq: number;
    do {
      xKingSq = Math.floor(rand() * 64);
    } while (areAdjacent(xKingSq, 63 - xKingSq));
    const oKingSq = 63 - xKingSq;
    return {
      variantId: 'garrison',
      currentPlayer: 'X',
      moveCount: 0,
      pieces: makePieces(xKingSq, oKingSq),
      terminal: null,
    } as GarrisonState;
  }

  applyMove(state: GameState, move: Move, playerId: Player): MoveResult {
    const s = castState(state);
    if (s.terminal !== null) return { ok: false, error: 'Game is over', state };
    if (playerId !== s.currentPlayer) return { ok: false, error: 'Not your turn', state };

    const data = move.data as GarrisonMove;
    const piece = s.pieces.find(p => p.id === data.pieceId);
    if (!piece) return { ok: false, error: 'Piece not found', state };
    if (piece.player !== playerId) return { ok: false, error: 'Not your piece', state };
    if (piece.captured) return { ok: false, error: 'Piece is captured', state };

    if (data.type === 'place') {
      if (piece.square !== -1) return { ok: false, error: 'Piece is already on board', state };
      if (data.to < 0 || data.to > 63) return { ok: false, error: 'Invalid square', state };
      if (s.pieces.some(p => p.square === data.to && !p.captured)) {
        return { ok: false, error: 'Square is occupied', state };
      }
      const newPieces = applyToPieces(s.pieces, data);
      if (isInCheck(playerId, newPieces)) return { ok: false, error: 'Move leaves king in check', state };
      const nextPlayer: Player = playerId === 'X' ? 'O' : 'X';
      return {
        ok: true,
        state: {
          ...s,
          pieces: newPieces,
          currentPlayer: nextPlayer,
          moveCount: s.moveCount + 1,
          terminal: computeTerminal(newPieces, playerId, nextPlayer),
        } as GarrisonState,
      };
    }

    if (data.type === 'move') {
      if (piece.square < 0) return { ok: false, error: 'Piece is not on board', state };
      if (piece.square !== data.from) return { ok: false, error: 'Piece not at from square', state };
      if (!getMoveDestinations(piece, s.pieces).includes(data.to)) {
        return { ok: false, error: 'Illegal move destination', state };
      }
      const newPieces = applyToPieces(s.pieces, data);
      if (isInCheck(playerId, newPieces)) return { ok: false, error: 'Move leaves king in check', state };
      const nextPlayer: Player = playerId === 'X' ? 'O' : 'X';
      return {
        ok: true,
        state: {
          ...s,
          pieces: newPieces,
          currentPlayer: nextPlayer,
          moveCount: s.moveCount + 1,
          terminal: computeTerminal(newPieces, playerId, nextPlayer),
        } as GarrisonState,
      };
    }

    return { ok: false, error: 'Invalid move type', state };
  }

  getLegalMoves(state: GameState): Move[] {
    const s = castState(state);
    if (s.terminal !== null) return [];
    return computeLegalMoves(s.currentPlayer, s.pieces).map(m => ({ data: m }));
  }

  checkTerminal(state: GameState): TerminalResult | null {
    return castState(state).terminal;
  }

  serialize(state: GameState): string { return JSON.stringify(state); }
  deserialize(s: string): GameState { return JSON.parse(s) as GarrisonState; }
}
