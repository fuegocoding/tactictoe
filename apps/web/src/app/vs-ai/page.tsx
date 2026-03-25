'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT, Gomoku, SOSTTT, NumericalTTT,
  VanishingTTT, VANISHING_FADE_AFTER,
  TTT3D, TTT4D, OrderChaos, TacticToe, Ultimate3D, Garrison,
  getWinCells, getGomokuWinCells,
} from '@tactictoe/game-engine';
import type { GameState, AIDifficulty, Player } from '@tactictoe/game-engine';
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
import { useAI } from '@/hooks/useAI';
import type { AIVariant } from '@/hooks/useAI';
import { Grip, Table2, Grid3x3, Target, Ban, Asterisk, Type, Hash, HelpCircle, Eye, Box, Layers, Swords, Shuffle, Network, Shield } from 'lucide-react';
import styles from './page.module.css';
import localStyles from '../local/page.module.css';

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
  garrison:      { label: 'Garrison',    description: 'Chess-like pieces on an 8×8 board. Get 5-in-a-row.',     Icon: Shield },
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

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = { easy: 'Easy', medium: 'Medium', hard: 'Hard' };

export default function VsAIPage() {
  const [variant, setVariant] = useState<Variant>('ultimate_ttt');
  const [difficulty, setDifficulty] = useState<AIDifficulty>('medium');
  const [humanPlayer, setHumanPlayer] = useState<Player>('X');
  const [playerName, setPlayerName] = useState('You');
  const [phase, setPhase] = useState<'setup' | 'playing' | 'over'>('setup');
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [aiThinking, setAiThinking] = useState(false);
  const [scores, setScores] = useState({ human: 0, ai: 0, draws: 0 });
  const [winner, setWinner] = useState<Player | null | undefined>(undefined);
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [placingAs, setPlacingAs] = useState<string | number>('X');
  const [tacticMoveMode, setTacticMoveMode] = useState<'place' | 'move_obstacle'>('place');
  const [tacticSelectedObstacle, setTacticSelectedObstacle] = useState<number | null>(null);
  const [garrisonSelectedPiece, setGarrisonSelectedPiece] = useState<string | null>(null);
  const [garrisonLegalDests, setGarrisonLegalDests] = useState<number[]>([]);
  const movesRef = useRef<HTMLDivElement>(null);

  const ai = useAI(variant as AIVariant, difficulty);
  const aiPlayer: Player = humanPlayer === 'X' ? 'O' : 'X';

  useEffect(() => {
    if (movesRef.current) movesRef.current.scrollTop = movesRef.current.scrollHeight;
  }, [moveHistory]);

  function formatCoord(boardIndex: number, cellIndex: number): string {
    if (variant === 'ultimate_ttt') {
      const col = (boardIndex % 3) * 3 + (cellIndex % 3);
      const row = Math.floor(boardIndex / 3) * 3 + Math.floor(cellIndex / 3);
      return `${String.fromCharCode(97 + col)}${row + 1}`;
    }
    if (variant === 'gomoku') return `${String.fromCharCode(97 + (cellIndex % 15))}${Math.floor(cellIndex / 15) + 1}`;
    if (variant === 'sos_ttt') return `${String.fromCharCode(97 + (cellIndex % 8))}${Math.floor(cellIndex / 8) + 1}`;
    if (variant === 'order_chaos') return `${String.fromCharCode(97 + (cellIndex % 6))}${Math.floor(cellIndex / 6) + 1}`;
    if (variant === 'ttt_3d') return `L${boardIndex + 1}${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
    if (variant === 'ttt_4d') return `[${Math.floor(boardIndex / 3) + 1},${(boardIndex % 3) + 1},${Math.floor(cellIndex / 3) + 1},${(cellIndex % 3) + 1}]`;
    if (variant === 'ultimate_3d') return `M${boardIndex}[m${Math.floor(cellIndex / 9) + 1}(${Math.floor((cellIndex % 9) / 3) + 1},${(cellIndex % 3) + 1})]`;
    return `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
  }

  const startGame = () => {
    const engine = engines[variant];
    const seed = Date.now();
    const state = engine.initialize({ variantId: variant, seed });
    setGameState(state);
    setPhase('playing');
    setWinner(undefined);
    setAiThinking(false);
    setMoveHistory([]);
    setPlacingAs(variant === 'sos_ttt' ? 'S' : variant === 'numerical_ttt' ? 1 : 'X');
    setTacticMoveMode('place');
    setTacticSelectedObstacle(null);
    setGarrisonSelectedPiece(null);
    setGarrisonLegalDests([]);
  };

  // Trigger AI move when it's the AI's turn
  useEffect(() => {
    if (phase !== 'playing' || !gameState || aiThinking) return;
    if (gameState.currentPlayer !== aiPlayer) return;

    setAiThinking(true);
    const minDelay = difficulty === 'easy' ? 300 : difficulty === 'medium' ? 500 : 800;
    const startTime = Date.now();
    let cancelled = false;

    ai.getMove(gameState, aiPlayer).then(move => {
      if (cancelled) return;
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, minDelay - elapsed);

      setTimeout(() => {
        if (cancelled) return;
        const engine = engines[variant];
        let moveData: unknown;
        let coordStr = '';

        if (variant === 'ultimate_ttt') {
          moveData = { boardIndex: move.boardIndex, cellIndex: move.cellIndex };
          coordStr = formatCoord(move.boardIndex, move.cellIndex);
        } else if (variant === 'ttt_3d') {
          const globalIndex = move.boardIndex * 9 + move.cellIndex;
          moveData = { cellIndex: globalIndex };
          coordStr = formatCoord(move.boardIndex, move.cellIndex);
        } else if (variant === 'ttt_4d') {
          const globalIndex = move.boardIndex * 9 + move.cellIndex;
          moveData = { cellIndex: globalIndex };
          coordStr = formatCoord(move.boardIndex, move.cellIndex);
        } else if (variant === 'wild_ttt' || variant === 'sos_ttt') {
          moveData = { cellIndex: move.cellIndex, symbol: move.symbol };
          coordStr = `${formatCoord(0, move.cellIndex)} (${move.symbol})`;
        } else if (variant === 'numerical_ttt') {
          moveData = { cellIndex: move.cellIndex, numberPlaced: move.numberPlaced };
          coordStr = `${formatCoord(0, move.cellIndex)} (${move.numberPlaced})`;
        } else if (variant === 'order_chaos') {
          moveData = { cellIndex: move.cellIndex, symbol: move.symbol };
          coordStr = `${formatCoord(0, move.cellIndex)} (${move.symbol})`;
        } else if (variant === 'tactic_toe') {
          if (move.tacticType === 'place') {
            moveData = { type: 'place', cellIndex: move.cellIndex };
            const gi = move.cellIndex;
            coordStr = `L${Math.floor(gi / 9) + 1}(${Math.floor((gi % 9) / 3) + 1},${(gi % 3) + 1})`;
          } else {
            moveData = { type: 'move_obstacle', fromCell: move.fromCell, toCell: move.toCell };
            coordStr = `▪${move.fromCell}→${move.toCell}`;
          }
        } else if (variant === 'ultimate_3d') {
          moveData = { macroCell: move.boardIndex, microCell: move.cellIndex };
          coordStr = `M${move.boardIndex}[m${Math.floor(move.cellIndex / 9) + 1}(${Math.floor((move.cellIndex % 9) / 3) + 1},${(move.cellIndex % 3) + 1})]`;
        } else if (variant === 'garrison') {
          const gm = move.garrisonMove as GarrisonMove;
          moveData = gm;
          if (gm.type === 'place') {
            const sq = gm.to;
            coordStr = `${String.fromCharCode(97 + (sq % 8))}${Math.floor(sq / 8) + 1}(+${gm.pieceId.split('_')[1]})`;
          } else {
            coordStr = `${String.fromCharCode(97 + (gm.from % 8))}${Math.floor(gm.from / 8) + 1}-${String.fromCharCode(97 + (gm.to % 8))}${Math.floor(gm.to / 8) + 1}`;
          }
        } else {
          moveData = { cellIndex: move.cellIndex };
          coordStr = formatCoord(0, move.cellIndex);
        }

        const result = engine.applyMove(gameState!, { data: moveData }, aiPlayer);
        if (result.ok) {
          setMoveHistory(prev => [...prev, coordStr]);
          const term = engine.checkTerminal(result.state);
          if (term) {
            setGameState(result.state);
            setPhase('over');
            setWinner(term.winner);
            setScores(prev => {
              const next = { ...prev };
              if (term.winner === humanPlayer) next.human++;
              else if (term.winner === aiPlayer) next.ai++;
              else next.draws++;
              return next;
            });
          } else {
            setGameState(result.state);
            if (variant === 'numerical_ttt') {
              const nextState = result.state as NumericalTTTState;
              const nextAvail = humanPlayer === 'X' ? nextState.availableOdds : nextState.availableEvens;
              if (nextAvail.length > 0) setPlacingAs(nextAvail[0]!);
            }
          }
        }
        setAiThinking(false);
      }, remaining);
    }).catch(() => setAiThinking(false));

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, phase, aiPlayer, difficulty, variant]);

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (!gameState || phase !== 'playing' || gameState.currentPlayer !== humanPlayer || aiThinking) return;
    if (variant === 'tactic_toe' || variant === 'ultimate_3d' || variant === 'garrison') return; // handled separately
    const engine = engines[variant];

    let moveData: unknown;
    let coordStr = '';

    if (variant === 'ultimate_ttt') {
      moveData = { boardIndex, cellIndex };
      coordStr = formatCoord(boardIndex, cellIndex);
    } else if (variant === 'ttt_3d') {
      const globalIndex = boardIndex * 9 + cellIndex;
      moveData = { cellIndex: globalIndex };
      coordStr = formatCoord(boardIndex, cellIndex);
    } else if (variant === 'ttt_4d') {
      const globalIndex = boardIndex * 9 + cellIndex;
      moveData = { cellIndex: globalIndex };
      coordStr = formatCoord(boardIndex, cellIndex);
    } else if (variant === 'wild_ttt' || variant === 'sos_ttt') {
      moveData = { cellIndex, symbol: placingAs };
      coordStr = `${formatCoord(0, cellIndex)} (${placingAs})`;
    } else if (variant === 'numerical_ttt') {
      moveData = { cellIndex, numberPlaced: typeof placingAs === 'number' ? placingAs : Number(placingAs) };
      coordStr = `${formatCoord(0, cellIndex)} (${placingAs})`;
    } else if (variant === 'order_chaos') {
      moveData = { cellIndex, symbol: placingAs };
      coordStr = `${formatCoord(0, cellIndex)} (${placingAs})`;
    } else {
      moveData = { cellIndex };
      coordStr = formatCoord(0, cellIndex);
    }

    const result = engine.applyMove(gameState, { data: moveData }, humanPlayer);
    if (!result.ok) return;
    setMoveHistory(prev => [...prev, coordStr]);
    const term = engine.checkTerminal(result.state);
    if (term) {
      setGameState(result.state);
      setPhase('over');
      setWinner(term.winner);
      setScores(prev => {
        const next = { ...prev };
        if (term.winner === humanPlayer) next.human++;
        else if (term.winner === aiPlayer) next.ai++;
        else next.draws++;
        return next;
      });
    } else {
      setGameState(result.state);
      if (variant === 'numerical_ttt') {
        const nextState = result.state as NumericalTTTState;
        const nextAvail = humanPlayer === 'X' ? nextState.availableOdds : nextState.availableEvens;
        if (nextAvail.length > 0) setPlacingAs(nextAvail[0]!);
      }
    }
  };

  const handleUltimate3DMove = (macroCell: number, microCell: number) => {
    if (!gameState || phase !== 'playing' || gameState.currentPlayer !== humanPlayer || aiThinking) return;
    const engine = engines['ultimate_3d'];
    const result = engine.applyMove(gameState, { data: { macroCell, microCell } }, humanPlayer);
    if (!result.ok) return;
    const coord = `M${macroCell}[m${Math.floor(microCell / 9) + 1}(${Math.floor((microCell % 9) / 3) + 1},${(microCell % 3) + 1})]`;
    setMoveHistory(prev => [...prev, coord]);
    const term = engine.checkTerminal(result.state);
    if (term) {
      setGameState(result.state); setPhase('over'); setWinner(term.winner);
      setScores(prev => {
        const next = { ...prev };
        if (term.winner === humanPlayer) next.human++;
        else if (term.winner === aiPlayer) next.ai++;
        else next.draws++;
        return next;
      });
    } else {
      setGameState(result.state);
    }
  };

  const handleTacticCell = (globalIndex: number) => {
    if (!gameState || phase !== 'playing' || gameState.currentPlayer !== humanPlayer || aiThinking) return;
    const engine = engines['tactic_toe'];
    const s = gameState as TacticToeState;

    if (tacticMoveMode === 'place') {
      const result = engine.applyMove(s, { data: { type: 'place', cellIndex: globalIndex } }, humanPlayer);
      if (!result.ok) return;
      const coord = `L${Math.floor(globalIndex / 9) + 1}(${Math.floor((globalIndex % 9) / 3) + 1},${(globalIndex % 3) + 1})`;
      setMoveHistory(prev => [...prev, coord]);
      const term = engine.checkTerminal(result.state);
      if (term) {
        setGameState(result.state); setPhase('over'); setWinner(term.winner);
        setScores(prev => {
          const next = { ...prev };
          if (term.winner === humanPlayer) next.human++;
          else if (term.winner === aiPlayer) next.ai++;
          else next.draws++;
          return next;
        });
      } else {
        setGameState(result.state);
        setTacticMoveMode('place');
        setTacticSelectedObstacle(null);
      }
    } else {
      const cell = s.board[globalIndex];
      if (tacticSelectedObstacle === null) {
        if (cell === 'B') setTacticSelectedObstacle(globalIndex);
      } else {
        if (cell === null) {
          const result = engine.applyMove(s, { data: { type: 'move_obstacle', fromCell: tacticSelectedObstacle, toCell: globalIndex } }, humanPlayer);
          if (!result.ok) { setTacticSelectedObstacle(null); return; }
          const coord = `▪${tacticSelectedObstacle}→${globalIndex}`;
          setMoveHistory(prev => [...prev, coord]);
          setTacticSelectedObstacle(null);
          setTacticMoveMode('place');
          const term = engine.checkTerminal(result.state);
          if (term) {
            setGameState(result.state); setPhase('over'); setWinner(term.winner);
          } else {
            setGameState(result.state);
          }
        } else if (cell === 'B') {
          setTacticSelectedObstacle(globalIndex);
        } else {
          setTacticSelectedObstacle(null);
        }
      }
    }
  };

  const handleGarrisonHandClick = (pieceId: string) => {
    if (!gameState || phase !== 'playing' || gameState.currentPlayer !== humanPlayer || aiThinking) return;
    const s = gameState as GarrisonState;
    const piece = s.pieces.find(p => p.id === pieceId);
    if (!piece) return;
    // A hand piece can be placed on any empty square — collect empty squares as destinations
    const occupied = new Set(s.pieces.filter(p => p.square >= 0 && !p.captured).map(p => p.square));
    const dests: number[] = [];
    for (let i = 0; i < 64; i++) { if (!occupied.has(i)) dests.push(i); }
    setGarrisonSelectedPiece(pieceId);
    setGarrisonLegalDests(dests);
  };

  const handleGarrisonSquareClick = (square: number, pieceId: string | null) => {
    if (!gameState || phase !== 'playing' || gameState.currentPlayer !== humanPlayer || aiThinking) return;
    const s = gameState as GarrisonState;
    const engine = engines['garrison'];

    if (garrisonSelectedPiece === null) {
      // Select a board piece belonging to human
      if (pieceId) {
        const piece = s.pieces.find(p => p.id === pieceId);
        if (piece && piece.player === humanPlayer && piece.square >= 0) {
          const dests = engine.getLegalMoves(s)
            .map(m => m.data as GarrisonMove)
            .filter(m => m.pieceId === pieceId)
            .map(m => m.to);
          setGarrisonSelectedPiece(pieceId);
          setGarrisonLegalDests(dests);
        }
      }
      return;
    }

    // Attempt to apply the move
    const moveData: GarrisonMove = garrisonLegalDests.includes(square)
      ? s.pieces.find(p => p.id === garrisonSelectedPiece)!.square === -1
        ? { type: 'place', pieceId: garrisonSelectedPiece, to: square }
        : { type: 'move', pieceId: garrisonSelectedPiece, from: s.pieces.find(p => p.id === garrisonSelectedPiece)!.square, to: square }
      : null as unknown as GarrisonMove;

    if (!garrisonLegalDests.includes(square)) {
      // Clicked an invalid square — deselect or reselect
      if (pieceId) {
        const piece = s.pieces.find(p => p.id === pieceId);
        if (piece && piece.player === humanPlayer && piece.square >= 0) {
          const dests = engine.getLegalMoves(s)
            .map(m => m.data as GarrisonMove)
            .filter(m => m.pieceId === pieceId)
            .map(m => m.to);
          setGarrisonSelectedPiece(pieceId);
          setGarrisonLegalDests(dests);
          return;
        }
      }
      setGarrisonSelectedPiece(null);
      setGarrisonLegalDests([]);
      return;
    }

    const result = engine.applyMove(s, { data: moveData }, humanPlayer);
    if (!result.ok) { setGarrisonSelectedPiece(null); setGarrisonLegalDests([]); return; }

    const piece = s.pieces.find(p => p.id === garrisonSelectedPiece)!;
    const coord = piece.square === -1
      ? `${String.fromCharCode(97 + (square % 8))}${Math.floor(square / 8) + 1}(+${garrisonSelectedPiece.split('_')[1]})`
      : `${String.fromCharCode(97 + (piece.square % 8))}${Math.floor(piece.square / 8) + 1}-${String.fromCharCode(97 + (square % 8))}${Math.floor(square / 8) + 1}`;

    setMoveHistory(prev => [...prev, coord]);
    setGarrisonSelectedPiece(null);
    setGarrisonLegalDests([]);

    const term = engine.checkTerminal(result.state);
    if (term) {
      setGameState(result.state); setPhase('over'); setWinner(term.winner);
      setScores(prev => {
        const next = { ...prev };
        if (term.winner === humanPlayer) next.human++;
        else if (term.winner === aiPlayer) next.ai++;
        else next.draws++;
        return next;
      });
    } else {
      setGameState(result.state);
    }
  };

  const isMyTurn = phase === 'playing' && gameState?.currentPlayer === humanPlayer && !aiThinking;

  /** Visible board for Vanishing TTT */
  function getVanishingVisible(s: VanishingTTTState): (string | number | null)[] {
    return s.board.map((cell, i) => {
      if (cell === null) return null;
      const age = s.moveCount - (s.moveDates[i] ?? 0);
      return age > VANISHING_FADE_AFTER ? null : cell;
    });
  }

  return (
    <div className={localStyles.page}>
      <div className={localStyles.header}>
        <h1 className={localStyles.title}>Play vs AI</h1>
        <p className={localStyles.subtitle}>Test your skills against the computer.</p>
      </div>

      {phase === 'setup' && (
        <div className={localStyles.setupWrap}>
          <Card style={{ width: '100%', maxWidth: 520 }}>
            <div className={localStyles.setup}>
              <div className={localStyles.variantRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className={localStyles.variantLabel}>Game mode</p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div className={localStyles.variantInfo} title={VARIANT_INFO[variant]?.description}>
                      <HelpCircle size={14} style={{ marginRight: 4 }} />
                      {VARIANT_INFO[variant]?.description}
                    </div>
                    <a href={`/learn#${variant}`} className={localStyles.learnMoreLink}>Learn more →</a>
                  </div>
                </div>
                <div className={localStyles.variantButtons} style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {(Object.keys(VARIANT_INFO) as Variant[]).map(v => {
                    const { label, Icon } = VARIANT_INFO[v]!;
                    return (
                      <button key={v}
                        className={`${localStyles.variantBtn} ${variant === v ? localStyles.selected : ''}`}
                        onClick={() => setVariant(v)}
                      >
                        <Icon size={16} strokeWidth={2.5} style={{ marginBottom: 4 }} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className={localStyles.variantRow}>
                <p className={localStyles.variantLabel}>Difficulty</p>
                <div className={styles.diffRow}>
                  {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
                    <button key={d}
                      className={`${styles.diffBtn} ${difficulty === d ? styles.selected : ''}`}
                      onClick={() => setDifficulty(d)}
                    >{DIFFICULTY_LABELS[d]}</button>
                  ))}
                </div>
              </div>

              <div className={localStyles.variantRow}>
                <p className={localStyles.variantLabel}>Play as</p>
                <div className={styles.sideRow}>
                  {(['X', 'O'] as Player[]).map(p => (
                    <button key={p}
                      className={`${styles.sideBtn} ${humanPlayer === p ? styles.selected : ''}`}
                      onClick={() => setHumanPlayer(p)}
                    >{p} {p === 'X' ? '(First)' : '(Second)'}</button>
                  ))}
                </div>
              </div>

              <Input label="Your name" value={playerName} onChange={e => setPlayerName(e.target.value)} placeholder="You" />
              <Button onClick={startGame} full>Start Game</Button>
            </div>
          </Card>
        </div>
      )}

      {(phase === 'playing' || phase === 'over') && gameState && (
        <div className={localStyles.gameLayout}>
          <div className={localStyles.sidePanel}>
            <div className={localStyles.panel}>
              <div className={localStyles.panelHeader}>Score</div>
              <div className={localStyles.panelContent}>
                <div className={localStyles.scoreboard}>
                  <div className={`${localStyles.scoreCard} ${gameState.currentPlayer === humanPlayer && phase === 'playing' ? localStyles.active : ''}`}>
                    <span className={localStyles.scoreName}>{playerName}{variant !== 'notakto' ? ` (${humanPlayer})` : ''}</span>
                    <span className={localStyles.scoreValue}>
                      {variant === 'sos_ttt' && gameState.variantId === 'sos_ttt' ? (gameState as SOSTTTState).scores[humanPlayer] : scores.human}
                    </span>
                  </div>
                  <div className={localStyles.scoreCard}>
                    <span className={localStyles.scoreName}>Draws</span>
                    <span className={localStyles.scoreValue}>{scores.draws}</span>
                  </div>
                  <div className={`${localStyles.scoreCard} ${gameState.currentPlayer === aiPlayer && phase === 'playing' ? localStyles.active : ''}`}>
                    <span className={localStyles.scoreName}>AI{variant !== 'notakto' ? ` (${aiPlayer})` : ''} · {DIFFICULTY_LABELS[difficulty]}</span>
                    <span className={localStyles.scoreValue}>
                      {variant === 'sos_ttt' && gameState.variantId === 'sos_ttt' ? (gameState as SOSTTTState).scores[aiPlayer] : scores.ai}
                    </span>
                  </div>
                </div>

                {phase === 'playing' && (
                  <div className={styles.thinking}>
                    {aiThinking ? (
                      <><div className={styles.thinkingDot} />AI is thinking…</>
                    ) : (
                      <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                        Your turn{variant !== 'notakto' && ` (${humanPlayer})`}
                      </span>
                    )}
                  </div>
                )}

                {phase === 'over' && winner !== undefined && (
                  <div>
                    <p className={`${localStyles.gameOverTitle} ${winner === null ? localStyles.draw : ''}`}>
                      {winner === humanPlayer ? 'You win!'
                        : winner === aiPlayer ? 'AI wins.'
                        : "It's a draw!"}
                    </p>
                    <div className={localStyles.gameActions}>
                      <Button onClick={startGame}>Play again</Button>
                      <Button variant="secondary" onClick={() => setPhase('setup')}>Change settings</Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={localStyles.mainBoard}>
            {/* Symbol pickers */}
            {(variant === 'wild_ttt' || variant === 'sos_ttt') && isMyTurn && (
              <div className={localStyles.wildPicker}>
                <span className={localStyles.wildPickerLabel}>Place as:</span>
                {(variant === 'sos_ttt' ? ['S', 'O'] : ['X', 'O']).map(sym => (
                  <button key={sym}
                    className={`${localStyles.wildBtn} ${sym === 'X' || sym === 'S' ? localStyles.x : localStyles.o} ${placingAs === sym ? localStyles.active : ''}`}
                    onClick={() => setPlacingAs(sym)}
                  >{sym}</button>
                ))}
              </div>
            )}
            {variant === 'order_chaos' && isMyTurn && (
              <div className={localStyles.wildPicker}>
                <span className={localStyles.wildPickerLabel}>Place symbol:</span>
                {['X', 'O'].map(sym => (
                  <button key={sym}
                    className={`${localStyles.wildBtn} ${sym === 'X' ? localStyles.x : localStyles.o} ${placingAs === sym ? localStyles.active : ''}`}
                    onClick={() => setPlacingAs(sym)}
                  >{sym}</button>
                ))}
              </div>
            )}
            {variant === 'numerical_ttt' && isMyTurn && gameState && (
              <div className={localStyles.wildPicker}>
                <span className={localStyles.wildPickerLabel}>Available Numbers:</span>
                {((gameState as NumericalTTTState)[humanPlayer === 'X' ? 'availableOdds' : 'availableEvens']).map(num => (
                  <button key={num}
                    className={`${localStyles.wildBtn} ${localStyles.x} ${placingAs === num ? localStyles.active : ''}`}
                    onClick={() => setPlacingAs(num)}
                  >{num}</button>
                ))}
              </div>
            )}
            {variant === 'vanishing_ttt' && phase === 'playing' && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>
                Pieces fade after {VANISHING_FADE_AFTER} moves — but remain on the board!
              </div>
            )}
            {variant === 'tactic_toe' && isMyTurn && (
              <div className={localStyles.wildPicker}>
                <span className={localStyles.wildPickerLabel}>Action:</span>
                <button className={`${localStyles.wildBtn} ${localStyles.x} ${tacticMoveMode === 'place' ? localStyles.active : ''}`}
                  onClick={() => { setTacticMoveMode('place'); setTacticSelectedObstacle(null); }}>Place</button>
                <button className={`${localStyles.wildBtn} ${localStyles.o} ${tacticMoveMode === 'move_obstacle' ? localStyles.active : ''}`}
                  onClick={() => { setTacticMoveMode('move_obstacle'); setTacticSelectedObstacle(null); }}>Move Obstacle</button>
              </div>
            )}

            {/* Boards */}
            {variant === 'ultimate_ttt' ? (
              <UltimateBoard
                boards={(gameState as UltimateTTTState).boards}
                boardResults={(gameState as UltimateTTTState).boardResults}
                nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
                currentPlayer={gameState.currentPlayer}
                disabled={!isMyTurn}
                onMove={handleMove}
              />
            ) : variant === 'gomoku' ? (
              <GridBoard board={(gameState as GomokuState).board} cols={15} rows={15}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
                onMove={(_, ci) => handleMove(0, ci)}
                winCells={(() => {
                  const s = gameState as GomokuState;
                  return (s as any).terminal?.reason === 'win' ? (getGomokuWinCells(s.board) ?? []) : [];
                })()} />
            ) : variant === 'sos_ttt' ? (
              <GridBoard board={(gameState as SOSTTTState).board} cols={8} rows={8}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
                onMove={(_, ci) => handleMove(0, ci)}
                winCells={[]} />
            ) : variant === 'order_chaos' ? (
              <GridBoard board={(gameState as OrderChaosState).board} cols={6} rows={6}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
                onMove={(_, ci) => handleMove(0, ci)}
                winCells={[]} />
            ) : variant === 'vanishing_ttt' ? (
              <StandardBoard
                board={getVanishingVisible(gameState as VanishingTTTState) as any}
                currentPlayer={gameState.currentPlayer} disabled={!isMyTurn}
                onMove={(_, ci) => handleMove(0, ci)}
                winCells={(() => {
                  const s = gameState as any;
                  return s.terminal?.reason === 'win' && s.board ? (getWinCells(s.board) ?? []) : [];
                })()} />
            ) : variant === 'ttt_3d' ? (
              <ThreeDBoard board={(gameState as TTT3DState).board}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
                onMove={handleMove} />
            ) : variant === 'ttt_4d' ? (
              <FourDBoard board={(gameState as TTT4DState).board}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'} disabled={!isMyTurn}
                onMove={handleMove} />
            ) : variant === 'tactic_toe' ? (
              <TacticToeBoard board={(gameState as TacticToeState).board}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                disabled={!isMyTurn}
                moveMode={isMyTurn ? tacticMoveMode : 'place'}
                selectedObstacle={isMyTurn ? tacticSelectedObstacle : null}
                onCellClick={handleTacticCell} />
            ) : variant === 'ultimate_3d' ? (
              <Ultimate3DBoard
                microBoards={(gameState as Ultimate3DState).microBoards}
                macroResults={(gameState as Ultimate3DState).macroResults}
                nextMacroConstraint={(gameState as Ultimate3DState).nextMacroConstraint}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                disabled={!isMyTurn}
                onMove={handleUltimate3DMove}
              />
            ) : variant === 'garrison' ? (
              <GarrisonBoard
                state={gameState as GarrisonState}
                disabled={!isMyTurn}
                selectedPieceId={isMyTurn ? garrisonSelectedPiece : null}
                legalDestinations={isMyTurn ? garrisonLegalDests : []}
                onHandPieceClick={handleGarrisonHandClick}
                onBoardSquareClick={handleGarrisonSquareClick}
              />
            ) : (
              <StandardBoard
                board={(gameState as StandardTTTState).board}
                currentPlayer={gameState.currentPlayer} disabled={!isMyTurn}
                onMove={(_, ci) => handleMove(0, ci)}
                winCells={(() => {
                  const s = gameState as any;
                  return s.terminal?.reason === 'win' && s.board ? (getWinCells(s.board) ?? []) : [];
                })()} />
            )}
          </div>

          <div className={localStyles.sidePanel}>
            <div className={localStyles.panel}>
              <div className={localStyles.panelHeader}>Move History</div>
              <div className={localStyles.movesList} ref={movesRef}>
                {moveHistory.length === 0 ? (
                  <div className={localStyles.emptyMoves}>No moves yet</div>
                ) : (
                  Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => (
                    <div className={localStyles.moveRow} key={i}>
                      <span className={localStyles.moveNum}>{i + 1}.</span>
                      <span className={localStyles.moveX}>{moveHistory[i * 2] ?? ''}</span>
                      <span className={localStyles.moveO}>{moveHistory[i * 2 + 1] ?? ''}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <Link href="/" className={localStyles.backLink}>← Back to lobby</Link>
    </div>
  );
}
