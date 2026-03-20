# Plan 4: UI Overhaul + Local Play

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all inline-style utilitarian UI with a proper design system and rebuild every page on top of it. Add dark mode. Add a local (pass-and-play) game mode so two people can play on the same device without any network or account.

**Visual direction:**
- **Light mode (default):** Off-white/cream background (`#f8f7f4`), warm amber accent (`#d97706`). Clean, premium, approachable.
- **Dark mode:** Near-black background (`#0f0f0f`), single green accent (`#22c55e`). Serious and competitive.
- **Typography:** Inter (via `next/font/google`), system-ui fallback.
- **No Tailwind.** CSS variables in `globals.css` + CSS Modules per component. Inline styles only for dynamic game-state values.
- **Not AI-generated aesthetic.** No purple. No gradients on everything. No glassmorphism. Flat, crisp, purposeful.

**Architecture:** Design tokens live in `globals.css` as CSS custom properties. A `ThemeProvider` context wraps the app and writes `data-theme="dark"` to `<html>`. Theme preference persists to `localStorage`. All components reference `var(--token)` — never hardcoded hex. Board components keep dynamic colors (active border, current player highlight) as inline styles that read from CSS variables via `getComputedStyle` or direct var() references.

---

## File Map

```
apps/web/src/
├── app/
│   ├── globals.css                      ← NEW: design tokens + base reset + typography
│   ├── layout.tsx                       ← MODIFY: add Inter font, ThemeProvider, Nav
│   ├── page.tsx                         ← MODIFY: rebuild lobby
│   ├── local/
│   │   └── page.tsx                     ← NEW: local pass-and-play game
│   ├── login/page.tsx                   ← MODIFY: rebuild with design system
│   └── register/page.tsx               ← MODIFY: rebuild with design system
│   └── room/[code]/page.tsx            ← MODIFY: rebuild with design system
├── components/
│   ├── Providers.tsx                    ← MODIFY: wrap with ThemeProvider
│   ├── Nav.tsx                          ← NEW: top navigation bar
│   ├── ThemeToggle.tsx                  ← NEW: light/dark toggle button
│   ├── board/
│   │   ├── StandardBoard.tsx            ← MODIFY: use CSS variables
│   │   └── UltimateBoard.tsx            ← MODIFY: use CSS variables
│   └── ui/
│       ├── Button.tsx                   ← NEW: Button component (primary/secondary/ghost)
│       ├── Button.module.css            ← NEW
│       ├── Input.tsx                    ← NEW: Input + Label component
│       ├── Input.module.css             ← NEW
│       ├── Card.tsx                     ← NEW: Card wrapper component
│       ├── Card.module.css              ← NEW
│       ├── Badge.tsx                    ← NEW: small status badge
│       ├── Badge.module.css             ← NEW
│       └── CopyButton.tsx               ← EXISTS: update to use Button component
└── context/
    └── ThemeContext.tsx                 ← NEW: ThemeProvider + useTheme hook
```

---

## Task 1: Design Tokens + Global CSS

**Files:**
- Create: `apps/web/src/app/globals.css`
- Modify: `apps/web/src/app/layout.tsx` (import globals.css + Inter font)

- [ ] **Step 1.1: Create `apps/web/src/app/globals.css`**

