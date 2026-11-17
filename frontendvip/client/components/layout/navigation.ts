import {
  FileDown,
  FileEdit,
  LayoutDashboard,
  MessageSquareText,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export const NAV_ITEMS: NavItem[] = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard },
  { to: "/research-chat", label: "Research Chat", icon: MessageSquareText },
  { to: "/draft-editor", label: "Draft Editor", icon: FileEdit },
  { to: "/review-export", label: "Review & Export", icon: FileDown },
];
