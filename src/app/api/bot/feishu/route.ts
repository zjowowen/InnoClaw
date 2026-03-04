/**
 * Feishu bot webhook endpoint.
 *
 * Receives event callbacks from Feishu (Lark), including:
 * - URL verification challenges
 * - Text and file messages
 * - Slash commands (/workspace, /status, /clear, /help, /mode)
 *
 * When a workspace is bound to the chat, text messages are routed through
 * the full agent pipeline with tool support. Otherwise, falls back to
 * simple AI chat via the unified bot processor.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFeishuConfig } from "@/lib/bot/types";
import { createFeishuAdapter } from "@/lib/bot/feishu/client";
import { processMessage, sendReplies } from "@/lib/bot/processor";
import { parseAndHandleCommand } from "@/lib/bot/feishu/commands";
import { processAgentMessage } from "@/lib/bot/feishu/agent-processor";
import {
  getChatState,
  acquireProcessingLock,
  releaseProcessingLock,
} from "@/lib/bot/feishu/state";

/** Simple in-memory set to deduplicate Feishu event re-deliveries (TTL 5min) */
const processedEvents = new Map<string, number>();
const EVENT_TTL = 5 * 60 * 1000;

function isDuplicateEvent(eventId: string): boolean {
  // Clean expired entries
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > EVENT_TTL) processedEvents.delete(id);
  }
  if (processedEvents.has(eventId)) return true;
  processedEvents.set(eventId, now);
  return false;
}

export async function POST(req: NextRequest) {
  const config = getFeishuConfig();
  const adapter = createFeishuAdapter(config);

  if (!adapter.isEnabled()) {
    return NextResponse.json(
      { error: "Feishu bot is not enabled" },
      { status: 503 }
    );
  }

  try {
    const rawBody = await req.text();
    const body = JSON.parse(rawBody) as Record<string, unknown>;

    // Verify webhook token from body (Feishu uses body-embedded tokens)
    if (!adapter.verifyWebhook({}, rawBody)) {
      console.warn("[feishu-webhook] Webhook verification failed");
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 403 }
      );
    }

    // Handle URL verification challenge
    if (body.type === "url_verification") {
      const challenge = body.challenge as string;
      console.log("[feishu-webhook] URL verification challenge received");
      return NextResponse.json({ challenge });
    }

    // Deduplicate events (Feishu may re-deliver on slow response)
    const header = body.header as Record<string, unknown> | undefined;
    const eventId = (header?.event_id as string) || "";
    if (eventId && isDuplicateEvent(eventId)) {
      console.log(`[feishu-webhook] Duplicate event ${eventId}, skipping`);
      return NextResponse.json({ ok: true });
    }

    // Parse messages
    const messages = adapter.parseMessages(body);

    if (messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Process messages asynchronously (don't block the webhook response).
    // Feishu requires a quick response to acknowledge receipt.
    for (const message of messages) {
      (async () => {
        try {
          console.log(
            `[feishu-webhook] Processing ${message.type} message from ${message.senderId}`
          );

          // --- Text messages: check for commands or agent processing ---
          if (message.type === "text") {
            // 1. Check for slash commands (/workspace, /status, etc.)
            const cmdResult = await parseAndHandleCommand(
              message.chatId,
              message.text
            );
            if (cmdResult.handled) {
              if (cmdResult.card && adapter.sendInteractiveCard) {
                await adapter.sendInteractiveCard(message.chatId, cmdResult.card);
              } else if (cmdResult.text) {
                await adapter.sendText(message.chatId, cmdResult.text);
              }
              return;
            }

            // 2. Check if workspace is bound for agent processing
            const state = getChatState(message.chatId);
            if (state.workspacePath) {
              // Acquire processing lock to prevent concurrent agent executions
              if (!acquireProcessingLock(message.chatId)) {
                await adapter.sendText(
                  message.chatId,
                  "I'm still processing your previous request. Please wait."
                );
                return;
              }

              try {
                await processAgentMessage({
                  adapter,
                  chatId: message.chatId,
                  userMessage: message.text,
                  workspacePath: state.workspacePath,
                  mode: state.mode,
                });
              } finally {
                releaseProcessingLock(message.chatId);
              }
              return;
            }

            // 3. No workspace bound — fall back to simple AI chat
          }

          // --- File messages or text without workspace: use simple processor ---
          const replies = await processMessage(adapter, message);
          await sendReplies(adapter, message.chatId, replies);
        } catch (error) {
          console.error("[feishu-webhook] Async processing error:", error);
          try {
            await adapter.sendText(
              message.chatId,
              `Error: ${error instanceof Error ? error.message : "Unknown error"}`
            );
          } catch {
            // Last resort — log only
          }
        }
      })();
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[feishu-webhook] Error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