```css
/* ── Reset ──────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 16px; -webkit-text-size-adjust: 100%; }
body { line-height: 1.5; -webkit-font-smoothing: antialiased; }
img, picture, video, canvas, svg { display: block; max-width: 100%; }
input, button, textarea, select { font: inherit; }
p, h1, h2, h3, h4, h5, h6 { overflow-wrap: break-word; }
a { color: inherit; text-decoration: none; }
button { cursor: pointer; border: none; background: none; }

/* ── Light Mode Tokens (default) ────────────────────────────────────────── */
:root {
  /* Backgrounds */
  --bg:            #f8f7f4;
  --bg-raised:     #ffffff;
  --bg-subtle:     #f0ede8;
  --bg-hover:      #ebe7e1;

  /* Text */
  --text:          #1a1a1a;
  --text-muted:    #6b7280;
  --text-faint:    #9ca3af;

  /* Borders */
  --border:        #e5e2db;
  --border-strong: #d1cdc7;

  /* Accent (amber) */
  --accent:        #d97706;
  --accent-hover:  #b45309;
  --accent-subtle: #fef3c7;
  --accent-text:   #ffffff;

  /* Semantic */
  --success:       #16a34a;
  --success-subtle:#dcfce7;
  --error:         #dc2626;
  --error-subtle:  #fef2f2;
  --warning:       #d97706;

  /* Board */
  --board-cell-bg:      #ffffff;
  --board-cell-border:  #e5e2db;
  --board-active-border:#d97706;
  --board-inactive-border: #e5e2db;
  --board-result-overlay: rgba(248, 247, 244, 0.85);
  --mark-x:        #1a1a1a;
  --mark-o:        #d97706;

  /* Shadows */
  --shadow-sm:     0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow:        0 2px 8px rgba(0, 0, 0, 0.08);
  --shadow-lg:     0 8px 24px rgba(0, 0, 0, 0.10);

  /* Radius */
  --radius-sm:     4px;
  --radius:        6px;
  --radius-lg:     10px;
  --radius-xl:     16px;

  /* Spacing scale (4px base) */
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* Typography */
  --font-sans: 'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-mono: 'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace;

  --text-xs:   0.75rem;   /* 12px */
  --text-sm:   0.875rem;  /* 14px */
  --text-base: 1rem;      /* 16px */
  --text-lg:   1.125rem;  /* 18px */
  --text-xl:   1.25rem;   /* 20px */
  --text-2xl:  1.5rem;    /* 24px */
  --text-3xl:  1.875rem;  /* 30px */
  --text-4xl:  2.25rem;   /* 36px */

  /* Nav height */
  --nav-height: 52px;
}

/* ── Dark Mode Tokens ───────────────────────────────────────────────────── */
[data-theme="dark"] {
  --bg:            #0f0f0f;
  --bg-raised:     #1a1a1a;
  --bg-subtle:     #141414;
  --bg-hover:      #222222;

  --text:          #f3f4f6;
  --text-muted:    #9ca3af;
  --text-faint:    #6b7280;

  --border:        #2a2a2a;
  --border-strong: #3a3a3a;

  --accent:        #22c55e;
  --accent-hover:  #16a34a;
  --accent-subtle: #052e16;
  --accent-text:   #000000;

  --success:       #22c55e;
  --success-subtle:#052e16;
  --error:         #f87171;
  --error-subtle:  #450a0a;
  --warning:       #fbbf24;

  --board-cell-bg:       #1a1a1a;
  --board-cell-border:   #2a2a2a;
  --board-active-border: #22c55e;
  --board-inactive-border: #2a2a2a;
  --board-result-overlay: rgba(15, 15, 15, 0.85);
  --mark-x:        #f3f4f6;
  --mark-o:        #22c55e;

  --shadow-sm:     0 1px 2px rgba(0, 0, 0, 0.4);
  --shadow:        0 2px 8px rgba(0, 0, 0, 0.5);
  --shadow-lg:     0 8px 24px rgba(0, 0, 0, 0.6);
}

/* ── Base Styles ────────────────────────────────────────────────────────── */
body {
  font-family: var(--font-sans);
  background-color: var(--bg);
  color: var(--text);
  transition: background-color 0.15s ease, color 0.15s ease;
}

/* ── Utility Classes ────────────────────────────────────────────────────── */
.text-muted  { color: var(--text-muted); }
.text-faint  { color: var(--text-faint); }
.text-accent { color: var(--accent); }
.text-error  { color: var(--error); }
.text-success{ color: var(--success); }

.text-xs   { font-size: var(--text-xs); }
.text-sm   { font-size: var(--text-sm); }
.text-base { font-size: var(--text-base); }
.text-lg   { font-size: var(--text-lg); }
.text-xl   { font-size: var(--text-xl); }
.text-2xl  { font-size: var(--text-2xl); }
.text-3xl  { font-size: var(--text-3xl); }

.font-mono  { font-family: var(--font-mono); }
.font-medium{ font-weight: 500; }
.font-semi  { font-weight: 600; }
.font-bold  { font-weight: 700; }

.sr-only {
  position: absolute; width: 1px; height: 1px;
  padding: 0; margin: -1px; overflow: hidden;
  clip: rect(0,0,0,0); white-space: nowrap; border: 0;
}
```

- [ ] **Step 1.2: Update `apps/web/src/app/layout.tsx`**

Import Inter font and globals.css. Add `suppressHydrationWarning` on `<html>` (needed for theme script to avoid mismatch).

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'TacticToe',
  description: 'Competitive Tic-Tac-Toe and its deeper variants',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        {/* Inline theme script — runs before React hydrates to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme');
                if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

Note: The inline script runs synchronously before paint to prevent theme flash (FOUC). This is the standard approach used by Radix, shadcn, etc.

- [ ] **Step 1.3: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/src/app/layout.tsx
git commit -m "feat(web): add design tokens, globals.css, Inter font, theme flash prevention"
```

---

## Task 2: Theme Context + ThemeToggle

**Files:**
- Create: `apps/web/src/context/ThemeContext.tsx`
- Create: `apps/web/src/components/ThemeToggle.tsx`
- Modify: `apps/web/src/components/Providers.tsx`

- [ ] **Step 2.1: Create `apps/web/src/context/ThemeContext.tsx`**

```tsx
'use client';

import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'light',
  toggle: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>('light');

  useEffect(() => {
    // Read the theme that was already applied by the inline script
    const current = document.documentElement.getAttribute('data-theme');
    setTheme(current === 'dark' ? 'dark' : 'light');
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('theme', next); } catch {}
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2.2: Create `apps/web/src/components/ThemeToggle.tsx`**

```tsx
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
```

- [ ] **Step 2.3: Update `apps/web/src/components/Providers.tsx`**

Add ThemeProvider wrapping:

```tsx
'use client';

import { SessionProvider } from 'next-auth/react';
import { useEffect } from 'react';
import { ThemeProvider } from '@/context/ThemeContext';

function GuestSessionInitializer() {
  useEffect(() => {
    fetch('/api/guest-session', { method: 'POST' }).catch(() => {});
  }, []);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        <GuestSessionInitializer />
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
```

- [ ] **Step 2.4: Commit**

```bash
git add apps/web/src/context/ThemeContext.tsx apps/web/src/components/ThemeToggle.tsx apps/web/src/components/Providers.tsx
git commit -m "feat(web): add ThemeProvider, ThemeToggle, wrap Providers with theme context"
```

---

## Task 3: Shared UI Components

**Files:**
- Create: `apps/web/src/components/ui/Button.tsx` + `Button.module.css`
- Create: `apps/web/src/components/ui/Input.tsx` + `Input.module.css`
- Create: `apps/web/src/components/ui/Card.tsx` + `Card.module.css`
- Create: `apps/web/src/components/ui/Badge.tsx` + `Badge.module.css`
- Modify: `apps/web/src/components/ui/CopyButton.tsx`

- [ ] **Step 3.1: Create `apps/web/src/components/ui/Button.module.css`**

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  padding: 0 var(--space-4);
  height: 38px;
  font-size: var(--text-sm);
  font-weight: 600;
  border-radius: var(--radius);
  border: 1px solid transparent;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease, opacity 0.12s ease;
  white-space: nowrap;
  user-select: none;
  text-decoration: none;
}

.btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.btn:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}

/* Size variants */
.sm { height: 30px; padding: 0 var(--space-3); font-size: var(--text-xs); }
.lg { height: 46px; padding: 0 var(--space-6); font-size: var(--text-base); }
.full { width: 100%; }

/* Variants */
.primary {
  background: var(--accent);
  color: var(--accent-text);
  border-color: var(--accent);
}
.primary:hover:not(:disabled) { background: var(--accent-hover); border-color: var(--accent-hover); }

.secondary {
  background: var(--bg-raised);
  color: var(--text);
  border-color: var(--border-strong);
}
.secondary:hover:not(:disabled) { background: var(--bg-hover); }

.ghost {
  background: transparent;
  color: var(--text-muted);
  border-color: transparent;
}
.ghost:hover:not(:disabled) { background: var(--bg-hover); color: var(--text); }

.danger {
  background: var(--error);
  color: #fff;
  border-color: var(--error);
}
.danger:hover:not(:disabled) { opacity: 0.85; }
```

- [ ] **Step 3.2: Create `apps/web/src/components/ui/Button.tsx`**

```tsx
import { forwardRef } from 'react';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  full?: boolean;
  loading?: boolean;
  as?: 'button' | 'a';
  href?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', full, loading, className, children, disabled, ...props }, ref) => {
    const classes = [
      styles.btn,
      styles[variant],
      size !== 'md' ? styles[size] : '',
      full ? styles.full : '',
      className ?? '',
    ].filter(Boolean).join(' ');

    return (
      <button ref={ref} className={classes} disabled={disabled || loading} {...props}>
        {loading ? <span style={{ opacity: 0.6 }}>Loading…</span> : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
export default Button;
```

- [ ] **Step 3.3: Create `apps/web/src/components/ui/Input.module.css`**

```css
.wrapper { display: flex; flex-direction: column; gap: var(--space-1); }

.label {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
}

.input {
  height: 38px;
  padding: 0 var(--space-3);
  background: var(--bg-raised);
  color: var(--text);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  font-size: var(--text-sm);
  transition: border-color 0.12s, box-shadow 0.12s;
  width: 100%;
}

.input::placeholder { color: var(--text-faint); }

.input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--accent) 20%, transparent);
}

