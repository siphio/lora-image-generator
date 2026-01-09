# Feature: Phase 4 - Video Script Generator (Script Generation Foundation)

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files.

## Feature Description

Build the script generation engine that transforms an exercise name into a complete video script package. This phase creates the foundation for automated fitness content: AI-researched exercise data, engaging TTS scripts, shot planning with anchor mapping, and engineered prompts ready for image generation.

The system takes an exercise name (e.g., "bent-over-barbell-row") and outputs a structured folder with:
- Exercise research (muscles, form cues)
- TTS voiceover script
- Shot list with anchor mappings
- Engineered prompts for each shot (prompt.json files)
- Animation sequence planning (3-5 frame sequences for movement)

## User Story

As a fitness content creator,
I want to input an exercise name and receive a complete script package with AI-researched content and image prompts,
So that I can rapidly produce consistent, educational fitness videos without manual research or prompt engineering.

## Problem Statement

Creating fitness video content requires:
1. Manual research on muscle groups, form cues, and technique
2. Writing engaging TTS scripts from scratch
3. Planning shots and mapping them to appropriate character poses
4. Engineering prompts for consistent AI image generation
5. Coordinating animation sequences for exercise movements

This is time-consuming and error-prone when done manually for each exercise.

## Solution Statement

Build an automated pipeline that:
1. Uses Claude AI to research exercise mechanics and muscles
2. Generates engaging, personal-trainer-style TTS scripts
3. Plans video segments and maps them to the 9 existing anchor images
4. Produces engineered prompts following project conventions
5. Identifies animation sequences and plans 3-5 frame progressions
6. Creates structured output folders with JSON metadata

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: `src/`, `output/video-scripts/`, `config/`
**Dependencies**: `@anthropic-ai/sdk` (new), existing `@fal-ai/client`, `dotenv`, `fs/promises`

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

- `src/phase2-variations.js` (lines 1-50) - Why: ES module imports, fal.ai config, CHARACTER definition pattern
- `src/phase2-variations.js` (lines 123-182) - Why: Helper functions (ensureDir, downloadImage, fileToDataUrl, getAnchorImage)
- `src/phase2-variations.js` (lines 186-294) - Why: Main generation loop with ASCII logging pattern
- `src/phase3-train-lora.js` (lines 17-46) - Why: CONFIG object structure pattern
- `src/phase3-train-lora.js` (lines 128-172) - Why: prepareTrainingData pattern with file scanning
- `src/gallery-server.js` (lines 1-20) - Why: Express server pattern if needed
- `config/character.json` - Why: Character definition schema, generation_settings
- `config/anchors.json` - Why: Anchor definitions with use_for mappings
- `config/variations.json` - Why: Variation structure with muscles_highlighted field
- `CLAUDE.md` (lines 123-154) - Why: ASCII box logging format requirements
- `PRD.md` (lines 362-485) - Why: Data schemas for script.json, prompt.json, validation.json

### New Files to Create

- `src/phase4-script-generator.js` - Main script generation engine
- `src/utils/ai-client.js` - Claude API wrapper for exercise research and script generation
- `src/utils/anchor-mapper.js` - Exercise-to-anchor mapping logic
- `config/exercise-prompts.json` - System prompts for AI generation

### Relevant Documentation

