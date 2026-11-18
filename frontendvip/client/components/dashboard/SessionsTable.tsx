import { EllipsisVertical, FileDown, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ResearchSession, SessionStatus } from "@/lib/research-data";
import { cn } from "@/lib/utils";

const STATUS_STYLES: Record<SessionStatus, string> = {
  Draft: "bg-slate-100 text-slate-700 ring-slate-200",
  Collecting: "bg-indigo-50 text-indigo-700 ring-indigo-200",
  "Pending review": "bg-amber-50 text-amber-700 ring-amber-200",
  Completed: "bg-emerald-50 text-emerald-700 ring-emerald-200",
};

interface SessionsTableProps {
  sessions: ResearchSession[];
  isFiltered: boolean;
  onDelete: (id: string) => void;
}

export function SessionsTable({
  sessions,
  isFiltered,
  onDelete,
}: SessionsTableProps) {
  return (
    <section
      aria-labelledby="sessions-heading"
      className="overflow-hidden rounded-xl border border-border bg-white shadow-card"
    >
      <div className="flex flex-col gap-1 border-b border-border px-5 py-4">
        <h2
          id="sessions-heading"
          className="text-base font-semibold text-foreground"
        >
          Research Sessions
        </h2>
        <p className="text-sm text-muted-foreground">
          Track screening and synthesis progress across every review.
        </p>
      </div>

      <Table className="min-w-[760px]">
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            <TableHead className="w-[36%] text-xs uppercase tracking-wide">
              Topic
            </TableHead>
            <TableHead className="w-24 text-xs uppercase tracking-wide">
              Papers
            </TableHead>
            <TableHead className="w-56 text-xs uppercase tracking-wide">
              Progress
            </TableHead>
            <TableHead className="w-40 text-xs uppercase tracking-wide">
              Status
            </TableHead>
            <TableHead className="w-44 text-right text-xs uppercase tracking-wide">
              Actions
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sessions.length === 0 && (
            <TableRow className="hover:bg-transparent">
              <TableCell
                colSpan={5}
                className="py-12 text-center text-sm text-muted-foreground"
              >
                {isFiltered
                  ? "No sessions match your search."
                  : "No research sessions yet. Create one to get started."}
              </TableCell>
            </TableRow>
          )}
          {sessions.map((session) => (
            <TableRow key={session.id}>
              <TableCell>
                <p className="font-medium text-foreground">{session.topic}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {session.domain} · {session.objective}
                </p>
              </TableCell>
              <TableCell className="tabular-nums text-foreground">
                {session.papers.toLocaleString("en-US")}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-3">
                  <Progress
                    value={session.progress}
                    aria-label={`${session.topic} progress`}
                    className="h-2 w-full bg-slate-100"
                  />
                  <span className="w-10 text-right text-sm tabular-nums text-muted-foreground">
                    {session.progress}%
                  </span>
                </div>
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className={cn(
                    "gap-1.5 border-transparent px-2.5 ring-1 ring-inset",
                    STATUS_STYLES[session.status],
                  )}
                >
                  <span className="size-1.5 rounded-full bg-current" />
                  {session.status}
                </Badge>
              </TableCell>
              <TableCell>
                <div className="flex items-center justify-end gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link
                      to={`/research-chat?session=${session.id}`}
                      state={{ session }}
                    >
                      Open
                    </Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-9"
                        aria-label={`More actions for ${session.topic}`}
                      >
                        <EllipsisVertical className="size-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      <DropdownMenuItem asChild>
                        <Link to="/review-export">
                          <FileDown className="size-4" />
                          Export review
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:bg-destructive/10 focus:text-destructive"
                        onSelect={() => onDelete(session.id)}
                      >
                        <Trash2 className="size-4" />
                        Delete session
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}
