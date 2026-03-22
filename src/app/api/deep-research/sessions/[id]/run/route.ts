import { NextRequest, NextResponse } from "next/server";
import { runManager } from "@/lib/deep-research/run-manager";
import { updateSession, appendEvent } from "@/lib/deep-research/event-store";
import { PHASE_ORDER, type Phase } from "@/lib/deep-research/types";
import {
  conflict,
  handleDeepResearchRouteError,
  isRecord,
  readSessionId,
  requireSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";
import { canResumeSessionRun } from "@/lib/deep-research/session-status";

function isPhase(value: unknown): value is Phase {
  return typeof value === "string" && PHASE_ORDER.includes(value as Phase);
}

function parseRunRequest(body: unknown): {
  targetPhase?: Phase;
  action?: "run" | "skip" | "rerun";
} {
  if (!isRecord(body)) {
    return {};
  }
  const targetPhase = isPhase(body.targetPhase) ? body.targetPhase : undefined;
  const action = body.action === "run" || body.action === "skip" || body.action === "rerun"
    ? body.action
    : undefined;
  return { targetPhase, action };
}

export async function POST(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const session = await requireSession(sessionId);

    // Parse optional body for phase control
    let requestBody: unknown = undefined;
    try {
      requestBody = await req.json();
    } catch {
      // No body — default behavior (backward compatible)
    }
    const { targetPhase, action } = parseRunRequest(requestBody);

    // Validate targetPhase if provided
    if (isRecord(requestBody) && requestBody.targetPhase !== undefined && !targetPhase) {
      return NextResponse.json(
        { error: `Invalid phase: ${String(requestBody.targetPhase)}` },
        { status: 400 },
      );
    }

    // Handle skip action — advance past the target phase without running it
    if (action === "skip" && targetPhase) {
      const phaseIndex = PHASE_ORDER.indexOf(targetPhase);
      const nextPhase = PHASE_ORDER[phaseIndex + 1];
      if (!nextPhase) {
        return NextResponse.json({ error: "Cannot skip the final phase" }, { status: 400 });
      }
      await updateSession(sessionId, {
        phase: nextPhase,
        status: "awaiting_user_confirmation",
        pendingCheckpointId: null,
      });
      await appendEvent(sessionId, "phase_skipped", undefined, "user", "user");
      return NextResponse.json({ skipped: targetPhase, phase: nextPhase });
    }

    // If targetPhase provided (run/rerun/jump), allow even from halted state
    if (targetPhase) {
      if (runManager.isRunning(sessionId)) {
        conflict("A run is already in progress");
      }
      await updateSession(sessionId, {
        phase: targetPhase,
        status: "running",
        pendingCheckpointId: null,
        error: null,
      });
      await appendEvent(sessionId, "phase_jumped", undefined, "user", "user");
      const started = runManager.startRun(sessionId);
      return NextResponse.json({ started, running: runManager.isRunning(sessionId), phase: targetPhase });
    }

    // --- Default behavior (no body / no targetPhase) ---

    // Cannot /run if awaiting_user_confirmation — must use /confirm instead
    if (session.status === "awaiting_user_confirmation") {
      conflict("Session is awaiting user confirmation. Use /confirm endpoint instead.");
    }

    // If already running in the run manager, report that
    if (runManager.isRunning(sessionId)) {
      return NextResponse.json({ started: false, running: true });
    }

    // If awaiting approval, paused, failed, or stuck in "running" without an active run, resume
    if (canResumeSessionRun(session.status)) {
      await updateSession(sessionId, { status: "running", error: null });
    }

    const started = runManager.startRun(sessionId);
    return NextResponse.json({ started, running: runManager.isRunning(sessionId) });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to start run");
  }
}
