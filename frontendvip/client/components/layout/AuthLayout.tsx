import { FileDown, Search, Sparkles, type LucideIcon } from "lucide-react";
import { Outlet } from "react-router-dom";

import { Logo } from "./Logo";

const FEATURES: { icon: LucideIcon; title: string; description: string }[] = [
  {
    icon: Search,
    title: "Discover across databases",
    description:
      "Search, deduplicate, and screen papers in one structured workspace.",
  },
  {
    icon: Sparkles,
    title: "Synthesize with AI",
    description:
      "Get summaries where every claim links back to its source paper.",
  },
  {
    icon: FileDown,
    title: "Export review-ready output",
    description:
      "Generate bibliographies and evidence tables for your manuscript.",
  },
];

export function AuthLayout() {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-navy px-12 py-12 text-white lg:flex lg:flex-col lg:justify-between xl:px-16">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-32 -top-32 size-[28rem] rounded-full bg-primary/30 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -bottom-40 -left-24 size-96 rounded-full bg-primary/20 blur-3xl"
        />

        <Logo className="relative text-white" />

        <div className="relative max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            Turn scattered papers into a defensible literature review.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/70">
            LitReview Agent helps researchers plan, screen, and synthesize
            evidence with an AI assistant that keeps every source traceable.
          </p>

          <ul className="mt-10 space-y-6">
            {FEATURES.map(({ icon: Icon, title, description }) => (
              <li key={title} className="flex gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-inset ring-white/15">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-medium">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    {description}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-white/50">
          © {new Date().getFullYear()} LitReview Agent
        </p>
      </aside>

      <main className="flex flex-col bg-background px-6 py-10 sm:px-10">
        <div className="lg:hidden">
          <Logo className="text-navy" />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}
