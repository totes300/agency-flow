"use client"

import { formatDuration, formatCurrency } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"

interface TmProject {
  hourlyRate?: number
  tmCategoryRates?: Array<{
    workCategoryId: string
    workCategoryName?: string
    rate: number
  }>
  totalMinutes: number
}

interface TmProjectDetailProps {
  project: TmProject
  currency: string
  isAdmin: boolean
}

export function TmProjectDetail({
  project,
  currency,
  isAdmin,
}: TmProjectDetailProps) {
  const totalValue =
    project.hourlyRate
      ? (project.totalMinutes / 60) * project.hourlyRate
      : 0

  return (
    <div className="space-y-3">
      {/* Compact stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Total Logged</p>
            <p className="text-xl font-semibold">{formatDuration(project.totalMinutes)}</p>
          </CardContent>
        </Card>
        {isAdmin && project.hourlyRate !== undefined && (
          <Card>
            <CardContent className="py-3">
              <p className="text-muted-foreground text-xs">Total Value</p>
              <p className="text-xl font-semibold">{formatCurrency(totalValue, currency)}</p>
              <p className="text-muted-foreground mt-1 text-xs">
                at {formatCurrency(project.hourlyRate, currency)}/hr
              </p>
            </CardContent>
          </Card>
        )}
        {isAdmin && project.tmCategoryRates && project.tmCategoryRates.length > 0 && (
          <Card className="sm:col-span-2">
            <CardContent className="py-3">
              <p className="text-muted-foreground text-xs">Category Rates</p>
              <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
                {project.tmCategoryRates.map((rate) => (
                  <span key={rate.workCategoryId} className="text-sm">
                    <span className="text-muted-foreground">{rate.workCategoryName ?? rate.workCategoryId}:</span>{" "}
                    <span className="font-medium">{formatCurrency(rate.rate, currency)}/hr</span>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
