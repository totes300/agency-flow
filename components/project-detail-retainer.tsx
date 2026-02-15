"use client"

import { useState, useEffect, useRef } from "react"
import { useQuery, useMutation } from "convex/react"
import { api } from "@/convex/_generated/api"
import { Id } from "@/convex/_generated/dataModel"
import { toast } from "sonner"
import { formatDuration, formatCurrency } from "@/lib/format"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { BurnProgress } from "@/components/burn-progress"
import {
  AlertTriangleIcon,
  CalendarIcon,
  ChevronDownIcon,
} from "lucide-react"

interface RetainerProjectDetailProps {
  projectId: Id<"projects">
  retainerStatus?: string
  currency: string
  isAdmin: boolean
}

function getCurrentYearMonth(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
}

export function RetainerProjectDetail({
  projectId,
  retainerStatus,
  currency,
  isAdmin,
}: RetainerProjectDetailProps) {
  const currentMonth = getCurrentYearMonth()
  const [selectedMonth] = useState(currentMonth)
  const [historyOpen, setHistoryOpen] = useState(false)

  const usage = useQuery(api.retainerPeriods.getUsage, {
    projectId,
    yearMonth: selectedMonth,
  })
  const history = useQuery(api.retainerPeriods.getHistory, { projectId })
  const toggleStatus = useMutation(api.projects.toggleRetainerStatus)
  const ensurePeriod = useMutation(api.retainerPeriods.getOrCreateForMonth)

  const periodCreated = useRef(false)
  useEffect(() => {
    if (usage && !usage.periodExists && !periodCreated.current) {
      periodCreated.current = true
      ensurePeriod({ projectId, yearMonth: selectedMonth }).catch(() => {})
    }
  }, [usage, usage?.periodExists, projectId, selectedMonth, ensurePeriod])

  async function handleToggleStatus() {
    try {
      await toggleStatus({ id: projectId })
      toast.success("Retainer status updated")
    } catch (err: unknown) {
      toast.error((err as Error).message)
    }
  }

  if (!usage) return null

  const remainingMinutes = Math.max(
    0,
    usage.totalAvailable - usage.usedMinutes,
  )

  return (
    <div className="space-y-3">
      {/* Warnings */}
      {usage.warnings.overage && (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200">
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span>
            Over allocation by {formatDuration(usage.overageMinutes)} — overage
            rate applies
            {isAdmin && usage.overageRate > 0 && (
              <> ({formatCurrency(usage.overageRate, currency)}/hr)</>
            )}
          </span>
        </div>
      )}
      {usage.warnings.usage80 && (
        <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-900 dark:bg-yellow-950 dark:text-yellow-200">
          <AlertTriangleIcon className="size-4 shrink-0" />
          <span>
            {usage.usagePercent}% of allocation used — nearing limit
          </span>
        </div>
      )}
      {usage.warnings.expiring && (
        <div className="flex items-center gap-2 rounded-lg border border-orange-200 bg-orange-50 p-3 text-sm text-orange-800 dark:border-orange-900 dark:bg-orange-950 dark:text-orange-200">
          <CalendarIcon className="size-4 shrink-0" />
          <span>
            {formatDuration(usage.expiringMinutes)} of rollover hours expire at
            the end of this month
          </span>
        </div>
      )}

      {/* Compact stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Used this month</p>
            <p className="text-xl font-semibold tabular-nums">{usage.usagePercent}%</p>
            <BurnProgress percent={usage.usagePercent} className="mt-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Logged</p>
            <p className="text-xl font-semibold">{formatDuration(usage.usedMinutes)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              of {formatDuration(usage.totalAvailable)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Remaining</p>
            <p className="text-xl font-semibold">{formatDuration(remainingMinutes)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              {formatDuration(usage.includedMinutes)}/mo + {formatDuration(usage.rolloverMinutes)} rollover
            </p>
          </CardContent>
        </Card>
        {usage.overageMinutes > 0 ? (
          <Card>
            <CardContent className="py-3">
              <p className="text-muted-foreground text-xs">Overage</p>
              <p className="text-xl font-semibold text-red-600">
                {formatDuration(usage.overageMinutes)}
              </p>
              {isAdmin && usage.overageRate > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  {formatCurrency((usage.overageMinutes / 60) * usage.overageRate, currency)} cost
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-3">
              <p className="text-muted-foreground text-xs">Included</p>
              <p className="text-xl font-semibold">{formatDuration(usage.includedMinutes)}</p>
              <p className="text-muted-foreground mt-1 text-xs">per month</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Admin: status toggle */}
      {isAdmin && (
        <div className="flex items-center gap-3 px-1">
          <Switch
            id="retainer-status"
            checked={retainerStatus === "active"}
            onCheckedChange={handleToggleStatus}
          />
          <Label htmlFor="retainer-status" className="text-sm">
            Retainer is{" "}
            {retainerStatus === "active" ? "active" : "inactive"}
          </Label>
          {isAdmin && usage.overageRate > 0 && (
            <span className="text-muted-foreground ml-auto text-xs">
              Overage rate: {formatCurrency(usage.overageRate, currency)}/hr
            </span>
          )}
        </div>
      )}

      {/* Monthly history — collapsed by default */}
      {history && history.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card>
            <CardHeader className="pb-3">
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex w-full items-center justify-between p-0 hover:bg-transparent"
                >
                  <CardTitle className="text-base">Monthly History</CardTitle>
                  <ChevronDownIcon
                    className={`size-4 text-muted-foreground transition-transform ${
                      historyOpen ? "rotate-180" : ""
                    }`}
                  />
                </Button>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Month</TableHead>
                      <TableHead className="text-right">Included</TableHead>
                      <TableHead className="text-right">Rollover</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Overage</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {history.map((period) => (
                      <TableRow key={period._id}>
                        <TableCell className="font-medium">
                          {period.yearMonth}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDuration(period.includedMinutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDuration(period.rolloverMinutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatDuration(period.usedMinutes)}
                        </TableCell>
                        <TableCell className="text-right">
                          {period.overageMinutes > 0 ? (
                            <Badge variant="destructive">
                              +{formatDuration(period.overageMinutes)}
                            </Badge>
                          ) : (
                            "—"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}
    </div>
  )
}
