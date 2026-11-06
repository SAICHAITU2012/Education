import type { SVGProps } from 'react';

export type IconName =
  | 'home'
  | 'chart'
  | 'users'
  | 'settings'
  | 'mic'
  | 'stop'
  | 'arrow'
  | 'check'
  | 'rotate'
  | 'volume'
  | 'volumeOff'
  | 'shield'
  | 'wifiOff'
  | 'sparkle'
  | 'clock'
  | 'chevron'
  | 'play'
  | 'edit'
  | 'download'
  | 'trash'
  | 'copy'
  | 'lock'
  | 'globe'
  | 'quote'
  | 'alert'
  | 'brain'
  | 'target'
  | 'close'
  | 'star'
  | 'trophy'
  | 'palette'
  | 'pin'
  | 'bolt'
  | 'flag'
  | 'sword';

const paths: Record<IconName, JSX.Element> = {
  home: <path d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" />,
  chart: (
    <>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20a6 6 0 0 1 12 0M16 5.5a3 3 0 0 1 0 5.8M17 15.5a6 6 0 0 1 4 4.5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9c.1.36.34.67.66.87.28.18.61.28.94.28H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="2.5" width="6" height="11" rx="3" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8" />
    </>
  ),
  stop: <rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" stroke="none" />,
  arrow: <path d="M4 12h15M13 6l6 6-6 6" />,
  check: <path d="m4 12.5 5 5L20 6.5" />,
  rotate: <path d="M3 11a9 9 0 1 1 2.6 7.3M3 5v6h6" />,
  volume: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9z" />
      <path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" />
    </>
  ),
  volumeOff: (
    <>
      <path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 4.5 6v6c0 4.6 3.2 7.8 7.5 9 4.3-1.2 7.5-4.4 7.5-9V6z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  wifiOff: (
    <>
      <path d="M2 3l20 20M8.5 8.5A12 12 0 0 1 22 9M2 9a15 15 0 0 1 3.2-2M5.5 13a10 10 0 0 1 4-1.7M9 17a5 5 0 0 1 4.5-.8M12 21h.01" />
    </>
  ),
  sparkle: <path d="M12 2.5 14 9l6.5 2L14 13l-2 6.5L10 13l-6.5-2L10 9zM19 3v3M20.5 4.5h-3" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  play: <path d="M7 4.5v15l13-7.5z" />,
  edit: <path d="M4 20h4L20 8l-4-4L4 16zM14 6l4 4" />,
  download: <path d="M12 3v12M7 10l5 5 5-5M4 21h16" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 14h10l1-14M10 11v6M14 11v6" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="12" height="12" rx="2" />
      <path d="M5 15H3V3h12v2" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c3 3.5 3 14.5 0 18M12 3c-3 3.5-3 14.5 0 18" />
    </>
  ),
  quote: <path d="M9 7H5v6h4v4c0 1.5-1 2.5-3 3M19 7h-4v6h4v4c0 1.5-1 2.5-3 3" />,
  alert: (
    <>
      <path d="M12 3 2 21h20z" />
      <path d="M12 9v5M12 18h.01" />
    </>
  ),
  brain: (
    <>
      <path d="M9 4a3 3 0 0 0-3 3 3 3 0 0 0-1 5.8V16a3 3 0 0 0 3 3h1V4zM15 4a3 3 0 0 1 3 3 3 3 0 0 1 1 5.8V16a3 3 0 0 1-3 3h-1V4zM12 4v15" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6 6 18" />,
  palette: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18c1.4 0 2-.9 2-1.8 0-.6-.3-1-.6-1.4-.3-.4-.6-.8-.6-1.4 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8Z" />
      <circle cx="7.5" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="10.5" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7.5" r="1.1" fill="currentColor" stroke="none" />
    </>
  ),
  star: (
    <path d="M12 2.8 14.9 8.9 21.5 9.8 16.7 14.4 17.9 21 12 17.8 6.1 21 7.3 14.4 2.5 9.8 9.1 8.9z" fill="currentColor" stroke="none" />
  ),
  trophy: (
    <>
      <path d="M7 4h10v5a5 5 0 0 1-10 0z" />
      <path d="M7 5H4v2a4 4 0 0 0 3 3.9M17 5h3v2a4 4 0 0 1-3 3.9" />
      <path d="M12 14v3M8 21h8M9.5 21a2.5 2.5 0 0 1 5 0" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-10.3A6.5 6.5 0 0 1 12 4a6.5 6.5 0 0 1 6.5 6.7C18.5 15.4 12 21 12 21z" />
      <circle cx="12" cy="10.6" r="2.2" />
    </>
  ),
  bolt: <path d="M13 2 4.5 13.5H11L9.8 22l8.7-11.5H12z" fill="currentColor" stroke="none" />,
  flag: <path d="M5 21V4M5 4h13l-2.5 3.5L18 11H5" />,
  sword: <path d="M14.5 3.5 20 3l-.5 5.5L9 19l-2.5.5L6 22l-3-3 2.5-.5L6 16zM6 16l-3.5-3.5M8 18l3.5 3.5" />,
};

export function Icon({
  name,
  size = 20,
  ...rest
}: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      {paths[name]}
    </svg>
  );
}
