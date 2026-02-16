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
import { TimerTickProvider } from "@/hooks/use-timer-tick"
import { FloatingTimerWidget } from "@/components/timer-indicator"

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
      <TimerTickProvider>
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset>
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-ring"
            >
              Skip to content
            </a>
            <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b px-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
              <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Separator
                  orientation="vertical"
                  className="mr-2 data-vertical:h-4 data-vertical:self-auto"
                />
              </div>
              <div className="flex items-center gap-2">
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
                  aria-label="Search"
                >
                  <SearchIcon className="size-4" />
                </Button>
              </div>
            </header>
            <main id="main-content" className="flex flex-1 flex-col gap-4 p-4">
              {children}
            </main>
          </SidebarInset>
          <FloatingTimerWidget />
          <CommandSearch open={searchOpen} onOpenChange={setSearchOpen} />
        </SidebarProvider>
      </TimerTickProvider>
    </TooltipProvider>
  )
}
