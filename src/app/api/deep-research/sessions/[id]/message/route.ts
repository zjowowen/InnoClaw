import { NextRequest, NextResponse } from "next/server";
import {
  addMessage,
  getNode,
  updateNode,
  updateSession,
} from "@/lib/deep-research/event-store";
import { MainBrain } from "@/lib/deep-research/actors/main-brain";
import { buildNodeTranscriptMetadata } from "@/lib/deep-research/node-transcript";
import { runManager } from "@/lib/deep-research/run-manager";
import type { DeepResearchNode, DeepResearchSession } from "@/lib/deep-research/types";
import {
  badRequest,
  handleDeepResearchRouteError,
  isRecord,
  parseOptionalRecord,
  parseOptionalString,
  parseOptionalStringArray,
  parseRequiredString,
  readSessionId,
  requireSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";
import {
  canAutoAdvanceSession,
  isResettableNodeStatus,
} from "@/lib/deep-research/session-status";

const mainBrain = new MainBrain();

type AutoActionResult = {
  mode: "none" | "already_running" | "blocked" | "rerun_node" | "resume_session";
  started: boolean;
  note?: string;
};

type NodeMessageRequest = {
  content: string;
  relatedNodeId?: string;
  metadata?: Record<string, unknown>;
  relatedArtifactIds?: string[];
};

async function parseNodeMessageRequest(req: NextRequest): Promise<NodeMessageRequest> {
  const body = await req.json();
  if (!isRecord(body)) {
    badRequest("Missing or invalid content");
  }
  return {
    content: parseRequiredString(body.content, "Missing or invalid content"),
    relatedNodeId: parseOptionalString(body.relatedNodeId, "Invalid relatedNodeId"),
    metadata: parseOptionalRecord(body.metadata, "Invalid metadata"),
    relatedArtifactIds: parseOptionalStringArray(body.relatedArtifactIds, "Invalid relatedArtifactIds"),
  };
}

async function resetNodeForRerun(nodeId: string): Promise<void> {
  await updateNode(nodeId, {
    status: "pending",
    assignedModel: null,
    output: null,
    error: null,
    startedAt: null,
    completedAt: null,
    confirmedAt: null,
    confirmedBy: null,
    confirmationOutcome: null,
  });
}

async function addNodeScopedSystemMessage(
  sessionId: string,
  node: DeepResearchNode,
  autoAction: AutoActionResult,
) {
  if (!autoAction.note) {
    return null;
  }

  return addMessage(
    sessionId,
    "system",
    autoAction.note,
    buildNodeTranscriptMetadata(node, "status", {
      source: "node_detail_drawer_auto_action",
      autoActionMode: autoAction.mode,
      autoActionStarted: autoAction.started,
    }),
    node.id,
  );
}

async function addNodeScopedBrainReply(
  sessionId: string,
  node: DeepResearchNode,
  content: string,
  contextNote?: string,
) {
  try {
    const [refreshedSession, refreshedNode] = await Promise.all([
      requireSession(sessionId),
      getNode(node.id),
    ]);
    const response = await mainBrain.replyToNodeMessage(
      refreshedSession,
      refreshedNode ?? node,
      content,
      { contextNote },
    );

    return addMessage(
      sessionId,
      "main_brain",
      response.message,
      buildNodeTranscriptMetadata(node, "output", {
        source: "node_detail_drawer_reply",
      }),
      node.id,
    );
  } catch {
    return addMessage(
      sessionId,
      "main_brain",
      "I recorded your message for this node, but I could not generate a detailed response right now.",
      buildNodeTranscriptMetadata(node, "error", {
        source: "node_detail_drawer_reply_fallback",
      }),
      node.id,
    );
  }
}

async function tryAutoAdvanceFromNodeMessage(
  session: DeepResearchSession,
  node: DeepResearchNode,
): Promise<AutoActionResult> {
  if (node.sessionId !== session.id) {
    return { mode: "none", started: false };
  }

  if (runManager.isRunning(session.id)) {
    return {
      mode: "already_running",
      started: false,
      note: "The research loop is already running, so the agent will absorb your note in the current pass.",
    };
  }

  if (session.status === "awaiting_user_confirmation") {
    return {
      mode: "blocked",
      started: false,
      note: "This session is waiting for an explicit confirmation step, so I did not auto-run it.",
    };
  }

  if (!canAutoAdvanceSession(session.status)) {
    return {
      mode: "blocked",
      started: false,
      note: `This session is in terminal state "${session.status}", so I only recorded your note.`,
    };
  }

  if (node.status === "superseded") {
    return {
      mode: "blocked",
      started: false,
      note: "This node has already been superseded, so I did not resume it.",
    };
  }

  if (node.phase !== session.phase) {
    return {
      mode: "blocked",
      started: false,
      note: `This node belongs to phase "${node.phase}" while the session is in "${session.phase}", so I did not jump phases automatically.`,
    };
  }

  let mode: AutoActionResult["mode"] = "resume_session";
  if (isResettableNodeStatus(node.status)) {
    await resetNodeForRerun(node.id);
    mode = "rerun_node";
  }

  await updateSession(session.id, {
    status: "running",
    error: null,
  });
  const started = runManager.startRun(session.id);

  if (!started) {
    return {
      mode: "already_running",
      started: false,
      note: "A run started concurrently while I was processing your message.",
    };
  }

  return {
    mode,
    started: true,
    note: mode === "rerun_node"
      ? "I reset this node to pending and started a fresh run for the current phase."
      : "I started the next research run using your latest node-specific instruction.",
  };
}

async function handleNodeScopedMessage(
  sessionId: string,
  nodeId: string,
  content: string,
): Promise<{ reply: Awaited<ReturnType<typeof addMessage>> | null; autoAction: AutoActionResult | null }> {
  const [session, node] = await Promise.all([
    requireSession(sessionId),
    getNode(nodeId),
  ]);

  if (!node || node.sessionId !== sessionId) {
    return { reply: null, autoAction: null };
  }

  const autoAction = await tryAutoAdvanceFromNodeMessage(session, node);
  await addNodeScopedSystemMessage(sessionId, node, autoAction);
  const reply = await addNodeScopedBrainReply(sessionId, node, content, autoAction.note);

  return { reply, autoAction };
}

export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const { content, relatedNodeId, metadata, relatedArtifactIds } = await parseNodeMessageRequest(req);

    const message = await addMessage(
      sessionId,
      "user",
      content,
      metadata ?? undefined,
      relatedNodeId ?? undefined,
      relatedArtifactIds ?? undefined,
    );

    let reply = null;
    let autoAction: AutoActionResult | null = null;

    if (relatedNodeId) {
      ({ reply, autoAction } = await handleNodeScopedMessage(sessionId, relatedNodeId, content));
    }

    return NextResponse.json({ message, reply, autoAction }, { status: 201 });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to add message");
  }
}
