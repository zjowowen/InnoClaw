import { providerSupportsTools } from "./models";
import { getCurrentEnv } from "./provider-env";

/**
 * Determine whether tool calling should be enabled at runtime.
 *
 * Providers keep their default capability from PROVIDERS.
 * A provider-specific env var can explicitly override it:
 *   - `<PROVIDER>_TOOLS_ENABLED=true`
 *   - `<PROVIDER>_TOOLS_ENABLED=false`
 */
export function runtimeProviderSupportsTools(providerId: string): boolean {
  const env = getCurrentEnv();
  const override = env[`${providerId.toUpperCase()}_TOOLS_ENABLED`];
  if (override === "true") return true;
  if (override === "false") return false;
  return providerSupportsTools(providerId);
}
