'use client';

import { useTheme } from '@/context/ThemeContext';

export default function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        borderRadius: 'var(--radius)',
        color: 'var(--text-muted)',
        transition: 'color 0.15s, background 0.15s',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 18,
      }}
    >
      {theme === 'light' ? '☾' : '☀'}
    </button>
  );
}