.input:disabled { opacity: 0.5; cursor: not-allowed; }
.input.error { border-color: var(--error); }

.hint { font-size: var(--text-xs); color: var(--text-muted); }
.errorText { font-size: var(--text-xs); color: var(--error); }
```

- [ ] **Step 3.4: Create `apps/web/src/components/ui/Input.tsx`**

```tsx
import { forwardRef } from 'react';
import styles from './Input.module.css';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, hint, error, id, className, ...props }, ref) => {
    const inputId = id ?? label?.toLowerCase().replace(/\s+/g, '-');
    return (
      <div className={styles.wrapper}>
        {label && <label htmlFor={inputId} className={styles.label}>{label}</label>}
        <input
          ref={ref}
          id={inputId}
          className={[styles.input, error ? styles.error : '', className ?? ''].filter(Boolean).join(' ')}
          {...props}
        />
        {hint && !error && <p className={styles.hint}>{hint}</p>}
        {error && <p className={styles.errorText}>{error}</p>}
      </div>
    );
  }
);
Input.displayName = 'Input';
export default Input;
```

- [ ] **Step 3.5: Create `apps/web/src/components/ui/Card.module.css`**

```css
.card {
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-sm);
  padding: var(--space-6);
}

.flat { box-shadow: none; }
.compact { padding: var(--space-4); }
```

- [ ] **Step 3.6: Create `apps/web/src/components/ui/Card.tsx`**

```tsx
import styles from './Card.module.css';