- [Claude API Messages Create](https://docs.anthropic.com/en/api/messages)
  - Messages endpoint for text generation
  - Why: Core API for exercise research and script generation
- [fal-ai Client Documentation](https://docs.fal.ai/model-apis/client.md)
  - Client setup and subscribe patterns
  - Why: Reference for existing image generation patterns

### Patterns to Follow

**ES Module Imports:**
```javascript
import 'dotenv/config';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

**CONFIG Object Structure:**
```javascript
const CONFIG = {
  inputDir: path.join(__dirname, "..."),
  outputDir: path.join(__dirname, "../output/video-scripts"),
  anchorsDir: path.join(__dirname, "../output/anchors-selected"),
  ai: {
    model: "claude-sonnet-4-20250514",
    maxTokens: 4096,
  },
};
```

**ASCII Box Logging:**
```javascript
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PHASE 4: SCRIPT GENERATION                          ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
╚═══════════════════════════════════════════════════════════════╝
`);
```

**Progress Logging:**
```javascript
console.log(`\n┌─ ${stepName}`);
console.log(`│  🔄 Processing...`);
console.log(`│  ✅ Done`);
console.log(`│  ❌ Error: ${error.message}`);
console.log(`└─ Complete\n`);
```

**Skip-if-exists Pattern:**
```javascript
try {
  await fs.access(filepath);
  console.log(`│  ⏭️  ${filename} exists, skipping`);
  return existingData;
} catch {}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

Set up AI client, configuration, and utility modules.

**Tasks:**
- Install @anthropic-ai/sdk dependency
- Create ai-client.js wrapper for Claude API
- Create anchor-mapper.js for exercise-to-anchor mapping
- Create exercise-prompts.json with system prompts

### Phase 2: Core Implementation

Build the main script generation engine.

**Tasks:**
- Create phase4-script-generator.js with CONFIG and helpers
- Implement exercise research function (AI-powered)
- Implement TTS script generation function
- Implement shot planning with anchor mapping
- Implement prompt.json generation for each shot
- Implement animation sequence detection and frame planning

### Phase 3: Integration

Connect components and create output structure.

**Tasks:**
- Wire up all functions in main generation pipeline
- Create folder structure (shots/, etc.)
- Generate metadata files (script.json, tts-script.txt)
- Add npm script command

### Phase 4: Testing & Validation

Verify output structure and content quality.

**Tasks:**
- Run with test exercise "bent-over-barbell-row"
- Validate folder structure matches PRD
- Validate JSON schemas
- Manual review of generated content

---

## STEP-BY-STEP TASKS

### Task 1: ADD @anthropic-ai/sdk dependency

- **IMPLEMENT**: Add Anthropic SDK to package.json
- **VALIDATE**: `npm install @anthropic-ai/sdk && node -e "require('@anthropic-ai/sdk')"`

```bash
npm install @anthropic-ai/sdk
```

### Task 2: CREATE config/exercise-prompts.json

- **IMPLEMENT**: System prompts for AI exercise research and script generation
- **PATTERN**: Follow config/character.json structure
- **VALIDATE**: `node -e "console.log(JSON.parse(require('fs').readFileSync('config/exercise-prompts.json')))"`

```json
{
  "research": {
    "system": "You are a certified personal trainer and exercise physiologist. Research the given exercise and return structured JSON with muscles, form cues, and safety notes.",
    "output_schema": {
      "exercise_name": "string",
      "display_name": "string",
      "muscles": {
        "primary": ["string"],
        "secondary": ["string"]
      },
      "form_cues": ["string"],
      "common_mistakes": ["string"],
      "safety_notes": ["string"]
    }
  },
  "script": {
    "system": "You are an energetic, motivational fitness content creator. Generate a TTS voiceover script for a short-form video about the exercise. Keep it under 60 seconds when spoken. Use short, punchy sentences. Include muscle callouts where the viewer should see highlighted muscles.",
    "style": "personal_trainer",
    "max_duration_seconds": 60
  },
  "shot_planning": {
    "system": "You are a video director planning shots for a fitness tutorial. Given exercise research and script, plan the visual shots needed. Each shot should map to an anchor image. Identify sequences that need animation (3-5 frames showing movement)."
  },
  "animation_frames": {
    "system": "You are planning animation frames for an exercise movement. Given a movement description, plan 3-5 frames that show the progression. Each frame should have the same camera angle and anchor image. Describe body position changes between frames."
  }
}
```

### Task 3: CREATE src/utils/ai-client.js

- **IMPLEMENT**: Claude API wrapper with exercise research and script generation
- **PATTERN**: Mirror fal.ai client setup from phase2-variations.js:10-13
- **IMPORTS**: `import Anthropic from "@anthropic-ai/sdk"`
- **GOTCHA**: API key from ANTHROPIC_API_KEY env var
- **VALIDATE**: `node -e "import('./src/utils/ai-client.js').then(m => console.log(Object.keys(m)))"`

```javascript
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

export async function researchExercise(exerciseName) {
  const prompts = await loadPrompts();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: prompts.research.system,
    messages: [
      {
        role: "user",
        content: `Research this exercise and return JSON matching the schema: ${exerciseName}\n\nReturn ONLY valid JSON, no markdown.`
      }
    ]
  });

  const text = message.content[0].text;
  return JSON.parse(text);
}

