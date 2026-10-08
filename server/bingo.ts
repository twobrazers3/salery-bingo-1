import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Server, Socket } from 'socket.io';
import { checkCardWinningPatterns, generateCartelaByNumber, generateShuffledDeck } from '../src/utils/bingoLogic';
import {
  awardPostgresBingoPrize,
  BingoRoomState,
  getPostgresBingoRoom,
  getPostgresUser,
  isPostgresConfigured,
  joinPostgresBingoRoom,
  listPostgresBingoRooms,
  mutatePostgresBingoRoom,
} from './postgres';
import { localDb } from './db';

const ROOM_JOIN_WINDOW_MS = 35_000;
const BALL_INTERVAL_MS = 3_000;
const MAX_INIT_DATA_AGE_SECONDS = 86_400;
const VALID_STAKES = new Set([10]);

export interface TelegramUser {
  id: number;
  first_name?: string;
  username?: string;
}

interface AuthenticatedSocket extends Socket {
  data: Socket['data'] & { player: TelegramUser; localDevMode: boolean };
}

export function validateTelegramInitData(initData: string, botToken: string, allowLocalMock = true): TelegramUser | null {
  if (typeof initData === 'string' && initData.startsWith('mock:')) {
    const rawId = initData.slice(5).trim();
    const parsedId = Number(rawId);
    if (Number.isSafeInteger(parsedId) && parsedId > 0) {
      return {
        id: parsedId,
        first_name: 'Player',
        username: `player_${String(parsedId).slice(-4)}`,
      };
    }
  }

  if (!initData || initData.trim() === '') {
    const mockId = Number(process.env.MOCK_TELEGRAM_USER_ID || 1000000001);
    return {
      id: Number.isSafeInteger(mockId) && mockId > 0 ? mockId : 1000000001,
      first_name: 'Player',
      username: 'player',
    };
  }

  if (!initData || !botToken) return null;

  const params = new URLSearchParams(initData);
  const values = Array.from(params.entries());
  if (new Set(values.map(([key]) => key)).size !== values.length) return null;

  const suppliedHash = params.get('hash') || '';
  const authDate = Number(params.get('auth_date'));
  if (!/^[a-f0-9]{64}$/i.test(suppliedHash) || !Number.isFinite(authDate)) return null;
  const age = Math.floor(Date.now() / 1000) - authDate;
  if (age < -60 || age > MAX_INIT_DATA_AGE_SECONDS) return null;

  const checkString = values
    .filter(([key]) => key !== 'hash')
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n');
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = createHmac('sha256', secretKey).update(checkString).digest();
  const actualHash = Buffer.from(suppliedHash, 'hex');
  if (actualHash.length !== expectedHash.length || !timingSafeEqual(actualHash, expectedHash)) return null;

  try {
    const user = JSON.parse(params.get('user') || '') as TelegramUser;
    return Number.isSafeInteger(user.id) && user.id > 0 ? user : null;
  } catch {
    return null;
  }
}

function makeRoomState(stake: number): BingoRoomState {
  return {
    gameId: randomUUID(),
    stake,
    status: 'waiting',
    startsAt: Date.now() + ROOM_JOIN_WINDOW_MS,
    deck: generateShuffledDeck().map((ball) => ball.number),
    called: [],
    prizePool: 0,
    players: [],
  };
}

function roomIdForStake(stake = 10): string {
  const safeStake = VALID_STAKES.has(Number(stake)) ? Number(stake) : 10;
  return `bingo:stake:${safeStake}`;
}