interface CardProps {
  children: React.ReactNode;
  flat?: boolean;
  compact?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export default function Card({ children, flat, compact, className, style }: CardProps) {
  const classes = [
    styles.card,
    flat ? styles.flat : '',
    compact ? styles.compact : '',
    className ?? '',
  ].filter(Boolean).join(' ');
  return <div className={classes} style={style}>{children}</div>;
}
```

- [ ] **Step 3.7: Create `apps/web/src/components/ui/Badge.module.css`**

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border-radius: var(--radius-sm);
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.5;
}

.default  { background: var(--bg-subtle); color: var(--text-muted); }
.accent   { background: var(--accent-subtle); color: var(--accent); }
.success  { background: var(--success-subtle); color: var(--success); }
.error    { background: var(--error-subtle); color: var(--error); }
```

- [ ] **Step 3.8: Create `apps/web/src/components/ui/Badge.tsx`**

```tsx
import styles from './Badge.module.css';

type BadgeVariant = 'default' | 'accent' | 'success' | 'error';

export default function Badge({
  children,
  variant = 'default',
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
}) {
  return <span className={`${styles.badge} ${styles[variant]}`}>{children}</span>;
}
```

- [ ] **Step 3.9: Update `apps/web/src/components/ui/CopyButton.tsx`**

Replace inline-styled button with Button component:

```tsx
'use client';

import { useState } from 'react';
import Button from './Button';

export default function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <Button variant="secondary" size="sm" onClick={handleCopy}>
      {copied ? 'Copied!' : 'Copy'}
    </Button>
  );
}
```

- [ ] **Step 3.10: Commit**

```bash
git add apps/web/src/components/ui/
git commit -m "feat(web): add Button, Input, Card, Badge shared UI components with CSS modules"
```

---

## Task 4: Navigation Bar

**Files:**
- Create: `apps/web/src/components/Nav.tsx`
- Create: `apps/web/src/components/Nav.module.css`
- Modify: `apps/web/src/app/layout.tsx`

- [ ] **Step 4.1: Create `apps/web/src/components/Nav.module.css`**

```css
.nav {
  position: sticky;
  top: 0;
  z-index: 100;
  height: var(--nav-height);
  background: var(--bg-raised);
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  padding: 0 var(--space-6);
}

.inner {
  width: 100%;
  max-width: 1100px;
  margin: 0 auto;
  display: flex;
  align-items: center;
  gap: var(--space-4);
}

.logo {
  font-size: var(--text-base);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text);
  text-decoration: none;
}

.logo span { color: var(--accent); }

.spacer { flex: 1; }

.actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.username {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-muted);
}
```

- [ ] **Step 4.2: Create `apps/web/src/components/Nav.tsx`**

```tsx
import Link from 'next/link';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import ThemeToggle from './ThemeToggle';
import Button from './ui/Button';
import styles from './Nav.module.css';

export default async function Nav() {
  const session = await getServerSession(authOptions);

  return (
    <nav className={styles.nav}>
      <div className={styles.inner}>
        <Link href="/" className={styles.logo}>
          Tactic<span>Toe</span>
        </Link>

        <div className={styles.spacer} />

        <div className={styles.actions}>
          <ThemeToggle />
          {session?.user ? (
            <span className={styles.username}>{session.user.name ?? session.user.email}</span>
          ) : (
            <>
              <Button as="a" href="/login" variant="ghost" size="sm">Sign in</Button>
              <Button as="a" href="/register" variant="primary" size="sm">Register</Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
```

Note: Nav is a server component (reads session server-side). ThemeToggle is a client component. They compose fine.

- [ ] **Step 4.3: Update `apps/web/src/app/layout.tsx`** — add `<Nav />` inside body

```tsx
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Providers from '@/components/Providers';
import Nav from '@/components/Nav';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });

export const metadata: Metadata = {
  title: 'TacticToe',
  description: 'Competitive Tic-Tac-Toe and its deeper variants',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `try{var t=localStorage.getItem('theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.setAttribute('data-theme','dark');}}catch(e){}` }} />
      </head>
      <body>
        <Providers>
          <Nav />
          <main style={{ minHeight: `calc(100vh - var(--nav-height))` }}>
            {children}
          </main>
        </Providers>
      </body>
    </html>
  );
}
```

- [ ] **Step 4.4: Commit**

```bash
git add apps/web/src/components/Nav.tsx apps/web/src/components/Nav.module.css apps/web/src/app/layout.tsx
git commit -m "feat(web): add sticky Nav with logo, theme toggle, auth actions"
```

---

## Task 5: Rebuild Lobby Page

**Files:**
- Modify: `apps/web/src/app/page.tsx`
- Create: `apps/web/src/app/page.module.css`

- [ ] **Step 5.1: Create `apps/web/src/app/page.module.css`**

```css
.page {
  max-width: 520px;
  margin: 0 auto;
  padding: var(--space-12) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
}

.hero { text-align: center; }

.title {
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text);
  margin-bottom: var(--space-2);
}

.title span { color: var(--accent); }

.subtitle {
  font-size: var(--text-base);
  color: var(--text-muted);
}

.section { display: flex; flex-direction: column; gap: var(--space-3); }

.sectionLabel {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-faint);
  font-size: var(--text-xs);
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.joinRow {
  display: flex;
  gap: var(--space-2);
}

.joinRow > :first-child { flex: 1; }

.error {
  font-size: var(--text-sm);
  color: var(--error);
  padding: var(--space-3) var(--space-4);
  background: var(--error-subtle);
  border-radius: var(--radius);
  border: 1px solid var(--error);
}

.guestCta {
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
}

.guestCta a {
  color: var(--accent);
  font-weight: 500;
}

.guestCta a:hover { text-decoration: underline; }

.localLink {
  font-size: var(--text-sm);
  color: var(--text-muted);
  text-align: center;
  padding-top: var(--space-2);
}

.localLink a {
  color: var(--text-muted);
  font-weight: 500;
  text-decoration: underline;
}

