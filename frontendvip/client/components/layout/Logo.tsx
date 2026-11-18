import { BookOpenText } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm">
        <BookOpenText className="size-5" />
      </span>
      <span className="text-[15px] font-semibold tracking-tight">
        LitReview <span className="opacity-70">Agent</span>
      </span>
    </div>
  );
}
