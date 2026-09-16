import { AIProvider, ProviderError, ProviderRequest, ProviderResult } from "./types.ts";
import { callOpenAiCompatibleChat } from "./provider.ts";

// Mistral uses an OpenAI-compatible Chat Completions API.
// https://api.mistral.ai/v1/chat/completions
const DEFAULT_MODEL = "mistral-small-latest";

export function createMistralProvider(apiKey: string | undefined): AIProvider {
  const model = Deno.env.get("MISTRAL_MODEL") || DEFAULT_MODEL;

  return {
    name: "mistral",
    isConfigured: () => !!apiKey,

    async generateReply(req: ProviderRequest): Promise<ProviderResult> {
      if (!apiKey) {
        throw new ProviderError("AUTH_ERROR", "MISTRAL_API_KEY is not configured", "mistral");
      }
      return callOpenAiCompatibleChat({
        providerName: "mistral",
        url: "https://api.mistral.ai/v1/chat/completions",
        apiKey,
        model,
        systemInstruction: req.systemInstruction,
        history: req.history,
      });
    },
  };
}
