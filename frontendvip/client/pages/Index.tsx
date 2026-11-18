import { CircleCheck, Clock, FileText, Layers, Plus } from "lucide-react";
import { useState } from "react";
import { useOutletContext } from "react-router-dom";
import { toast } from "sonner";

import type { AppOutletContext } from "@/components/layout/AppLayout";
import { RecentProjects } from "@/components/dashboard/RecentProjects";
import {
  NewResearchSessionDialog,
  type NewResearchSessionValues,
} from "@/components/dashboard/NewResearchSessionDialog";
import { SessionsTable } from "@/components/dashboard/SessionsTable";
import { type StatItem, StatCards } from "@/components/dashboard/StatCards";
import { Button } from "@/components/ui/button";
import {
  CURRENT_USER,
  INITIAL_SESSIONS,
  RECENT_PROJECTS,
  type ResearchSession,
} from "@/lib/research-data";

function getGreeting(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

export default function Index() {
  const { searchQuery } = useOutletContext<AppOutletContext>();
  const [sessions, setSessions] = useState<ResearchSession[]>(INITIAL_SESSIONS);
  const [isNewSessionOpen, setIsNewSessionOpen] = useState(false);

  const now = new Date();
  const today = now.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  const normalizedQuery = searchQuery.trim().toLowerCase();
  const visibleSessions = normalizedQuery
    ? sessions.filter((session) =>
        `${session.topic} ${session.domain} ${session.objective}`
          .toLowerCase()
          .includes(normalizedQuery),
      )
    : sessions;

  const papersCollected = sessions.reduce(
    (total, session) => total + session.papers,
    0,
  );
  const activeSessions = sessions.filter(
    (session) => session.status !== "Completed",
  ).length;
  const collectingSessions = sessions.filter(
    (session) => session.status === "Collecting",
  ).length;
  const pendingReviews = sessions.filter(
    (session) => session.status === "Pending review",
  ).length;
  const completedReviews = sessions.filter(
    (session) => session.status === "Completed",
  ).length;

  const stats: StatItem[] = [
    {
      label: "Total Sessions",
      value: sessions.length,
      hint: `${activeSessions} still active`,
      icon: Layers,
    },
    {
      label: "Papers Collected",
      value: papersCollected,
      hint: "Across all sessions",
      icon: FileText,
    },
    {
      label: "Pending Reviews",
      value: pendingReviews,
      hint: "Awaiting your sign-off",
      icon: Clock,
    },
    {
      label: "Completed Reviews",
      value: completedReviews,
      hint: "Ready to export",
      icon: CircleCheck,
    },
  ];

  const handleCreateSession = (values: NewResearchSessionValues) => {
    setSessions((previous) => [
      {
        id: crypto.randomUUID(),
        topic: values.topic,
        domain: values.domain,
        objective: values.objective,
        papers: 0,
        progress: 0,
        status: "Draft",
      },
      ...previous,
    ]);
    toast.success("Research session created", { description: values.topic });
  };

  const handleDeleteSession = (id: string) => {
    setSessions((previous) => previous.filter((session) => session.id !== id));
    toast.success("Research session deleted");
  };

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">{today}</p>
          <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {getGreeting(now.getHours())}, {CURRENT_USER.firstName}
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground sm:text-base">
            You have {pendingReviews} reviews awaiting your sign-off and{" "}
            {collectingSessions} sessions still collecting papers.
          </p>
        </div>
        <Button
          size="lg"
          className="w-full sm:w-auto"
          onClick={() => setIsNewSessionOpen(true)}
        >
          <Plus className="size-4" />
          New Research Session
        </Button>
      </section>

      <StatCards stats={stats} />

      <SessionsTable
        sessions={visibleSessions}
        isFiltered={normalizedQuery.length > 0}
        onDelete={handleDeleteSession}
      />

      <RecentProjects projects={RECENT_PROJECTS} />

      <NewResearchSessionDialog
        open={isNewSessionOpen}
        onOpenChange={setIsNewSessionOpen}
        onCreate={handleCreateSession}
      />
    </div>
  );
}
