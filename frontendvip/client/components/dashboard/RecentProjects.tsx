import { BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import type { ResearchProject } from "@/lib/research-data";

export function RecentProjects({ projects }: { projects: ResearchProject[] }) {
  return (
    <section aria-labelledby="recent-projects-heading" className="space-y-4">
      <div>
        <h2
          id="recent-projects-heading"
          className="text-base font-semibold text-foreground"
        >
          Recent Projects
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Pick up where you left off.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Link
            key={project.id}
            to="/research-chat"
            className="group flex flex-col rounded-xl border border-border bg-white p-5 shadow-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-elevated focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex size-10 items-center justify-center rounded-lg bg-accent text-primary">
                <BookOpen className="size-5" />
              </span>
              <Badge
                variant="outline"
                className="border-border font-medium text-muted-foreground"
              >
                {project.objective}
              </Badge>
            </div>

            <h3 className="mt-4 font-semibold text-foreground transition-colors group-hover:text-primary">
              {project.name}
            </h3>
            <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
              {project.description}
            </p>

            <div className="mt-5 flex items-center justify-between gap-3 border-t border-border pt-4">
              <div className="flex -space-x-2">
                {project.collaborators.map((initials, index) => (
                  <span
                    key={`${initials}-${index}`}
                    className="flex size-7 items-center justify-center rounded-full border-2 border-white bg-navy text-[10px] font-semibold text-white"
                  >
                    {initials}
                  </span>
                ))}
              </div>
              <p className="text-right text-xs text-muted-foreground">
                {project.papers} papers · {project.updatedAt}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
