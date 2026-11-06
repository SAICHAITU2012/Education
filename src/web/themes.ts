import { useEffect, useState } from 'react';

/**
 * ABHYAS THEME ENGINE
 * ───────────────────
 * Central theme configuration: 27 hand-tuned themes across 5 categories,
 * plus four time-of-day environments (morning / afternoon / evening / night)
 * that can drive the look automatically. Every theme is a set of design
 * tokens emitted as one CSS block — no per-theme stylesheets.
 *
 *   initThemes()   → inject CSS, apply saved or auto theme, start clock
 *   useTheme()     → React hook: { themeId, mode, period, auto }
 *   setTheme()     → 'auto' or a theme id (persisted)
 */

export type Period = 'morning' | 'afternoon' | 'evening' | 'night';
export type ThemeMode = 'light' | 'dark';

export interface ThemeDef {
  id: string;
  name: string;
  hi: string;
  cat: 'time' | 'nature' | 'fantasy' | 'gaming' | 'premium' | 'seasonal';
  mode: ThemeMode;
  env?: Period;
  sky: [string, string, string];
  surface: string;
  surface2: string;
  surface3: string;
  ink: string;
  muted: string;
  gold: string;   // primary accent — XP, headings, primary CTA
  gold2: string;  // lighter accent
  cyan: string;
  mint: string;
  coral: string;
  violet: string;
  orb: [string, string, string];
  sharp?: boolean; // pixel-corner treatment
}

/* ── colour helpers ─────────────────────────────────────────────────── */

function hexRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
function rgba(hex: string, a: number): string {
  const [r, g, b] = hexRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}
