interface UiIconProps {
  type: string
  size?: number
  color?: string
  className?: string
}

export function UiIcon({ type, size = 16, color = "currentColor", className }: UiIconProps) {
  const p = { strokeLinecap: "round" as const, strokeLinejoin: "round" as const }

  switch (type) {
    case "list":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M2 4h12M2 8h12M2 12h8" stroke={color} strokeWidth="1.5" {...p} /></svg>
    case "sun":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><circle cx="8" cy="8" r="3" stroke={color} strokeWidth="1.5" /><path d="M8 2v1.5M8 12.5V14M2 8h1.5M12.5 8H14M3.75 3.75l1.06 1.06M11.19 11.19l1.06 1.06M12.25 3.75l-1.06 1.06M4.81 11.19l-1.06 1.06" stroke={color} strokeWidth="1.5" {...p} /></svg>
    case "folder":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M1.5 3.5a1 1 0 011-1h3.59a1 1 0 01.7.29l1.42 1.42a1 1 0 00.7.29h4.59a1 1 0 011 1v7a1 1 0 01-1 1h-11a1 1 0 01-1-1z" stroke={color} strokeWidth="1.3" /></svg>
    case "clock":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3" /><path d="M8 4.5V8.5L10.5 10" stroke={color} strokeWidth="1.3" {...p} /></svg>
    case "plus":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M8 3v10M3 8h10" stroke={color} strokeWidth="1.8" {...p} /></svg>
    case "search":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><circle cx="7" cy="7" r="4.5" stroke={color} strokeWidth="1.5" /><path d="M10.5 10.5L14 14" stroke={color} strokeWidth="1.5" {...p} /></svg>
    case "x":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M4 4l8 8M12 4l-8 8" stroke={color} strokeWidth="1.5" {...p} /></svg>
    case "chevron":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M6 4l4 4-4 4" stroke={color} strokeWidth="1.5" {...p} /></svg>
    case "comment":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M2 2.5h12a1 1 0 011 1v7a1 1 0 01-1 1H5l-3 3v-3a1 1 0 01-1-1v-7a1 1 0 011-1z" stroke={color} strokeWidth="1.3" /></svg>
    case "desc":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M3 4h10M3 7h10M3 10h7M3 13h4" stroke={color} strokeWidth="1.4" strokeLinecap="round" /></svg>
    case "activity":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><circle cx="8" cy="8" r="6.5" stroke={color} strokeWidth="1.3" /><path d="M8 4.5V8.5L10.5 10" stroke={color} strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /><circle cx="8" cy="8" r="1" fill={color} /></svg>
    case "play":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M5 3.5v9l7-4.5z" fill={color} /></svg>
    case "pause":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><rect x="4" y="3" width="3" height="10" rx=".5" fill={color} /><rect x="9" y="3" width="3" height="10" rx=".5" fill={color} /></svg>
    case "stop":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><rect x="3.5" y="3.5" width="9" height="9" rx="1" fill={color} /></svg>
    case "calendar":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><rect x="2" y="3" width="12" height="11" rx="1.5" stroke={color} strokeWidth="1.3" /><path d="M2 6.5h12M5.5 1.5v3M10.5 1.5v3" stroke={color} strokeWidth="1.3" {...p} /></svg>
    case "filter":
      return <svg width={size} height={size} viewBox="0 0 16 16" fill="none" className={className}><path d="M2 3h12L9.5 8.5V12l-3 1.5V8.5z" stroke={color} strokeWidth="1.3" {...p} /></svg>
    default:
      return null
  }
}
