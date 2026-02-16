export const STATUS_OPTIONS = [
  { value: "inbox", label: "Inbox" },
  { value: "today", label: "Today" },
  { value: "next_up", label: "Next Up" },
  { value: "admin_review", label: "Review" },
  { value: "stuck", label: "Stuck" },
  { value: "done", label: "Done" },
] as const

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

export const BILLING_TYPE_LABELS: Record<string, string> = {
  fixed: "Fixed",
  retainer: "Retainer",
  t_and_m: "T&M",
}

export type HealthStatus = "on_track" | "at_risk" | "over_budget" | "no_activity"

export const HEALTH_STATUS_LABELS: Record<HealthStatus, string> = {
  on_track: "On Track",
  at_risk: "At Risk",
  over_budget: "Over Budget",
  no_activity: "No Activity",
}

export const HEALTH_STATUS_COLORS: Record<HealthStatus, string> = {
  on_track: "bg-green-500",
  at_risk: "bg-amber-500",
  over_budget: "bg-red-500",
  no_activity: "bg-gray-400",
}
