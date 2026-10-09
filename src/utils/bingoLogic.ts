import { BingoBall, BingoCardModel, BingoLetter, CardCell, CompetitorPlayer, WinValidationResult } from '../types';

export const BINGO_LETTERS: BingoLetter[] = ['B', 'I', 'N', 'G', 'O'];

export const LETTER_RANGES: Record<BingoLetter, { min: number; max: number; colorClass: string; bgClass: string; borderClass: string }> = {
  B: { min: 1, max: 15, colorClass: 'text-sky-400', bgClass: 'bg-sky-500', borderClass: 'border-sky-500' },
  I: { min: 16, max: 30, colorClass: 'text-rose-400', bgClass: 'bg-rose-500', borderClass: 'border-rose-500' },
  N: { min: 31, max: 45, colorClass: 'text-amber-400', bgClass: 'bg-amber-500', borderClass: 'border-amber-500' },
  G: { min: 46, max: 60, colorClass: 'text-emerald-400', bgClass: 'bg-emerald-500', borderClass: 'border-emerald-500' },
  O: { min: 61, max: 75, colorClass: 'text-purple-400', bgClass: 'bg-purple-500', borderClass: 'border-purple-500' }
};

export function getLetterForNumber(num: number): BingoLetter {
  if (num <= 15) return 'B';
  if (num <= 30) return 'I';
  if (num <= 45) return 'N';
  if (num <= 60) return 'G';
  return 'O';
}