function mix(a: string, b: string, t: number): string {
  const A = hexRgb(a), B = hexRgb(b);
  const c = A.map((v, i) => Math.round(v + ((B[i] ?? 0) - v) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}
const darken = (c: string, t: number) => mix(c, '#000000', t);
const lighten = (c: string, t: number) => mix(c, '#ffffff', t);

/* ── theme registry ─────────────────────────────────────────────────── */

const t = (
  id: string, name: string, hi: string, cat: ThemeDef['cat'], mode: ThemeMode,
  sky: [string, string, string], surface: string, ink: string, muted: string,
  gold: string, gold2: string, cyan: string, mint: string, coral: string, violet: string,
  orb: [string, string, string],
  extra: Partial<ThemeDef> = {},
): ThemeDef => ({ id, name, hi, cat, mode, sky, surface, surface2: lighten(surface, mode === 'light' ? 0.35 : 0.28), surface3: lighten(surface, mode === 'light' ? 0.6 : 0.5), ink, muted, gold, gold2, cyan, mint, coral, violet, orb, ...extra });

export const THEMES: ThemeDef[] = [
  // ── time environments ────────────────────────────────────────────────────
  t('sunrise-bliss', 'Sunrise Bliss', 'सुबह की धूप', 'time', 'light',
    ['#ffe9d6', '#ffd9c4', '#cfe8ff'], '#fff7ee', '#43302e', '#8c7369',
    '#e8842a', '#f5b041', '#1f8fb4', '#1c9e63', '#ef5d7f', '#8f6ae0',
    ['#ffd3a8', '#c9b6ff', '#a8e6c9'], { env: 'morning' }),
  t('ocean-breeze', 'Ocean Breeze', 'समुद्री बैज', 'time', 'light',
    ['#d8f6ff', '#b8ecfb', '#e8fbff'], '#f4fcff', '#123a4c', '#5c8296',
    '#0a94ad', '#39c6d8', '#0a94ad', '#19a874', '#ff6f61', '#7a6ff0',
    ['#9be8f5', '#ffd0b8', '#b8e6c9'], { env: 'afternoon' }),
  t('sunset-paradise', 'Sunset Paradise', 'गोधूलि', 'time', 'light',
    ['#ffd9c2', '#ffc2c9', '#ffe9f0'], '#fff5ef', '#4d2438', '#956b7a',
    '#e85d3d', '#ff8f5e', '#1899b4', '#149c6d', '#e0476f', '#9a5ce0',
    ['#ffb08a', '#ff9fb8', '#d0a8ff'], { env: 'evening' }),
  t('aurora-wonderland', 'Aurora Wonderland', 'औरोरा जादू', 'time', 'dark',
    ['#0e1a38', '#16244e', '#1d2f5e'], '#182650', '#eaf2ff', '#9db4e8',
    '#6fe5a8', '#a5ffd6', '#5cd6ff', '#6fe5a8', '#ff7d92', '#b3a5ff',
    ['#3ddc97', '#5cd6ff', '#b3a5ff'], { env: 'night' }),

  // ── nature & environment ─────────────────────────────────────────────────
  t('tropical-paradise', 'Tropical Paradise', 'ट्रॉपिकल पैराडाइज़', 'nature', 'light',
    ['#e8fbf0', '#c9f2e2', '#fff3d6'], '#f6fdf8', '#1c4a38', '#5f8a7a',
    '#0d9e6e', '#ffb703', '#0aa6c4', '#19a874', '#ff6f61', '#8a5ce0',
    ['#8ff0c9', '#ffe08a', '#8ad9f0']),
  t('forest-adventure', 'Forest Adventure', 'जंगल एडवेंचर', 'nature', 'dark',
    ['#12241c', '#17301f', '#1e3d28'], '#1a3326', '#eaf6e8', '#9cc4a8',
    '#7ee08a', '#c9f28a', '#6fd8e0', '#7ee08a', '#ff9d7e', '#c9b6ff',
    ['#4db86a', '#a8d96a', '#3fae8c']),
  t('sakura-dreams', 'Sakura Dreams', 'साकूरा सपने', 'nature', 'light',
    ['#fff0f5', '#ffdfe9', '#f3e8ff'], '#fffaFC', '#4c2a3e', '#a0788c',
    '#e05590', '#ff9dbe', '#7a8ef0', '#3fae72', '#e85d75', '#a06ae0',
    ['#ffc2d9', '#d9c2ff', '#ffd9e8']),
  t('monsoon-magic', 'Monsoon Magic', 'मानसून जादू', 'seasonal', 'dark',
    ['#1a2733', '#22343f', '#2a4250'], '#213744', '#e4f1f8', '#93b5c4',
    '#5ecbdd', '#a8e6d0', '#5ecbdd', '#6fd8a8', '#ff8a9e', '#a89df0',
    ['#3d8aa8', '#6fd8c9', '#8a9df0']),
  t('winter-wonderland', 'Winter Wonderland', 'शीत जादू', 'seasonal', 'light',
    ['#eef6ff', '#dceafc', '#f6fbff'], '#fbfdff', '#27364e', '#6b7e9e',
    '#3f7cc4', '#8ab8f0', '#3f7cc4', '#2e9e78', '#e07a95', '#7a6ff0',
    ['#b8dcff', '#d9e8ff', '#c2e8f5']),
  t('autumn-glow', 'Autumn Glow', 'शरद की धूप', 'seasonal', 'light',
    ['#fdf0dd', '#f9e2c4', '#fbe8d0'], '#fffaf2', '#4d3320', '#93765c',
    '#d97706', '#f5a623', '#2e8aa8', '#5f9e4a', '#d9534f', '#8a5ce0',
    ['#ffce8a', '#e8a86a', '#c9b68a']),

  // ── fantasy & adventure ──────────────────────────────────────────────────
  t('mystic-realm', 'Mystic Realm', 'रहस्यमयी क्षेत्र', 'fantasy', 'dark',
    ['#170f2e', '#221645', '#2c1e5c'], '#221a44', '#f0eaff', '#a99ade',
    '#b388ff', '#d4b8ff', '#7ad8ff', '#8affce', '#ff7db8', '#b388ff',
    ['#8a5cf0', '#6a8aff', '#d46ad9']),
  t('dragons-kingdom', "Dragon's Kingdom", 'ड्रैगन का साम्राज्य', 'fantasy', 'dark',
    ['#250d0d', '#381412', '#4d1a14'], '#3a1613', '#ffeadd', '#d9a08c',
    '#ffb02e', '#ffd166', '#ff6b4a', '#ff8a5e', '#ff5470', '#c98aff',
    ['#e85d2a', '#ffb02e', '#c43a3a']),
  t('celestial-galaxy', 'Celestial Galaxy', 'खगोलीय आकाशगंगा', 'fantasy', 'dark',
    ['#0b0b22', '#141230', '#1d1a42'], '#161436', '#f2efff', '#a8a0d4',
    '#c0a8ff', '#8affd9', '#6ab8ff', '#8affce', '#ff7da8', '#a88aff',
    ['#6a4de0', '#4a9de0', '#c44de0']),
  t('enchanted-kingdom', 'Enchanted Kingdom', 'जादुई साम्राज्य', 'fantasy', 'light',
    ['#f5edff', '#e8f4ff', '#fff0f8'], '#fdfbff', '#3d2a52', '#8a75a0',
    '#8a5ce0', '#b892ff', '#3f9de0', '#2eb87e', '#ef6a9e', '#8a5ce0',
    ['#d4c2ff', '#b8e0ff', '#ffd4ec']),
  t('lost-civilization', 'Lost Civilization', 'खोई सभ्यता', 'fantasy', 'light',
    ['#f9edd8', '#f2ddba', '#e8f0e4'], '#fdf8ee', '#4a3620', '#8f7a5c',
    '#b8860b', '#d4a843', '#1f7f8f', '#5f8a3d', '#c4553d', '#7a6ae0',
    ['#e8c88a', '#a8d4c9', '#d4b88a']),

  // ── gaming & futuristic ──────────────────────────────────────────────────
  t('cyberpunk-city', 'Cyberpunk City', 'साइबरपंक शहर', 'gaming', 'dark',
    ['#12081f', '#1c0b33', '#260f47'], '#1e0f38', '#ffe8f8', '#b08ad4',
    '#ff2ea6', '#ff7de0', '#00e5ff', '#00ff9d', '#ff3860', '#b96aff',
    ['#e02ea6', '#00c4ff', '#7a2ee0']),
  t('arcade-legends', 'Arcade Legends', 'आर्केड लीजेंड्स', 'gaming', 'dark',
    ['#141428', '#1e1e40', '#282858'], '#22224a', '#fff9e8', '#a8a8d4',
    '#ffd23f', '#ff5e5e', '#3fa9f5', '#3fe06c', '#ff5470', '#b96aff',
    ['#ff5e5e', '#ffd23f', '#3fa9f5'], { sharp: true }),
  t('pixel-universe', 'Pixel Universe', 'पिक्सेल ब्रह्मांड', 'gaming', 'light',
    ['#d8f0ff', '#c2e4ff', '#ffe9c9'], '#f4fbff', '#23345c', '#68789e',
    '#2e6be0', '#ffb02e', '#2eb4e0', '#2eb873', '#e8556a', '#8a5ce0',
    ['#8ac4ff', '#ffcf8a', '#a8e8c9'], { sharp: true }),
  t('quantum-realm', 'Quantum Realm', 'क्वांटम क्षेत्र', 'gaming', 'dark',
    ['#0a1428', '#101f3d', '#16294f'], '#132242', '#eaf4ff', '#8fb0d8',
    '#4dc8ff', '#a8f0ff', '#4dc8ff', '#4dffc4', '#ff5e9e', '#9e7aff',
    ['#2e7fff', '#00c4b8', '#7a4de0']),
  t('space-odyssey', 'Space Odyssey', 'अंतरिक्ष यात्रा', 'gaming', 'dark',
    ['#070d1c', '#0d1526', '#131f3a'], '#101a30', '#eef4ff', '#8ba3cc',
    '#8ab8ff', '#c9d8ff', '#6ad4e8', '#6fe5a8', '#ff8a9e', '#b3a5ff',
    ['#3a5ae0', '#1f8fb4', '#6a4dc4']),

  // ── premium & modern ─────────────────────────────────────────────────────
  t('royal-elegance', 'Royal Elegance', 'शाही ठाठ', 'premium', 'dark',
    ['#1c1230', '#281843', '#341f56'], '#2b1c48', '#f7f0ff', '#b3a0d4',
    '#d4af37', '#f0d98a', '#8a9dff', '#6fe5a8', '#ff7d92', '#c99aff',
    ['#6a3de0', '#d4af37', '#8a2e8a']),
  t('luxury-gold', 'Luxury Gold', 'लक्ज़री गोल्ड', 'premium', 'light',
    ['#faf6ec', '#f2ead6', '#fdf9f0'], '#fffdf6', '#3d3020', '#8f8064',
    '#a8791e', '#d4af37', '#2e7e8a', '#4a8a3d', '#c4553d', '#7a5ce0',
    ['#ecd9a8', '#d9c9a0', '#f0e2c0']),
  t('minimalist-light', 'Minimalist Light', 'सहज सफ़ेद', 'premium', 'light',
    ['#fafbfc', '#f0f2f5', '#ffffff'], '#ffffff', '#1f2937', '#6b7280',
    '#4f46e5', '#818cf8', '#0891b2', '#059669', '#e11d48', '#7c3aed',
    ['#dbe4ff', '#d1fae5', '#e0e7ff']),
  t('vibrant-pop', 'Vibrant Pop', 'जोशीला पॉप', 'premium', 'light',
    ['#fff0f3', '#e8f7ff', '#fffbe8'], '#ffffff', '#33254d', '#7a6b94',
    '#e91e8c', '#ff8a3d', '#00b8d4', '#43d17c', '#ff4d6d', '#8a5cf0',
    ['#ff9ec4', '#9eddff', '#ffe08a']),
  t('glass-paradise', 'Glass Paradise', 'ग्लास पैराडाइज़', 'premium', 'light',
    ['#e8f4ff', '#d4e4ff', '#ffe4f0'], '#ffffff', '#25355c', '#68789e',
    '#5b7ce0', '#8fb0ff', '#2eb4d4', '#2eb873', '#ef6a9e', '#8a5ce0',
    ['#a8c8ff', '#ffb8d9', '#a8ffe0']),
  t('pastel-wonderland', 'Pastel Wonderland', 'पैस्टल जादू', 'premium', 'light',
    ['#fdf3ff', '#e8f4ff', '#fff8e8'], '#fefcff', '#43355c', '#8f7fa8',
    '#a06ae0', '#e08aff', '#4aa8e0', '#3dc48a', '#f06a8a', '#e08a3d',
    ['#e8d4ff', '#d4f0ff', '#ffe8c9']),
];

export const THEME_BY_ID = new Map(THEMES.map((x) => [x.id, x]));
const ENV_THEME: Record<Period, string> = {
  morning: 'sunrise-bliss',
  afternoon: 'ocean-breeze',
  evening: 'sunset-paradise',
  night: 'aurora-wonderland',
};
export const PERIOD_LABEL: Record<Period, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
  night: 'Night',
};

/* ── time engine ─────────────────────────────────────────────────────── */

export function periodOf(d: Date = new Date()): Period {
  const q = new URLSearchParams(window.location.search).get('period');
  if (q === 'morning' || q === 'afternoon' || q === 'evening' || q === 'night') return q;
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h >= 12 && h < 17) return 'afternoon';
  if (h >= 17 && h < 20) return 'evening';
  return 'night';
}