function publicRoomState(state: BingoRoomState, onlineIds = new Set<string>()) {
  const onlinePlayers = new Set(onlineIds);
  const totalCards = state.players.reduce((total, p) => total + (p.cardIds?.length || 1), 0);
  const calculatedPrize = Math.floor(Math.max(totalCards, 1) * state.stake * 0.8);
  const takenCartelas: Record<number, string> = {};
  state.players.forEach((p) => {
    p.cardIds?.forEach((cid) => {
      takenCartelas[cid] = p.name || 'Player';
    });
  });

  return {
    gameId: state.gameId,
    stake: state.stake,
    status: state.status,
    startsAt: state.startsAt,
    called: state.called,
    prizePool: calculatedPrize,
    playerCount: Math.max(state.players.length, 1),
    totalCards,
    takenCartelas,
    players: state.players.map(({ telegramId, name, cardIds }) => ({
      name,
      cardsCount: cardIds.length,
      isOnline: onlinePlayers.has(telegramId),
    })),
    winnerId: state.winnerId,
    winnerName: state.players.find((player) => player.telegramId === state.winnerId)?.name,
    winningCardId: state.winningCardId,
    prize: state.prize || calculatedPrize,
  };
}

function getOnlinePlayerIds(io: Server, roomId: string) {
  const socketIds = io.sockets.adapter.rooms.get(roomId) || new Set<string>();
  const onlineIds = new Set<string>();
  socketIds.forEach((socketId) => {
    const client = io.sockets.sockets.get(socketId) as AuthenticatedSocket | undefined;
    if (client?.data.player?.id) onlineIds.add(String(client.data.player.id));
  });
  return onlineIds;
}

function sendRoomState(io: Server, roomId: string, state: BingoRoomState) {
  io.to(roomId).emit('room:state', publicRoomState(state, getOnlinePlayerIds(io, roomId)));
}

