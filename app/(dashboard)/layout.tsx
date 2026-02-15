"use client"

import dynamic from "next/dynamic"
import { AppSidebar } from "@/components/app-sidebar"
import { Separator } from "@/components/ui/separator"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Button } from "@/components/ui/button"
import { SearchIcon } from "lucide-react"
import { useState } from "react"
import { TimerIndicator } from "@/components/timer-indicator"

const CommandSearch = dynamic(() =>
  import("@/components/command-search").then((m) => ({ default: m.CommandSearch }))
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [searchOpen, setSearchOpen] = useState(false)

  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
            <div className="flex items-center gap-2">
              <SidebarTrigger className="-ml-1" />
              <Separator
                orientation="vertical"
                className="mr-2 data-vertical:h-4 data-vertical:self-auto"
              />
            </div>
            <div className="flex items-center gap-2">
              <TimerIndicator />
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex items-center gap-2 text-muted-foreground"
                onClick={() => setSearchOpen(true)}
              >
                <SearchIcon className="size-4" />
                <span>Search...</span>
                <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
                  <span className="text-xs">⌘</span>K
                </kbd>
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="md:hidden"
                onClick={() => setSearchOpen(true)}
              >
                <SearchIcon className="size-4" />
              </Button>
            </div>
          </header>
          <main className="flex flex-1 flex-col gap-4 p-4">
            {children}
          </main>
        </SidebarInset>
        <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
      </SidebarProvider>
    </TooltipProvider>
  )
}
