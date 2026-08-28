import type { Attachment, OutputTarget } from "./types";

export const SCALE_LOCK_DIRECTIVE = `STRICT CHARACTER SCALE & ENVIRONMENT LOCK:
Preserve the reference character's exact physical size, height, width, proportions, silhouette, head-to-body ratio, limb length, body volume, and overall dimensional relationship to the environment at all times; the character must remain exactly the same scale relative to every surrounding object, doorway, wall, furniture, floor, vehicle, tree, and architectural element, with absolutely no enlargement, shrinking, stretching, widening, narrowing, perspective-induced size drift, or visual exaggeration; treat every visible background element as locked geometry and preserve its exact position, scale, proportions, depth, perspective, spatial relationship, lighting, texture, and composition throughout the entire shot; camera movement must NOT cause the character to appear physically larger or more prominent than the reference unless the reference framing itself requires it, and any camera push-in must preserve the character's true physical scale relative to the environment; maintain identical character-to-environment ratio from beginning to end.
NEGATIVE CONSTRAINTS (must never appear): oversized character, giant character, enlarged character, enlarged body, tall character, wide character, bulky character, oversized head, enlarged head, exaggerated proportions, stretched limbs, shortened limbs, distorted anatomy, incorrect body scale, incorrect character height, scale drift, size fluctuation, perspective scale error, character dominating frame, character appearing closer than physically justified, unrealistic character-to-environment ratio, background shrinking around character, environment scaling down, character growing during movement, character changing dimensions, character becoming more prominent, inconsistent spatial scale, warped geometry, background morphing.`;

export const CONTINUITY_DIRECTIVE = `MASTER CONTINUITY DIRECTIVE:
Use the approved character reference images as the absolute visual source of truth. Every scene is a continuation of the same animated film. Character scale, proportions, identity, clothing, background geometry, prop placement, lighting direction, and spatial relationships remain locked unless the scene itself explicitly changes them. The model must never invent additional characters, objects, architecture, or alternate versions of an existing character. Camera movement may change framing, but it must not cause characters or objects to change physical size or position in the world.`;

export const STRICT_CLIENT_DIRECTIVE = `The original story, scene numbering, actions, and progression are preserved. The revised prompts strengthen continuity, reaction acting, visual consistency, and generation stability.`;

export function buildSystemPrompt(target: OutputTarget): string {
  const scaleAndContinuity =
    target !== "text"
      ? `\n\n${SCALE_LOCK_DIRECTIVE}\n\n${CONTINUITY_DIRECTIVE}\n\n${STRICT_CLIENT_DIRECTIVE}`
      : "";

  const base = `You are a world-class prompt engineer specializing in AI content generation. You analyze reference files (scripts, images, videos, audio) that the user attaches, infer every relevant detail about characters, environment, style, lighting, camera, motion, and tone, and then produce a single, ready-to-paste generation prompt for the selected target AI.

RULES:
- Your answer must be ONLY the final ready-to-paste prompt. No preamble, no explanations, no markdown fences, no commentary, no "Here is your prompt".
- Do not invent characters, objects, architecture, or plot events that are not present in or directly supported by the reference files and the user's scene direction.
- When reference files are provided, treat them as the visual and narrative source of truth and explicitly describe the locked details (character identity, wardrobe, palette, environment, props, layout, lighting direction) inside the prompt.
- Whenever the user describes a scene or direction, weave it into the prompt with dense, concrete visual/narrative detail.
- Write in English. Use precise, technical language. Be exhaustive but never contradictory.`;

  const tail: Record<OutputTarget, string> = {
    text: `
TARGET OUTPUT: PROMPT FOR AN AI TEXT MODEL (e.g. ChatGPT / Claude / Gemini).

Produce a structured, standalone prompt the user can paste into an AI text generator with ZERO additional edits. It must include:
- ROLE: who the AI should act as.
- CONTEXT: the scenario, the user's goal, setting, and any reference-derived facts.
- TASK: step-by-step instructions for what to generate.
- FORMAT: requested length, structure (sections/bullets), tone, language, audience.
- CONSTRAINTS: hard rules (what to include, what to avoid, length limits, style).
- QUALITY SIGNALS: how to evaluate a good response.
Also append a "Continuity note" section that keeps character voice, world rules, and timeline consistent with future generations.`,
    image: `
TARGET OUTPUT: PROMPT FOR AN AI IMAGE GENERATOR (e.g. Gemini Nano Banana / Meta.ai).

Produce a single, dense image-generation prompt (one MAIN paragraph, positive only for the body) followed by:
- [NEGATIVE PROMPT] block containing the negative constraints verbatim plus image-specific negatives (extra limbs, distorted hands, warped faces, text artifacts, bad anatomy, watermark, blur).
- [STYLE] tags (medium, art style, color palette, lighting, texture, film stock, lens, aspect ratio suggestion like --ar 16:9).
- [LOCKED DETAILS] section restating exact character identity/scale and environment geometry that must be kept identical from the references.
The prompt MUST respect the character-scale and environment-lock rules from the system constraints, keeping the reference character's proportions and the background geometry locked at all times.`,
    video: `
TARGET OUTPUT: PROMPT FOR AN AI VIDEO GENERATOR (e.g. Google Omni Flash / Veo / Kling / LTX / Wan).

Produce a full video-generation prompt organized as:
- [MASTER PROMPT]: the opening locked style/identity paragraph (character, wardrobe, environment, palette, lighting direction, art style) that seeds every shot.
- [SHOT-BY-SHOT SEQUENCE]: numbered shots. For each: shot number, camera description (angle, movement, lens), subject action, environmental changes, exact duration in seconds, and transition to next shot.
- [MOTION & TIMING]: consistent movement physics, character gait, cloth simulation, object physics, and per-shot duration budget.
- [CONTINUITY]: explicitly restate startup-scale-lock and lock-of-geometry instructions so every frame keeps the character-to-environment ratio identical (no size drift, no morphing background).
- [NEGATIVE PROMPT]: the negative constraints verbatim plus video-specific negatives (character size / proportion flicker, background morphing, shape-warping, temporal inconsistency, face drift, watermark, jitter).
Every frame must preserve the reference character's exact scale and the environment's locked geometry per the system constraints.`,
  };

  return (
    `${base}${scaleAndContinuity}\n\n` + tail[target]
  );
}

