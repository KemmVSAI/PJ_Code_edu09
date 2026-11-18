import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  PanelLeft,
  PanelLeftClose,
  Search,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CURRENT_USER } from "@/lib/research-data";
import { cn } from "@/lib/utils";

import { NAV_ITEMS } from "./navigation";

const NOTIFICATIONS = [
  {
    id: 1,
    title: "Clinical NLP Evidence Map is ready for review",
    time: "5 min ago",
    unread: true,
  },
  {
    id: 2,
    title: "24 new papers matched your Edge AI keywords",
    time: "1 hour ago",
    unread: true,
  },
  {
    id: 3,
    title: "Freshwater export finished as CSV",
    time: "Yesterday",
    unread: false,
  },
];

interface AppHeaderProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onOpenNav: () => void;
  isSidebarCollapsed: boolean;
  onToggleSidebar: () => void;
}

export function AppHeader({
  searchQuery,
  onSearchChange,
  onOpenNav,
  isSidebarCollapsed,
  onToggleSidebar,
}: AppHeaderProps) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const title =
    NAV_ITEMS.find((item) => item.to === pathname)?.label ?? "Dashboard";
  const unreadCount = NOTIFICATIONS.filter((item) => item.unread).length;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
      <Button
        variant="ghost"
        size="icon"
        className="-ml-2 lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu className="size-5" />
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={onToggleSidebar}
        aria-label={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
        title={isSidebarCollapsed ? "Show sidebar" : "Hide sidebar"}
      >
        {isSidebarCollapsed ? (
          <PanelLeft className="size-5" />
        ) : (
          <PanelLeftClose className="size-5" />
        )}
      </Button>

      <h1 className="truncate text-lg font-semibold tracking-tight text-foreground">
        {title}
      </h1>

      <div className="ml-auto flex items-center gap-2 sm:gap-3">
        <div className="relative hidden w-72 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search sessions"
            aria-label="Search sessions"
            className="pl-9"
          />
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              className="relative"
              aria-label={`Notifications, ${unreadCount} unread`}
            >
              <Bell className="size-[18px]" />
              {unreadCount > 0 && (
                <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-primary ring-2 ring-white" />
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 overflow-hidden p-0">
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-sm font-semibold">Notifications</span>
              <span className="text-xs font-medium text-primary">
                {unreadCount} new
              </span>
            </div>
            <DropdownMenuSeparator className="m-0" />
            <ul>
              {NOTIFICATIONS.map((item) => (
                <li
                  key={item.id}
                  className="flex gap-3 border-b border-border px-4 py-3 last:border-b-0"
                >
                  <span
                    className={cn(
                      "mt-1.5 size-2 shrink-0 rounded-full",
                      item.unread ? "bg-primary" : "bg-slate-300",
                    )}
                  />
                  <div className="min-w-0">
                    <p className="text-sm text-foreground">{item.title}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {item.time}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg p-1 pr-1 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring lg:pr-2">
            <Avatar className="size-8">
              <AvatarFallback className="bg-navy text-xs font-semibold text-white">
                {CURRENT_USER.initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden text-left lg:block">
              <span className="block text-sm font-medium leading-tight text-foreground">
                {CURRENT_USER.fullName}
              </span>
              <span className="block text-xs text-muted-foreground">
                {CURRENT_USER.role}
              </span>
            </span>
            <ChevronDown className="hidden size-4 text-muted-foreground lg:block" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-60">
            <DropdownMenuLabel className="font-normal">
              <p className="text-sm font-medium text-foreground">
                {CURRENT_USER.fullName}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {CURRENT_USER.email}
              </p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => navigate("/login")}>
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