.localLink a:hover { color: var(--text); }
```

- [ ] **Step 5.2: Rewrite `apps/web/src/app/page.tsx`**

Key behavior changes from the original:
- Replace all inline styles with CSS module classes
- Add "Play Locally (same screen)" link to `/local`
- Keep all existing socket logic (room:create, room:join) intact — only visual layer changes

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useGuestSession } from '@/hooks/useGuestSession';
import { getSocket } from '@/lib/socket-client';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import styles from './page.module.css';

export default function LobbyPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const guestSession = useGuestSession();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreateRoom = () => {
    if (!guestSession) return;
    setCreating(true);
    setError(null);
    const socket = getSocket();
    socket.emit('room:create', {
      guestId: guestSession.guestId,
      displayName: session?.user?.name ?? guestSession.displayName,
      variantId: 'ultimate_ttt',
    });
    socket.once('room:created', ({ roomCode, playerIndex }: { roomCode: string; playerIndex: number }) => {
      sessionStorage.setItem(`room:${roomCode}:playerIndex`, String(playerIndex));
      router.push(`/room/${roomCode}`);
    });
    socket.once('error', ({ message }: { message: string }) => {
      setError(message);
      setCreating(false);
    });
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    const code = joinCode.trim().toUpperCase();
    if (code.length !== 6) { setError('Room code must be 6 characters'); return; }
    router.push(`/room/${code}`);
  };

  return (
    <div className={styles.page}>
      <div className={styles.hero}>
        <h1 className={styles.title}>Tactic<span>Toe</span></h1>
        <p className={styles.subtitle}>Competitive Tic-Tac-Toe and its deeper variants.</p>
      </div>

      {error && <div className={styles.error}>{error}</div>}

      <Card>
        <div className={styles.section}>
          <p className={styles.sectionLabel}>Online — Ultimate TTT</p>
          <Button onClick={handleCreateRoom} loading={creating} full>
            Create Room
          </Button>
        </div>

        <div className={styles.divider} style={{ margin: 'var(--space-5) 0' }}>or</div>

        <form onSubmit={handleJoinRoom}>
          <div className={styles.section}>
            <p className={styles.sectionLabel}>Join by code</p>
            <div className={styles.joinRow}>
              <Input
                value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="XXXXXX"
                maxLength={6}
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.15em', textTransform: 'uppercase' }}
              />
              <Button type="submit" variant="secondary">Join</Button>
            </div>
          </div>
        </form>
      </Card>

      <p className={styles.localLink}>
        Playing with someone next to you?{' '}
        <Link href="/local">Play locally on this screen →</Link>
      </p>

      {!session && (
        <p className={styles.guestCta}>
          Playing as guest.{' '}
          <Link href="/register">Create an account</Link>{' '}
          to track your rating and match history.
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 5.3: Commit**

```bash
git add apps/web/src/app/page.tsx apps/web/src/app/page.module.css
git commit -m "feat(web): rebuild lobby with design system, add local play link"
```

---

## Task 6: Rebuild Auth Pages

**Files:**
- Modify: `apps/web/src/app/login/page.tsx`
- Modify: `apps/web/src/app/register/page.tsx`
- Create: `apps/web/src/app/login/page.module.css` (shared with register)

- [ ] **Step 6.1: Create `apps/web/src/app/login/page.module.css`**

```css
.page {
  min-height: calc(100vh - var(--nav-height));
  display: flex;
  align-items: center;
  justify-content: center;
  padding: var(--space-8) var(--space-4);
}

.card { width: 100%; max-width: 380px; }

.title {
  font-size: var(--text-2xl);
  font-weight: 700;
  margin-bottom: var(--space-1);
  letter-spacing: -0.01em;
}

.subtitle {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-6);
}

.form { display: flex; flex-direction: column; gap: var(--space-4); }

.divider {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  color: var(--text-faint);
  font-size: var(--text-xs);
  margin: var(--space-4) 0;
}

.divider::before, .divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border);
}

.footer {
  text-align: center;
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-top: var(--space-4);
}

.footer a { color: var(--accent); font-weight: 500; }
.footer a:hover { text-decoration: underline; }

.error {
  font-size: var(--text-sm);
  color: var(--error);
  background: var(--error-subtle);
  border: 1px solid var(--error);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
}
```

- [ ] **Step 6.2: Rewrite `apps/web/src/app/login/page.tsx`**

Preserve all existing logic (signIn, Google, error handling). Replace inline styles with CSS module classes.

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import styles from './page.module.css';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const result = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (result?.error) { setError('Invalid email or password'); return; }
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Welcome back to TacticToe.</p>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" required />
          <Button type="submit" loading={loading} full>Sign in</Button>
        </form>

        <div className={styles.divider}>or</div>

        <Button variant="secondary" full onClick={() => signIn('google', { callbackUrl: '/' })}>
          Continue with Google
        </Button>

        <p className={styles.footer}>
          No account? <Link href="/register">Create one</Link>
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6.3: Rewrite `apps/web/src/app/register/page.tsx`**

Preserve all existing registration logic. Replace inline styles.

```tsx
'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import styles from '../login/page.module.css';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Registration failed'); setLoading(false); return; }
    await signIn('credentials', { email, password, redirect: false });
    router.push('/');
  };

  return (
    <div className={styles.page}>
      <Card className={styles.card}>
        <h1 className={styles.title}>Create account</h1>
        <p className={styles.subtitle}>Join TacticToe and start playing.</p>

        {error && <div className={styles.error}>{error}</div>}

        <form className={styles.form} onSubmit={handleSubmit}>
          <Input label="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required />
          <Input
            label="Username"
            value={username}
            onChange={e => setUsername(e.target.value)}
            hint="3–20 characters. Letters, numbers, underscores."
            pattern="^[a-zA-Z0-9_]{3,20}$"
            required
          />
          <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} hint="At least 8 characters." minLength={8} required />
          <Button type="submit" loading={loading} full>Create account</Button>
        </form>

        <div className={styles.divider}>or</div>

        <Button variant="secondary" full onClick={() => signIn('google', { callbackUrl: '/' })}>
          Continue with Google
        </Button>

        <p className={styles.footer}>
          Already have an account? <Link href="/login">Sign in</Link>
        </p>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6.4: Commit**

```bash
git add apps/web/src/app/login/ apps/web/src/app/register/
git commit -m "feat(web): rebuild login + register pages with design system"
```

---

## Task 7: Update Board Components

Replace hardcoded hex colors with CSS variable references via inline `var()` strings.

**Files:**
- Modify: `apps/web/src/components/board/UltimateBoard.tsx`
- Modify: `apps/web/src/components/board/StandardBoard.tsx`

- [ ] **Step 7.1: Update `UltimateBoard.tsx`**

Replace every hardcoded color string with a CSS variable. The core logic (board rendering, constraint highlighting, overlays) stays the same. Only color values change:

| Old value | Replace with |
|---|---|
| `#4ade80` (active border) | `var(--board-active-border)` |
| `#374151` (inactive border) | `var(--board-inactive-border)` |
| `rgba(0,0,0,0.6)` (overlay) | `var(--board-result-overlay)` |
| `#9ca3af` (muted text) | `var(--text-muted)` |
| `background: '#000'` or equivalent dark cell bg | `var(--board-cell-bg)` |

Player mark colors: keep passing `currentPlayer` to cells, but use `color: currentPlayer === 'X' ? 'var(--mark-x)' : 'var(--mark-o)'`.

