import { NextRequest } from "next/server";
import { streamText, convertToModelMessages, UIMessage } from "ai";
import { getConfiguredModelWithProvider, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { modelSupportsVision, providerSupportsTools } from "@/lib/ai/models";
import { buildPaperChatPrompt, buildPaperChatWithNotesPrompt } from "@/lib/ai/prompts";
import { createPaperChatTools } from "@/lib/ai/tools/paper-chat-tools";
import { buildPaperChatContextMessage, buildPaperModelContext } from "../paper-model-context";

export async function POST(req: NextRequest) {
  try {
    const { messages: uiMessages, article, relatedNotes, llmProvider, llmModel } = await req.json();

    if (!article || !article.title) {
      return new Response("Missing article data", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set OPENAI_API_KEY or ANTHROPIC_API_KEY in .env.local.",
        { status: 503 }
      );
    }

    let providerId: string;
    let modelId: string | undefined;
    let model;
    if (llmProvider && llmModel) {
      const override = getModelFromOverride(llmProvider, llmModel);
      model = override.model;
      providerId = llmProvider;
      modelId = llmModel;
    } else {
      const configured = await getConfiguredModelWithProvider();
      model = configured.model;
      providerId = configured.providerId;
      modelId = configured.modelId;
    }

    const supportsVision = modelSupportsVision(providerId, modelId);
    const articleData = {
      title: article.title,
      authors: Array.isArray(article.authors) ? article.authors : [],
      publishedDate: article.publishedDate || "",
      source: article.source || "",
      abstract: article.abstract || "",
    };

    // Use enhanced prompt if related notes are available
    const systemPrompt =
      relatedNotes && Array.isArray(relatedNotes) && relatedNotes.length > 0
        ? buildPaperChatWithNotesPrompt(articleData, relatedNotes)
        : buildPaperChatPrompt(articleData);

    const modelMessages = await convertToModelMessages(
      uiMessages as UIMessage[]
    );

    const paperContext = await buildPaperModelContext(article, supportsVision);
    const paperContextMessage = buildPaperChatContextMessage(
      { title: article.title },
      paperContext,
      supportsVision,
    );

    const groundedMessages = paperContextMessage
      ? [paperContextMessage, ...modelMessages]
      : modelMessages;

    // Create paper tools for fetching full text and figures
    const paperTools = createPaperChatTools({
      id: article.id || "",
      url: article.url || "",
      pdfUrl: article.pdfUrl,
      source: article.source || "",
    });

    const useTools = providerSupportsTools(providerId);

    const result = streamText({
      model,
      system: systemPrompt,
      messages: groundedMessages,
      ...(useTools ? { tools: paperTools, maxSteps: 5 } : {}),
      abortSignal: req.signal,
      onError({ error }) {
        console.error("Paper chat stream error:", error);
      },
    });

    return result.toUIMessageStreamResponse();
  } catch (error) {
    console.error("Paper chat error:", error);
    return new Response(
      error instanceof Error ? error.message : "Chat failed",
      { status: 500 }
    );
  }
}
