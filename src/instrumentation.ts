export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Set up HTTP proxy for all fetch() calls (AI SDK, etc.)
    // Reads HTTP_PROXY, HTTPS_PROXY, NO_PROXY env vars automatically.
    // proxyTunnel: false  →  use regular HTTP forward proxying for http:// targets
    //   instead of CONNECT tunneling. Many proxies restrict CONNECT to port 443,
    //   which causes 403 errors when the AI API endpoint is plain HTTP.
    //   HTTPS targets still use CONNECT tunneling as expected.
    const proxyUrl =
      process.env.HTTP_PROXY ||
      process.env.HTTPS_PROXY ||
      process.env.http_proxy ||
      process.env.https_proxy;
    if (proxyUrl) {
      const { setGlobalDispatcher, EnvHttpProxyAgent } = await import(
        "undici"
      );
      setGlobalDispatcher(new EnvHttpProxyAgent({ proxyTunnel: false }));
    }

    // Run database migrations
    const { runMigrations } = await import("@/lib/db/migrate");
    runMigrations();
  }
}
