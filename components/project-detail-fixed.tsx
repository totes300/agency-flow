"use client"

import { formatDuration, formatCurrency } from "@/lib/format"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { BurnProgress } from "@/components/burn-progress"

interface CategoryEstimate {
  _id: string
  workCategoryId: string
  workCategoryName: string
  estimatedMinutes: number
  internalCostRate?: number
  clientBillingRate?: number
  actualMinutes: number
}

interface FixedProjectDetailProps {
  categoryEstimates: CategoryEstimate[]
  currency: string
  isAdmin: boolean
}

export function FixedProjectDetail({
  categoryEstimates,
  currency,
  isAdmin,
}: FixedProjectDetailProps) {
  if (categoryEstimates.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground text-sm">
            No category estimates configured. Edit the project to add category
            breakdowns.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totals = categoryEstimates.reduce(
    (acc, est) => {
      acc.estimatedMinutes += est.estimatedMinutes
      acc.actualMinutes += est.actualMinutes
      if (est.internalCostRate) {
        acc.internalCost += (est.actualMinutes / 60) * est.internalCostRate
      }
      if (est.clientBillingRate) {
        acc.billedValue += (est.actualMinutes / 60) * est.clientBillingRate
        acc.estimatedValue +=
          (est.estimatedMinutes / 60) * est.clientBillingRate
      }
      return acc
    },
    {
      estimatedMinutes: 0,
      actualMinutes: 0,
      internalCost: 0,
      billedValue: 0,
      estimatedValue: 0,
    },
  )

  const profit = totals.billedValue - totals.internalCost
  const burnPercent =
    totals.estimatedMinutes > 0
      ? Math.round((totals.actualMinutes / totals.estimatedMinutes) * 100)
      : 0
  const remainingMinutes = Math.max(
    0,
    totals.estimatedMinutes - totals.actualMinutes,
  )

  return (
    <div className="space-y-3">
      {/* Compact stat grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card>
          <CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Burned</p>
            <p className="text-xl font-semibold tabular-nums">{burnPercent}%</p>
            <BurnProgress percent={burnPercent} className="mt-1.5" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Logged</p>
            <p className="text-xl font-semibold">{formatDuration(totals.actualMinutes)}</p>
            <p className="text-muted-foreground mt-1 text-xs">
              of {formatDuration(totals.estimatedMinutes)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-3">
            <p className="text-muted-foreground text-xs">Remaining</p>
            <p className="text-xl font-semibold">{formatDuration(remainingMinutes)}</p>
            {isAdmin && totals.estimatedValue > 0 && (
              <p className="text-muted-foreground mt-1 text-xs">
                Budget {formatCurrency(totals.estimatedValue, currency)}
              </p>
            )}
          </CardContent>
        </Card>
        {isAdmin ? (
          <Card>
            <CardContent className="py-3">
              <p className="text-muted-foreground text-xs">Profit</p>
              <p className={`text-xl font-semibold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                {formatCurrency(profit, currency)}
              </p>
              {totals.billedValue > 0 && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Billed {formatCurrency(totals.billedValue, currency)}
                </p>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="py-3">
              <p className="text-muted-foreground text-xs">Categories</p>
              <p className="text-xl font-semibold">{categoryEstimates.length}</p>
              <p className="text-muted-foreground mt-1 text-xs">work types</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Category breakdown table */}
      <Card>
        <CardContent className="pt-4 pb-2">
          <p className="text-muted-foreground mb-2 text-xs font-medium uppercase tracking-wider">
            Category Breakdown
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Estimated</TableHead>
                <TableHead className="text-right">Actual</TableHead>
                <TableHead className="w-28">Burn</TableHead>
                {isAdmin && (
                  <>
                    <TableHead className="text-right">Cost/hr</TableHead>
                    <TableHead className="text-right">Bill/hr</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                  </>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {categoryEstimates.map((est) => {
                const burnPct =
                  est.estimatedMinutes > 0
                    ? Math.round(
                        (est.actualMinutes / est.estimatedMinutes) * 100,
                      )
                    : 0
                const cost =
                  (est.actualMinutes / 60) * (est.internalCostRate ?? 0)
                const billed =
                  (est.actualMinutes / 60) * (est.clientBillingRate ?? 0)
                const catProfit = billed - cost

                return (
                  <TableRow key={est._id}>
                    <TableCell className="font-medium">
                      {est.workCategoryName}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDuration(est.estimatedMinutes)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatDuration(est.actualMinutes)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <BurnProgress
                          percent={burnPct}
                          className="flex-1"
                        />
                        <span className="text-muted-foreground w-10 text-right text-xs tabular-nums">
                          {burnPct}%
                        </span>
                      </div>
                    </TableCell>
                    {isAdmin && (
                      <>
                        <TableCell className="text-right">
                          {est.internalCostRate
                            ? formatCurrency(est.internalCostRate, currency)
                            : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {est.clientBillingRate
                            ? formatCurrency(est.clientBillingRate, currency)
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-medium ${
                            catProfit >= 0 ? "text-green-600" : "text-red-600"
                          }`}
                        >
                          {formatCurrency(catProfit, currency)}
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
