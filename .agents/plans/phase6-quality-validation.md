# Feature: Phase 6 - Quality Validation & Auto-Regeneration (PRD Phase 3)

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files.

## Feature Description

Build the automated quality validation system that uses Claude's vision capabilities to analyze generated images against 5 quality criteria, automatically refines prompts and regenerates failed images (max 2 iterations), and produces validation reports for each shot plus an exercise-level summary.

The system:
- Loads each shot's prompt.json, image.png, and TTS context
- Uses Claude vision API to analyze image against 5 criteria
- Generates validation.json with pass/fail status and detailed notes
- On failure: refines prompt based on issues, regenerates image, re-validates
- After max iterations: flags shot for manual review
- Produces validation-summary.json for entire exercise

## User Story

As a fitness content creator,
I want automated quality checks on generated images with self-healing regeneration,
So that I can trust the output quality without manually reviewing every image while minimizing manual intervention needed.

## Problem Statement

After Phase 5 generates images:
1. Some images may not match the prompt (wrong pose, missing muscle highlights)
2. Character consistency may vary from the anchor reference
3. AI hallucinations may occur (extra limbs, artifacts)
4. Manual review of 6-10 images per video is tedious
5. Failed images need prompt refinement and regeneration
6. Need clear reporting on what passed/failed and why

## Solution Statement

Build an AI-powered validation system that:
1. Uses Claude vision to analyze each image against 5 criteria
2. Generates detailed validation.json for each shot
3. Automatically refines prompts for failed images
4. Regenerates failed images via nano-banana (max 2 iterations)
5. Flags images that still fail for manual review
6. Produces exercise-level validation-summary.json

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: High
**Primary Systems Affected**: `src/`, `output/video-scripts/`, `config/`
**Dependencies**: Existing `@anthropic-ai/sdk`, `@fal-ai/client`, `dotenv`, `fs/promises`

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

- `src/utils/ai-client.js` (lines 1-38) - Why: Anthropic client setup, extractJson helper
- `src/utils/ai-client.js` (lines 45-74) - Why: Pattern for Claude API calls with JSON response
- `src/phase5-batch-image-gen.js` (lines 1-65) - Why: fal.ai config, editImage function to reuse
- `src/phase5-batch-image-gen.js` (lines 70-107) - Why: getShotFolders, loadPromptJson helpers
- `src/phase5-batch-image-gen.js` (lines 109-131) - Why: getAnchorDataUrl with caching
- `src/phase5-batch-image-gen.js` (lines 136-237) - Why: Main loop pattern with progress tracking
- `src/phase4-script-generator.js` (lines 294-390) - Why: ASCII box logging, CLI pattern
- `config/character.json` - Why: Character definition for validation context
- `config/exercise-prompts.json` - Why: Will add validation prompts here
- `PRD.md` (lines 414-485) - Why: validation.json and validation-summary.json schemas

### New Files to Create

- `src/phase6-validation.js` - Main validation script
- `src/utils/vision-validator.js` - Claude vision analysis wrapper

### Output Structure Reference

```
output/video-scripts/[exercise-name]/
├── script.json
├── tts-script.txt
├── validation-summary.json     # NEW: exercise-level summary
└── shots/
    ├── 01-intro/
    │   ├── prompt.json
    │   ├── image.png
    │   └── validation.json     # NEW: shot-level validation
    └── ...
```

### Data Schemas from PRD

**validation.json (Approved)**:
```json
{
  "shot_id": "03-pull-start",
  "status": "approved",
  "iteration": 1,
  "confidence_score": 0.89,
  "checks": {
    "character_consistency": { "passed": true, "notes": "" },
    "pose_accuracy": { "passed": true, "notes": "" },
    "muscle_highlighting": { "passed": true, "notes": "N/A - no highlighting required" },
    "matches_tts_context": { "passed": true, "notes": "" },
    "no_hallucinations": { "passed": true, "notes": "" }
  },
  "issues": [],
  "flagged_for_manual_review": false
}
```

