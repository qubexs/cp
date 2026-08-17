import {
  OPENROUTER_ENDPOINT,
  type AttemptDetail,
  type Attachment,
  type ChatResult,
  type ModelChoice,
  type OutputTarget,
} from "./types";
import { buildSystemPrompt, buildUserPrompt, describeTextFile, kindForFile, truncateText } from "./prompts";

export class OpenRouterError extends Error {
  status: number;
  provider?: string;
  attempts?: AttemptDetail[];
  constructor(message: string, status: number, provider?: string) {
    super(message);
    this.name = "OpenRouterError";
    this.status = status;
    this.provider = provider;
  }
}

export interface KeyOption {
  id?: string;
  key: string;
  label: string;
}

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

async function callOpenRouterOnce(
  apiKey: string,
  model: ModelChoice,
  body: { messages: ChatMessage[]; temperature?: number; max_tokens?: number }
): Promise<{ content: string; model: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000);

  try {
    const res = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
        ...(typeof window !== "undefined"
          ? { "HTTP-Referer": window.location.origin, "X-Title": "Prompt Forge" }
          : {}),
      },
      body: JSON.stringify({ model, ...body }),
      signal: controller.signal,
    });

    if (!res.ok) {
      let message = `HTTP ${res.status}`;
      try {
        const err = await res.json();
        if (err?.error?.message) message = err.error.message;
        if (err?.error?.code) message = `${err.error.code}: ${message}`;
      } catch {
        /* ignore */
      }
      throw new OpenRouterError(message, res.status);
    }

    const data = await res.json();
    const contentString =
      data?.choices?.[0]?.message?.content ?? data?.choices?.[0]?.text ?? "";

    if (!contentString) {
      throw new OpenRouterError(
        "The model returned an empty response. Try a different model or retry.",
        0
      );
    }

    return { content: contentString.trim(), model: data?.model ?? model };
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new OpenRouterError(
        "Request timed out after 5 minutes. The file may be too large — try a smaller reference or a faster model.",
        0
      );
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function maskKey(key: string): string {
  if (key.length <= 10) return "•••";
  return `${key.slice(0, 8)}••••${key.slice(-4)}`;
}

/**
 * Sends a chat request using the account's keys with rotation + failover.
 * Keys are tried in the provided order; on failure the next key is tried automatically.
 */
export async function chatWithKeys(params: {
  keys: KeyOption[];
  model: ModelChoice;
  body: { messages: ChatMessage[]; temperature?: number; max_tokens?: number };
}): Promise<ChatResult> {
  const { keys, model, body } = params;

  const usable = keys.filter((k) => k.key.trim().length > 0);
  if (usable.length === 0) {
    throw new OpenRouterError(
      "No enabled API keys. Add or enable at least one key in your account settings.",
      0
    );
  }

  const attempts: AttemptDetail[] = [];
  let lastError: Error | null = null;

  for (const k of usable) {
    try {
      const res = await callOpenRouterOnce(k.key, model, body);
      attempts.push({ keyId: k.id, label: k.label, ok: true });
      return {
        content: res.content,
        model: res.model,
        usedKeyId: k.id,
        usedKey: maskKey(k.key),
        attempts,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push({
        keyId: k.id,
        label: k.label,
        ok: false,
        errorMessage: msg,
      });
      lastError = err instanceof Error ? err : new Error(msg);
    }
  }

  const wrapped = new OpenRouterError(
    `All ${usable.length} key(s) failed. Last error: ${lastError?.message ?? "unknown"} (${attempts.filter((a) => !a.ok).length} attempt(s) failed).`,
    0
  );
  wrapped.attempts = attempts;
  throw wrapped;
}

export async function analyzeAndBuildPrompt(params: {
  keys: KeyOption[];
  model: ModelChoice;
  target: OutputTarget;
  attachments: Attachment[];
  sceneDirection: string;
}): Promise<ChatResult> {
  const { keys, model, target, attachments, sceneDirection } = params;

  const textBody = buildUserPrompt(target, sceneDirection, {
    image: attachments.filter((a) => a.kind === "image").length,
    video: attachments.filter((a) => a.kind === "video").length,
    text: attachments.filter((a) => a.kind === "text").length,
    audio: attachments.filter((a) => a.kind === "audio").length,
  });

  const content: ContentPart[] = [{ type: "text", text: textBody }];
  appendAttachmentParts(content, attachments);

  return chatWithKeys({
    keys,
    model,
    body: {
      messages: [
        { role: "system", content: buildSystemPrompt(target) },
        { role: "user", content },
      ],
      temperature: 0.4,
      max_tokens: 4096,
    },
  });
}

export function appendAttachmentParts(
  content: ContentPart[],
  attachments: Attachment[]
) {
  for (const a of attachments) {
    if (a.kind === "image" && a.dataUrl) {
      content.push({ type: "image_url", image_url: { url: a.dataUrl } });
    } else if (a.kind === "video" && a.dataUrl) {
      content.push({ type: "video_url", video_url: { url: a.dataUrl } });
    } else if (a.kind === "text" && a.textPreview) {
      content.push({
        type: "text",
        text: `[REFERENCE TEXT FILE: ${a.name}]\n${truncateText(describeTextFile(a))}`,
      });
    }
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsDataURL(file);
  });
}

export function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

export async function readAttachment(file: File): Promise<Attachment> {
  const kind = kindForFile(file);
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
  const base: Attachment = {
    id,
    name: file.name,
    size: file.size,
    type: file.type,
    kind,
    dataUrl: "",
  };

  if (kind === "text") {
    const text = await fileToText(file);
    return { ...base, textPreview: text };
  }

  const dataUrl = await fileToDataUrl(file);
  return { ...base, dataUrl };
}