- [ ] **Step 7.2: Update `StandardBoard.tsx`**

Same token substitution. Replace hardcoded colors with CSS variable strings.

- [ ] **Step 7.3: Verify board tests still pass**

```bash
cd apps/web && pnpm test
```

Expected: all existing tests pass (board tests are logic tests, not visual).

- [ ] **Step 7.4: Commit**

```bash
git add apps/web/src/components/board/
git commit -m "feat(web): update board components to use CSS variable color tokens"
```

---

## Task 8: Rebuild Room Page

**Files:**
- Modify: `apps/web/src/app/room/[code]/page.tsx`
- Create: `apps/web/src/app/room/[code]/page.module.css`

- [ ] **Step 8.1: Create `apps/web/src/app/room/[code]/page.module.css`**

```css
.page {
  max-width: 700px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-4);
}

.roomCode {
  font-family: var(--font-mono);
  font-size: var(--text-xl);
  font-weight: 700;
  letter-spacing: 0.15em;
  color: var(--text);
}

.headerActions { display: flex; align-items: center; gap: var(--space-2); }

.status {
  font-size: var(--text-sm);
  color: var(--text-muted);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.statusDot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--warning);
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.statusDot.connected { background: var(--success); animation: none; }

.players {
  display: flex;
  gap: var(--space-3);
}

.player {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.player.active { border-color: var(--accent); background: var(--accent-subtle); }

.playerSymbol {
  font-size: var(--text-xl);
  font-weight: 700;
  width: 32px;
  text-align: center;
  color: var(--text-muted);
}

.player.active .playerSymbol { color: var(--accent); }

.playerName {
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text);
}

.playerYou {
  font-size: var(--text-xs);
  color: var(--text-muted);
}

.turnBanner {
  text-align: center;
  padding: var(--space-3);
  border-radius: var(--radius);
  font-size: var(--text-sm);
  font-weight: 600;
}

.turnBanner.mine {
  background: var(--accent-subtle);
  color: var(--accent);
}

.turnBanner.theirs {
  background: var(--bg-subtle);
  color: var(--text-muted);
}

.boardWrap { display: flex; justify-content: center; }

.waiting {
  text-align: center;
  padding: var(--space-12) var(--space-4);
}

.waitingTitle {
  font-size: var(--text-xl);
  font-weight: 600;
  margin-bottom: var(--space-3);
}

.waitingCode {
  font-family: var(--font-mono);
  font-size: var(--text-3xl);
  font-weight: 700;
  letter-spacing: 0.2em;
  color: var(--accent);
  margin-bottom: var(--space-3);
}

.waitingHint {
  font-size: var(--text-sm);
  color: var(--text-muted);
  margin-bottom: var(--space-5);
}

.gameOver {
  text-align: center;
  padding: var(--space-8) var(--space-4);
}

.gameOverTitle {
  font-size: var(--text-3xl);
  font-weight: 700;
  margin-bottom: var(--space-2);
}

.gameOverTitle.win { color: var(--success); }
.gameOverTitle.lose { color: var(--error); }
.gameOverTitle.draw { color: var(--text-muted); }

.gameOverSub { font-size: var(--text-sm); color: var(--text-muted); margin-bottom: var(--space-6); }

.error {
  font-size: var(--text-sm);
  color: var(--error);
  background: var(--error-subtle);
  border: 1px solid var(--error);
  border-radius: var(--radius);
  padding: var(--space-3) var(--space-4);
  text-align: center;
}
```

- [ ] **Step 8.2: Rewrite `apps/web/src/app/room/[code]/page.tsx`**

Preserve 100% of the existing socket logic, reducer, RoomState types, join/reconnect flow, move handling. Replace only the render/JSX with CSS module classes and new UI components.

Key visual changes:
- Use `styles.*` classes for all layout and color
- Use `Button` component for Copy Link and Leave buttons
- Player cards show active state via `player.active` class when it's that player's turn
- Turn banner replaces inline-styled text
- Waiting phase shows the room code large and prominent
- Game over shows win/draw/lose in appropriate semantic color

Preserve all logic from the original `page.tsx`. Only the JSX return value and imports change.

- [ ] **Step 8.3: Commit**

```bash
git add apps/web/src/app/room/
git commit -m "feat(web): rebuild room page with design system, preserve all socket logic"
```

---

## Task 9: Local Play Page

**Files:**
- Create: `apps/web/src/app/local/page.tsx`
- Create: `apps/web/src/app/local/page.module.css`

- [ ] **Step 9.1: Create `apps/web/src/app/local/page.module.css`**

