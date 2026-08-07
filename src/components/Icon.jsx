// Line icons to replace emoji-as-icon everywhere (emoji render differently on
// every OS, can't be recoloured, and read as toy-grade next to real UI).
// Stroke-based, inherits currentColor, sized via the `size` prop.
const PATHS = {
  car:       <><path d="M3 13l1.7-4.5A2 2 0 0 1 6.6 7h10.8a2 2 0 0 1 1.9 1.5L21 13" /><path d="M4 13h16a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1a2 2 0 1 1-4 0H9a2 2 0 1 1-4 0H4a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1Z" /></>,
  camera:    <><path d="M4 8h2.2l1.2-2h9.2l1.2 2H20a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" /><circle cx="12" cy="13" r="3.4" /></>,
  inbox:     <><path d="M4 4h16v16H4z" /><path d="M4 14h4l2 3h4l2-3h4" /></>,
  gear:      <><circle cx="12" cy="12" r="3" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1" /></>,
  pin:       <><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>,
  map:       <><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" /><path d="M9 4v14M15 6v14" /></>,
  box:       <><path d="M3.3 7 12 3l8.7 4v10L12 21l-8.7-4V7Z" /><path d="M3.3 7 12 11l8.7-4M12 11v10" /></>,
  bin:       <><path d="M5 8h14l-1.2 12H6.2L5 8Z" /><path d="M3 8h18M9 8V5h6v3" /></>,
  lock:      <><rect x="5" y="10.5" width="14" height="9.5" rx="1.6" /><path d="M8 10.5V7.6a4 4 0 0 1 8 0v2.9" /></>,
  unlock:    <><rect x="5" y="10.5" width="14" height="9.5" rx="1.6" /><path d="M8 10.5V7.6a4 4 0 0 1 7.7-1.5" /></>,
  check:     <path d="m4.5 12.6 5 5L19.5 7" />,
  close:     <path d="M6 6l12 12M18 6 6 18" />,
  edit:      <><path d="M4 20h4l11-11-4-4L4 16v4Z" /><path d="m13 7 4 4" /></>,
  warning:   <><path d="M12 3.5 22 20H2L12 3.5Z" /><path d="M12 10v4.5M12 17.2v.3" /></>,
  image:     <><rect x="3" y="5" width="18" height="14" rx="1.6" /><path d="m6 16 4-4 3 3 2.5-2.5L19 16" /><circle cx="9" cy="9.5" r="1.4" /></>,
  torch:     <><path d="M9 3h6v4l-2 3v11h-2V10L9 7V3Z" /><path d="M9 5.5h6" /></>,
  refresh:   <><path d="M20 12a8 8 0 1 1-2.6-5.9" /><path d="M20 3v4h-4" /></>,
  clipboard: <><rect x="6" y="5" width="12" height="16" rx="1.6" /><path d="M9 5a3 3 0 0 1 6 0M9 11h6M9 15h6" /></>,
  store:     <><path d="M4 9 5.4 4h13.2L20 9" /><path d="M4 9v11h16V9M4 9h16M9.5 20v-6h5v6" /></>,
  phone:     <><rect x="7" y="3" width="10" height="18" rx="2" /><path d="M11 17.8h2" /></>,
  monitor:   <><rect x="3" y="4" width="18" height="13" rx="1.6" /><path d="M9 21h6M12 17v4" /></>,
  sparkle:   <><path d="M12 4l1.8 5.1L19 11l-5.2 1.9L12 18l-1.8-5.1L5 11l5.2-1.9L12 4Z" /><path d="M19 3.5v3M17.5 5h3" /></>,
  upload:    <><path d="M12 16V4M7.5 8.5 12 4l4.5 4.5" /><path d="M4 20h16" /></>,
  search:    <><circle cx="10.8" cy="10.8" r="6.3" /><path d="m15.5 15.5 5 5" /></>,
  question:  <><circle cx="12" cy="12" r="9" /><path d="M9.6 9.2a2.6 2.6 0 1 1 3.5 2.9c-.8.4-1.1 1-1.1 1.9M12 17v.3" /></>,
}

export default function Icon({ name, size = 18, strokeWidth = 1.9, style }) {
  const d = PATHS[name]
  if (!d) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
      style={{ flexShrink: 0, verticalAlign: '-3px', ...style }}>
      {d}
    </svg>
  )
}
