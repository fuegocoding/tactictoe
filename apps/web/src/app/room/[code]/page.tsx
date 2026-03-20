'use client';

import { useEffect, useReducer, useCallback, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useSocket } from '@/hooks/useSocket';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { StandardBoard } from '@/components/board/StandardBoard';
import Button from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import type { GameState, UltimateTTTState, StandardTTTState } from '@tactictoe/game-engine';
import styles from './page.module.css';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerInfo {
  displayName: string;
  playerIndex: 0 | 1;
}

interface RoomState {
  phase: 'waiting' | 'playing' | 'over';
  myPlayerIndex: 0 | 1 | null;
  players: PlayerInfo[];
  gameState: GameState | null;
  winner: 'X' | 'O' | null;
  winnerDisplayName: string | null;
  reason: 'win' | 'draw' | 'forfeit' | null;
  error: string | null;
}

type RoomAction =
  | { type: 'SET_MY_INDEX'; playerIndex: 0 | 1; players?: PlayerInfo[] }
  | { type: 'GAME_STARTED'; gameState: GameState; players: PlayerInfo[] }
  | { type: 'STATE_UPDATE'; gameState: GameState }
  | { type: 'GAME_OVER'; winner: 'X' | 'O' | null; reason: 'win' | 'draw' | 'forfeit'; winnerDisplayName: string | null }
  | { type: 'ERROR'; message: string };

function roomReducer(state: RoomState, action: RoomAction): RoomState {
  switch (action.type) {
    case 'SET_MY_INDEX':
      return { ...state, myPlayerIndex: action.playerIndex, players: action.players ?? state.players };
    case 'GAME_STARTED':
      return { ...state, phase: 'playing', gameState: action.gameState, players: action.players };
    case 'STATE_UPDATE':
      return { ...state, gameState: action.gameState };
    case 'GAME_OVER':
      return { ...state, phase: 'over', winner: action.winner, reason: action.reason, winnerDisplayName: action.winnerDisplayName };
    case 'ERROR':
      return { ...state, error: action.message };
    default:
      return state;
  }
}