**validation.json (Rejected with history)**:
```json
{
  "shot_id": "05-pull-peak",
  "status": "rejected",
  "iteration": 2,
  "confidence_score": 0.42,
  "checks": {
    "character_consistency": { "passed": true, "notes": "" },
    "pose_accuracy": { "passed": false, "notes": "Bar position too high" },
    "muscle_highlighting": { "passed": false, "notes": "Lat highlighting not visible" },
    "matches_tts_context": { "passed": true, "notes": "" },
    "no_hallucinations": { "passed": true, "notes": "" }
  },
  "issues": ["Bar position incorrect", "Muscle highlighting not visible"],
  "flagged_for_manual_review": true,
  "rejection_history": [
    {
      "attempt": 1,
      "issues": ["Muscle highlighting absent"],
      "prompt_adjustment": "Added 'latissimus dorsi highlighted in bright red'"
    }
  ]
}
```

**validation-summary.json**:
```json
{
  "exercise": "bent-over-barbell-row",
  "generated_at": "2025-01-08T12:30:00Z",
  "total_shots": 6,
  "approved": 5,
  "rejected": 0,
  "flagged_for_review": 1,
  "shots": [
    { "id": "01-intro", "status": "approved" },
    { "id": "05-pull-peak", "status": "flagged_for_review" }
  ],
  "ready_for_assembly": false,
  "blocking_issues": ["Shot 05-pull-peak requires manual review"]
}
```

### Patterns to Follow

**ES Module Imports:**
```javascript
import 'dotenv/config';
import Anthropic from "@anthropic-ai/sdk";
import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

**Claude Vision API Call Pattern:**
```javascript
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 2048,
  messages: [
    {
      role: "user",
      content: [
        {
          type: "image",
          source: {
            type: "base64",
            media_type: "image/png",
            data: base64ImageData,  // WITHOUT data:image/png;base64, prefix
          },
        },
        {
          type: "text",
          text: "Analyze this image..."
        }
      ]
    }
  ]
});
```

**ASCII Box Logging:**
```javascript
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PHASE 6: QUALITY VALIDATION                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
║  Total shots: ${String(totalShots).padEnd(42)}║
╚═══════════════════════════════════════════════════════════════╝
`);
```

