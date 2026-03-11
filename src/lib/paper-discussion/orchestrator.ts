import { generateText } from "ai";
import type { LanguageModel } from "ai";
import type {
  DiscussionTurn,
  PaperDiscussionSharedContext,
  PaperDiscussionSessionState,
} from "./types";
import { DISCUSSION_STAGES, DISCUSSION_AGENTS } from "./roles";
import { buildDiscussionPrompt } from "./prompts";

// =============================================================
// TOKEN LIMITS per stage by mode
// =============================================================
const MAX_TOKENS: Record<"quick" | "full", number> = {
  quick: 800,
  full: 2000,
};

// =============================================================
// Run a single discussion stage
// =============================================================
export async function runPaperDiscussionStage(
  state: PaperDiscussionSessionState,
  model: LanguageModel,
  abortSignal?: AbortSignal,
): Promise<DiscussionTurn> {
  const stage = state.stages[state.currentStageIndex];
  if (!stage) {
    throw new Error(`No stage at index ${state.currentStageIndex}`);
  }

  const agentConfig = DISCUSSION_AGENTS[stage.roleId];
  const systemPrompt = buildDiscussionPrompt(
    agentConfig,
    state.context,
    state.transcript,
    stage.id,
  );

  const result = await generateText({
    model,
    system: systemPrompt,
    prompt: `Begin your analysis of the paper "${state.context.article.title}".`,
    maxOutputTokens: MAX_TOKENS[state.context.mode],
    abortSignal,
  });

  return {
    stageId: stage.id,
    roleId: stage.roleId,
    content: result.text,
    timestamp: new Date().toISOString(),
  };
}

// =============================================================
// Run the full 6-stage discussion
// =============================================================
export async function runFullPaperDiscussion(
  context: PaperDiscussionSharedContext,
  model: LanguageModel,
  onTurnComplete: (turn: DiscussionTurn) => void,
  abortSignal?: AbortSignal,
): Promise<DiscussionTurn[]> {
  const state: PaperDiscussionSessionState = {
    id: "",
    context,
    stages: DISCUSSION_STAGES,
    currentStageIndex: 0,
    transcript: [],
    report: null,
    status: "running",
  };

  for (let i = 0; i < DISCUSSION_STAGES.length; i++) {
    if (abortSignal?.aborted) break;

    state.currentStageIndex = i;

    const turn = await runPaperDiscussionStage(state, model, abortSignal);

    state.transcript.push(turn);
    onTurnComplete(turn);
  }

  state.status = "completed";
  return state.transcript;
}
