import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icons.js';

/**
 * Gameverse decoration kit — pure CSS/SVG, no dependencies.
 * Everything here is presentational only; it never touches app state.
 */

/* ------------------------------------------------------------------ */
/* Pixel art from string maps (box-shadow technique)                   */
/* ------------------------------------------------------------------ */

type Palette = Record<string, string>;

function pixelShadow(rows: string[], s: number, palette: Palette): string {
  const out: string[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x += 1) {
      const ch = row.charAt(x);
      if (ch === '.' || !palette[ch]) continue;
      out.push(`${x * s}px ${y * s}px 0 0 ${palette[ch]}`);
    }
  });
  return out.join(', ');
}

const ISLAND_PALETTE: Palette = {
  G: '#63e08e', // grass top
  g: '#3fae6b', // grass shade
  D: '#2b7d55', // grass under-edge
  B: '#8a5f3c', // earth
  b: '#6d4527', // earth shade
  R: '#5d3a20', // rock deep
};

const ISLAND_MAP = [
  '.....GGGGGGg.....',
  '...GGGGGGGGGGg...',
  '..GGgGGGGGGgGGg..',
  '.DDDDDDDDDDDDDD..',
  '.BBBbBBBBBBbBBB..',
  '..BBBbBBBBBbBB...',
  '...BBBbBBBBbB....',
  '....RRbBBbRR.....',
  '.....RRbbRR......',
  '......RRR........',
  '.......R.........',
];

const ISLAND_MAP_SMALL = [
  '...GGGg...',
  '.GGGGGGGg.',
  '.DDDDDDDD.',
  '..BBbBBB..',
  '...BbBB...',
  '....RR....',
];

const CLOUD_PALETTE: Palette = {
  W: '#eef4ff',
  w: '#c3d4f6',
};

const CLOUD_MAP = [
  '.....WWWW.....',
  '...WWWWWWWW...',
  '.WWWWWWWWWWWW.',
  '.WWwwWWWWwwWW.',
  '..wwwwwwwwww..',
];

function PixelSprite({ map, size, palette, className, style }: {
  map: string[];
  size: number;
  palette: Palette;
  className?: string;
  style?: React.CSSProperties;
}) {
  const shadow = useMemo(() => pixelShadow(map, size, palette), [map, size, palette]);
  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: 'absolute',
        width: size,
        height: size,
        // The sprite extends down-right from this cell via box-shadow.
        boxShadow: shadow,
        ...style,
      }}
    />
  );
}

