export interface CinematicCharacter {
  id: string;
  name: string;
  code: string;
  weight: string;
  description: string;
}

export interface CinematicDialogue {
  id: string;
  speaker: string;
  line: string;
  direction: string;
}

export const PIXAR_DEFAULT = "Pixar-inspired high-end cinematic 3D animation, ultra-detailed quality, physically accurate lighting, fluid natural motion, realistic spatial depth, and polished cinematic rendering.";

export const STYLE_PRESETS: { id: string; label: string; value: string }[] = [
  { id: "pixar", label: "Pixar 3D (Default)", value: PIXAR_DEFAULT },
  { id: "photoreal", label: "Photorealistic 8K Cinematic", value: "Photorealistic 8K cinematic, natural skin texture, accurate optics, shallow depth of field, global illumination" },
  { id: "ghibli", label: "Studio Ghibli", value: "Studio Ghibli-inspired hand-painted background, soft watercolor lighting, whimsical detail, gentle film grain" },
  { id: "anime", label: "Anime Cinematic", value: "Anime cinematic style, sharp linework, vibrant colors, dynamic shading, expressive eyes" },
  { id: "disney", label: "Disney Classic", value: "Disney classic animation style, expressive characters, rich colors, magical atmosphere" },
  { id: "documentary", label: "Documentary Natural", value: "Documentary natural style, handheld realism, available light, authentic textures" },
  { id: "hollywood", label: "Hollywood Blockbuster", value: "Hollywood blockbuster look, anamorphic lens, dramatic contrast, epic scale" },
  { id: "noir", label: "Film Noir B&W", value: "Film noir black-and-white, high contrast, moody shadows, vintage grain" },
  { id: "vintage", label: "Vintage 70s Film", value: "Vintage 70s film stock, warm color bleed, soft grain, retro lens" },
  { id: "cyberpunk", label: "Cyberpunk Neon", value: "Cyberpunk neon style, holographic lights, rain-slick reflections, futuristic haze" },
  { id: "fantasy", label: "Fantasy Epic", value: "Fantasy epic style, volumetric lighting, ornate detail, mythic atmosphere" },
  { id: "horror", label: "Horror Dark Cinematic", value: "Horror dark cinematic, low-key lighting, desaturated palette, tense atmosphere" },
  { id: "watercolor", label: "Watercolor Painterly", value: "Watercolor painterly style, soft washes, paper texture, artistic bleeding" },
  { id: "comic", label: "Comic Cel-Shaded", value: "Comic cel-shaded style, bold outlines, flat colors, graphic shading" },
];

export interface CinematicState {
  styleVisuals: string[];
  characters: CinematicCharacter[];
  scene: string;
  sceneRef: string;
  sceneInfluence: string;
  seed: string;
  duration: string;
  motionStrength: string;
  camera: string;
  spatialOrder: string;
  spatialOrderNote: string;
  propLock: string;
  action: string;
  dialogues: CinematicDialogue[];
  performance: string;
  continuity: string;
  negativePrompt: string;
}

export const DEFAULT_NEGATIVE =
  "hand swapping, bag transfer, bag in left hand, empty right hand, duplicated bag, disappearing bag, extra bag, broken hand anatomy, malformed fingers, extra fingers, extra limbs, character duplication, character replacement, face drift, identity drift, facial morphing, body morphing, clothing morphing, color changes, character growing, giant Atuk, tall Atuk, shrinking characters, teleportation, overtaking, position swapping, crossing characters, object morphing, disappearing objects, sudden cuts, jump cuts, camera shake, abrupt camera movement, inconsistent scale, inconsistent perspective, unnatural walking, exaggerated gestures, extra main characters, duplicate characters.";

