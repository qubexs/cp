import type {
  AttemptDetail,
  ModelChoice,
  Provider,
} from "./types";
import { MODELS } from "./types";

export interface ContentPart {
  type: string;
  text?: string;
  image_url?: { url: string };
  video_url?: { url: string };
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string | ContentPart[];
}

export const OPENROUTER_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions";

export const GOOGLE_GENERATE_CONTENT_ENDPOINT =
  "https://generativelanguage.googleapis.com/v1beta/models";

export const HUGGINGFACE_ENDPOINT =
  "https://router.huggingface.co/v1/chat/completions";

export class ProviderError extends Error {
  status: number;
  provider?: Provider;
  attempts?: AttemptDetail[];
  constructor(message: string, status: number, provider?: Provider) {
    super(message);
    this.name = "ProviderError";
    this.status = status;
    this.provider = provider;
  }
}

export interface ProviderConfig {
  id: Provider;
  label: string;
  short: string;
  keyPrefix: string;
  placeholder: string;
  hint: string;
  validate: (key: string) => boolean;
}

export const PROVIDERS: ProviderConfig[] = [
  {
    id: "openrouter",
    label: "OpenRouter",
    short: "OpenRouter",
    keyPrefix: "sk-or-v1-",
    placeholder: "sk-or-v1-...",
    hint: "Create a key at openrouter.ai/keys. Covers Google, OpenAI, Anthropic, Qwen, and more model providers.",
    validate: (k) => /^sk-or-v1-/i.test(k),
  },
  {
    id: "google",
    label: "Google (Gemini, AI Studio)",
    short: "Google",
    keyPrefix: "AIza",
    placeholder: "AIza...",
    hint: "Create a free key at aistudio.google.com/app/apikey. Serves Gemini 2.5 / 2.0 Flash directly.",
    validate: (k) => /^AIza[0-9A-Za-z_-]{20,}$/.test(k),
  },
  {
    id: "huggingface",
    label: "Hugging Face",
    short: "Hugging Face",
    keyPrefix: "hf_",
    placeholder: "hf_...",
    hint: "Create a read token at huggingface.co/settings/tokens. Serves hosted open-weight vision models via the HF Router.",
    validate: (k) => /^hf_[0-9A-Za-z]{10,}$/.test(k),
  },
];

export const PROVIDER_BY_ID: Record<Provider, ProviderConfig> = {
  openrouter: PROVIDERS[0],
  google: PROVIDERS[1],
  huggingface: PROVIDERS[2],
};

export function supportedProviders(model: ModelChoice): Provider[] {
  const entry = MODELS.find((m) => m.id === model);
  return entry ? [...entry.providers] : [];
}

export function isModelSupportedBy(provider: Provider, model: ModelChoice): boolean {
  return supportedProviders(model).includes(provider);
}

export function resolveModelId(provider: Provider, model: ModelChoice): string | null {
  const entry = MODELS.find((m) => m.id === model);
  if (!entry) return null;
  if (!(entry.providers as readonly Provider[]).includes(provider)) return null;
  if (provider === "openrouter") return model;
  if (provider === "google") return (entry as typeof entry & { googleId?: string }).googleId ?? null;
  if (provider === "huggingface") return (entry as typeof entry & { hfId?: string }).hfId ?? null;
  return null;
}

function splitDataUrl(url: string): { mime: string; data: string } | null {
  const m = /^data:([^,;]+);base64,([\s\S]+)$/.exec(url);
  return m ? { mime: m[1], data: m[2] } : null;
}

type GeminiPart = {
  text?: string;
  inline_data?: { mime_type: string; data: string };
};