export async function generateScript(exerciseData) {
  const prompts = await loadPrompts();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: prompts.script.system,
    messages: [
      {
        role: "user",
        content: `Generate a TTS script for this exercise:\n${JSON.stringify(exerciseData, null, 2)}\n\nReturn JSON with:\n- tts_full_text: the complete script\n- segments: array of {tts_segment, muscle_callouts[], is_animation_sequence, sequence_name?}`
      }
    ]
  });

  const text = message.content[0].text;
  return JSON.parse(text);
}

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

Available anchors (use ONLY these): ${JSON.stringify(anchors, null, 2)}

Return JSON array of shots:
{
  "shots": [
    {
      "shot_id": "01-intro",
      "shot_name": "Introduction",
      "anchor_image": "front.png",
      "tts_segment_index": 0,
      "visual_description": "...",
      "highlighted_muscles": [],
      "is_sequence_frame": false
    }
  ]
}`
      }
    ]
  });

  const text = message.content[0].text;
  return JSON.parse(text);
}

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

Return JSON:
{
  "sequence_name": "${sequenceName}",
  "total_frames": 3-5,
  "anchor": "${anchor}",
  "frames": [
    {
      "frame_order": 1,
      "position_description": "Starting position...",
      "body_changes": "Arms extended, muscles relaxed"
    }
  ]
}`
      }
    ]
  });

  const text = message.content[0].text;
  return JSON.parse(text);
}
```

### Task 4: CREATE src/utils/anchor-mapper.js

- **IMPLEMENT**: Exercise-to-anchor mapping utility
- **PATTERN**: Use config/anchors.json use_for field
- **VALIDATE**: `node -e "import('./src/utils/anchor-mapper.js').then(m => console.log(m.mapExerciseToAnchor('bench press')))"`

```javascript
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
const EXERCISE_ANCHOR_MAP = {
  // Bent-over movements
  "row": "bent",
  "bent": "bent",
  "rdl": "bent",
  "romanian": "bent",
  "deadlift_start": "bent",

  // Overhead movements
  "press": "hands-up",
  "overhead": "hands-up",
  "shoulder": "hands-up",
  "pulldown_start": "hands-up",

  // Supine exercises
  "bench": "lying",
  "lying": "lying",
  "skull": "lying",
  "floor": "lying",
  "supine": "lying",

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

export async function getAnchorPath(anchorId, anchorsDir) {
  return path.join(anchorsDir, `${anchorId}.png`);
}

export async function getAllAnchors() {
  const anchors = await loadAnchors();
  return anchors.anchors.map(a => ({
    id: a.id,
    name: a.name,
    use_for: a.use_for
  }));
}
```

### Task 5: CREATE src/phase4-script-generator.js

- **IMPLEMENT**: Main script generation pipeline
- **PATTERN**: Mirror phase3-train-lora.js structure (CONFIG, helpers, step functions, main)
- **IMPORTS**: ai-client.js, anchor-mapper.js, fs, path
- **GOTCHA**: Check ANTHROPIC_API_KEY at startup like FAL_KEY check
- **VALIDATE**: `node src/phase4-script-generator.js "bicep-curl" --dry-run`

```javascript
import 'dotenv/config';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { researchExercise, generateScript, planShots, planAnimationFrames } from "./utils/ai-client.js";
import { mapExerciseToAnchor, getAllAnchors, getAnchorPath } from "./utils/anchor-mapper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  anchorsDir: path.join(__dirname, "../output/anchors-selected"),
  outputDir: path.join(__dirname, "../output/video-scripts"),
  character: null, // Loaded dynamically
};

