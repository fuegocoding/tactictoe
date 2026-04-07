'use client';

import { useState, useReducer, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT, Gomoku, SOSTTT, NumericalTTT,
  VanishingTTT, VANISHING_FADE_AFTER,
  TTT3D, TTT4D, OrderChaos, TacticToe, Ultimate3D, Garrison, checkFiveInARow,
  getWinCells, getGomokuWinCells,
  getWinCells3D, getWinCells4D, getWinCells6x6,
} from '@tactictoe/game-engine';
import type { Board, GameState, TerminalResult } from '@tactictoe/game-engine';
import type { GameRules } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import type { GomokuState } from '@tactictoe/game-engine';
import type { SOSTTTState } from '@tactictoe/game-engine';
import type { NumericalTTTState } from '@tactictoe/game-engine';
import type { VanishingTTTState } from '@tactictoe/game-engine';
import type { TTT3DState } from '@tactictoe/game-engine';
import type { TTT4DState } from '@tactictoe/game-engine';
import type { OrderChaosState } from '@tactictoe/game-engine';
import type { TacticToeState } from '@tactictoe/game-engine';
import type { Ultimate3DState } from '@tactictoe/game-engine';
import type { GarrisonState, GarrisonMove } from '@tactictoe/game-engine';

type LocalGameState = GameState & { terminal?: TerminalResult | null };
import { useSound } from '@/hooks/useSound';
import { VictoryConfetti } from '@/components/VictoryConfetti';
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { GridBoard } from '@/components/board/GridBoard';
import { ThreeDBoard } from '@/components/board/ThreeDBoard';
import { FourDBoard } from '@/components/board/FourDBoard';
import { TacticToeBoard } from '@/components/board/TacticToeBoard';
import { Ultimate3DBoard } from '@/components/board/Ultimate3DBoard';
import { GarrisonBoard } from '@/components/board/GarrisonBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { Grip, Table2, Grid3x3, Target, Ban, Asterisk, Type, Hash, HelpCircle, Eye, Box, Layers, Swords, Shuffle, Network, Shield } from 'lucide-react';
import styles from './page.module.css';

type Variant =
  | 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'wild_ttt' | 'notakto'
  | 'gomoku' | 'sos_ttt' | 'numerical_ttt'
  | 'vanishing_ttt' | 'ttt_3d' | 'ttt_4d' | 'order_chaos' | 'tactic_toe' | 'ultimate_3d'
  | 'garrison';

const VARIANT_INFO: Record<Variant, { label: string; description: string; Icon: any }> = {
  standard_3x3:  { label: 'Standard',    description: 'Classic. Quick casual games.',                          Icon: Grid3x3 },
  ultimate_ttt:  { label: 'Ultimate',    description: '9 boards in one. The flagship.',                        Icon: Table2 },
  misere_ttt:    { label: 'Misère',      description: 'Force your opponent to get 3-in-a-row to win.',         Icon: Target },
  wild_ttt:      { label: 'Wild',        description: 'Choose to place X or O on every turn.',                 Icon: Asterisk },
  notakto:       { label: 'Notakto',     description: 'Both players place X. Avoid making 3-in-a-row!',        Icon: Ban },
  gomoku:        { label: 'Gomoku',      description: '15×15 board. First to 5-in-a-row wins.',                Icon: Grip },
  sos_ttt:       { label: 'SOS',         description: 'Spell S-O-S for points + extra turns.',                 Icon: Type },
  numerical_ttt: { label: 'Numerical',   description: 'Sum exactly 15 with three numbers.',                    Icon: Hash },
  vanishing_ttt: { label: 'Vanishing',   description: 'Pieces disappear after 6 moves. Can you remember?',    Icon: Eye },
  ttt_3d:        { label: '3D TTT',      description: '3×3×3 cube. Win in any dimension.',                     Icon: Layers },
  ttt_4d:        { label: '4D TTT',      description: '3×3×3×3 hypercube. 4-dimensional strategy.',           Icon: Box },
  order_chaos:   { label: 'Order&Chaos', description: 'Order creates 5-in-a-row; Chaos prevents it.',          Icon: Shuffle },
  tactic_toe:    { label: 'Tactic Toe',  description: '3D board with 8 obstacles. Place or move obstacles.',   Icon: Swords },
  ultimate_3d:   { label: 'Ultimate 3D', description: '27 macro-cells × 27 micro-cells. 3D Ultimate TTT.',      Icon: Network },
  garrison:      { label: 'Garrison',    description: 'Place chess pieces on an 8×8 board. Get 5-in-a-row.',    Icon: Shield },
};

