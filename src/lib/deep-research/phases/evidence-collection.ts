// Phase: Evidence Collection (adaptive, bounded by round/global budget)
import * as store from "../event-store";
import type { DeepResearchNode, PhaseContext } from "../types";
import type { PhaseHandlerResult } from "./types";
import { callMainBrain, createNodesFromSpecs, executeReadyWorkers } from "./shared";

export async function handleEvidenceCollection(ctx: PhaseContext): Promise<PhaseHandlerResult> {
  const { session, abortSignal } = ctx;

  const nodes = await store.getNodes(session.id);
  let evidenceNodes = nodes.filter(
    (n) => n.nodeType === "evidence_gather" &&
    (n.phase === "evidence_collection" || n.phase === "additional_literature") &&
    n.status === "pending"
  );

  if (evidenceNodes.length === 0) {
    const allEvidence = nodes.filter(n => n.nodeType === "evidence_gather");
    const allDone = allEvidence.length > 0 && allEvidence.every(n =>
      ["completed", "failed", "skipped"].includes(n.status)
    );

    if (allDone && allEvidence.length > 0) {
      const lastCompleted = allEvidence.filter(n => n.status === "completed").pop() ?? allEvidence[0];
      return { completedNode: lastCompleted, suggestedNextPhase: "literature_synthesis" };
    }

    // Ask main brain to create evidence nodes
    const decision = await callMainBrain(session, abortSignal, ctx.requirementState);
    if (decision.nodesToCreate?.length) {
      // Fix any artificially low maxPapers caps set by LLM
      const fixedSpecs = decision.nodesToCreate.map(spec => {
        if (spec.nodeType === "evidence_gather" && spec.input) {
          const input = { ...spec.input };
          // POLICY: Remove tiny per-node caps. Use adaptive budget instead.
          // Minimum 5 papers per node, up to maxPapersPerRound
          const maxPapers = input.maxPapers as number | undefined;
          if (!maxPapers || maxPapers < 5) {
            input.maxPapers = Math.min(
              session.config.literature.maxPapersPerRound,
              Math.max(5, session.config.literature.maxPapersPerRound / Math.max(1, decision.nodesToCreate!.length))
            );
          }
          return { ...spec, input };
        }
        return spec;
      });
      await createNodesFromSpecs(session.id, fixedSpecs, "evidence_collection");
    }
    if (decision.messageToUser) {
      await store.addMessage(session.id, "main_brain", decision.messageToUser);
    }
    const refreshedNodes = await store.getNodes(session.id);
    evidenceNodes = refreshedNodes.filter(
      (n) => n.nodeType === "evidence_gather" && n.status === "pending"
    );

    if (evidenceNodes.length === 0) {
      // Fallback: create a single broad search with generous cap
      await store.createNode(session.id, {
        nodeType: "evidence_gather",
        label: `Search for: ${session.title}`,
        assignedRole: "worker",
        input: {
          query: session.title,
          maxPapers: session.config.literature.maxPapersPerRound,
        },
        phase: "evidence_collection",
      });
    }
  }

  await store.updateSession(session.id, { literatureRound: session.literatureRound + 1 });
  await store.appendEvent(session.id, "literature_round_started", undefined, "system", undefined, undefined, {
    roundNumber: session.literatureRound + 1,
  });

  await executeReadyWorkers(session, abortSignal);

  const freshNodes = await store.getNodes(session.id);
  const allEvidence = freshNodes.filter((n) =>
    n.nodeType === "evidence_gather" &&
    (n.phase === "evidence_collection" || n.phase === "additional_literature")
  );
  const terminalStatuses = new Set(["completed", "failed", "skipped"]);
  const allDone = allEvidence.every((n) => terminalStatuses.has(n.status));

  // Check evidence quality after this round
  const completedEvidence = allEvidence.filter(n => n.status === "completed");
  const failedEvidence = allEvidence.filter(n => n.status === "failed");
  const pendingEvidence = allEvidence.filter(n => n.status === "pending" || n.status === "running" || n.status === "queued");

  await store.appendEvent(session.id, "literature_round_completed", undefined, "system", undefined, undefined, {
    roundNumber: session.literatureRound + 1,
    completed: completedEvidence.length,
    failed: failedEvidence.length,
    total: allEvidence.length,
  });

  if (completedEvidence.length === 0) {
    const summaryNode = await createEvidenceCollectionSummaryNode(session.id, {
      total: allEvidence.length,
      failed: failedEvidence.length,
      pending: pendingEvidence.length,
      failedLabels: failedEvidence.map(node => node.label),
      pendingLabels: pendingEvidence.map(node => node.label),
    });

    return {
      completedNode: summaryNode,
      suggestedNextPhase: "evidence_collection",
    };
  }

  const lastCompleted = completedEvidence[completedEvidence.length - 1];

  if (allDone) {
    return { completedNode: lastCompleted, suggestedNextPhase: "literature_synthesis" };
  } else {
    return { completedNode: lastCompleted, suggestedNextPhase: "evidence_collection" };
  }
}

async function createEvidenceCollectionSummaryNode(
  sessionId: string,
  summary: {
    total: number;
    failed: number;
    pending: number;
    failedLabels: string[];
    pendingLabels: string[];
  }
): Promise<DeepResearchNode> {
  const summaryNode = await store.createNode(sessionId, {
    nodeType: "deliberate",
    label: "Evidence collection summary",
    assignedRole: "main_brain",
    input: {
      reason: "No evidence worker completed successfully in this round",
      ...summary,
    },
    phase: "evidence_collection",
  });

  const statusNote = summary.pending > 0
    ? "Some evidence workers are still pending or blocked."
    : "All evidence workers in this round failed or produced no usable evidence.";
  const completedAt = new Date().toISOString();
  const output = {
    summaryType: "evidence_collection_round_summary",
    resultAssessment: "problematic",
    statusNote,
    ...summary,
  };

  await store.updateNode(summaryNode.id, {
    status: "completed",
    output,
    completedAt,
  });

  return {
    ...summaryNode,
    status: "completed" as const,
    output,
    completedAt,
    updatedAt: completedAt,
  };
}
