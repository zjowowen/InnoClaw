"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Play, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import {
  useDeepResearchSessions,
  useDeepResearchSession,
  useDeepResearchMessages,
  useDeepResearchNodes,
  useDeepResearchArtifacts,
  useDeepResearchEvents,
  useDeepResearchExecutions,
} from "@/lib/hooks/use-deep-research";
import { SessionList } from "./session-list";
import { IntakeScreen } from "./intake-screen";
import { ResearchChat } from "./research-chat";
import { FinalReportView } from "./final-report-view";
import { PhaseProgress } from "./phase-progress";
import { WorkflowGraph } from "./workflow-graph";
import { NodeDetailDrawer } from "./node-detail-drawer";
import { DeleteSessionDialog } from "./delete-session-dialog";
import { RequirementPanel } from "./requirement-panel";
import { ReviewerBattlePanel } from "./reviewer-battle-panel";
import { ExecutionStatusPanel } from "./execution-status-panel";
import type { ConfirmationOutcome, ReviewerBattleResultExtended, RequirementState, Phase } from "@/lib/deep-research/types";
import {
  canStartSession,
  isActiveSessionStatus,
  isAwaitingConfirmationSessionStatus,
  isCompletedSessionStatus,
} from "@/lib/deep-research/session-status";

type PanelView = "list" | "intake" | "session";
type TabView = "chat" | "requirements" | "reviewers" | "execution";
type SessionMessageOptions = {
  relatedNodeId?: string;
  metadata?: Record<string, unknown>;
  relatedArtifactIds?: string[];
};

interface DeepResearchPanelProps {
  workspaceId: string;
}

const TAB_LABELS: Record<TabView, string> = {
  chat: "Chat",
  requirements: "Requirements",
  reviewers: "Reviewers",
  execution: "Execution",
};

async function readErrorMessage(response: Response, fallback: string): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data && typeof data.error === "string" && data.error) || fallback;
}

