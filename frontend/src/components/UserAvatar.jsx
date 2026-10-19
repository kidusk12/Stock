import { useState } from 'react'

const SIZE_MAP = {
  xs: 'h-6 w-6 text-xs',
  sm: 'h-8 w-8 text-sm',
  md: 'h-10 w-10 text-base',
  lg: 'h-14 w-14 text-xl',
  xl: 'h-16 w-16 text-2xl',
  '2xl': 'h-24 w-24 text-4xl',
}

// Deterministic color palette for initial-based avatars
const BG_COLORS = [
  'bg-[#235667]',
  'bg-[#2e6b7d]',
  'bg-[#1e4856]',
  'bg-[#37697a]',
  'bg-[#2a5b6d]',
]

export default function UserAvatar({
  user,
  size = 'md',
  className = '',
  showBorder = true,
}) {
  const [imgError, setImgError] = useState(false)

  const name = user?.fullName || user?.username || 'User'
  // Get first letter of the name
  const cleanName = name.replace(/[^a-zA-Z\u1200-\u137F]/g, '').trim()
  const firstLetter = cleanName ? cleanName.charAt(0).toUpperCase() : 'U'

  // Pick background color based on name
  const colorIndex = (name.charCodeAt(0) || 0) % BG_COLORS.length
  const bgColor = BG_COLORS[colorIndex]

  const sizeClass = SIZE_MAP[size] || SIZE_MAP.md
  const borderClass = showBorder ? 'border-2 border-white/80 shadow-2xs' : ''

  if (user?.avatarUrl && !imgError) {
    return (
      <img
        src={user.avatarUrl}
        alt={name}
        onError={() => setImgError(true)}
        className={`${sizeClass} rounded-full object-cover ${borderClass} ${className}`}
      />
    )
  }

  return (
    <div
      className={`${sizeClass} rounded-full ${bgColor} text-white font-bold flex items-center justify-center select-none ${borderClass} ${className}`}
      title={name}
    >
      <span className="tracking-wide drop-shadow-2xs">{firstLetter}</span>
    </div>
  )
}
