"use client"

import { Progress } from "@/components/ui/progress"
import { cn } from "@/lib/utils"

interface BurnProgressProps {
  percent: number
  className?: string
}

export function BurnProgress({ percent, className }: BurnProgressProps) {
  const clamped = Math.min(percent, 100)

  const colorClass =
    percent > 100
      ? "[&>div]:bg-red-500"
      : percent >= 80
        ? "[&>div]:bg-amber-500"
        : ""

  return (
    <Progress
      value={clamped}
      className={cn("h-2", colorClass, className)}
    />
  )
}