const initialState: RoomState = {
  phase: 'waiting',
  myPlayerIndex: null,
  players: [],
  gameState: null,
  winner: null,
  winnerDisplayName: null,
  reason: null,
  error: null,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const code = (params['code'] as string).toUpperCase();
  const { data: session } = useSession();
  const guest = useGuestSession();
  const { socket, status } = useSocket();
  const [roomState, dispatch] = useReducer(roomReducer, initialState);

  const [rated, setRated] = useState(false);
  const [initialRating, setInitialRating] = useState<number | null>(null);
  const [finalRating, setFinalRating] = useState<number | null>(null);

  const joined = useRef(false);

  const mySymbol: 'X' | 'O' | null =
    roomState.myPlayerIndex !== null
      ? roomState.myPlayerIndex === 0 ? 'X' : 'O'
      : null;

  // Gate on `status === 'connected'` so board goes non-interactive during reconnect
  const isMyTurn =
    status === 'connected' &&
    roomState.gameState !== null &&
    roomState.phase === 'playing' &&
    mySymbol !== null &&
    roomState.gameState.currentPlayer === mySymbol;

  // ── Join logic ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (status !== 'connected' || !guest || joined.current) return;
    joined.current = true;

    const savedIndex = sessionStorage.getItem(`room:${code}:playerIndex`);
    const isRated = sessionStorage.getItem(`room:${code}:rated`) === 'true';

    if (isRated) {
      setRated(true);
      fetch('/api/ratings/me?variant=ultimate_ttt').then(res => res.json()).then(data => {
        if (data.rating) setInitialRating(data.rating.rating);
      });
      sessionStorage.removeItem(`room:${code}:rated`);
    }

    if (savedIndex !== null) {
      const idx = parseInt(savedIndex, 10) as 0 | 1;
      dispatch({ type: 'SET_MY_INDEX', playerIndex: idx });
      sessionStorage.removeItem(`room:${code}:playerIndex`);
    } else {
      socket.emit('room:join', {
        roomCode: code,
        guestId: guest.guestId,
        displayName: session?.user?.name ?? guest.displayName,
      });
    }
  }, [status, guest, session, socket, code]);

  useEffect(() => {
    if (roomState.phase === 'over' && rated) {
      setTimeout(() => {
        fetch('/api/ratings/me?variant=ultimate_ttt').then(res => res.json()).then(data => {
          if (data.rating) setFinalRating(data.rating.rating);
        });
      }, 500);
    }
  }, [roomState.phase, rated]);

  // ── Socket event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    function onRoomJoined(data: { roomCode: string; playerIndex: 0 | 1; players: PlayerInfo[] }) {
      dispatch({ type: 'SET_MY_INDEX', playerIndex: data.playerIndex, players: data.players });
    }

    function onGameStarted(data: { gameState: GameState; players: PlayerInfo[] }) {
      dispatch({ type: 'GAME_STARTED', gameState: data.gameState, players: data.players });
    }

    function onGameState(data: { gameState: GameState }) {
      dispatch({ type: 'STATE_UPDATE', gameState: data.gameState });
    }

    function onGameOver(data: {
      gameState: GameState;
      winner: 'X' | 'O' | null;
      reason: 'win' | 'draw' | 'forfeit';
      winnerDisplayName: string | null;
    }) {
      dispatch({ type: 'STATE_UPDATE', gameState: data.gameState });
      dispatch({ type: 'GAME_OVER', winner: data.winner, reason: data.reason, winnerDisplayName: data.winnerDisplayName });
    }

    function onGameReconnect(data: { gameState: GameState; myPlayerIndex: 0 | 1; players: PlayerInfo[] }) {
      dispatch({ type: 'SET_MY_INDEX', playerIndex: data.myPlayerIndex, players: data.players });
      dispatch({ type: 'GAME_STARTED', gameState: data.gameState, players: data.players });
    }

    function onError(data: { message: string }) {
      dispatch({ type: 'ERROR', message: data.message });
    }

    function onSpectating() {
      dispatch({ type: 'ERROR', message: 'This room is full. Watching as spectator.' });
    }

    socket.on('room:joined', onRoomJoined);
    socket.on('game:started', onGameStarted);
    socket.on('game:state', onGameState);
    socket.on('game:over', onGameOver);
    socket.on('game:reconnect', onGameReconnect);
    socket.on('error', onError);
    socket.on('room:spectating', onSpectating);

    return () => {
      socket.off('room:joined', onRoomJoined);
      socket.off('game:started', onGameStarted);
      socket.off('game:state', onGameState);
      socket.off('game:over', onGameOver);
      socket.off('game:reconnect', onGameReconnect);
      socket.off('error', onError);
      socket.off('room:spectating', onSpectating);
    };
  }, [socket]);

  // ── Move handler ──────────────────────────────────────────────────────────────
  const handleMove = useCallback(
    (boardIndex: number, cellIndex: number) => {
      socket.emit('game:move', { roomCode: code, boardIndex, cellIndex });
    },
    [socket, code]
  );

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  // ── Determine game-over result class ──────────────────────────────────────────
  const gameOverClass = roomState.winner === mySymbol
    ? styles.win
    : roomState.winner === null
    ? styles.draw
    : styles.lose;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <span className={styles.roomCode}>{code}</span>
        <div className={styles.headerActions}>
          <CopyButton text={shareUrl} />
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Leave</Button>
        </div>
      </div>

      {/* Connection status */}
      {status !== 'connected' && (
        <div className={styles.status}>
          <span className={styles.statusDot} />
          Connecting…
        </div>
      )}

      {/* Waiting phase */}
      {roomState.phase === 'waiting' && status === 'connected' && (
        <div className={styles.waiting}>
          <p className={styles.waitingTitle}>Waiting for opponent…</p>
          <p className={styles.waitingCode}>{code}</p>
          <p className={styles.waitingHint}>Share this code or link with a friend</p>
          <CopyButton text={shareUrl} />
        </div>
      )}

      {/* Player cards */}
      {roomState.players.length > 0 && (
        <div className={styles.players}>
          {roomState.players.map((p) => {
            const sym = p.playerIndex === 0 ? 'X' : 'O';
            const isMe = p.playerIndex === roomState.myPlayerIndex;
            const isActive = roomState.gameState?.currentPlayer === sym && roomState.phase === 'playing';
            return (
              <div key={p.playerIndex} className={`${styles.player} ${isActive ? styles.active : ''}`}>
                <span className={styles.playerSymbol}>{sym}</span>
                <div>
                  <div className={styles.playerName}>{p.displayName}</div>
                  {isMe && <div className={styles.playerYou}>you</div>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Turn banner */}
      {roomState.phase === 'playing' && roomState.gameState && (
        <div className={`${styles.turnBanner} ${isMyTurn ? styles.mine : styles.theirs}`}>
          {isMyTurn ? 'Your turn' : "Opponent's turn"}
        </div>
      )}

      {/* Board */}
      {roomState.gameState && roomState.phase !== 'waiting' && (
        <div className={styles.boardWrap}>
          {roomState.gameState.variantId === 'ultimate_ttt' ? (
            <UltimateBoard
              boards={(roomState.gameState as UltimateTTTState).boards}
              boardResults={(roomState.gameState as UltimateTTTState).boardResults}
              nextBoardConstraint={(roomState.gameState as UltimateTTTState).nextBoardConstraint}
              currentPlayer={roomState.gameState.currentPlayer}
              disabled={!isMyTurn}
              onMove={handleMove}
            />
          ) : (
            <StandardBoard
              board={(roomState.gameState as StandardTTTState).board}
              currentPlayer={roomState.gameState.currentPlayer}
              disabled={!isMyTurn}
              onMove={(_, cellIndex) => handleMove(0, cellIndex)}
            />
          )}
        </div>
      )}

      {/* Game over */}
      {roomState.phase === 'over' && (
        <div className={styles.gameOver}>
          <h2 className={`${styles.gameOverTitle} ${gameOverClass}`}>
            {roomState.winner === mySymbol
              ? 'You win!'
              : roomState.winner === null
              ? "It's a draw!"
              : 'You lose.'}
          </h2>
          {roomState.reason === 'forfeit' && (
            <p className={styles.gameOverSub}>
              {roomState.winner === mySymbol ? 'Opponent disconnected.' : 'You were disconnected.'}
            </p>
          )}
          {rated && initialRating !== null && finalRating !== null && (
            <p className={styles.gameOverSub} style={{ marginTop: 'var(--space-2)' }}>
              Rating change: {finalRating - initialRating > 0 ? '+' : ''}{finalRating - initialRating} ({finalRating})
            </p>
          )}
          <Button onClick={() => router.push('/')}>Back to Lobby</Button>
        </div>
      )}

      {/* Error */}
      {roomState.error && <div className={styles.error}>{roomState.error}</div>}
    </div>
  );
}
