import { AIProvider, ChatTurn, ProviderError, ProviderRequest, ProviderResult } from "./types.ts";
import { categorizeHttpStatus } from "./provider.ts";

// Primary model first, then fallbacks used only if the primary is
// overloaded (503) or over quota (429) after retries. Google's "high
// demand" errors are usually model-specific, so a different model often
// succeeds even when the primary one is struggling.
// gemini-flash-latest is Google's rolling alias for their current
// recommended flash model -- kept last so it never goes stale the way a
// pinned version number eventually will.
const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.6-flash", "gemini-flash-latest"];
const ATTEMPTS_PER_MODEL = 2;

function toGeminiContents(history: ChatTurn[]) {
  return history.map((turn) => ({
    role: turn.role,
    parts: [{ text: turn.text }],
  }));
}

export function createGeminiProvider(apiKey: string | undefined): AIProvider {
  return {
    name: "gemini",
    isConfigured: () => !!apiKey,

    async generateReply(req: ProviderRequest): Promise<ProviderResult> {
      if (!apiKey) {
        throw new ProviderError("AUTH_ERROR", "GEMINI_API_KEY is not configured", "gemini");
      }

      const requestBody = JSON.stringify({
        system_instruction: { parts: [{ text: req.systemInstruction }] },
        contents: toGeminiContents(req.history),
        generationConfig: {
          response_mime_type: "application/json",
          response_schema: {
            type: "OBJECT",
            properties: { reply: { type: "STRING" } },
            required: ["reply"],
          },
        },
      });

      // Try each model in order. Each model gets its own short retry loop
      // with backoff for transient (503) errors; a 429 (quota) on a model is
      // treated as non-retryable for that model but we still fall through to
      // try the next model in the list, since quotas are often tracked
      // per-model.
      let res: Response | undefined;
      let lastErrBody = "";
      let lastStatus = 0;
      let anyQuotaExceeded = false;
      let usedModel = "";

      outer:
      for (const model of GEMINI_MODELS) {
        for (let attempt = 1; attempt <= ATTEMPTS_PER_MODEL; attempt++) {
          try {
            res = await fetch(
              `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
                body: requestBody,
              },
            );
          } catch (err) {
            lastErrBody = String(err);
            console.error(`gemini: network error (model=${model}, attempt=${attempt}):`, lastErrBody);
            res = undefined;
            continue;
          }

          if (res.ok) {
            usedModel = model;
            break outer;
          }

          lastStatus = res.status;
          lastErrBody = await res.text().catch(() => "");

          if (res.status === 429) {
            anyQuotaExceeded = true;
            console.error(
              `gemini: QUOTA EXCEEDED (model=${model}, attempt=${attempt}/${ATTEMPTS_PER_MODEL}). Falling through to next model if any. Check the GEMINI_API_KEY project's plan at https://ai.dev/rate-limit:`,
              lastErrBody,
            );
            break; // don't retry the same model on quota; move to next model
          }

          const transient = res.status === 503;
          console.error(
            `gemini: call failed (model=${model}, status=${res.status}, attempt=${attempt}/${ATTEMPTS_PER_MODEL}):`,
            lastErrBody,
          );
          if (!transient || attempt === ATTEMPTS_PER_MODEL) break; // move to next model
          await new Promise((r) => setTimeout(r, attempt * 500));
        }
      }

      if (!res || !res.ok) {
        if (anyQuotaExceeded) {
          throw new ProviderError("RATE_LIMITED", "Gemini quota exceeded across all models", "gemini");
        }
        const category = lastStatus ? categorizeHttpStatus(lastStatus) : "NETWORK_ERROR";
        throw new ProviderError(
          category,
          `Gemini request failed (status ${lastStatus || 0}): ${lastErrBody}`,
          "gemini",
        );
      }

      if (usedModel !== GEMINI_MODELS[0]) {
        console.error(`gemini: primary model unavailable, served by fallback model=${usedModel}`);
      }

      const data = await res.json();
      const textOut = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      let parsed: { reply?: string } = {};
      try {
        parsed = JSON.parse(textOut ?? "{}");
      } catch {
        console.error("gemini: could not parse structured output:", textOut);
      }

      // Preserve prior behavior: fall back to the raw text if structured
      // parsing fails, rather than discarding a usable answer.
      const reply = (parsed.reply || textOut || "").trim();
      if (!reply) {
        throw new ProviderError("UNKNOWN_ERROR", "Gemini returned an empty reply", "gemini");
      }

      return { reply, providerName: "gemini", model: usedModel };
    },
  };
}
