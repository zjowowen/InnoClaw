import { NextRequest, NextResponse } from "next/server";
import { runManager } from "@/lib/deep-research/run-manager";
import type { ConfirmationOutcome } from "@/lib/deep-research/types";
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

const VALID_OUTCOMES: ConfirmationOutcome[] = [
  "confirmed",
  "revision_requested",
  "branch_requested",
  "rejected",
  "stopped",
];

/**
 * POST /api/deep-research/sessions/[id]/confirm
 * User confirms, requests revision, branches, rejects, or stops a checkpoint.
 */
export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const body = await req.json();
    if (!isRecord(body)) {
      return NextResponse.json(
        { error: "Missing required fields: nodeId, outcome" },
        { status: 400 },
      );
    }
    const nodeId = parseRequiredString(body.nodeId, "Missing required fields: nodeId, outcome");
    const outcome = parseRequiredString(body.outcome, "Missing required fields: nodeId, outcome");
    const feedback = parseOptionalString(body.feedback, "Invalid feedback");

    if (!VALID_OUTCOMES.includes(outcome as ConfirmationOutcome)) {
      return NextResponse.json(
        { error: `Invalid outcome. Must be one of: ${VALID_OUTCOMES.join(", ")}` },
        { status: 400 }
      );
    }

    const session = await requireSession(sessionId);

    if (session.status !== "awaiting_user_confirmation") {
      conflict(`Session is not awaiting confirmation (status: ${session.status})`);
    }

    // Start the resume-after-confirmation flow (runs as detached promise)
    const started = runManager.resumeAfterConfirmation(
      sessionId,
      nodeId,
      outcome as ConfirmationOutcome,
      feedback
    );

    return NextResponse.json({
      started,
      running: runManager.isRunning(sessionId),
    });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to process confirmation");
  }
}
