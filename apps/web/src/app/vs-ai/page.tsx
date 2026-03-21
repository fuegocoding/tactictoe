'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { StandardTTT, UltimateTTT, MisereTTT, NotaktoTTT, WildTTT, Gomoku, SOSTTT, NumericalTTT } from '@tactictoe/game-engine';
import type { GameState, AIDifficulty, Player } from '@tactictoe/game-engine';
import type { GameRules } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import type { GomokuState } from '@tactictoe/game-engine';
import type { SOSTTTState } from '@tactictoe/game-engine';
import type { NumericalTTTState } from '@tactictoe/game-engine';
import { StandardBoard } from '@/components/board/StandardBoard';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { GridBoard } from '@/components/board/GridBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { useAI } from '@/hooks/useAI';
import styles from './page.module.css';
import localStyles from '../local/page.module.css';

type Variant = 'standard_3x3' | 'ultimate_ttt' | 'misere_ttt' | 'wild_ttt' | 'notakto' | 'gomoku' | 'sos_ttt' | 'numerical_ttt';

const VARIANT_LABELS: Record<Variant, string> = {
  standard_3x3: 'Standard 3×3',
  ultimate_ttt: 'Ultimate TTT',
  misere_ttt: 'Misère TTT',
  wild_ttt: 'Wild TTT',
  notakto: 'Notakto',
  gomoku: 'Gomoku',
  sos_ttt: 'SOS Tic-Tac-Toe',
  numerical_ttt: 'Numerical TTT',
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

const DIFFICULTY_LABELS: Record<AIDifficulty, string> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

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
  const movesRef = useRef<HTMLDivElement>(null);

  const ai = useAI(variant, difficulty);
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
    if (variant === 'gomoku') {
      return `${String.fromCharCode(97 + (cellIndex % 15))}${Math.floor(cellIndex / 15) + 1}`;
    }
    if (variant === 'sos_ttt') {
      return `${String.fromCharCode(97 + (cellIndex % 8))}${Math.floor(cellIndex / 8) + 1}`;
    }
    return `${String.fromCharCode(97 + (cellIndex % 3))}${Math.floor(cellIndex / 3) + 1}`;
  }

  const startGame = () => {
    const engine = engines[variant];
    const state = engine.initialize({ variantId: variant });
    setGameState(state);
    setPhase('playing');
    setWinner(undefined);
    setAiThinking(false);
    setMoveHistory([]);
    setPlacingAs(variant === 'sos_ttt' ? 'S' : variant === 'numerical_ttt' ? 1 : 'X');
  };

  // Trigger AI move when it's the AI's turn
  useEffect(() => {
    if (phase !== 'playing' || !gameState || aiThinking) return;
    if (gameState.currentPlayer !== aiPlayer) return;

    setAiThinking(true);

    // Minimum visual delay so user sees the "AI is thinking" indicator
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
        const boardIndex = variant === 'ultimate_ttt' ? move.boardIndex : 0;
        const moveData =
          variant === 'ultimate_ttt' ? { boardIndex, cellIndex: move.cellIndex } :
          (variant === 'wild_ttt' || variant === 'sos_ttt') ? { cellIndex: move.cellIndex, symbol: move.symbol } :
          variant === 'numerical_ttt' ? { cellIndex: move.cellIndex, numberPlaced: move.numberPlaced } :
          { cellIndex: move.cellIndex };
        const result = engine.applyMove(gameState, { data: moveData }, aiPlayer);
        if (result.ok) {
          const coordStr = (variant === 'wild_ttt' || variant === 'sos_ttt') ? `${formatCoord(boardIndex, move.cellIndex)} (${move.symbol})` : 
                           variant === 'numerical_ttt' ? `${formatCoord(boardIndex, move.cellIndex)} (${move.numberPlaced})` : 
                           formatCoord(boardIndex, move.cellIndex);
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
              const nextAvailable = nextState.currentPlayer === humanPlayer 
                ? (humanPlayer === 'X' ? nextState.availableOdds : nextState.availableEvens)
                : [];
              if (nextAvailable.length > 0) setPlacingAs(nextAvailable[0]!);
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
    const engine = engines[variant];
    const moveData =
      variant === 'ultimate_ttt' ? { boardIndex, cellIndex } :
      (variant === 'wild_ttt' || variant === 'sos_ttt') ? { cellIndex, symbol: placingAs } :
      variant === 'numerical_ttt' ? { cellIndex, numberPlaced: typeof placingAs === 'number' ? placingAs : Number(placingAs) } :
      { cellIndex };
    const result = engine.applyMove(gameState, { data: moveData }, humanPlayer);
    if (!result.ok) return;
    const coordStr = (variant === 'wild_ttt' || variant === 'sos_ttt' || variant === 'numerical_ttt') ? `${formatCoord(boardIndex, cellIndex)} (${placingAs})` : formatCoord(boardIndex, cellIndex);
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
    }
  };

  const isMyTurn = phase === 'playing' && gameState?.currentPlayer === humanPlayer && !aiThinking;

  return (
    <div className={localStyles.page}>
      <div className={localStyles.header}>
        <h1 className={localStyles.title}>Play vs AI</h1>
        <p className={localStyles.subtitle}>Test your skills against the computer.</p>
      </div>

      {phase === 'setup' && (
        <div className={localStyles.setupWrap}>
          <Card style={{ width: '100%', maxWidth: 440 }}>
            <div className={localStyles.setup}>
              <div className={localStyles.variantRow}>
                <p className={localStyles.variantLabel}>Game mode</p>
                <div className={localStyles.variantButtons}>
                  {(['ultimate_ttt', 'standard_3x3', 'misere_ttt', 'wild_ttt', 'notakto', 'gomoku', 'sos_ttt', 'numerical_ttt'] as Variant[]).map(v => (
                    <button
                      key={v}
                      className={`${localStyles.variantBtn} ${variant === v ? localStyles.selected : ''}`}
                      onClick={() => setVariant(v)}
                    >
                      {VARIANT_LABELS[v]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={localStyles.variantRow}>
                <p className={localStyles.variantLabel}>Difficulty</p>
                <div className={styles.diffRow}>
                  {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
                    <button
                      key={d}
                      className={`${styles.diffBtn} ${difficulty === d ? styles.selected : ''}`}
                      onClick={() => setDifficulty(d)}
                    >
                      {DIFFICULTY_LABELS[d]}
                    </button>
                  ))}
                </div>
              </div>

              <div className={localStyles.variantRow}>
                <p className={localStyles.variantLabel}>Play as</p>
                <div className={styles.sideRow}>
                  {(['X', 'O'] as Player[]).map(p => (
                    <button
                      key={p}
                      className={`${styles.sideBtn} ${humanPlayer === p ? styles.selected : ''}`}
                      onClick={() => setHumanPlayer(p)}
                    >
                      {p} {p === 'X' ? '(First)' : '(Second)'}
                    </button>
                  ))}
                </div>
              </div>

              <Input
                label="Your name"
                value={playerName}
                onChange={e => setPlayerName(e.target.value)}
                placeholder="You"
              />

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
                      <>
                        <div className={styles.thinkingDot} />
                        AI is thinking…
                      </>
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
            {(variant === 'wild_ttt' || variant === 'sos_ttt') && phase === 'playing' && gameState?.currentPlayer === humanPlayer && !aiThinking && (
              <div className={localStyles.wildPicker}>
                <span className={localStyles.wildPickerLabel}>Place as:</span>
                <button
                  className={`${localStyles.wildBtn} ${localStyles.x} ${placingAs === (variant === 'sos_ttt' ? 'S' : 'X') ? localStyles.active : ''}`}
                  onClick={() => setPlacingAs(variant === 'sos_ttt' ? 'S' : 'X')}
                >{variant === 'sos_ttt' ? 'S' : 'X'}</button>
                <button
                  className={`${localStyles.wildBtn} ${localStyles.o} ${placingAs === 'O' ? localStyles.active : ''}`}
                  onClick={() => setPlacingAs('O')}
                >O</button>
              </div>
            )}
            {variant === 'numerical_ttt' && phase === 'playing' && gameState?.currentPlayer === humanPlayer && !aiThinking && (
              <div className={localStyles.wildPicker}>
                <span className={localStyles.wildPickerLabel}>Available Numbers:</span>
                { ((gameState as NumericalTTTState)[humanPlayer === 'X' ? 'availableOdds' : 'availableEvens']).map(num => (
                  <button
                    key={num}
                    className={`${localStyles.wildBtn} ${localStyles.x} ${placingAs === num ? localStyles.active : ''}`}
                    onClick={() => setPlacingAs(num)}
                  >
                    {num}
                  </button>
                )) }
              </div>
            )}
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
              <GridBoard
                board={(gameState as GomokuState).board}
                cols={15}
                rows={15}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                disabled={!isMyTurn}
                onMove={(_, cellIndex) => handleMove(0, cellIndex)}
              />
            ) : variant === 'sos_ttt' ? (
              <GridBoard
                board={(gameState as SOSTTTState).board}
                cols={8}
                rows={8}
                currentPlayer={gameState.currentPlayer as 'X' | 'O'}
                disabled={!isMyTurn}
                onMove={(_, cellIndex) => handleMove(0, cellIndex)}
              />
            ) : (
              <StandardBoard
                board={(gameState as StandardTTTState).board}
                currentPlayer={gameState.currentPlayer}
                disabled={!isMyTurn}
                onMove={(_, cellIndex) => handleMove(0, cellIndex)}
              />
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
