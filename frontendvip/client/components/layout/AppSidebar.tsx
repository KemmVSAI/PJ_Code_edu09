import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

import { Logo } from "./Logo";
import { NAV_ITEMS } from "./navigation";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  return (
    <div className="flex h-full flex-col bg-sidebar px-4 py-6 text-sidebar-foreground">
      <Logo className="px-2 text-white" />

      <nav aria-label="Primary" className="mt-10 flex flex-col gap-1">
        {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            onClick={onNavigate}
            className={({ isActive }) =>
              cn(
                "flex h-11 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-sidebar-foreground/75 hover:bg-sidebar-accent hover:text-white",
              )
            }
          >
            <Icon className="size-[18px] shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