export function buildUserPrompt(
  target: OutputTarget,
  sceneDirection: string,
  fileCount: { image: number; video: number; text: number; audio: number }
): string {
  const refs = [
    fileCount.image ? `${fileCount.image} image reference(s)` : "",
    fileCount.video ? `${fileCount.video} video reference(s)` : "",
    fileCount.text ? `${fileCount.text} text document(s)` : "",
    fileCount.audio ? `${fileCount.audio} audio reference(s)` : "",
  ]
    .filter(Boolean)
    .join(", ");

  const hasRefs = refs.length > 0;

  const sceneSection = sceneDirection.trim()
    ? [
        "SCENE DIRECTION FROM USER (honor this; blend it with any reference-derived facts):",
        sceneDirection.trim(),
      ].join("\n")
    : "SCENE DIRECTION: (none provided) — base every detail strictly on the reference files; describe the reference contents precisely so the scene can be recreated faithfully.";

  const refClause = hasRefs ? ` using the attached reference file(s) — ${refs}` : "";

  return [
    `TASK: Build the final ready-to-paste ${target.toUpperCase()} generation prompt${refClause}.`,
    "",
    sceneSection,
    "",
    `OUTPUT REQUIREMENT: Reply with ONLY the ready-to-paste prompt for the ${target.toUpperCase()} target. Respect every structural block specified for ${target}. Do not include any surrounding text, labels like "prompt:", or explanation.`,
  ].join("\n");
}

export function describeTextFile(
  attachment: Attachment
): string {
  const head = attachment.textPreview ?? "";
  return head;
}

export function kindForFile(file: File): Attachment["kind"] {
  const t = (file.type || "").toLowerCase();
  if (t.startsWith("image/")) return "image";
  if (t === "video/mp4" || t === "video/webm" || t === "video/mov" || t === "video/quicktime" || t === "video/mpeg" || t.startsWith("video/")) return "video";
  if (t.startsWith("audio/")) return "audio";
  if (t.startsWith("text/") || t === "application/json" || t === "application/xml" || t === "application/srt" || t === "text/plain" || /\.(txt|md|srt|vtt|json|csv|xml|log|ya?ml|tsx?|js|py|html?|css)$/i.test(file.name)) return "text";
  return "other";
}

export function truncateText(content: string, maxChars = 20000): string {
  return content.length > maxChars
    ? content.slice(0, maxChars) + "\n\n...[remaining content truncated for token limits]"
    : content;
}