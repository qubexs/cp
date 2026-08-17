import {
  appendAttachmentParts,
  chatWithKeys,
  type ContentPart,
  type KeyOption,
} from "./openrouter";
import type { Attachment, ChatResult, ModelChoice } from "./types";
import { SCALE_LOCK_DIRECTIVE, CONTINUITY_DIRECTIVE } from "./prompts";

export type ScanId = "analyze" | "sceneflow" | "continuity" | "drift" | "defect";

export interface ScanConfig {
  id: ScanId;
  title: string;
  icon: string;
  tagline: string;
  hint: string;
  advice: string;
  acceptsVideo: boolean;
  minRefs: number;
  reminder: string;
  system: string;
}

const PRODUCTION_GUARD =
  SCALE_LOCK_DIRECTIVE +
  "\n\n" +
  CONTINUITY_DIRECTIVE +
  "\n\n" +
  "You work for a professional animation production house. Be rigorous, technical, and specific. Never invent defects or differences that are not genuinely present. Cite exactly what you observed and where.";

export const SCANS: Record<ScanId, ScanConfig> = {
  analyze: {
    id: "analyze",
    title: "Analyze Between Images",
    icon: "🔍",
    tagline: "Compare two or more reference images side by side.",
    hint: "Drop 2+ images (frames, designs, or versions of the same character/world) to compare.",
    advice: "For the strongest result add 2–3 frames of the same character.",
    acceptsVideo: true,
    minRefs: 2,
    reminder:
      "User's continuity/scale directives are already locked. Compare honestly; flag the master reference.",
    system: `You are a master continuity analyst in an animation production house. The user attaches reference images that should depict the same character(s) and/or world (multiple frames, designs, or versions of a shot).

Compare every image against the others and produce a structured VERDICT REPORT with exactly these sections:
- [MASTER IDENTITY]: the character baseline — height, proportions, head-to-body ratio, silhouette, wardrobe, palette, distinguishing features — as established across the references, and which image is the best source-of-truth master.
- [CONSISTENCY CHECK]: for each area (step: face & identity / scale & proportions / environment geometry / wardrobe / prop placement / lighting direction / color grade) state the verdict in each image as LOCKED, DRIFTED, or UNCERTAIN, with a one-line reason.
- [DIFFERENCES]: numbered list of every observed difference, for each: images involved, what differs, how much (approx % when it is scale/geometry), severity (LOW/MEDIUM/HIGH).
- [SCALE & ENV LOCK]: explicitly report whether the strict character-scale and environment-lock rules are respected in every image.
- [VERDICT]: final PASS / PASS WITH WARNINGS / FAIL, plus the mastering recommendation.

Output ONLY the report.`,
  },

  sceneflow: {
    id: "sceneflow",
    title: "Scene Flow",
    icon: "🎞️",
    tagline: "Break a video / frames into a scene-by-scene continuity flow.",
    hint: "Drop a video (or a sequence of frames/screenshots) — optionally a script to steer the flow.",
    advice: "Long videos work better than short clips, but anything helps.",
    acceptsVideo: true,
    minRefs: 1,
    reminder: "Preserve original scene numbering, order and progression.",
    system: `You are a pre-production scene-flow developer at an animation production house. The user attaches a video and/or a sequence of reference frames, plus optional script/direction.

Visualize the material frame-by-frame and produce a SCENE FLOW made of exactly these sections:
- [SCENE LIST]: numbered scenes in original order, each with: scene number, time range (mm:ss–mm:ss), location, characters present, primary action.
- [SHOT-BY-SHOT]: for every shot: shot number, camera (angle, movement, lens feel), subject action, environment state, and continuity-lock note confirming character scale + environment geometry match the master references.
- [REFERENCE ANCHORS]: which exact frames/images are the visual master for character and for environment, restating the locked details.
- [SEQUENCE TIMING]: per-shot duration budget and transitions.
- [RISK FLAGS]: any moment where continuity could break (character scale, geometry, wardrobe, lighting), with a suggested fix.
- [RECAP]: one short paragraph that would seed a video-generation master prompt.

Output ONLY the scene flow.`,
  },

  continuity: {
    id: "continuity",
    title: "Continuity Scan",
    icon: "🧩",
    tagline: "Catch continuity errors: wardrobe, props, geometry, drift.",
    hint: "Drop reference images/video of a scene or character. Add your scene notes to narrow the check.",
    advice: "More frames = more errors caught.",
    acceptsVideo: true,
    minRefs: 1,
    reminder: "Locked details (character & environment) must never silently change.",
    system: `You are the continuity department of an animation production house. Given the references (and any scene direction), hunt for and list every continuity error.

Respond with EXACTLY:
- [ERROR LOG]: numbered list. For each error: location (shot/frame/section), category (wardrobe / props / background geometry / lighting direction / character presence / scale & proportions / color grade), description of what changes, severity (LOW/MEDIUM/HIGH), and the exact fix to re-lock it to the master reference.
- [SCALE & GEOMETRY]: specifically verify the strict character-scale and environment-lock rules across every frame; list any violation (character size drift, morphing background, environment scaling, character scale, etc.).
- [MASTER SNAPSHOT]: restate the locked facts (character identity + environment geometry) that all frames must match.
- [VERDICT]: PASS / PASS WITH WARNINGS / FAIL + one-line summary.

Output ONLY the error log.`,
  },

  drift: {
    id: "drift",
    title: "Drift Detect",
    icon: "📐",
    tagline: "Detect character / scale / proportion drift shot to shot.",
    hint: "Drop frames of the SAME character across shots to measure drift.",
    advice: "Use frames with the character near the same position for fair reading.",
    acceptsVideo: true,
    minRefs: 2,
    reminder: "Character-to-environment ratio must be identical from beginning to end.",
    system: `You are a character-lock / drift specialist enforcing the strict scale rules below. Analyze the attached references of the same character and detect ANY drift.

Produce EXACTLY:
- [BASELINE READ]: locked character dimensions — height, width, head-to-body ratio, limb lengths, body volume, and the character's scale relative to a nearby reference object/environment.
- [DRIFT LOG]: numbered list. For each occurrence: shot/frame, what drifted (height, width, proportions, head size, limb length, body volume, position vs environment), measured or estimated discrepancy (approx %), severity (LOW/MEDIUM/HIGH), and whether it triggers a forbidden negative constraint (e.g. oversized character, stretched limbs, distorted anatomy, scale drift, character dominating frame).
- [ENV LOCK]: confirm background geometry stays constant (position, scale, depth, perspective) — flag any morphing or environment-scaling.
- [TREND]: is the drift growing over time? Where does it start?
- [VERDICT]: LOCKED / DRIFT DETECTED / CRITICAL with recommended correction.

Output ONLY the drift report.`,
  },

  defect: {
    id: "defect",
    title: "Defect Scan",
    icon: "🔬",
    tagline: "QC inspector: anatomy, artifacts, warping, watermarking.",
    hint: "Drop the frame/video you want inspected for visual defects.",
    advice: "Frame-level inspection is most precise.",
    acceptsVideo: true,
    minRefs: 1,
    reminder: "Report only defects actually visible in the references.",
    system: `You are the QC/QA inspector of an animation production house. Inspect the reference(s) and catalogue every visual defect.

Respond with EXACTLY:
- [DEFECT LOG]: numbered list. For each: location (region/shot/frame), type (anatomy error: hands, fingers, extra/missing limbs, distorted face; warping; morphing; temporal flicker or glitch; banding; noise; compression artifacts; watermark/logo; corrupted text; resolution/smearing; AI artifact like duplicated geometry), severity (LOW/MEDIUM/HIGH), and a suggested fix.
- [ANATOMY PASS]: specifically check hands, eyes, face symmetry, limb count and joint placement.
- [SCALE STABILITY]: note any size/proportion instability between frames (flag if severe).
- [OVERALL]: FINAL VERDICT — PASS / PASS WITH NOTES / FAIL — and whether it is usable as a prompt reference.

Output ONLY the defect log.`,
  },
};

