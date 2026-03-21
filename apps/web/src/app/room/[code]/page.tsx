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
import { QRCodeSVG } from 'qrcode.react';
import styles from './page.module.css';

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
  matchId: string | null;
}

type RoomAction =
  | { type: 'SET_MY_INDEX'; playerIndex: 0 | 1 | null; players?: PlayerInfo[] }
  | { type: 'GAME_STARTED'; gameState: GameState; players: PlayerInfo[] }
  | { type: 'STATE_UPDATE'; gameState: GameState }
  | { type: 'GAME_OVER'; winner: 'X' | 'O' | null; reason: 'win' | 'draw' | 'forfeit'; winnerDisplayName: string | null }
  | { type: 'ERROR'; message: string }
  | { type: 'MATCH_SAVED'; matchId: string };

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
    case 'MATCH_SAVED':
      return { ...state, matchId: action.matchId };
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
  matchId: null,
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

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const prevStateRef = useRef<GameState | null>(null);
  const movesRef = useRef<HTMLDivElement>(null);
  const joined = useRef(false);

  const mySymbol: 'X' | 'O' | null =
    roomState.myPlayerIndex !== null
      ? roomState.myPlayerIndex === 0 ? 'X' : 'O'
      : null;

  const isMyTurn =
    status === 'connected' &&
    roomState.gameState !== null &&
    roomState.phase === 'playing' &&
    mySymbol !== null &&
    roomState.gameState.currentPlayer === mySymbol;

  useEffect(() => {
    if (movesRef.current) {
      movesRef.current.scrollTop = movesRef.current.scrollHeight;
    }
  }, [moveHistory]);

  useEffect(() => {
    const prevState = prevStateRef.current;
    if (roomState.gameState) {
      if (!prevState || roomState.gameState.moveCount <= prevState.moveCount) {
        if (roomState.gameState.moveCount === 0) setMoveHistory([]);
      } else if (roomState.gameState.moveCount === prevState.moveCount + 1) {
        let coordinate = '';
        if (roomState.gameState.variantId === 'ultimate_ttt') {
          const oldBoards = (prevState as UltimateTTTState).boards;
          const newBoards = (roomState.gameState as UltimateTTTState).boards;
          out: for (let b = 0; b < 9; b++) {
            for (let c = 0; c < 9; c++) {
              if (oldBoards[b]![c] !== newBoards[b]![c]) {
                const overallCol = (b % 3) * 3 + (c % 3);
                const overallRow = Math.floor(b / 3) * 3 + Math.floor(c / 3);
                coordinate = `${String.fromCharCode(97 + overallCol)}${overallRow + 1}`;
                break out;
              }
            }
          }
        } else {
          const oldBoard = (prevState as StandardTTTState).board;
          const newBoard = (roomState.gameState as StandardTTTState).board;
          for (let c = 0; c < 9; c++) {
            if (oldBoard[c] !== newBoard[c]) {
              coordinate = `${String.fromCharCode(97 + (c % 3))}${Math.floor(c / 3) + 1}`;
              break;
            }
          }
        }
        if (coordinate) setMoveHistory(prev => [...prev, coordinate]);
      } else {
        setMoveHistory(prev => [...prev, '...']);
      }
      prevStateRef.current = roomState.gameState;
    }
  }, [roomState.gameState]);

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
      // Optimistically set playerIndex from matchmaking data while we wait for server confirmation.
      const idx = parseInt(savedIndex, 10) as 0 | 1;
      dispatch({ type: 'SET_MY_INDEX', playerIndex: idx });
      sessionStorage.removeItem(`room:${code}:playerIndex`);
    }

    // Always emit room:join so the server knows we've arrived at the room page.
    // For matchmaking: this triggers startGame() once both players have joined.
    // For private rooms: this is the standard join flow.
    socket.emit('room:join', {
      roomCode: code,
      guestId: guest.guestId,
      displayName: session?.user?.name ?? guest.displayName,
    });
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
    function onSpectatorSync(data: { gameState: GameState; players: PlayerInfo[] }) {
      dispatch({ type: 'SET_MY_INDEX', playerIndex: null, players: data.players });
      dispatch({ type: 'GAME_STARTED', gameState: data.gameState, players: data.players });
    }
    function onMatchSaved(data: { matchId: string }) {
      dispatch({ type: 'MATCH_SAVED', matchId: data.matchId });
    }

    socket.on('room:joined', onRoomJoined);
    socket.on('game:started', onGameStarted);
    socket.on('game:state', onGameState);
    socket.on('game:over', onGameOver);
    socket.on('game:reconnect', onGameReconnect);
    socket.on('error', onError);
    socket.on('room:spectating', onSpectating);
    socket.on('game:spectator_sync', onSpectatorSync);
    socket.on('game:match_saved', onMatchSaved);

    return () => {
      socket.off('room:joined', onRoomJoined);
      socket.off('game:started', onGameStarted);
      socket.off('game:state', onGameState);
      socket.off('game:over', onGameOver);
      socket.off('game:reconnect', onGameReconnect);
      socket.off('error', onError);
      socket.off('room:spectating', onSpectating);
      socket.off('game:spectator_sync', onSpectatorSync);
      socket.off('game:match_saved', onMatchSaved);
    };
  }, [socket]);

  const handleMove = useCallback(
    (boardIndex: number, cellIndex: number) => {
      socket.emit('game:move', { roomCode: code, boardIndex, cellIndex });
    },
    [socket, code]
  );

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const gameOverClass = roomState.winner === mySymbol
    ? styles.win
    : roomState.winner === null
    ? styles.draw
    : styles.lose;

  const moveRows = formatMoveRows(moveHistory);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span className={styles.roomCode}>Room: {code}</span>
          <div className={styles.status}>
            <span className={`${styles.statusDot} ${status === 'connected' ? styles.connected : ''}`} />
            {status === 'connected' ? 'Connected' : 'Connecting…'}
          </div>
        </div>
        <div className={styles.headerActions}>
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>Leave</Button>
        </div>
      </div>

      {roomState.error && <div className={styles.error}>{roomState.error}</div>}

      {roomState.phase === 'waiting' && status === 'connected' && !roomState.error && (
        <div className={styles.waiting}>
          <p className={styles.waitingTitle}>Waiting for opponent…</p>
          <p className={styles.waitingCode}>{code}</p>
          <p className={styles.waitingHint}>Share this code or scan the QR to join instantly.</p>
          <CopyButton text={shareUrl} />
          <div style={{ marginTop: 'var(--space-4)', background: 'white', padding: 'var(--space-3)', borderRadius: 'var(--radius-md)' }}>
            <QRCodeSVG value={shareUrl} size={160} />
          </div>
        </div>
      )}

      {(roomState.phase === 'playing' || roomState.phase === 'over') && roomState.gameState && (
        <div className={styles.gameLayout}>

          <div className={styles.sidePanel}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>Move History</div>
              <div className={styles.movesList} ref={movesRef}>
                {moveRows.length === 0 ? (
                  <div className={styles.emptyMoves}>No moves yet</div>
                ) : (
                  moveRows.map((row, idx) => (
                    <div className={styles.moveRow} key={idx}>
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
            {roomState.phase === 'playing' && (
              <p className={styles.turnBanner}>
                {isMyTurn ? 'Your turn' : "Opponent's turn"}
              </p>
            )}

            {roomState.phase === 'over' && (
              <div>
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
                  <p className={styles.gameOverSub}>
                    Rating change: {finalRating - initialRating > 0 ? '+' : ''}{finalRating - initialRating} ({finalRating})
                  </p>
                )}
              </div>
            )}

            <div style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 'var(--space-2)' }}>
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
          </div>

          <div className={styles.sidePanel}>
            <div className={styles.panel}>
              <div className={styles.panelHeader}>
                <span>Players</span>
                <CopyButton text={shareUrl} />
              </div>
              <div className={styles.panelContent}>
                <div className={styles.playersList}>
                  {roomState.players.map((p) => {
                    const sym = p.playerIndex === 0 ? 'X' : 'O';
                    const isMe = p.playerIndex === roomState.myPlayerIndex;
                    const isActive = roomState.gameState?.currentPlayer === sym && roomState.phase === 'playing';
                    return (
                      <div key={p.playerIndex} className={`${styles.playerCard} ${isActive ? styles.active : ''}`}>
                        <span className={styles.playerSymbol} style={{ color: sym === 'X' ? 'var(--mark-x)' : 'var(--mark-o)' }}>
                          {sym}
                        </span>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span className={styles.playerName}>{p.displayName}</span>
                          {isMe && <span className={styles.playerYou}>You</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            
            {roomState.phase === 'over' && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>Game Over</div>
                <div className={styles.panelContent}>
                  {roomState.matchId && (
                    <div style={{ marginBottom: 'var(--space-3)' }}>
                      <Button variant="secondary" onClick={() => router.push(`/replay/${roomState.matchId}`)} full>Watch Replay</Button>
                    </div>
                  )}
                  <Button variant="primary" onClick={() => router.push('/')} full>Back to Lobby</Button>
                </div>
              </div>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