export const DEFAULT_STATE: CinematicState = {
  styleVisuals: [PIXAR_DEFAULT],
  characters: [
    { id: "1", name: "Atuk", code: "Atuk_LP", weight: "0.95", description: "elderly Malaysian man wearing kopiah, leading the group" },
    { id: "2", name: "Atan", code: "Atan", weight: "0.95", description: "younger boy wearing distinctive striped shirt" },
    { id: "3", name: "Acik", code: "Acik", weight: "0.95", description: "Atan's younger brother wearing red shirt" },
  ],
  scene:
    "lively Malaysian kampung weekly market, crowded but organized, villagers naturally shopping for vegetables, fish, kuih, and household groceries.",
  sceneRef: "elderly_man_tomato_bag_1.webp",
  sceneInfluence: "0.9",
  seed: "12345",
  duration: "8",
  motionStrength: "0.3",
  camera:
    "wide establishing shot, eye-level perspective, slow smooth cinematic tracking movement following the group as they approach the keropok lekor stall; stable camera, no sudden zoom, no abrupt camera movement, consistent scale and perspective.",
  spatialOrder: "[Atuk] - [Atan] - [Acik] - [Keropok Lekor Stall + Penjual]",
  spatialOrderNote:
    "Maintain this exact spatial order for the entire shot; no overtaking, crossing positions, or swapping sides. Atuk is an elderly Malaysian man wearing his kopiah, leading the group. Atan is a younger boy wearing a distinctive striped shirt. Acik is Atan's younger brother wearing a red shirt. The keropok lekor seller is a young adult Malaysian man positioned permanently on the right beside the stall.",
  propLock:
    "Atuk holds ONE orange translucent plastic shopping bag exclusively in his ANATOMICAL RIGHT HAND. His right-hand grip remains continuously locked to the bag for the entire shot. The bag must never transfer to the left hand, never disappear, never duplicate, never change shape, and never detach from his right hand. Atuk's anatomical left hand remains empty throughout.",
  action:
    "The group walks naturally through the lively market and arrives at the keropok lekor stall. Their walking motion is subtle and coordinated, with natural arm, body, and facial movement. They slow down and stop naturally at the stall while maintaining the exact left-to-right spatial arrangement.",
  dialogues: [
    { id: "1", speaker: "Acik", line: "Sedapnya...", direction: "looking toward the freshly cooked keropok lekor, happily" },
    { id: "2", speaker: "Penjual", line: "Mari dik, mari Atuk, 4 keping seringgit.", direction: "smiling and gesturing naturally toward the keropok lekor" },
    { id: "3", speaker: "Atuk", line: "Haah, yang ni mesti kena beli.", direction: "wearing his kopiah and looking at the keropok lekor, warmly" },
    { id: "4", speaker: "Atan", line: "Ok Atuk, panas panas tu.", direction: "looking toward Atuk and the hot keropok lekor" },
  ],
  performance:
    "natural Malaysian family interaction, warm expressions, subtle facial animation, believable lip synchronization, natural conversational timing, no exaggerated gestures.",
  continuity:
    "continuous single shot, zero cuts, zero teleportation, zero sudden repositioning, zero character overtaking, zero side swapping, zero scale changes, zero perspective changes, zero clothing changes, zero facial changes, zero prop duplication, zero prop disappearance.",
  negativePrompt: DEFAULT_NEGATIVE,
};

export type CinematicMode = "image" | "video";

