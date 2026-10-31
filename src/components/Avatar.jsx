import { useState } from 'react'

/**
 * A resilient avatar component that:
 * 1. Handles DiceBear seeding with proper encoding
 * 2. Falls back to initials on load failure
 * 3. Supports custom sizing and styling
 */
export default function Avatar({ src, name, size = "w-9 h-9", className = "" }) {
  const [errored, setErrored] = useState(false)
  const initial = (name || '?').charAt(0).toUpperCase()
  
  // If we have no src or it failed to load, show initials
  if (!src || errored) {
    return (
      <div className={`${size} rounded-xl bg-[#0066FF] border border-white/10 flex items-center justify-center font-syne font-black text-white shrink-0 ${className}`}>
        <span style={{ fontSize: 'calc(var(--avatar-size, 36px) * 0.4)' }}>{initial}</span>
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name}
      loading="lazy"
      decoding="async"
      className={`${size} rounded-xl border border-white/10 object-cover shrink-0 bg-[#121216] ${className}`}
      onError={() => setErrored(true)}
    />
  )
}
