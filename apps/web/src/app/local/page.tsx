'use client';

import { useState, useReducer, useEffect, useRef } from 'react';
import Link from 'next/link';
import { StandardTTT } from '@tactictoe/game-engine';
import { UltimateTTT } from '@tactictoe/game-engine';
import type { GameState, TerminalResult } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';

type LocalGameState = GameState & { terminal?: TerminalResult | null };
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import styles from './page.module.css';

type Variant = 'standard_3x3' | 'ultimate_ttt';

const engines = {
  standard_3x3: new StandardTTT(),
  ultimate_ttt: new UltimateTTT(),
};

interface LocalState {
  phase: 'setup' | 'playing' | 'over';
  variant: Variant;
  player1Name: string;
  player2Name: string;
  gameState: LocalGameState | null;
  scores: { x: number; o: number; draws: number };
  moveHistory: string[];
}

type LocalAction =
  | { type: 'START_GAME' }
  | { type: 'MOVE'; gameState: LocalGameState; coordinate: string }
  | { type: 'GAME_OVER'; gameState: LocalGameState; coordinate: string }
  | { type: 'REMATCH' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_VARIANT'; variant: Variant }
  | { type: 'SET_NAME'; player: 1 | 2; name: string };

function reducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case 'SET_VARIANT': return { ...state, variant: action.variant };
    case 'SET_NAME':
      return action.player === 1
        ? { ...state, player1Name: action.name }
        : { ...state, player2Name: action.name };
    case 'START_GAME': {
      const engine = engines[state.variant];
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }), moveHistory: [] };
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
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }), moveHistory: [] };
    }
    case 'NEW_GAME':
      return { ...state, phase: 'setup', gameState: null, moveHistory: [] };
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
    } else {
      coordinate = `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
    }

    const move = state.variant === 'ultimate_ttt'
      ? { data: { boardIndex, cellIndex } }
      : { data: { cellIndex } };
    
    const result = engine.applyMove(state.gameState, move, state.gameState.currentPlayer);
    if (!result.ok) return;
    const terminal = engine.checkTerminal(result.state);
    if (terminal) {
      dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal }, coordinate });
    } else {
      dispatch({ type: 'MOVE', gameState: result.state, coordinate });
    }
  };

  const { phase, variant, player1Name, player2Name, gameState, scores, moveHistory } = state;
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
                <p className={styles.variantLabel}>Game mode</p>
                <div className={styles.variantButtons}>
                  <button
                    className={`${styles.variantBtn} ${variant === 'ultimate_ttt' ? styles.selected : ''}`}
                    onClick={() => dispatch({ type: 'SET_VARIANT', variant: 'ultimate_ttt' })}
                  >
                    Ultimate TTT
                  </button>
                  <button
                    className={`${styles.variantBtn} ${variant === 'standard_3x3' ? styles.selected : ''}`}
                    onClick={() => dispatch({ type: 'SET_VARIANT', variant: 'standard_3x3' })}
                  >
                    Standard 3×3
                  </button>
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
              <p className={styles.turnBanner}>{currentName}'s turn ({gameState.currentPlayer})</p>
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
                    <span className={styles.scoreName}>{player1Name} (X)</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--mark-x)' }}>{scores.x}</span>
                  </div>
                  <div className={`${styles.scoreCard} ${gameState.currentPlayer === 'O' && phase === 'playing' ? styles.active : ''}`}>
                    <span className={styles.scoreName}>{player2Name} (O)</span>
                    <span className={styles.scoreValue} style={{ color: 'var(--mark-o)' }}>{scores.o}</span>
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