/** A cluster of drifting pixel islands + clouds for hero panels. */
export function PixelSky({ variant = 'hero' }: { variant?: 'hero' | 'panel' }) {
  return (
    <div className={`pixel-sky pixel-sky-${variant}`} aria-hidden="true">
      <div className="sky-drift drift-slow" style={{ position: 'absolute', inset: 0 }}>
        <PixelSprite map={CLOUD_MAP} size={5} palette={CLOUD_PALETTE} className="sky-cloud cloud-a" />
        <PixelSprite map={CLOUD_MAP} size={4} palette={CLOUD_PALETTE} className="sky-cloud cloud-b" />
      </div>
      <div className="sky-drift drift-slower" style={{ position: 'absolute', inset: 0 }}>
        <PixelSprite map={ISLAND_MAP} size={variant === 'hero' ? 6 : 5} palette={ISLAND_PALETTE} className="sky-island island-a" />
        <PixelSprite map={ISLAND_MAP_SMALL} size={variant === 'hero' ? 6 : 5} palette={ISLAND_PALETTE} className="sky-island island-b" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Twinkling star field                                                */
/* ------------------------------------------------------------------ */

const STAR_SEEDS = [
  [6, 14, 0], [13, 68, 1], [22, 32, 2], [28, 84, 1], [36, 9, 0], [44, 55, 2],
  [51, 22, 1], [58, 78, 0], [66, 41, 2], [73, 12, 1], [79, 62, 0], [86, 30, 2],
  [92, 71, 1], [18, 92, 0], [47, 88, 2], [69, 90, 0], [33, 47, 1], [83, 18, 2],
];

export function StarField({ count = 18 }: { count?: number }) {
  const stars = STAR_SEEDS.slice(0, count);
  return (
    <div className="star-field" aria-hidden="true">
      {stars.map(([x, y, kind], i) => (
        <span
          key={i}
          className={`star star-k${kind}`}
          style={{ left: `${x}%`, top: `${y}%`, animationDelay: `${(i % 7) * 0.55}s` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Quest badge (pin + Silkscreen quest number)                         */
/* ------------------------------------------------------------------ */

export function QuestBadge({ n, level, tone = 'gold' }: { n: number; level?: number; tone?: 'gold' | 'cyan' | 'mint' }) {
  const code = level != null ? `${level}0${((n - 1) % 9) + 1}` : n;
  return (
    <span className={`quest-badge tone-${tone}`}>
      <Icon name="pin" size={13} />
      <span className="quest-badge-code">QUEST {code}</span>
    </span>
  );
}

/** Deterministic quest code for a scenario (level 2, index 1 → 202). */
export function questCode(level: number, index: number): string {
  return `${level}0${(index % 9) + 1}`;
}

/* ------------------------------------------------------------------ */
/* Ticket stub barcode                                                 */
/* ------------------------------------------------------------------ */

export function Barcode() {
  return <span className="ticket-barcode" aria-hidden="true" />;
}

/* ------------------------------------------------------------------ */
/* Confetti burst                                                      */
/* ------------------------------------------------------------------ */

const CONFETTI_COLORS = ['#ffc94b', '#52cdff', '#6fe58f', '#ff7d92', '#b3a5ff', '#ffe08a'];
const CONFETTI_N = 30;

export function Confetti({ active }: { active: boolean }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: CONFETTI_N }, (_, i) => {
        const wave = Math.sin(i * 12.9898) * 43758.5453;
        const frac = wave - Math.floor(wave);
        const wave2 = Math.sin(i * 78.233) * 12345.6789;
        const frac2 = wave2 - Math.floor(wave2);
        return {
          left: Math.round(frac * 100),
          delay: (frac2 * 0.9).toFixed(2),
          duration: (2.4 + frac * 1.8).toFixed(2),
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          size: 7 + Math.round(frac2 * 6),
          round: i % 3 === 0,
        };
      }),
    [],
  );
  if (!active) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          className={p.round ? 'round' : ''}
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.round ? p.size : p.size * 0.5,
            background: p.color,
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Realm unlocked overlay                                              */
/* ------------------------------------------------------------------ */

export function LevelUpOverlay({
  from,
  to,
  onContinue,
  onDetails,
  continueLabel,
  detailsLabel,
  heading,
  body,
}: {
  from: number;
  to: number;
  onContinue: () => void;
  onDetails: () => void;
  continueLabel: string;
  detailsLabel: string;
  heading: string;
  body: string;
}) {
  // Portal + keypress animation on mount.
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t1 = window.setTimeout(() => setStage(1), 60);
    return () => window.clearTimeout(t1);
  }, []);

  return (
    <div className={`realm-overlay ${stage ? 'show' : ''}`} role="dialog" aria-modal="true" aria-label={heading}>
      <div className="realm-backdrop" onClick={onDetails} />
      <StarField count={12} />
      <Confetti active />
      <div className="realm-card">
        <div className="realm-portal" aria-hidden="true">
          <span className="realm-ring r1" />
          <span className="realm-ring r2" />
          <span className="realm-core">
            <strong>L{to}</strong>
          </span>
        </div>
        <p className="realm-eyebrow">★ {heading} ★</p>
        <h2 className="realm-title">{body}</h2>
        <p className="realm-sub">
          Level {from} → Level {to}
        </p>
        <div className="realm-actions">
          <button type="button" className="btn btn-primary" onClick={onContinue}>
            <Icon name="sword" size={17} />
            {continueLabel}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onDetails}>
            {detailsLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Score glow ring levels for stat cards (small sparkline deco)         */
/* ------------------------------------------------------------------ */

export function HeartBeat({ on }: { on: boolean }) {
  return <span className={`heartbeat ${on ? 'on' : ''}`} aria-hidden="true" />;
}
