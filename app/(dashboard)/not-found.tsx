import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function DashboardNotFound() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-4 text-center">
      <h1 className="text-4xl font-bold">404</h1>
      <p className="text-muted-foreground">Page not found</p>
      <Button asChild variant="outline">
        <Link href="/tasks">Go to Tasks</Link>
      </Button>
    </div>
  )
}
