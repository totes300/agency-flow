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