```css
.page {
  max-width: 700px;
  margin: 0 auto;
  padding: var(--space-8) var(--space-4);
  display: flex;
  flex-direction: column;
  gap: var(--space-6);
  align-items: center;
}

.header { text-align: center; }

.title {
  font-size: var(--text-2xl);
  font-weight: 700;
  margin-bottom: var(--space-1);
}

.subtitle { font-size: var(--text-sm); color: var(--text-muted); }

.setup { width: 100%; max-width: 440px; display: flex; flex-direction: column; gap: var(--space-4); }

.playerRow { display: flex; gap: var(--space-3); align-items: flex-end; }
.playerRow > * { flex: 1; }

.variantRow { display: flex; flex-direction: column; gap: var(--space-2); }

.variantLabel {
  font-size: var(--text-xs);
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--text-faint);
}

.variantButtons { display: flex; gap: var(--space-2); }

.variantBtn {
  flex: 1;
  padding: var(--space-3) var(--space-4);
  background: var(--bg-raised);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius);
  font-size: var(--text-sm);
  font-weight: 500;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.12s;
  text-align: center;
}

.variantBtn:hover { background: var(--bg-hover); color: var(--text); }
.variantBtn.selected { border-color: var(--accent); color: var(--accent); background: var(--accent-subtle); font-weight: 600; }

.game { width: 100%; display: flex; flex-direction: column; gap: var(--space-4); align-items: center; }

.turnBanner {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--accent);
}

.boardWrap { width: 100%; display: flex; justify-content: center; }

.scoreboard {
  display: flex;
  gap: var(--space-3);
  width: 100%;
  max-width: 360px;
}

.scoreCard {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-1);
  padding: var(--space-3);
  background: var(--bg-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.scoreName { font-size: var(--text-xs); color: var(--text-muted); font-weight: 500; }
.scoreValue { font-size: var(--text-2xl); font-weight: 700; color: var(--text); }
.scoreValue.x { color: var(--mark-x); }
.scoreValue.o { color: var(--mark-o); }

.gameOver {
  text-align: center;
  padding: var(--space-6);
}

.gameOverTitle {
  font-size: var(--text-2xl);
  font-weight: 700;
  color: var(--success);
  margin-bottom: var(--space-2);
}

.gameOverTitle.draw { color: var(--text-muted); }

.gameActions {
  display: flex;
  gap: var(--space-3);
  justify-content: center;
  margin-top: var(--space-5);
}

.backLink {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  font-size: var(--text-sm);
  color: var(--text-muted);
  align-self: flex-start;
}

.backLink:hover { color: var(--text); }
```

- [ ] **Step 9.2: Create `apps/web/src/app/local/page.tsx`**

This is a client component only — no sockets, no auth required. Uses the game engine directly.

```tsx
'use client';

import { useState, useReducer } from 'react';
import Link from 'next/link';
import { StandardTTT } from '@tactictoe/game-engine';
import { UltimateTTT } from '@tactictoe/game-engine';
import type { GameState } from '@tactictoe/game-engine';
import type { StandardTTTState } from '@tactictoe/game-engine';
import type { UltimateTTTState } from '@tactictoe/game-engine';
import StandardBoard from '@/components/board/StandardBoard';
import UltimateBoard from '@/components/board/UltimateBoard';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import styles from './page.module.css';

type Variant = 'standard_3x3' | 'ultimate_ttt';

const engines = {
  standard_3x3: new StandardTTT(),
  ultimate_ttt: new UltimateTTT(),
};

interface LocalState {
  phase: 'setup' | 'playing' | 'over';
  variant: Variant;
  player1Name: string;
  player2Name: string;
  gameState: GameState | null;
  scores: { x: number; o: number; draws: number };
}

type LocalAction =
  | { type: 'START_GAME' }
  | { type: 'MOVE'; gameState: GameState }
  | { type: 'GAME_OVER'; gameState: GameState }
  | { type: 'REMATCH' }
  | { type: 'NEW_GAME' }
  | { type: 'SET_VARIANT'; variant: Variant }
  | { type: 'SET_NAME'; player: 1 | 2; name: string };

function reducer(state: LocalState, action: LocalAction): LocalState {
  switch (action.type) {
    case 'SET_VARIANT': return { ...state, variant: action.variant };
    case 'SET_NAME':
      return action.player === 1
        ? { ...state, player1Name: action.name }
        : { ...state, player2Name: action.name };
    case 'START_GAME': {
      const engine = engines[state.variant];
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }) };
    }
    case 'MOVE':
    case 'GAME_OVER': {
      const terminal = action.gameState.terminal;
      if (action.type === 'GAME_OVER' && terminal) {
        const scores = { ...state.scores };
        if (terminal.winner === 'X') scores.x++;
        else if (terminal.winner === 'O') scores.o++;
        else scores.draws++;
        return { ...state, phase: 'over', gameState: action.gameState, scores };
      }
      return { ...state, gameState: action.gameState };
    }
    case 'REMATCH': {
      const engine = engines[state.variant];
      return { ...state, phase: 'playing', gameState: engine.initialize({ variantId: state.variant }) };
    }
    case 'NEW_GAME':
      return { ...state, phase: 'setup', gameState: null };
    default:
      return state;
  }
}

const initialState: LocalState = {
  phase: 'setup',
  variant: 'ultimate_ttt',
  player1Name: 'Player 1',
  player2Name: 'Player 2',
  gameState: null,
  scores: { x: 0, o: 0, draws: 0 },
};

export default function LocalPage() {
  const [state, dispatch] = useReducer(reducer, initialState);

  const handleMove = (boardIndex: number, cellIndex: number) => {
    if (!state.gameState) return;
    const engine = engines[state.variant];
    const move = state.variant === 'ultimate_ttt'
      ? { data: { boardIndex, cellIndex } }
      : { data: { cellIndex } };
    const result = engine.applyMove(state.gameState, move, state.gameState.currentPlayer);
    if (!result.ok) return;
    const terminal = engine.checkTerminal(result.state);
    if (terminal) {
      dispatch({ type: 'GAME_OVER', gameState: { ...result.state, terminal } });
    } else {
      dispatch({ type: 'MOVE', gameState: result.state });
    }
  };

  const { phase, variant, player1Name, player2Name, gameState, scores } = state;
  const currentName = gameState?.currentPlayer === 'X' ? player1Name : player2Name;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1 className={styles.title}>Local Game</h1>
        <p className={styles.subtitle}>Same screen. Take turns.</p>
      </div>

      {phase === 'setup' && (
        <Card style={{ width: '100%', maxWidth: 440 }}>
          <div className={styles.setup}>
            <div className={styles.variantRow}>
              <p className={styles.variantLabel}>Game mode</p>
              <div className={styles.variantButtons}>
                <button
                  className={`${styles.variantBtn} ${variant === 'ultimate_ttt' ? styles.selected : ''}`}
                  onClick={() => dispatch({ type: 'SET_VARIANT', variant: 'ultimate_ttt' })}
                >
                  Ultimate TTT
                </button>
                <button
                  className={`${styles.variantBtn} ${variant === 'standard_3x3' ? styles.selected : ''}`}
                  onClick={() => dispatch({ type: 'SET_VARIANT', variant: 'standard_3x3' })}
                >
                  Standard 3×3
                </button>
              </div>
            </div>

            <div className={styles.playerRow}>
              <Input
                label="Player X"
                value={player1Name}
                onChange={e => dispatch({ type: 'SET_NAME', player: 1, name: e.target.value })}
                placeholder="Player 1"
              />
              <Input
                label="Player O"
                value={player2Name}
                onChange={e => dispatch({ type: 'SET_NAME', player: 2, name: e.target.value })}
                placeholder="Player 2"
              />
            </div>

            <Button onClick={() => dispatch({ type: 'START_GAME' })} full>
              Start Game
            </Button>
          </div>
        </Card>
      )}

      {(phase === 'playing' || phase === 'over') && gameState && (
        <div className={styles.game}>
          <div className={styles.scoreboard}>
            <div className={styles.scoreCard}>
              <span className={styles.scoreName}>{player1Name} (X)</span>
              <span className={`${styles.scoreValue} ${styles.x}`}>{scores.x}</span>
            </div>
            <div className={styles.scoreCard}>
              <span className={styles.scoreName}>Draws</span>
              <span className={styles.scoreValue}>{scores.draws}</span>
            </div>
            <div className={styles.scoreCard}>
              <span className={styles.scoreName}>{player2Name} (O)</span>
              <span className={`${styles.scoreValue} ${styles.o}`}>{scores.o}</span>
            </div>
          </div>

          {phase === 'playing' && (
            <p className={styles.turnBanner}>{currentName}'s turn ({gameState.currentPlayer})</p>
          )}

          {phase === 'over' && gameState.terminal && (
            <div className={styles.gameOver}>
              <p className={`${styles.gameOverTitle} ${!gameState.terminal.winner ? styles.draw : ''}`}>
                {gameState.terminal.winner
                  ? `${gameState.terminal.winner === 'X' ? player1Name : player2Name} wins!`
                  : "It's a draw!"}
              </p>
              <div className={styles.gameActions}>
                <Button onClick={() => dispatch({ type: 'REMATCH' })}>Play again</Button>
                <Button variant="secondary" onClick={() => dispatch({ type: 'NEW_GAME' })}>Change settings</Button>
              </div>
            </div>
          )}

          <div className={styles.boardWrap}>
            {variant === 'ultimate_ttt' ? (
              <UltimateBoard
                boards={(gameState as UltimateTTTState).boards}
                boardResults={(gameState as UltimateTTTState).boardResults}
                nextBoardConstraint={(gameState as UltimateTTTState).nextBoardConstraint}
                currentPlayer={gameState.currentPlayer}
                disabled={phase === 'over'}
                onMove={handleMove}
              />
            ) : (
              <StandardBoard
                board={(gameState as StandardTTTState).board}
                currentPlayer={gameState.currentPlayer}
                disabled={phase === 'over'}
                onMove={(_, cellIndex) => handleMove(0, cellIndex)}
              />
            )}
          </div>
        </div>
      )}

      <Link href="/" className={styles.backLink}>← Back to lobby</Link>
    </div>
  );
}
```

