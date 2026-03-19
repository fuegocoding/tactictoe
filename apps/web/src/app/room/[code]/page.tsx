'use client';

import { useEffect, useReducer, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useGuestSession } from '@/hooks/useGuestSession';
import { useSocket } from '@/hooks/useSocket';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import type { UltimateTTTState } from '@tactictoe/game-engine';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PlayerInfo {
  displayName: string;
  playerIndex: 0 | 1;
}

interface RoomState {
  phase: 'waiting' | 'playing' | 'over';
  myPlayerIndex: 0 | 1 | null;
  players: PlayerInfo[];
  gameState: UltimateTTTState | null;
  winner: 'X' | 'O' | null;
  winnerDisplayName: string | null;
  reason: 'win' | 'draw' | 'forfeit' | null;
  error: string | null;
}

type RoomAction =
  | { type: 'SET_MY_INDEX'; playerIndex: 0 | 1; players?: PlayerInfo[] }
  | { type: 'GAME_STARTED'; gameState: UltimateTTTState; players: PlayerInfo[] }
  | { type: 'STATE_UPDATE'; gameState: UltimateTTTState }
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

  // ── Socket event listeners ────────────────────────────────────────────────────
  useEffect(() => {
    function onRoomJoined(data: { roomCode: string; playerIndex: 0 | 1; players: PlayerInfo[] }) {
      dispatch({ type: 'SET_MY_INDEX', playerIndex: data.playerIndex, players: data.players });
    }

    function onGameStarted(data: { gameState: UltimateTTTState; players: PlayerInfo[] }) {
      dispatch({ type: 'GAME_STARTED', gameState: data.gameState, players: data.players });
    }

    function onGameState(data: { gameState: UltimateTTTState }) {
      dispatch({ type: 'STATE_UPDATE', gameState: data.gameState });
    }

    function onGameOver(data: {
      gameState: UltimateTTTState;
      winner: 'X' | 'O' | null;
      reason: 'win' | 'draw' | 'forfeit';
      winnerDisplayName: string | null;
    }) {
      dispatch({ type: 'STATE_UPDATE', gameState: data.gameState });
      dispatch({ type: 'GAME_OVER', winner: data.winner, reason: data.reason, winnerDisplayName: data.winnerDisplayName });
    }

    function onGameReconnect(data: { gameState: UltimateTTTState; myPlayerIndex: 0 | 1; players: PlayerInfo[] }) {
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

  return (
    <main style={{ maxWidth: 700, margin: '32px auto', padding: '0 16px' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, margin: 0 }}>
            Room: <code style={{ letterSpacing: 4, fontSize: 20 }}>{code}</code>
          </h1>
          {mySymbol && (
            <p style={{ margin: '4px 0 0', color: '#9ca3af', fontSize: 14 }}>
              You are playing as <strong>{mySymbol}</strong>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => navigator.clipboard.writeText(shareUrl)} style={{ padding: '6px 12px', fontSize: 14 }}>
            Copy Link
          </button>
          <button onClick={() => router.push('/')} style={{ padding: '6px 12px', fontSize: 14 }}>
            Leave
          </button>
        </div>
      </div>

      {status !== 'connected' && <p style={{ color: '#f59e0b' }}>Connecting…</p>}

      {roomState.phase === 'waiting' && status === 'connected' && (
        <div style={{ marginBottom: 20 }}>
          <p>Waiting for opponent…</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Share code: <strong>{code}</strong></p>
        </div>
      )}

      {roomState.players.length > 0 && (
        <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
          {roomState.players.map((p) => {
            const sym = p.playerIndex === 0 ? 'X' : 'O';
            const isMe = p.playerIndex === roomState.myPlayerIndex;
            return (
              <div key={p.playerIndex} style={{ fontWeight: isMe ? 'bold' : 'normal' }}>
                {sym} — {p.displayName} {isMe ? '(you)' : ''}
              </div>
            );
          })}
        </div>
      )}

      {roomState.phase === 'playing' && roomState.gameState && (
        <p style={{ marginBottom: 12, color: isMyTurn ? '#4ade80' : '#9ca3af' }}>
          {isMyTurn ? 'Your turn' : "Opponent's turn"}
        </p>
      )}

      {roomState.gameState && roomState.phase !== 'waiting' && (
        <UltimateBoard
          boards={roomState.gameState.boards}
          boardResults={roomState.gameState.boardResults}
          nextBoardConstraint={roomState.gameState.nextBoardConstraint}
          currentPlayer={roomState.gameState.currentPlayer}
          disabled={!isMyTurn}
          onMove={handleMove}
        />
      )}

      {roomState.phase === 'over' && (
        <div style={{ marginTop: 24, padding: 16, border: '2px solid #4ade80', borderRadius: 8 }}>
          <h2 style={{ marginTop: 0 }}>
            {roomState.winner === mySymbol
              ? 'You win!'
              : roomState.winner === null
              ? "It's a draw!"
              : 'You lose.'}
          </h2>
          {roomState.reason === 'forfeit' && (
            <p style={{ color: '#f59e0b', fontSize: 14 }}>
              {roomState.winner === mySymbol ? 'Opponent disconnected.' : 'You were disconnected.'}
            </p>
          )}
          <button onClick={() => router.push('/')} style={{ padding: '10px 20px', fontSize: 16 }}>
            Back to Lobby
          </button>
        </div>
      )}

      {roomState.error && <p style={{ color: 'red', marginTop: 16 }}>{roomState.error}</p>}
    </main>
  );
}
