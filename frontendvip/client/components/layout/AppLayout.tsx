import { useState } from "react";
import { Outlet, useLocation } from "react-router-dom";

import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

import { AppHeader } from "./AppHeader";
import { AppSidebar } from "./AppSidebar";

export interface AppOutletContext {
  searchQuery: string;
}

const WORKSPACE_ROUTES = ["/research-chat", "/draft-editor", "/review-export"];

export function AppLayout() {
  const { pathname } = useLocation();
  const [searchQuery, setSearchQuery] = useState("");
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const isWorkspace = WORKSPACE_ROUTES.includes(pathname);

  return (
    <div className="min-h-dvh bg-background">
      {!isSidebarCollapsed && (
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 lg:block">
          <AppSidebar />
        </aside>
      )}

      <Sheet open={isMobileNavOpen} onOpenChange={setIsMobileNavOpen}>
        <SheetContent
          side="left"
          className="w-64 border-none p-0 text-sidebar-foreground sm:max-w-none"
        >
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <AppSidebar onNavigate={() => setIsMobileNavOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className={cn(isSidebarCollapsed ? "lg:pl-0" : "lg:pl-64")}>
        <AppHeader
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenNav={() => setIsMobileNavOpen(true)}
          isSidebarCollapsed={isSidebarCollapsed}
          onToggleSidebar={() => setIsSidebarCollapsed((value) => !value)}
        />
        <main
          className={cn(
            isWorkspace
              ? "h-[calc(100dvh-4rem)] overflow-hidden"
              : "mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8",
          )}
        >
          <Outlet context={{ searchQuery } satisfies AppOutletContext} />
        </main>
      </div>
    </div>
  );
}
