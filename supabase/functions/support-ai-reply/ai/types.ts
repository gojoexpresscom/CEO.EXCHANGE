// AI provider abstraction shared types for the support-ai-reply router.
// No secrets live in this file.

export type ProviderErrorCategory =
  | "RATE_LIMITED"
  | "TIMEOUT"
  | "NETWORK_ERROR"
  | "PROVIDER_UNAVAILABLE"
  | "AUTH_ERROR"
  | "BAD_REQUEST"
  | "UNKNOWN_ERROR";

export class ProviderError extends Error {
  category: ProviderErrorCategory;
  providerName: string;

  constructor(category: ProviderErrorCategory, message: string, providerName: string) {
    super(message);
    this.name = "ProviderError";
    this.category = category;
    this.providerName = providerName;
  }
}

// One turn of prior conversation, already normalized from ticket_messages.
export type ChatTurn = {
  role: "user" | "model";
  text: string;
};

export type ProviderRequest = {
  systemInstruction: string;
  history: ChatTurn[];
};

export type ProviderResult = {
  reply: string;
  providerName: string;
  model: string;
};

export interface AIProvider {
  name: string;
  isConfigured(): boolean;
  generateReply(req: ProviderRequest): Promise<ProviderResult>;
}
