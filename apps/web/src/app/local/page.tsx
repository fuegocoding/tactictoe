'use client';

import { useState, useReducer, useEffect, useRef } from 'react';
import Link from 'next/link';
import { StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT, Gomoku, SOSTTT, NumericalTTT } from '@tactictoe/game-engine';
import type { GameState, TerminalResult } from '@tactictoe/game-engine';
import type { GameRules } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import type { GomokuState } from '@tactictoe/game-engine';
import type { SOSTTTState } from '@tactictoe/game-engine';
import type { NumericalTTTState } from '@tactictoe/game-engine';

type LocalGameState = GameState & { terminal?: TerminalResult | null };
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { GridBoard } from '@/components/board/GridBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { Grip, Table2, Grid3x3, Target, Ban, Asterisk, Type, Hash, HelpCircle } from 'lucide-react';
import styles from './page.module.css';

type Variant = 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'wild_ttt' | 'notakto' | 'gomoku' | 'sos_ttt' | 'numerical_ttt';

const VARIANT_INFO: Record<Variant, { label: string; description: string; Icon: any }> = {
  standard_3x3: { label: 'Standard', description: 'Classic. Quick casual games.', Icon: Grid3x3 },
  ultimate_ttt: { label: 'Ultimate', description: '9 boards in one. The flagship.', Icon: Table2 },
  misere_ttt: { label: 'Misère', description: 'Force your opponent to get 3-in-a-row to win.', Icon: Target },
  wild_ttt: { label: 'Wild', description: 'Choose to place X or O on every turn.', Icon: Asterisk },
  notakto: { label: 'Notakto', description: 'Both players place X. Avoid making 3-in-a-row!', Icon: Ban },
  gomoku: { label: 'Gomoku', description: '15x15 board. First to 5 in a row wins. Deep strategy.', Icon: Grip },
  sos_ttt: { label: 'SOS', description: 'Place S or O to spell S-O-S for points + extra turns.', Icon: Type },
  numerical_ttt: { label: 'Numerical', description: 'Place numbers to sum precisely to 15.', Icon: Hash },
};

const engines: Record<Variant, GameRules> = {
  standard_3x3: new StandardTTT(),
  ultimate_ttt: new UltimateTTT(),
  misere_ttt: new MisereTTT(),
  wild_ttt: new WildTTT(),
  notakto: new NotaktoTTT(),
  gomoku: new Gomoku(),
  sos_ttt: new SOSTTT(),
  numerical_ttt: new NumericalTTT(),
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
}

type LocalAction =
  | { type: 'START_GAME' }
  | { type: 'MOVE'; gameState: LocalGameState; coordinate: string }
  | { type: 'GAME_OVER'; gameState: LocalGameState; coordinate: string }
  | { type: 'REMATCH' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_VARIANT'; variant: Variant }
  | { type: 'SET_NAME'; player: 1 | 2; name: string }
  | { type: 'SET_PLACING_AS'; symbol: string | number };

function reducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case 'SET_VARIANT': return { ...state, variant: action.variant };
    case 'SET_NAME':
      return action.player === 1
        ? { ...state, player1Name: action.name }
        : { ...state, player2Name: action.name };
    case 'START_GAME': {
      const engine = engines[state.variant];
      const initialPlacingAs = state.variant === 'sos_ttt' ? 'S' : state.variant === 'numerical_ttt' ? 1 : 'X';
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }), moveHistory: [], placingAs: initialPlacingAs };
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
        return { ...state, phase: 'over', gameState: action.gameState, moveHistory, scores };
      }
      return { ...state, gameState: action.gameState, moveHistory };
    }
    case 'REMATCH': {
      const engine = engines[state.variant];
      const initialPlacingAs = state.variant === 'sos_ttt' ? 'S' : state.variant === 'numerical_ttt' ? 1 : 'X';
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }), moveHistory: [], placingAs: initialPlacingAs };
    }
    case 'NEW_GAME':
      return { ...state, phase: 'setup', gameState: null, moveHistory: [] };
    case 'SET_PLACING_AS':
      return { ...state, placingAs: action.symbol };
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
};

function formatMoveRows(moves: string[]) {
  const rows = [];
  for (let i = 0; i < moves.length; i += 2) {
    rows.push({
      num: Math.floor(i / 2) + 1,
      x: moves[i],
      o: moves[i + 1] || '',
    });
  }
  return rows;
}