const engines: Record<Variant, GameRules> = {
  standard_3x3:  new StandardTTT(),
  ultimate_ttt:  new UltimateTTT(),
  misere_ttt:    new MisereTTT(),
  wild_ttt:      new WildTTT(),
  notakto:       new NotaktoTTT(),
  gomoku:        new Gomoku(),
  sos_ttt:       new SOSTTT(),
  numerical_ttt: new NumericalTTT(),
  vanishing_ttt: new VanishingTTT(),
  ttt_3d:        new TTT3D(),
  ttt_4d:        new TTT4D(),
  order_chaos:   new OrderChaos(),
  tactic_toe:    new TacticToe(),
  ultimate_3d:   new Ultimate3D(),
  garrison:      new Garrison(),
};

interface LocalState {
  phase: 'setup' | 'playing' | 'over';
  variant: Variant;
  player1Name: string;
  player2Name: string;
  gameState: LocalGameState | null;
  scores: { x: number; o: number; draws: number };
  moveHistory: string[];
  placingAs: string | number;
  tacticMoveMode: 'place' | 'move_obstacle';
  tacticSelectedObstacle: number | null;
  garrisonSelectedPiece: string | null;
  garrisonLegalDests: number[];
}

type LocalAction =
  | { type: 'START_GAME' }
  | { type: 'MOVE'; gameState: LocalGameState; coordinate: string }
  | { type: 'GAME_OVER'; gameState: LocalGameState; coordinate: string }
  | { type: 'REMATCH' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_VARIANT'; variant: Variant }
  | { type: 'SET_NAME'; player: 1 | 2; name: string }
  | { type: 'SET_PLACING_AS'; symbol: string | number }
  | { type: 'SET_TACTIC_MODE'; mode: 'place' | 'move_obstacle' }
  | { type: 'SET_TACTIC_OBSTACLE'; cell: number | null }
  | { type: 'SET_GARRISON_PIECE'; pieceId: string | null; dests: number[] };

function getInitialPlacingAs(variant: Variant): string | number {
  if (variant === 'sos_ttt') return 'S';
  if (variant === 'numerical_ttt') return 1;
  return 'X';
}

function reducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case 'SET_VARIANT': return { ...state, variant: action.variant };
    case 'SET_NAME':
      return action.player === 1
        ? { ...state, player1Name: action.name }
        : { ...state, player2Name: action.name };
    case 'START_GAME': {
      const engine = engines[state.variant as Variant];
      const seed = Date.now();
      return {
        ...state,
        phase: 'playing',
        gameState: engine.initialize({ variantId: state.variant, seed }),
        moveHistory: [],
        placingAs: getInitialPlacingAs(state.variant),
        tacticMoveMode: 'place',
        tacticSelectedObstacle: null,
        garrisonSelectedPiece: null,
        garrisonLegalDests: [],
      };
    }
    case 'MOVE':
    case 'GAME_OVER': {
      const terminal = action.gameState.terminal;
      const moveHistory = [...state.moveHistory, action.coordinate];
      if (action.type === 'GAME_OVER' && terminal) {
        const scores = { ...state.scores };
        if (terminal.winner === 'X') scores.x++;
        else if (terminal.winner === 'O') scores.o++;
        else scores.draws++;
        return {
          ...state,
          phase: 'over',
          gameState: action.gameState,
          moveHistory,
          scores,
          tacticMoveMode: 'place',
          tacticSelectedObstacle: null,
        };
      }
      return { ...state, gameState: action.gameState, moveHistory, tacticMoveMode: 'place', tacticSelectedObstacle: null, garrisonSelectedPiece: null, garrisonLegalDests: [] };
    }
    case 'REMATCH': {
      const engine = engines[state.variant as Variant];
      const seed = Date.now();
      return {
        ...state,
        phase: 'playing',
        gameState: engine.initialize({ variantId: state.variant, seed }),
        moveHistory: [],
        placingAs: getInitialPlacingAs(state.variant),
        tacticMoveMode: 'place',
        tacticSelectedObstacle: null,
        garrisonSelectedPiece: null,
        garrisonLegalDests: [],
      };
    }
    case 'NEW_GAME':
      return { ...state, phase: 'setup', gameState: null, moveHistory: [] };
    case 'SET_PLACING_AS':
      return { ...state, placingAs: action.symbol };
    case 'SET_TACTIC_MODE':
      return { ...state, tacticMoveMode: action.mode, tacticSelectedObstacle: null };
    case 'SET_TACTIC_OBSTACLE':
      return { ...state, tacticSelectedObstacle: action.cell };
    case 'SET_GARRISON_PIECE':
      return { ...state, garrisonSelectedPiece: action.pieceId, garrisonLegalDests: action.dests };
    default:
      return state;
  }
}

