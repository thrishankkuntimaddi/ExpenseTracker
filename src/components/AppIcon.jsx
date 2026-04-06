/**
 * AppIcon — inline SVG matching the public/favicon.svg
 * Use this anywhere in JSX so the icon is always in sync.
 */
export default function AppIcon({ size = 36 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      xmlns="http://www.w3.org/2000/svg"
      style={{ flexShrink: 0 }}
    >
      <defs>
        <linearGradient id="appIconBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#2563EB" />
          <stop offset="100%" stopColor="#1E3A8A" />
        </linearGradient>
      </defs>

      {/* Background */}
      <rect width="64" height="64" rx="14" fill="url(#appIconBg)" />

      {/* Bar chart bars */}
      <rect x="8"  y="46" width="9" height="11" rx="2" fill="rgba(255,255,255,0.38)" />
      <rect x="19" y="38" width="9" height="19" rx="2" fill="rgba(255,255,255,0.58)" />
      <rect x="30" y="28" width="9" height="29" rx="2" fill="rgba(255,255,255,0.85)" />
      <rect x="41" y="33" width="9" height="24" rx="2" fill="rgba(255,255,255,0.65)" />

      {/* Trend line */}
      <polyline
        points="12,46 23,38 34,28 45.5,20"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />

      {/* Peak dot */}
      <circle cx="45.5" cy="20" r="3.5" fill="white" />

      {/* ₹ symbol */}
      <text
        x="9"
        y="20"
        fontFamily="system-ui, -apple-system, Arial, sans-serif"
        fontSize="14"
        fontWeight="800"
        fill="rgba(255,255,255,0.9)"
      >
        ₹
      </text>
    </svg>
  );
}
