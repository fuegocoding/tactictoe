import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getTodayDayNumber } from './puzzle-of-the-day';

describe('getTodayDayNumber', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 0 exactly at the epoch (2024-01-01T00:00:00.000Z)', () => {
    vi.setSystemTime(new Date('2024-01-01T00:00:00.000Z'));
    expect(getTodayDayNumber()).toBe(0);
  });

  it('returns 0 at the very end of the epoch day', () => {
    vi.setSystemTime(new Date('2024-01-01T23:59:59.999Z'));
    expect(getTodayDayNumber()).toBe(0);
  });

  it('returns 1 at the start of the next day', () => {
    vi.setSystemTime(new Date('2024-01-02T00:00:00.000Z'));
    expect(getTodayDayNumber()).toBe(1);
  });

  it('returns -1 just before the epoch', () => {
    vi.setSystemTime(new Date('2023-12-31T23:59:59.999Z'));
    expect(getTodayDayNumber()).toBe(-1);
  });

  it('accounts for leap years correctly (366 days in 2024)', () => {
    vi.setSystemTime(new Date('2025-01-01T00:00:00.000Z'));
    expect(getTodayDayNumber()).toBe(366);
  });
});
