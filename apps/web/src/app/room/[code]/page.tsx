'use client';

import { useEffect, useReducer, useCallback, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useGuestSession } from '@/hooks/useGuestSession';
import { VictoryConfetti } from '@/components/VictoryConfetti';
import { useSound } from '@/hooks/useSound';
import { useSocket } from '@/hooks/useSocket';
import { UltimateBoard } from '@/components/board/UltimateBoard';
import { StandardBoard } from '@/components/board/StandardBoard';
import { ThreeDBoard } from '@/components/board/ThreeDBoard';
import { FourDBoard } from '@/components/board/FourDBoard';
import { Ultimate3DBoard } from '@/components/board/Ultimate3DBoard';
import { TacticToeBoard } from '@/components/board/TacticToeBoard';
import { GarrisonBoard } from '@/components/board/GarrisonBoard';
import Button from '@/components/ui/Button';
import CopyButton from '@/components/ui/CopyButton';
import type { GameState, UltimateTTTState, StandardTTTState, GomokuState, SOSTTTState, NumericalTTTState, TTT3DState, TTT4DState, Ultimate3DState, TacticToeState, OrderChaosState, TacticToeMove, GarrisonState, GarrisonMove, Board } from '@tactictoe/game-engine';
import { getWinCells, getGomokuWinCells, Garrison, getWinCells3D, getWinCells4D, getWinCells6x6, checkFiveInARow } from '@tactictoe/game-engine';

const garrisonEngine = new Garrison();
import { GridBoard } from '@/components/board/GridBoard';
import { QRCodeSVG } from 'qrcode.react';
import styles from './page.module.css';

interface PlayerInfo {
  displayName: string;
  playerIndex: 0 | 1;
}

interface ChatMessage {
  guestId: string;
  displayName: string;
  message: string;
  timestamp: number;
  isMe: boolean;
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
  const [isMatchmaking, setIsMatchmaking] = useState(false);

  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [placingAs, setPlacingAs] = useState<string | number>('X');
  const [tacticToeMode, setTacticToeMode] = useState<'place' | 'move_obstacle'>('place');
  const [tacticToeSelectedObstacle, setTacticToeSelectedObstacle] = useState<number | null>(null);
  const [garrisonSelectedPiece, setGarrisonSelectedPiece] = useState<string | null>(null);
  const [garrisonLegalDests, setGarrisonLegalDests] = useState<number[]>([]);

  const sound = useSound();
  const [showConfetti, setShowConfetti] = useState(false);

  const prevStateRef = useRef<GameState | null>(null);
  const movesRef = useRef<HTMLDivElement>(null);
  const joined = useRef(false);

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Draw offer state
  const [drawOfferPending, setDrawOfferPending] = useState(false);
  const [drawOfferReceived, setDrawOfferReceived] = useState(false);
  const [drawOfferFrom, setDrawOfferFrom] = useState<string>('');

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

  // Auto-scroll chat messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages]);

  // Reset draw offer state when game ends
  useEffect(() => {
    if (roomState.phase === 'over') {
      setDrawOfferPending(false);
      setDrawOfferReceived(false);
      setDrawOfferFrom('');
    }
  }, [roomState.phase]);

  useEffect(() => {
    if (roomState.gameState?.variantId === 'numerical_ttt') {
      const state = roomState.gameState as NumericalTTTState;
      const available = state.currentPlayer === 'X' ? state.availableOdds : state.availableEvens;
      if (!available.includes(Number(placingAs)) && available.length > 0) {
        setPlacingAs(available[0]!);
      }
    }
  }, [roomState.gameState, placingAs]);

  // Auto-fix placingAs for SOS variant — default 'X' is invalid, must be 'S' or 'O'
  useEffect(() => {
    const v = roomState.gameState?.variantId;
    if (v === 'sos_ttt' && placingAs !== 'S' && placingAs !== 'O') {
      setPlacingAs('S');
    }
  }, [roomState.gameState, placingAs]);

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
    const savedMatchmaking = sessionStorage.getItem(`room:${code}:isMatchmaking`) === 'true';