// Generate random sample from range
function getRandomDistinctNumbers(min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) {
    pool.push(i);
  }
  // Shuffle pool (Fisher-Yates)
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// Deterministic PRNG for cartela numbers by cartela number
function getSeededDistinctNumbers(seed: number, min: number, max: number, count: number): number[] {
  const pool: number[] = [];
  for (let i = min; i <= max; i++) {
    pool.push(i);
  }
  let currentSeed = (seed * 9301 + 49297) % 233280;
  const rnd = () => {
    currentSeed = (currentSeed * 9301 + 49297) % 233280;
    return currentSeed / 233280;
  };
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

// Create a deterministic 5x5 Bingo Card for specific cartel number
export function generateCartelaByNumber(cartelaNumber: number): BingoCardModel {
  const bNums = getSeededDistinctNumbers(cartelaNumber * 7 + 1, 1, 15, 5);
  const iNums = getSeededDistinctNumbers(cartelaNumber * 13 + 3, 16, 30, 5);
  const nNums = getSeededDistinctNumbers(cartelaNumber * 19 + 5, 31, 45, 4);
  const gNums = getSeededDistinctNumbers(cartelaNumber * 23 + 7, 46, 60, 5);
  const oNums = getSeededDistinctNumbers(cartelaNumber * 29 + 11, 61, 75, 5);

  const cells: CardCell[][] = [];

  for (let row = 0; row < 5; row++) {
    const rowCells: CardCell[] = [];
    for (let col = 0; col < 5; col++) {
      const letter = BINGO_LETTERS[col];
      const isFree = row === 2 && col === 2;
      let num = 0;

      if (!isFree) {
        if (col === 0) num = bNums[row];
        else if (col === 1) num = iNums[row];
        else if (col === 2) {
          num = row < 2 ? nNums[row] : nNums[row - 1];
        } else if (col === 3) num = gNums[row];
        else if (col === 4) num = oNums[row];
      }

      rowCells.push({
        row,
        col,
        number: num,
        letter,
        isFree,
        isDaubed: isFree,
        isWinningCell: false
      });
    }
    cells.push(rowCells);
  }

  return {
    id: `cartel-${cartelaNumber}`,
    cardIndex: cartelaNumber,
    cells,
    hasWon: false,
    numbersNeeded: 4
  };
}

// Create a single 5x5 Bingo Card
export function generateBingoCard(cardIndex: number): BingoCardModel {
  const bNums = getRandomDistinctNumbers(1, 15, 5);
  const iNums = getRandomDistinctNumbers(16, 30, 5);
  const nNums = getRandomDistinctNumbers(31, 45, 4); // 4 nums + 1 free space
  const gNums = getRandomDistinctNumbers(46, 60, 5);
  const oNums = getRandomDistinctNumbers(61, 75, 5);

  const cells: CardCell[][] = [];

  for (let row = 0; row < 5; row++) {
    const rowCells: CardCell[] = [];
    for (let col = 0; col < 5; col++) {
      const letter = BINGO_LETTERS[col];
      const isFree = row === 2 && col === 2;
      let num = 0;

      if (!isFree) {
        if (col === 0) num = bNums[row];
        else if (col === 1) num = iNums[row];
        else if (col === 2) {
          // row 0, 1 -> 0, 1; row 3, 4 -> 2, 3
          num = row < 2 ? nNums[row] : nNums[row - 1];
        } else if (col === 3) num = gNums[row];
        else if (col === 4) num = oNums[row];
      }

      rowCells.push({
        row,
        col,
        number: num,
        letter,
        isFree,
        isDaubed: isFree, // Free space is always daubed by default
        isWinningCell: false
      });
    }
    cells.push(rowCells);
  }

  return {
    id: `card-${cardIndex}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    cardIndex,
    cells,
    hasWon: false,
    numbersNeeded: 4 // Usually 4 or 5 numbers needed for a line
  };
}

// Generate a full deck of 75 randomized balls
export function generateShuffledDeck(): BingoBall[] {
  const deck: BingoBall[] = [];
  for (let num = 1; num <= 75; num++) {
    deck.push({
      number: num,
      letter: getLetterForNumber(num),
      id: `ball-${num}`
    });
  }
  // Shuffle
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Check for winning patterns on a card
export function checkCardWinningPatterns(card: BingoCardModel, lang: 'am' | 'en' | 'om' = 'am'): WinValidationResult {
  const cells = card.cells;

  // 1. Check Full House (Blackout - 25 cells)
  let isFullHouse = true;
  const fullCoords: Array<{ row: number; col: number }> = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      fullCoords.push({ row: r, col: c });
      if (!cells[r][c].isDaubed) {
        isFullHouse = false;
      }
    }
  }
  if (isFullHouse) {
    return {
      hasWon: true,
      patternType: 'fullHouse',
      patternName: lang === 'am' ? 'ሙሉ ካርድ (Full House)' : (lang === 'om' ? 'Mana Guutuu (Full House)' : 'Full House (Blackout)'),
      winningCoordinates: fullCoords,
      multiplier: 3.5
    };
  }

  // 2. Check Horizontal Rows
  for (let r = 0; r < 5; r++) {
    let rowComplete = true;
    const rowCoords: Array<{ row: number; col: number }> = [];
    for (let c = 0; c < 5; c++) {
      rowCoords.push({ row: r, col: c });
      if (!cells[r][c].isDaubed) {
        rowComplete = false;
        break;
      }
    }
    if (rowComplete) {
      return {
        hasWon: true,
        patternType: 'line',
        patternName: lang === 'am' ? `አግድም ረድፍ ${r + 1} (Row ${r + 1})` : (lang === 'om' ? `Sarara Dalgee ${r + 1}` : `Horizontal Line (Row ${r + 1})`),
        winningCoordinates: rowCoords,
        multiplier: 1.8
      };
    }
  }

  // 3. Check Vertical Columns
  for (let c = 0; c < 5; c++) {
    let colComplete = true;
    const colCoords: Array<{ row: number; col: number }> = [];
    for (let r = 0; r < 5; r++) {
      colCoords.push({ row: r, col: c });
      if (!cells[r][c].isDaubed) {
        colComplete = false;
        break;
      }
    }
    if (colComplete) {
      return {
        hasWon: true,
        patternType: 'line',
        patternName: lang === 'am' ? `ቁልቁል ረድፍ '${BINGO_LETTERS[c]}' (Column ${BINGO_LETTERS[c]})` : (lang === 'om' ? `Sarara Ol-Gadii '${BINGO_LETTERS[c]}'` : `Vertical Column (${BINGO_LETTERS[c]})`),
        winningCoordinates: colCoords,
        multiplier: 1.8
      };
    }
  }

  // 4. Check Diagonal (Top-Left to Bottom-Right)
  let diag1Complete = true;
  const diag1Coords: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < 5; i++) {
    diag1Coords.push({ row: i, col: i });
    if (!cells[i][i].isDaubed) {
      diag1Complete = false;
      break;
    }
  }
  if (diag1Complete) {
    return {
      hasWon: true,
      patternType: 'line',
      patternName: lang === 'am' ? 'ዲያጎናል መስመር ↘ (Diagonal)' : (lang === 'om' ? 'Sarara Qaxxaamuraa ↘' : 'Diagonal Line (Top-Left to Bottom-Right)'),
      winningCoordinates: diag1Coords,
      multiplier: 2.0
    };
  }

  // 5. Check Diagonal (Top-Right to Bottom-Left)
  let diag2Complete = true;
  const diag2Coords: Array<{ row: number; col: number }> = [];
  for (let i = 0; i < 5; i++) {
    diag2Coords.push({ row: i, col: 4 - i });
    if (!cells[i][4 - i].isDaubed) {
      diag2Complete = false;
      break;
    }
  }
  if (diag2Complete) {
    return {
      hasWon: true,
      patternType: 'line',
      patternName: lang === 'am' ? 'ዲያጎናል መስመር ↗ (Diagonal)' : (lang === 'om' ? 'Sarara Qaxxaamuraa ↗' : 'Diagonal Line (Top-Right to Bottom-Left)'),
      winningCoordinates: diag2Coords,
      multiplier: 2.0
    };
  }

  // 6. Check Four Corners
  const cornerCoords = [
    { row: 0, col: 0 },
    { row: 0, col: 4 },
    { row: 4, col: 0 },
    { row: 4, col: 4 }
  ];
  const cornersComplete = cornerCoords.every((coord) => cells[coord.row][coord.col].isDaubed);
  if (cornersComplete) {
    return {
      hasWon: true,
      patternType: 'corners',
      patternName: lang === 'am' ? 'አራት ማዕዘናት (4 Corners)' : (lang === 'om' ? 'Kofa 4 (4 Corners)' : '4 Corners'),
      winningCoordinates: cornerCoords,
      multiplier: 2.2
    };
  }

  return {
    hasWon: false,
    patternName: '',
    winningCoordinates: [],
    multiplier: 1.0
  };
}

// Calculate minimum numbers needed to win any pattern
export function calculateNumbersNeeded(card: BingoCardModel): number {
  const cells = card.cells;
  let minNeeded = 5;

  // Rows
  for (let r = 0; r < 5; r++) {
    let unDaubed = 0;
    for (let c = 0; c < 5; c++) {
      if (!cells[r][c].isDaubed) unDaubed++;
    }
    if (unDaubed < minNeeded) minNeeded = unDaubed;
  }

  // Columns
  for (let c = 0; c < 5; c++) {
    let unDaubed = 0;
    for (let r = 0; r < 5; r++) {
      if (!cells[r][c].isDaubed) unDaubed++;
    }
    if (unDaubed < minNeeded) minNeeded = unDaubed;
  }

  // Diagonals
  let diag1 = 0;
  let diag2 = 0;
  for (let i = 0; i < 5; i++) {
    if (!cells[i][i].isDaubed) diag1++;
    if (!cells[i][4 - i].isDaubed) diag2++;
  }
  if (diag1 < minNeeded) minNeeded = diag1;
  if (diag2 < minNeeded) minNeeded = diag2;

  // Corners
  const corners = [
    cells[0][0].isDaubed,
    cells[0][4].isDaubed,
    cells[4][0].isDaubed,
    cells[4][4].isDaubed
  ].filter((d) => !d).length;
  if (corners < minNeeded) minNeeded = corners;

  return minNeeded;
}

// Generate Realistic Ethiopian Competitors
export function generateCompetitors(): CompetitorPlayer[] {
  const names = [
    { name: 'Abebe B.', avatar: '🦁' },
    { name: 'Tigist M.', avatar: '🌸' },
    { name: 'Dawit G.', avatar: '⚡' },
    { name: 'Selamawit K.', avatar: '✨' },
    { name: 'Yared A.', avatar: '👑' },
    { name: 'Marta T.', avatar: '💎' },
    { name: 'Ephrem S.', avatar: '🎯' },
    { name: 'Helen Z.', avatar: '🔥' }
  ];

  return names.map((item, idx) => ({
    id: `bot-${idx + 1}`,
    name: item.name,
    avatar: item.avatar,
    cardsCount: Math.floor(Math.random() * 3) + 1,
    remainingToWin: Math.floor(Math.random() * 3) + 3,
    hasWon: false
  }));
}

export const GLOBAL_SELECTION_WINDOW_MS = 35_000;

export interface GlobalBingoCycleInfo {
  cycleIndex: number;
  gameId: string;
  cycleStart: number;
  selectionEndsAt: number;
  remainingSeconds: number;
}

export function getGlobalBingoCycle(now = Date.now()): GlobalBingoCycleInfo {
  const cycleIndex = Math.floor(now / GLOBAL_SELECTION_WINDOW_MS);
  const cycleStart = cycleIndex * GLOBAL_SELECTION_WINDOW_MS;
  const selectionEndsAt = cycleStart + GLOBAL_SELECTION_WINDOW_MS;
  const remainingSeconds = Math.max(0, Math.ceil((selectionEndsAt - now) / 1000));

  return {
    cycleIndex,
    gameId: `salery-live-${cycleIndex}`,
    cycleStart,
    selectionEndsAt,
    remainingSeconds: Math.min(35, remainingSeconds),
  };
}

export function getDeterministicRoundDeck(cycleIndex: number): number[] {
  let seed = Math.abs(Math.sin(cycleIndex * 1337 + 42)) * 10000;
  const rnd = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
  const pool = Array.from({ length: 75 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
}
