import { generateText, stepCountIs } from "ai";
import { getModelChainForRole, checkBudget, trackUsage } from "../model-router";
import * as store from "../event-store";
import { buildMainBrainSystemPrompt } from "../prompts";
import {
  buildNodeTranscriptMetadata,
  serializeTranscriptPayload,
} from "../node-transcript";
import {
  loadWorkspaceSkillCatalog,
  createWorkspaceSkillTools,
} from "../workspace-skill-loader";
import type {
  ActorArtifactDraft,
  ActorExecutionContext,
  ActorExecutionResult,
  ArtifactProvenance,
  ArtifactType,
  BrainDecision,
  DeepResearchNode,
  DeepResearchSession,
  RequirementState,
} from "../types";

export class MainBrain {
  async replyToNodeMessage(
    session: DeepResearchSession,
    node: DeepResearchNode,
    userMessage: string,
    options?: {
      abortSignal?: AbortSignal;
      contextNote?: string;
    },
  ): Promise<{ message: string; tokensUsed: number }> {
    const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);
    if (!budgetCheck.allowed) {
      return {
        message: "Current budget is exhausted. I recorded your note, but I cannot generate a detailed response right now.",
        tokensUsed: 0,
      };
    }

    const messages = await store.getMessages(session.id);
    const nodes = await store.getNodes(session.id);
    const artifacts = await store.getArtifacts(session.id);
    const skillCatalog = await loadWorkspaceSkillCatalog(session.workspaceId);
    const skillTools = skillCatalog.length > 0
      ? await createWorkspaceSkillTools(session.workspaceId)
      : undefined;

    const relatedArtifacts = artifacts.filter((artifact) => artifact.nodeId === node.id);
    const relatedMessages = messages
      .filter((message) => message.relatedNodeId === node.id)
      .slice(-8)
      .map((message) => `[${message.role}] ${message.content.slice(0, 400)}`)
      .join("\n");

    const nodeContext = [
      `Current node: ${node.label}`,
      `Node type: ${node.nodeType}`,
      `Assigned role: ${node.assignedRole}`,
      `Node status: ${node.status}`,
      node.phase ? `Phase: ${node.phase}` : "",
      node.input ? `Node input:\n${serializeTranscriptPayload(node.input)}` : "",
      node.output ? `Node output snapshot:\n${serializeTranscriptPayload(node.output)}` : "",
      node.error ? `Node error:\n${node.error}` : "",
      relatedArtifacts.length > 0
        ? `Node artifacts:\n${relatedArtifacts.map((artifact) => `- ${artifact.artifactType}: ${artifact.title}`).join("\n")}`
        : "",
      relatedMessages ? `Recent node transcript:\n${relatedMessages}` : "",
    ].filter(Boolean).join("\n\n");

    const systemPrompt = `${buildMainBrainSystemPrompt(
      session,
      messages,
      nodes,
      artifacts,
      session.phase,
      undefined,
      skillCatalog,
    )}

You are replying inside a node-specific transcript panel in the deep-research UI.
Respond conversationally to the user's latest node-scoped message.
Prioritize the currently selected node and its execution context over unrelated session details.
Be concrete about what this node is doing, what changed, and any next step or limitation.
Do not return JSON. Keep the response concise, but actually answer the user's request.
If a workspace skill is relevant, use it before generic reasoning.`;

    const userPrompt = `${nodeContext}

${options?.contextNote ? `Execution note:\n${options.contextNote}\n\n` : ""}Latest user message for this node:
${userMessage}

Reply as the agent responsible for this node.`;

    const modelChain = await getModelChainForRole("main_brain", session.config);
    let lastError: Error | null = null;

