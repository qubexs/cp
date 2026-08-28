export type OutputTarget = "text" | "image" | "video";

export type Provider = "openrouter" | "google" | "huggingface";

export type AttachmentKind =
  | "image"
  | "video"
  | "audio"
  | "text"
  | "other";

export interface Attachment {
  id: string;
  name: string;
  size: number;
  type: string;
  kind: AttachmentKind;
  dataUrl: string;
  textPreview?: string;
  url?: string;
}

export interface AttemptDetail {
  keyId?: string;
  label: string;
  ok: boolean;
  errorMessage?: string;
}

export interface ChatResult {
  content: string;
  model: string;
  provider?: Provider;
  usedKeyId?: string;
  usedKey?: string;
  attempts?: AttemptDetail[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export const OUTPUT_LABELS: Record<OutputTarget, string> = {
  text: "AI Text",
  image: "AI Image",
  video: "AI Video",
};

export const COLORS: Record<OutputTarget, string> = {
  text: "text-emerald-400",
  image: "text-sky-400",
  video: "text-fuchsia-400",
};

export const BORDER_COLORS: Record<OutputTarget, string> = {
  text: "border-emerald-500/60",
  image: "border-sky-500/60",
  video: "border-fuchsia-500/60",
};

export const BG_COLORS: Record<OutputTarget, string> = {
  text: "bg-emerald-500/10",
  image: "bg-sky-500/10",
  video: "bg-fuchsia-500/10",
};

export const MAX_FILE_SIZE_BYTES = 40 * 1024 * 1024;

export const OPENROUTER_ENDPOINT =
  "https://openrouter.ai/api/v1/chat/completions";

export const MODELS = [
  {
    id: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash — best price/perf (image+video+text)",
    vision: true,
    video: true,
    providers: ["openrouter", "google", "huggingface"] as const satisfies readonly Provider[],
    googleId: "gemini-2.5-flash",
    hfId: "google/gemini-2.5-flash",
  },
  {
    id: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro — thinking + strongest (image+video+text)",
    vision: true,
    video: true,
    providers: ["openrouter", "google"] as const satisfies readonly Provider[],
    googleId: "gemini-2.5-pro",
  },
  {
    id: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite — fastest/cheap (image+video+text)",
    vision: true,
    video: true,
    providers: ["openrouter", "google"] as const satisfies readonly Provider[],
    googleId: "gemini-2.5-flash-lite",
  },
  {
    id: "google/gemini-3-flash",
    label: "Gemini 3 Flash (Preview) — frontier speed (image+video+text)",
    vision: true,
    video: true,
    providers: ["google"] as const satisfies readonly Provider[],
    googleId: "gemini-3-flash-preview",
  },
  {
    id: "google/gemini-2.0-flash-001",
    label: "Gemini 2.0 Flash (image + video + text)",
    vision: true,
    video: true,
    providers: ["openrouter", "google"] as const satisfies readonly Provider[],
    googleId: "gemini-2.0-flash",
  },
  {
    id: "qwen/qwen-2.5-vl-72b-instruct",
    label: "Qwen2.5-VL 72B (image + video + text)",
    vision: true,
    video: true,
    providers: ["openrouter", "huggingface"] as const satisfies readonly Provider[],
    hfId: "Qwen/Qwen2.5-VL-72B-Instruct",
  },
  {
    id: "openai/gpt-4o-mini",
    label: "GPT-4o mini (image + text)",
    vision: true,
    video: false,
    providers: ["openrouter"] as const satisfies readonly Provider[],
  },
  {
    id: "openai/gpt-4o",
    label: "GPT-4o (image + text)",
    vision: true,
    video: false,
    providers: ["openrouter"] as const satisfies readonly Provider[],
  },
  {
    id: "anthropic/claude-3.5-sonnet",
    label: "Claude 3.5 Sonnet (image + text)",
    vision: true,
    video: false,
    providers: ["openrouter"] as const satisfies readonly Provider[],
  },
] as const;

export type ModelChoice = (typeof MODELS)[number]["id"];