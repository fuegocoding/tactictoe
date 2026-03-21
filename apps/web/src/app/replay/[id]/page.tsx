'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { GridBoard } from '@/components/board/GridBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import styles from '../../local/page.module.css';

import { StandardTTT, UltimateTTT, Gomoku } from '@tactictoe/game-engine';
import type { GameRules, GameState, UltimateTTTState, StandardTTTState, GomokuState } from '@tactictoe/game-engine';

const VARIANT_LABELS: Record<string, string> = {
  standard_3x3: 'Standard 3x3',
  ultimate_ttt: 'Ultimate TTT',
  gomoku: 'Gomoku',
};

const engines: Record<string, GameRules> = {
  standard_3x3: new StandardTTT(),
  ultimate_ttt: new UltimateTTT(),
  gomoku: new Gomoku(),
};

interface MoveRecord {
  boardIndex: number;
  cellIndex: number;
  player: 'X' | 'O';
}

interface MatchData {
  id: string;
  variantId: string;
  rated: boolean;
  player1Name: string;
  player2Name: string;
  winner: string | null;
  reason: string;
  moveHistory: MoveRecord[];
  createdAt: string;
}

export default function ReplayPage() {
  const { id } = useParams();
  const router = useRouter();
  const [match, setMatch] = useState<MatchData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Replay state
  const [currentMoveIndex, setCurrentMoveIndex] = useState(0);
  const [gameState, setGameState] = useState<GameState | null>(null);

  useEffect(() => {
    fetch(`/api/matches/${id}`)
      .then(res => {
        if (!res.ok) throw new Error('Match not found');
        return res.json();
      })
      .then(data => {
        setMatch(data);
        const engine = engines[data.variantId];
        if (engine) {
          setGameState(engine.initialize({ variantId: data.variantId }));
        }
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Recompute game state whenever currentMoveIndex changes
  useEffect(() => {
    if (!match) return;
    const engine = engines[match.variantId];
    if (!engine) return;

    let state = engine.initialize({ variantId: match.variantId });
    for (let i = 0; i < currentMoveIndex; i++) {
      const move = match.moveHistory[i];
      if (!move) break;
      const result = engine.applyMove(state, { data: { boardIndex: move.boardIndex, cellIndex: move.cellIndex } }, move.player);
      if (result.ok) {
        state = result.state;
      }
    }
    setGameState(state);
  }, [match, currentMoveIndex]);

  if (loading) return <div className={styles.page}><div className={styles.header}><h1 className={styles.title}>Loading Replay...</h1></div></div>;
  if (error || !match) return <div className={styles.page}><div className={styles.error}>{error || 'Not found'}</div><Button onClick={() => router.push('/')}>Back to Lobby</Button></div>;

  const totalMoves = match.moveHistory?.length || 0;

  const handleNext = () => setCurrentMoveIndex(p => Math.min(p + 1, totalMoves));
  const handlePrev = () => setCurrentMoveIndex(p => Math.max(p - 1, 0));
  const handleStart = () => setCurrentMoveIndex(0);
  const handleEnd = () => setCurrentMoveIndex(totalMoves);

  const gameOverClass = match.winner ? (match.winner === 'X' ? styles.win : styles.lose) : styles.draw;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <h1 className={styles.title}>Match Replay</h1>
          <span className={styles.subtitle}>{VARIANT_LABELS[match.variantId] || match.variantId} · {new Date(match.createdAt).toLocaleDateString()}</span>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Exit Replay</Button>
        </div>
      </div>

      <div className={styles.gameLayout}>
        <div className={styles.sidePanel}>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>Players</div>
            <div className={styles.panelContent}>
              <div className={styles.scoreboard}>
                <div className={styles.scoreCard}>
                  <span className={styles.scoreName}>{match.player1Name} (X)</span>
                  {match.winner === 'X' && <span className={styles.scoreValue} style={{ color: 'var(--mark-x)' }}>Winner</span>}
                </div>
                <div className={styles.scoreCard}>
                  <span className={styles.scoreName}>{match.player2Name} (O)</span>
                  {match.winner === 'O' && <span className={styles.scoreValue} style={{ color: 'var(--mark-o)' }}>Winner</span>}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.panel}>
            <div className={styles.panelHeader}>Result</div>
            <div className={styles.panelContent}>
               <h3 className={`${styles.gameOverTitle} ${gameOverClass}`} style={{ fontSize: '1.2rem', margin: 0 }}>
                 {match.winner ? `${match.winner === 'X' ? match.player1Name : match.player2Name} won` : "Draw"}
               </h3>
               {match.reason === 'forfeit' && <p className={styles.gameOverSub}>by forfeit.</p>}
            </div>
          </div>
        </div>

        <div className={styles.mainBoard}>
          <div className={styles.turnBanner} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>Move {currentMoveIndex} of {totalMoves}</span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
               <Button size="sm" variant="secondary" onClick={handleStart} disabled={currentMoveIndex === 0}>|&lt;</Button>
               <Button size="sm" variant="secondary" onClick={handlePrev} disabled={currentMoveIndex === 0}>&lt; Prev</Button>
               <Button size="sm" variant="secondary" onClick={handleNext} disabled={currentMoveIndex === totalMoves}>Next &gt;</Button>
               <Button size="sm" variant="secondary" onClick={handleEnd} disabled={currentMoveIndex === totalMoves}>&gt;|</Button>
            </div>
          </div>

          <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 'var(--space-2)' }}>
            {gameState && match.variantId === 'ultimate_ttt' && (
              <UltimateBoard
                boards={(gameState as UltimateTTTState).boards}
                boardResults={(gameState as UltimateTTTState).boardResults}
                nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
                currentPlayer={gameState.currentPlayer}
                disabled={true}
                onMove={() => {}}
              />
            )}
            {gameState && match.variantId === 'gomoku' && (
               <GridBoard
                 board={(gameState as GomokuState).board}
                 cols={15}
                 rows={15}
                 currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                 disabled={true}
                 onMove={() => {}}
               />
            )}
            {gameState && match.variantId === 'standard_3x3' && (
              <StandardBoard
                board={(gameState as StandardTTTState).board}
                currentPlayer={gameState.currentPlayer}
                disabled={true}
                onMove={() => {}}
              />
            )}
            {!gameState && <p>Unsupported variant for visual replay.</p>}
          </div>
        </div>

      </div>
    </div>
  );
}
