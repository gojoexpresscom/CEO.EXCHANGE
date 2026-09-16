import { AIProvider, ProviderError, ProviderRequest, ProviderResult } from "./types.ts";
import { callOpenAiCompatibleChat } from "./provider.ts";

// Groq uses an OpenAI-compatible Chat Completions API.
// https://api.groq.com/openai/v1/chat/completions
const DEFAULT_MODEL = "llama-3.3-70b-versatile";

export function createGroqProvider(apiKey: string | undefined): AIProvider {
  const model = Deno.env.get("GROQ_MODEL") || DEFAULT_MODEL;

  return {
    name: "groq",
    isConfigured: () => !!apiKey,

    async generateReply(req: ProviderRequest): Promise<ProviderResult> {
      if (!apiKey) {
        throw new ProviderError("AUTH_ERROR", "GROQ_API_KEY is not configured", "groq");
      }
      return callOpenAiCompatibleChat({
        providerName: "groq",
        url: "https://api.groq.com/openai/v1/chat/completions",
        apiKey,
        model,
        systemInstruction: req.systemInstruction,
        history: req.history,
      });
    },
  };
}
