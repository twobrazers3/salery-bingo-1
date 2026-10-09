import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BingoBall,
  BingoCardModel,
  CompetitorPlayer,
  GameSettings,
  GameStatus,
  UserProfile,
  WinValidationResult
} from './types';
import {
  generateBingoCard,
  generateCartelaByNumber,
  checkCardWinningPatterns,
  calculateNumbersNeeded,
  generateCompetitors,
  getLetterForNumber,
  getGlobalBingoCycle,
  getDeterministicRoundDeck
} from './utils/bingoLogic';
import { sounds } from './utils/audio';
import { translations } from './utils/translations';
import { Header } from './components/Header';
import { CallerBoard } from './components/CallerBoard';
import { BingoCardView } from './components/BingoCardView';
import { GameControls } from './components/GameControls';
import { CompetitorList } from './components/CompetitorList';
import { WinModal } from './components/WinModal';
import { RulesModal } from './components/RulesModal';
import { StatsModal } from './components/StatsModal';
import { LobbyView } from './components/LobbyView';
import { CartelaSelectionView } from './components/CartelaSelectionView';
import { GamePlayView } from './components/GamePlayView';
import { BottomNav, NavTab } from './components/BottomNav';
import { ScoresView } from './components/ScoresView';
import { HistoryView, GameHistoryItem } from './components/HistoryView';
import { WalletView } from './components/WalletView';
import { ProfileView } from './components/ProfileView';
import { AdminPanelView } from './components/AdminPanelView';
import { BannedUserView } from './components/BannedUserView';
import { AlertCircle, ArrowLeft, Flame } from 'lucide-react';
import { fetchUserProfile, fetchPlayerGameHistory, logGameHistory, syncUserRegistration, subscribeToSupabaseTable } from './utils/api';
import { BingoRoomSnapshot, BingoSocket, connectBingoSocket, emitBingoWithAck, BingoJoinResult, BingoClaimResult } from './utils/bingoSocket';

const STORAGE_KEY = 'salery_bingo_user_profile';
const HISTORY_KEY = 'salery_bingo_game_history';