const initialState: LocalState = {
  phase: 'setup',
  variant: 'ultimate_ttt',
  player1Name: 'Player 1',
  player2Name: 'Player 2',
  gameState: null,
  scores: { x: 0, o: 0, draws: 0 },
  moveHistory: [],
  placingAs: 'X',
  tacticMoveMode: 'place',
  tacticSelectedObstacle: null,
  garrisonSelectedPiece: null,
  garrisonLegalDests: [],
};

function formatMoveRows(moves: string[]) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({ num: Math.floor(i / 2) + 1, x: moves[i], o: moves[i + 1] || '' });
  }
  return rows;
}

/** Build a "visible board" for Vanishing TTT: hide cells that have faded */
function getVanishingVisibleBoard(s: VanishingTTTState): (string | number | null)[] {
  return (s.board as (string | number | null)[]).map((cell: string | number | null, i: number) => {
    if (cell === null) return null;
    const age = s.moveCount - (s.moveDates[i] ?? 0);
    return age > VANISHING_FADE_AFTER ? null : cell;
  });
}

export default function LocalPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [showConfetti, setShowConfetti] = useState(false);
  const sound = useSound();
  const movesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state.phase === 'over') {
      setShowConfetti(true);
    } else {
      setShowConfetti(false);
    }
  }, [state.phase]);

  useEffect(() => {
    if (movesRef.current) movesRef.current.scrollTop = movesRef.current.scrollHeight;
  }, [state.moveHistory]);

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (!state.gameState) return;
    const gameState = state.gameState;
    if (state.variant === 'tactic_toe' || state.variant === 'garrison') return; // handled separately
    const engine = engines[state.variant as Variant];

    let coordinate = '';
    let move: { data: unknown };

    if (state.variant === 'ultimate_ttt') {
      const overallCol = (boardIndex % 3) * 3 + (cellIndex % 3);
      const overallRow = Math.floor(boardIndex / 3) * 3 + Math.floor(cellIndex / 3);
      coordinate = `${String.fromCharCode(97 + overallCol)}${overallRow + 1}`;
      move = { data: { boardIndex, cellIndex } };
    } else if (state.variant === 'gomoku') {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 15))}${Math.floor(cellIndex / 15) + 1}`;
      move = { data: { cellIndex } };
    } else if (state.variant === 'sos_ttt') {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 8))}${Math.floor(cellIndex / 8) + 1} (${state.placingAs})`;
      move = { data: { cellIndex, symbol: state.placingAs } };
    } else if (state.variant === 'wild_ttt') {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1} (${state.placingAs})`;
      move = { data: { cellIndex, symbol: state.placingAs } };
    } else if (state.variant === 'numerical_ttt') {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1} (${state.placingAs})`;
      move = { data: { cellIndex, numberPlaced: typeof state.placingAs === 'number' ? state.placingAs : Number(state.placingAs) } };
    } else if (state.variant === 'order_chaos') {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 6))}${Math.floor(cellIndex / 6) + 1} (${state.placingAs})`;
      move = { data: { cellIndex, symbol: state.placingAs } };
    } else if (state.variant === 'ttt_3d') {
      // boardIndex = layer, cellIndex = row*3+col within layer
      const globalIndex = boardIndex * 9 + cellIndex;
      const layer = boardIndex + 1;
      coordinate = `L${layer}${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
      move = { data: { cellIndex: globalIndex } };
    } else if (state.variant === 'ttt_4d') {
      // boardIndex = metaRow*3+metaCol, cellIndex = row*3+col within board
      const globalIndex = boardIndex * 9 + cellIndex;
      coordinate = `[${Math.floor(boardIndex / 3) + 1},${(boardIndex % 3) + 1},${Math.floor(cellIndex / 3) + 1},${(cellIndex % 3) + 1}]`;
      move = { data: { cellIndex: globalIndex } };
    } else {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
      move = { data: { cellIndex } };
    }

    const result = engine.applyMove(state.gameState, move, state.gameState.currentPlayer);
    if (!result.ok) { sound.play('error'); return; }
    sound.play('move');

    if (state.variant === 'numerical_ttt') {
      const nextState = result.state as NumericalTTTState;
      const nextAvailable = nextState.currentPlayer === 'X' ? nextState.availableOdds : nextState.availableEvens;
      if (nextAvailable.length > 0) dispatch({ type: 'SET_PLACING_AS', symbol: nextAvailable[0]! });
    }

    const terminal = engine.checkTerminal(result.state);
    if (terminal) {
      if (terminal.winner === gameState.currentPlayer) { sound.play('win'); } else { sound.play('lose'); }
      dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate });
    } else {
      dispatch({ type: 'MOVE', gameState: result.state, coordinate });
    }
  };

  const handleUltimate3DMove = (macroCell: number, microCell: number) => {
    if (!state.gameState || state.phase !== 'playing') return;
    const engine = engines['ultimate_3d'];
    const move = { data: { macroCell, microCell } };
    const result = engine.applyMove(state.gameState, move, state.gameState.currentPlayer);
    if (!result.ok) { sound.play('error'); return; }
    sound.play('move');
    const metaLayer = Math.floor(macroCell / 9) + 1;
    const microLayer = Math.floor(microCell / 9) + 1;
    const coord = `M${macroCell}[m${microLayer}(${Math.floor((microCell % 9) / 3) + 1},${(microCell % 3) + 1})]`;
    const terminal = engine.checkTerminal(result.state);
    if (terminal) {
      dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate: coord });
    } else {
      dispatch({ type: 'MOVE', gameState: result.state, coordinate: coord });
    }
  };

  const handleTacticCell = (globalIndex: number) => {
    if (!state.gameState || state.phase !== 'playing') return;
    const engine = engines['tactic_toe'];
    const s = state.gameState as TacticToeState;

    if (state.tacticMoveMode === 'place') {
      const move = { data: { type: 'place', cellIndex: globalIndex } };
      const result = engine.applyMove(s, move, s.currentPlayer);
      if (!result.ok) { sound.play('error'); return; }
    sound.play('move');
      const coord = `L${Math.floor(globalIndex / 9) + 1}(${Math.floor((globalIndex % 9) / 3) + 1},${(globalIndex % 3) + 1})`;
      const terminal = engine.checkTerminal(result.state);
      if (terminal) {
        dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate: coord });
      } else {
        dispatch({ type: 'MOVE', gameState: result.state, coordinate: coord });
      }
    } else {
      // move_obstacle mode
      const cell = s.board[globalIndex];
      if (state.tacticSelectedObstacle === null) {
        if (cell === 'B') dispatch({ type: 'SET_TACTIC_OBSTACLE', cell: globalIndex });
      } else {
        if (cell === null) {
          const move = { data: { type: 'move_obstacle', fromCell: state.tacticSelectedObstacle, toCell: globalIndex } };
          const result = engine.applyMove(s, move, s.currentPlayer);
          if (!result.ok) { dispatch({ type: 'SET_TACTIC_OBSTACLE', cell: null }); return; }
          const coord = `▪${state.tacticSelectedObstacle}→${globalIndex}`;
          dispatch({ type: 'SET_TACTIC_OBSTACLE', cell: null });
          const terminal = engine.checkTerminal(result.state);
          if (terminal) {
            dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate: coord });
          } else {
            dispatch({ type: 'MOVE', gameState: result.state, coordinate: coord });
          }
        } else if (cell === 'B') {
          // Re-select different obstacle
          dispatch({ type: 'SET_TACTIC_OBSTACLE', cell: globalIndex });
        } else {
          dispatch({ type: 'SET_TACTIC_OBSTACLE', cell: null });
        }
      }
    }
  };

  const handleGarrisonHandPiece = (pieceId: string) => {
    if (!state.gameState || state.phase !== 'playing') return;
    const s = state.gameState as GarrisonState;
    if (state.garrisonSelectedPiece === pieceId) {
      dispatch({ type: 'SET_GARRISON_PIECE', pieceId: null, dests: [] });
      return;
    }
    const occupied = new Set(s.pieces.filter(p => p.square >= 0 && !p.captured).map(p => p.square));
    const dests: number[] = [];
    for (let i = 0; i < 64; i++) { if (!occupied.has(i)) dests.push(i); }
    dispatch({ type: 'SET_GARRISON_PIECE', pieceId, dests });
  };

  const handleGarrisonSquareClick = (square: number, pieceId: string | null) => {
    if (!state.gameState || state.phase !== 'playing') return;
    const s = state.gameState as GarrisonState;
    const engine = engines['garrison'];

    if (state.garrisonSelectedPiece === null) {
      if (pieceId) {
        const piece = s.pieces.find(p => p.id === pieceId);
        if (piece && piece.player === s.currentPlayer && piece.square >= 0) {
          const dests = engine.getLegalMoves(s)
            .map(m => m.data as GarrisonMove)
            .filter(m => m.pieceId === pieceId)
            .map(m => m.to);
          dispatch({ type: 'SET_GARRISON_PIECE', pieceId, dests });
        }
      }
      return;
    }

    if (!state.garrisonLegalDests.includes(square)) {
      if (pieceId) {
        const piece = s.pieces.find(p => p.id === pieceId);
        if (piece && piece.player === s.currentPlayer && piece.square >= 0) {
          const dests = engine.getLegalMoves(s)
            .map(m => m.data as GarrisonMove)
            .filter(m => m.pieceId === pieceId)
            .map(m => m.to);
          dispatch({ type: 'SET_GARRISON_PIECE', pieceId, dests });
          return;
        }
      }
      dispatch({ type: 'SET_GARRISON_PIECE', pieceId: null, dests: [] });
      return;
    }

    const selectedPiece = s.pieces.find(p => p.id === state.garrisonSelectedPiece)!;
    const moveData: GarrisonMove = selectedPiece.square === -1
      ? { type: 'place', pieceId: state.garrisonSelectedPiece!, to: square }
      : { type: 'move', pieceId: state.garrisonSelectedPiece!, from: selectedPiece.square, to: square };

    const result = engine.applyMove(s, { data: moveData }, s.currentPlayer);
    if (!result.ok) { dispatch({ type: 'SET_GARRISON_PIECE', pieceId: null, dests: [] }); return; }

    const coord = selectedPiece.square === -1
      ? `${String.fromCharCode(97 + (square % 8))}${Math.floor(square / 8) + 1}(+${state.garrisonSelectedPiece!.split('_')[1]})`
      : `${String.fromCharCode(97 + (selectedPiece.square % 8))}${Math.floor(selectedPiece.square / 8) + 1}-${String.fromCharCode(97 + (square % 8))}${Math.floor(square / 8) + 1}`;

    dispatch({ type: 'SET_GARRISON_PIECE', pieceId: null, dests: [] });
    const terminal = engine.checkTerminal(result.state);
    if (terminal) {
      dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate: coord });
    } else {
      dispatch({ type: 'MOVE', gameState: result.state, coordinate: coord });
    }
  };

  const { phase, variant, player1Name, player2Name, gameState, scores, moveHistory, placingAs } = state;
  const currentName = gameState?.currentPlayer === 'X' ? player1Name : player2Name;
  const moveRows = formatMoveRows(moveHistory);

  const isSymbolPickerVariant = variant === 'wild_ttt' || variant === 'sos_ttt' || variant === 'order_chaos';

  return (
    <> 
      <VictoryConfetti active={showConfetti} />
      <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Local Game</h1>
        <p className={styles.subtitle}>Same screen. Take turns.</p>
      </div>

      {phase === 'setup' && (
        <div className={styles.setupWrap}>
          <Card style={{ width: '100%', maxWidth: 520 }}>
            <div className={styles.setup}>
              <div className={styles.variantRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className={styles.variantLabel}>Game mode</p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div className={styles.variantInfo} title={VARIANT_INFO[variant]?.description}>
                      <HelpCircle size={14} style={{ marginRight: 4 }} />
                      {VARIANT_INFO[variant]?.description}
                    </div>
                    <a href={`/learn#${variant}`} className={styles.learnMoreLink}>Learn more →</a>
                  </div>
                </div>
                <div className={styles.variantButtons} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {(Object.keys(VARIANT_INFO) as Variant[]).map((v) => {
                    const { label, Icon } = VARIANT_INFO[v]!;
                    return (
                      <button
                        key={v}
                        className={`${styles.variantBtn} ${variant === v ? styles.selected : ''}`}
                        onClick={() => dispatch({ type: 'SET_VARIANT', variant: v })}
                      >
                        <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={styles.playerRow}>
                <Input
                  label={variant === 'order_chaos' ? 'Order (X)' : 'Player X'}
                  value={player1Name}
                  onChange={e => dispatch({ type: 'SET_NAME', player: 1, name: e.target.value })}
                  placeholder="Player 1"
                />
                <Input
                  label={variant === 'order_chaos' ? 'Chaos (O)' : 'Player O'}
                  value={player2Name}
                  onChange={e => dispatch({ type: 'SET_NAME', player: 2, name: e.target.value })}
                  placeholder="Player 2"
                />
              </div>

              <Button onClick={() => dispatch({ type: 'START_GAME' })} full>Start Game</Button>
            </div>
          </Card>
        </div>
      )}

      {(phase === 'playing' || phase === 'over') && gameState && (
        <div className={styles.gameLayout}>

          <div className={styles.sidePanel}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>Move History</div>
              <div className={styles.movesList} ref={movesRef}>
                {moveRows.length === 0 ? (
                  <div className={styles.emptyMoves}>No moves yet</div>
                ) : (
                  moveRows.map((row) => (
                    <div className={styles.moveRow} key={row.num}>
                      <span className={styles.moveNum}>{row.num}.</span>
                      <span className={styles.moveX}>{row.x}</span>
                      <span className={styles.moveO}>{row.o}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className={styles.mainBoard}>
            {phase === 'playing' && (
              <p className={styles.turnBanner}>
                {variant === 'notakto'
                  ? `${currentName}'s turn`
                  : variant === 'order_chaos'
                  ? `${currentName}'s turn (${gameState.currentPlayer === 'X' ? 'Order' : 'Chaos'})`
                  : `${currentName}'s turn (${gameState.currentPlayer})`}
              </p>
            )}

            {/* Symbol / number pickers */}
            {phase === 'playing' && isSymbolPickerVariant && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>
                  {variant === 'order_chaos' ? 'Place symbol:' : 'Place as:'}
                </span>
                {(variant === 'sos_ttt' ? ['S', 'O'] : ['X', 'O']).map(sym => (
                  <button
                    key={sym}
                    className={`${styles.wildBtn} ${sym === 'X' || sym === 'S' ? styles.x : styles.o} ${placingAs === sym ? styles.active : ''}`}
                    onClick={() => dispatch({ type: 'SET_PLACING_AS', symbol: sym })}
                  >
                    {sym}
                  </button>
                ))}
              </div>
            )}

            {phase === 'playing' && variant === 'numerical_ttt' && gameState && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>
                  {gameState.currentPlayer === 'X' ? 'Available Odds:' : 'Available Evens:'}
                </span>
                {((gameState as NumericalTTTState)[gameState.currentPlayer === 'X' ? 'availableOdds' : 'availableEvens']).map(num => (
                  <button
                    key={num}
                    className={`${styles.wildBtn} ${styles.x} ${placingAs === num ? styles.active : ''}`}
                    onClick={() => dispatch({ type: 'SET_PLACING_AS', symbol: num })}
                  >
                    {num}
                  </button>
                ))}
              </div>
            )}

            {/* Tactic Toe move mode toggle */}
            {phase === 'playing' && variant === 'tactic_toe' && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>Action:</span>
                <button
                  className={`${styles.wildBtn} ${styles.x} ${state.tacticMoveMode === 'place' ? styles.active : ''}`}
                  onClick={() => dispatch({ type: 'SET_TACTIC_MODE', mode: 'place' })}
                >
                  Place
                </button>
                <button
                  className={`${styles.wildBtn} ${styles.o} ${state.tacticMoveMode === 'move_obstacle' ? styles.active : ''}`}
                  onClick={() => dispatch({ type: 'SET_TACTIC_MODE', mode: 'move_obstacle' })}
                >
                  Move Obstacle
                </button>
              </div>
            )}

            {/* Vanishing hint */}
            {phase === 'playing' && variant === 'vanishing_ttt' && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Pieces fade from view after {VANISHING_FADE_AFTER} moves — but stay on the board!
              </div>
            )}

            {phase === 'over' && gameState.terminal && (
              <div className={styles.turnBanner}>
                <p className={`${styles.gameOverTitle} ${!gameState.terminal.winner ? styles.draw : ''}`}>
                  {gameState.terminal.winner
                    ? variant === 'order_chaos'
                      ? `${gameState.terminal.winner === 'X' ? player1Name + ' (Order)' : player2Name + ' (Chaos)'} wins!`
                      : `${gameState.terminal.winner === 'X' ? player1Name : player2Name} wins!`
                    : "It's a draw!"}
                </p>
              </div>
            )}

            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 'var(--space-2)' }}>
              {variant === 'ultimate_ttt' ? (
                <UltimateBoard
                  boards={(gameState as UltimateTTTState).boards}
                  boardResults={(gameState as UltimateTTTState).boardResults}
                  nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
                  currentPlayer={gameState.currentPlayer}
                  disabled={phase === 'over'}
                  onMove={handleMove}
                  winCells={(() => {
                    const s = gameState as UltimateTTTState;
                    if (s.terminal?.reason !== 'win') return [];
                    const metaBoard = s.boardResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null);
                    return getWinCells(metaBoard) ?? [];
                  })()}
                />
              ) : variant === 'gomoku' ? (
                <GridBoard
                  board={(gameState as GomokuState).board}
                  cols={15} rows={15}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={(() => {
                    const s = gameState as GomokuState;
                    return s.terminal?.reason === 'win' ? (getGomokuWinCells(s.board) ?? []) : [];
                  })()}
                />
              ) : variant === 'sos_ttt' ? (
                <GridBoard
                  board={(gameState as SOSTTTState).board}
                  cols={8} rows={8}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={[]}
                />
              ) : variant === 'order_chaos' ? (
                <GridBoard
                  board={(gameState as OrderChaosState).board}
                  cols={6} rows={6}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={(() => {
                    const s = gameState as OrderChaosState;
                    return s.terminal?.reason === 'win' ? (getWinCells6x6(s.board) ?? []) : [];
                  })()}
                />
              ) : variant === 'vanishing_ttt' ? (
                <StandardBoard
                  board={getVanishingVisibleBoard(gameState as VanishingTTTState) as any}
                  currentPlayer={gameState.currentPlayer}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={(() => {
                    const s = gameState as any;
                    return s.terminal?.reason === 'win' && s.board ? (getWinCells(s.board) ?? []) : [];
                  })()}
                />
              ) : variant === 'ttt_3d' ? (
                <ThreeDBoard
                  board={(gameState as TTT3DState).board}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={handleMove}
                  winCells={(() => {
                    const s = gameState as TTT3DState;
                    return s.terminal?.reason === 'win' ? (getWinCells3D(s.board) ?? []) : [];
                  })()}
                />
              ) : variant === 'ttt_4d' ? (
                <FourDBoard
                  board={(gameState as TTT4DState).board}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={handleMove}
                  winCells={(() => {
                    const s = gameState as TTT4DState;
                    return s.terminal?.reason === 'win' ? (getWinCells4D(s.board) ?? []) : [];
                  })()}
                />
              ) : variant === 'tactic_toe' ? (
                <TacticToeBoard
                  board={(gameState as TacticToeState).board}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  moveMode={state.tacticMoveMode}
                  selectedObstacle={state.tacticSelectedObstacle}
                  onCellClick={handleTacticCell}
                  winCells={(() => {
                    const s = gameState as TacticToeState;
                    return s.terminal?.reason === 'win' ? (getWinCells3D(s.board) ?? []) : [];
                  })()}
                />
              ) : variant === 'ultimate_3d' ? (
                <Ultimate3DBoard
                  microBoards={(gameState as Ultimate3DState).microBoards}
                  macroResults={(gameState as Ultimate3DState).macroResults}
                  nextMacroConstraint={(gameState as Ultimate3DState).nextMacroConstraint}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={handleUltimate3DMove}
                  winCells={(() => {
                    const s = gameState as Ultimate3DState;
                    if (s.terminal?.reason !== 'win') return [];
                    const macroBoard = s.macroResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null) as Board;
                    return getWinCells3D(macroBoard) ?? [];
                  })()}
                />
              ) : variant === 'garrison' ? (
                <GarrisonBoard
                  state={gameState as GarrisonState}
                  disabled={phase === 'over'}
                  selectedPieceId={state.garrisonSelectedPiece}
                  legalDestinations={state.garrisonLegalDests}
                  onHandPieceClick={handleGarrisonHandPiece}
                  onBoardSquareClick={handleGarrisonSquareClick}
                  winSquares={
                    gameState.terminal?.winner
                      ? (checkFiveInARow(gameState.terminal.winner, (gameState as GarrisonState).pieces) ?? [])
                      : []
                  }
                />
              ) : (
                <StandardBoard
                  board={(gameState as StandardTTTState).board}
                  currentPlayer={gameState.currentPlayer}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={(() => {
                    const s = gameState as any;
                    return s.terminal?.reason === 'win' && s.board ? (getWinCells(s.board) ?? []) : [];
                  })()}
                />
              )}
            </div>
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>Players</div>
              <div className={styles.panelContent}>
                <div className={styles.scoreboard}>
                  <div className={`${styles.scoreCard} ${gameState.currentPlayer === 'X' && phase === 'playing' ? styles.active : ''}`}>
                    <span className={styles.scoreName}>
                      {player1Name}
                      {variant === 'order_chaos' ? ' (Order)' : variant !== 'notakto' ? ' (X)' : ''}
                    </span>
                    <span className={styles.scoreValue} style={{ color: 'var(--mark-x)' }}>
                      {variant === 'sos_ttt' && gameState.variantId === 'sos_ttt'
                        ? (gameState as SOSTTTState).scores.X
                        : scores.x}
                    </span>
                  </div>
                  <div className={`${styles.scoreCard} ${gameState.currentPlayer === 'O' && phase === 'playing' ? styles.active : ''}`}>
                    <span className={styles.scoreName}>
                      {player2Name}
                      {variant === 'order_chaos' ? ' (Chaos)' : variant !== 'notakto' ? ' (O)' : ''}
                    </span>
                    <span className={styles.scoreValue} style={{ color: 'var(--mark-o)' }}>
                      {variant === 'sos_ttt' && gameState.variantId === 'sos_ttt'
                        ? (gameState as SOSTTTState).scores.O
                        : scores.o}
                    </span>
                  </div>
                  <div className={styles.scoreCard} style={{ background: 'transparent' }}>
                    <span className={styles.scoreName} style={{ color: 'var(--text-muted)' }}>Draws</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--text-muted)' }}>{scores.draws}</span>
                  </div>
                </div>
              </div>
            </div>

            {(phase === 'over' || phase === 'playing') && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>Actions</div>
                <div className={styles.panelContent}>
                  <div className={styles.gameActions}>
                    <Button onClick={() => dispatch({ type: 'REMATCH' })} full>
                      {phase === 'over' ? 'Play again' : 'Restart game'}
                    </Button>
                    <Button variant="secondary" onClick={() => dispatch({ type: 'NEW_GAME' })} full>Change settings</Button>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      )}

      {phase === 'setup' && <Link href="/" className={styles.backLink}>← Back to lobby</Link>}
      </div>
    </>
  );
}
