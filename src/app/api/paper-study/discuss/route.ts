import { NextRequest } from "next/server";
import { getConfiguredModelWithProvider, getModelFromOverride, isAIAvailable } from "@/lib/ai/provider";
import { modelSupportsVision } from "@/lib/ai/models";
import { runFullPaperDiscussion } from "@/lib/paper-discussion/orchestrator";
import { buildPaperModelContext } from "../paper-model-context";
import type { PaperDiscussionSharedContext, DiscussionTurn } from "@/lib/paper-discussion/types";

export async function POST(req: NextRequest) {
  try {
    const { article, mode = "quick", locale = "en", llmProvider, llmModel } = await req.json();

    if (!article || !article.title) {
      return new Response("Missing article data", { status: 400 });
    }

    if (mode !== "quick" && mode !== "full") {
      return new Response("Invalid mode, must be 'quick' or 'full'", { status: 400 });
    }

    if (!isAIAvailable()) {
      return new Response(
        "AI is not configured. Please set one of OPENAI_API_KEY, ANTHROPIC_API_KEY, GEMINI_API_KEY, or SHLAB_API_KEY in .env.local.",
        { status: 503 },
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
    const visionCapable = modelSupportsVision(providerId, modelId);

    const context: PaperDiscussionSharedContext = {
      article: {
        id: article.id || "",
        title: article.title,
        authors: Array.isArray(article.authors) ? article.authors : [],
        publishedDate: article.publishedDate || "",
        source: article.source || "",
        abstract: article.abstract || "",
      },
      supportsVision: visionCapable,
      locale,
      mode,
    };

    const paperContext = await buildPaperModelContext(article, visionCapable);
    context.paperContent = paperContext.paperContent;
    context.retrievedEvidence = paperContext.retrievedEvidence;

    // Stream each completed turn as a JSON line
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        try {
          // Emit paper page images as initial metadata line
          if (context.paperContent) {
            const pages = context.paperContent
              .filter((p) => p.type === "image")
              .map((p) => ({ pageNumber: p.pageNumber, data: p.data, mimeType: p.mimeType }));
            if (pages.length > 0) {
              controller.enqueue(encoder.encode(JSON.stringify({ type: "paper_pages", pages }) + "\n"));
            }
          }

          await runFullPaperDiscussion(
            context,
            model,
            (turn: DiscussionTurn) => {
              controller.enqueue(encoder.encode(JSON.stringify(turn) + "\n"));
            },
            req.signal,
          );
          controller.close();
        } catch (error) {
          if (req.signal.aborted) {
            controller.close();
            return;
          }
          console.error("Paper discussion error:", error);
          controller.error(error);
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    console.error("Paper discussion error:", error);
    return new Response(
      error instanceof Error ? error.message : "Discussion failed",
      { status: 500 },
    );
  }
}
