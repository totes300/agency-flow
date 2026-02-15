"use client"

import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
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
import { PackageIcon, RefreshCwIcon, ClockIcon } from "lucide-react"

interface CategoryBreakdownItem {
  categoryName: string
  estimatedMinutes: number
  actualMinutes: number
}

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
    rolloverMinutes: number
    overageMinutes: number
    categoryBreakdown: CategoryBreakdownItem[] | null
    lastActivityDate: string | null
    healthStatus: string
    activeTaskCount: number
  }
}

const BILLING_TYPE_ICONS: Record<string, typeof PackageIcon> = {
  fixed: PackageIcon,
  retainer: RefreshCwIcon,
  t_and_m: ClockIcon,
}

function BillingTypeIcon({ type }: { type: string }) {
  const Icon = BILLING_TYPE_ICONS[type] ?? PackageIcon
  return <Icon className="size-3" />
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

  return <span>{label}</span>
}

function DataRow({
  label,
  value,
  valueClassName,
}: {
  label: string
  value: React.ReactNode
  valueClassName?: string
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground shrink-0 text-xs">{label}</span>
      <span
        className={cn(
          "text-right text-xs font-medium tabular-nums",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  )
}

function taskCountLabel(count: number) {
  return count === 0 ? "None" : `${count}`
}

function FixedMetrics({ project }: ProjectCardProps) {
  const { categoryBreakdown } = project

  return (
    <div className="space-y-1.5">
      {categoryBreakdown && categoryBreakdown.length > 0 ? (
        categoryBreakdown.map((cat) => (
          <DataRow
            key={cat.categoryName}
            label={cat.categoryName}
            value={
              <>
                {formatDuration(cat.actualMinutes)}
                {" / "}
                {formatDuration(cat.estimatedMinutes)}
              </>
            }
            valueClassName={
              cat.actualMinutes > cat.estimatedMinutes
                ? "text-red-600 dark:text-red-400"
                : undefined
            }
          />
        ))
      ) : (
        <DataRow
          label="Budget"
          value={
            <>
              {formatDuration(project.totalMinutes)}
              {project.budgetMinutes
                ? ` / ${formatDuration(project.budgetMinutes)}`
                : ""}
            </>
          }
        />
      )}
      {project.burnPercent !== null && project.budgetMinutes && (
        <div className="space-y-1">
          <DataRow label="Burn" value={`${project.burnPercent}%`} />
          <BurnProgress percent={project.burnPercent} className="h-1.5" />
        </div>
      )}
      <DataRow label="Tasks" value={taskCountLabel(project.activeTaskCount)} />
    </div>
  )
}

function RetainerMetrics({ project }: ProjectCardProps) {
  return (
    <div className="space-y-1.5">
      <DataRow
        label="Status"
        value={project.retainerStatus === "active" ? "Active" : "Inactive"}
        valueClassName={
          project.retainerStatus === "active"
            ? "text-green-600 dark:text-green-400"
            : "text-muted-foreground"
        }
      />
      <DataRow
        label="This Month"
        value={
          <span>
            {formatDuration(project.currentMonthMinutes)}
            {project.budgetMinutes
              ? ` / ${formatDuration(project.budgetMinutes)}`
              : ""}
          </span>
        }
      />
      {project.rolloverMinutes > 0 && (
        <p className="text-muted-foreground/70 text-right text-[10px]">
          incl. {formatDuration(project.rolloverMinutes)} rollover
        </p>
      )}
      {project.overageMinutes > 0 && (
        <DataRow
          label="Overage"
          value={formatDuration(project.overageMinutes)}
          valueClassName="text-red-600 dark:text-red-400"
        />
      )}
      {project.burnPercent !== null && project.budgetMinutes && (
        <div className="space-y-1">
          <DataRow label="Burn" value={`${project.burnPercent}%`} />
          <BurnProgress percent={project.burnPercent} className="h-1.5" />
        </div>
      )}
      <DataRow label="Tasks" value={taskCountLabel(project.activeTaskCount)} />
    </div>
  )
}

function TandMMetrics({ project }: ProjectCardProps) {
  return (
    <div className="space-y-1.5">
      <DataRow
        label="Unbilled"
        value={formatDuration(project.uninvoicedMinutes)}
        valueClassName={
          project.uninvoicedMinutes > 0
            ? "text-amber-600 dark:text-amber-400"
            : undefined
        }
      />
      <DataRow
        label="Last Invoiced"
        value={
          project.lastInvoicedAt
            ? formatDate(project.lastInvoicedAt)
            : "Never"
        }
      />
      <DataRow label="Tasks" value={taskCountLabel(project.activeTaskCount)} />
    </div>
  )
}

export function ProjectCard({ project }: ProjectCardProps) {
  const router = useRouter()
  const healthStatus = project.healthStatus as HealthStatus

  return (
    <Card
      className={cn(
        "cursor-pointer gap-0 overflow-hidden py-0 transition-colors hover:bg-accent/50",
        project.isArchived && "opacity-60",
      )}
      onClick={() => router.push(`/projects/${project._id}`)}
    >
      {/* Header: type tag + last activity + archived badge */}
      <div className="flex items-center justify-between px-4 pt-3 pb-0">
        <span className="text-muted-foreground flex items-center gap-1 text-[11px] uppercase tracking-wider">
          <BillingTypeIcon type={project.billingType} />
          {BILLING_TYPE_LABELS[project.billingType]}
        </span>
        <span className="text-muted-foreground/70 flex items-center gap-1.5 text-[11px]">
          <LastActivity date={project.lastActivityDate} />
          {project.isArchived && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              Archived
            </Badge>
          )}
        </span>
      </div>

      {/* Identity: project name + health badge */}
      <div className="flex items-start justify-between gap-2 px-4 pt-1.5 pb-2.5">
        <h3 className="truncate text-sm font-semibold leading-snug">
          {project.name}
        </h3>
        <Badge
          variant="outline"
          className="shrink-0 gap-1 px-1.5 py-0 text-[11px] leading-5"
        >
          <span
            className={cn(
              "inline-block size-1.5 rounded-full",
              HEALTH_STATUS_COLORS[healthStatus],
            )}
            aria-hidden="true"
          />
          {HEALTH_STATUS_LABELS[healthStatus]}
        </Badge>
      </div>

      {/* Metrics */}
      <CardContent className="border-t bg-muted/30 px-4 py-3">
        {project.billingType === "fixed" && (
          <FixedMetrics project={project} />
        )}
        {project.billingType === "retainer" && (
          <RetainerMetrics project={project} />
        )}
        {project.billingType === "t_and_m" && (
          <TandMMetrics project={project} />
        )}
      </CardContent>
    </Card>
  )
}
