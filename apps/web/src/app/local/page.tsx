'use client';

import { useState, useReducer } from 'react';
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
}

type LocalAction =
  | { type: 'START_GAME' }
  | { type: 'MOVE'; gameState: LocalGameState }
  | { type: 'GAME_OVER'; gameState: LocalGameState }
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
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }) };
    }
    case 'MOVE':
    case 'GAME_OVER': {
      const terminal = action.gameState.terminal;
      if (action.type === 'GAME_OVER' && terminal) {
        const scores = { ...state.scores };
        if (terminal.winner === 'X') scores.x++;
        else if (terminal.winner === 'O') scores.o++;
        else scores.draws++;
        return { ...state, phase: 'over', gameState: action.gameState, scores };
      }
      return { ...state, gameState: action.gameState };
    }
    case 'REMATCH': {
      const engine = engines[state.variant];
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }) };
    }
    case 'NEW_GAME':
      return { ...state, phase: 'setup', gameState: null };
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
};

export default function LocalPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (!state.gameState) return;
    const engine = engines[state.variant];
    const move = state.variant === 'ultimate_ttt'
      ? { data: { boardIndex, cellIndex } }
      : { data: { cellIndex } };
    const result = engine.applyMove(state.gameState, move, state.gameState.currentPlayer);
    if (!result.ok) return;
    const terminal = engine.checkTerminal(result.state);
    if (terminal) {
      dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal } });
    } else {
      dispatch({ type: 'MOVE', gameState: result.state });
    }
  };

  const { phase, variant, player1Name, player2Name, gameState, scores } = state;
  const currentName = gameState?.currentPlayer === 'X' ? player1Name : player2Name;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Local Game</h1>
        <p className={styles.subtitle}>Same screen. Take turns.</p>
      </div>

      {phase === 'setup' && (
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
      )}

      {(phase === 'playing' || phase === 'over') && gameState && (
        <div className={styles.game}>
          <div className={styles.scoreboard}>
            <div className={styles.scoreCard}>
              <span className={styles.scoreName}>{player1Name} (X)</span>
              <span className={`${styles.scoreValue} ${styles.x}`}>{scores.x}</span>
            </div>
            <div className={styles.scoreCard}>
              <span className={styles.scoreName}>Draws</span>
              <span className={styles.scoreValue}>{scores.draws}</span>
            </div>
            <div className={styles.scoreCard}>
              <span className={styles.scoreName}>{player2Name} (O)</span>
              <span className={`${styles.scoreValue} ${styles.o}`}>{scores.o}</span>
            </div>
          </div>

          {phase === 'playing' && (
            <p className={styles.turnBanner}>{currentName}'s turn ({gameState.currentPlayer})</p>
          )}

          {phase === 'over' && gameState.terminal && (
            <div className={styles.gameOver}>
              <p className={`${styles.gameOverTitle} ${!gameState.terminal.winner ? styles.draw : ''}`}>
                {gameState.terminal.winner
                  ? `${gameState.terminal.winner === 'X' ? player1Name : player2Name} wins!`
                  : "It's a draw!"}
              </p>
              <div className={styles.gameActions}>
                <Button onClick={() => dispatch({ type: 'REMATCH' })}>Play again</Button>
                <Button variant="secondary" onClick={() => dispatch({ type: 'NEW_GAME' })}>Change settings</Button>
              </div>
            </div>
          )}

          <div className={styles.boardWrap}>
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
      )}

      <Link href="/" className={styles.backLink}>← Back to lobby</Link>
    </div>
  );
}
