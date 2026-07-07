const paths: Record<string, string> = {
  home: 'M3 11.5 12 4l9 7.5M5.5 9.5V20h13V9.5',
  list: 'M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01',
  plus: 'M12 5v14M5 12h14',
  chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2',
  settings:
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Zm7.4-3a7.4 7.4 0 0 0-.1-1.2l2-1.5-2-3.4-2.3 1a7.5 7.5 0 0 0-2.1-1.2L14.5 3h-5l-.4 2.7a7.5 7.5 0 0 0-2.1 1.2l-2.3-1-2 3.4 2 1.5a7.4 7.4 0 0 0 0 2.4l-2 1.5 2 3.4 2.3-1c.6.5 1.4.9 2.1 1.2l.4 2.7h5l.4-2.7a7.5 7.5 0 0 0 2.1-1.2l2.3 1 2-3.4-2-1.5c.1-.4.1-.8.1-1.2Z',
  wallet: 'M19 7H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Zm0 0V6a2 2 0 0 0-2-2H6a3 3 0 0 0-3 3v2m13 4h2',
  trendUp: 'M3 17l6-6 4 4 8-8M15 7h6v6',
  trendDown: 'M3 7l6 6 4-4 8 8M15 17h6v-6',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 13l4 4L19 7',
  edit: 'M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3ZM14 6l3 3',
  trash: 'M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2m3 0v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7M10 11v6M14 11v6',
  copy: 'M8 8h11v13H8zM5 16H4V3h12v1',
  download: 'M12 4v12m0 0 4-4m-4 4-4-4M4 20h16',
  upload: 'M12 16V4m0 0 4 4m-4-4L8 8M4 20h16',
  alert: 'M12 9v4m0 4h.01M10.3 4.5 2.8 18a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 4.5a2 2 0 0 0-3.4 0Z',
  target: 'M12 12m-2 0a2 2 0 1 0 4 0 2 2 0 1 0-4 0M12 12m-6 0a6 6 0 1 0 12 0 6 6 0 1 0-12 0M12 12m-10 0a10 10 0 1 0 20 0 10 10 0 1 0-20 0',
  bolt: 'M13 3 4 14h6l-1 7 9-11h-6l1-7Z',
  calendar: 'M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7ZM16 3v4M8 3v4M4 11h16',
  search: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm11 4-6-6',
  chevronDown: 'M6 9l6 6 6-6',
  chevronRight: 'M9 6l6 6-6 6',
  arrowLeft: 'M19 12H5m0 0 6 6m-6-6 6-6',
  shield: 'M12 3l8 3v6c0 4.5-3.4 7.8-8 9-4.6-1.2-8-4.5-8-9V6l8-3Z',
  moon: 'M20 13A8 8 0 1 1 11 4a6.5 6.5 0 0 0 9 9Z',
  sun: 'M12 12m-4 0a4 4 0 1 0 8 0 4 4 0 1 0-8 0M12 2v2m0 16v2M4 12H2m20 0h-2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm-9-9h18M12 3a15 15 0 0 1 0 18 15 15 0 0 1 0-18Z',
  live: 'M12 12m-2.5 0a2.5 2.5 0 1 0 5 0 2.5 2.5 0 1 0-5 0M6.3 6.3a8 8 0 0 0 0 11.4M17.7 6.3a8 8 0 0 1 0 11.4',
  layers: 'M12 3 3 8l9 5 9-5-9-5ZM3 13l9 5 9-5',
  coins: 'M9 8a6 2.5 0 1 0 12 0A6 2.5 0 1 0 9 8m12 0v4c0 1.4-2.7 2.5-6 2.5S9 13.4 9 12V8M3 12a6 2.5 0 0 0 6 2.5M3 12v4c0 1.4 2.7 2.5 6 2.5v0M3 12c0-1 1.3-1.9 3.2-2.3',
  camera: 'M5 7h2l1.5-2.5h7L17 7h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm7 8.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z',
  sparkles: 'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3ZM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 8a7 7 0 0 1 14 0',
  mail: 'M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 1.5 8 5.5 8-5.5',
  refresh: 'M20 12a8 8 0 1 1-2.3-5.6M20 4v4h-4',
}

export function Icon({ name, size = 20, className }: { name: string; size?: number; className?: string }) {
  const d = paths[name] || paths.alert
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d={d} />
    </svg>
  )
}
