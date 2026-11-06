import type { MouseEvent } from 'react';

/**
 * 3D tilt handlers — set per-element CSS vars consumed by `.tilt` styles.
 * Purely presentational; cheap enough for every card.
 */
export function tiltHandlers(strength = 6) {
  return {
    onMouseMove: (e: MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty('--ry', `${(px * strength).toFixed(2)}deg`);
      el.style.setProperty('--rx', `${(-py * strength).toFixed(2)}deg`);
      el.style.setProperty('--mx', `${((px + 0.5) * 100).toFixed(1)}%`);
      el.style.setProperty('--my', `${((py + 0.5) * 100).toFixed(1)}%`);
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.style.setProperty('--ry', '0deg');
      el.style.setProperty('--rx', '0deg');
    },
  };
}

/** Hero parallax — sets --px-x / --px-y (-1..1) for the .px-layer children. */
export function parallaxHandler() {
  return {
    onMouseMove: (e: MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--px-x', (((e.clientX - r.left) / r.width - 0.5) * 2).toFixed(2));
      el.style.setProperty('--px-y', (((e.clientY - r.top) / r.height - 0.5) * 2).toFixed(2));
    },
    onMouseLeave: (e: MouseEvent<HTMLElement>) => {
      const el = e.currentTarget;
      el.style.setProperty('--px-x', '0');
      el.style.setProperty('--px-y', '0');
    },
  };
}
