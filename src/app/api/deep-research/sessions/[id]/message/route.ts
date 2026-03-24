import { NextRequest, NextResponse } from "next/server";
import { addMessage, createArtifact, getArtifact, getNode, updateSession } from "@/lib/deep-research/event-store";
import { ensureInterfaceShell, isInterfaceOnlySession } from "@/lib/deep-research/interface-shell";
import { runManager } from "@/lib/deep-research/run-manager";
import {
  buildHandoffMessage,
  buildHandoffPacket,
  buildResearchTaskBoard,
  buildTaskBoardMessage,
} from "@/lib/deep-research/collaboration-shell";
import {
  buildStructuredRoleReply,
  getStructuredRoleDefinition,
  RESEARCHER_ROLE_ID,
} from "@/lib/deep-research/role-registry";
import { buildNodeTranscriptMetadata } from "@/lib/deep-research/node-transcript";
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
import type { CheckpointPackage, ModelRole } from "@/lib/deep-research/types";

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

function inferRoleId(node: Awaited<ReturnType<typeof getNode>>): ModelRole {
  if (!node) {
    return RESEARCHER_ROLE_ID;
  }
  return typeof node.input?.roleId === "string"
    ? node.input.roleId as ModelRole
    : node.assignedRole;
}

async function createStructuredArtifacts(
  sessionId: string,
  node: Awaited<ReturnType<typeof getNode>>,
  content: string,
): Promise<string[]> {
  if (!node) {
    const board = buildResearchTaskBoard(content);
    const artifact = await createArtifact(
      sessionId,
      null,
      "task_graph",
      "Research Coordination Task Board",
      board as unknown as Record<string, unknown>,
    );
    return [artifact.id];
  }

  const roleId = inferRoleId(node);
  const role = getStructuredRoleDefinition(roleId);
  const handoff = buildHandoffPacket(roleId, content);
  if (!role || !handoff) {
    return [];
  }

  const artifact = await createArtifact(
    sessionId,
    node.id,
    "structured_summary",
    `${role.roleName} Collaboration Packet`,
    {
      roleId: role.roleId,
      roleName: role.roleName,
      workflowSegment: role.workflowSegment,
      packet: handoff,
      roleResponseContract: role.prompts,
      roleSkills: role.skills,
    },
  );

  return [artifact.id];
}

async function shouldResumeAfterUserReply(session: Awaited<ReturnType<typeof requireSession>>): Promise<boolean> {
  if (session.status !== "awaiting_user_confirmation" || !session.pendingCheckpointId) {
    return false;
  }

  const checkpointArtifact = await getArtifact(session.pendingCheckpointId);
  if (!checkpointArtifact || checkpointArtifact.artifactType !== "checkpoint") {
    return false;
  }

  const checkpoint = checkpointArtifact.content as Partial<CheckpointPackage>;
  return checkpoint.interactionMode === "answer_required";
}

export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const session = await requireSession(sessionId);
    const { content, relatedNodeId, metadata, relatedArtifactIds } = await parseNodeMessageRequest(req);
    if (!isInterfaceOnlySession(session)) {
      const resumeAfterReply = await shouldResumeAfterUserReply(session);
      const message = await addMessage(
        sessionId,
        "user",
        content,
        metadata ?? undefined,
        relatedNodeId ?? undefined,
        relatedArtifactIds && relatedArtifactIds.length > 0 ? relatedArtifactIds : undefined,
      );

      let started = false;
      if (resumeAfterReply) {
        await updateSession(sessionId, {
          status: "running",
          pendingCheckpointId: null,
        });
        started = runManager.isRunning(sessionId) ? false : runManager.startRun(sessionId);
      }

      return NextResponse.json({
        message,
        autoAction: {
          mode: resumeAfterReply ? "resume_after_reply" : "none",
          started,
        },
      }, { status: 201 });
    }

    const shell = await ensureInterfaceShell(session);
    const relatedNode = relatedNodeId ? await getNode(relatedNodeId) : shell.researcherNode;
    const structuredArtifactIds = await createStructuredArtifacts(sessionId, relatedNode, content);
    const allArtifactIds = [...(relatedArtifactIds ?? []), ...structuredArtifactIds];

    const message = await addMessage(
      sessionId,
      "user",
      content,
      metadata ?? undefined,
      relatedNode?.id ?? undefined,
      allArtifactIds.length > 0 ? allArtifactIds : undefined,
    );

    const roleId = inferRoleId(relatedNode);
    const role = getStructuredRoleDefinition(roleId);
    const replyContent = relatedNode && relatedNode.id !== shell.researcherNode.id
      ? buildHandoffMessage(relatedNode, content)
      : role
        ? [
            buildTaskBoardMessage(content),
            "",
            buildStructuredRoleReply(role, content),
          ].join("\n")
        : "The message was recorded in the structured research session shell.";

    const reply = await addMessage(
      sessionId,
      "main_brain",
      replyContent,
      relatedNode
        ? buildNodeTranscriptMetadata(relatedNode, "output", {
            source: "structured_role_reply",
            interfaceOnly: true,
            roleId,
            messageType: "handoff_or_progress",
          })
        : {
            source: "structured_role_reply",
            interfaceOnly: true,
            roleId: RESEARCHER_ROLE_ID,
            messageType: "task_board_update",
          },
      relatedNode?.id ?? undefined,
      allArtifactIds.length > 0 ? allArtifactIds : undefined,
    );

    return NextResponse.json(
      {
        message,
        reply,
        autoAction: {
          mode: "none",
          started: false,
          note: "Structured role coordination artifacts were updated in interface-only mode.",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to add message");
  }
}
