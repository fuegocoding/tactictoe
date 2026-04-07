// OnboardingTutorial - first-time user guidance overlay

+Q+use client';

import { useState, useEffect, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';

interface Step {
  title: string;
  description: string;
  targetSelector?: string;
}

const STEPS: Step[] = [
  { title: 'Welcome to TicTacTop!', description: 'A competitive platform for Tic-Tac-Toe and its deeper variants. Let us take a quick tour.' },
  { title: 'Choose Your Game', description: 'Pick from 15+ variants like Ultimate TTT, Gomoku, Misere, and more from the lobby.' },
  { title: 'Play Modes', description: 'Quick Match finds you an opponent. Ranked tracks your rating. Private rooms let you play with friends.' },
  { title: 'Game Board', description: 'Click cells to place your mark. Watch the active board indicator and make strategic moves.' },
  { title: 'In-Game Actions', description: 'Offer a draw, forfeit, or chat with your opponent during the game.' },
  { title: 'Track Progress', description: 'Check the Leaderboard and your Profile to see ratings and match history. Create an account for full features.' },
];

export function OnboardingTutorial({ onComplete }: { onComplete?: () => void }) {
  const [step, setStep] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    try {
      const seen = localStorage.getItem('tt_onboarding_seen');
      if (!seen) setIsOpen(true);
    } catch {}
  }, []);

  const dismiss = useCallback(() => {
    setIsOpen(false);
    try { localStorage.setItem('tt_onboarding_seen', 'true'); } catch {}
    onComplete?.();
  }, [onComplete]);

  const prev = useCallback(() => setStep(s => Math.max(0, s - 1)), []);
  const next = useCallback(() => {
    setStep(s => {
      if (s >= STEPS.length - 1) { dismiss(); return s; }
      return s + 1;
    });
  }, [dismiss]);

  if (!isOpen) return null;
  const current = STEPS[step];
  if (!current) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 10000,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(0,0,0,0.6)', padding: '20px',
    }} onClick={dismiss} role='dialog' aria-modal='true'>
      <div style={{
        background: 'var(--bg-raised)', borderRadius: 'var(--radius-lg)',
        padding: '24px', maxWidth: '420px', width: '100%', boxShadow: 'var(--shadow-lg)',
        position: 'relative',
      }} onClick={(e) => e.stopPropagation()}>
        <button
          onClick={dismiss}
          style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
          aria-label='Dismiss tutorial'>
          <X size={20} />
        </button>
        <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Step {step + 1} of {STEPS.length}</p>
        <div style={{ height: '4px', background: 'var(--bg-subtle)', borderRadius: '2px', marginBottom: '16px' }}>
          <div style={{ height: '100%', width: '((step + 1) / STEPS.length * 100) + '%', background: 'var(--accent)', borderRadius: '2px', transition: 'width 0.3s ease' }} />
        </div>
        <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: '600', marginBottom: '8px' }}>{current.title}</h3>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', lineHeight: 1.6 }}>{current.description}</p>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px', gap: '12px' }}>
          {step > 0 ? (
            <button onClick={prev} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--text)', fontSize: 'var(--text-sm)' }}>
              <ChevronLeft size={16} /> Back
            </button>
          ) : <div />}
          <button onClick={next} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '8px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer', color: 'var(--accent-text)', fontSize: 'var(--text-sm)', fontWeight: '600' }}>
            {step >= STEPS.length - 1 ? 'Get Started' : 'Next'} <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}