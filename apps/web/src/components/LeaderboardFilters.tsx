'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import styles from './LeaderboardFilters.module.css';

const PERIODS = [
  { value: 'all', label: 'All time' },
  { value: 'month', label: 'This month' },
  { value: 'week', label: 'This week' },
];

const VARIANTS = [
  { value: 'ultimate_ttt', label: 'Ultimate TTT' },
  { value: 'standard_3x3', label: 'Standard 3×3' },
];

interface Props {
  period: string;
  variant: string;
}

export default function LeaderboardFilters({ period, variant }: Props) {
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
        {VARIANTS.map(v => (
          <button
            key={v.value}
            className={`${styles.pill} ${variant === v.value ? styles.active : ''}`}
            onClick={() => update('variant', v.value)}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  );
}
