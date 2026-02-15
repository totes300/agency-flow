"use client"

import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardAction } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { BurnProgress } from "@/components/burn-progress"
import { formatDuration, formatDate } from "@/lib/format"
import {
  BILLING_TYPE_LABELS,
  HEALTH_STATUS_LABELS,
  HEALTH_STATUS_COLORS,
  type HealthStatus,
} from "@/lib/constants"
import { cn } from "@/lib/utils"

interface ProjectCardProps {
  project: {
    _id: string
    name: string
    billingType: string
    isArchived: boolean
    retainerStatus?: string
    lastInvoicedAt: string | null
    totalMinutes: number
    currentMonthMinutes: number
    uninvoicedMinutes: number
    budgetMinutes: number | null
    burnPercent: number | null
    lastActivityDate: string | null
    healthStatus: string
    activeTaskCount: number
  }
}

function HealthDot({ status }: { status: HealthStatus }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        className={cn("inline-block h-2 w-2 rounded-full", HEALTH_STATUS_COLORS[status])}
        aria-hidden="true"
      />
      {HEALTH_STATUS_LABELS[status]}
    </span>
  )
}

function LastActivity({ date }: { date: string | null }) {
  if (!date) return null

  const now = new Date()
  const [y, m, d] = date.split("-").map(Number)
  const activityDate = new Date(y, m - 1, d)
  const diffDays = Math.floor(
    (now.getTime() - activityDate.getTime()) / (1000 * 60 * 60 * 24),
  )

  let label: string
  if (diffDays === 0) label = "today"
  else if (diffDays === 1) label = "yesterday"
  else label = `${diffDays}d ago`

  return (
    <span className="text-xs text-muted-foreground">
      Last active: {label}
    </span>
  )
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const healthStatus = project.healthStatus as HealthStatus
  const isFixedOrRetainer =
    project.billingType === "fixed" || project.billingType === "retainer"

  const usedMinutes =
    project.billingType === "retainer"
      ? project.currentMonthMinutes
      : project.totalMinutes

  return (
    <Card
      size="sm"
      className={cn(
        "cursor-pointer transition-colors hover:bg-accent/50",
        project.isArchived && "opacity-60",
      )}
      onClick={() => router.push(`/projects/${project._id}`)}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="truncate">{project.name}</span>
          <LastActivity date={project.lastActivityDate} />
        </CardTitle>
        <CardAction>
          <div className="flex items-center gap-1.5">
            {project.isArchived && <Badge variant="secondary">Archived</Badge>}
            {project.billingType === "retainer" && project.retainerStatus && (
              <Badge
                variant={
                  project.retainerStatus === "active" ? "default" : "secondary"
                }
              >
                {project.retainerStatus === "active" ? "Active" : "Inactive"}
              </Badge>
            )}
            <Badge variant="outline">
              {BILLING_TYPE_LABELS[project.billingType]}
            </Badge>
          </div>
        </CardAction>
        <CardDescription>
          <span className="flex items-center gap-2">
            <HealthDot status={healthStatus} />
            <span aria-hidden="true" className="text-muted-foreground/40">
              &middot;
            </span>
            <span className="text-xs text-muted-foreground">
              {project.activeTaskCount === 0
                ? "No tasks"
                : `${project.activeTaskCount} task${project.activeTaskCount === 1 ? "" : "s"}`}
            </span>
          </span>
        </CardDescription>
      </CardHeader>

      <CardContent>
        {isFixedOrRetainer ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">
                {formatDuration(usedMinutes)}
                {project.budgetMinutes
                  ? ` / ${formatDuration(project.budgetMinutes)} used`
                  : " used"}
              </span>
              {project.burnPercent !== null && (
                <span className="font-medium">{project.burnPercent}%</span>
              )}
            </div>
            <BurnProgress percent={project.burnPercent ?? 0} />
          </div>
        ) : (
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {formatDuration(project.uninvoicedMinutes)} uninvoiced
            </p>
            <p className="text-xs text-muted-foreground">
              {project.lastInvoicedAt
                ? `Last invoiced: ${formatDate(project.lastInvoicedAt)}`
                : "Never invoiced"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
