import { NextRequest, NextResponse } from "next/server";
import { deleteSession, updateSession } from "@/lib/deep-research/event-store";
import { runManager } from "@/lib/deep-research/run-manager";
import {
  handleDeepResearchRouteError,
  parseNullableString,
  parseOptionalString,
  readSessionId,
  requireSession,
  type DeepResearchRouteParams,
} from "@/lib/deep-research/api-helpers";

export async function GET(_req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    const session = await requireSession(sessionId);
    return NextResponse.json(session);
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to fetch session");
  }
}

export async function DELETE(_req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    await requireSession(sessionId);

    // Abort any active orchestrator run before deleting
    if (runManager.isRunning(sessionId)) {
      runManager.abortRun(sessionId);
    }

    await deleteSession(sessionId);
    return NextResponse.json({ success: true });
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to delete session");
  }
}

export async function PATCH(req: NextRequest, { params }: DeepResearchRouteParams) {
  try {
    const sessionId = await readSessionId(params);
    await requireSession(sessionId);
    const body = await req.json();
    const updates: Record<string, unknown> = {};

    if (body.remoteProfileId !== undefined) {
      updates.remoteProfileId = parseNullableString(body.remoteProfileId, "Invalid remoteProfileId");
    }
    if (body.title !== undefined) {
      updates.title = parseOptionalString(body.title, "Invalid title");
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    await updateSession(sessionId, updates as Parameters<typeof updateSession>[1]);
    const updated = await requireSession(sessionId);
    return NextResponse.json(updated);
  } catch (error) {
    return handleDeepResearchRouteError(error, "Failed to update session");
  }
}