/* ── state + persistence ─────────────────────────────────────────────── */

const LS_KEY = 'abhyas.theme.v1';
interface Persisted { mode: 'auto' | 'manual'; themeId: string }
let state: { auto: boolean; themeId: string } = { auto: true, themeId: 'sunrise-bliss' };
const listeners = new Set<() => void>();

function load(): void {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Persisted;
    if (p.mode === 'auto') state = { auto: true, themeId: ENV_THEME[periodOf()] };
    else if (THEME_BY_ID.has(p.themeId)) state = { auto: false, themeId: p.themeId };
  } catch { /* fresh install */ }
}
function persist(): void {
  const p: Persisted = state.auto ? { mode: 'auto', themeId: ENV_THEME[periodOf()] } : { mode: 'manual', themeId: state.themeId };
  try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch { /* private mode */ }
}
export function effectiveThemeId(): string {
  return state.auto ? ENV_THEME[periodOf()] : state.themeId;
}
export function setTheme(choice: 'auto' | string): void {
  if (choice === 'auto') state = { auto: true, themeId: ENV_THEME[periodOf()] };
  else if (THEME_BY_ID.has(choice)) state = { auto: false, themeId: choice };
  persist();
  apply();
  listeners.forEach((l) => l());
}
export function getThemeState() {
  return { ...state };
}

