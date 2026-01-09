import 'dotenv/config';
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompts config
const promptsPath = path.join(__dirname, "../../config/exercise-prompts.json");
let PROMPTS = null;

async function loadPrompts() {
  if (!PROMPTS) {
    const data = await fs.readFile(promptsPath, "utf-8");
    PROMPTS = JSON.parse(data);
  }
  return PROMPTS;
}

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

/**
 * Extract JSON from a response that may contain markdown code blocks
 */
function extractJson(text) {
  // Try to extract from markdown code block first
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  // Otherwise return the text as-is
  return text.trim();
}

/**
 * Research an exercise using Claude AI
 * @param {string} exerciseName - Name of the exercise to research
 * @returns {Promise<Object>} Exercise research data
 */
export async function researchExercise(exerciseName) {
  const prompts = await loadPrompts();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: prompts.research.system,
    messages: [
      {
        role: "user",
        content: `Research this exercise and return JSON matching the schema: ${exerciseName}

Return ONLY valid JSON with these fields:
- exercise_name: the canonical name
- display_name: human-friendly display name
- muscles.primary: array of primary muscles worked
- muscles.secondary: array of secondary muscles
- form_cues: array of key form tips
- common_mistakes: array of mistakes to avoid
- safety_notes: array of safety considerations

No markdown, no explanation, just the JSON object.`
      }
    ]
  });

  const text = message.content[0].text;
  const jsonText = extractJson(text);
  return JSON.parse(jsonText);
}

/**
 * Generate a TTS script for an exercise video
 * @param {Object} exerciseData - Exercise research data
 * @returns {Promise<Object>} Script data with segments
 */
export async function generateScript(exerciseData) {
  const prompts = await loadPrompts();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: prompts.script.system,
    messages: [
      {
        role: "user",
        content: `Generate a TTS script for this exercise:
${JSON.stringify(exerciseData, null, 2)}

Return JSON with:
- tts_full_text: the complete voiceover script (under 60 seconds when spoken)
- segments: array of objects, each with:
  - tts_segment: the text for this segment
  - muscle_callouts: array of muscles to highlight during this segment
  - is_animation_sequence: boolean, true if this shows movement
  - sequence_name: string name if is_animation_sequence is true

No markdown, no explanation, just the JSON object.`
      }
    ]
  });

  const text = message.content[0].text;
  const jsonText = extractJson(text);
  return JSON.parse(jsonText);
}

/**
 * Plan visual shots for the video
 * @param {Object} exerciseData - Exercise research data
 * @param {Object} scriptData - Script with segments
 * @param {Array} anchors - Available anchor images
 * @returns {Promise<Object>} Shot plan
 */
export async function planShots(exerciseData, scriptData, anchors) {
  const prompts = await loadPrompts();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    system: prompts.shot_planning.system,
    messages: [
      {
        role: "user",
        content: `Plan shots for this exercise video.

Exercise: ${JSON.stringify(exerciseData, null, 2)}

Script segments: ${JSON.stringify(scriptData.segments, null, 2)}

Available anchors (use ONLY these IDs): ${JSON.stringify(anchors, null, 2)}

Return JSON with a "shots" array. Each shot object must have:
- shot_id: string like "01-intro", "02-setup" (numbered prefix + descriptive name)
- shot_name: human-friendly name
- anchor_image: filename like "front.png", "bent.png" (must match an anchor id + .png)
- tts_segment_index: which segment this shot accompanies (0-indexed)
- visual_description: what the character is doing in this shot
- highlighted_muscles: array of muscles to highlight (empty if none)
- is_sequence_frame: boolean, true if part of animation sequence
- sequence_name: string if is_sequence_frame, null otherwise
- sequence_order: number if is_sequence_frame, null otherwise
- sequence_total: total frames if is_sequence_frame, null otherwise

No markdown, no explanation, just the JSON object.`
      }
    ]
  });

  const text = message.content[0].text;
  const jsonText = extractJson(text);
  return JSON.parse(jsonText);
}

/**
 * Plan animation frames for a movement sequence
 * @param {string} sequenceName - Name of the sequence
 * @param {string} movementDescription - Description of the movement
 * @param {string} anchor - Anchor image to use
 * @returns {Promise<Object>} Frame plan
 */
export async function planAnimationFrames(sequenceName, movementDescription, anchor) {
  const prompts = await loadPrompts();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: prompts.animation_frames.system,
    messages: [
      {
        role: "user",
        content: `Plan 3-5 animation frames for: ${sequenceName}

Movement: ${movementDescription}
Anchor image to use: ${anchor}

Return JSON with:
- sequence_name: "${sequenceName}"
- total_frames: number between 3 and 5
- anchor: "${anchor}"
- frames: array of frame objects, each with:
  - frame_order: 1, 2, 3, etc.
  - position_description: detailed body position
  - body_changes: what changed from previous frame

No markdown, no explanation, just the JSON object.`
      }
    ]
  });

  const text = message.content[0].text;
  const jsonText = extractJson(text);
  return JSON.parse(jsonText);
}
