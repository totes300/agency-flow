import type { TaskStatusKey } from "@/lib/task-config"

interface StatusIconProps {
  status: TaskStatusKey | string
  size?: number
  className?: string
}

export function StatusIcon({ status, size = 18, className }: StatusIconProps) {
  if (status === "done") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
        <circle cx="10" cy="10" r="9" fill="#5a9e6f" />
        <path d="M6 10.5L8.8 13.2L14 7.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (status === "admin_review") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="#9b8ab5" strokeWidth="1.8" />
        <path d="M6.5 10.5L8.8 12.8L13.5 7.5" stroke="#9b8ab5" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
  }

  if (status === "today") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="#c25852" strokeWidth="1.5" strokeDasharray="3.5 3" />
        <circle cx="10" cy="10" r="4.5" fill="#c25852" />
      </svg>
    )
  }

  if (status === "next_up") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="#7a9ab8" strokeWidth="1.5" strokeDasharray="3.5 3" />
        <path d="M10 5.5A4.5 4.5 0 0 1 10 14.5Z" fill="#7a9ab8" />
      </svg>
    )
  }

  if (status === "stuck") {
    return (
      <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
        <circle cx="10" cy="10" r="8" stroke="#d97706" strokeWidth="1.5" strokeDasharray="3.5 3" />
        <path d="M10 6v5M10 13.5v.5" stroke="#d97706" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  // inbox (default)
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="#c2c7ce" strokeWidth="1.5" strokeDasharray="3.5 3" />
    </svg>
  )
}