/* ── CSS generation ──────────────────────────────────────────────────── */

function themeCss(x: ThemeDef): string {
  const light = x.mode === 'light';
  const onAccent = light ? '#ffffff' : '#1a1405';
  const softOf = (c: string) => rgba(light ? darken(c, 0.15) : c, light ? 0.12 : 0.14);
  const deep = (c: string) => (light ? darken(c, 0.3) : darken(c, 0.4));
  const radius = x.sharp ? '10px' : '16px';
  const radiusSm = x.sharp ? '6px' : '10px';
  const radiusXs = x.sharp ? '4px' : '7px';
  const shadowC = light ? '31, 41, 90' : '2, 5, 18';
  const panel = light ? 'rgba(255, 255, 255, 0.62)' : rgba(lighten(x.surface, 0.06), 0.82);
  return `
[data-theme="${x.id}"] {
  color-scheme: ${light ? 'light' : 'dark'};
  --bg-0: ${x.sky[0]}; --bg-1: ${x.sky[1]}; --bg-2: ${x.sky[2]};
  --sky: linear-gradient(168deg, ${x.sky[0]} 0%, ${x.sky[1]} 52%, ${x.sky[2]} 100%);
  --sky-glow: radial-gradient(1200px 520px at 78% -8%, ${rgba(x.orb[0], light ? 0.5 : 0.3)}, transparent 70%);
  --surface: ${x.surface}; --surface-2: ${x.surface2}; --surface-3: ${x.surface3};
  --panel: ${panel};
  --glass: ${light ? 'rgba(255, 255, 255, 0.58)' : rgba('#ffffff', 0.06)};
  --glass-2: ${light ? 'rgba(255, 255, 255, 0.82)' : rgba('#ffffff', 0.11)};
  --line: ${rgba(x.ink, light ? 0.12 : 0.15)};
  --line-strong: ${rgba(x.ink, light ? 0.24 : 0.3)};
  --ink: ${x.ink}; --ink-2: ${x.ink};
  --muted: ${x.muted};
  --faint: ${rgba(x.muted, 0.6)};
  --gold: ${x.gold}; --gold-2: ${x.gold2};
  --gold-deep: ${deep(x.gold)};
  --gold-shadow: ${deep(x.gold)};
  --cyan: ${x.cyan}; --cyan-deep: ${deep(x.cyan)};
  --mint: ${x.mint}; --mint-deep: ${deep(x.mint)};
  --coral: ${x.coral}; --coral-deep: ${deep(x.coral)};
  --violet: ${x.violet}; --violet-deep: ${deep(x.violet)};
  --gold-soft: ${softOf(x.gold)};
  --cyan-soft: ${softOf(x.cyan)};
  --mint-soft: ${softOf(x.mint)};
  --coral-soft: ${softOf(x.coral)};
  --violet-soft: ${softOf(x.violet)};
  --shadow: 0 22px 48px -20px rgba(${shadowC}, ${light ? 0.28 : 0.85});
  --shadow-sm: 0 12px 28px -16px rgba(${shadowC}, ${light ? 0.24 : 0.8});
  --glow-gold: 0 0 22px ${rgba(x.gold, light ? 0.3 : 0.35)};
  --glow-cyan: 0 0 22px ${rgba(x.cyan, light ? 0.3 : 0.35)};
  --radius: ${radius}; --radius-sm: ${radiusSm}; --radius-xs: ${radiusXs};
  --btn-ink: ${onAccent};
  --orb-a: ${x.orb[0]}; --orb-b: ${x.orb[1]}; --orb-c: ${x.orb[2]};
  --orb-a-soft: ${rgba(x.orb[0], light ? 0.4 : 0.24)};
  --orb-b-soft: ${rgba(x.orb[1], light ? 0.4 : 0.24)};
  --orb-c-soft: ${rgba(x.orb[2], light ? 0.4 : 0.24)};
}`;
}