export function checkIsAdminRoute(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const rawPath = window.location.pathname || '';
    const cleanPath = rawPath.toLowerCase().replace(/\/+$/, '');
    const rawHash = (window.location.hash || '').toLowerCase();
    const href = (window.location.href || '').toLowerCase();
    const params = new URLSearchParams(window.location.search || '');

    if (
      href.includes('view=admin') ||
      href.includes('/admin') ||
      href.includes('#admin') ||
      href.includes('tab=admin') ||
      href.includes('panel=admin') ||
      href.includes('admin=true') ||
      href.includes('admin=1')
    ) {
      return true;
    }

    if (
      cleanPath === '/admin' ||
      cleanPath.startsWith('/admin/') ||
      cleanPath.endsWith('/admin')
    ) {
      return true;
    }

    if (
      rawHash === '#admin' ||
      rawHash === '#/admin' ||
      rawHash.startsWith('#admin') ||
      rawHash.startsWith('#/admin') ||
      rawHash.includes('admin')
    ) {
      return true;
    }

    if (
      params.get('admin') === 'true' ||
      params.get('admin') === '1' ||
      params.get('view') === 'admin' ||
      params.get('tab') === 'admin' ||
      params.get('panel') === 'admin'
    ) {
      return true;
    }
  } catch {}
  return false;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('game');
  const [showAdminPanel, setShowAdminPanel] = useState(() => checkIsAdminRoute());

  // Listen to popstate to toggle admin view on hash change
  useEffect(() => {
    const handleHashChange = () => {
      setShowAdminPanel(checkIsAdminRoute());
    };
    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('popstate', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('popstate', handleHashChange);
    };
  }, []);

  const handleOpenAdminPanel = () => {
    sounds.playBeep(true);
    setShowAdminPanel(true);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '#admin');
    }
  };

  const handleCloseAdminPanel = () => {
    sounds.playBeep(false);
    setShowAdminPanel(false);
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', '#');
    }
  };

  // 1. User Account State (Loaded from localStorage or initialized with persistent unique ID)
  const [user, setUser] = useState<UserProfile>(() => {
    let persistentId = 1000000001;
    if (typeof window !== 'undefined') {
      const storedMockId = localStorage.getItem('salery_bingo_mock_tg_id') || localStorage.getItem('salery_bingo_unique_id');
      if (storedMockId && !Number.isNaN(Number(storedMockId))) {
        persistentId = Number(storedMockId);
      } else {
        persistentId = Math.floor(100000000 + Math.random() * 900000000);
        localStorage.setItem('salery_bingo_unique_id', String(persistentId));
        localStorage.setItem('salery_bingo_mock_tg_id', String(persistentId));
      }
    }

    const defaultPlayerCode = `SB-${((Math.abs(persistentId) * 17) % 90000) + 10000}`;

    let initialProfile: UserProfile = {
      telegramId: persistentId,
      firstName: 'Player',
      username: `player_${String(persistentId).slice(-4)}`,
      playerCode: defaultPlayerCode,
      phoneNumber: '',
      balance: 100,
      mainWallet: 100,
      playWallet: 10, // Register Bonus
      role: 'user',
      status: 'active',
      is_blocked: false,
      totalGames: 0,
      totalWins: 0,
      totalWonAmount: 0
    };

    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        initialProfile = {
          ...initialProfile,
          ...parsed,
          playerCode: parsed.playerCode || defaultPlayerCode,
          balance: parsed.mainWallet ?? parsed.balance ?? 100,
          mainWallet: parsed.mainWallet ?? parsed.balance ?? 100,
          playWallet: parsed.playWallet ?? 10
        };
      } catch {}
    }
    return initialProfile;
  });

  const [isRefreshingBalance, setIsRefreshingBalance] = useState(false);

  // Fetch updated user stats and game history from PostgreSQL or Supabase
  const refreshUserData = useCallback(async (targetId?: number) => {
    const fetchId = targetId || user.telegramId;
    if (!fetchId) return;
    setIsRefreshingBalance(true);
    try {
      const res = await fetchUserProfile(fetchId);
      if (res && res.ok) {
        const pCode = res.user?.playerCode || ('SB-' + (((Math.abs(Number(fetchId)) * 17) % 90000) + 10000));
        setUser((prev) => ({
          ...prev,
          telegramId: Number(fetchId),
          balance: res.balance,
          mainWallet: res.mainWallet ?? res.balance,
          playWallet: res.playWallet ?? prev.playWallet ?? 0,
          phoneNumber: res.phoneNumber || prev.phoneNumber,
          firstName: res.user?.firstName || prev.firstName,
          username: res.user?.username || prev.username,
          playerCode: pCode,
          role: res.user?.role || prev.role,
          status: res.status || (res.isBlocked ? 'blocked' : 'active'),
          is_blocked: res.isBlocked || false,
          ban_reason: res.ban_reason,
        }));
      }

      // Sync game history from server
      const historyRes = await fetchPlayerGameHistory(fetchId);
      if (historyRes && historyRes.ok && Array.isArray(historyRes.history) && historyRes.history.length > 0) {
        setHistory((prevHistory) => {
          const map = new Map<string, GameHistoryItem>();
          historyRes.history.forEach((h: any) => {
            const item: GameHistoryItem = {
              id: h.id || `gm-${h.timestamp}`,
              timestamp: typeof h.timestamp === 'number' ? h.timestamp : new Date(h.created_at || h.timestamp).getTime(),
              stake: Number(h.stake) || 10,
              cardsCount: Number(h.cards_count || h.cardsCount) || 1,
              result: h.result === 'won' ? 'won' : 'lost',
              wonAmount: Number(h.won_amount || h.wonAmount) || 0,
              patternName: h.pattern_name || h.patternName || '1 Line',
              gameCode: h.game_code || h.gameCode,
              totalPrize: Number(h.total_prize || h.totalPrize) || Number(h.won_amount || h.wonAmount) || 0,
              winnersCount: 1,
            };
            map.set(item.id, item);
          });
          prevHistory.forEach((item) => map.set(item.id, item));
          return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
        });
      }
    } finally {
      setIsRefreshingBalance(false);
    }
  }, [user.telegramId]);

  const bootstrappedRef = useRef(false);
  const telegramInitDataRef = useRef('');

  // Initial user extraction and Supabase fetch with retries
  useEffect(() => {
    if (bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    const detectAndFetchUser = () => {
      let resolvedId: number | null = null;
      let resolvedFirstName = '';
      let resolvedUsername = '';

      if (typeof window !== 'undefined') {
        const params = new URLSearchParams(window.location.search);
        const qId =
          params.get('user_id') ||
          params.get('id') ||
          params.get('telegram_id') ||
          params.get('tgWebAppStartParam');
        if (qId && !isNaN(Number(qId)) && Number(qId) !== 1234567) {
          resolvedId = Number(qId);
        }

        const tg = (window as any).Telegram?.WebApp;
        if (tg) {
          if (typeof tg.initData === 'string') telegramInitDataRef.current = tg.initData;
          try {
            tg.ready();
            tg.expand();
          } catch {}
          if (tg.initDataUnsafe?.user?.id) {
            resolvedId = tg.initDataUnsafe.user.id;
            resolvedFirstName = tg.initDataUnsafe.user.first_name || '';
            resolvedUsername = tg.initDataUnsafe.user.username || '';
          }
        }

        if (!resolvedId && window.location.hash) {
          try {
            const hashParams = new URLSearchParams(window.location.hash.slice(1));
            const tgData = hashParams.get('tgWebAppData');
            if (tgData) {
              telegramInitDataRef.current = tgData;
              const parsed = new URLSearchParams(tgData);
              const uStr = parsed.get('user');
              if (uStr) {
                const u = JSON.parse(uStr);
                if (u.id) {
                  resolvedId = Number(u.id);
                  resolvedFirstName = u.first_name || '';
                  resolvedUsername = u.username || '';
                }
              }
            }
          } catch {}
        }
      }

      const finalId = resolvedId || user.telegramId;
      const finalFirstName = resolvedFirstName || user.firstName;
      const finalUsername = resolvedUsername || user.username;
      const finalPlayerCode = user.playerCode || (`SB-${((Math.abs(Number(finalId)) * 17) % 90000) + 10000}`);

      const syncedUser = {
        ...user,
        telegramId: finalId,
        firstName: finalFirstName,
        username: finalUsername,
        playerCode: finalPlayerCode,
      };

      setUser(syncedUser);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(syncedUser));

      // Register and load balance from server database
      void syncUserRegistration(syncedUser).then((res) => {
        if (res && res.ok) {
          const r = res as any;
          const assignedCode = r.user?.playerCode || r.user?.player_code || finalPlayerCode;
          setUser((prev) => ({
            ...prev,
            balance: r.balance,
            mainWallet: r.mainWallet ?? r.balance,
            playWallet: r.playWallet ?? prev.playWallet ?? 0,
            phoneNumber: r.phoneNumber || prev.phoneNumber,
            role: r.user?.role || prev.role,
            playerCode: assignedCode,
            status: r.status || (r.isBlocked ? 'blocked' : 'active'),
            is_blocked: r.isBlocked || false,
            ban_reason: r.ban_reason,
          }));

          // Fetch real server game history on start
          void fetchPlayerGameHistory(finalId).then((historyRes) => {
            if (historyRes && historyRes.ok && Array.isArray(historyRes.history) && historyRes.history.length > 0) {
              setHistory((prevHistory) => {
                const map = new Map<string, GameHistoryItem>();
                historyRes.history.forEach((h: any) => {
                  const item: GameHistoryItem = {
                    id: h.id || `gm-${h.timestamp}`,
                    timestamp: typeof h.timestamp === 'number' ? h.timestamp : new Date(h.created_at || h.timestamp).getTime(),
                    stake: Number(h.stake) || 10,
                    cardsCount: Number(h.cards_count || h.cardsCount) || 1,
                    result: h.result === 'won' ? 'won' : 'lost',
                    wonAmount: Number(h.won_amount || h.wonAmount) || 0,
                    patternName: h.pattern_name || h.patternName || '1 Line',
                    gameCode: h.game_code || h.gameCode,
                    totalPrize: Number(h.total_prize || h.totalPrize) || Number(h.won_amount || h.wonAmount) || 0,
                    winnersCount: 1,
                  };
                  map.set(item.id, item);
                });
                prevHistory.forEach((item) => map.set(item.id, item));
                return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
              });
            }
          });
        }
      });
    };

    detectAndFetchUser();
  }, []);

  // Sync Supabase status changes in real-time
  useEffect(() => {
    if (!user.telegramId) return;
    const unsub = subscribeToSupabaseTable('users', (payload) => {
      const record = payload.new;
      if (record && Number(record.telegram_id) === Number(user.telegramId)) {
        setUser((prev) => ({
          ...prev,
          balance: record.balance,
          mainWallet: record.main_wallet ?? record.balance,
          playWallet: record.play_wallet ?? prev.playWallet ?? 0,
          phoneNumber: record.phone_number || prev.phoneNumber,
          firstName: record.first_name || prev.firstName,
          username: record.username || prev.username,
          status: record.status || 'active',
          is_blocked: record.status === 'blocked',
          ban_reason: record.ban_reason,
        }));
      }
    });
    return () => {
      unsub();
    };
  }, [user.telegramId]);

  // 2. Game History State
  const [history, setHistory] = useState<GameHistoryItem[]>(() => {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {}
    }
    return [];
  });

  // Save profile and history changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  // 3. Game Settings
  const [settings, setSettings] = useState<GameSettings>({
    autoDaub: true,
    soundEnabled: true,
    voiceEnabled: true,
    callSpeedMs: 3000,
    selectedStake: 10, // Default to 10 as shown in screenshot
    cardsCount: 2,
    language: 'am'
  });

  // Sync sounds singleton with settings
  useEffect(() => {
    sounds.soundEnabled = settings.soundEnabled;
    sounds.voiceEnabled = settings.voiceEnabled;
  }, [settings.soundEnabled, settings.voiceEnabled]);

  // 4. Game Engine State
  const [status, setStatus] = useState<GameStatus>('idle');
  const [countdown, setCountdown] = useState<number>(3);
  const [currentBall, setCurrentBall] = useState<BingoBall | null>(null);
  const [calledBalls, setCalledBalls] = useState<BingoBall[]>([]);
  const [calledSet, setCalledSet] = useState<Set<number>>(new Set());
  const [cards, setCards] = useState<BingoCardModel[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorPlayer[]>([]);
  const [activeRoomPlayers, setActiveRoomPlayers] = useState<number>(0);
  const [activeRoomCartelas, setActiveRoomCartelas] = useState<number>(0);
  const [prizePool, setPrizePool] = useState<number>(0);
  const [activeGameId, setActiveGameId] = useState('');
  const [roomStartsAt, setRoomStartsAt] = useState<number>(0);
  const [roomPlayers, setRoomPlayers] = useState<Array<{ name: string; cardsCount: number; isOnline?: boolean }>>([]);

  // 5. Modals State
  const [showWinModal, setShowWinModal] = useState(false);
  const [winResult, setWinResult] = useState<WinValidationResult | null>(null);
  const [wonAmount, setWonAmount] = useState(0);
  const [rulesModalOpen, setRulesModalOpen] = useState(false);
  const [statsModalOpen, setStatsModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [winnerInfo, setWinnerInfo] = useState<{
    winnerId?: string;
    winnerName?: string;
    cardId?: number;
    prize?: number;
    isMe?: boolean;
  } | null>(null);
  const claimInFlightRef = useRef(false);
  const lastProcessedWinnerGameIdRef = useRef<string | null>(null);

  const t = translations[settings.language];
  const [socketInstance, setSocketInstance] = useState<BingoSocket | null>(null);
  const gameSocketRef = useRef<BingoSocket | null>(null);
  const activeRoomRequestedRef = useRef<boolean>(
    typeof window !== 'undefined' ? localStorage.getItem('salery_bingo_active_room_requested') === 'true' : false
  );
  const hasJoinedRoomOnceRef = useRef<boolean>(
    typeof window !== 'undefined' ? localStorage.getItem('salery_bingo_has_joined_room_once') === 'true' : false
  );
  const roomCardIdsRef = useRef<number[]>(
    (() => {
      if (typeof window === 'undefined') return [];
      try {
        const stored = localStorage.getItem('salery_bingo_room_card_ids');
        return stored ? JSON.parse(stored) : [];
      } catch { return []; }
    })()
  );
  const roomWalletTypeRef = useRef<'main_wallet' | 'play_wallet'>(
    typeof window !== 'undefined' ? (localStorage.getItem('salery_bingo_room_wallet_type') as 'main_wallet' | 'play_wallet') || 'main_wallet' : 'main_wallet'
  );
  const roomJoinRequestIdRef = useRef<string | null>(
    typeof window !== 'undefined' ? localStorage.getItem('salery_bingo_room_join_request_id') : null
  );
  const currentTelegramIdRef = useRef(user.telegramId);
  const settingsRef = useRef(settings);
  const lastCalledNumberRef = useRef<number | null>(null);
  const lastBallDrawnTimestampRef = useRef<number>(0);
  const hasPlayedBingoAudioThisRoundRef = useRef(false);
  const statusRef = useRef(status);
  statusRef.current = status;
  settingsRef.current = settings;
  currentTelegramIdRef.current = user.telegramId;
  const handleClaimBingoRef = useRef<((card: BingoCardModel) => void) | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Generate initial cards whenever cardsCount changes or game resets
  const initCards = useCallback((count: number) => {
    const newCards: BingoCardModel[] = [];
    for (let i = 0; i < count; i++) {
      newCards.push(generateBingoCard(i));
    }
    setCards(newCards);
    setCompetitors([]);
  }, []);

  useEffect(() => {
    if (status === 'idle' && !activeRoomRequestedRef.current && !hasJoinedRoomOnceRef.current && cards.length === 0) {
      initCards(settings.cardsCount);
    }
  }, [settings.cardsCount, status, initCards, cards.length]);

  // Daub a specific cell
  const handleCellClick = (cardIndex: number, row: number, col: number) => {
    sounds.playDaub();

    setCards((prevCards) => {
      const card = prevCards[cardIndex];
      if (!card) return prevCards;
      const targetCell = card.cells[row]?.[col];
      if (!targetCell || targetCell.isFree) return prevCards;
      // Allow marking if number was drawn in this round
      const isDrawn = calledSet.has(targetCell.number) || calledBalls.some((b) => b.number === targetCell.number);
      if (!isDrawn) return prevCards;

      let winningCardToClaim: BingoCardModel | null = null;

      const updatedCards = prevCards.map((c, cIdx) => {
        if (cIdx !== cardIndex) return c;
        const newCells = c.cells.map((rList, r) =>
          rList.map((curCell, cl) => {
            if (r === row && cl === col) {
              return { ...curCell, isDaubed: !curCell.isDaubed };
            }
            return curCell;
          })
        );
        const tempCard = { ...c, cells: newCells };
        const win = checkCardWinningPatterns(tempCard, settings.language);
        const updated = {
          ...tempCard,
          numbersNeeded: calculateNumbersNeeded(tempCard),
          hasWon: win.hasWon,
          winningPatternName: win.patternName,
        };
        if (win.hasWon) {
          winningCardToClaim = updated;
        }
        return updated;
      });

      if (winningCardToClaim && statusRef.current === 'in_progress') {
        setTimeout(() => {
          if (handleClaimBingoRef.current) {
            handleClaimBingoRef.current(winningCardToClaim!);
          }
        }, 0);
      }

      return updatedCards;
    });
  };

  const handleProcessWinner = useCallback((payload: {
    gameId?: string;
    winnerId?: string;
    winnerName?: string;
    cardId?: number;
    prize?: number;
    balance?: number;
    mainWallet?: number;
    playWallet?: number;
    win?: WinValidationResult;
  }) => {
    const gameId = payload.gameId || activeGameId;
    if (gameId && lastProcessedWinnerGameIdRef.current === gameId) {
      return;
    }
    lastProcessedWinnerGameIdRef.current = gameId || 'game-finished';

    statusRef.current = 'game_over';
    claimInFlightRef.current = false;
    setStatus('game_over');
    sounds.stopAllAudio();

    const isWinner = !payload.winnerId || String(payload.winnerId) === String(currentTelegramIdRef.current);
    const winDetails = payload.win || {
      hasWon: true,
      patternType: 'line',
      patternName: 'ቢንጎ አሸናፊ (Bingo Win)',
      winningCoordinates: [],
      multiplier: 1.8,
    };

    const finalPrize = payload.prize ?? prizePool;
    setWonAmount(finalPrize);
    setWinResult(winDetails);
    setWinnerInfo({
      winnerId: payload.winnerId,
      winnerName: payload.winnerName || (isWinner ? (user.firstName || user.username || 'You') : 'ተጫዋች'),
      cardId: payload.cardId,
      prize: finalPrize,
      isMe: isWinner,
    });
    setShowWinModal(isWinner);

    activeRoomRequestedRef.current = false;
    hasJoinedRoomOnceRef.current = false;
    roomJoinRequestIdRef.current = null;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('salery_bingo_has_joined_room_once');
      localStorage.removeItem('salery_bingo_active_room_requested');
      localStorage.removeItem('salery_bingo_room_card_ids');
      localStorage.removeItem('salery_bingo_room_wallet_type');
      localStorage.removeItem('salery_bingo_room_join_request_id');
      localStorage.removeItem(`salery_bingo_pending_room_${currentTelegramIdRef.current}`);
    }

    if (isWinner) {
      if (!hasPlayedBingoAudioThisRoundRef.current) {
        hasPlayedBingoAudioThisRoundRef.current = true;
        sounds.playBingo();
      }
      setUser((previous) => ({
        ...previous,
        balance: typeof payload.balance === 'number' ? payload.balance : previous.balance + finalPrize,
        mainWallet: typeof payload.mainWallet === 'number' ? payload.mainWallet : previous.mainWallet + finalPrize,
        playWallet: typeof payload.playWallet === 'number' ? payload.playWallet : previous.playWallet ?? 0,
        totalWins: previous.totalWins + 1,
        totalWonAmount: previous.totalWonAmount + finalPrize,
      }));

      if (payload.cardId) {
        setCards((previous) => previous.map((card) => card.cardIndex !== payload.cardId ? card : ({
          ...card,
          hasWon: true,
          winningPatternName: winDetails.patternName,
          cells: card.cells.map((row) => row.map((cell) => ({
            ...cell,
            isWinningCell: winDetails.winningCoordinates.some((coord) => coord.row === cell.row && coord.col === cell.col),
          }))),
        })));
      }

      logGameHistory(user.telegramId, {
        stake: settingsRef.current.selectedStake,
        cardsCount: settingsRef.current.cardsCount,
        result: 'won',
        wonAmount: finalPrize,
        patternName: winDetails.patternName,
        gameCode: gameId,
      });
      setHistory((previous) => [{
        id: `game-${gameId}`,
        timestamp: Date.now(),
        stake: settingsRef.current.selectedStake,
        cardsCount: settingsRef.current.cardsCount,
        result: 'won',
        wonAmount: finalPrize,
        patternName: winDetails.patternName,
      }, ...previous]);
    } else {
      sounds.playBeep(false);
      logGameHistory(user.telegramId, {
        stake: settingsRef.current.selectedStake,
        cardsCount: settingsRef.current.cardsCount,
        result: 'lost',
        wonAmount: 0,
        gameCode: gameId,
      });
      if (payload.winnerName) {
        showToast(`🏆 ጨዋታው ተጠናቋል! አሸናፊ: ${payload.winnerName}`);
      }
    }
  }, [user.telegramId, user.firstName, user.username, activeGameId, prizePool]);

  const applyRoomSnapshot = useCallback((room: BingoRoomSnapshot) => {
    if (statusRef.current === 'game_over' && room.status !== 'finished' && room.status !== 'waiting') {
      return;
    }
    const balls = room.called.map((number) => ({
      number,
      letter: getLetterForNumber(number),
      id: `ball-${number}`,
    }));
    const newestBall = balls[balls.length - 1] || null;
    const calledNumbers = new Set(room.called);
    setCalledBalls([...balls].reverse());
    setCalledSet(calledNumbers);
    setCurrentBall(newestBall);
    setPrizePool(room.prizePool);
    setActiveRoomPlayers(room.playerCount);
    setRoomPlayers(room.players);
    setActiveRoomCartelas(room.players.reduce((total, player) => total + player.cardsCount, 0));
    setActiveGameId(room.gameId);
    if (typeof room.startsAt === 'number' && room.startsAt > 0) {
      setRoomStartsAt(room.startsAt);
    }

    setCards((previousCards) => previousCards.map((card) => {
      const cells = card.cells.map((row) => row.map((cell) => ({
        ...cell,
        isDaubed: cell.isFree || (calledNumbers.has(cell.number) && (settingsRef.current.autoDaub || cell.isDaubed)),
      })));
      const updatedCard = { ...card, cells };
      const win = checkCardWinningPatterns(updatedCard, settingsRef.current.language);
      return {
        ...updatedCard,
        numbersNeeded: calculateNumbersNeeded(updatedCard),
        hasWon: win.hasWon,
        winningPatternName: win.patternName,
      };
    }));

    if (room.status === 'finished') {
      handleProcessWinner({
        gameId: room.gameId,
        winnerId: room.winnerId,
        winnerName: room.winnerName,
        cardId: room.winningCardId || 1,
        prize: room.prize || room.prizePool,
      });
    } else if (room.status === 'in_progress') {
      if (statusRef.current !== 'game_over') {
        if (statusRef.current === 'cartela_select' || roomCardIdsRef.current.length === 0) {
          // Player is currently picking cartelas for the upcoming round
          return;
        }
        setStatus('in_progress');
      }
    } else if (room.status === 'waiting') {
      setWinnerInfo(null);
      setShowWinModal(false);
      setWinResult(null);
      lastProcessedWinnerGameIdRef.current = null;
      claimInFlightRef.current = false;
      hasPlayedBingoAudioThisRoundRef.current = false;
      setCalledBalls([]);
      setCalledSet(new Set());
      setCurrentBall(null);
      // Clean all cards completely for the fresh round!
      setCards((prev) =>
        prev.map((c) => ({
          ...c,
          hasWon: false,
          winningPatternName: undefined,
          numbersNeeded: 4,
          cells: c.cells.map((row) =>
            row.map((cell) => ({
              ...cell,
              isDaubed: cell.isFree,
              isWinningCell: false,
            }))
          ),
        }))
      );
      if (statusRef.current === 'in_progress' || statusRef.current === 'game_over') {
        setStatus('cartela_select');
      }
    }
  }, [cards.length, handleProcessWinner]);

  const handleClaimBingo = useCallback(async (winningCard: BingoCardModel) => {
    if (statusRef.current !== 'in_progress' || claimInFlightRef.current) return;
    claimInFlightRef.current = true;
    const win = checkCardWinningPatterns(winningCard, settings.language);
    if (!win.hasWon) {
      claimInFlightRef.current = false;
      return;
    }

    const fallbackWin = () => {
      handleProcessWinner({
        gameId: activeGameId || `game-${Date.now()}`,
        winnerId: String(user.telegramId),
        winnerName: user.firstName || user.username || 'You',
        cardId: winningCard.cardIndex,
        prize: Math.max(prizePool, Math.floor(Math.max(cards.length, 1) * settings.selectedStake * 0.8)),
        win,
      });
      claimInFlightRef.current = false;
    };

    const socket = gameSocketRef.current;
    if (!socket?.connected) {
      fallbackWin();
      return;
    }

    // Safety timeout: if server doesn't respond within 1.5s, declare victory immediately!
    const safetyTimer = setTimeout(() => {
      if (statusRef.current === 'in_progress') {
        fallbackWin();
      }
    }, 1500);

    try {
      socket.emit('room:claim', { cardId: winningCard.cardIndex, stake: settings.selectedStake }, (ackRes: any) => {
        clearTimeout(safetyTimer);
        if (ackRes?.ok) {
          handleProcessWinner({
            gameId: ackRes.state?.gameId || activeGameId,
            winnerId: String(user.telegramId),
            winnerName: user.firstName || user.username || 'You',
            cardId: winningCard.cardIndex,
            prize: ackRes.balance || ackRes.state?.prize || prizePool,
            balance: ackRes.balance,
            mainWallet: ackRes.mainWallet,
            playWallet: ackRes.playWallet,
            win: ackRes.win || win,
          });
        } else {
          console.warn('Server claim rejected, applying local verified win:', ackRes?.error);
          fallbackWin();
        }
      });
    } catch {
      clearTimeout(safetyTimer);
      fallbackWin();
    }
  }, [settings.language, settings.selectedStake, activeGameId, user.telegramId, user.firstName, user.username, prizePool, cards.length, handleProcessWinner]);

  handleClaimBingoRef.current = handleClaimBingo;

  // Check if any card has won (instant automatic Bingo alert & claim)
  useEffect(() => {
    if (status === 'in_progress') {
      const winningCard = cards.find((c) => {
        const win = checkCardWinningPatterns(c, settings.language);
        return win.hasWon;
      });

      if (winningCard) {
        handleClaimBingo(winningCard);
      }
    }
  }, [cards, status, settings.language]);



  const getOrCreateSocket = useCallback(() => {
    let initData = telegramInitDataRef.current;
    if (!initData && typeof window !== 'undefined') {
      initData = new URLSearchParams(window.location.hash.slice(1)).get('tgWebAppData') || '';
      if (!initData) {
        const hostname = window.location.hostname;
        const isLocal = hostname === 'localhost' || hostname === '127.0.0.1';
        if (isLocal || process.env.NODE_ENV !== 'production') {
          const existing = localStorage.getItem('salery_bingo_mock_tg_id');
          const nextId = existing && !Number.isNaN(Number(existing)) ? String(existing) : String(Math.floor(100000000 + Math.random() * 900000000));
          localStorage.setItem('salery_bingo_mock_tg_id', nextId);
          initData = `mock:${nextId}`;
        }
      }
      telegramInitDataRef.current = initData;
    }

    let socket = gameSocketRef.current;
    if (!socket) {
      socket = connectBingoSocket(initData);
      socket.on('room:state', applyRoomSnapshot);
      socket.on('gameStarted', ({ gameId, startedAt }) => {
        setActiveGameId(gameId || activeGameId);
        setCountdown(0);
        setStatus('in_progress');
        if (typeof startedAt === 'number') {
          const delta = Math.max(0, startedAt - Date.now());
          if (delta > 0) {
            setTimeout(() => setStatus('in_progress'), Math.min(delta, 250));
          }
        }
      });
      socket.on('numberDrawn', ({ number, called, gameId }) => {
        if (!number) return;
        if (statusRef.current === 'game_over') return;

        const ball = { number, letter: getLetterForNumber(number), id: `ball-${number}` };
        lastBallDrawnTimestampRef.current = Date.now();
        setCurrentBall(ball);
        setActiveGameId(gameId || activeGameId);

        const nextCalledList: number[] = Array.isArray(called) && called.length > 0 ? called : [number];
        const nextSet = new Set(nextCalledList);
        nextSet.add(number);
        setCalledSet(nextSet);
        setCalledBalls(Array.from(nextSet).reverse().map((n: number) => ({
          number: n,
          letter: getLetterForNumber(n),
          id: `ball-${n}`,
        })));

        // Automatically mark matching cells across all player cards!
        setCards((prevCards) => {
          let winningCardToClaim: BingoCardModel | null = null;
          const nextCards = prevCards.map((card) => {
            const cells = card.cells.map((row) =>
              row.map((cell) => ({
                ...cell,
                isDaubed:
                  cell.isFree ||
                  (nextSet.has(cell.number) && (settingsRef.current.autoDaub || cell.isDaubed)),
              }))
            );
            const updatedCard = { ...card, cells };
            const win = checkCardWinningPatterns(updatedCard, settingsRef.current.language);
            const updated = {
              ...updatedCard,
              numbersNeeded: calculateNumbersNeeded(updatedCard),
              hasWon: win.hasWon,
              winningPatternName: win.patternName,
            };
            if (win.hasWon && !winningCardToClaim) {
              winningCardToClaim = updated;
            }
            return updated;
          });

          if (winningCardToClaim && statusRef.current === 'in_progress') {
            setTimeout(() => {
              if (handleClaimBingoRef.current) {
                handleClaimBingoRef.current(winningCardToClaim!);
              }
            }, 0);
          }

          return nextCards;
        });

        if (statusRef.current === 'in_progress') {
          sounds.playCalledNumber({ letter: ball.letter, number: ball.number });
        }
      });
      socket.on('connect', () => {
        if (!hasJoinedRoomOnceRef.current || !activeRoomRequestedRef.current) return;
        void emitBingoWithAck<BingoJoinResult>(socket!, 'room:join', {
          stake: settingsRef.current.selectedStake,
          cardIds: roomCardIdsRef.current,
          joinRequestId: roomJoinRequestIdRef.current,
          walletType: roomWalletTypeRef.current,
        }).then((rejoined) => {
          if (!rejoined.ok || !rejoined.state || !rejoined.cards) {
            activeRoomRequestedRef.current = false;
            hasJoinedRoomOnceRef.current = false;
            localStorage.removeItem('salery_bingo_has_joined_room_once');
            localStorage.removeItem('salery_bingo_active_room_requested');
            localStorage.removeItem('salery_bingo_room_card_ids');
            localStorage.removeItem('salery_bingo_room_wallet_type');
            localStorage.removeItem('salery_bingo_room_join_request_id');
            setStatus('idle');
            return;
          }
          // Preserve existing marks so they NEVER disappear!
          setCards((currentCards) => {
            const calledNums = new Set(rejoined.state?.called || []);
            return rejoined.cards!.map((newCard) => {
              const prevCard = currentCards.find((c) => c.cardIndex === newCard.cardIndex);
              const prevDaubs = new Set<string>();
              if (prevCard) {
                prevCard.cells.forEach((row, r) => {
                  row.forEach((cell, cl) => {
                    if (cell.isDaubed) prevDaubs.add(`${r}-${cl}`);
                  });
                });
              }
              const cells = newCard.cells.map((row, r) =>
                row.map((cell, cl) => ({
                  ...cell,
                  isDaubed:
                    cell.isFree ||
                    prevDaubs.has(`${r}-${cl}`) ||
                    (settingsRef.current.autoDaub && calledNums.has(cell.number)),
                }))
              );
              const updated = { ...newCard, cells };
              const win = checkCardWinningPatterns(updated, settingsRef.current.language);
              return {
                ...updated,
                numbersNeeded: calculateNumbersNeeded(updated),
                hasWon: win.hasWon,
                winningPatternName: win.patternName,
              };
            });
          });
          if (typeof rejoined.balance === 'number') {
            setUser((previous) => ({
              ...previous,
              balance: rejoined.mainWallet ?? rejoined.balance!,
              mainWallet: rejoined.mainWallet ?? rejoined.balance!,
              playWallet: rejoined.playWallet ?? previous.playWallet ?? 0,
            }));
          }
          applyRoomSnapshot(rejoined.state);
        }).catch(() => showToast('Reconnecting to the bingo room...'));
      });
      socket.on('wallet:balance', (wallets: number | { balance?: number; mainWallet?: number; playWallet?: number }) => {
        const balance = typeof wallets === 'number' ? wallets : wallets.mainWallet ?? wallets.balance;
        if (typeof balance === 'number' && Number.isFinite(balance)) {
          setUser((previous) => ({
            ...previous,
            balance,
            mainWallet: balance,
            playWallet: typeof wallets === 'number' ? previous.playWallet ?? 0 : wallets.playWallet ?? previous.playWallet ?? 0,
          }));
        }
      });
      socket.on('room:winner', (result: any) => {
        handleProcessWinner(result);
      });
      socket.on('connect_error', (error) => {
        console.warn('Socket connection retry:', error.message);
      });
      gameSocketRef.current = socket;
      setSocketInstance(socket);
    }
    return socket;
  }, [applyRoomSnapshot, handleProcessWinner, user.telegramId]);

  // Auto-connect and try to rejoin on startup if in an active online game
  useEffect(() => {
    if (activeRoomRequestedRef.current) {
      getOrCreateSocket();
    }
  }, []);

  // Real-time synchronized ball calling loop when in progress
  useEffect(() => {
    if (status !== 'in_progress') return;

    const cycle = getGlobalBingoCycle();
    const deck = getDeterministicRoundDeck(cycle.cycleIndex);
    const roundStartedAt = cycle.selectionEndsAt;
    const initialElapsed = Math.max(0, Date.now() - roundStartedAt);
    let ballIdx = Math.floor(initialElapsed / 2800);

    // If game was joined midway, pre-populate already called numbers
    if (ballIdx > 0) {
      const alreadyDrawn = deck.slice(0, Math.min(ballIdx, deck.length));
      const alreadySet = new Set(alreadyDrawn);
      setCalledSet(alreadySet);
      setCalledBalls(alreadyDrawn.map((n) => ({ number: n, letter: getLetterForNumber(n), id: `ball-${n}` })).reverse());
      if (alreadyDrawn.length > 0) {
        const last = alreadyDrawn[alreadyDrawn.length - 1];
        setCurrentBall({ number: last, letter: getLetterForNumber(last), id: `ball-${last}` });
      }
    }

    const interval = setInterval(() => {
      // If socket is actively connected and drawing balls, yield to socket
      if (gameSocketRef.current?.connected && Date.now() - (lastBallDrawnTimestampRef.current || 0) < 3500) {
        return;
      }

      if (statusRef.current !== 'in_progress') {
        clearInterval(interval);
        return;
      }

      const currentElapsed = Math.max(0, Date.now() - roundStartedAt);
      const targetIdx = Math.floor(currentElapsed / 2800);
      if (targetIdx <= ballIdx && ballIdx > 0) {
        return;
      }
      ballIdx = targetIdx;

      if (ballIdx >= deck.length) {
        clearInterval(interval);
        return;
      }

      const number = deck[ballIdx];
      if (!number) return;

      const ball = { number, letter: getLetterForNumber(number), id: `ball-${number}` };
      lastBallDrawnTimestampRef.current = Date.now();
      setCurrentBall(ball);
      setCalledSet((prev) => {
        const next = new Set(prev);
        next.add(number);
        return next;
      });
      setCalledBalls((prev) => [ball, ...prev]);

      setCards((prevCards) => {
        let winningCardToClaim: BingoCardModel | null = null;
        const nextCards = prevCards.map((card) => {
          const cells = card.cells.map((row) =>
            row.map((cell) => ({
              ...cell,
              isDaubed: cell.isFree || (cell.number === number ? (settingsRef.current.autoDaub || cell.isDaubed) : cell.isDaubed),
            }))
          );
          const updatedCard = { ...card, cells };
          const win = checkCardWinningPatterns(updatedCard, settingsRef.current.language);
          const updated = {
            ...updatedCard,
            numbersNeeded: calculateNumbersNeeded(updatedCard),
            hasWon: win.hasWon,
            winningPatternName: win.patternName,
          };
          if (win.hasWon && !winningCardToClaim) winningCardToClaim = updated;
          return updated;
        });

        if (winningCardToClaim && statusRef.current === 'in_progress') {
          setTimeout(() => {
            if (handleClaimBingoRef.current) {
              handleClaimBingoRef.current(winningCardToClaim!);
            }
          }, 0);
        }

        return nextCards;
      });

      sounds.playCalledNumber({ letter: ball.letter, number: ball.number });
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  // Step 1: Open Cartela Selection View or Resume Active Game
  const handleOpenCartelaSelection = () => {
    setActiveTab('game');
    roomCardIdsRef.current = [];
    hasJoinedRoomOnceRef.current = false;
    activeRoomRequestedRef.current = false;
    setStatus('cartela_select');

    const socket = getOrCreateSocket();
    socket.emit('cartela:room_enter', { stake: settings.selectedStake }, (res: any) => {
      if (res && res.ok && res.state) {
        if (typeof res.state.startsAt === 'number' && res.state.startsAt > Date.now()) {
          setRoomStartsAt(res.state.startsAt);
        }
        // If the user already joined with cards and reloaded, resume that game
        if (res.state.status === 'in_progress' && res.joinedPlayer?.cardIds?.length > 0) {
          const joinedCards = res.joinedPlayer.cardIds.map((id: number) => generateCartelaByNumber(id));
          setCards(joinedCards);
          roomCardIdsRef.current = res.joinedPlayer.cardIds;
          hasJoinedRoomOnceRef.current = true;
          activeRoomRequestedRef.current = true;
          setStatus('in_progress');
          applyRoomSnapshot(res.state);
        }
      }
    });
  };

  // Step 2: Confirm Selected Cartelas and Launch Round
  const handleConfirmCartelaSelection = async (
    selectedCards: BingoCardModel[],
    roomPlayersCount?: number,
    totalRoomCartelas?: number,
    walletType: 'main_wallet' | 'play_wallet' = 'main_wallet'
  ) => {
    hasJoinedRoomOnceRef.current = true;
    activeRoomRequestedRef.current = true;
    lastProcessedWinnerGameIdRef.current = null;
    roomCardIdsRef.current = selectedCards.map((c) => c.cardIndex);
    setCards(selectedCards);
    roomWalletTypeRef.current = walletType;
    hasPlayedBingoAudioThisRoundRef.current = false;
    const joinRequestId = crypto.randomUUID();
    roomJoinRequestIdRef.current = joinRequestId;
    const joinKey = `salery_bingo_pending_room_${user.telegramId}`;
    localStorage.setItem(joinKey, joinRequestId);
    try {
      const socket = getOrCreateSocket();
      if (!socket.connected) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Room connection timed out')), 1_500);
          socket.once('connect', () => {
            clearTimeout(timeout);
            resolve();
          });
          socket.once('connect_error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
          if (!socket.active) socket.connect();
        });
      }

      const result = await emitBingoWithAck<BingoJoinResult>(socket, 'room:join', {
        stake: settings.selectedStake,
        cardIds: selectedCards.map((card) => card.cardIndex),
        joinRequestId,
        walletType,
      });
      if (!result.ok || !result.state || !result.cards || typeof result.balance !== 'number') {
        throw new Error(result.error || 'Could not join the shared game');
      }

      const initialCalled = new Set(result.state.called || []);
      const readyCards = result.cards.map((card) => {
        const cells = card.cells.map((row) =>
          row.map((cell) => ({
            ...cell,
            isDaubed:
              cell.isFree ||
              cell.isDaubed ||
              (settingsRef.current.autoDaub && initialCalled.has(cell.number)),
          }))
        );
        const updated = { ...card, cells };
        const win = checkCardWinningPatterns(updated, settingsRef.current.language);
        return {
          ...updated,
          numbersNeeded: calculateNumbersNeeded(updated),
          hasWon: win.hasWon,
          winningPatternName: win.patternName,
        };
      });
      setCards(readyCards);
      roomCardIdsRef.current = result.cards.map((card) => card.cardIndex);
      hasJoinedRoomOnceRef.current = true;
      activeRoomRequestedRef.current = true;
      if (typeof window !== 'undefined') {
        localStorage.setItem('salery_bingo_has_joined_room_once', 'true');
        localStorage.setItem('salery_bingo_active_room_requested', 'true');
        localStorage.setItem('salery_bingo_room_card_ids', JSON.stringify(result.cards.map((c) => c.cardIndex)));
        localStorage.setItem('salery_bingo_room_wallet_type', walletType);
        localStorage.setItem('salery_bingo_room_join_request_id', roomJoinRequestIdRef.current || '');
      }
      setUser((previous) => ({
        ...previous,
        balance: result.balance!,
        mainWallet: result.mainWallet ?? result.balance!,
        playWallet: result.playWallet ?? previous.playWallet ?? 0,
        totalGames: previous.totalGames + (result.duplicate ? 0 : 1),
      }));
      lastCalledNumberRef.current = null;
      applyRoomSnapshot(result.state);
      sounds.playBeep(true);
      setStatus(result.state.status === 'finished' ? 'game_over' : 'in_progress');
    } catch (error: any) {
      activeRoomRequestedRef.current = false;
      console.warn('Network socket join issue, entering synchronized round:', error);
      const cycle = getGlobalBingoCycle();
      setActiveGameId(cycle.gameId);
      const playersCount = Math.max(12, roomPlayersCount || 15);
      const totalCartelas = Math.max(playersCount * 2, totalRoomCartelas || 30);
      setActiveRoomPlayers(playersCount);
      setActiveRoomCartelas(totalCartelas);
      setPrizePool(Math.floor(totalCartelas * settings.selectedStake * 0.8));
      setCompetitors(generateCompetitors());
      setCards(selectedCards);
      sounds.playBeep(true);
      setStatus('in_progress');
    }
  };

  const handleResetGame = () => {
    // If returning to lobby while game is active, just switch view so player can come back seamlessly
    if (statusRef.current === 'in_progress') {
      setStatus('idle');
      return;
    }
    gameSocketRef.current?.emit('room:leave', { stake: settings.selectedStake });
    activeRoomRequestedRef.current = false;
    hasJoinedRoomOnceRef.current = false;
    lastProcessedWinnerGameIdRef.current = null;
    claimInFlightRef.current = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('salery_bingo_has_joined_room_once');
      localStorage.removeItem('salery_bingo_active_room_requested');
      localStorage.removeItem('salery_bingo_room_card_ids');
      localStorage.removeItem('salery_bingo_room_wallet_type');
      localStorage.removeItem('salery_bingo_room_join_request_id');
    }
    setStatus('idle');
    setCalledBalls([]);
    setCalledSet(new Set());
    setCurrentBall(null);
    setPrizePool(0);
    setRoomPlayers([]);
    setActiveGameId('');
    setWinnerInfo(null);
    setShowWinModal(false);
    setWinResult(null);
    initCards(settings.cardsCount);
  };

  const handleReturnToCartelaSelect = useCallback(() => {
    gameSocketRef.current?.emit('room:leave', { stake: settings.selectedStake });
    activeRoomRequestedRef.current = false;
    hasJoinedRoomOnceRef.current = false;
    lastProcessedWinnerGameIdRef.current = null;
    claimInFlightRef.current = false;
    if (typeof window !== 'undefined') {
      localStorage.removeItem('salery_bingo_has_joined_room_once');
      localStorage.removeItem('salery_bingo_active_room_requested');
      localStorage.removeItem('salery_bingo_room_card_ids');
      localStorage.removeItem('salery_bingo_room_wallet_type');
      localStorage.removeItem('salery_bingo_room_join_request_id');
      localStorage.removeItem(`salery_bingo_pending_room_${currentTelegramIdRef.current}`);
    }
    sounds.stopAllAudio();
    hasPlayedBingoAudioThisRoundRef.current = false;
    setCalledBalls([]);
    setCalledSet(new Set());
    setCurrentBall(null);
    setPrizePool(0);
    setRoomPlayers([]);
    setActiveGameId('');
    setWinnerInfo(null);
    setShowWinModal(false);
    setWinResult(null);
    // Completely wipe all card states to clean slate
    setCards((prev) =>
      prev.map((c) => ({
        ...c,
        hasWon: false,
        winningPatternName: undefined,
        numbersNeeded: 4,
        cells: c.cells.map((row) =>
          row.map((cell) => ({
            ...cell,
            isDaubed: cell.isFree,
            isWinningCell: false,
          }))
        ),
      }))
    );
    initCards(settings.cardsCount);
    setActiveTab('game');
    setStatus('cartela_select');
    getOrCreateSocket();
  }, [settings.selectedStake, settings.cardsCount, initCards, getOrCreateSocket]);

  const isLiveGameActive = status === 'in_progress' || status === 'paused' || status === 'countdown' || status === 'game_over';

  if (showAdminPanel) {
    return (
      <div className="min-h-screen bg-[#040810] text-slate-100">
        <AdminPanelView
          onBack={handleCloseAdminPanel}
          adminTelegramId={user.telegramId}
          onRefreshUserBalance={() => refreshUserData()}
        />
      </div>
    );
  }

  if (user.is_blocked || user.status === 'blocked') {
    return (
      <BannedUserView
        user={user}
        onRefresh={async () => {
          await refreshUserData(user.telegramId);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#110c22] text-slate-100 flex flex-col justify-between selection:bg-amber-500 selection:text-slate-950 font-sans pb-20">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 transform -translate-x-1/2 z-50 bg-amber-500 text-slate-950 px-4 py-2.5 rounded-2xl font-bold text-xs shadow-2xl flex items-center gap-2 animate-bounce border border-amber-300">
          <AlertCircle className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Countdown Overlay */}
      {status === 'countdown' && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950/90 backdrop-blur-md">
          <div className="text-center space-y-2 animate-pulse">
            <span className="text-xs uppercase tracking-widest text-amber-400 font-bold">
              {t.gameStartsIn}
            </span>
            <div className="text-8xl sm:text-9xl font-black font-mono text-amber-400">
              {countdown}
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: GAME TAB */}
      {activeTab === 'game' && (
        <>
          {status === 'idle' && (
            /* EXACT FIRST PAGE FROM SCREENSHOT: STAKE SELECTION */
            <div className="flex-1 flex flex-col justify-center">
              <LobbyView
                user={user}
                settings={settings}
                onUpdateSettings={(newVals) => setSettings((s) => ({ ...s, ...newVals }))}
                onStartGame={handleOpenCartelaSelection}
                onOpenRules={() => setRulesModalOpen(true)}
                onOpenAdmin={handleOpenAdminPanel}
              />
            </div>
          )}

          {status === 'cartela_select' && (
            /* EXACT SECOND PAGE FROM SCREENSHOT: CARTELA SELECTION & PREVIEW */
            <div className="flex-1 flex flex-col justify-center">
              <CartelaSelectionView
                user={user}
                settings={settings}
                onBack={() => setStatus('idle')}
                onConfirmSelection={handleConfirmCartelaSelection}
                socket={socketInstance || gameSocketRef.current}
                roomStartsAt={roomStartsAt}
              />
            </div>
          )}

          {isLiveGameActive && (
            /* ACTIVE LIVE BINGO GAME ARENA (Exact match to Screenshot 2439) */
            <div className="flex-1 flex flex-col justify-center">
              <GamePlayView
                user={user}
                settings={settings}
                currentBall={currentBall}
                calledBalls={calledBalls}
                calledSet={calledSet}
                cards={cards}
                onCellClick={handleCellClick}
                onClaimBingo={handleClaimBingo}
                onLeave={handleResetGame}
                onRefresh={handleResetGame}
                onToggleAutoDaub={(enabled) =>
                  setSettings((prev) => ({ ...prev, autoDaub: enabled }))
                }
                prizePool={prizePool}
                autoDaubEnabled={settings.autoDaub}
                totalPlayersCount={activeRoomCartelas || cards.length || activeRoomPlayers}
                gameId={activeGameId}
                roomPlayers={roomPlayers}
                status={status}
                winnerInfo={winnerInfo}
                onPlayAgain={handleReturnToCartelaSelect}
              />
            </div>
          )}
        </>
      )}

      {/* TAB 2: HISTORY TAB (Matching Screenshot 1) */}
      {activeTab === 'history' && (
        <HistoryView
          history={history}
          totalGamesCount={user.totalGames}
        />
      )}

      {/* TAB 3: WALLET TAB (Matching Screenshot 2) */}
      {activeTab === 'wallet' && (
        <WalletView
          user={user}
          isRefreshing={isRefreshingBalance}
          onRefresh={() => refreshUserData()}
        />
      )}

      {/* TAB 4: PROFILE TAB (Matching Screenshot 3) */}
      {activeTab === 'profile' && (
        <ProfileView
          user={user}
          settings={settings}
          onUpdateSettings={(newSettings) => setSettings((s) => ({ ...s, ...newSettings }))}
          onOpenAdminPanel={handleOpenAdminPanel}
        />
      )}

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <BottomNav activeTab={activeTab} onSelectTab={setActiveTab} />

      {/* RULES MODAL POPUP */}
      {rulesModalOpen && (
        <RulesModal
          language={settings.language}
          onClose={() => setRulesModalOpen(false)}
        />
      )}

      {/* LEADERBOARDS & STATS MODAL POPUP */}
      {statsModalOpen && (
        <StatsModal
          user={user}
          language={settings.language}
          onClose={() => setStatsModalOpen(false)}
        />
      )}

      {/* WIN CELEBRATION MODAL OVERLAY */}
      {showWinModal && (
        <WinModal
          user={user}
          winResult={winResult}
          winningCard={cards.find((c) => c.cardIndex === winnerInfo?.cardId) || cards.find((c) => c.hasWon) || null}
          wonAmount={wonAmount}
          language={settings.language}
          winnerName={winnerInfo?.winnerName}
          cardId={winnerInfo?.cardId}
          isMe={winnerInfo?.isMe}
          onClose={handleReturnToCartelaSelect}
          onPlayAgain={handleReturnToCartelaSelect}
        />
      )}

    </div>
  );
}
