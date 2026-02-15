"use client"

import Link from "next/link"
import { useQuery } from "convex/react"
import { api } from "@/convex/_generated/api"
import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  CheckSquareIcon,
  SunIcon,
  UsersIcon,
  FolderIcon,
  ClockIcon,
  CalendarIcon,
  FileTextIcon,
  UserCogIcon,
  SettingsIcon,
  ZapIcon,
} from "lucide-react"

const mainNav = [
  { title: "Tasks", url: "/tasks", icon: <CheckSquareIcon /> },
  { title: "Today", url: "/today", icon: <SunIcon /> },
  { title: "Clients", url: "/clients", icon: <UsersIcon /> },
  { title: "Projects", url: "/projects", icon: <FolderIcon /> },
  { title: "My Time", url: "/my-time", icon: <ClockIcon /> },
]

const adminNav = [
  { title: "Daily Summary", url: "/daily-summary", icon: <CalendarIcon /> },
  { title: "Timesheets", url: "/timesheets", icon: <FileTextIcon /> },
  { title: "Team", url: "/team", icon: <UserCogIcon /> },
  { title: "Settings", url: "/settings", icon: <SettingsIcon /> },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const me = useQuery(api.users.getMe)
  const isAdmin = me?.role === "admin"

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/tasks">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <ZapIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">Agency Flow</span>
                  <span className="truncate text-xs">by Konverted</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNav} />
        {isAdmin && (
          <>
            <SidebarSeparator />
            <NavMain items={adminNav} label="Admin" />
          </>
        )}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
