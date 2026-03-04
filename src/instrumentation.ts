/**
 * Next.js instrumentation — runs once when the server starts.
 *
 * Used to initialise long-running services that must live alongside
 * the Next.js process, such as the Feishu WebSocket client.
 */

export async function register() {
  // Only start server-side services in the Node.js runtime (not Edge)
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startFeishuWSClient } = await import(
      "@/lib/bot/feishu/ws-client"
    );
    startFeishuWSClient();
  }
}