Note: Import paths for `StandardTTTState` and `UltimateTTTState` — check that `packages/game-engine/src/index.ts` exports these. If `StandardTTTState` is not exported, export it from `rules/standard-ttt.ts` and add to the index export.

- [ ] **Step 9.3: Check game-engine exports**

Verify `packages/game-engine/src/index.ts` exports `UltimateTTTState`. If `StandardTTTState` is missing, add:
```typescript
export type { StandardTTTState } from './rules/standard-ttt.js';
```

- [ ] **Step 9.4: Verify local page builds**

```bash
cd apps/web && pnpm build
```

Fix any TypeScript errors (mostly around game-engine type imports).

- [ ] **Step 9.5: Commit**

```bash
git add apps/web/src/app/local/ packages/game-engine/src/index.ts
git commit -m "feat(web): add local pass-and-play page for Standard TTT and Ultimate TTT"
```

---

## Task 10: Final Polish + Deployment

- [ ] **Step 10.1: Add `.superpowers/` to `.gitignore`**

```bash
echo '.superpowers/' >> .gitignore
git add .gitignore
```

- [ ] **Step 10.2: Run full test suite**

```bash
pnpm test
```

Expected: all existing tests pass. No new tests required — board components are unchanged in logic.

- [ ] **Step 10.3: Run production build**

```bash
cd apps/web && pnpm build
```

Fix any build errors before pushing.

- [ ] **Step 10.4: Push**

```bash
git push origin main
```

Railway will auto-deploy. Verify:
1. Light mode loads by default
2. Dark mode toggle works and persists
3. Lobby page looks clean
4. Login/Register pages render correctly
5. Room page retains all game functionality
6. Local play page works for both Standard TTT and Ultimate TTT
7. Two separate devices can still play online

---

## Checklist

- [ ] Task 1: Design tokens + globals.css
- [ ] Task 2: ThemeContext + ThemeToggle
- [ ] Task 3: Shared UI components (Button, Input, Card, Badge)
- [ ] Task 4: Navigation bar
- [ ] Task 5: Lobby page rebuilt
- [ ] Task 6: Auth pages rebuilt
- [ ] Task 7: Board components updated to CSS variables
- [ ] Task 8: Room page rebuilt
- [ ] Task 9: Local play page
- [ ] Task 10: Polish + deploy
