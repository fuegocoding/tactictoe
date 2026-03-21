import puzzlesData from '@/data/puzzles.json';

const EPOCH = new Date('2024-01-01').getTime();
const MS_PER_DAY = 86_400_000;

/** Returns 0-indexed day number since our epoch. */
export function getTodayDayNumber(): number {
  return Math.floor((Date.now() - EPOCH) / MS_PER_DAY);
}

/** Returns today's date string in YYYY-MM-DD for localStorage keying. */
export function getTodayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Returns the puzzle ID for today's daily challenge. */
export function getDailyPuzzleId(): string {
  const day = getTodayDayNumber();
  const puzzles = puzzlesData as typeof puzzlesData;
  const puzzle = puzzles[day % puzzles.length]!;
  return puzzle.id;
}

const DAILY_STORAGE_KEY = 'tactictoe:daily-solved';

interface DailyRecord {
  date: string;
  puzzleId: string;
  solved: boolean;
}

export function getDailyRecord(): DailyRecord | null {
  try {
    const raw = localStorage.getItem(DAILY_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as DailyRecord) : null;
  } catch {
    return null;
  }
}

export function markDailySolved(puzzleId: string): void {
  try {
    const record: DailyRecord = { date: getTodayString(), puzzleId, solved: true };
    localStorage.setItem(DAILY_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // ignore
  }
}

export function isTodayDailySolved(): boolean {
  const record = getDailyRecord();
  if (!record) return false;
  return record.date === getTodayString() && record.solved;
}

/** Returns the milliseconds until the next day (midnight UTC). */
export function msUntilNextDay(): number {
  const now = Date.now();
  const nextMidnight = (Math.floor(now / MS_PER_DAY) + 1) * MS_PER_DAY;
  return nextMidnight - now;
}
