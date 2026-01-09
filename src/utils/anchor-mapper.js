import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let ANCHORS = null;

async function loadAnchors() {
  if (!ANCHORS) {
    const anchorsPath = path.join(__dirname, "../../config/anchors.json");
    const data = await fs.readFile(anchorsPath, "utf-8");
    ANCHORS = JSON.parse(data);
  }
  return ANCHORS;
}

// Exercise type to anchor mapping
// Order matters - more specific terms should come first
const EXERCISE_ANCHOR_MAP = {
  // Supine exercises (check before "press" to catch "bench press")
  "bench press": "lying",
  "bench": "lying",
  "lying": "lying",
  "skull": "lying",
  "floor": "lying",
  "supine": "lying",

  // Bent-over movements
  "row": "bent",
  "bent": "bent",
  "rdl": "bent",
  "romanian": "bent",
  "deadlift_start": "bent",

  // Overhead movements
  "shoulder press": "hands-up",
  "overhead": "hands-up",
  "military press": "hands-up",
  "pulldown_start": "hands-up",

  // Hanging movements
  "pullup": "hanging",
  "chinup": "hanging",
  "hanging": "hanging",
  "pull-up": "hanging",
  "chin-up": "hanging",

  // Seated exercises
  "seated": "seated",
  "cable_row": "seated",
  "lat_pulldown": "seated",
  "leg_extension": "seated",

  // Front-facing
  "curl": "front",
  "front": "front",
  "shrug": "front",
  "deadlift_lockout": "front",
  "lateral_raise": "front",

  // Back views
  "back": "back",
  "rear": "back",
  "lat_spread": "back",

  // Side profile
  "squat": "side",
  "lunge": "quarter",
  "plank": "side",
  "pushup": "side",
  "push-up": "side",
  "calf": "side",
};

/**
 * Map an exercise keyword to an appropriate anchor image
 * @param {string} exerciseKeyword - Exercise name or keyword
 * @returns {Promise<string>} Anchor ID (e.g., "front", "bent", "hanging")
 */
export async function mapExerciseToAnchor(exerciseKeyword) {
  const anchors = await loadAnchors();
  const keyword = exerciseKeyword.toLowerCase().replace(/[-_]/g, " ");

  // Check direct matches first
  for (const [key, anchor] of Object.entries(EXERCISE_ANCHOR_MAP)) {
    if (keyword.includes(key)) {
      return anchor;
    }
  }

  // Check anchors use_for array
  for (const anchor of anchors.anchors) {
    for (const useCase of anchor.use_for) {
      if (keyword.includes(useCase.toLowerCase())) {
        return anchor.id;
      }
    }
  }

  // Default to front
  return "front";
}

/**
 * Get the full path to an anchor image
 * @param {string} anchorId - Anchor ID (e.g., "front", "bent")
 * @param {string} anchorsDir - Directory containing anchor images
 * @returns {Promise<string>} Full path to anchor image
 */
export async function getAnchorPath(anchorId, anchorsDir) {
  return path.join(anchorsDir, `${anchorId}.png`);
}

/**
 * Get all available anchors with their metadata
 * @returns {Promise<Array>} Array of anchor objects
 */
export async function getAllAnchors() {
  const anchors = await loadAnchors();
  return anchors.anchors.map(a => ({
    id: a.id,
    name: a.name,
    use_for: a.use_for
  }));
}
