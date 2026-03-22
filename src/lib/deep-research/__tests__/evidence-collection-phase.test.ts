import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../event-store", () => ({
  getNodes: vi.fn(),
  updateSession: vi.fn(),
  appendEvent: vi.fn(),
  addMessage: vi.fn(),
  createNode: vi.fn(),
  updateNode: vi.fn(),
}));

vi.mock("../phases/shared", () => ({
  callMainBrain: vi.fn(),
  createNodesFromSpecs: vi.fn(),
  executeReadyWorkers: vi.fn(),
}));

import * as store from "../event-store";
import { handleEvidenceCollection } from "../phases/evidence-collection";
import type {
  DeepResearchNode,
  DeepResearchSession,
  PhaseContext,
} from "../types";

function makeSession(): DeepResearchSession {
  const now = new Date().toISOString();
  return {
    id: "sess-1",
    workspaceId: "ws-1",
    title: "LLM Architecture & Transformers",
    status: "running",
    phase: "evidence_collection",
    config: {
      budget: { maxTotalTokens: 100000, maxOpusTokens: 50000 },
      maxWorkerFanOut: 8,
      maxReviewerRounds: 2,
      maxExecutionLoops: 3,
      maxWorkerConcurrency: 4,
      literature: {
        maxLiteratureRounds: 3,
        maxPapersPerRound: 10,
        maxTotalPapers: 30,
        maxReviewerRequestedExpansionRounds: 1,
        maxSearchRetries: 2,
      },
      execution: {
        defaultLauncherType: "rjob",
        defaultResources: { gpu: 1, memoryMb: 1024, cpu: 2, privateMachine: "yes" },
        defaultMounts: [],
        defaultChargedGroup: "test",
      },
    },
    budget: { totalTokens: 0, opusTokens: 0, byRole: {}, byNode: {} },
    pendingCheckpointId: null,
    literatureRound: 0,
    reviewerRound: 0,
    executionLoop: 0,
    error: null,
    remoteProfileId: null,
    createdAt: now,
    updatedAt: now,
  };
}

function makeNode(overrides: Partial<DeepResearchNode>): DeepResearchNode {
  const now = new Date().toISOString();
  return {
    id: overrides.id ?? "node-1",
    sessionId: "sess-1",
    parentId: null,
    nodeType: "evidence_gather",
    label: "Search transformers",
    status: "pending",
    assignedRole: "worker",
    assignedModel: null,
    input: null,
    output: null,
    error: null,
    dependsOn: [],
    supersedesId: null,
    supersededById: null,
    branchKey: null,
    retryOfId: null,
    retryCount: 0,
    phase: "evidence_collection",
    stageNumber: 3,
    requiresConfirmation: true,
    confirmedAt: null,
    confirmedBy: null,
    confirmationOutcome: null,
    positionX: null,
    positionY: null,
    startedAt: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

describe("handleEvidenceCollection", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("returns a completed summary node when no evidence worker completed", async () => {
    const initialNodes = [
      makeNode({ id: "e1", label: "LLM Architecture", status: "pending" }),
      makeNode({ id: "e2", label: "Transformers", status: "pending" }),
    ];
    const roundNodes = [
      makeNode({ id: "e1", label: "LLM Architecture", status: "failed", completedAt: new Date().toISOString() }),
      makeNode({ id: "e2", label: "Transformers", status: "pending" }),
    ];

    vi.mocked(store.getNodes)
      .mockResolvedValueOnce(initialNodes)
      .mockResolvedValueOnce(roundNodes);
    vi.mocked(store.createNode).mockResolvedValue(
      makeNode({
        id: "summary-1",
        nodeType: "deliberate",
        assignedRole: "main_brain",
        label: "Evidence collection summary",
      })
    );

    const session = makeSession();
    const ctx: PhaseContext = {
      session,
      nodes: initialNodes,
      artifacts: [],
      messages: [],
      requirementState: null,
      languageState: null,
      config: session.config,
      abortSignal: undefined,
    };

    const result = await handleEvidenceCollection(ctx);

    expect(result.suggestedNextPhase).toBe("evidence_collection");
    expect(result.completedNode.label).toBe("Evidence collection summary");
    expect(result.completedNode.status).toBe("completed");
    expect(vi.mocked(store.createNode)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(store.updateNode)).toHaveBeenCalledWith(
      "summary-1",
      expect.objectContaining({
        status: "completed",
      })
    );
  });
});
