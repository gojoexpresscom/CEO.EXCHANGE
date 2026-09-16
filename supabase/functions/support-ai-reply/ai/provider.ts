import { ChatTurn, ProviderError, ProviderErrorCategory, ProviderResult } from "./types.ts";

const DEFAULT_TIMEOUT_MS = 20000;

export function categorizeHttpStatus(status: number): ProviderErrorCategory {
  if (status === 429) return "RATE_LIMITED";
  if (status === 401 || status === 403) return "AUTH_ERROR";
  if (status === 400 || status === 404 || status === 422) return "BAD_REQUEST";
  if (status >= 500) return "PROVIDER_UNAVAILABLE";
  return "UNKNOWN_ERROR";
}

// fetch() with a timeout, translating network/timeout failures into a
// ProviderError so the router can always fall through to the next provider.
export async function fetchWithTimeout(
  providerName: string,
  input: string,
  init: RequestInit,
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ProviderError("TIMEOUT", `${providerName} request timed out after ${timeoutMs}ms`, providerName);
    }
    throw new ProviderError("NETWORK_ERROR", `${providerName} network error: ${String(err)}`, providerName);
  } finally {
    clearTimeout(timer);
  }
}

// Builds an OpenAI-compatible messages[] array (Groq / OpenRouter / Mistral
// all speak this shape) from our normalized system instruction + history.
export function buildOpenAiCompatibleMessages(systemInstruction: string, history: ChatTurn[]) {
  return [
    { role: "system", content: systemInstruction },
    ...history.map((turn) => ({
      role: turn.role === "model" ? "assistant" : "user",
      content: turn.text,
    })),
  ];
}

type OpenAiCompatibleCallArgs = {
  providerName: string;
  url: string;
  apiKey: string;
  model: string;
  systemInstruction: string;
  history: ChatTurn[];
  extraHeaders?: Record<string, string>;
  timeoutMs?: number;
};

// Shared caller for the OpenAI-Chat-Completions-compatible fallback
// providers (Groq, OpenRouter, Mistral). Gemini has its own native call in
// gemini.ts because its request/response shape (system_instruction,
// contents[], structured response_schema) is different.
export async function callOpenAiCompatibleChat(args: OpenAiCompatibleCallArgs): Promise<ProviderResult> {
  const { providerName, url, apiKey, model, systemInstruction, history, extraHeaders, timeoutMs } = args;

  const res = await fetchWithTimeout(
    providerName,
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...(extraHeaders || {}),
      },
      body: JSON.stringify({
        model,
        messages: buildOpenAiCompatibleMessages(systemInstruction, history),
        temperature: 0.4,
      }),
    },
    timeoutMs,
  );

  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    // Log for diagnostics only -- never surface raw provider error bodies to the caller.
    console.error(`${providerName}: request failed (status ${res.status}):`, bodyText);
    throw new ProviderError(
      categorizeHttpStatus(res.status),
      `${providerName} responded with status ${res.status}`,
      providerName,
    );
  }

  let data: any;
  try {
    data = await res.json();
  } catch {
    throw new ProviderError("UNKNOWN_ERROR", `${providerName} returned a non-JSON response`, providerName);
  }

  const text = data?.choices?.[0]?.message?.content;
  if (typeof text !== "string" || !text.trim()) {
    throw new ProviderError("UNKNOWN_ERROR", `${providerName} returned an empty completion`, providerName);
  }

  return { reply: text.trim(), providerName, model };
}