// ============================================
// HELPER FUNCTIONS
// ============================================
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadCharacter() {
  const charPath = path.join(__dirname, "../config/character.json");
  const data = await fs.readFile(charPath, "utf-8");
  return JSON.parse(data);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ============================================
// STEP 1: RESEARCH EXERCISE
// ============================================
async function stepResearchExercise(exerciseName, exerciseDir) {
  console.log(`\n┌─ Step 1: Research Exercise`);
  console.log(`│  Exercise: ${exerciseName}`);

  const researchPath = path.join(exerciseDir, "research.json");

  // Skip if exists
  try {
    await fs.access(researchPath);
    console.log(`│  ⏭️  research.json exists, loading`);
    const data = await fs.readFile(researchPath, "utf-8");
    console.log(`└─ Loaded existing research\n`);
    return JSON.parse(data);
  } catch {}

  console.log(`│  🔄 Researching via Claude AI...`);

  try {
    const research = await researchExercise(exerciseName);
    await fs.writeFile(researchPath, JSON.stringify(research, null, 2));
    console.log(`│  ✅ Research complete`);
    console.log(`│     Primary muscles: ${research.muscles.primary.join(", ")}`);
    console.log(`│     Secondary muscles: ${research.muscles.secondary.join(", ")}`);
    console.log(`└─ Saved to research.json\n`);
    return research;
  } catch (error) {
    console.log(`│  ❌ Error: ${error.message}`);
    console.log(`└─ Failed\n`);
    throw error;
  }
}

// ============================================
// STEP 2: GENERATE TTS SCRIPT
// ============================================
async function stepGenerateScript(exerciseData, exerciseDir) {
  console.log(`\n┌─ Step 2: Generate TTS Script`);

  const scriptPath = path.join(exerciseDir, "script.json");
  const ttsPath = path.join(exerciseDir, "tts-script.txt");

  // Skip if exists
  try {
    await fs.access(scriptPath);
    console.log(`│  ⏭️  script.json exists, loading`);
    const data = await fs.readFile(scriptPath, "utf-8");
    console.log(`└─ Loaded existing script\n`);
    return JSON.parse(data);
  } catch {}

  console.log(`│  🔄 Generating script via Claude AI...`);

  try {
    const scriptData = await generateScript(exerciseData);

    // Build full script.json
    const fullScript = {
      exercise: slugify(exerciseData.exercise_name),
      exercise_display_name: exerciseData.display_name,
      created_at: new Date().toISOString(),
      muscles: exerciseData.muscles,
      tts_script_file: "tts-script.txt",
      tts_full_text: scriptData.tts_full_text,
      total_shots: 0, // Updated later
      segments: scriptData.segments,
    };

    await fs.writeFile(scriptPath, JSON.stringify(fullScript, null, 2));
    await fs.writeFile(ttsPath, scriptData.tts_full_text);

    console.log(`│  ✅ Script generated`);
    console.log(`│     Segments: ${scriptData.segments.length}`);
    console.log(`│     Word count: ${scriptData.tts_full_text.split(/\s+/).length}`);
    console.log(`└─ Saved to script.json and tts-script.txt\n`);

    return fullScript;
  } catch (error) {
    console.log(`│  ❌ Error: ${error.message}`);
    console.log(`└─ Failed\n`);
    throw error;
  }
}

// ============================================
// STEP 3: PLAN SHOTS
// ============================================
async function stepPlanShots(exerciseData, scriptData, exerciseDir) {
  console.log(`\n┌─ Step 3: Plan Shots`);

  const shotsDir = path.join(exerciseDir, "shots");
  await ensureDir(shotsDir);

  console.log(`│  🔄 Planning shots via Claude AI...`);

  try {
    const anchors = await getAllAnchors();
    const shotPlan = await planShots(exerciseData, scriptData, anchors);

    console.log(`│  ✅ Shot plan created`);
    console.log(`│     Total shots: ${shotPlan.shots.length}`);

    // Identify animation sequences
    const sequences = [];
    for (const segment of scriptData.segments) {
      if (segment.is_animation_sequence) {
        sequences.push({
          name: segment.sequence_name,
          segment_index: scriptData.segments.indexOf(segment),
        });
      }
    }

    if (sequences.length > 0) {
      console.log(`│  🎬 Animation sequences found: ${sequences.length}`);
    }

    console.log(`└─ Proceeding to create shot folders\n`);

    return { shots: shotPlan.shots, sequences };
  } catch (error) {
    console.log(`│  ❌ Error: ${error.message}`);
    console.log(`└─ Failed\n`);
    throw error;
  }
}

// ============================================
// STEP 4: CREATE SHOT FOLDERS & PROMPTS
// ============================================
async function stepCreateShotPrompts(shots, sequences, exerciseData, scriptData, exerciseDir, character) {
  console.log(`\n┌─ Step 4: Create Shot Prompts`);

  const shotsDir = path.join(exerciseDir, "shots");
  let created = 0;
  let skipped = 0;

  for (const shot of shots) {
    const shotDir = path.join(shotsDir, shot.shot_id);
    await ensureDir(shotDir);

    const promptPath = path.join(shotDir, "prompt.json");

    // Skip if exists
    try {
      await fs.access(promptPath);
      console.log(`│  ⏭️  ${shot.shot_id}/prompt.json exists`);
      skipped++;
      continue;
    } catch {}

    // Build engineered prompt
    const muscleHighlightText = shot.highlighted_muscles.length > 0
      ? `, ${shot.highlighted_muscles.join(" and ")} muscles highlighted in bright red glowing overlay`
      : "";

    const engineeredPrompt = `${character.base_prompt}, ${shot.visual_description}${muscleHighlightText}`;

    const promptJson = {
      shot_id: shot.shot_id,
      shot_name: shot.shot_name,
      anchor_image: `output/anchors-selected/${shot.anchor_image}`,
      visual_description: shot.visual_description,
      highlighted_muscles: shot.highlighted_muscles,
      engineered_prompt: engineeredPrompt,
      is_sequence_frame: shot.is_sequence_frame || false,
      sequence_name: shot.sequence_name || null,
      sequence_order: shot.sequence_order || null,
      sequence_total: shot.sequence_total || null,
      iteration: 1,
      max_iterations: 2,
      prompt_history: [],
    };

    await fs.writeFile(promptPath, JSON.stringify(promptJson, null, 2));
    console.log(`│  ✅ ${shot.shot_id}/prompt.json created`);
    created++;
  }

  // Handle animation sequences
  for (const seq of sequences) {
    console.log(`│  🎬 Planning animation: ${seq.name}`);

    // Find shots for this sequence
    const seqShots = shots.filter(s => s.sequence_name === seq.name);
    if (seqShots.length === 0) {
      // Need to generate animation frames
      const segment = scriptData.segments[seq.segment_index];
      const anchor = await mapExerciseToAnchor(exerciseData.exercise_name);

      console.log(`│     Generating ${seq.name} frames...`);

      try {
        const frames = await planAnimationFrames(seq.name, segment.tts_segment, anchor);

        for (let i = 0; i < frames.frames.length; i++) {
          const frame = frames.frames[i];
          const frameId = `${String(shots.length + i + 1).padStart(2, "0")}-${seq.name}-frame-${frame.frame_order}`;
          const frameDir = path.join(shotsDir, frameId);
          await ensureDir(frameDir);

          const framePrompt = {
            shot_id: frameId,
            shot_name: `${seq.name} Frame ${frame.frame_order}`,
            anchor_image: `output/anchors-selected/${frames.anchor}.png`,
            visual_description: frame.position_description,
            highlighted_muscles: [],
            engineered_prompt: `${character.base_prompt}, ${frame.position_description}, ${frame.body_changes}`,
            is_sequence_frame: true,
            sequence_name: seq.name,
            sequence_order: frame.frame_order,
            sequence_total: frames.total_frames,
            iteration: 1,
            max_iterations: 2,
            prompt_history: [],
          };

          await fs.writeFile(path.join(frameDir, "prompt.json"), JSON.stringify(framePrompt, null, 2));
          console.log(`│     ✅ ${frameId}/prompt.json created`);
          created++;
        }
      } catch (error) {
        console.log(`│     ❌ Animation planning failed: ${error.message}`);
      }
    }
  }

  console.log(`│  Created: ${created} prompts`);
  console.log(`│  Skipped: ${skipped} prompts`);
  console.log(`└─ Shot prompts complete\n`);

  return created + skipped;
}

// ============================================
// STEP 5: UPDATE SCRIPT WITH SHOT COUNT
// ============================================
async function stepFinalizeScript(exerciseDir, totalShots) {
  console.log(`\n┌─ Step 5: Finalize Script`);

  const scriptPath = path.join(exerciseDir, "script.json");
  const data = await fs.readFile(scriptPath, "utf-8");
  const script = JSON.parse(data);

  script.total_shots = totalShots;

  await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));

  console.log(`│  ✅ Updated total_shots: ${totalShots}`);
  console.log(`└─ Script finalized\n`);
}

