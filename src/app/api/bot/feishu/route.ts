/**
 * Feishu bot webhook endpoint.
 *
 * Receives event callbacks from Feishu (Lark), including:
 * - URL verification challenges
 * - Text and file messages
 *
 * Processes messages through the unified bot processor and replies
 * via the Feishu API.
 */

import { NextRequest, NextResponse } from "next/server";
import { getFeishuConfig } from "@/lib/bot/types";
import { createFeishuAdapter } from "@/lib/bot/feishu/client";
import { processMessage, sendReplies } from "@/lib/bot/processor";

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

    // Handle URL verification challenge
    if (body.type === "url_verification") {
      const challenge = body.challenge as string;
      console.log("[feishu-webhook] URL verification challenge received");
      return NextResponse.json({ challenge });
    }

    // Verify webhook authenticity
    const headers: Record<string, string> = {};
    req.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    if (!adapter.verifyWebhook(headers, rawBody)) {
      console.warn("[feishu-webhook] Webhook verification failed");
      return NextResponse.json(
        { error: "Verification failed" },
        { status: 403 }
      );
    }

    // Parse messages
    const messages = adapter.parseMessages(body);

    if (messages.length === 0) {
      return NextResponse.json({ ok: true });
    }

    // Process messages asynchronously (don't block the webhook response)
    // Feishu requires a quick response to acknowledge receipt.
    for (const message of messages) {
      // Use setImmediate-style to not block the response
      (async () => {
        try {
          console.log(
            `[feishu-webhook] Processing ${message.type} message from ${message.senderId}`
          );
          const replies = await processMessage(adapter, message);
          await sendReplies(adapter, message.chatId, replies);
        } catch (error) {
          console.error("[feishu-webhook] Async processing error:", error);
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
