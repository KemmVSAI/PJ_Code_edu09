import {
  BookOpenText,
  FileText,
  ListChecks,
  MessageSquareText,
  PanelLeft,
  Quote,
  Search,
  Table2,
} from "lucide-react";
import { useState } from "react";
import { useLocation, useSearchParams } from "react-router-dom";

import { AcademicSearch } from "@/components/research/AcademicSearch";
import { ChatView } from "@/components/research/ChatView";
import { CollapsiblePanel } from "@/components/research/CollapsiblePanel";
import { ComparisonMatrix } from "@/components/research/ComparisonMatrix";
import { EvidenceRag } from "@/components/research/EvidenceRag";
import { EvidenceSheet } from "@/components/research/EvidenceSheet";
import { PaperDetailsPanel } from "@/components/research/PaperDetailsPanel";
import { PaperSummaries } from "@/components/research/PaperSummaries";
import { ResearchToolsPanel } from "@/components/research/ResearchToolsPanel";
import { SmartScreening } from "@/components/research/SmartScreening";
import {
  getWorkspaceSeed,
  useMediaQuery,
  useResearchWorkspace,
  type WorkspaceView,
} from "@/components/research/use-research-workspace";
import { useReviewTools } from "@/components/research/use-review-tools";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { INITIAL_SESSIONS, type ResearchSession } from "@/lib/research-data";

const TAB_CONTENT_CLASS =
  "mt-0 flex min-h-0 flex-1 flex-col focus-visible:outline-hidden";

interface SessionRouteState {
  session?: ResearchSession;
}

function resolveSession(
  requestedId: string | null,
  routedSession: ResearchSession | undefined,
): ResearchSession {
  if (requestedId) {
    const known = INITIAL_SESSIONS.find((item) => item.id === requestedId);
    if (known) return known;
    if (routedSession?.id === requestedId) return routedSession;
  }
  return INITIAL_SESSIONS[0];
}

export default function ResearchChat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const location = useLocation();
  const routedSession = (location.state as SessionRouteState | null)?.session;
  const session = resolveSession(searchParams.get("session"), routedSession);
  const sessionOptions = INITIAL_SESSIONS.some((item) => item.id === session.id)
    ? INITIAL_SESSIONS
    : [session, ...INITIAL_SESSIONS];

  return (
    <ResearchWorkspace
      key={session.id}
      session={session}
      sessionOptions={sessionOptions}
      onSessionChange={(id) => setSearchParams({ session: id })}
    />
  );
}

interface ResearchWorkspaceProps {
  session: ResearchSession;
  sessionOptions: ResearchSession[];
  onSessionChange: (id: string) => void;
}

