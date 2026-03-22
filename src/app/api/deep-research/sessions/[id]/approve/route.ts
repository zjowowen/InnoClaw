import { NextRequest, NextResponse } from "next/server";
import { updateNode, appendEvent } from "@/lib/deep-research/event-store";
import { runManager } from "@/lib/deep-research/run-manager";
import {
  conflict,
  handleDeepResearchRouteError,
  isRecord,
  parseOptionalString,
  parseRequiredString,
  readSessionId,
  requireSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";
import { canResumeSessionAfterApproval } from "@/lib/deep-research/session-status";

export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const body = await req.json();
    if (!isRecord(body) || typeof body.approved !== "boolean") {
      return NextResponse.json({ error: "Missing nodeId or approved (boolean)" }, { status: 400 });
    }
    const nodeId = parseRequiredString(body.nodeId, "Missing nodeId or approved (boolean)");
    const feedback = parseOptionalString(body.feedback, "Invalid feedback");

    const session = await requireSession(sessionId);

    // Only allow approval when session is in awaiting_approval status.
    // Do NOT start runs if session is awaiting_user_confirmation (step-gate).
    if (session.status === "awaiting_user_confirmation") {
      conflict("Session is awaiting user confirmation. Use /confirm endpoint instead.");
    }

    if (body.approved) {
      await updateNode(nodeId, { status: "completed" });
      await appendEvent(sessionId, "approval_granted", nodeId, "user", undefined, undefined, { feedback });

      // Resume orchestrator only if session is in an appropriate state
      if (!runManager.isRunning(sessionId) && canResumeSessionAfterApproval(session.status)) {
        runManager.startRun(sessionId);
      }
    } else {
      await updateNode(nodeId, { status: "failed", error: feedback || "User denied approval" });
      await appendEvent(sessionId, "approval_denied", nodeId, "user", undefined, undefined, { feedback });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to process approval");
  }
}