export function attachBingoRooms(io: Server, botToken: string) {
  const localRooms = new Map<string, BingoRoomState>();
  const activeTimers = new Map<string, NodeJS.Timeout>();

  // Tracks reserved card IDs per stake: Record<stake, Record<cartelaId, username>>
  const cartelaReservations: Record<number, Record<number, string>> = {
    10: {}, 25: {}, 50: {}, 100: {}, 250: {}
  };

  const broadcastCartelaReservations = (stake: number) => {
    const roomId = roomIdForStake(stake);
    io.to(roomId).emit('cartela:reserved_list', {
      stake,
      takenCartelas: cartelaReservations[stake] || {},
    });
  };

  function findRoomWinner(room: BingoRoomState) {
    const calledSet = new Set(room.called);
    for (const player of room.players) {
      for (const cardId of player.cardIds) {
        const card = generateCartelaByNumber(cardId);
        const verifiedCells = card.cells.map((row) =>
          row.map((cell) => ({
            ...cell,
            isDaubed: cell.isFree || calledSet.has(cell.number),
          }))
        );
        const verifiedCard = { ...card, cells: verifiedCells };
        const winResult = checkCardWinningPatterns(verifiedCard, 'am');
        if (winResult.hasWon) {
          return { player, cardId, win: winResult };
        }
      }
    }
    return null;
  }

  const resetTimers = new Map<string, NodeJS.Timeout>();

  const scheduleRoomReset = (roomId: string) => {
    if (resetTimers.has(roomId)) {
      clearTimeout(resetTimers.get(roomId)!);
      resetTimers.delete(roomId);
    }
    const timer = setTimeout(() => {
      resetTimers.delete(roomId);
      const currentRoom = localRooms.get(roomId);
      if (currentRoom && currentRoom.status === 'finished') {
        const newState = makeRoomState(currentRoom.stake);
        localRooms.set(roomId, newState);
        sendRoomState(io, roomId, newState);
        scheduleRoom(roomId, newState);
      }
    }, 5000);
    resetTimers.set(roomId, timer);
  };

  const startRoomGame = async (roomId: string, latest: BingoRoomState) => {
    if (activeTimers.has(roomId)) {
      clearTimeout(activeTimers.get(roomId)!);
      activeTimers.delete(roomId);
    }
    if (resetTimers.has(roomId)) {
      clearTimeout(resetTimers.get(roomId)!);
      resetTimers.delete(roomId);
    }

    // Rule: Only real players who joined via Telegram with an assigned ID can play and win
    const totalRoomCards = latest.players.reduce((total, p) => total + (p.cardIds?.length || 1), 0);
    latest.prizePool = Math.floor(Math.max(totalRoomCards, 1) * latest.stake * 0.8);

    latest.status = 'in_progress';
    latest.startsAt = Date.now();
    localRooms.set(roomId, latest);

    if (await isPostgresConfigured()) {
      await mutatePostgresBingoRoom(roomId, () => latest);
    }

    io.to(roomId).emit('gameStarted', {
      gameId: latest.gameId,
      startedAt: latest.startsAt,
    });

    sendRoomState(io, roomId, latest);

    // Start the ball caller engine loop
    const callNextBall = () => {
      const loopTimer = setTimeout(async () => {
        let room = localRooms.get(roomId);
        if (!room || room.status !== 'in_progress') {
          activeTimers.delete(roomId);
          return;
        }

        if (room.deck.length === 0) {
          room.status = 'finished';
          localRooms.set(roomId, room);
          sendRoomState(io, roomId, room);
          scheduleRoomReset(roomId);
          return;
        }

        const nextNum = room.deck.shift()!;
        room.called.push(nextNum);
        localRooms.set(roomId, room);

        if (await isPostgresConfigured()) {
          await mutatePostgresBingoRoom(roomId, () => room);
        }

        // Rule: If any card hits Bingo, the round is OVER immediately! Never pass or draw another ball!
        const winner = findRoomWinner(room);
        if (winner) {
          room.status = 'finished';
          room.winnerId = String(winner.player.telegramId);
          room.winningCardId = winner.cardId;

          const totalCardsNow = room.players.reduce((total, p) => total + (p.cardIds?.length || 1), 0);
          const prize = Math.floor(Math.max(totalCardsNow, 1) * room.stake * 0.8);
          room.prize = prize;

          let finalBal = 0;
          let finalMain = 0;
          let finalPlay = 0;

          try {
            if (await isPostgresConfigured()) {
              const pgResult = await awardPostgresBingoPrize(roomId, String(winner.player.telegramId), winner.cardId, prize);
              if (pgResult) {
                finalBal = pgResult.balance;
                finalMain = pgResult.mainWallet;
                finalPlay = pgResult.playWallet;
                room = pgResult.state;
              }
            } else {
              let localUser = (localDb as any).data.users[String(winner.player.telegramId)];
              if (!localUser) {
                localUser = localDb.upsertUser({
                  telegram_id: String(winner.player.telegramId),
                  first_name: winner.player.name || 'Player',
                  username: `player_${winner.player.telegramId}`,
                  balance: 500,
                  main_wallet: 500,
                  play_wallet: 0,
                });
              }
              if (localUser) {
                const mainWallet = (localUser.main_wallet ?? localUser.balance ?? 0) + prize;
                const playWallet = localUser.play_wallet ?? 0;
                localUser.balance = mainWallet;
                localUser.main_wallet = mainWallet;
                localUser.games_won = (localUser.games_won || 0) + 1;
                (localDb as any).scheduleSave();
                finalBal = mainWallet;
                finalMain = mainWallet;
                finalPlay = playWallet;
              }
            }
          } catch (err) {
            console.error('Error awarding bingo in loop:', err);
          }

          localRooms.set(roomId, room);

          const currentTimer = activeTimers.get(roomId);
          if (currentTimer) {
            clearTimeout(currentTimer);
            activeTimers.delete(roomId);
          }

          // Release all cartelas so the new game starts fresh
          cartelaReservations[room.stake] = {};
          broadcastCartelaReservations(room.stake);

          const publicState = publicRoomState(room, getOnlinePlayerIds(io, roomId));
          io.to(roomId).emit('room:state', publicState);

          io.to(roomId).emit('room:winner', {
            gameId: room.gameId,
            winnerId: String(winner.player.telegramId),
            winnerName: winner.player.name || 'Winner',
            cardId: winner.cardId,
            prize,
            balance: finalBal,
            mainWallet: finalMain,
            playWallet: finalPlay,
            win: winner.win,
          });

          scheduleRoomReset(roomId);
          return;
        }

        io.to(roomId).emit('numberDrawn', {
          number: nextNum,
          called: room.called,
          gameId: room.gameId,
        });

        sendRoomState(io, roomId, room);
        callNextBall();
      }, BALL_INTERVAL_MS);

      activeTimers.set(roomId, loopTimer);
    };

    callNextBall();
  };

  const scheduleRoom = (roomId: string, state: BingoRoomState) => {
    if (activeTimers.has(roomId)) return;

    // Grace buffer allows all network clients whose timer hits 0 to submit their room:join
    const delay = Math.max(0, state.startsAt - Date.now()) + 1200;
    const timer = setTimeout(async () => {
      activeTimers.delete(roomId);

      const latest = localRooms.get(roomId);
      if (!latest || latest.status !== 'waiting') return;

      // Only restart countdown if NO players joined with cartelas
      if (latest.players.length === 0) {
        latest.startsAt = Date.now() + ROOM_JOIN_WINDOW_MS;
        localRooms.set(roomId, latest);
        sendRoomState(io, roomId, latest);
        scheduleRoom(roomId, latest);
        return;
      }

      // Players have joined! Start the shared synchronized game for all participants!
      await startRoomGame(roomId, latest);
    }, delay);

    activeTimers.set(roomId, timer);
  };

  io.use((socket, next) => {
    const auth = socket.handshake.auth || {};
    const initData = auth.initData;

    const user = validateTelegramInitData(initData, botToken);
    if (!user) {
      return next(new Error('Authentication failed: Invalid telegram hash'));
    }

    const client = socket as AuthenticatedSocket;
    client.data = {
      player: user,
      localDevMode: typeof initData === 'string' && initData.startsWith('mock:'),
    };
    next();
  });

  io.on('connection', (socket) => {
    const client = socket as AuthenticatedSocket;
    const player = client.data.player;
    const playerIdentifier = String(player.username || player.id);

    client.on('cartela:room_enter', async (payload: { stake?: number }, ack) => {
      const stake = Number(payload?.stake) || 10;
      const roomId = roomIdForStake(stake);
      await client.join(roomId);

      let state = localRooms.get(roomId);
      if (!state || state.status === 'finished') {
        state = makeRoomState(stake);
        localRooms.set(roomId, state);
        scheduleRoom(roomId, state);
      }

      sendRoomState(io, roomId, state);
      broadcastCartelaReservations(stake);

      const existingPlayer = state.players.find((p) => String(p.telegramId) === String(player.id));
      const userRes = cartelaReservations[stake] || {};
      const myReservedCardIds = Object.entries(userRes)
        .filter(([_, name]) => name === playerIdentifier || name === player.username)
        .map(([cid]) => Number(cid));

      if (typeof ack === 'function') {
        ack({
          ok: true,
          joinedPlayer: existingPlayer ? {
            cardIds: existingPlayer.cardIds,
            cards: existingPlayer.cardIds.map((id) => generateCartelaByNumber(id)),
            walletType: existingPlayer.walletType,
          } : null,
          myReservedCardIds,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
        });
      }
    });

    client.on('cartela:reserve', (payload: { stake: number; cardIds: number[] }) => {
      const stake = Number(payload.stake);
      const cardIds = Array.isArray(payload.cardIds) ? payload.cardIds : [];

      if (!VALID_STAKES.has(stake)) return;

      // Release any other cartelas previously reserved by this user for this stake
      const userRes = cartelaReservations[stake] || {};
      for (const [cidStr, name] of Object.entries(userRes)) {
        if (name === playerIdentifier || name === player.username) {
          delete userRes[Number(cidStr)];
        }
      }

      // Reserve newly requested cartelas
      cardIds.forEach((id) => {
        userRes[id] = playerIdentifier;
      });

      cartelaReservations[stake] = userRes;
      broadcastCartelaReservations(stake);
    });

    client.on('cartela:release', (payload: { stake: number }) => {
      const stake = Number(payload.stake);
      if (!VALID_STAKES.has(stake)) return;

      const userRes = cartelaReservations[stake] || {};
      for (const [cidStr, name] of Object.entries(userRes)) {
        if (name === playerIdentifier || name === player.username) {
          delete userRes[Number(cidStr)];
        }
      }

      cartelaReservations[stake] = userRes;
      broadcastCartelaReservations(stake);
    });

    client.on('room:join', async (payload: {
      stake?: number;
      cardIds?: number[];
      joinRequestId?: string;
      walletType?: 'main_wallet' | 'play_wallet';
    }, ack) => {
      const stake = Number(payload?.stake) || 10;
      const cardIds = Array.isArray(payload?.cardIds) && payload.cardIds.length > 0 ? payload.cardIds : [1];
      const walletType = payload?.walletType || 'main_wallet';
      const roomId = roomIdForStake(stake);

      await client.join(roomId);

      let state = localRooms.get(roomId);
      if (!state || state.status === 'finished') {
        state = makeRoomState(stake);
        localRooms.set(roomId, state);
        scheduleRoom(roomId, state);
      }

      const cost = stake * cardIds.length;

      // Handle duplicate join check
      const existingJoin = state.players.find((p) => String(p.telegramId) === String(player.id));
      if (existingJoin) {
        const clientCards = existingJoin.cardIds.map((id) => generateCartelaByNumber(id));
        return ack({
          ok: true,
          duplicate: true,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
          cards: clientCards,
          balance: 0,
        });
      }

      // Deduct cost and save player
      try {
        let finalBal = 0;
        let finalMain = 0;
        let finalPlay = 0;

        if (await isPostgresConfigured()) {
          const pgResult = await joinPostgresBingoRoom({
            roomId,
            telegramId: String(player.id),
            name: player.first_name || player.username || 'Player',
            joinRequestId: payload?.joinRequestId || crypto.randomUUID(),
            stake,
            walletType,
            cardIds,
            initialState: state,
          });

          if (!pgResult) return ack({ ok: false, error: 'Could not join room' });
          finalBal = pgResult.balance;
          finalMain = pgResult.mainWallet;
          finalPlay = pgResult.playWallet;
          state = pgResult.state;
        } else {
          // Local JSON DB fallback
          let localUser = (localDb as any).data.users[String(player.id)];
          if (!localUser) {
            localUser = localDb.upsertUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || 'Player',
              username: player.username || `player_${player.id}`,
              balance: 500,
              main_wallet: 500,
              play_wallet: 0,
            });
          }

          let mainWallet = localUser.main_wallet ?? localUser.balance ?? 0;
          let playWallet = localUser.play_wallet ?? 0;

          if (walletType === 'play_wallet') {
            if (playWallet < cost) {
              playWallet = Math.max(playWallet, cost + 50);
              localUser.play_wallet = playWallet;
            }
            playWallet -= cost;
          } else {
            if (mainWallet < cost) {
              mainWallet = Math.max(mainWallet, cost + 100);
              localUser.main_wallet = mainWallet;
              localUser.balance = mainWallet;
            }
            mainWallet -= cost;
          }

          localUser.balance = mainWallet;
          localUser.main_wallet = mainWallet;
          localUser.play_wallet = playWallet;
          localUser.games_played = (localUser.games_played || 0) + 1;
          (localDb as any).scheduleSave();

          finalBal = mainWallet;
          finalMain = mainWallet;
          finalPlay = playWallet;

          state.players.push({
            telegramId: String(player.id),
            name: player.first_name || player.username || 'Player',
            cardIds,
            walletType,
            stake,
            joinRequestId: payload?.joinRequestId || crypto.randomUUID(),
          });

          const totalCards = state.players.reduce((total, p) => total + (p.cardIds?.length || 1), 0);
          state.prizePool = Math.floor(Math.max(totalCards, 1) * state.stake * 0.8);
          localRooms.set(roomId, state);
        }

        // Keep cartela reservation active for this user across game rounds
        const userRes = cartelaReservations[stake] || {};
        cardIds.forEach((id) => {
          userRes[id] = playerIdentifier;
        });
        cartelaReservations[stake] = userRes;
        broadcastCartelaReservations(stake);

        sendRoomState(io, roomId, state);

        const clientCards = cardIds.map((id) => generateCartelaByNumber(id));
        ack({
          ok: true,
          state: publicRoomState(state, getOnlinePlayerIds(io, roomId)),
          cards: clientCards,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
        });
      } catch (err: any) {
        ack({ ok: false, error: err.message || 'Error joining the game' });
      }
    });

    client.on('room:claim', async (payload: { cardId: number; stake?: number }, ack) => {
      const cardId = Number(payload?.cardId);
      if (isNaN(cardId)) return typeof ack === 'function' && ack({ ok: false, error: 'Invalid card ID' });

      // Find which room this socket is actively in
      let foundRoomId = '';
      let state: BingoRoomState | undefined;

      if (payload?.stake && VALID_STAKES.has(Number(payload.stake))) {
        const rId = roomIdForStake(Number(payload.stake));
        if (localRooms.has(rId)) {
          foundRoomId = rId;
          state = localRooms.get(rId);
        }
      }

      if (!state) {
        for (const [rId, room] of localRooms.entries()) {
          if (room.players.some((p) => String(p.telegramId) === String(player.id))) {
            foundRoomId = rId;
            state = room;
            break;
          }
        }
      }

      if (!state) {
        // Fallback: look for any room currently in progress
        for (const [rId, room] of localRooms.entries()) {
          if (room.status === 'in_progress') {
            foundRoomId = rId;
            state = room;
            break;
          }
        }
      }

      if (!state) {
        const defaultRoomId = roomIdForStake(10);
        state = localRooms.get(defaultRoomId);
        foundRoomId = defaultRoomId;
      }

      if (!state || !foundRoomId) {
        return typeof ack === 'function' && ack({ ok: false, error: 'No active room found for this player' });
      }

      if (state.status !== 'in_progress') {
        if (state.status === 'finished' && state.winnerId === String(player.id)) {
          const publicState = publicRoomState(state, getOnlinePlayerIds(io, foundRoomId));
          return typeof ack === 'function' && ack({
            ok: true,
            state: publicState,
            balance: state.prize || 0,
            win: { hasWon: true, patternName: 'Bingo Win', winningCoordinates: [], multiplier: 1.8 },
          });
        }
        return typeof ack === 'function' && ack({ ok: false, error: 'Game is not currently active' });
      }

      let roomPlayer = state.players.find((p) => String(p.telegramId) === String(player.id));
      if (!roomPlayer) {
        roomPlayer = {
          telegramId: String(player.id),
          name: player.first_name || player.username || 'Player',
          cardIds: [cardId],
          walletType: 'main_wallet',
          stake: state.stake,
          joinRequestId: crypto.randomUUID(),
        };
        state.players.push(roomPlayer);
      } else if (!roomPlayer.cardIds.includes(cardId)) {
        roomPlayer.cardIds.push(cardId);
      }

      // Authoritatively generate and check the winning card
      const card = generateCartelaByNumber(cardId);
      const calledSet = new Set(state.called);

      // Verify the daubs
      const verifiedCells = card.cells.map((row) =>
        row.map((cell) => ({
          ...cell,
          isDaubed: cell.isFree || calledSet.has(cell.number),
        }))
      );
      const verifiedCard = { ...card, cells: verifiedCells };
      const winResult = checkCardWinningPatterns(verifiedCard, 'am');

      if (!winResult.hasWon) {
        return ack({ ok: false, error: 'This card does not have a complete winning pattern' });
      }

      // Claim Bingo! Complete the game
      state.status = 'finished';
      state.winnerId = String(player.id);
      state.winningCardId = cardId;

      const totalCards = state.players.reduce((total, p) => total + (p.cardIds?.length || 1), 0);
      const prize = Math.floor(Math.max(totalCards, 1) * state.stake * 0.8);
      state.prize = prize;

      let finalBal = 0;
      let finalMain = 0;
      let finalPlay = 0;

      try {
        if (await isPostgresConfigured()) {
          const pgResult = await awardPostgresBingoPrize(foundRoomId, String(player.id), cardId, prize);
          if (!pgResult) return ack({ ok: false, error: 'Could not award prize' });
          finalBal = pgResult.balance;
          finalMain = pgResult.mainWallet;
          finalPlay = pgResult.playWallet;
          state = pgResult.state;
        } else {
          // Local fallback
          let localUser = (localDb as any).data.users[String(player.id)];
          if (!localUser) {
            localUser = localDb.upsertUser({
              telegram_id: String(player.id),
              first_name: player.first_name || player.username || 'Player',
              username: player.username || `player_${player.id}`,
              balance: 500,
              main_wallet: 500,
              play_wallet: 0,
            });
          }

          const mainWallet = (localUser.main_wallet ?? localUser.balance ?? 0) + prize;
          const playWallet = localUser.play_wallet ?? 0;

          localUser.balance = mainWallet;
          localUser.main_wallet = mainWallet;
          localUser.games_won = (localUser.games_won || 0) + 1;
          (localDb as any).scheduleSave();

          finalBal = mainWallet;
          finalMain = mainWallet;
          finalPlay = playWallet;
        }

        localRooms.set(foundRoomId, state);

        if (await isPostgresConfigured()) {
          await mutatePostgresBingoRoom(foundRoomId, () => state);
        }

        // Cancel the ball calling loop timer
        const activeTimer = activeTimers.get(foundRoomId);
        if (activeTimer) {
          clearTimeout(activeTimer);
          activeTimers.delete(foundRoomId);
        }

        // Release all cartelas so the new game starts fresh
        cartelaReservations[state.stake] = {};
        broadcastCartelaReservations(state.stake);

        // Broadcast the winner and updated room state
        const publicState = publicRoomState(state, getOnlinePlayerIds(io, foundRoomId));
        io.to(foundRoomId).emit('room:state', publicState);

        io.to(foundRoomId).emit('room:winner', {
          gameId: state.gameId,
          winnerId: String(player.id),
          winnerName: player.first_name || player.username || 'Winner',
          cardId,
          prize,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
          win: winResult,
        });

        scheduleRoomReset(foundRoomId);

        // Broadcast updated balance to the winner socket
        socket.emit('wallet:balance', {
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
        });

        ack({
          ok: true,
          state: publicState,
          balance: finalBal,
          mainWallet: finalMain,
          playWallet: finalPlay,
          win: winResult,
        });
      } catch (err: any) {
        ack({ ok: false, error: err.message || 'Error processing victory payout' });
      }
    });

    client.on('room:leave', (payload: { stake: number }) => {
      const stake = Number(payload.stake);
      const roomId = roomIdForStake(stake);
      void client.leave(roomId);
    });

    client.on('disconnect', () => {
      // Find which rooms the player was in and update their online status
      localRooms.forEach((state, rId) => {
        if (state.players.some((p) => String(p.telegramId) === String(player.id))) {
          sendRoomState(io, rId, state);
        }
      });
    });
  });
}