**Progress Logging:**
```javascript
console.log(`\n┌─ [${i + 1}/${total}] ${shot.id}`);
console.log(`│  🔍 Validating image...`);
console.log(`│  ✅ APPROVED (confidence: 0.89)`);
console.log(`│  ❌ FAILED: pose_accuracy, muscle_highlighting`);
console.log(`│  🔄 Regenerating with refined prompt...`);
console.log(`│  ⚠️  FLAGGED for manual review`);
console.log(`└─ Done`);
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

Set up vision validator utility and config.

**Tasks:**
- Add validation prompts to config/exercise-prompts.json
- Create src/utils/vision-validator.js with Claude vision analysis
- Implement 5-criteria validation logic

### Phase 2: Core Implementation

Build the main validation and regeneration loop.

**Tasks:**
- Create src/phase6-validation.js with CONFIG and helpers
- Implement shot scanning (reuse from phase5)
- Implement validation loop with iteration tracking
- Implement prompt refinement function
- Implement regeneration via nano-banana
- Generate validation.json for each shot

### Phase 3: Reporting

Generate exercise-level validation summary.

**Tasks:**
- Implement validation-summary.json generation
- Add ready_for_assembly flag logic
- Add blocking_issues array population

### Phase 4: CLI Integration

Add command-line interface and npm script.

**Tasks:**
- Add CLI argument parsing (exercise name, --all, --skip-regen flags)
- Add environment validation
- Add npm script command
- Add completion summary

---

## STEP-BY-STEP TASKS

### Task 1: UPDATE config/exercise-prompts.json with validation prompts

- **IMPLEMENT**: Add validation system prompt and criteria
- **PATTERN**: Follow existing prompt structure
- **VALIDATE**: `node -e "console.log(JSON.parse(require('fs').readFileSync('config/exercise-prompts.json')).validation)"`

Add to exercise-prompts.json:
```json
{
  "validation": {
    "system": "You are an expert image quality analyst for fitness content. Analyze the provided image against specific criteria and return structured JSON with your assessment. Be strict but fair - minor variations are acceptable if the overall intent is clear.",
    "criteria": {
      "character_consistency": "Does the character match the orange anatomical mannequin with wireframe mesh, faceless head with black oval eyes, green shorts, grey sneakers? Look for: correct body color, mesh texture, no face features, correct clothing.",
      "pose_accuracy": "Does the body position match the visual description in the prompt? Check: joint angles, body orientation, limb positions, overall pose intent.",
      "muscle_highlighting": "If muscles are supposed to be highlighted, are they visible as red/glowing overlays? If no highlighting required, mark as N/A passed.",
      "matches_tts_context": "Does the image appropriately illustrate what would be said in the voiceover? Consider: exercise phase shown, educational value, visual clarity.",
      "no_hallucinations": "Check for AI artifacts: correct number of limbs (2 arms, 2 legs), no floating objects, no distorted anatomy, no extra body parts, clean background."
    },
    "confidence_thresholds": {
      "approve": 0.75,
      "reject": 0.5
    }
  },
  "prompt_refinement": {
    "system": "You are a prompt engineer. Given validation failures, suggest specific prompt additions or modifications to fix the issues. Be concise and specific. Focus on the exact problems identified."
  }
}
```

### Task 2: CREATE src/utils/vision-validator.js

- **IMPLEMENT**: Claude vision analysis wrapper with 5-criteria validation
- **PATTERN**: Mirror ai-client.js structure for Anthropic client setup
- **IMPORTS**: `@anthropic-ai/sdk`, `fs/promises`, `path`
- **GOTCHA**: Base64 data must NOT include the `data:image/png;base64,` prefix for Claude API

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

function extractJson(text) {
  const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }
  return text.trim();
}

/**
 * Validate an image against 5 quality criteria using Claude vision
 * @param {string} imageBase64 - Base64 encoded image (WITHOUT data URL prefix)
 * @param {Object} promptData - The prompt.json data for this shot
 * @param {Object} context - Additional context (character, tts_segment)
 * @returns {Promise<Object>} Validation result with checks and confidence
 */
export async function validateImage(imageBase64, promptData, context) {
  const prompts = await loadPrompts();
  const criteria = prompts.validation.criteria;

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 2048,
    system: prompts.validation.system,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: "image/png",
              data: imageBase64,
            },
          },
          {
            type: "text",
            text: `Analyze this fitness character image against these criteria:

PROMPT USED: "${promptData.engineered_prompt}"

VISUAL DESCRIPTION: "${promptData.visual_description}"

MUSCLES TO HIGHLIGHT: ${JSON.stringify(promptData.highlighted_muscles)}

TTS CONTEXT: "${context.tts_segment || 'N/A'}"

CHARACTER REFERENCE:
- Orange anatomical mannequin with wireframe mesh texture
- Faceless head with only black oval eyes
- Olive green athletic shorts
- Grey sneakers with white soles

CRITERIA TO CHECK:
1. character_consistency: ${criteria.character_consistency}
2. pose_accuracy: ${criteria.pose_accuracy}
3. muscle_highlighting: ${criteria.muscle_highlighting}
4. matches_tts_context: ${criteria.matches_tts_context}
5. no_hallucinations: ${criteria.no_hallucinations}

Return JSON with this exact structure:
{
  "confidence_score": <0.0-1.0 overall confidence>,
  "checks": {
    "character_consistency": { "passed": <boolean>, "notes": "<specific observations>" },
    "pose_accuracy": { "passed": <boolean>, "notes": "<specific observations>" },
    "muscle_highlighting": { "passed": <boolean>, "notes": "<specific observations or N/A>" },
    "matches_tts_context": { "passed": <boolean>, "notes": "<specific observations>" },
    "no_hallucinations": { "passed": <boolean>, "notes": "<specific observations>" }
  },
  "issues": ["<list of specific issues found>"],
  "overall_assessment": "<brief summary>"
}

No markdown wrapping, just the JSON object.`
          }
        ]
      }
    ]
  });

  const text = message.content[0].text;
  const jsonText = extractJson(text);
  return JSON.parse(jsonText);
}

/**
 * Generate refined prompt based on validation failures
 * @param {Object} promptData - Original prompt.json data
 * @param {Array} issues - List of issues from validation
 * @returns {Promise<string>} Refined prompt
 */
export async function refinePrompt(promptData, issues) {
  const prompts = await loadPrompts();

  const message = await anthropic.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1024,
    system: prompts.prompt_refinement.system,
    messages: [
      {
        role: "user",
        content: `The following image generation prompt failed validation:

ORIGINAL PROMPT:
"${promptData.engineered_prompt}"

VALIDATION ISSUES:
${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n')}

Generate an improved prompt that addresses these specific issues. Keep the core character description but add or modify phrases to fix the problems.

Return ONLY the refined prompt text, no explanation.`
      }
    ]
  });

  return message.content[0].text.trim();
}
```

### Task 3: CREATE src/phase6-validation.js foundation

- **IMPLEMENT**: Main file with imports, CONFIG, and helper functions
- **PATTERN**: Mirror phase5-batch-image-gen.js structure
- **IMPORTS**: vision-validator.js, @fal-ai/client, fs, path

```javascript
import 'dotenv/config';
import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { validateImage, refinePrompt } from "./utils/vision-validator.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure fal.ai
fal.config({
  credentials: process.env.FAL_KEY,
});

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  videoScriptsDir: path.join(__dirname, "../output/video-scripts"),
  anchorsDir: path.join(__dirname, "../output/anchors-selected"),
  maxIterations: 2,
  rateLimit: 500, // ms between API calls
  confidenceThreshold: 0.75,
};

// ============================================
// HELPER FUNCTIONS (reused from phase5)
// ============================================
async function downloadImage(url, filepath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
}

async function fileToDataUrl(filepath) {
  const buffer = await fs.readFile(filepath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function fileToBase64(filepath) {
  const buffer = await fs.readFile(filepath);
  return buffer.toString("base64");
}

async function editImage(imageUrl, prompt) {
  const result = await fal.subscribe("fal-ai/nano-banana/edit", {
    input: {
      prompt: prompt,
      image_urls: [imageUrl],
      num_images: 1,
      output_format: "png",
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS" && update.logs) {
        update.logs.forEach(log => console.log(`      ${log.message}`));
      }
    },
  });

  if (result.data?.images?.length > 0) {
    return result.data.images[0].url;
  }
  if (result.images?.length > 0) {
    return result.images[0].url;
  }
  throw new Error("No image returned from nano-banana");
}
```

### Task 4: IMPLEMENT shot scanning and loading functions

- **IMPLEMENT**: Reuse getShotFolders pattern, add loadScriptJson for TTS context
- **PATTERN**: Mirror phase5 getShotFolders exactly

```javascript
// ============================================
// SHOT SCANNING
// ============================================
async function getShotFolders(exerciseDir) {
  const shotsDir = path.join(exerciseDir, "shots");

  try {
    await fs.access(shotsDir);
  } catch {
    return [];
  }

  const entries = await fs.readdir(shotsDir, { withFileTypes: true });
  const shotFolders = [];

  for (const entry of entries) {
    if (entry.isDirectory()) {
      const promptPath = path.join(shotsDir, entry.name, "prompt.json");
      const imagePath = path.join(shotsDir, entry.name, "image.png");
      try {
        await fs.access(promptPath);
        await fs.access(imagePath);
        shotFolders.push({
          id: entry.name,
          dir: path.join(shotsDir, entry.name),
          promptPath: promptPath,
          imagePath: imagePath,
        });
      } catch {
        // Missing prompt.json or image.png, skip
      }
    }
  }

  shotFolders.sort((a, b) => a.id.localeCompare(b.id));
  return shotFolders;
}

async function loadPromptJson(promptPath) {
  const data = await fs.readFile(promptPath, "utf-8");
  return JSON.parse(data);
}

async function savePromptJson(promptPath, data) {
  await fs.writeFile(promptPath, JSON.stringify(data, null, 2));
}

async function loadScriptJson(exerciseDir) {
  const scriptPath = path.join(exerciseDir, "script.json");
  try {
    const data = await fs.readFile(scriptPath, "utf-8");
    return JSON.parse(data);
  } catch {
    return null;
  }
}

// ============================================
// ANCHOR IMAGE LOADING
// ============================================
const anchorCache = new Map();

async function getAnchorDataUrl(anchorPath) {
  const absolutePath = path.join(__dirname, "..", anchorPath);

  if (anchorCache.has(absolutePath)) {
    return anchorCache.get(absolutePath);
  }

  try {
    await fs.access(absolutePath);
    const dataUrl = await fileToDataUrl(absolutePath);
    anchorCache.set(absolutePath, dataUrl);
    return dataUrl;
  } catch (error) {
    throw new Error(`Anchor image not found: ${absolutePath}`);
  }
}
```

### Task 5: IMPLEMENT main validation loop with regeneration

- **IMPLEMENT**: validateExercise function with iteration tracking and regeneration
- **PATTERN**: Match phase5 loop with added validation/regen logic
- **GOTCHA**: Update prompt.json iteration count and prompt_history on each attempt

```javascript
// ============================================
// VALIDATION & REGENERATION
// ============================================
async function validateShot(shot, scriptData, skipRegen = false) {
  let promptData = await loadPromptJson(shot.promptPath);
  const ttsSegment = scriptData?.segments?.[promptData.tts_segment_index]?.tts_segment || "";

  const result = {
    shot_id: shot.id,
    status: "pending",
    iteration: promptData.iteration || 1,
    confidence_score: 0,
    checks: {},
    issues: [],
    flagged_for_manual_review: false,
    rejection_history: [],
  };

  while (result.iteration <= CONFIG.maxIterations) {
    console.log(`│  🔍 Validating (iteration ${result.iteration})...`);

    // Load image as base64 (without data URL prefix)
    const imageBase64 = await fileToBase64(shot.imagePath);

    // Validate with Claude vision
    const validation = await validateImage(imageBase64, promptData, {
      tts_segment: ttsSegment,
    });

    result.confidence_score = validation.confidence_score;
    result.checks = validation.checks;
    result.issues = validation.issues;

    // Check if all criteria passed
    const allPassed = Object.values(validation.checks).every(c => c.passed);
    const meetsConfidence = validation.confidence_score >= CONFIG.confidenceThreshold;

    if (allPassed && meetsConfidence) {
      result.status = "approved";
      console.log(`│  ✅ APPROVED (confidence: ${validation.confidence_score.toFixed(2)})`);
      break;
    }

    // Failed - check if we can retry
    const failedChecks = Object.entries(validation.checks)
      .filter(([_, v]) => !v.passed)
      .map(([k, _]) => k);

    console.log(`│  ❌ FAILED: ${failedChecks.join(", ")}`);

    if (result.iteration >= CONFIG.maxIterations || skipRegen) {
      result.status = "rejected";
      result.flagged_for_manual_review = true;
      console.log(`│  ⚠️  FLAGGED for manual review (max iterations reached)`);
      break;
    }

    // Record rejection history
    result.rejection_history.push({
      attempt: result.iteration,
      issues: [...validation.issues],
      prompt_adjustment: "",
    });

    // Refine prompt and regenerate
    console.log(`│  🔄 Refining prompt...`);
    const refinedPrompt = await refinePrompt(promptData, validation.issues);

    // Update rejection history with the adjustment
    result.rejection_history[result.rejection_history.length - 1].prompt_adjustment =
      `Refined: ${refinedPrompt.substring(0, 100)}...`;

    // Update prompt.json
    promptData.prompt_history.push(promptData.engineered_prompt);
    promptData.engineered_prompt = refinedPrompt;
    promptData.iteration = result.iteration + 1;
    await savePromptJson(shot.promptPath, promptData);

    // Regenerate image
    console.log(`│  🔄 Regenerating image...`);
    try {
      const anchorDataUrl = await getAnchorDataUrl(promptData.anchor_image);
      const imageUrl = await editImage(anchorDataUrl, refinedPrompt);
      await downloadImage(imageUrl, shot.imagePath);
      console.log(`│  📸 New image saved`);
    } catch (error) {
      console.log(`│  ❌ Regeneration failed: ${error.message}`);
      result.status = "rejected";
      result.flagged_for_manual_review = true;
      result.issues.push(`Regeneration failed: ${error.message}`);
      break;
    }

    result.iteration++;

    // Rate limiting
    await new Promise(r => setTimeout(r, CONFIG.rateLimit));
  }

  return result;
}
```

### Task 6: IMPLEMENT exercise validation orchestrator

- **IMPLEMENT**: validateExercise function that processes all shots
- **PATTERN**: Match phase5 generateImagesForExercise structure

```javascript
async function validateExercise(exerciseName, skipRegen = false) {
  const exerciseDir = path.join(CONFIG.videoScriptsDir, exerciseName);

  try {
    await fs.access(exerciseDir);
  } catch {
    throw new Error(`Exercise not found: ${exerciseName}`);
  }

  const shots = await getShotFolders(exerciseDir);
  if (shots.length === 0) {
    throw new Error(`No shots with images found in: ${exerciseDir}/shots/`);
  }

  const scriptData = await loadScriptJson(exerciseDir);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗   ██╗ █████╗ ██╗     ██╗██████╗  █████╗ ████████╗███████╗║
║   ██║   ██║██╔══██╗██║     ██║██╔══██╗██╔══██╗╚══██╔══╝██╔════╝║
║   ██║   ██║███████║██║     ██║██║  ██║███████║   ██║   █████╗  ║
║   ╚██╗ ██╔╝██╔══██║██║     ██║██║  ██║██╔══██║   ██║   ██╔══╝  ║
║    ╚████╔╝ ██║  ██║███████╗██║██████╔╝██║  ██║   ██║   ███████╗║
║     ╚═══╝  ╚═╝  ╚═╝╚══════╝╚═╝╚═════╝ ╚═╝  ╚═╝   ╚═╝   ╚══════╝║
║                                                               ║
║   PHASE 6: QUALITY VALIDATION                                 ║
║   AI-powered image validation with auto-regeneration          ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
║  Total shots: ${String(shots.length).padEnd(42)}║
║  Max iterations: ${String(CONFIG.maxIterations).padEnd(39)}║
║  Mode: ${skipRegen ? "Validation only (no regeneration)".padEnd(48) : "Full validation with regeneration".padEnd(48)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  const validationResults = [];

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    console.log(`\n┌─ [${i + 1}/${shots.length}] ${shot.id}`);

    try {
      const result = await validateShot(shot, scriptData, skipRegen);
      validationResults.push(result);

      // Save validation.json
      const validationPath = path.join(shot.dir, "validation.json");
      await fs.writeFile(validationPath, JSON.stringify(result, null, 2));
      console.log(`│  💾 Saved validation.json`);

    } catch (error) {
      console.log(`│  ❌ Error: ${error.message}`);
      validationResults.push({
        shot_id: shot.id,
        status: "error",
        error: error.message,
        flagged_for_manual_review: true,
      });
    }

    console.log(`└─ Done`);

    // Rate limiting between shots
    if (i < shots.length - 1) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimit));
    }
  }

  // Generate validation summary
  const summary = generateValidationSummary(exerciseName, validationResults);
  const summaryPath = path.join(exerciseDir, "validation-summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  return { validationResults, summary };
}
```

### Task 7: IMPLEMENT validation summary generator

- **IMPLEMENT**: generateValidationSummary function
- **PATTERN**: Follow PRD validation-summary.json schema

```javascript
function generateValidationSummary(exerciseName, results) {
  const approved = results.filter(r => r.status === "approved").length;
  const rejected = results.filter(r => r.status === "rejected" && !r.flagged_for_manual_review).length;
  const flagged = results.filter(r => r.flagged_for_manual_review).length;
  const errors = results.filter(r => r.status === "error").length;

  const blockingIssues = results
    .filter(r => r.flagged_for_manual_review || r.status === "error")
    .map(r => `Shot ${r.shot_id} requires manual review`);

  return {
    exercise: exerciseName,
    generated_at: new Date().toISOString(),
    total_shots: results.length,
    approved,
    rejected,
    flagged_for_review: flagged,
    errors,
    shots: results.map(r => ({
      id: r.shot_id,
      status: r.flagged_for_manual_review ? "flagged_for_review" : r.status,
      confidence: r.confidence_score || 0,
    })),
    ready_for_assembly: blockingIssues.length === 0,
    blocking_issues: blockingIssues,
  };
}
```

### Task 8: IMPLEMENT main function with CLI

- **IMPLEMENT**: Main function with argument parsing and completion summary
- **PATTERN**: Match phase5 CLI structure
- **FLAGS**: --all (batch), --skip-regen (validation only)

```javascript
// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const exerciseName = args.find(a => !a.startsWith("--"));
  const processAll = args.includes("--all");
  const skipRegen = args.includes("--skip-regen");

  if (!exerciseName && !processAll) {
    console.error("Usage: node phase6-validation.js <exercise-name> [--skip-regen]");
    console.error("       node phase6-validation.js --all [--skip-regen]");
    console.error("");
    console.error("Options:");
    console.error("  --skip-regen  Validate only, don't regenerate failed images");
    console.error("  --all         Process all exercises in video-scripts directory");
    console.error("");
    console.error("Examples:");
    console.error("  node phase6-validation.js bent-over-barbell-row");
    console.error("  node phase6-validation.js --all --skip-regen");
    process.exit(1);
  }

  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not found in .env file");
    process.exit(1);
  }

  if (!skipRegen && !process.env.FAL_KEY) {
    console.error("❌ FAL_KEY not found in .env file (required for regeneration)");
    process.exit(1);
  }

  try {
    await fs.access(CONFIG.videoScriptsDir);
  } catch {
    console.error(`❌ Video scripts directory not found: ${CONFIG.videoScriptsDir}`);
    process.exit(1);
  }

  let exercises = [];

  if (processAll) {
    const entries = await fs.readdir(CONFIG.videoScriptsDir, { withFileTypes: true });
    exercises = entries.filter(e => e.isDirectory()).map(e => e.name);

    if (exercises.length === 0) {
      console.error("❌ No exercises found in video-scripts directory");
      process.exit(1);
    }

    console.log(`\n📁 Found ${exercises.length} exercises to validate\n`);
  } else {
    exercises = [exerciseName];
  }

  const allResults = [];

  for (const exercise of exercises) {
    try {
      const { summary } = await validateExercise(exercise, skipRegen);
      allResults.push({ exercise, summary, success: true });
    } catch (error) {
      console.error(`\n❌ Failed to validate ${exercise}: ${error.message}`);
      allResults.push({ exercise, success: false, error: error.message });
    }
  }

  // Print final summary
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎉 VALIDATION COMPLETE                                       ║
╠═══════════════════════════════════════════════════════════════╣`);

  let totalApproved = 0, totalFlagged = 0, totalShots = 0;

  for (const r of allResults) {
    if (r.success) {
      const s = r.summary;
      const status = s.ready_for_assembly ? "✅ READY" : "⚠️  REVIEW";
      console.log(`║  ${r.exercise.padEnd(20)} ${status} ${s.approved}/${s.total_shots} approved`.padEnd(63) + `║`);
      totalApproved += s.approved;
      totalFlagged += s.flagged_for_review;
      totalShots += s.total_shots;
    } else {
      console.log(`║  ${r.exercise.padEnd(20)} ❌ ${r.error.substring(0, 30)}`.padEnd(63) + `║`);
    }
  }

  console.log(`╠═══════════════════════════════════════════════════════════════╣
║  TOTALS: ${String(totalApproved).padStart(3)} approved | ${String(totalFlagged).padStart(3)} flagged | ${String(totalShots).padStart(3)} total         ║
╠═══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                  ║
║  1. Review flagged shots in output/video-scripts/             ║
║  2. Manually fix or approve flagged images                    ║
║  3. Re-run validation if needed                               ║
║  4. Assemble video when ready_for_assembly is true            ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Exit with error if any failures
  if (totalFlagged > 0 || allResults.some(r => !r.success)) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});
```

### Task 9: UPDATE package.json with phase6 script

- **IMPLEMENT**: Add npm run phase6 command
- **PATTERN**: Match existing phase scripts
- **VALIDATE**: `npm run phase6`

Add to package.json scripts:
```json
{
  "scripts": {
    "phase6": "node src/phase6-validation.js"
  }
}
```

---

## TESTING STRATEGY

### Unit Tests

No formal unit test framework in project. Manual validation approach.

### Integration Tests

Run with existing exercise (requires phase4 and phase5 output):
```bash
# Generate scripts and images first
npm run phase4 -- "bicep-curl"
npm run phase5 -- "bicep-curl"

# Run validation
npm run phase6 -- "bicep-curl"

# Run validation only (no regeneration)
npm run phase6 -- "bicep-curl" --skip-regen
```

### Edge Cases

1. **Missing image.png**: Shot skipped from validation
2. **Missing prompt.json**: Shot skipped from validation
3. **All checks pass**: Approved immediately (no regen)
4. **Some checks fail**: Prompt refined, image regenerated
5. **Max iterations reached**: Flagged for manual review
6. **Regeneration fails**: Flagged with error in issues
7. **Claude API error**: Shot marked as error status

---

## VALIDATION COMMANDS

### Level 1: Syntax & Imports

```bash
# Check imports work
node -e "import('./src/utils/vision-validator.js').then(() => console.log('✅ vision-validator.js'))"
node -e "import('./src/phase6-validation.js').catch(e => console.log('Expected: needs exercise arg'))"
```

### Level 2: Config Validation

```bash
# Validate JSON configs have validation prompts
node -e "const c = JSON.parse(require('fs').readFileSync('config/exercise-prompts.json')); console.log(c.validation ? '✅ validation config' : '❌ missing validation')"
```

### Level 3: CLI Validation

```bash
# Should show usage
node src/phase6-validation.js

# Should error about ANTHROPIC_API_KEY if missing
ANTHROPIC_API_KEY= node src/phase6-validation.js test
```

### Level 4: Functional Test

```bash
# Run validation (requires existing exercise with images)
npm run phase6 -- "bicep-curl" --skip-regen

# Check output files exist
ls output/video-scripts/bicep-curl/validation-summary.json
ls output/video-scripts/bicep-curl/shots/*/validation.json
```

---

## ACCEPTANCE CRITERIA

- [ ] `src/utils/vision-validator.js` exports validateImage and refinePrompt
- [ ] `src/phase6-validation.js` runs without syntax errors
- [ ] `config/exercise-prompts.json` contains validation and prompt_refinement sections
- [ ] Running `npm run phase6 -- <exercise>` validates all shots
- [ ] Each shot folder gets a `validation.json` file matching PRD schema
- [ ] Exercise folder gets `validation-summary.json` matching PRD schema
- [ ] Failed images trigger prompt refinement and regeneration
- [ ] After max_iterations (2), shots are flagged for manual review
- [ ] `--skip-regen` flag disables regeneration
- [ ] `--all` flag processes all exercises
- [ ] ASCII logging matches project conventions
- [ ] Progress shows validation results, regeneration attempts
- [ ] Missing ANTHROPIC_API_KEY shows clear error message

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully:
  - [ ] Level 1: Import checks
  - [ ] Level 2: Config validation
  - [ ] Level 3: CLI validation
  - [ ] Level 4: Functional test with real exercise
- [ ] validation.json schema matches PRD
- [ ] validation-summary.json schema matches PRD
- [ ] ASCII logging follows CLAUDE.md conventions
- [ ] Error handling with clear messages
- [ ] All acceptance criteria met

---

## NOTES

### Design Decisions

1. **Separate vision-validator.js**: Keeps Claude vision logic isolated, reusable
2. **Base64 without prefix**: Claude API requires raw base64, not data URL
3. **Prompt history tracking**: Enables debugging of refinement attempts
4. **Confidence threshold**: 0.75 ensures only high-quality images pass
5. **Skip-regen flag**: Allows quick validation checks without API costs

### Trade-offs

1. **Sequential processing**: Safer for rate limits, easier debugging
2. **Max 2 iterations**: Balance between quality and API costs
3. **Simple refinement**: Single Claude call vs multi-step optimization

### Future Considerations

1. **Parallel validation**: Process multiple shots concurrently
2. **Custom thresholds**: Per-criteria confidence levels
3. **Human-in-the-loop**: Interactive approval for flagged shots
4. **Cost tracking**: Monitor API usage and costs