export default function LocalPage() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const movesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (movesRef.current) {
      movesRef.current.scrollTop = movesRef.current.scrollHeight;
    }
  }, [state.moveHistory]);

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (!state.gameState) return;
    const engine = engines[state.variant];

    let coordinate = '';
    if (state.variant === 'ultimate_ttt') {
      const overallCol = (boardIndex % 3) * 3 + (cellIndex % 3);
      const overallRow = Math.floor(boardIndex / 3) * 3 + Math.floor(cellIndex / 3);
      coordinate = `${String.fromCharCode(97 + overallCol)}${overallRow + 1}`;
    } else if (state.variant === 'gomoku') {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 15))}${Math.floor(cellIndex / 15) + 1}`;
    } else if (state.variant === 'sos_ttt') {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 8))}${Math.floor(cellIndex / 8) + 1}`;
    } else {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
    }

    const move = state.variant === 'ultimate_ttt'
      ? { data: { boardIndex, cellIndex } }
      : (state.variant === 'wild_ttt' || state.variant === 'sos_ttt')
      ? { data: { cellIndex, symbol: state.placingAs } }
      : state.variant === 'numerical_ttt'
      ? { data: { cellIndex, numberPlaced: typeof state.placingAs === 'number' ? state.placingAs : Number(state.placingAs) } }
      : { data: { cellIndex } };
    
    const result = engine.applyMove(state.gameState, move, state.gameState.currentPlayer);
    if (!result.ok) return;
    if (state.variant === 'wild_ttt' || state.variant === 'sos_ttt' || state.variant === 'numerical_ttt') coordinate += ` (${state.placingAs})`;

    if (state.variant === 'numerical_ttt') {
      const nextState = result.state as NumericalTTTState;
      const nextAvailable = nextState.currentPlayer === 'X' ? nextState.availableOdds : nextState.availableEvens;
      if (nextAvailable.length > 0) dispatch({ type: 'SET_PLACING_AS', symbol: nextAvailable[0]! });
    }

    const terminal = engine.checkTerminal(result.state);
    if (terminal) {
      dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate });
    } else {
      dispatch({ type: 'MOVE', gameState: result.state, coordinate });
    }
  };

  const { phase, variant, player1Name, player2Name, gameState, scores, moveHistory, placingAs } = state;
  const currentName = gameState?.currentPlayer === 'X' ? player1Name : player2Name;
  const moveRows = formatMoveRows(moveHistory);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Local Game</h1>
        <p className={styles.subtitle}>Same screen. Take turns.</p>
      </div>

      {phase === 'setup' && (
        <div className={styles.setupWrap}>
          <Card style={{ width: '100%', maxWidth: 440 }}>
            <div className={styles.setup}>
              <div className={styles.variantRow}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <p className={styles.variantLabel}>Game mode</p>
                  <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                    <div className={styles.variantInfo} title={VARIANT_INFO[variant]?.description}>
                      <HelpCircle size={14} style={{ marginRight: 4 }} />
                      {VARIANT_INFO[variant]?.description}
                    </div>
                    <a href={`/learn#${variant}`} className={styles.learnMoreLink}>
                      Learn more →
                    </a>
                  </div>
                </div>
                <div className={styles.variantButtons}>
                  {(Object.keys(VARIANT_INFO) as Variant[]).map((v) => {
                    const { label, Icon } = VARIANT_INFO[v];
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
                  label="Player X"
                  value={player1Name}
                  onChange={e => dispatch({ type: 'SET_NAME', player: 1, name: e.target.value })}
                  placeholder="Player 1"
                />
                <Input
                  label="Player O"
                  value={player2Name}
                  onChange={e => dispatch({ type: 'SET_NAME', player: 2, name: e.target.value })}
                  placeholder="Player 2"
                />
              </div>

              <Button onClick={() => dispatch({ type: 'START_GAME' })} full>
                Start Game
              </Button>
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
                  : `${currentName}'s turn (${gameState.currentPlayer})`}
              </p>
            )}

            {phase === 'playing' && (variant === 'wild_ttt' || variant === 'sos_ttt') && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>Place as:</span>
                <button
                  className={`${styles.wildBtn} ${styles.x} ${placingAs === (variant === 'sos_ttt' ? 'S' : 'X') ? styles.active : ''}`}
                  onClick={() => dispatch({ type: 'SET_PLACING_AS', symbol: variant === 'sos_ttt' ? 'S' : 'X' })}
                >
                  {variant === 'sos_ttt' ? 'S' : 'X'}
                </button>
                <button
                  className={`${styles.wildBtn} ${styles.o} ${placingAs === 'O' ? styles.active : ''}`}
                  onClick={() => dispatch({ type: 'SET_PLACING_AS', symbol: 'O' })}
                >
                  O
                </button>
              </div>
            )}
            {phase === 'playing' && variant === 'numerical_ttt' && gameState && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>
                  {gameState.currentPlayer === 'X' ? 'Available Odds:' : 'Available Evens:'}
                </span>
                { ((gameState as NumericalTTTState)[gameState.currentPlayer === 'X' ? 'availableOdds' : 'availableEvens']).map(num => (
                  <button
                    key={num}
                    className={`${styles.wildBtn} ${styles.x} ${placingAs === num ? styles.active : ''}`}
                    onClick={() => dispatch({ type: 'SET_PLACING_AS', symbol: num })}
                  >
                    {num}
                  </button>
                )) }
              </div>
            )}

            {phase === 'over' && gameState.terminal && (
              <div className={styles.turnBanner}>
                <p className={`${styles.gameOverTitle} ${!gameState.terminal.winner ? styles.draw : ''}`}>
                  {gameState.terminal.winner
                    ? `${gameState.terminal.winner === 'X' ? player1Name : player2Name} wins!`
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
                />
              ) : variant === 'gomoku' ? (
                <GridBoard
                  board={(gameState as GomokuState).board}
                  cols={15}
                  rows={15}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                />
              ) : variant === 'sos_ttt' ? (
                <GridBoard
                  board={(gameState as SOSTTTState).board}
                  cols={8}
                  rows={8}
                  currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                />
              ) : (
                <StandardBoard
                  board={(gameState as StandardTTTState).board}
                  currentPlayer={gameState.currentPlayer}
                  disabled={phase === 'over'}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
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
                    <span className={styles.scoreName}>{player1Name}{variant !== 'notakto' ? ' (X)' : ''}</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--mark-x)' }}>
                      {variant === 'sos_ttt' && gameState.variantId === 'sos_ttt' ? (gameState as SOSTTTState).scores.X : scores.x}
                    </span>
                  </div>
                  <div className={`${styles.scoreCard} ${gameState.currentPlayer === 'O' && phase === 'playing' ? styles.active : ''}`}>
                    <span className={styles.scoreName}>{player2Name}{variant !== 'notakto' ? ' (O)' : ''}</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--mark-o)' }}>
                      {variant === 'sos_ttt' && gameState.variantId === 'sos_ttt' ? (gameState as SOSTTTState).scores.O : scores.o}
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
  );
}
