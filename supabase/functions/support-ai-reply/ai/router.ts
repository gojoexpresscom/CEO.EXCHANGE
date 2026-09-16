import { AIProvider, ProviderError, ProviderRequest, ProviderResult } from "./types.ts";

// Tries providers in order, falling through to the next one on transient
// failures (rate limits, timeouts, network errors, provider outages, auth
// errors). Does NOT call every provider for every request -- it stops as
// soon as one succeeds. A BAD_REQUEST is treated as non-retryable, since it
// indicates a problem with how we built the request rather than a transient
// provider issue, and retrying the same broken request against every other
// provider would not help.
export async function generateSupportReply(
  req: ProviderRequest,
  providers: AIProvider[],
): Promise<ProviderResult> {
  let lastError: ProviderError | null = null;

  for (const provider of providers) {
    if (!provider.isConfigured()) continue;

    try {
      return await provider.generateReply(req);
    } catch (err) {
      const providerError =
        err instanceof ProviderError ? err : new ProviderError("UNKNOWN_ERROR", String(err), provider.name);

      // Log category + safe message only -- never provider secret values.
      console.error(
        `ai-router: ${providerError.providerName} failed [${providerError.category}]: ${providerError.message}`,
      );
      lastError = providerError;

      if (providerError.category === "BAD_REQUEST") {
        throw providerError;
      }
      // RATE_LIMITED, TIMEOUT, NETWORK_ERROR, PROVIDER_UNAVAILABLE, AUTH_ERROR,
      // UNKNOWN_ERROR: fall through and try the next provider.
    }
  }

  throw lastError ?? new ProviderError("PROVIDER_UNAVAILABLE", "No AI providers are configured", "router");
}