function injectThemeStyles(): void {
  if (document.getElementById('abhyas-themes')) return;
  const css = THEMES.map(themeCss).join('\n');
  const el = document.createElement('style');
  el.id = 'abhyas-themes';
  el.textContent = css;
  document.head.appendChild(el);
}

/* ── apply + init ────────────────────────────────────────────────────── */

function apply(): void {
  const id = effectiveThemeId();
  const def = THEME_BY_ID.get(id) ?? THEMES[0]!;
  const root = document.documentElement;
  if (root.dataset.theme !== def.id) {
    root.classList.add('theme-swap');
    window.setTimeout(() => root.classList.remove('theme-swap'), 650);
  }
  root.dataset.theme = def.id;
  root.dataset.mode = def.mode;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', def.sky[0]);
}

let clockTimer: number | undefined;

export function initThemes(): void {
  load();
  injectThemeStyles();
  apply();
  if (clockTimer === undefined) {
    clockTimer = window.setInterval(() => {
      if (!state.auto) return;
      const id = ENV_THEME[periodOf()];
      if (id !== effectiveThemeId()) {
        state = { auto: true, themeId: id };
        persist();
        apply();
        listeners.forEach((l) => l());
      }
    }, 60_000);
  }
}

/* ── React hook ──────────────────────────────────────────────────────── */

export function useTheme(): { auto: boolean; themeId: string; period: Period; theme: ThemeDef } {
  const [, tick] = useState(0);
  useEffect(() => {
    const l = () => tick((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);
  const id = effectiveThemeId();
  return { auto: state.auto, themeId: id, period: periodOf(), theme: THEME_BY_ID.get(id) ?? THEMES[0]! };
}

export const CATEGORIES: { id: ThemeDef['cat'] | 'all'; en: string; hi: string }[] = [
  { id: 'all', en: 'All themes', hi: 'सभी थीम' },
  { id: 'time', en: 'Time of day', hi: 'दिन के अनुसार' },
  { id: 'nature', en: 'Nature', hi: 'प्रकृति' },
  { id: 'fantasy', en: 'Fantasy', hi: 'कल्पना' },
  { id: 'gaming', en: 'Gaming', hi: 'गेमिंग' },
  { id: 'premium', en: 'Premium', hi: 'प्रीमियम' },
  { id: 'seasonal', en: 'Seasonal', hi: 'मौसमी' },
];