function ResearchWorkspace({
  session,
  sessionOptions,
  onSessionChange,
}: ResearchWorkspaceProps) {
  const workspace = useResearchWorkspace(getWorkspaceSeed(session.id));
  const review = useReviewTools(
    workspace.collectedPapers,
    workspace.selectedPapers,
  );
  const isDetailsInline = useMediaQuery("(min-width: 1536px)");
  const [isToolsOpen, setIsToolsOpen] = useState(true);
  const [isDetailsOpen, setIsDetailsOpen] = useState(true);
  const [isToolsSheetOpen, setIsToolsSheetOpen] = useState(false);
  const [isDetailsSheetOpen, setIsDetailsSheetOpen] = useState(false);

  const pendingCount = workspace.collectedPapers.filter(
    (paper) => !workspace.decisions[paper.id],
  ).length;

  const handleSelectPaper = (id: string) => {
    workspace.selectPaper(id);
    if (isDetailsInline) {
      setIsDetailsOpen(true);
    } else {
      setIsDetailsSheetOpen(true);
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full">
      <CollapsiblePanel
        side="left"
        title="Research tools"
        open={isToolsOpen}
        onOpenChange={setIsToolsOpen}
        className="hidden xl:flex"
      >
        <ResearchToolsPanel
          workspace={workspace}
          onSelectPaper={handleSelectPaper}
        />
      </CollapsiblePanel>

      <Tabs
        value={workspace.view}
        onValueChange={(value) => workspace.setView(value as WorkspaceView)}
        className="flex min-w-0 flex-1 flex-col bg-white"
      >
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-muted-foreground">
              Research session
            </p>
            <Select value={session.id} onValueChange={onSessionChange}>
              <SelectTrigger
                aria-label="Research session"
                className="mt-0.5 h-8 w-full max-w-xl border-transparent bg-transparent px-2 text-sm font-semibold shadow-none hover:bg-accent focus:ring-0 [&>span]:truncate"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sessionOptions.map((option) => (
                  <SelectItem key={option.id} value={option.id}>
                    {option.topic}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="xl:hidden"
            onClick={() => setIsToolsSheetOpen(true)}
          >
            <PanelLeft className="size-4" />
            Research tools
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="2xl:hidden"
            onClick={() => setIsDetailsSheetOpen(true)}
          >
            <BookOpenText className="size-4" />
            Paper details
          </Button>
        </header>

        <div className="shrink-0 overflow-x-auto border-b border-border px-5 py-2">
          <TabsList className="h-9 bg-slate-100">
            <TabsTrigger value="chat" className="gap-2">
              <MessageSquareText className="size-4" />
              Assistant
            </TabsTrigger>
            <TabsTrigger value="search" className="gap-2">
              <Search className="size-4" />
              Academic search
            </TabsTrigger>
            <TabsTrigger value="screening" className="gap-2">
              <ListChecks className="size-4" />
              Smart screening
              {pendingCount > 0 && (
                <span className="rounded-full bg-primary/10 px-1.5 text-[11px] font-semibold tabular-nums text-primary">
                  {pendingCount}
                </span>
              )}
            </TabsTrigger>
            <TabsTrigger value="summary" className="gap-2">
              <FileText className="size-4" />
              Paper summaries
            </TabsTrigger>
            <TabsTrigger value="evidence" className="gap-2">
              <Quote className="size-4" />
              Evidence RAG
            </TabsTrigger>
            <TabsTrigger value="matrix" className="gap-2">
              <Table2 className="size-4" />
              Comparison matrix
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="chat" className={TAB_CONTENT_CLASS}>
          <ChatView workspace={workspace} onSelectPaper={handleSelectPaper} />
        </TabsContent>
        <TabsContent value="search" className={TAB_CONTENT_CLASS}>
          <AcademicSearch
            workspace={workspace}
            onSelectPaper={handleSelectPaper}
          />
        </TabsContent>
        <TabsContent value="screening" className={TAB_CONTENT_CLASS}>
          <SmartScreening
            workspace={workspace}
            onSelectPaper={handleSelectPaper}
            onGoToSearch={() => workspace.setView("search")}
          />
        </TabsContent>
        <TabsContent value="summary" className={TAB_CONTENT_CLASS}>
          <PaperSummaries
            review={review}
            papers={workspace.collectedPapers}
            onGoToSearch={() => workspace.setView("search")}
          />
        </TabsContent>
        <TabsContent value="evidence" className={TAB_CONTENT_CLASS}>
          <EvidenceRag
            review={review}
            selectedPapers={workspace.selectedPapers}
            onSelectPaper={handleSelectPaper}
          />
        </TabsContent>
        <TabsContent value="matrix" className={TAB_CONTENT_CLASS}>
          <ComparisonMatrix
            review={review}
            papers={workspace.collectedPapers}
            onGoToSearch={() => workspace.setView("search")}
          />
        </TabsContent>
      </Tabs>

      <CollapsiblePanel
        side="right"
        title="Paper details"
        open={isDetailsOpen}
        onOpenChange={setIsDetailsOpen}
        className="hidden 2xl:flex"
      >
        <PaperDetailsPanel workspace={workspace} />
      </CollapsiblePanel>

      <Sheet open={isToolsSheetOpen} onOpenChange={setIsToolsSheetOpen}>
        <SheetContent
          side="left"
          className="w-80 overflow-y-auto p-0 sm:max-w-sm"
        >
          <SheetTitle className="sr-only">Research tools</SheetTitle>
          <ResearchToolsPanel
            workspace={workspace}
            onSelectPaper={(id) => {
              setIsToolsSheetOpen(false);
              handleSelectPaper(id);
            }}
            onNavigate={() => setIsToolsSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <Sheet open={isDetailsSheetOpen} onOpenChange={setIsDetailsSheetOpen}>
        <SheetContent
          side="right"
          className="w-full overflow-y-auto p-0 sm:max-w-md"
        >
          <SheetTitle className="sr-only">Paper details</SheetTitle>
          <PaperDetailsPanel workspace={workspace} />
        </SheetContent>
      </Sheet>

      <EvidenceSheet review={review} papers={workspace.collectedPapers} />
    </div>
  );
}
