import Anthropic from "@anthropic-ai/sdk";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load prompts config
const promptsPath = path.join(__dirname, "../../config/exercise-prompts.json");
let PROMPTS_CONFIG = null;

async function loadPromptsConfig() {
  if (!PROMPTS_CONFIG) {
    const data = await fs.readFile(promptsPath, "utf-8");
    PROMPTS_CONFIG = JSON.parse(data);
  }
  return PROMPTS_CONFIG;
}

// Initialize Anthropic client
const anthropic = new Anthropic();

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Convert file to base64 WITHOUT data URL prefix
 * Claude Vision API requires raw base64, not data URLs
 */
async function fileToBase64(filepath) {
  const buffer = await fs.readFile(filepath);
  return buffer.toString("base64");
}

/**
 * Get media type from file extension
 */
function getMediaType(filepath) {
  const ext = path.extname(filepath).toLowerCase();
  const types = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return types[ext] || "image/png";
}

// ============================================
// VALIDATION FUNCTION
// ============================================

/**
 * Validate an image against the original prompt and anchor reference
 *
 * @param {string} imagePath - Path to the generated image
 * @param {string} anchorPath - Path to the anchor reference image
 * @param {string} prompt - The prompt used to generate the image
 * @param {string} ttsContext - The TTS script context for this shot
 * @returns {object} Validation result with scores and feedback
 */
export async function validateImage(imagePath, anchorPath, prompt, ttsContext) {
  const config = await loadPromptsConfig();
  const validationConfig = config.validation;

  // Load images as base64 (NOT data URLs)
  const generatedBase64 = await fileToBase64(imagePath);
  const anchorBase64 = await fileToBase64(anchorPath);

  const generatedMediaType = getMediaType(imagePath);
  const anchorMediaType = getMediaType(anchorPath);

  // Build criteria description for the prompt
  const criteriaDesc = Object.entries(validationConfig.criteria)
    .map(([key, val]) => `- ${key} (weight: ${val.weight}): ${val.description}`)
    .join("\n");

  const userPrompt = `Analyze these two images:
1. ANCHOR IMAGE (reference): This is the character reference that should be maintained
2. GENERATED IMAGE: This was generated with the following prompt:

PROMPT: "${prompt}"

TTS CONTEXT: "${ttsContext}"

Evaluate the GENERATED IMAGE on these 5 criteria:
${criteriaDesc}

Respond with ONLY valid JSON (no markdown, no code blocks) in this exact format:
{
  "overall_pass": true/false (true if confidence >= ${validationConfig.confidence_threshold}),
  "confidence": 0.0-1.0 (weighted average of all criteria),
  "criteria_scores": {
    "character_consistency": 0.0-1.0,
    "pose_accuracy": 0.0-1.0,
    "muscle_highlighting": 0.0-1.0,
    "matches_tts_context": 0.0-1.0,
    "no_hallucinations": 0.0-1.0
  },
  "issues": ["specific problem 1", "specific problem 2"],
  "suggestions": ["actionable improvement 1", "actionable improvement 2"]
}`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: anchorMediaType,
                data: anchorBase64,
              },
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: generatedMediaType,
                data: generatedBase64,
              },
            },
            {
              type: "text",
              text: userPrompt,
            },
          ],
        },
      ],
      system: validationConfig.system,
    });

    // Extract text response
    const textContent = response.content.find(c => c.type === "text");
    if (!textContent) {
      throw new Error("No text response from Claude");
    }

    // Parse JSON response
    const jsonStr = textContent.text.trim();
    const result = JSON.parse(jsonStr);

    return {
      success: true,
      ...result,
    };
  } catch (error) {
    // Handle JSON parse errors by attempting to extract JSON
    if (error instanceof SyntaxError) {
      console.error("Failed to parse Claude response as JSON");
      return {
        success: false,
        overall_pass: false,
        confidence: 0,
        criteria_scores: {
          character_consistency: 0,
          pose_accuracy: 0,
          muscle_highlighting: 0,
          matches_tts_context: 0,
          no_hallucinations: 0,
        },
        issues: ["Failed to parse validation response"],
        suggestions: ["Retry validation"],
        error: error.message,
      };
    }
    throw error;
  }
}

// ============================================
// PROMPT REFINEMENT FUNCTION
// ============================================

/**
 * Refine a prompt based on validation feedback
 *
 * @param {string} originalPrompt - The original generation prompt
 * @param {string[]} issues - List of issues found during validation
 * @param {string[]} suggestions - List of improvement suggestions
 * @param {object} criteriaScores - Scores for each validation criterion
 * @returns {string} Refined prompt
 */
export async function refinePrompt(originalPrompt, issues, suggestions, criteriaScores) {
  const config = await loadPromptsConfig();
  const refinementConfig = config.prompt_refinement;

  // Identify lowest scoring criteria
  const sortedCriteria = Object.entries(criteriaScores)
    .sort(([, a], [, b]) => a - b)
    .slice(0, 2)
    .map(([key, score]) => `${key}: ${score.toFixed(2)}`);

  const userPrompt = `Original prompt:
"${originalPrompt}"

Validation issues found:
${issues.map(i => `- ${i}`).join("\n")}

Improvement suggestions:
${suggestions.map(s => `- ${s}`).join("\n")}

Lowest scoring criteria:
${sortedCriteria.join("\n")}

Constraints:
${refinementConfig.constraints.map(c => `- ${c}`).join("\n")}

Create an improved prompt that addresses these issues. Return ONLY the refined prompt text, no explanation or additional text.`;

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: userPrompt,
        },
      ],
      system: refinementConfig.system,
    });

    const textContent = response.content.find(c => c.type === "text");
    if (!textContent) {
      throw new Error("No text response from Claude");
    }

    return textContent.text.trim();
  } catch (error) {
    console.error("Prompt refinement failed:", error.message);
    // Return original prompt if refinement fails
    return originalPrompt;
  }
}

// ============================================
// EXPORTS
// ============================================
export default {
  validateImage,
  refinePrompt,
};