    if (savedMatchmaking) {
      setIsMatchmaking(true);
      sessionStorage.removeItem(`room:${code}:isMatchmaking`);
    }

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
      // Sound + confetti on game over
      var isWin = mySymbol && mySymbol === data.winner;
      var isDraw = data.winner === null;
      if (isWin) sound.play('win');
      else if (isDraw) sound.play('draw');
      else sound.play('lose');
      if (isWin) setTimeout(function(){setShowConfetti(false)},3000);
    }
    function onGameReconnect(data: { gameState: GameState; myPlayerIndex: 0 | 1; players: PlayerInfo[] }) {
      dispatch({ type: 'SET_MY_INDEX', playerIndex: data.myPlayerIndex, players: data.players });
      dispatch({ type: 'GAME_STARTED', gameState: data.gameState, players: data.players });
    }
    function onError(data: { message: string }) {
      dispatch({ type: 'ERROR', message: data.message });
      sound.play('error');
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
    function onChatMessage(data: { guestId: string; displayName: string; message: string; timestamp: number }) {
      setChatMessages(prev => [...prev, {
        ...data,
        isMe: data.guestId === guest?.guestId
      }]);
    }
    function onDrawOffered(data: { fromGuestId: string; fromDisplayName: string }) {
      if (data.fromGuestId !== guest?.guestId) {
        setDrawOfferReceived(true);
        setDrawOfferFrom(data.fromDisplayName);
      }
    }
    function onDrawOfferSent() {
      setDrawOfferPending(true);
    }
    function onDrawDeclined() {
      setDrawOfferPending(false);
      setDrawOfferReceived(false);
      setDrawOfferFrom('');
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
    socket.on('chat:message', onChatMessage);
    socket.on('draw:offered', onDrawOffered);
    socket.on('draw:offer_sent', onDrawOfferSent);
    socket.on('draw:declined', onDrawDeclined);

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
      socket.off('chat:message', onChatMessage);
      socket.off('draw:offered', onDrawOffered);
      socket.off('draw:offer_sent', onDrawOfferSent);
      socket.off('draw:declined', onDrawDeclined);
      socket.off('game:spectator_sync', onSpectatorSync);
    };
  }, [socket, guest]);

  const handleMove = useCallback(
    (boardIndex: number, cellIndex: number) => {
      if (!roomState.gameState) return;
      const moveData =
        roomState.gameState.variantId === 'ultimate_ttt' ? { roomCode: code, boardIndex, cellIndex } :
        (roomState.gameState.variantId === 'wild_ttt' || roomState.gameState.variantId === 'sos_ttt' || roomState.gameState.variantId === 'order_chaos') ? { roomCode: code, boardIndex, cellIndex, symbol: placingAs } :
        roomState.gameState.variantId === 'numerical_ttt' ? { roomCode: code, boardIndex, cellIndex, numberPlaced: typeof placingAs === 'number' ? placingAs : Number(placingAs) } :
        { roomCode: code, boardIndex, cellIndex };

      socket.emit('game:move', moveData);
      sound.play('move');
    },
    [socket, code, roomState.gameState, placingAs]
  );

  const handleTacticToeMove = useCallback((globalIndex: number) => {
    if (!roomState.gameState || roomState.gameState.variantId !== 'tactic_toe') return;
    const state = roomState.gameState as TacticToeState;
    if (tacticToeMode === 'place') {
      socket.emit('game:move', { roomCode: code, tacticType: 'place', tacticCellIndex: globalIndex, boardIndex: 0, cellIndex: globalIndex });
      setTacticToeMode('place');
      setTacticToeSelectedObstacle(null);
    } else {
      if (tacticToeSelectedObstacle === null) {
        if (state.board[globalIndex] === 'B') {
          setTacticToeSelectedObstacle(globalIndex);
        }
      } else {
        if (state.board[globalIndex] === null) {
          socket.emit('game:move', { roomCode: code, tacticType: 'move_obstacle', fromCell: tacticToeSelectedObstacle, toCell: globalIndex, boardIndex: 0, cellIndex: globalIndex });
          setTacticToeSelectedObstacle(null);
          setTacticToeMode('place');
        } else if (state.board[globalIndex] === 'B') {
          setTacticToeSelectedObstacle(globalIndex);
        } else {
          setTacticToeSelectedObstacle(null);
        }
      }
    }
  }, [socket, code, roomState.gameState, tacticToeMode, tacticToeSelectedObstacle]);

  const handleGarrisonHandClick = useCallback((pieceId: string) => {
    if (!roomState.gameState || !isMyTurn) return;
    const s = roomState.gameState as GarrisonState;
    if (garrisonSelectedPiece === pieceId) { setGarrisonSelectedPiece(null); setGarrisonLegalDests([]); return; }
    const occupied = new Set(s.pieces.filter(p => p.square >= 0 && !p.captured).map(p => p.square));
    const dests: number[] = [];
    for (let i = 0; i < 64; i++) { if (!occupied.has(i)) dests.push(i); }
    setGarrisonSelectedPiece(pieceId);
    setGarrisonLegalDests(dests);
  }, [roomState.gameState, isMyTurn, garrisonSelectedPiece]);

  const handleGarrisonSquareClick = useCallback((square: number, pieceId: string | null) => {
    if (!roomState.gameState || !isMyTurn) return;
    const s = roomState.gameState as GarrisonState;

    if (garrisonSelectedPiece === null) {
      if (pieceId) {
        const piece = s.pieces.find(p => p.id === pieceId);
        if (piece && piece.player === mySymbol && piece.square >= 0) {
          const dests = garrisonEngine.getLegalMoves(s)
            .map(m => m.data as GarrisonMove)
            .filter(m => m.pieceId === pieceId)
            .map(m => m.to);
          setGarrisonSelectedPiece(pieceId);
          setGarrisonLegalDests(dests);
        }
      }
      return;
    }

    // Deselect if clicked same square with no valid dest info
    if (!garrisonLegalDests.includes(square)) {
      if (pieceId) {
        const piece = s.pieces.find(p => p.id === pieceId);
        if (piece && piece.player === mySymbol && piece.square >= 0) {
          setGarrisonSelectedPiece(pieceId);
          setGarrisonLegalDests([]);
          return;
        }
      }
      setGarrisonSelectedPiece(null);
      setGarrisonLegalDests([]);
      return;
    }

    const selectedPiece = s.pieces.find(p => p.id === garrisonSelectedPiece)!;
    const movePayload = selectedPiece.square === -1
      ? { roomCode: code, garrisonType: 'place' as const, garrisonPieceId: garrisonSelectedPiece, garrisonTo: square }
      : { roomCode: code, garrisonType: 'move' as const, garrisonPieceId: garrisonSelectedPiece, garrisonFrom: selectedPiece.square, garrisonTo: square };

    socket.emit('game:move', movePayload);
    setGarrisonSelectedPiece(null);
    setGarrisonLegalDests([]);
  }, [roomState.gameState, isMyTurn, garrisonSelectedPiece, garrisonLegalDests, mySymbol, socket, code]);

  const handleSendChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim() || roomState.phase !== 'playing') return;
    socket.emit('chat:send', { roomCode: code, message: chatInput.trim() });
    setChatInput('');
  }, [socket, code, chatInput, roomState.phase]);

  const handleDrawOffer = useCallback(() => {
    if (roomState.phase !== 'playing') return;
    socket.emit('draw:offer', { roomCode: code });
  }, [socket, code, roomState.phase]);

  const handleDrawResponse = useCallback((accepted: boolean) => {
    socket.emit('draw:respond', { roomCode: code, accepted });
    setDrawOfferReceived(false);
    setDrawOfferFrom('');
  }, [socket, code]);

  const handleForfeit = useCallback(() => {
    if (roomState.phase !== 'playing') return;
    if (confirm('Are you sure you want to forfeit? You will lose the game.')) {
      socket.emit('game:forfeit', { roomCode: code });
    }
  }, [socket, code, roomState.phase]);

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const gameOverClass = roomState.winner === mySymbol
    ? styles.win
    : roomState.winner === null
    ? styles.draw
    : styles.lose;

  const moveRows = formatMoveRows(moveHistory);

  return (
    <> 
      <VictoryConfetti active={showConfetti} />
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
          {!isMatchmaking && (
            <>
              <p className={styles.waitingCode}>{code}</p>
              <p className={styles.waitingHint}>Share this code or scan the QR to join instantly.</p>
              <CopyButton text={shareUrl} />
              <div className={styles.qrCodeWrapper}>
                <QRCodeSVG value={shareUrl} size={160} />
              </div>
            </>
          )}
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

            {/* Chat Panel */}
            <div className={styles.panel}>
              <div className={styles.panelHeader}>Chat</div>
              <div className={styles.chatMessages}>
                {chatMessages.length === 0 ? (
                  <div className={styles.emptyMoves}>No messages yet</div>
                ) : (
                  chatMessages.map((msg, idx) => (
                    <div key={idx} className={`${styles.chatMessage} ${msg.isMe ? styles.chatMe : ''}`}>
                      <span className={styles.chatSender}>{msg.isMe ? 'You' : msg.displayName}:</span>
                      <span className={styles.chatText}>{msg.message}</span>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>
              <form onSubmit={handleSendChat} className={styles.chatForm}>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder={roomState.phase === 'playing' ? 'Type a message...' : 'Game not active'}
                  disabled={roomState.phase !== 'playing'}
                  className={styles.chatInput}
                  maxLength={500}
                />
                <button type="submit" disabled={!chatInput.trim() || roomState.phase !== 'playing'} className={styles.chatSend}>
                  Send
                </button>
              </form>
            </div>
          </div>

          <div className={styles.mainBoard}>
            {roomState.phase === 'playing' && (
              <p className={styles.turnBanner}>
                {roomState.gameState!.variantId === 'notakto_ttt'
                  ? (isMyTurn ? 'Your turn' : "Opponent's turn")
                  : (isMyTurn ? 'Your turn' : "Opponent's turn")}
              </p>
            )}

            {roomState.phase === 'playing' && (roomState.gameState!.variantId === 'wild_ttt' || roomState.gameState!.variantId === 'sos_ttt' || roomState.gameState!.variantId === 'order_chaos') && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>Place as:</span>
                <button
                  className={`${styles.wildBtn} ${styles.x} ${placingAs === (roomState.gameState!.variantId === 'sos_ttt' ? 'S' : 'X') ? styles.active : ''}`}
                  onClick={() => setPlacingAs(roomState.gameState!.variantId === 'sos_ttt' ? 'S' : 'X')}
                >
                  {roomState.gameState!.variantId === 'sos_ttt' ? 'S' : 'X'}
                </button>
                <button
                  className={`${styles.wildBtn} ${styles.o} ${placingAs === 'O' ? styles.active : ''}`}
                  onClick={() => setPlacingAs('O')}
                >
                  O
                </button>
              </div>
            )}
            {roomState.phase === 'playing' && roomState.gameState!.variantId === 'numerical_ttt' && roomState.gameState && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>
                  {roomState.gameState!.currentPlayer === 'X' ? 'Available Odds:' : 'Available Evens:'}
                </span>
                { ((roomState.gameState as NumericalTTTState)[roomState.gameState!.currentPlayer === 'X' ? 'availableOdds' : 'availableEvens']).map(num => (
                  <button
                    key={num}
                    className={`${styles.wildBtn} ${styles.x} ${placingAs === num ? styles.active : ''}`}
                    onClick={() => setPlacingAs(num)}
                  >
                    {num}
                  </button>
                )) }
              </div>
            )}

            {roomState.phase === 'playing' && roomState.gameState!.variantId === 'tactic_toe' && (
              <div className={styles.wildPicker}>
                <span className={styles.wildPickerLabel}>Turn action:</span>
                <button
                  className={`${styles.wildBtn} ${styles.x} ${tacticToeMode === 'place' ? styles.active : ''}`}
                  onClick={() => { setTacticToeMode('place'); setTacticToeSelectedObstacle(null); }}
                  style={{ width: 'auto', padding: '0 var(--space-3)', fontSize: '14px' }}
                >
                  Place Mark
                </button>
                <button
                  className={`${styles.wildBtn} ${styles.o} ${tacticToeMode === 'move_obstacle' ? styles.active : ''}`}
                  onClick={() => setTacticToeMode('move_obstacle')}
                  style={{ width: 'auto', padding: '0 var(--space-3)', fontSize: '14px' }}
                >
                  Move Obstacle
                </button>
              </div>
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
              {roomState.gameState!.variantId === 'ultimate_ttt' ? (
                <UltimateBoard
                  boards={(roomState.gameState as UltimateTTTState).boards}
                  boardResults={(roomState.gameState as UltimateTTTState).boardResults}
                  nextBoardConstraint={(roomState.gameState as UltimateTTTState).nextBoardConstraint}
                  currentPlayer={roomState.gameState!.currentPlayer}
                  disabled={!isMyTurn}
                  onMove={handleMove}
                  winCells={(() => {
                    const s = roomState.gameState as UltimateTTTState;
                    if (s.terminal?.reason !== 'win') return [];
                    const metaBoard = s.boardResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null);
                    return getWinCells(metaBoard) ?? [];
                  })()}
                />
              ) : roomState.gameState!.variantId === 'ttt_3d' ? (
                <ThreeDBoard
                  board={(roomState.gameState as TTT3DState).board}
                  currentPlayer={roomState.gameState!.currentPlayer}
                  disabled={!isMyTurn}
                  onMove={(boardIndex, cellIndex) => handleMove(0, boardIndex * 9 + cellIndex)}
                  winCells={(() => {
                    const s = roomState.gameState as TTT3DState;
                    return s.terminal?.reason === 'win' ? (getWinCells3D(s.board) ?? []) : [];
                  })()}
                />
              ) : roomState.gameState!.variantId === 'ttt_4d' ? (
                <FourDBoard
                  board={(roomState.gameState as TTT4DState).board}
                  currentPlayer={roomState.gameState!.currentPlayer}
                  disabled={!isMyTurn}
                  onMove={(boardIndex, cellIndex) => handleMove(0, boardIndex * 9 + cellIndex)}
                  winCells={(() => {
                    const s = roomState.gameState as TTT4DState;
                    return s.terminal?.reason === 'win' ? (getWinCells4D(s.board) ?? []) : [];
                  })()}
                />
              ) : roomState.gameState!.variantId === 'ultimate_3d' ? (
                <Ultimate3DBoard
                  microBoards={(roomState.gameState as Ultimate3DState).microBoards}
                  macroResults={(roomState.gameState as Ultimate3DState).macroResults}
                  nextMacroConstraint={(roomState.gameState as Ultimate3DState).nextMacroConstraint}
                  currentPlayer={roomState.gameState!.currentPlayer}
                  disabled={!isMyTurn}
                  onMove={handleMove}
                  winCells={(() => {
                    const s = roomState.gameState as Ultimate3DState;
                    if (s.terminal?.reason !== 'win') return [];
                    const macroBoard = s.macroResults.map(r => r === 'X' ? 'X' : r === 'O' ? 'O' : null) as Board;
                    return getWinCells3D(macroBoard) ?? [];
                  })()}
                />
              ) : roomState.gameState!.variantId === 'tactic_toe' ? (
                <TacticToeBoard
                  board={(roomState.gameState as TacticToeState).board}
                  currentPlayer={roomState.gameState!.currentPlayer}
                  disabled={!isMyTurn}
                  moveMode={tacticToeMode}
                  selectedObstacle={tacticToeSelectedObstacle}
                  onCellClick={handleTacticToeMove}
                  winCells={(() => {
                    const s = roomState.gameState as TacticToeState;
                    return s.terminal?.reason === 'win' ? (getWinCells3D(s.board) ?? []) : [];
                  })()}
                />
              ) : roomState.gameState!.variantId === 'order_chaos' ? (
                <GridBoard
                  board={(roomState.gameState as OrderChaosState).board}
                  cols={6}
                  rows={6}
                  currentPlayer={roomState.gameState!.currentPlayer}
                  disabled={!isMyTurn}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={(() => {
                    const s = roomState.gameState as OrderChaosState;
                    return s.terminal?.reason === 'win' ? (getWinCells6x6(s.board) ?? []) : [];
                  })()}
                />
              ) : roomState.gameState!.variantId === 'garrison' ? (
                <GarrisonBoard
                  state={roomState.gameState as GarrisonState}
                  disabled={!isMyTurn}
                  selectedPieceId={isMyTurn ? garrisonSelectedPiece : null}
                  legalDestinations={isMyTurn ? garrisonLegalDests : []}
                  onHandPieceClick={handleGarrisonHandClick}
                  onBoardSquareClick={handleGarrisonSquareClick}
                  winSquares={
                    (roomState.gameState as GarrisonState).terminal?.winner
                      ? (checkFiveInARow((roomState.gameState as GarrisonState).terminal!.winner!, (roomState.gameState as GarrisonState).pieces) ?? [])
                      : []
                  }
                />
              ) : roomState.gameState!.variantId === 'gomoku' ? (
                <GridBoard
                  board={(roomState.gameState as GomokuState).board}
                  cols={15}
                  rows={15}
                  currentPlayer={roomState.gameState!.currentPlayer as 'X' | 'O'}
                  disabled={!isMyTurn}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={(() => {
                    const s = roomState.gameState as GomokuState;
                    return (s as any).terminal?.reason === 'win' ? (getGomokuWinCells(s.board) ?? []) : [];
                  })()}
                />
              ) : roomState.gameState!.variantId === 'sos_ttt' ? (
                <GridBoard
                  board={(roomState.gameState as SOSTTTState).board}
                  cols={8}
                  rows={8}
                  currentPlayer={roomState.gameState!.currentPlayer as 'X' | 'O'}
                  disabled={!isMyTurn}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={[]}
                />
              ) : (
                <StandardBoard
                  board={(roomState.gameState as StandardTTTState).board}
                  currentPlayer={roomState.gameState!.currentPlayer}
                  disabled={!isMyTurn}
                  onMove={(_, cellIndex) => handleMove(0, cellIndex)}
                  winCells={(() => {
                    const s = roomState.gameState as any;
                    return s.terminal?.reason === 'win' && s.board ? (getWinCells(s.board) ?? []) : [];
                  })()}
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
                    const isNotakto = roomState.gameState?.variantId === 'notakto_ttt';
                    return (
                      <div key={p.playerIndex} className={`${styles.playerCard} ${isActive ? styles.active : ''}`}>
                        <span className={styles.playerSymbol} style={{ color: sym === 'X' ? 'var(--mark-x)' : 'var(--mark-o)' }}>
                          {isNotakto ? 'X' : sym}
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

            {/* Game Actions */}
            {roomState.phase === 'playing' && (
              <div className={styles.panel}>
                <div className={styles.panelHeader}>Actions</div>
                <div className={styles.panelContent}>
                  {drawOfferReceived ? (
                    <div className={styles.drawOfferBox}>
                      <p>{drawOfferFrom} offers a draw!</p>
                      <div className={styles.drawOfferButtons}>
                        <Button variant="primary" size="sm" onClick={() => handleDrawResponse(true)}>Accept</Button>
                        <Button variant="ghost" size="sm" onClick={() => handleDrawResponse(false)}>Decline</Button>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.gameActions}>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        onClick={handleDrawOffer} 
                        disabled={drawOfferPending}
                        full
                      >
                        {drawOfferPending ? 'Draw Offered' : 'Offer Draw'}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={handleForfeit} 
                        full
                      >
                        Forfeit
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}
            
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
    </>
  );
}