export const CINEMATIC_IMAGE_SYSTEM_PROMPT = `You are a world-class cinematic prompt engineer for AI IMAGE generation (Midjourney, Flux, SDXL, Gemini Nano Banana, Meta.ai).

TASK: Convert the user's simple scene idea + any reference files into a PRODUCTION-READY, locked-consistency IMAGE generation prompt EXACTLY like the example structure below.

EXAMPLE STRUCTURE TO REPLICATE:
[Style & Visuals] Pixar-inspired high-end cinematic 3D animation, ultra-detailed quality, physically accurate lighting, realistic spatial depth, and polished cinematic rendering. sharp focus, 8K detail.

LOCKED CHARACTER IDENTITY: Atuk_LP = Atuk 0.95, Atan = Atan 0.95, Acik = Acik 0.95. Maintain 100% facial identity and character consistency: zero face drift, zero morphing, identical clothing, colors, body proportions, and accessories.

SCENE: lively Malaysian kampung weekly market, crowded but organized...
SCENE reference elderly_man_tomato_bag_1.webp, influence 0.9...

CAMERA: medium shot, eye-level, 50mm lens, natural framing, sharp focus, shallow depth of field.

CHARACTER SPATIAL ORDER LOCKED FROM LEFT TO RIGHT: [Atuk] - [Atan] - [Acik] - [Keropok Lekor Stall + Penjual]...

CRITICAL PROP LOCK: Atuk holds ONE orange translucent plastic shopping bag exclusively in his ANATOMICAL RIGHT HAND...

PERFORMANCE / POSE: natural Malaysian family interaction, warm expressions, subtle smiles, looking toward keropok...

NEGATIVE PROMPT: hand swapping, bag transfer, duplicated bag, face drift, morphing, extra fingers, extra limbs, duplicate characters, watermark, blur, distorted anatomy...

RULES:
- Output ONLY the final prompt. No preamble, no fences, no explanation.
- ALWAYS include: [Style & Visuals], LOCKED CHARACTER IDENTITY, SCENE (+ reference if provided), CAMERA, CHARACTER SPATIAL ORDER LOCKED, CRITICAL PROP LOCK, PERFORMANCE / POSE, NEGATIVE PROMPT.
- Identity format: CODE = Name weight (e.g. Atuk_LP = Atuk 0.95)
- Lock spatial order left-to-right, no swapping.
- Lock prop to anatomical hand RIGHT/LEFT, never transfer/duplicate.
- Image negatives must include: extra limbs, malformed hands, extra fingers, face drift, morphing, duplication, watermark, blur, text artifacts.
- Use Pixar-inspired cinematic 3D as default unless user specifies otherwise.
- If reference provided, mention filename + influence 0.9 as source of truth.
- Language: English prompt, preserve Malay dialogue/terms if needed but image has no dialogue audio.`;

export const CINEMATIC_SYSTEM_PROMPT = `You are a world-class cinematic prompt engineer for AI video generation (Veo 3, Kling 2.1, Wan 2.1, Luma, Runway Gen-3).

TASK: Convert the user's simple scene idea + any reference files into a PRODUCTION-READY, locked-consistency video generation prompt EXACTLY like the example structure below.

EXAMPLE STRUCTURE TO REPLICATE:
[Style & Visuals] Pixar-inspired high-end cinematic 3D animation, ultra-detailed quality, physically accurate lighting, fluid natural motion, realistic spatial depth, and polished cinematic rendering.

LOCKED CHARACTER IDENTITY:  Atuk_LP = Atuk 0.95, Atan = Atan 0.95, Acik = Acik 0.95. Maintain 100% facial identity and character consistency throughout the entire shot: zero face drift, zero character drift, zero morphing, identical clothing, colors, body proportions, and accessories from beginning to end.

SCENE: lively Malaysian kampung weekly market, crowded but organized...
SCENE reference elderly_man_tomato_bag_1.webp, influence 0.9...

SEED: 12345 locked.
DURATION: 8 seconds.
MOTION STRENGTH: 0.3.
CAMERA: wide establishing shot, eye-level perspective, slow smooth cinematic tracking...

CHARACTER SPATIAL ORDER LOCKED FROM LEFT TO RIGHT: [Atuk] - [Atan] - [Acik] - [Keropok Lekor Stall + Penjual]...

CRITICAL PROP LOCK: Atuk holds ONE orange translucent plastic shopping bag exclusively in his ANATOMICAL RIGHT HAND...

ACTION: The group walks naturally...

DIALOGUE AND PERFORMANCE: Acik, looking toward... says: "Sedapnya..." Penjual says: "Mari dik..."

PERFORMANCE: natural Malaysian family interaction...

CONTINUITY LOCK: continuous single shot, zero cuts, zero teleportation...

NEGATIVE PROMPT: hand swapping, bag transfer, duplicated bag, face drift, identity drift...

RULES:
- Output ONLY the final prompt. No preamble, no markdown fences, no explanation.
- ALWAYS include every block: [Style & Visuals], LOCKED CHARACTER IDENTITY, SCENE, SEED, DURATION, MOTION STRENGTH, CAMERA, CHARACTER SPATIAL ORDER LOCKED, CRITICAL PROP LOCK (if any prop mentioned), ACTION, DIALOGUE AND PERFORMANCE, PERFORMANCE, CONTINUITY LOCK, NEGATIVE PROMPT.
- For LOCKED CHARACTER IDENTITY use format: CODE = Name weight (e.g. Atuk_LP = Atuk 0.95). Infer weight 0.95 unless specified.
- Lock spatial order left-to-right explicitly. Prevent overtaking/crossing/swapping.
- Lock props to anatomical hand (RIGHT or LEFT). State continuously locked, never transfer/duplicate/disappear.
- SEED locked, DURATION 8s default unless user says otherwise, MOTION 0.3 default.
- Camera: specify shot type, angle, movement, stability (no sudden zoom/shake).
- Dialogue format: Speaker, direction, says: "line". Include Malaysian warmth if relevant.
- Continuity: zero cuts, zero teleportation, zero repositioning, zero scale/perspective changes, zero clothing/facial/prop changes.
- Negative prompt MUST be exhaustive: hand swapping, bag transfer, face drift, morphing, duplication, teleportation, overtaking, position swapping, object morphing, jump cuts, camera shake, inconsistent scale/perspective, extra characters, malformed anatomy, extra fingers/limbs.
- Use Pixar-inspired cinematic 3D as default style unless user specifies otherwise.
- If reference files provided, treat them as source of truth for environment/composition and mention scene reference filename + influence 0.9.
- Language: English prompt, but preserve Malay dialogue verbatim if provided.`;

