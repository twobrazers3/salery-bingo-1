import { io, Socket } from 'socket.io-client';
import { BingoCardModel } from '../types';
import { isStaticFrontendUrl, PRIMARY_LIVE_BACKEND } from './api';

export interface BingoRoomSnapshot {
  gameId: string;
  stake: number;
  status: 'waiting' | 'in_progress' | 'finished';
  startsAt: number;
  called: number[];
  prizePool: number;
  playerCount: number;
  players: Array<{ name: string; cardsCount: number; isOnline?: boolean }>;
  winnerId?: string;
  winnerName?: string;
  winningCardId?: number;
  prize?: number;
}

export interface BingoJoinResult {
  ok: boolean;
  error?: string;
  state?: BingoRoomSnapshot;
  cards?: BingoCardModel[];
  balance?: number;
  mainWallet?: number;
  playWallet?: number;
  duplicate?: boolean;
}

export interface BingoClaimResult {
  ok: boolean;
  error?: string;
  state?: BingoRoomSnapshot;
  balance?: number;
  mainWallet?: number;
  playWallet?: number;
  win?: {
    hasWon: boolean;
    patternName: string;
    winningCoordinates: Array<{ row: number; col: number }>;
    multiplier: number;
  };
}

export type BingoSocket = Socket;

function getSocketBackendUrl() {
  if (typeof window !== 'undefined') {
    const envBackend = (import.meta as any).env?.VITE_SERVER_URL || (import.meta as any).env?.VITE_BACKEND_URL;
    if (envBackend && typeof envBackend === 'string' && envBackend.startsWith('http')) {
      return envBackend.replace(/\/$/, '');
    }

    const qp = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(window.location.hash.slice(1));
    const explicitUrl =
      qp.get('backend') ||
      hashParams.get('backend') ||
      localStorage.getItem('salery_bingo_backend_url') ||
      '';

    if (explicitUrl.startsWith('http')) {
      return explicitUrl.replace(/\/$/, '');
    }

    if (isStaticFrontendUrl(window.location.origin)) {
      return PRIMARY_LIVE_BACKEND;
    }

    return window.location.origin;
  }

  return PRIMARY_LIVE_BACKEND;
}

export function connectBingoSocket(initData: string): BingoSocket {
  const safeInitData = initData || (() => {
    if (typeof window === 'undefined') return '';
    const existing = localStorage.getItem('salery_bingo_mock_tg_id');
    const nextId = existing && !Number.isNaN(Number(existing)) ? String(existing) : String(Math.floor(100000000 + Math.random() * 900000000));
    localStorage.setItem('salery_bingo_mock_tg_id', nextId);
    return `mock:${nextId}`;
  })();

  return io(getSocketBackendUrl(), {
    auth: { initData: safeInitData },
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 15,
    reconnectionDelay: 1000,
    transports: ['websocket', 'polling'],
  });
}

export function emitBingoWithAck<T>(
  socket: BingoSocket,
  event: string,
  payload?: unknown
): Promise<T> {
  return new Promise((resolve, reject) => {
    socket.timeout(10_000).emit(event, payload, (error: Error | null, result: T) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}
