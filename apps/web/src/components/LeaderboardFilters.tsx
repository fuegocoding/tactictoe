'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { GAME_VARIANTS } from '@tactictoe/game-engine';
import styles from './LeaderboardFilters.module.css';

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
];

interface Props {
  period: string;
  variant: string;
  currentSeasonId?: string;
  seasons: { id: string; number: number; isActive: boolean }[];
}

export default function LeaderboardFilters({ period, variant, currentSeasonId, seasons }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set(key, value);
    router.replace('/leaderboard?' + params.toString(), { scroll: false });
  }

  return (
    <div className={styles.filters}>
      <div className={styles.group}>
        {PERIODS.map(p => (
          <button
            key={p.value}
            className={`${styles.pill} ${period === p.value ? styles.active : ''}`}
            onClick={() => update('period', p.value)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className={styles.group}>
        <select
          value={variant}
          onChange={(e) => update('variant', e.target.value)}
          className={styles.select}
        >
          {GAME_VARIANTS.map(v => (
            <option key={v.id} value={v.id}>{v.name}</option>
          ))}
        </select>
      </div>
      {seasons.length > 0 && (
        <div className={styles.group}>
          <select 
            value={currentSeasonId || ''} 
            onChange={(e) => update('season', e.target.value)}
            className={styles.select}
          >
            {seasons.map(s => (
              <option key={s.id} value={s.id}>
                Season {s.number} {s.isActive ? '(Current)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}