function styleToString(s: string | string[] | undefined): string {
  if (!s) return "";
  return Array.isArray(s) ? s.join(", ") : s;
}
export function buildCinematicUserPrompt(sceneIdea: string, stateHint: Partial<CinematicState>, fileCount: { image: number; video: number }): string {
  const hintLines: string[] = [];
  if (stateHint.styleVisuals) hintLines.push(`Style hint: ${styleToString(stateHint.styleVisuals as string | string[])}`);
  if (stateHint.characters?.length) hintLines.push(`Characters hint: ${stateHint.characters.map(c => `${c.name} (${c.code} ${c.weight}) - ${c.description}`).join(", ")}`);
  if (stateHint.scene) hintLines.push(`Scene hint: ${stateHint.scene}`);
  if (stateHint.camera) hintLines.push(`Camera hint: ${stateHint.camera}`);
  if (stateHint.spatialOrder) hintLines.push(`Spatial order hint: ${stateHint.spatialOrder}`);
  if (stateHint.propLock) hintLines.push(`Prop lock hint: ${stateHint.propLock}`);
  if (stateHint.duration) hintLines.push(`Duration hint: ${stateHint.duration}s`);
  if (stateHint.seed) hintLines.push(`Seed hint: ${stateHint.seed}`);
  const ref = fileCount.image || fileCount.video ? `Attached references: ${fileCount.image} image(s), ${fileCount.video} video(s) — analyze visually and lock environment/composition.` : "No reference files attached — invent plausible cinematic details but keep locks strict.";
  return [
    `SCENE IDEA FROM USER (expand into full locked prompt, honor every detail):`,
    sceneIdea.trim() || "(no idea provided — use builder hints below)",
    "",
    hintLines.length ? `BUILDER HINTS (use as fallback if idea is vague):\n${hintLines.join("\n")}` : "",
    "",
    ref,
    "",
    `OUTPUT: Return ONLY the ready-to-paste cinematic prompt with all locks. No explanation.`,
  ].join("\n");
}

