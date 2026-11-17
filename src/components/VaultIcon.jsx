/**
 * Iconos monocromáticos del Vault.
 * Se dibujan con SVG y heredan el color del contenedor (por defecto dorado),
 * así no se rompe la paleta con emojis de colores.
 */
const ICONS = {
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.5 3-6 7-6s7 2.5 7 6" />
    </>
  ),
  pin: (
    <>
      <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  belt: (
    <>
      <path d="M3 7h18v3H3z" />
      <path d="M3 14h18v3H3z" />
      <path d="M10 10h4v4h-4z" />
    </>
  ),
  tag: (
    <>
      <path d="M20 13l-7 7-9-9V4h7l9 9z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10" width="16" height="11" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  chevronLeft: <polyline points="15 18 9 12 15 6" />,
  chevronRight: <polyline points="9 18 15 12 9 6" />,
  skipNext: (
    <>
      <polygon points="5 4 15 12 5 20" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  gift: (
    <>
      <rect x="3" y="8" width="18" height="4" />
      <rect x="5" y="12" width="14" height="9" />
      <line x1="12" y1="8" x2="12" y2="21" />
      <path d="M12 8c-2-3-6-3-6 0 0 2 3 2 6 0" />
      <path d="M12 8c2-3 6-3 6 0 0 2-3 2-6 0" />
    </>
  ),
  check: <polyline points="20 6 9 17 4 12" />,
  close: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  fullscreen: (
    <>
      <path d="M8 3H3v5" />
      <path d="M16 3h5v5" />
      <path d="M21 16v5h-5" />
      <path d="M3 16v5h5" />
    </>
  ),
  notes: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="14" y2="17" />
    </>
  ),
  play: <polygon points="6 4 20 12 6 20" />,
  external: (
    <>
      <path d="M14 3h7v7" />
      <path d="M21 3l-9 9" />
      <path d="M19 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5" />
    </>
  ),
  flag: (
    <>
      <path d="M4 21V4" />
      <path d="M4 5c4-2 8 2 12 0v9c-4 2-8-2-12 0" />
    </>
  ),
  bookOpen: (
    <>
      <path d="M2 4h7a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" />
      <path d="M22 4h-7a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h8z" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12" y2="17" />
    </>
  ),
  trash: (
    <>
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <polyline points="3 7 12 13 21 7" />
    </>
  ),
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />,
  megaphone: (
    <>
      <path d="M3 11v2a1 1 0 0 0 1 1h3l7 5V5L7 10H4a1 1 0 0 0-1 1z" />
      <path d="M18 9a4 4 0 0 1 0 6" />
    </>
  ),
  send: (
    <>
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </>
  ),
  chevronDown: <polyline points="6 9 12 15 18 9" />,
  chevronUp: <polyline points="18 15 12 9 6 15" />,
  building: (
    <>
      <rect x="4" y="3" width="16" height="18" rx="1" />
      <path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2" />
      <path d="M10 21v-3h4v3" />
    </>
  ),
  settings: (
    <>
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="17" x2="20" y2="17" />
      <circle cx="9" cy="7" r="2" />
      <circle cx="15" cy="17" r="2" />
    </>
  ),
  tree: (
    <>
      <circle cx="12" cy="4" r="2" />
      <circle cx="6" cy="20" r="2" />
      <circle cx="18" cy="20" r="2" />
      <path d="M12 6v6M6 18v-4h12v4" />
    </>
  ),
  home: (
    <>
      <path d="M3 11l9-8 9 8" />
      <path d="M5 10v10h14V10" />
      <path d="M9 20v-6h6v6" />
    </>
  ),
  folder: (
    <>
      <path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z" />
    </>
  ),
  camera: (
    <>
      <path d="M4 7h3l2-2h6l2 2h3v13H4z" />
      <circle cx="12" cy="13" r="4" />
    </>
  ),
  circle: <circle cx="12" cy="12" r="9" />,
  map: (
    <>
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2V6z" />
      <path d="M9 4v14M15 6v14" />
      <path d="M12 12s2.5-2 2.5-3.7a2.5 2.5 0 0 0-5 0C9.5 10 12 12 12 12z" />
      <circle cx="12" cy="8.3" r="0.9" />
    </>
  ),
  notebook: (
    <>
      <path d="M6 3h12a2 2 0 0 1 2 2v15a1 1 0 0 1-1 1H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z" />
      <path d="M8 3v18" />
      <path d="M12 8h5M12 12h5M12 16h3" />
      <path d="M16 3v6l-2-1-2 1V3" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5" />
      <path d="M9 2h6" />
      <path d="M12 2v3" />
      <path d="M19 5l1.5 1.5" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="4" width="14" height="17" rx="2" />
      <path d="M9 4V2h6v2" />
      <path d="M8 9h2M13 9h3M8 13h2M13 13h3M8 17h2M13 17h3" />
    </>
  ),
  dojo: (
    <>
      <path d="M3 9l9-5 9 5" />
      <path d="M5 9v11h14V9" />
      <path d="M3 9h18" />
      <circle cx="12" cy="12.5" r="2" />
      <path d="M9 20v-1.5a3 3 0 0 1 6 0V20" />
    </>
  ),
  support: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="3.5" />
      <path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9" />
    </>
  ),
  tutorial: (
    <>
      <path d="M2 8l10-4 10 4-10 4L2 8z" />
      <path d="M6 10v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5" />
      <path d="M22 8v6" />
    </>
  ),
  access: (
    <>
      <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z" />
      <circle cx="12" cy="11" r="2" />
      <path d="M12 13v3" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" />
      <path d="M16 17l5-5-5-5" />
      <path d="M21 12H9" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12" />
      <polyline points="7 10 12 15 17 10" />
      <path d="M5 21h14" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1" />
      <rect x="13" y="3" width="8" height="5" rx="1" />
      <rect x="13" y="10" width="8" height="11" rx="1" />
      <rect x="3" y="13" width="8" height="8" rx="1" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  pause: (
    <>
      <rect x="7" y="5" width="3.5" height="14" rx="1" />
      <rect x="13.5" y="5" width="3.5" height="14" rx="1" />
    </>
  ),
  rotate: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <polyline points="3 4 3 10 9 10" />
    </>
  ),
  volume: (
    <>
      <polygon points="4 9 8 9 12 5 12 19 8 15 4 15" />
      <path d="M16 8a5 5 0 0 1 0 8" />
      <path d="M19 5a9 9 0 0 1 0 14" />
    </>
  ),
  mute: (
    <>
      <polygon points="4 9 8 9 12 5 12 19 8 15 4 15" />
      <line x1="16" y1="9" x2="22" y2="15" />
      <line x1="22" y1="9" x2="16" y2="15" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v5a4 4 0 0 1-8 0V4z" />
      <path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3" />
      <path d="M12 13v4" />
      <path d="M8 21h8M9 17h6" />
    </>
  ),
  plus: (
    <>
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </>
  ),
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  undo: (
    <>
      <path d="M9 7L4 12l5 5" />
      <path d="M4 12h9a6 6 0 0 1 6 6v1" />
    </>
  ),
};

const VaultIcon = ({
  name,
  size = 16,
  color = 'currentColor',
  strokeWidth = 2,
  style,
  title,
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ display: 'inline-block', verticalAlign: 'middle', flexShrink: 0, ...style }}
    role={title ? 'img' : 'presentation'}
    aria-hidden={title ? undefined : true}
  >
    {title ? <title>{title}</title> : null}
    {ICONS[name] || ICONS.circle}
  </svg>
);

export default VaultIcon;
