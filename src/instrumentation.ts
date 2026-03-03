export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Set up HTTP proxy for all fetch() calls (AI SDK, etc.)
    // Reads HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars automatically.
    const proxyUrl =
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy;
    if (proxyUrl) {
      const { setGlobalDispatcher, EnvHttpProxyAgent } = await import(
        "undici"
      );
      setGlobalDispatcher(new EnvHttpProxyAgent());
    }

    // Run database migrations
    const { runMigrations } = await import("@/lib/db/migrate");
    runMigrations();
  }
}
