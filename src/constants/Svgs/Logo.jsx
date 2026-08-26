export default function Logo() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Main head */}
      <ellipse cx="7" cy="7.2" rx="6" ry="5.8" fill="#4CAF50" />

      {/* Eye socket bumps */}
      <circle cx="4.0" cy="4.4" r="1.9" fill="#43A047" />
      <circle cx="10.0" cy="4.4" r="1.9" fill="#43A047" />

      {/* Eye whites */}
      <circle cx="4.0" cy="4.4" r="1.35" fill="white" />
      <circle cx="10.0" cy="4.4" r="1.35" fill="white" />

      {/* Pupils */}
      <circle cx="4.3" cy="4.65" r="0.78" fill="#1a1a1a" />
      <circle cx="10.3" cy="4.65" r="0.78" fill="#1a1a1a" />

      {/* Eye highlights */}
      <circle cx="3.95" cy="4.15" r="0.3" fill="rgba(255,255,255,0.8)" />
      <circle cx="9.95" cy="4.15" r="0.3" fill="rgba(255,255,255,0.8)" />

      {/* Snout */}
      <ellipse cx="7" cy="9.8" rx="3.4" ry="2.2" fill="#66BB6A" />

      {/* Jaw dividing line */}
      <path d="M3.8 9.8 Q7 9.2 10.2 9.8" stroke="#388E3C" strokeWidth="0.5" fill="none" />

      {/* Nostrils */}
      <circle cx="5.9" cy="9.0" r="0.42" fill="#2E7D32" />
      <circle cx="8.1" cy="9.0" r="0.42" fill="#2E7D32" />

      {/* Teeth */}
      <rect x="5.4" y="9.85" width="0.82" height="1.15" rx="0.35" fill="white" />
      <rect x="7.78" y="9.85" width="0.82" height="1.15" rx="0.35" fill="white" />
    </svg>
  )
}
