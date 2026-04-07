// useSound hook - Web Audio API synthesized game sounds
import { useCallback, useRef, useState } from 'react';

interface SoundConfig { enabled: boolean; volume: number; }
export interface AllSoundSettings {
  master: SoundConfig; move: SoundConfig; win: SoundConfig;
  lose: SoundConfig; draw: SoundConfig; error: SoundConfig;
}
const DEFAULT_SETTINGS: AllSoundSettings = {
  master: { enabled: true,  volume: 0.6 }, move: { enabled: true,  volume: 0.5 },
  win: { enabled: true,  volume: 0.7 }, lose: { enabled: true,  volume: 0.5 },
  draw: { enabled: true,  volume: 0.5 }, error: { enabled: true,  volume: 0.4 },
};
export { DEFAULT_SETTINGS };
export const STORAGE_KEY = 'tactictoe_sounds';
function loadSettings(): AllSoundSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) as AllSoundSettings : DEFAULT_SETTINGS; } catch { return DEFAULT_SETTINGS; }
}
function saveSettings(s: AllSoundSettings) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }

type AudioCtx = AudioContext;
function ensureCtx(): AudioCtx { const w = window as any; if (!w._ttaa) { w._ttaa = new (w.AudioContext || w.webkitAudioContext)(); } return w._ttaa; }

function pTone(f: number, d: number, t: OscillatorType, v: number, c: AudioCtx) {
  const o = c.createOscillator(), g = c.createGain(); o.type = t;
  o.frequency.setValueAtTime(f, c.currentTime);
  g.gain.setValueAtTime(v * 0.3, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
  o.connect(g); g.connect(c.destination); o.start(c.currentTime); o.stop(c.currentTime + d);
}

function pNoise(d: number, v: number, c: AudioCtx) {
  const buf = c.createBuffer(1, c.sampleRate * d, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const s = c.createBufferSource(); s.buffer = buf;
  const g = c.createGain(); g.gain.setValueAtTime(v * 0.15, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + d);
  s.connect(g); g.connect(c.destination); s.start();
}

const SND: Record<string, (c: AudioCtx, v: number) => void> = {
  move: (c,v) => { pTone(440,0.1,'sine',v,c); setTimeout(()=>pTone(660,0.08,'sine',v*0.5,c),50); },
  win: (c,v) => { [523,659,784,1047].forEach((f,i)=>setTimeout(()=>pTone(f,0.25,'sine',v*(0.6-i*0.1),c),i*120)); },
  lose: (c,v) => { [440,370,311,261].forEach((f,i)=>setTimeout(()=>pTone(f,0.3,'triangle',v*0.4,c),i*200)); },
  draw: (c,v) => { pTone(392,0.25,'triangle',v*0.5,c); setTimeout(()=>pTone(392,0.25,'triangle',v*0.5,c),200); },
  error: (c,v) => { pNoise(0.12,v,c); pTone(180,0.15,'square',v*0.3,c); },
};

export function doPlay(s: AllSoundSettings, name: keyof typeof SND) {
  if (!s.master.enabled) return;
  const cfg = s[name as keyof AllSoundSettings];
  if (!cfg || !cfg.enabled) return;
  try { const c = ensureCtx(); if (c.state === 'suspended') c.resume(); SND[name]?.(c, s.master.volume * cfg.volume); } catch {}
}

export function useSound() {
  const [settings, setSettings] = useState<AllSoundSettings>(loadSettings);
  const ref = useRef(settings); ref.current = settings;
  const play = useCallback((n: keyof typeof SND) => { doPlay(ref.current, n); }, []);
  const setEnabled = useCallback((s: keyof AllSoundSettings, v: boolean) => {
    setSettings(p => { const nx = {...p, [s]:{...p[s], enabled: v}}; saveSettings(nx); ref.current = nx; return nx; });
  }, []);
  const setVolume = useCallback((s: keyof AllSoundSettings, v: number) => {
    setSettings(p => { const nx = {...p, [s]:{...p[s], volume: Math.max(0,Math.min(1,v))}}; saveSettings(nx); ref.current = nx; return nx; });
  }, []);
  const setAllEnabled = useCallback((e: boolean) => {
    setSettings(p => { const nx = {...p}; (Object.keys(nx) as (keyof AllSoundSettings)[]).forEach(k => { nx[k] = {...nx[k], enabled: e}; }); saveSettings(nx); ref.current = nx; return nx; });
  }, []);
  return { settings, play, setEnabled, setVolume, setAllEnabled,
    reset: () => { setSettings({...DEFAULT_SETTINGS}); saveSettings(DEFAULT_SETTINGS); ref.current = {...DEFAULT_SETTINGS}; },
    DEFAULT_SETTINGS };
}