function toGeminiParts(content: string | ContentPart[]): GeminiPart[] {
  const parts: GeminiPart[] = [];
  const push = (item: ContentPart) => {
    if (item.type === "text" && item.text) {
      parts.push({ text: item.text });
      return;
    }
    const url =
      item.type === "image_url"
        ? item.image_url?.url
        : item.type === "video_url"
          ? item.video_url?.url
          : undefined;
    if (!url) return;
    const parsed = splitDataUrl(url);
    if (parsed) parts.push({ inline_data: { mime_type: parsed.mime, data: parsed.data } });
    else if (/^https?:\/\//.test(url)) parts.push({ text: url });
  };

  if (typeof content === "string") {
    parts.push({ text: content });
  } else {
    for (const item of content) push(item);
  }
  return parts;
}

function parseError(res: Response, fallback: string): Promise<string> {
  return res
    .json()
    .then((err) => {
      const e = err?.error;
      if (typeof e === "string") return e;
      if (typeof e?.message === "string") return e.message;
      if (Array.isArray(err?.candidates)) return fallback;
      return fallback;
    })
    .catch(() => fallback);
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 300000
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new ProviderError(
        "Request timed out after 5 minutes. The file may be too large — try a smaller reference or a faster model.",
        0
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

async function callOpenRouter(
  apiKey: string,
  model: string,
  body: { messages: ChatMessage[]; temperature?: number; max_tokens?: number }
): Promise<{ content: string; model: string }> {
  const res = await fetchWithTimeout(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
      ...(typeof window !== "undefined"
        ? { "HTTP-Referer": window.location.origin, "X-Title": "Prompt Forge" }
        : {}),
    },
    body: JSON.stringify({ model, ...body }),
  });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      if (err?.error?.message) message = err.error.message;
      if (typeof err?.error?.code === "string") message = `${err.error.code}: ${message}`;
    } catch {
      /* ignore */
    }
    throw new ProviderError(message, res.status, "openrouter");
  }

  const data = await res.json();
  const contentString =
    data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
  if (!contentString) {
    throw new ProviderError(
      "The model returned an empty response. Try a different model or retry.",
      0,
      "openrouter"
    );
  }
  return { content: contentString.trim(), model: data?.model ?? model };
}

async function callGoogle(
  apiKey: string,
  model: string,
  body: { messages: ChatMessage[]; temperature?: number; max_tokens?: number }
): Promise<{ content: string; model: string }> {
  const { messages, temperature, max_tokens } = body;

  const system = messages.find((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");

  const contents = rest.map((m) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: toGeminiParts(m.content),
  }));

  const url =
    `${GOOGLE_GENERATE_CONTENT_ENDPOINT}/${encodeURIComponent(model)}:generateContent` +
    `?key=${encodeURIComponent(apiKey.trim())}`;

  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: system ? { parts: toGeminiParts(system.content) } : undefined,
      contents,
      generationConfig: {
        temperature: temperature ?? 0,
        maxOutputTokens: max_tokens ?? 4096,
      },
    }),
  });

  if (!res.ok) {
    const message = await parseError(res, `HTTP ${res.status}`);
    throw new ProviderError(message, res.status, "google");
  }

  const data = await res.json();

  if (data?.promptFeedback?.blockReason) {
    throw new ProviderError(
      `Request blocked by Google: ${data.promptFeedback.blockReason}`,
      0,
      "google"
    );
  }

  const contentString = (data?.candidates?.[0]?.content?.parts ?? [])
    .map((p: { text?: string }) => p?.text ?? "")
    .join("")
    .trim();

  if (!contentString) {
    throw new ProviderError(
      "The model returned an empty response. Try a different model or retry.",
      0,
      "google"
    );
  }

  const finish = data?.candidates?.[0]?.finishReason;
  if (typeof finish === "string" && finish !== "STOP") {
    throw new ProviderError(
      `Google generation stopped early (${finish}). Try again or use a shorter reference.`,
      0,
      "google"
    );
  }

  return { content: contentString, model: model };
}

async function callHuggingFace(
  apiKey: string,
  model: string,
  body: { messages: ChatMessage[]; temperature?: number; max_tokens?: number }
): Promise<{ content: string; model: string }> {
  const res = await fetchWithTimeout(HUGGINGFACE_ENDPOINT, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model, ...body }),
  });

  if (!res.ok) {
    const message = await parseError(res, `HTTP ${res.status}`);
    throw new ProviderError(message, res.status, "huggingface");
  }

  const data = await res.json();
  const contentString =
    data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";
  if (!contentString) {
    throw new ProviderError(
      "The model returned an empty response. Try a different model or retry.",
      0,
      "huggingface"
    );
  }
  return { content: contentString.trim(), model: data?.model ?? model };
}

export interface ProviderRequest {
  provider: Provider;
  apiKey: string;
  model: ModelChoice;
  body: { messages: ChatMessage[]; temperature?: number; max_tokens?: number };
}

export async function sendProviderRequest(params: ProviderRequest): Promise<{
  content: string;
  model: string;
}> {
  const { provider, apiKey } = params;

  const modelId = resolveModelId(provider, params.model);
  const label = PROVIDER_BY_ID[provider]?.label ?? provider;
  if (!modelId) {
    throw new ProviderError(
      `${label} does not support the selected model (${params.model}).`,
      0,
      provider
    );
  }

  switch (provider) {
    case "openrouter":
      return callOpenRouter(apiKey, modelId, params.body);
    case "google":
      return callGoogle(apiKey, modelId, params.body);
    case "huggingface":
      return callHuggingFace(apiKey, modelId, params.body);
  }
}