    for (const { model, provider, modelId } of modelChain) {
      try {
        const result = await generateText({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
          ...(skillTools && Object.keys(skillTools).length > 0
            ? { tools: skillTools as Record<string, never>, stopWhen: stepCountIs(8) }
            : {}),
          abortSignal: options?.abortSignal,
        });

        const message = result.text.trim() || "I recorded your message for this node.";
        const budget = trackUsage(
          session.budget,
          "main_brain",
          `node_reply_${node.id}`,
          result.usage?.totalTokens ?? 0,
        );
        await store.updateSession(session.id, { budget });

        return {
          message,
          tokensUsed: result.usage?.totalTokens ?? 0,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[MainBrain.replyToNodeMessage] ${provider}/${modelId} failed: ${lastError.message}. Trying next model...`);
      }
    }

    throw lastError ?? new Error("No available model for node reply");
  }

  async decide(
    session: DeepResearchSession,
    options?: {
      abortSignal?: AbortSignal;
      requirementState?: RequirementState | null;
      languageHint?: string;
    },
  ): Promise<BrainDecision> {
    const budgetCheck = checkBudget("main_brain", session.budget, session.config.budget);
    if (!budgetCheck.allowed) {
      return {
        action: "complete",
        messageToUser: "Budget limit reached. Generating final report.",
      };
    }

    const messages = await store.getMessages(session.id);
    const nodes = await store.getNodes(session.id);
    const artifacts = await store.getArtifacts(session.id);
    const skillCatalog = await loadWorkspaceSkillCatalog(session.workspaceId);
    const skillTools = skillCatalog.length > 0
      ? await createWorkspaceSkillTools(session.workspaceId)
      : undefined;

    const modelChain = await getModelChainForRole("main_brain", session.config);
    let systemPrompt = buildMainBrainSystemPrompt(
      session,
      messages,
      nodes,
      artifacts,
      session.phase,
      options?.requirementState,
      skillCatalog,
    );

    let languageHint = options?.languageHint;
    if (!languageHint) {
      const userMessages = messages.filter(m => m.role === "user");
      const lastUserMsg = userMessages[userMessages.length - 1];
      if (lastUserMsg) {
        const cjkChars = lastUserMsg.content.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g);
        if (cjkChars && cjkChars.length > lastUserMsg.content.replace(/\s/g, "").length * 0.1) {
          languageHint = "zh";
        }
      }
    }
    if (languageHint && languageHint !== "en") {
      systemPrompt += `\n\nIMPORTANT: The user communicates in ${languageHint}. Write any messageToUser content in ${languageHint}. Technical terms may remain in English.`;
    }

    const userMsg = messages.length > 0
      ? "Continue orchestrating the research based on current state and any new user messages."
      : "Begin processing the user's research request.";

    const hasTools = skillTools && Object.keys(skillTools).length > 0;
    let lastError: Error | null = null;

    for (const { model, provider, modelId } of modelChain) {
      try {
        const result = await generateText({
          model,
          system: systemPrompt,
          messages: [{ role: "user", content: userMsg }],
          ...(hasTools ? { tools: skillTools as Record<string, never>, stopWhen: stepCountIs(20) } : {}),
          abortSignal: options?.abortSignal,
        });

        const budget = trackUsage(session.budget, "main_brain", `brain_${session.phase}`, result.usage?.totalTokens ?? 0);
        await store.updateSession(session.id, { budget });

        try {
          return extractJsonFromText<BrainDecision>(result.text);
        } catch {
          return { action: "respond_to_user", messageToUser: result.text };
        }
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`[MainBrain.decide] ${provider}/${modelId} failed: ${lastError.message}. Trying next model...`);
      }
    }

    throw lastError ?? new Error("No available model for main_brain");
  }

  async executeNode(
    node: DeepResearchNode,
    ctx: ActorExecutionContext,
    abortSignal?: AbortSignal,
  ): Promise<ActorExecutionResult> {
    const budgetCheck = checkBudget("main_brain", ctx.session.budget, ctx.session.config.budget);
    if (!budgetCheck.allowed) {
      throw new Error(`Budget exceeded: ${budgetCheck.reason}`);
    }

    await store.addMessage(
      ctx.session.id,
      "system",
      serializeTranscriptPayload(node.input ?? { task: node.label }),
      buildNodeTranscriptMetadata(node, "input"),
      node.id,
    );
    await store.addMessage(
      ctx.session.id,
      "system",
      `Started ${node.nodeType} with ${node.assignedRole.replace("_", " ")}.`,
      buildNodeTranscriptMetadata(node, "status"),
      node.id,
    );

    const modelChain = await getModelChainForRole("main_brain", ctx.session.config);
    let lastError: Error | null = null;

    for (let i = 0; i < modelChain.length; i++) {
      const { model, provider, modelId } = modelChain[i];
      await store.updateNode(node.id, {
        status: "running",
        assignedModel: `${provider}/${modelId}`,
        startedAt: new Date().toISOString(),
      });

      try {
        const result = await this.executeWithModel(node, ctx, model, abortSignal);
        await store.updateNode(node.id, {
          status: "completed",
          output: result.output,
          completedAt: new Date().toISOString(),
        });

        const createdArtifacts = await createArtifacts(ctx.session.id, node.id, result.artifactDrafts);
        const updatedBudget = trackUsage(
          ctx.session.budget,
          "main_brain",
          node.id,
          result.tokensUsed,
        );
        await store.updateSession(ctx.session.id, { budget: updatedBudget });
        await store.addMessage(
          ctx.session.id,
          "system",
          serializeTranscriptPayload(result.output),
          buildNodeTranscriptMetadata(node, "output"),
          node.id,
          createdArtifacts.map((artifact) => artifact.id),
        );

        return {
          output: result.output,
          artifacts: createdArtifacts,
          tokensUsed: result.tokensUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isLast = i === modelChain.length - 1;
        if (!isLast) {
          await store.updateNode(node.id, { status: "pending" });
        }
      }
    }

    const message = lastError?.message ?? "Unknown execution error";
    await store.updateNode(node.id, {
      status: "failed",
      error: `All models failed. Last error: ${message}`,
      completedAt: new Date().toISOString(),
    });
    await store.addMessage(
      ctx.session.id,
      "system",
      message,
      buildNodeTranscriptMetadata(node, "error"),
      node.id,
    );
    throw lastError ?? new Error(message);
  }

  private async executeWithModel(
    node: DeepResearchNode,
    ctx: ActorExecutionContext,
    model: Awaited<ReturnType<typeof getModelChainForRole>>[number]["model"],
    abortSignal?: AbortSignal,
  ): Promise<{
    output: Record<string, unknown>;
    artifactDrafts: ActorArtifactDraft[];
    tokensUsed: number;
  }> {
    const systemPrompt = buildMainBrainSystemPrompt(
      ctx.session,
      ctx.messages,
      ctx.allNodes,
      ctx.allArtifacts,
      ctx.session.phase,
      undefined,
      ctx.skillCatalog as never,
    );
    const taskPrompt = node.input
      ? JSON.stringify(node.input)
      : `Execute the ${node.nodeType} task: ${node.label}`;
    const skillFirstTaskPrompt = ctx.skillCatalog && ctx.skillCatalog.length > 0
      ? `Use relevant workspace skills first if any skill plausibly matches this task. Only fall back to generic execution if no skill fits.\n\n${taskPrompt}`
      : taskPrompt;

    const hasTools = ctx.skillTools && Object.keys(ctx.skillTools).length > 0;
    const result = await generateText({
      model,
      system: systemPrompt,
      messages: [{ role: "user", content: skillFirstTaskPrompt }],
      ...(hasTools ? { tools: ctx.skillTools as Record<string, never>, stopWhen: stepCountIs(20) } : {}),
      abortSignal,
    });

    const output = safeParseJson(result.text);
    const artifactDrafts = buildBrainArtifacts(node, output, result.text);

    return {
      output,
      artifactDrafts,
      tokensUsed: result.usage?.totalTokens ?? 0,
    };
  }
}

function buildBrainArtifacts(
  node: DeepResearchNode,
  output: Record<string, unknown>,
  rawText: string,
): ActorArtifactDraft[] {
  const artifactType = getArtifactTypeForNode(node.nodeType);
  if (!artifactType) return [];

  let content = output;
  if (node.nodeType === "final_report") {
    const reportText = (output.messageToUser as string)
      || (output.report as string)
      || (output.text as string)
      || rawText;
    content = { report: reportText, ...output };
  }

  const provenance: ArtifactProvenance = {
    sourceNodeId: node.id,
    sourceArtifactIds: [],
    model: node.assignedModel || "unknown",
    generatedAt: new Date().toISOString(),
  };

  return [{
    artifactType,
    title: node.label,
    content,
    provenance,
  }];
}

async function createArtifacts(
  sessionId: string,
  nodeId: string,
  drafts: ActorArtifactDraft[],
) {
  const created = [];
  for (const draft of drafts) {
    created.push(await store.createArtifact(
      sessionId,
      nodeId,
      draft.artifactType,
      draft.title,
      draft.content,
      draft.provenance ?? undefined,
    ));
  }
  return created;
}

function getArtifactTypeForNode(nodeType: string): ArtifactType | null {
  const map: Record<string, ArtifactType> = {
    intake: "research_brief",
    plan: "task_graph",
    synthesize: "provisional_conclusion",
    validation_plan: "validation_plan",
    result_compare: "validation_report",
    final_report: "final_report",
  };
  return map[nodeType] ?? null;
}

function safeParseJson(text: string): Record<string, unknown> {
  try {
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : text.trim();
    return JSON.parse(jsonStr);
  } catch {
    return { text };
  }
}

function extractJsonFromText<T>(text: string): T {
  const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (fenceMatch) {
    return JSON.parse(fenceMatch[1].trim()) as T;
  }

  const firstBrace = text.indexOf("{");
  if (firstBrace >= 0) {
    let depth = 0;
    let inString = false;
    let escape = false;
    for (let i = firstBrace; i < text.length; i++) {
      const ch = text[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === "\"") { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      if (ch === "}") {
        depth--;
        if (depth === 0) {
          return JSON.parse(text.slice(firstBrace, i + 1)) as T;
        }
      }
    }
  }

  return JSON.parse(text.trim()) as T;
}