// ============================================
// MAIN
// ============================================
async function main() {
  const exerciseName = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");

  if (!exerciseName) {
    console.error("Usage: node phase4-script-generator.js <exercise-name> [--dry-run]");
    console.error("Example: node phase4-script-generator.js bent-over-barbell-row");
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗ ██████╗██████╗ ██╗██████╗ ████████╗                ║
║   ██╔════╝██╔════╝██╔══██╗██║██╔══██╗╚══██╔══╝                ║
║   ███████╗██║     ██████╔╝██║██████╔╝   ██║                   ║
║   ╚════██║██║     ██╔══██╗██║██╔═══╝    ██║                   ║
║   ███████║╚██████╗██║  ██║██║██║        ██║                   ║
║   ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝        ╚═╝                   ║
║                                                               ║
║   PHASE 4: VIDEO SCRIPT GENERATOR                             ║
║   Generate complete video content packages                    ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
║  Mode: ${dryRun ? "DRY RUN (no AI calls)".padEnd(48) : "FULL GENERATION".padEnd(48)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not found in .env file");
    process.exit(1);
  }

  // Validate anchors directory
  try {
    await fs.access(CONFIG.anchorsDir);
  } catch {
    console.error(`❌ Anchors directory not found: ${CONFIG.anchorsDir}`);
    console.error("   Run phase 1 and 2 first to generate anchor images.");
    process.exit(1);
  }

  // Load character
  CONFIG.character = await loadCharacter();

  // Create exercise directory
  const exerciseSlug = slugify(exerciseName);
  const exerciseDir = path.join(CONFIG.outputDir, exerciseSlug);
  await ensureDir(exerciseDir);

  console.log(`📁 Output directory: ${exerciseDir}\n`);

  try {
    // Step 1: Research
    const exerciseData = await stepResearchExercise(exerciseName, exerciseDir);

    // Step 2: Generate Script
    const scriptData = await stepGenerateScript(exerciseData, exerciseDir);

    // Step 3: Plan Shots
    const { shots, sequences } = await stepPlanShots(exerciseData, scriptData, exerciseDir);

    // Step 4: Create Shot Prompts
    const totalShots = await stepCreateShotPrompts(
      shots,
      sequences,
      exerciseData,
      scriptData,
      exerciseDir,
      CONFIG.character
    );

    // Step 5: Finalize
    await stepFinalizeScript(exerciseDir, totalShots);

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎉 SCRIPT GENERATION COMPLETE                                ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseSlug.padEnd(45)}║
║  Total shots: ${String(totalShots).padEnd(42)}║
║  Output: output/video-scripts/${exerciseSlug.padEnd(25)}║
╠═══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                  ║
║  1. Review script.json and tts-script.txt                     ║
║  2. Run phase5 to generate images from prompts                ║
║  3. Run phase6 for validation and quality checks              ║
╚═══════════════════════════════════════════════════════════════╝
`);
  } catch (error) {
    console.error("\n❌ Script generation failed:", error.message);
    process.exit(1);
  }
}

main();
```

### Task 6: UPDATE package.json with phase4 script

- **IMPLEMENT**: Add npm run phase4 command
- **PATTERN**: Match existing phase1, phase2, phase3 scripts
- **VALIDATE**: `npm run phase4 -- --help` (should show usage)

```json
{
  "scripts": {
    "phase4": "node src/phase4-script-generator.js"
  }
}
```

### Task 7: UPDATE .env with ANTHROPIC_API_KEY

- **IMPLEMENT**: Add ANTHROPIC_API_KEY placeholder
- **GOTCHA**: Don't commit actual key
- **VALIDATE**: `grep ANTHROPIC_API_KEY .env`

Add to .env:
```
ANTHROPIC_API_KEY=your-anthropic-api-key
```

---

## TESTING STRATEGY

### Unit Tests

No formal unit test framework in project. Manual validation approach.

### Integration Tests

Run full pipeline with test exercise:
```bash
npm run phase4 -- "bent-over-barbell-row"
```

Expected output structure:
```
output/video-scripts/bent-over-barbell-row/
├── research.json
├── script.json
├── tts-script.txt
└── shots/
    ├── 01-intro/
    │   └── prompt.json
    ├── 02-setup/
    │   └── prompt.json
    └── ...
```

### Edge Cases

1. **Exercise not found**: AI should still generate reasonable content
2. **Invalid exercise name**: Slugify handles special characters
3. **Missing anchor**: Falls back to "front" anchor
4. **API rate limits**: No explicit handling (manual retry)
5. **Existing files**: Skip-if-exists pattern handles resumability

---

## VALIDATION COMMANDS

### Level 1: Syntax & Dependencies

```bash
# Install new dependency
npm install @anthropic-ai/sdk

# Check imports work
node -e "import('./src/utils/ai-client.js').then(() => console.log('✅ ai-client.js'))"
node -e "import('./src/utils/anchor-mapper.js').then(() => console.log('✅ anchor-mapper.js'))"
node -e "import('./src/phase4-script-generator.js').catch(e => console.log('Expected: needs exercise arg'))"
```

### Level 2: Config Validation

```bash
# Validate JSON configs
node -e "console.log(JSON.parse(require('fs').readFileSync('config/exercise-prompts.json')))"
```

### Level 3: Functional Test

```bash
# Full generation test
npm run phase4 -- "bicep-curl"

# Verify output structure
ls -la output/video-scripts/bicep-curl/
ls -la output/video-scripts/bicep-curl/shots/
cat output/video-scripts/bicep-curl/script.json | head -20
```

### Level 4: Manual Validation

1. Open `output/video-scripts/bicep-curl/script.json`
2. Verify muscles.primary includes "biceps"
3. Verify tts_full_text reads naturally
4. Open random `shots/*/prompt.json`
5. Verify anchor_image path is valid
6. Verify engineered_prompt includes character base_prompt

---

## ACCEPTANCE CRITERIA

- [ ] `npm install @anthropic-ai/sdk` completes successfully
- [ ] `config/exercise-prompts.json` contains valid JSON with research, script, shot_planning, animation_frames keys
- [ ] `src/utils/ai-client.js` exports researchExercise, generateScript, planShots, planAnimationFrames
- [ ] `src/utils/anchor-mapper.js` exports mapExerciseToAnchor, getAnchorPath, getAllAnchors
- [ ] `src/phase4-script-generator.js` runs without syntax errors
- [ ] Running `npm run phase4 -- "bent-over-barbell-row"` creates complete folder structure
- [ ] `script.json` contains valid JSON matching PRD schema
- [ ] `tts-script.txt` contains readable voiceover text
- [ ] Each `shots/*/prompt.json` contains valid JSON matching PRD schema
- [ ] Animation sequences have 3-5 frames with sequential frame_order
- [ ] ASCII logging matches project style (box headers, tree progress)
- [ ] Skip-if-exists works (running twice doesn't regenerate existing files)
- [ ] Missing ANTHROPIC_API_KEY shows clear error message

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully:
  - [ ] Level 1: Dependency install, import checks
  - [ ] Level 2: Config validation
  - [ ] Level 3: Functional test with real exercise
  - [ ] Level 4: Manual content review
- [ ] Output structure matches PRD specification
- [ ] JSON schemas match PRD definitions
- [ ] ASCII logging follows CLAUDE.md conventions
- [ ] Skip-if-exists pattern implemented
- [ ] Error handling with clear messages
- [ ] All acceptance criteria met

---

## NOTES

### Design Decisions

1. **Separate AI client module**: Keeps API logic isolated, easier to mock/test
2. **Anchor mapper as utility**: Reusable for future phases, encapsulates mapping logic
3. **Step-based architecture**: Each step is independent, resumable, and testable
4. **JSON-first outputs**: All metadata in JSON for automation, plain text for TTS

### Trade-offs

1. **No streaming**: Using simple message API vs streaming for simplicity
2. **No parallel AI calls**: Sequential for easier debugging, rate limit safety
3. **Hard-coded model**: Using claude-sonnet-4-20250514, could be configurable

### Future Considerations

1. **Caching**: Could cache exercise research for common exercises
2. **Templates**: Could support different video styles (quick tips, deep dive)
3. **Batch processing**: Could process multiple exercises in one run
