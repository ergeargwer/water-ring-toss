/**
 * Runtime feel-tuning settings — user-adjustable, persisted in localStorage.
 * Defaults match config.ts; game systems read from `feel` instead of constants.
 */
import { PHYSICS, WATER_JET, PARTICLES } from '../config';

const STORAGE_KEY = 'water-ring-toss-feel-v1';

export type FeelKey =
  | 'weakForce'
  | 'strongForce'
  | 'weakRadius'
  | 'strongRadius'
  | 'shortPressMs'
  | 'particleRate'
  | 'buoyancy'
  | 'waterDrag'
  | 'gravityY'
  | 'slotAssist'
  | 'volume';

export interface FeelValues {
  weakForce: number;
  strongForce: number;
  weakRadius: number;
  strongRadius: number;
  shortPressMs: number;
  /** Multiplier on jet particle spawn rate (0.3–2) */
  particleRate: number;
  buoyancy: number;
  waterDrag: number;
  gravityY: number;
  /** 0–2, multiplies peg slotting assist */
  slotAssist: number;
  volume: number;
}

export interface SliderDef {
  key: FeelKey;
  label: string;
  min: number;
  max: number;
  step: number;
  /** How many decimals to show */
  decimals: number;
  /** Optional display scale (value * scale for UI number) */
  displayScale?: number;
  displaySuffix?: string;
}

/** Slider definitions for the settings panel (order = UI order) */
export const FEEL_SLIDERS: SliderDef[] = [
  {
    key: 'weakForce',
    label: '弱水流',
    min: 0.0003,
    max: 0.0035,
    step: 0.0001,
    decimals: 0,
    displayScale: 10000,
  },
  {
    key: 'strongForce',
    label: '強水流',
    min: 0.001,
    max: 0.008,
    step: 0.0001,
    decimals: 0,
    displayScale: 10000,
  },
  {
    key: 'weakRadius',
    label: '弱流範圍',
    min: 40,
    max: 160,
    step: 5,
    decimals: 0,
  },
  {
    key: 'strongRadius',
    label: '強流範圍',
    min: 80,
    max: 260,
    step: 5,
    decimals: 0,
  },
  {
    key: 'shortPressMs',
    label: '長按判定',
    min: 80,
    max: 500,
    step: 10,
    decimals: 0,
    displaySuffix: 'ms',
  },
  {
    key: 'particleRate',
    label: '水流粒子',
    min: 0.3,
    max: 2,
    step: 0.1,
    decimals: 1,
    displaySuffix: '×',
  },
  {
    key: 'buoyancy',
    label: '浮力',
    min: 0.0003,
    max: 0.002,
    step: 0.00005,
    decimals: 0,
    displayScale: 10000,
  },
  {
    key: 'waterDrag',
    label: '水阻',
    min: 0.01,
    max: 0.12,
    step: 0.005,
    decimals: 0,
    displayScale: 100,
  },
  {
    key: 'gravityY',
    label: '重力',
    min: 0.2,
    max: 1.2,
    step: 0.05,
    decimals: 2,
  },
  {
    key: 'slotAssist',
    label: '套針輔助',
    min: 0,
    max: 2,
    step: 0.1,
    decimals: 1,
    displaySuffix: '×',
  },
  {
    key: 'volume',
    label: '音量',
    min: 0,
    max: 1,
    step: 0.05,
    decimals: 0,
    displayScale: 100,
    displaySuffix: '%',
  },
];

export function defaultFeel(): FeelValues {
  return {
    weakForce: WATER_JET.weakForce,
    strongForce: WATER_JET.strongForce,
    weakRadius: WATER_JET.weakRadius,
    strongRadius: WATER_JET.strongRadius,
    shortPressMs: WATER_JET.shortPressMs,
    particleRate: 1,
    buoyancy: PHYSICS.buoyancy,
    waterDrag: PHYSICS.waterDrag,
    gravityY: PHYSICS.gravityY,
    slotAssist: 1,
    volume: 0.55,
  };
}

function clampFeel(v: Partial<FeelValues>): FeelValues {
  const d = defaultFeel();
  const out = { ...d, ...v };
  for (const s of FEEL_SLIDERS) {
    const raw = out[s.key];
    if (typeof raw !== 'number' || Number.isNaN(raw)) {
      out[s.key] = d[s.key];
    } else {
      out[s.key] = Math.min(s.max, Math.max(s.min, raw));
    }
  }
  return out;
}

type Listener = (values: FeelValues) => void;

class FeelSettingsStore {
  private values: FeelValues;
  private listeners = new Set<Listener>();

  constructor() {
    this.values = this.load();
  }

  get(): FeelValues {
    return { ...this.values };
  }

  getKey<K extends FeelKey>(key: K): FeelValues[K] {
    return this.values[key];
  }

  set(partial: Partial<FeelValues>, persist = true): void {
    this.values = clampFeel({ ...this.values, ...partial });
    if (persist) this.save();
    this.emit();
  }

  setKey(key: FeelKey, value: number, persist = true): void {
    this.set({ [key]: value }, persist);
  }

  reset(): void {
    this.values = defaultFeel();
    this.save();
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  /** Base particle rates from config × user multiplier */
  particleRateWeak(): number {
    return Math.round(WATER_JET.particleRateWeak * this.values.particleRate);
  }

  particleRateStrong(): number {
    return Math.round(WATER_JET.particleRateStrong * this.values.particleRate);
  }

  maxWaterParticles(): number {
    return Math.min(
      PARTICLES.maxWater,
      Math.round(PARTICLES.maxWater * Math.min(1.2, 0.5 + this.values.particleRate * 0.5))
    );
  }

  private emit(): void {
    const snap = this.get();
    for (const fn of this.listeners) fn(snap);
  }

  private load(): FeelValues {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultFeel();
      return clampFeel(JSON.parse(raw) as Partial<FeelValues>);
    } catch {
      return defaultFeel();
    }
  }

  private save(): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.values));
    } catch {
      /* ignore quota / private mode */
    }
  }
}

/** Singleton used by physics, input, particles, audio, UI */
export const feel = new FeelSettingsStore();

export function formatFeelValue(def: SliderDef, value: number): string {
  const scale = def.displayScale ?? 1;
  const n = value * scale;
  const text =
    def.decimals === 0 ? Math.round(n).toString() : n.toFixed(def.decimals);
  return def.displaySuffix ? `${text}${def.displaySuffix}` : text;
}