export function DeepResearchPanel({ workspaceId }: DeepResearchPanelProps) {
  const [view, setView] = useState<PanelView>("list");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabView>("chat");

  const { sessions, mutate: mutateSessions } = useDeepResearchSessions(workspaceId);
  const { session, mutate: mutateSession } = useDeepResearchSession(activeSessionId ?? undefined);
  const { messages, mutate: mutateMessages } = useDeepResearchMessages(activeSessionId ?? undefined);
  const { nodes } = useDeepResearchNodes(activeSessionId ?? undefined);
  const { artifacts } = useDeepResearchArtifacts(activeSessionId ?? undefined);
  const { events } = useDeepResearchEvents(activeSessionId ?? undefined);
  const { executions } = useDeepResearchExecutions(activeSessionId ?? undefined);
  const activeSessionPath = activeSessionId ? `/api/deep-research/sessions/${activeSessionId}` : null;

  const selectedNode = nodes.find((n) => n.id === selectedNodeId) ?? null;

  const requirementState = useMemo(() => {
    const artifact = artifacts.find((candidate) => {
      if (candidate.artifactType !== "checkpoint") {
        return false;
      }
      const content = candidate.content as Record<string, unknown>;
      return Boolean(content.requirementState);
    });
    return (artifact?.content as { requirementState?: RequirementState } | undefined)?.requirementState ?? null;
  }, [artifacts]);

  const battleResult = useMemo(() => {
    const latestBattleArtifact = [...artifacts]
      .reverse()
      .find((artifact) => artifact.artifactType === "reviewer_battle_result");
    return latestBattleArtifact?.content as ReviewerBattleResultExtended | null | undefined ?? null;
  }, [artifacts]);

  // Auto-switch tab based on phase
  const autoTabForPhase = useCallback((phase: string) => {
    if (phase === "reviewer_deliberation" || phase === "validation_review") return "reviewers";
    if (phase === "experiment_execution" || phase === "resource_acquisition") return "execution";
    return null;
  }, []);

  const runSessionRequest = useCallback(
    async <T,>(
      pathSuffix: string,
      init: RequestInit,
      fallbackError: string,
    ): Promise<T | null> => {
      if (!activeSessionPath) {
        return null;
      }

      try {
        const response = await fetch(`${activeSessionPath}${pathSuffix}`, init);
        if (!response.ok) {
          throw new Error(await readErrorMessage(response, fallbackError));
        }
        return response.status === 204 ? null : ((await response.json().catch(() => null)) as T | null);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallbackError);
        return null;
      }
    },
    [activeSessionPath],
  );

  // --- Navigation ---

  const handleOpenSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setView("session");
    setSelectedNodeId(null);
    setDrawerOpen(false);
  }, []);

  const handleBackToList = useCallback(() => {
    setActiveSessionId(null);
    setView("list");
    setSelectedNodeId(null);
    setDrawerOpen(false);
  }, []);

  // --- Intake ---

  const handleStartIntake = useCallback(() => {
    setView("intake");
  }, []);

  const handleIntakeCreated = useCallback(
    (sessionId: string) => {
      mutateSessions();
      setActiveSessionId(sessionId);
      setView("session");
    },
    [mutateSessions]
  );

  const handleIntakeCancel = useCallback(() => {
    setView("list");
  }, []);

  // --- Delete ---

  const handleSessionDeleted = useCallback(
    (deletedId: string) => {
      mutateSessions();
      // If the currently active session was deleted, go back to list
      if (activeSessionId === deletedId) {
        setActiveSessionId(null);
        setView("list");
      }
    },
    [activeSessionId, mutateSessions]
  );

  const handleDeleteActiveSession = useCallback(() => {
    setDeleteDialogOpen(true);
  }, []);

  const handleActiveSessionDeleted = useCallback(() => {
    mutateSessions();
    setActiveSessionId(null);
    setView("list");
    setDeleteDialogOpen(false);
  }, [mutateSessions]);

  // --- Session actions ---

  const handleSendMessage = useCallback(
    async (content: string, options?: SessionMessageOptions) => {
      const response = await runSessionRequest<{ message: unknown; reply: unknown; autoAction: unknown }>(
        "/message",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            relatedNodeId: options?.relatedNodeId,
            metadata: options?.metadata,
            relatedArtifactIds: options?.relatedArtifactIds,
          }),
        },
        "Failed to send message",
      );
      if (response) {
        await Promise.all([mutateMessages(), mutateSession()]);
      }
    },
    [mutateMessages, mutateSession, runSessionRequest],
  );

  const handleApprove = useCallback(
    async (nodeId: string, approved: boolean, feedback?: string) => {
      const response = await runSessionRequest<{ success: boolean }>(
        "/approve",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, approved, feedback }),
        },
        "Failed to process approval",
      );
      if (response) {
        await mutateSession();
      }
    },
    [mutateSession, runSessionRequest],
  );

  const handleConfirm = useCallback(
    async (nodeId: string, outcome: ConfirmationOutcome, feedback?: string) => {
      const response = await runSessionRequest<{ started: boolean; running: boolean }>(
        "/confirm",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ nodeId, outcome, feedback }),
        },
        "Failed to process confirmation",
      );
      if (response) {
        await mutateSession();
        toast.success(
          outcome === "confirmed"
            ? "Confirmed — continuing research"
            : outcome === "stopped"
              ? "Research stopped"
              : `Feedback sent: ${outcome.replace("_", " ")}`
        );
      }
    },
    [mutateSession, runSessionRequest],
  );

  const handleStartRun = useCallback(async () => {
    const response = await runSessionRequest<{ started: boolean; running: boolean }>(
      "/run",
      { method: "POST" },
      "Failed to start research",
    );
    if (response) {
      await mutateSession();
      toast.success("Research started");
    }
  }, [mutateSession, runSessionRequest]);

  const handlePhaseAction = useCallback(
    async (phase: Phase, action: "run" | "skip", successLabel: string, fallbackError: string) => {
      const response = await runSessionRequest<{ phase: Phase; started?: boolean; skipped?: Phase }>(
        "/run",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ targetPhase: phase, action }),
        },
        fallbackError,
      );
      if (response) {
        await mutateSession();
        toast.success(`${successLabel}: ${phase}`);
      }
    },
    [mutateSession, runSessionRequest],
  );

  const handleRunPhase = useCallback(async (phase: Phase) => {
    await handlePhaseAction(phase, "run", "Running phase", "Failed to run phase");
  }, [handlePhaseAction]);

  const handleSkipPhase = useCallback(async (phase: Phase) => {
    await handlePhaseAction(phase, "skip", "Skipped phase", "Failed to skip phase");
  }, [handlePhaseAction]);

  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
    setDrawerOpen(true);
  }, []);

  const handleBindProfile = useCallback(
    async (profileId: string | null) => {
      const response = await runSessionRequest(
        "",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remoteProfileId: profileId }),
        },
        "Failed to bind remote profile",
      );
      if (response) {
        await mutateSession();
      }
    },
    [mutateSession, runSessionRequest],
  );

  const sessionFlags = useMemo(() => {
    if (!session) {
      return null;
    }

    return {
      isRunning: isActiveSessionStatus(session.status),
      isAwaitingConfirmation: isAwaitingConfirmationSessionStatus(session.status),
      isCompleted: isCompletedSessionStatus(session.status),
      isFailed: session.status === "failed",
      isLiteratureBlocked: session.status === "literature_blocked",
      isStopped: session.status === "stopped_by_user",
      canStart: canStartSession(session.status),
    };
  }, [session]);

  const completedPhases = useMemo(
    () => new Set(nodes.filter((node) => node.status === "completed").map((node) => node.phase)),
    [nodes],
  );

  useEffect(() => {
    if (!session) {
      return;
    }
    const nextTab = autoTabForPhase(session.phase);
    if (nextTab && nextTab !== activeTab) {
      setActiveTab(nextTab);
    }
  }, [activeTab, autoTabForPhase, session]);

  if (view === "intake") {
    return (
      <IntakeScreen
        workspaceId={workspaceId}
        onCreated={handleIntakeCreated}
        onCancel={handleIntakeCancel}
      />
    );
  }

  if (view === "list" || !activeSessionId || !session || !sessionFlags) {
    return (
      <SessionList
        sessions={sessions}
        onSelect={handleOpenSession}
        onCreateNew={handleStartIntake}
        onDeleted={handleSessionDeleted}
      />
    );
  }

  const {
    isRunning,
    isAwaitingConfirmation,
    isCompleted,
    isFailed,
    isLiteratureBlocked,
    isStopped,
    canStart,
  } = sessionFlags;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border/50 bg-muted/30 shrink-0">
        <Select
          value={activeSessionId}
          onValueChange={(v) => handleOpenSession(v)}
        >
          <SelectTrigger className="h-7 w-[200px] text-xs">
            <SelectValue placeholder="Select session" />
          </SelectTrigger>
          <SelectContent>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {s.title}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex-1" />

        {canStart && !isFailed && (
          <Button size="sm" className="h-7 px-2 gap-1" onClick={handleStartRun}>
            <Play className="h-3 w-3" />
            <span className="text-xs">{session.status === "intake" ? "Start" : "Resume"}</span>
          </Button>
        )}

        {isAwaitingConfirmation && (
          <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
            <div className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
            Awaiting your confirmation
          </div>
        )}

        {isCompleted && (
          <div className="flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
            <div className="h-2 w-2 rounded-full bg-green-500" />
            Completed
          </div>
        )}

        {isFailed && (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs text-red-600 dark:text-red-400">
              <div className="h-2 w-2 rounded-full bg-red-500" />
              Failed
            </div>
            <Button size="sm" variant="outline" className="h-7 px-2 gap-1" onClick={handleStartRun}>
              <RotateCcw className="h-3 w-3" />
              <span className="text-xs">Retry</span>
            </Button>
          </div>
        )}

        {isStopped && (
          <div className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-400">
            <div className="h-2 w-2 rounded-full bg-gray-500" />
            Stopped by user
          </div>
        )}

        {isLiteratureBlocked && (
          <div className="flex items-center gap-1.5 text-xs text-orange-600 dark:text-orange-400">
            <div className="h-2 w-2 rounded-full bg-orange-500 animate-pulse" />
            Literature blocked — no evidence
          </div>
        )}

        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
          onClick={handleDeleteActiveSession}
          title="Delete session"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 gap-1"
          onClick={handleBackToList}
        >
          <span className="text-xs">Back</span>
        </Button>
      </div>

      {/* Main content */}
      <div className="flex-1 min-h-0">
        <ResizablePanelGroup orientation="horizontal">
          {/* Left: Tabs + Content */}
          <ResizablePanel defaultSize={45} minSize={25}>
            <div className="flex flex-col h-full">
              {isCompleted ? (
                <FinalReportView session={session} artifacts={artifacts} />
              ) : (
                <>
                  <PhaseProgress
                    currentPhase={session.phase}
                    sessionStatus={session.status}
                    budget={session.budget}
                    budgetLimits={session.config.budget}
                    completedPhases={completedPhases}
                    onRunPhase={handleRunPhase}
                    onSkipPhase={handleSkipPhase}
                    isRunning={isRunning}
                    resolvedModel={session.config.resolvedModel ?? null}
                  />
                  {/* Tab bar */}
                  <div className="flex gap-0.5 px-2 py-1 border-b border-border/50 bg-muted/20 shrink-0">
                    {(Object.keys(TAB_LABELS) as TabView[]).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-2 py-1 text-[11px] rounded transition-colors ${
                          activeTab === tab
                            ? "bg-primary text-primary-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-muted"
                        }`}
                      >
                        {TAB_LABELS[tab]}
                      </button>
                    ))}
                  </div>
                  {/* Tab content */}
                  <div className="flex-1 min-h-0">
                    {activeTab === "chat" && (
                      <ResearchChat
                        session={session}
                        messages={messages}
                        nodes={nodes}
                        artifacts={artifacts}
                        onSendMessage={handleSendMessage}
                        onApprove={handleApprove}
                        onConfirm={handleConfirm}
                      />
                    )}
                    {activeTab === "requirements" && (
                      <RequirementPanel requirementState={requirementState} />
                    )}
                    {activeTab === "reviewers" && (
                      <ReviewerBattlePanel battleResult={battleResult} />
                    )}
                    {activeTab === "execution" && (
                      <ExecutionStatusPanel
                        executions={executions}
                        workspaceId={workspaceId}
                        sessionId={activeSessionId}
                        remoteProfileId={session.remoteProfileId}
                        onBindProfile={handleBindProfile}
                      />
                    )}
                  </div>
                </>
              )}
            </div>
          </ResizablePanel>

          <ResizableHandle withHandle />

          {/* Right: Workflow graph */}
          <ResizablePanel defaultSize={55} minSize={25}>
            <WorkflowGraph nodes={nodes} onNodeSelect={handleNodeSelect} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Node detail drawer */}
      <NodeDetailDrawer
        node={selectedNode}
        messages={messages}
        artifacts={artifacts}
        events={events}
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onApprove={handleApprove}
        onSendMessage={handleSendMessage}
      />

      {/* Delete dialog for active session */}
      <DeleteSessionDialog
        sessionId={session.id}
        sessionTitle={session.title}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onDeleted={handleActiveSessionDeleted}
      />
    </div>
  );
}