export const SCAN_ORDER: ScanId[] = [
  "analyze",
  "sceneflow",
  "continuity",
  "drift",
  "defect",
];

export async function runScan(params: {
  keys: KeyOption[];
  model: ModelChoice;
  config: ScanConfig;
  attachments: Attachment[];
  userPrompt: string;
}): Promise<ChatResult> {
  const { keys, model, config, attachments, userPrompt } = params;

  const instructions: string[] = [
    "TASK: " + config.title + ". " + config.tagline,
    "The strict production rules are already provided in the system message.",
    userPrompt.trim()
      ? "USER NOTES / DIRECTION TO INCORPORATE:\n" + userPrompt.trim()
      : "(No additional user notes provided.)",
    "",
    'OUTPUT REQUIREMENT: Reply with ONLY the report described in the system message. No surrounding text, no "Here is the report", no labels like "report:", no explanation.',
  ];

  const content: ContentPart[] = [{ type: "text", text: instructions.join("\n") }];
  appendAttachmentParts(content, attachments);

  return chatWithKeys({
    keys,
    model,
    body: {
      messages: [
        { role: "system", content: PRODUCTION_GUARD + "\n\n" + config.system },
        { role: "user", content },
      ],
      temperature: 0.2,
      max_tokens: 4096,
    },
  });
}