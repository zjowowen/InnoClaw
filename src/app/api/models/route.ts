import { NextRequest, NextResponse } from "next/server";
import { PROVIDERS } from "@/lib/ai/models";
import {
  getCurrentEnv,
  getDiscoveredPerModelBaseUrls,
  getVendorBaseUrlEnvKey,
  isPerModelBaseUrlProvider,
} from "@/lib/ai/provider-env";

/**
 * Fetch available models from the configured provider's API.
 *
 * OpenAI-compatible services expose GET /v1/models (or /models when
 * OPENAI_BASE_URL already includes "/v1").
 * Anthropic exposes GET /v1/models.
 *
 * Query params:
 *   provider – "openai" | "anthropic" (default: "openai")
 */
export async function GET(request: NextRequest) {
  const provider =
    request.nextUrl.searchParams.get("provider") || "openai";

  try {
    if (provider === "anthropic") {
      return await fetchAnthropicModels();
    }
    if (provider === "openai") {
      return await fetchOpenAICompatibleProviderModels("openai", {
        defaultBaseUrl: "https://api.openai.com/v1",
        requireApiKey: true,
      });
    }
    if (provider === "gemini") {
      return await fetchOpenAICompatibleProviderModels("gemini", {
        requireApiKey: true,
      });
    }
    if (provider in PROVIDERS && isPerModelBaseUrlProvider(provider)) {
      return await fetchOpenAICompatiblePerModelProviderModels(provider);
    }
    return NextResponse.json(
      { error: `Unsupported provider "${provider}"` },
      { status: 400 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch models";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/* ------------------------------------------------------------------ */
/*  OpenAI-compatible                                                  */
/* ------------------------------------------------------------------ */

function buildOpenAIModelsUrl(baseUrl: string) {
  const trimmed = baseUrl.replace(/\/+$/, "");
  return trimmed.endsWith("/v1")
    ? `${trimmed}/models`
    : `${trimmed}/v1/models`;
}

async function fetchModelsFromOpenAICompatibleBaseUrl(
  baseUrl: string,
  apiKey?: string,
) {
  const modelsUrl = buildOpenAIModelsUrl(baseUrl);
  const headers = apiKey ? { Authorization: `Bearer ${apiKey}` } : undefined;

  const res = await fetch(modelsUrl, {
    ...(headers ? { headers } : {}),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Provider returned ${res.status}`);
  }

  const json = await res.json();
  return formatOpenAIModels(json);
}

async function fetchOpenAICompatibleProviderModels(
  providerId: "openai" | "gemini",
  options: {
    defaultBaseUrl?: string;
    requireApiKey: boolean;
  },
) {
  const env = getCurrentEnv();
  const apiKey = env[PROVIDERS[providerId].envKey];
  if (options.requireApiKey && !apiKey) {
    return NextResponse.json(
      { error: `${PROVIDERS[providerId].envKey} is not configured` },
      { status: 400 },
    );
  }

  const baseUrl =
    env[getVendorBaseUrlEnvKey(providerId)] || options.defaultBaseUrl;
  if (!baseUrl) {
    return NextResponse.json(
      { error: `${getVendorBaseUrlEnvKey(providerId)} is not configured` },
      { status: 400 },
    );
  }

  const models = await fetchModelsFromOpenAICompatibleBaseUrl(baseUrl, apiKey);
  return NextResponse.json({ models });
}

async function fetchOpenAICompatiblePerModelProviderModels(providerId: string) {
  const env = getCurrentEnv();
  const apiKey = env[PROVIDERS[providerId as keyof typeof PROVIDERS].envKey];
  const vendorBaseUrl = env[getVendorBaseUrlEnvKey(providerId)]?.trim();
  const discovered = getDiscoveredPerModelBaseUrls(providerId, env);

  const baseUrls = Array.from(
    new Set(
      [
        ...(vendorBaseUrl ? [vendorBaseUrl] : []),
        ...discovered.map((entry) => entry.baseUrl),
      ].filter(Boolean),
    ),
  );

  if (baseUrls.length === 0) {
    return NextResponse.json(
      {
        error:
          `${getVendorBaseUrlEnvKey(providerId)} or ` +
          `${providerId.toUpperCase()}_*_BASE_URL is not configured`,
      },
      { status: 400 },
    );
  }

  const settled = await Promise.allSettled(
    baseUrls.map((baseUrl) =>
      fetchModelsFromOpenAICompatibleBaseUrl(baseUrl, apiKey),
    ),
  );

  const merged = new Map<string, { id: string; name: string }>();
  const errors: string[] = [];

  for (const result of settled) {
    if (result.status === "fulfilled") {
      for (const model of result.value) {
        merged.set(model.id, model);
      }
      continue;
    }
    errors.push(
      result.reason instanceof Error
        ? result.reason.message
        : "Failed to fetch models",
    );
  }

  if (merged.size === 0 && errors.length > 0) {
    return NextResponse.json({ error: errors[0] }, { status: 502 });
  }

  const models = Array.from(merged.values()).sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  return NextResponse.json({ models });
}

/**
 * Parse the standard OpenAI /v1/models response into a flat list.
 */
function formatOpenAIModels(json: {
  data?: Array<{ id: string; owned_by?: string }>;
}) {
  if (!Array.isArray(json.data)) return [];
  return json.data
    .map((m) => ({ id: m.id, name: m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ */
/*  Anthropic                                                          */
/* ------------------------------------------------------------------ */

async function fetchAnthropicModels() {
  const env = getCurrentEnv();
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured" },
      { status: 400 },
    );
  }

  const rawBase = env.ANTHROPIC_BASE_URL;
  let baseUrl = rawBase
    ? rawBase.replace(/\/+$/, "")
    : "https://api.anthropic.com";

  // Normalize: ensure base does NOT end with /v1 for Anthropic
  if (baseUrl.endsWith("/v1")) {
    baseUrl = baseUrl.slice(0, -3);
  }

  const modelsUrl = `${baseUrl}/v1/models`;

  const res = await fetch(modelsUrl, {
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Provider returned ${res.status}` },
      { status: 502 },
    );
  }

  const json = await res.json();
  const models = formatAnthropicModels(json);

  return NextResponse.json({ models });
}

/**
 * Parse Anthropic /v1/models response.
 * Anthropic returns { data: [{ id, display_name, ... }] }
 */
function formatAnthropicModels(json: {
  data?: Array<{ id: string; display_name?: string }>;
}) {
  if (!Array.isArray(json.data)) return [];
  return json.data
    .map((m) => ({ id: m.id, name: m.display_name || m.id }))
    .sort((a, b) => a.id.localeCompare(b.id));
}
