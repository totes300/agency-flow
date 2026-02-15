import { cn } from "@/lib/utils"

interface StatRowProps {
  label: string
  value: string | React.ReactNode
  bold?: boolean
  color?: "green" | "red"
}

export function StatRow({ label, value, bold, color }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          bold && "font-semibold",
          color === "green" && "text-green-600",
          color === "red" && "text-red-600",
        )}
      >
        {value}
      </span>
    </div>
  )
}
