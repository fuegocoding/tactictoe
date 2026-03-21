'use client';

import { useState, useEffect } from 'react';
import { StandardTTT } from '@tactictoe/game-engine';
import type { GameState, StandardTTTState } from '@tactictoe/game-engine';
import { useAI } from '@/hooks/useAI';
import styles from './HeroBoard.module.css';
import Button from './ui/Button';

const engine = new StandardTTT();
const HUMAN = 'X';
const AI = 'O';

export default function HeroBoard() {
  const [gameState, setGameState] = useState<GameState>(() => engine.initialize({ variantId: 'standard_3x3' }));
  const [phase, setPhase] = useState<'playing' | 'over'>('playing');
  const [aiThinking, setAiThinking] = useState(false);
  const [winner, setWinner] = useState<string | null | undefined>(undefined);
  const ai = useAI('standard_3x3', 'hard'); // Play on hard so users get crushed/impressed

  const handleCellClick = (index: number) => {
    if (phase !== 'playing' || gameState.currentPlayer !== HUMAN || aiThinking) return;

    const result = engine.applyMove(gameState, { data: { cellIndex: index } }, HUMAN);
    if (!result.ok) return;

    const term = engine.checkTerminal(result.state);
    if (term) {
      setGameState(result.state);
      setPhase('over');
      setWinner(term.winner);
    } else {
      setGameState(result.state);
    }
  };

  useEffect(() => {
    if (phase !== 'playing' || gameState.currentPlayer !== AI || aiThinking) return;

    setAiThinking(true);
    let cancelled = false;

    ai.getMove(gameState, AI).then(move => {
      if (cancelled) return;
      setTimeout(() => {
        if (cancelled) return;
        const result = engine.applyMove(gameState, { data: { cellIndex: move.cellIndex } }, AI);
        if (result.ok) {
          const term = engine.checkTerminal(result.state);
          if (term) {
            setGameState(result.state);
            setPhase('over');
            setWinner(term.winner);
          } else {
            setGameState(result.state);
          }
        }
        setAiThinking(false);
      }, 400); // Small artificial delay
    }).catch(() => setAiThinking(false));

    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameState, phase]);

  const reset = () => {
    setGameState(engine.initialize({ variantId: 'standard_3x3' }));
    setPhase('playing');
    setWinner(undefined);
    setAiThinking(false);
  };

  const board = (gameState as StandardTTTState).board;

  return (
    <div className={styles.heroContainer}>
      <div className={styles.boardWrapper}>
        <div className={styles.grid}>
          {(board as any[]).map((cell, i) => (
            <button
              key={i}
              className={`${styles.cell} ${cell ? (cell === 'X' ? styles.cellX : styles.cellO) : ''}`}
              onClick={() => handleCellClick(i)}
              disabled={phase !== 'playing' || cell !== null}
            >
              {cell && <span className={styles.piece}>{cell}</span>}
            </button>
          ))}
        </div>
        
        {phase === 'over' && (
          <div className={styles.overlay}>
            <div className={styles.resultCard}>
              <h3>{winner === HUMAN ? 'You Win!' : winner === AI ? 'AI Wins!' : 'Draw!'}</h3>
              <p>{winner === HUMAN ? 'Impossible...' : winner === AI ? 'Too slow, human.' : 'A battle of wits.'}</p>
              <Button onClick={reset}>Play Again</Button>
            </div>
          </div>
        )}
      </div>

      <div className={styles.slogan}>
        {phase === 'playing' ? (
          aiThinking ? <p className={styles.thinking}>AI is pondering...</p> : <p>Your turn.</p>
        ) : (
          <p>Ready for a real challenge?</p>
        )}
      </div>
    </div>
  );
}