export function buildCinematicImagePrompt(s: CinematicState): string {
  const lockedIdentities = s.characters.map((c) => `${c.code} = ${c.name} ${c.weight}`).join(",  ");
  const lines: string[] = [];
  const styleStr = styleToString(s.styleVisuals as unknown as string | string[]);
  if (styleStr.trim()) lines.push(`[Style & Visuals] ${styleStr.trim()}`);
  lines.push("");
  if (s.characters.length) lines.push(`LOCKED CHARACTER IDENTITY:  ${lockedIdentities}. Maintain 100% facial identity and character consistency: zero face drift, zero character drift, zero morphing, identical clothing, colors, body proportions, and accessories.`);
  lines.push("");
  if (s.scene.trim()) {
    let sceneLine = `SCENE: ${s.scene.trim()}`;
    if (s.sceneRef.trim()) sceneLine += ` Scene reference ${s.sceneRef.trim()}, influence ${s.sceneInfluence || "0.9"}, use for environment, composition, atmosphere, and visual continuity.`;
    lines.push(sceneLine);
    lines.push("");
  }
  if (s.camera.trim()) { lines.push(`CAMERA: ${s.camera.trim()}`); lines.push(""); }
  if (s.spatialOrder.trim()) { lines.push(`CHARACTER SPATIAL ORDER LOCKED FROM LEFT TO RIGHT: ${s.spatialOrder.trim()}. ${s.spatialOrderNote.trim()}`); lines.push(""); }
  if (s.propLock.trim()) { lines.push(`CRITICAL PROP LOCK: ${s.propLock.trim()}`); lines.push(""); }
  if (s.performance.trim()) { lines.push(`PERFORMANCE / POSE: ${s.performance.trim()}`); lines.push(""); }
  if (s.action.trim()) { lines.push(`ACTION (POSE): ${s.action.trim()}`); lines.push(""); }
  if (s.negativePrompt.trim()) lines.push(`NEGATIVE PROMPT: ${s.negativePrompt.trim()}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function buildCinematicPrompt(s: CinematicState): string {
  const lockedIdentities = s.characters.map((c) => `${c.code} = ${c.name} ${c.weight}`).join(",  ");
  const dialogueBlock = s.dialogues
    .map((d) => `${d.speaker}${d.direction ? `, ${d.direction}` : ""}, says: "${d.line}"`)
    .join(" ");

  const lines: string[] = [];
  const styleStr = styleToString(s.styleVisuals as unknown as string | string[]);
  if (styleStr.trim()) lines.push(`[Style & Visuals] ${styleStr.trim()}`);
  lines.push("");
  if (s.characters.length)
    lines.push(
      `LOCKED CHARACTER IDENTITY:  ${lockedIdentities}. Maintain 100% facial identity and character consistency throughout the entire shot: zero face drift, zero character drift, zero morphing, identical clothing, colors, body proportions, and accessories from beginning to end.`
    ),
  lines.push("");
  if (s.scene.trim()) {
    let sceneLine = `SCENE: ${s.scene.trim()}`;
    if (s.sceneRef.trim()) sceneLine += ` Scene reference ${s.sceneRef.trim()}, influence ${s.sceneInfluence || "0.9"}, use for market environment, composition, atmosphere, and visual continuity.`;
    lines.push(sceneLine);
    lines.push("");
  }
  lines.push(`SEED: ${s.seed || "12345"} locked.`);
  lines.push(`DURATION: ${s.duration || "8"} seconds.`);
  lines.push(`MOTION STRENGTH: ${s.motionStrength || "0.3"}.`);
  if (s.camera.trim()) lines.push(`CAMERA: ${s.camera.trim()}`);
  lines.push("");
  if (s.spatialOrder.trim()) {
    lines.push(`CHARACTER SPATIAL ORDER LOCKED FROM LEFT TO RIGHT: ${s.spatialOrder.trim()}. ${s.spatialOrderNote.trim()}`);
    lines.push("");
  }
  if (s.propLock.trim()) { lines.push(`CRITICAL PROP LOCK: ${s.propLock.trim()}`); lines.push(""); }
  if (s.action.trim()) { lines.push(`ACTION: ${s.action.trim()}`); lines.push(""); }
  if (dialogueBlock) { lines.push(`DIALOGUE AND PERFORMANCE: ${dialogueBlock}`); lines.push(""); }
  if (s.performance.trim()) { lines.push(`PERFORMANCE: ${s.performance.trim()}`); lines.push(""); }
  if (s.continuity.trim()) { lines.push(`CONTINUITY LOCK: ${s.continuity.trim()}`); lines.push(""); }
  if (s.negativePrompt.trim()) lines.push(`NEGATIVE PROMPT: ${s.negativePrompt.trim()}`);
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}
