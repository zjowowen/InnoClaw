/**
 * Feishu WebSocket long-connection client.
 *
 * Uses @larksuiteoapi/node-sdk WSClient to maintain a persistent WebSocket
 * connection with Feishu, receiving events in real-time instead of through
 * HTTP webhooks.
 *
 * Started once via `startFeishuWSClient()` in instrumentation.ts when the
 * Next.js server boots.
 */

import * as lark from "@larksuiteoapi/node-sdk";
import { getFeishuConfig, type BotAdapter } from "../types";
import { createFeishuAdapter } from "./client";
import { parseAndHandleCommand } from "./commands";
import { processAgentMessage } from "./agent-processor";
import { processMessage, sendReplies } from "../processor";
import {
  getChatState,
  acquireProcessingLock,
  releaseProcessingLock,
} from "./state";

// ---------------------------------------------------------------------------
// Singleton guard (survives HMR in dev)
// ---------------------------------------------------------------------------

// Use globalThis to prevent multiple WSClient instances during Next.js HMR
const globalForFeishu = globalThis as unknown as {
  __feishuWsStarted?: boolean;
};

// ---------------------------------------------------------------------------
// Message handler — shared logic for processing a single Feishu message
// ---------------------------------------------------------------------------

async function handleMessage(
  adapter: BotAdapter,
  message: import("../types").BotMessage
): Promise<void> {
  try {
    console.log(
      `[feishu-ws] Processing ${message.type} message from ${message.senderId}`
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
    console.error("[feishu-ws] Message processing error:", error);
    try {
      await adapter.sendText(
        message.chatId,
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } catch {
      // Last resort — log only
    }
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Start the Feishu WSClient long connection.
 *
 * Safe to call multiple times — only the first call creates the connection.
 * Uses globalThis to survive Next.js HMR reloads in development.
 */
export function startFeishuWSClient(): void {
  if (globalForFeishu.__feishuWsStarted) {
    console.log("[feishu-ws] WSClient already started, skipping");
    return;
  }

  const config = getFeishuConfig();

  if (!config.enabled || !config.appId || !config.appSecret) {
    console.log("[feishu-ws] Feishu bot not enabled or missing credentials, skipping WSClient");
    return;
  }

  // Create adapter for sending messages (uses lark.Client internally)
  const adapter = createFeishuAdapter(config);

  // Create WSClient for receiving events via WebSocket
  const wsClient = new lark.WSClient({
    appId: config.appId,
    appSecret: config.appSecret,
    domain: lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.info,
  });

  // Create EventDispatcher and register message handler
  const eventDispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      // WSClient event data is the "event" portion directly:
      //   { sender: {...}, message: {...}, event_id, ... }
      // Wrap it into the format that adapter.parseMessages() expects:
      //   { header: { event_type, token }, event: {...} }
      const body = {
        header: {
          event_type: "im.message.receive_v1",
          token: config.verificationToken,
        },
        event: data,
      };

      const messages = adapter.parseMessages(
        body as unknown as Record<string, unknown>
      );

      if (messages.length === 0) {
        console.log("[feishu-ws] No parseable messages in event");
        return;
      }

      // Process each message (fire-and-forget, don't block the event loop)
      for (const message of messages) {
        handleMessage(adapter, message).catch((err) => {
          console.error("[feishu-ws] Unhandled error in handleMessage:", err);
        });
      }
    },
  });

  // Start the WebSocket connection
  wsClient
    .start({ eventDispatcher })
    .then(() => {
      console.log("[feishu-ws] WSClient connected successfully");
    })
    .catch((err) => {
      console.error("[feishu-ws] WSClient failed to start:", err);
    });

  globalForFeishu.__feishuWsStarted = true;
  console.log("[feishu-ws] WSClient starting...");
}
