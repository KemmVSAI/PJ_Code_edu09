import {
  AlertCircle,
  Check,
  ChevronDown,
  Plus,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { RESEARCH_DOMAINS } from "@/lib/research-data";
import {
  EMPTY_SEARCH_FORM,
  SEARCH_SUGGESTIONS,
  SEARCH_YEARS,
  type Paper,
  type SearchForm,
} from "@/lib/research-papers";
import { cn } from "@/lib/utils";

import { scoreBarTone } from "./research-ui";
import type { ResearchWorkspace } from "./use-research-workspace";

interface AcademicSearchProps {
  workspace: ResearchWorkspace;
  onSelectPaper: (id: string) => void;
}

function countActiveFilters(form: SearchForm) {
  return [
    form.yearFrom !== "all",
    form.yearTo !== "all",
    form.author.trim() !== "",
    form.domain !== "all",
  ].filter(Boolean).length;
}

function ResultCard({
  paper,
  inSession,
  onToggle,
  onDetails,
}: {
  paper: Paper;
  inSession: boolean;
  onToggle: () => void;
  onDetails: () => void;
}) {
  return (
    <article className="rounded-xl border border-border bg-white p-5 shadow-card transition-shadow hover:shadow-elevated">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <Badge
          variant="outline"
          className="border-indigo-200 bg-indigo-50 text-indigo-700"
        >
          {paper.domain}
        </Badge>
        <span>
          {paper.venue} · {paper.year}
        </span>
        <span className="ml-auto tabular-nums">
          {paper.citations} citations
        </span>
      </div>

      <button
        type="button"
        onClick={onDetails}
        className="mt-3 text-left text-base font-semibold leading-snug text-foreground hover:text-primary"
      >
        {paper.title}
      </button>
      <p className="mt-1 text-sm text-muted-foreground">
        {paper.authors.join(", ")}
      </p>
      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">
        {paper.abstract}
      </p>
      <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-700">
        <span className="font-semibold text-foreground">Key finding: </span>
        {paper.keyFinding}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          Relevance
          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
            <span
              className={cn(
                "block h-full rounded-full",
                scoreBarTone(paper.relevance),
              )}
              style={{ width: `${paper.relevance}%` }}
            />
          </span>
          <span className="font-semibold tabular-nums text-foreground">
            {paper.relevance}
          </span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={onDetails}>
            View details
          </Button>
          <Button
            variant={inSession ? "outline" : "default"}
            size="sm"
            onClick={onToggle}
            aria-pressed={inSession}
          >
            {inSession ? (
              <Check className="size-4" />
            ) : (
              <Plus className="size-4" />
            )}
            {inSession ? "In session" : "Add to session"}
          </Button>
        </div>
      </div>
    </article>
  );
}

export function AcademicSearch({
  workspace,
  onSelectPaper,
}: AcademicSearchProps) {
  const {
    searchForm,
    setSearchForm,
    search,
    runSearch,
    collectedPapers,
    toggleCollected,
  } = workspace;
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const isLoading = search.status === "loading";
  const activeFilters = countActiveFilters(searchForm);

  const updateForm = (patch: Partial<SearchForm>) =>
    setSearchForm({ ...searchForm, ...patch });

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    runSearch(searchForm);
  };

  const resetFilters = () =>
    setSearchForm({
      ...searchForm,
      yearFrom: EMPTY_SEARCH_FORM.yearFrom,
      yearTo: EMPTY_SEARCH_FORM.yearTo,
      author: "",
      domain: EMPTY_SEARCH_FORM.domain,
    });

  const sessionIds = new Set(collectedPapers.map((paper) => paper.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <form
        onSubmit={handleSubmit}
        className="shrink-0 space-y-3 border-b border-border bg-white p-5"
      >
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchForm.query}
              onChange={(event) => updateForm({ query: event.target.value })}
              placeholder="Search titles, abstracts, and keywords"
              aria-label="Search academic papers"
              className="h-10 pl-9"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="h-10 px-5">
            {isLoading ? "Searching..." : "Search"}
          </Button>
        </div>

        <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
          <div className="flex items-center justify-between">
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="-ml-2 text-slate-700"
              >
                <SlidersHorizontal className="size-4" />
                Advanced filters
                {activeFilters > 0 && (
                  <Badge className="bg-primary px-1.5">{activeFilters}</Badge>
                )}
                <ChevronDown
                  className={cn(
                    "size-4 transition-transform",
                    advancedOpen && "rotate-180",
                  )}
                />
              </Button>
            </CollapsibleTrigger>
            {activeFilters > 0 && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs font-medium text-primary hover:underline"
              >
                Reset filters
              </button>
            )}
          </div>

          <CollapsibleContent className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="filter-year-from"
                className="text-xs text-muted-foreground"
              >
                Published from
              </Label>
              <Select
                value={searchForm.yearFrom}
                onValueChange={(value) => updateForm({ yearFrom: value })}
              >
                <SelectTrigger id="filter-year-from" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any year</SelectItem>
                  {SEARCH_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="filter-year-to"
                className="text-xs text-muted-foreground"
              >
                Published to
              </Label>
              <Select
                value={searchForm.yearTo}
                onValueChange={(value) => updateForm({ yearTo: value })}
              >
                <SelectTrigger id="filter-year-to" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Any year</SelectItem>
                  {SEARCH_YEARS.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="filter-author"
                className="text-xs text-muted-foreground"
              >
                Author
              </Label>
              <Input
                id="filter-author"
                value={searchForm.author}
                onChange={(event) => updateForm({ author: event.target.value })}
                placeholder="e.g. Rivera"
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label
                htmlFor="filter-domain"
                className="text-xs text-muted-foreground"
              >
                Research domain
              </Label>
              <Select
                value={searchForm.domain}
                onValueChange={(value) => updateForm({ domain: value })}
              >
                <SelectTrigger id="filter-domain" className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All domains</SelectItem>
                  {RESEARCH_DOMAINS.map((domain) => (
                    <SelectItem key={domain} value={domain}>
                      {domain}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto bg-slate-50/50 p-5">
        {search.status === "idle" && (
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-white p-8 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-accent text-primary">
              <Search className="size-5" />
            </span>
            <h3 className="mt-4 text-base font-semibold text-foreground">
              Search the literature
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Search titles, abstracts, and keywords, then add relevant papers
              to this session for screening and synthesis.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {SEARCH_SUGGESTIONS.map((suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  onClick={() =>
                    runSearch({ ...searchForm, query: suggestion })
                  }
                  className="rounded-full border border-border bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-primary/40 hover:text-primary"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        {isLoading && (
          <div
            aria-busy="true"
            aria-label="Searching papers"
            className="mx-auto max-w-4xl space-y-4"
          >
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="rounded-xl border border-border bg-white p-5"
              >
                <Skeleton className="h-3 w-1/4" />
                <Skeleton className="mt-4 h-5 w-3/4" />
                <Skeleton className="mt-3 h-3 w-1/2" />
                <Skeleton className="mt-4 h-3 w-full" />
              </div>
            ))}
          </div>
        )}

        {search.status === "error" && (
          <div
            role="alert"
            className="mx-auto flex max-w-2xl flex-col gap-3 rounded-xl border border-rose-200 bg-rose-50 p-5 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex gap-3">
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-rose-600" />
              <div>
                <p className="text-sm font-semibold text-rose-900">
                  Search failed
                </p>
                <p className="mt-0.5 text-sm text-rose-800">{search.error}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="shrink-0 bg-white"
              onClick={() => search.ranForm && runSearch(search.ranForm)}
            >
              Retry search
            </Button>
          </div>
        )}

        {search.status === "success" && search.results.length === 0 && (
          <div className="mx-auto max-w-2xl rounded-xl border border-dashed border-border bg-white p-8 text-center">
            <h3 className="text-base font-semibold text-foreground">
              No papers match this search
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              Try broader keywords, remove an author filter, or widen the
              publication years.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-5"
              onClick={resetFilters}
            >
              Reset filters
            </Button>
          </div>
        )}

        {search.status === "success" && search.results.length > 0 && (
          <div className="mx-auto max-w-4xl space-y-4">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">
                {search.results.length}
              </span>{" "}
              {search.results.length === 1 ? "result" : "results"}
              {search.ranForm?.query && (
                <>
                  {" "}
                  for{" "}
                  <span className="text-foreground">
                    “{search.ranForm.query}”
                  </span>
                </>
              )}
            </p>
            {search.results.map((paper) => (
              <ResultCard
                key={paper.id}
                paper={paper}
                inSession={sessionIds.has(paper.id)}
                onToggle={() => toggleCollected(paper.id)}
                onDetails={() => onSelectPaper(paper.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
