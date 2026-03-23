import { generateText } from "ai";
import { getModelChainForRole, checkBudget, trackUsage } from "./model-router";
import * as store from "./event-store";
import { buildMainBrainSystemPrompt } from "./prompts";
import type {
  DeepResearchSession,
  BrainDecision,
  RequirementState,
} from "./types";

export async function buildNodeContext(sessionId: string) {
  const session = (await store.getSession(sessionId))!;
  const messages = await store.getMessages(sessionId);
  const allNodes = await store.getNodes(sessionId);
  const allArtifacts = await store.getArtifacts(sessionId);
  return { session, messages, allNodes, allArtifacts };
}

export async function callMainBrain(
  session: DeepResearchSession,
  abortSignal?: AbortSignal,
  requirementState?: RequirementState | null,
  languageHint?: string,
  workstationContext?: string | null,
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

  const modelChain = getModelChainForRole("main_brain", session.config);
  let systemPrompt = buildMainBrainSystemPrompt(
    session,
    messages,
    nodes,
    artifacts,
    session.contextTag,
    requirementState,
    workstationContext,
  );

  if (!languageHint) {
    const userMessages = messages.filter((message) => message.role === "user");
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

  let lastError: Error | null = null;
  for (const { model, provider, modelId } of modelChain) {
    try {
      const result = await generateText({
        model,
        system: systemPrompt,
        messages: [{ role: "user", content: userMsg }],
        abortSignal,
      });

      const budget = trackUsage(session.budget, "main_brain", `brain_${session.contextTag}`, result.usage?.totalTokens ?? 0);
      await store.updateSession(session.id, { budget });

      try {
        return extractJsonFromLLMResponse<BrainDecision>(result.text);
      } catch {
        return { action: "respond_to_user", messageToUser: result.text };
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.warn(`[callMainBrain] ${provider}/${modelId} failed: ${lastError.message}. Trying next model...`);
    }
  }

  throw lastError ?? new Error("No available model for main_brain");
}

function extractJsonFromLLMResponse<T>(text: string): T {
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
