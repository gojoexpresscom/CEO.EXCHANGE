import { AIProvider, ProviderError, ProviderRequest, ProviderResult } from "./types.ts";
import { callOpenAiCompatibleChat } from "./provider.ts";

// OpenRouter uses an OpenAI-compatible Chat Completions API.
// https://openrouter.ai/api/v1/chat/completions
const DEFAULT_MODEL = "meta-llama/llama-3.3-70b-instruct";

export function createOpenRouterProvider(apiKey: string | undefined): AIProvider {
  const model = Deno.env.get("OPENROUTER_MODEL") || DEFAULT_MODEL;

  return {
    name: "openrouter",
    isConfigured: () => !!apiKey,

    async generateReply(req: ProviderRequest): Promise<ProviderResult> {
      if (!apiKey) {
        throw new ProviderError("AUTH_ERROR", "OPENROUTER_API_KEY is not configured", "openrouter");
      }
      return callOpenAiCompatibleChat({
        providerName: "openrouter",
        url: "https://openrouter.ai/api/v1/chat/completions",
        apiKey,
        model,
        systemInstruction: req.systemInstruction,
        history: req.history,
        // Optional attribution headers OpenRouter recommends; harmless if omitted.
        extraHeaders: {
          "HTTP-Referer": "https://ceo-exchange.vercel.app",
          "X-Title": "CEO Exchange Support AI",
        },
      });
    },
  };
}
