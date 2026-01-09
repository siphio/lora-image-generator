# Feature: Phase 5 - Batch Image Generation (PRD Phase 2)

The following plan should be complete, but validate documentation and codebase patterns before implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files.

## Feature Description

Build the batch image generation system that reads all prompt.json files from video script folders and generates images using the nano-banana API. This phase takes the structured prompts created by Phase 4 (Script Generator) and produces actual images for each shot.

The system:
- Scans all shot folders in a video script directory
- Reads prompt.json to get the engineered prompt and anchor reference
- Loads the anchor image as a base64 data URL
- Calls fal-ai/nano-banana/edit to generate the image
- Saves the resulting image as image.png in the shot folder
- Tracks progress and handles errors gracefully

## User Story

As a fitness content creator,
I want to run a single command to generate all images for a video script,
So that I can quickly produce the visual assets needed for my fitness videos without manually calling the API for each shot.

## Problem Statement

After Phase 4 generates prompt.json files for each shot:
1. Each shot needs an image generated via nano-banana API
2. Images must use the correct anchor image as reference for character consistency
3. Manual generation of 6-10 images per video is tedious and error-prone
4. Need to handle API failures gracefully without losing progress
5. Need to skip already-generated images for resumability

## Solution Statement

Build an automated batch processor that:
1. Scans video script directories for shot folders
2. Reads prompt.json files to get engineered prompts
3. Loads anchor images as base64 data URLs (with caching)
4. Calls nano-banana API for each shot
5. Saves generated images with proper naming
6. Implements skip-if-exists for resumability
7. Reports progress with ASCII logging
8. Handles API errors gracefully

## Feature Metadata

**Feature Type**: New Capability
**Estimated Complexity**: Medium
**Primary Systems Affected**: `src/`, `output/video-scripts/`
**Dependencies**: Existing `@fal-ai/client`, `dotenv`, `fs/promises`

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING

- `src/phase2-variations.js` (lines 1-50) - Why: ES module imports, fal.ai config, CHARACTER definition pattern
- `src/phase2-variations.js` (lines 123-182) - Why: Helper functions (ensureDir, downloadImage, fileToDataUrl, getAnchorImage, editImage)
- `src/phase2-variations.js` (lines 186-294) - Why: Main generation loop with ASCII logging, skip-if-exists, error handling
- `src/phase4-script-generator.js` (lines 1-36) - Why: ES module pattern, CONFIG structure, output directory paths
- `src/phase4-script-generator.js` (lines 294-390) - Why: Main function pattern, environment validation, ASCII box logging
- `config/character.json` - Why: Character definition used in prompts
- `PRD.md` (lines 143-152) - Why: Phase 2 Batch Image Generation requirements
- `PRD.md` (lines 395-412) - Why: prompt.json schema showing anchor_image, engineered_prompt fields
- `CLAUDE.md` (lines 123-154) - Why: ASCII box logging format requirements

### Existing Utilities to Reuse

From `src/phase2-variations.js`:
- `editImage(imageUrl, prompt)` - nano-banana API call wrapper
- `fileToDataUrl(filepath)` - Convert file to base64 data URL
- `downloadImage(url, filepath)` - Save image from URL
- `ensureDir(dir)` - Create directory recursively

### New Files to Create

- `src/phase5-batch-image-gen.js` - Main batch image generation script
- `src/utils/nano-banana-client.js` - (Optional) Extracted nano-banana API wrapper

### Output Structure Reference

```
output/video-scripts/[exercise-name]/
├── script.json
├── tts-script.txt
└── shots/
    ├── 01-intro/
    │   ├── prompt.json    # INPUT: engineered_prompt, anchor_image
    │   └── image.png      # OUTPUT: generated image
    ├── 02-setup/
    │   ├── prompt.json
    │   └── image.png
    └── ...
```

### Patterns to Follow

**ES Module Imports:**
```javascript
import 'dotenv/config';
import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

**fal.ai Config:**
```javascript
fal.config({
  credentials: process.env.FAL_KEY,
});
```

**CONFIG Object Structure:**
```javascript
const CONFIG = {
  videoScriptsDir: path.join(__dirname, "../output/video-scripts"),
  anchorsDir: path.join(__dirname, "../output/anchors-selected"),
  rateLimit: 300, // ms between API calls
};
```

**ASCII Box Logging:**
```javascript
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PHASE 5: BATCH IMAGE GENERATION                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
║  Total shots: ${String(totalShots).padEnd(42)}║
╚═══════════════════════════════════════════════════════════════╝
`);
```

**Progress Logging:**
```javascript
console.log(`\n┌─ ${shotId}`);
console.log(`│  Anchor: ${anchorId} | Prompt length: ${promptLength}`);
console.log(`│  🔄 Generating image...`);
console.log(`│  ✅ Saved to ${shotId}/image.png`);
console.log(`│  ❌ Error: ${error.message}`);
console.log(`│  ⏭️  image.png exists, skipping`);
console.log(`└─ Done\n`);
```

**Skip-if-exists Pattern:**
```javascript
const imagePath = path.join(shotDir, "image.png");
try {
  await fs.access(imagePath);
  console.log(`│  ⏭️  image.png exists, skipping`);
  totalSkipped++;
  continue;
} catch {}
```

**nano-banana API Call (from phase2-variations.js):**
```javascript
async function editImage(imageUrl, prompt) {
  const result = await fal.subscribe("fal-ai/nano-banana/edit", {
    input: {
      prompt: prompt,
      image_urls: [imageUrl],  // Array of image URLs (base64 data URLs work)
      num_images: 1,
      output_format: "png",
    },
    logs: true,
    onQueueUpdate: (update) => {
      if (update.status === "IN_PROGRESS" && update.logs) {
        update.logs.forEach(log => console.log(`    ${log.message}`));
      }
    },
  });

  if (result.data?.images?.length > 0) {
    return result.data.images[0].url;
  }
  if (result.images?.length > 0) {
    return result.images[0].url;
  }
  throw new Error("No image returned");
}
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

Set up the script structure with helpers and configuration.

**Tasks:**
- Create phase5-batch-image-gen.js with ES module imports and CONFIG
- Copy helper functions from phase2-variations.js (editImage, fileToDataUrl, downloadImage, ensureDir)
- Add fal.ai client configuration

### Phase 2: Core Implementation

Build the main batch generation logic.

**Tasks:**
- Implement shot folder scanning function
- Implement prompt.json reading and validation
- Implement anchor image loading with caching
- Implement main generation loop with progress tracking
- Implement error handling and retry logic

### Phase 3: CLI Integration

Add command-line interface and npm script.

**Tasks:**
- Add CLI argument parsing (exercise name, --all flag)
- Add environment validation (FAL_KEY check)
- Add npm script command
- Add completion summary

---

## STEP-BY-STEP TASKS

### Task 1: CREATE src/phase5-batch-image-gen.js Foundation

- **IMPLEMENT**: Basic file structure with imports, CONFIG, and helper functions
- **PATTERN**: Mirror phase2-variations.js structure for fal.ai setup
- **VALIDATE**: `node -e "import('./src/phase5-batch-image-gen.js').catch(e => console.log('Expected: needs arg'))"`

```javascript
import 'dotenv/config';
import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

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
  rateLimit: 300, // ms between API calls
};

// ============================================
// HELPER FUNCTIONS
// ============================================
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
}

async function fileToDataUrl(filepath) {
  const buffer = await fs.readFile(filepath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
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
        update.logs.forEach(log => console.log(`    ${log.message}`));
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

### Task 2: IMPLEMENT Shot Folder Scanner

- **IMPLEMENT**: Function to scan shots directory and return shot folders with prompt.json
- **PATTERN**: Use fs.readdir with withFileTypes for efficient directory scanning
- **VALIDATE**: Manual test with existing video-scripts folder

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
      try {
        await fs.access(promptPath);
        shotFolders.push({
          id: entry.name,
          dir: path.join(shotsDir, entry.name),
          promptPath: promptPath,
        });
      } catch {
        // No prompt.json, skip this folder
      }
    }
  }

  // Sort by shot ID (numerical prefix)
  shotFolders.sort((a, b) => a.id.localeCompare(b.id));

  return shotFolders;
}

async function loadPromptJson(promptPath) {
  const data = await fs.readFile(promptPath, "utf-8");
  return JSON.parse(data);
}
```

### Task 3: IMPLEMENT Anchor Image Loader with Caching

- **IMPLEMENT**: Function to load anchor images with in-memory cache
- **PATTERN**: Match getAnchorImage from phase2-variations.js with caching
- **GOTCHA**: anchor_image in prompt.json is relative path like "output/anchors-selected/bent.png"

```javascript
// ============================================
// ANCHOR IMAGE LOADING
// ============================================
const anchorCache = new Map();

async function getAnchorDataUrl(anchorPath) {
  // anchorPath is like "output/anchors-selected/bent.png"
  // Convert to absolute path
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

### Task 4: IMPLEMENT Main Generation Loop

- **IMPLEMENT**: Main loop that processes each shot with progress tracking
- **PATTERN**: Match phase2-variations.js loop structure with skip-if-exists
- **GOTCHA**: Rate limiting between API calls

```javascript
// ============================================
// BATCH IMAGE GENERATION
// ============================================
async function generateImagesForExercise(exerciseName) {
  const exerciseDir = path.join(CONFIG.videoScriptsDir, exerciseName);

  // Validate exercise directory exists
  try {
    await fs.access(exerciseDir);
  } catch {
    throw new Error(`Exercise not found: ${exerciseName}`);
  }

  // Get all shot folders
  const shots = await getShotFolders(exerciseDir);

  if (shots.length === 0) {
    throw new Error(`No shots found in: ${exerciseDir}/shots/`);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗███╗   ███╗ █████╗  ██████╗ ███████╗███████╗             ║
║   ██║████╗ ████║██╔══██╗██╔════╝ ██╔════╝██╔════╝             ║
║   ██║██╔████╔██║███████║██║  ███╗█████╗  ███████╗             ║
║   ██║██║╚██╔╝██║██╔══██║██║   ██║██╔══╝  ╚════██║             ║
║   ██║██║ ╚═╝ ██║██║  ██║╚██████╔╝███████╗███████║             ║
║   ╚═╝╚═╝     ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚══════╝             ║
║                                                               ║
║   PHASE 5: BATCH IMAGE GENERATION                             ║
║   Generate images for all video script shots                  ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
║  Total shots: ${String(shots.length).padEnd(42)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    const imagePath = path.join(shot.dir, "image.png");

    console.log(`\n┌─ [${i + 1}/${shots.length}] ${shot.id}`);

    // Skip if image already exists
    try {
      await fs.access(imagePath);
      console.log(`│  ⏭️  image.png exists, skipping`);
      console.log(`└─ Skipped`);
      totalSkipped++;
      continue;
    } catch {}

    // Load prompt.json
    let promptData;
    try {
      promptData = await loadPromptJson(shot.promptPath);
      console.log(`│  Anchor: ${path.basename(promptData.anchor_image)}`);
      console.log(`│  Prompt: "${promptData.engineered_prompt.substring(0, 50)}..."`);
    } catch (error) {
      console.log(`│  ❌ Failed to load prompt.json: ${error.message}`);
      console.log(`└─ Error`);
      totalErrors++;
      continue;
    }

    // Load anchor image
    let anchorDataUrl;
    try {
      anchorDataUrl = await getAnchorDataUrl(promptData.anchor_image);
      console.log(`│  📁 Anchor loaded`);
    } catch (error) {
      console.log(`│  ❌ Anchor error: ${error.message}`);
      console.log(`└─ Error`);
      totalErrors++;
      continue;
    }

    // Generate image
    console.log(`│  🔄 Generating image via nano-banana...`);
    try {
      const imageUrl = await editImage(anchorDataUrl, promptData.engineered_prompt);
      await downloadImage(imageUrl, imagePath);
      console.log(`│  ✅ Saved to ${shot.id}/image.png`);
      console.log(`└─ Done`);
      totalGenerated++;
    } catch (error) {
      console.log(`│  ❌ Generation failed: ${error.message}`);
      console.log(`└─ Error`);
      totalErrors++;
    }

    // Rate limiting
    if (i < shots.length - 1) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimit));
    }
  }

  return { totalGenerated, totalSkipped, totalErrors, total: shots.length };
}
```

### Task 5: IMPLEMENT Main Function with CLI

- **IMPLEMENT**: Main function with argument parsing and completion summary
- **PATTERN**: Match phase4 CLI structure
- **GOTCHA**: Support both single exercise and --all flag for batch processing

```javascript
// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const exerciseName = args.find(a => !a.startsWith("--"));
  const processAll = args.includes("--all");

  if (!exerciseName && !processAll) {
    console.error("Usage: node phase5-batch-image-gen.js <exercise-name>");
    console.error("       node phase5-batch-image-gen.js --all");
    console.error("");
    console.error("Examples:");
    console.error("  node phase5-batch-image-gen.js bent-over-barbell-row");
    console.error("  node phase5-batch-image-gen.js --all");
    process.exit(1);
  }

  // Validate environment
  if (!process.env.FAL_KEY) {
    console.error("❌ FAL_KEY not found in .env file");
    process.exit(1);
  }

  // Validate video-scripts directory
  try {
    await fs.access(CONFIG.videoScriptsDir);
  } catch {
    console.error(`❌ Video scripts directory not found: ${CONFIG.videoScriptsDir}`);
    console.error("   Run phase4 first to generate video scripts.");
    process.exit(1);
  }

  let exercises = [];

  if (processAll) {
    // Get all exercise directories
    const entries = await fs.readdir(CONFIG.videoScriptsDir, { withFileTypes: true });
    exercises = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);

    if (exercises.length === 0) {
      console.error("❌ No exercises found in video-scripts directory");
      process.exit(1);
    }

    console.log(`\n📁 Found ${exercises.length} exercises to process\n`);
  } else {
    exercises = [exerciseName];
  }

  const results = [];

  for (const exercise of exercises) {
    try {
      const result = await generateImagesForExercise(exercise);
      results.push({ exercise, ...result, success: true });
    } catch (error) {
      console.error(`\n❌ Failed to process ${exercise}: ${error.message}`);
      results.push({ exercise, success: false, error: error.message });
    }
  }

  // Print summary
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎉 BATCH IMAGE GENERATION COMPLETE                           ║
╠═══════════════════════════════════════════════════════════════╣`);

  let totalGen = 0, totalSkip = 0, totalErr = 0;

  for (const r of results) {
    if (r.success) {
      console.log(`║  ${r.exercise.padEnd(20)} ✅ ${r.totalGenerated} gen | ${r.totalSkipped} skip | ${r.totalErrors} err`.padEnd(64) + `║`);
      totalGen += r.totalGenerated;
      totalSkip += r.totalSkipped;
      totalErr += r.totalErrors;
    } else {
      console.log(`║  ${r.exercise.padEnd(20)} ❌ ${r.error.substring(0, 30)}`.padEnd(64) + `║`);
    }
  }

  console.log(`╠═══════════════════════════════════════════════════════════════╣
║  TOTALS: ${String(totalGen).padStart(3)} generated | ${String(totalSkip).padStart(3)} skipped | ${String(totalErr).padStart(3)} errors            ║
╠═══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                  ║
║  1. Review generated images in output/video-scripts/          ║
║  2. Run phase6 for AI validation and quality checks           ║
║  3. Re-run to regenerate any failed shots                     ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Exit with error code if any failures
  if (totalErr > 0 || results.some(r => !r.success)) {
    process.exit(1);
  }
}

main().catch(error => {
  console.error("❌ Fatal error:", error.message);
  process.exit(1);
});
```

### Task 6: UPDATE package.json with phase5 script

- **IMPLEMENT**: Add npm run phase5 command
- **PATTERN**: Match existing phase scripts
- **VALIDATE**: `npm run phase5 -- --help`

Add to package.json scripts:
```json
{
  "scripts": {
    "phase5": "node src/phase5-batch-image-gen.js"
  }
}
```

---

## TESTING STRATEGY

### Unit Tests

No formal unit test framework in project. Manual validation approach.

### Integration Tests

Run with existing video script:
```bash
# First ensure phase4 has generated scripts
npm run phase4 -- "bent-over-barbell-row"

# Then run phase5
npm run phase5 -- "bent-over-barbell-row"
```

Expected output:
- Each shot folder should have image.png alongside prompt.json
- Progress logging shows each shot being processed
- Skip-if-exists works on second run

### Edge Cases

1. **Missing prompt.json**: Shot folder without prompt.json is skipped
2. **Missing anchor image**: Error logged, continues to next shot
3. **API failure**: Error logged, continues to next shot
4. **Already generated**: Skip-if-exists pattern handles resumability
5. **Empty exercise**: Clear error message
6. **Invalid exercise name**: Directory not found error

---

## VALIDATION COMMANDS

### Level 1: Syntax & Imports

```bash
# Check imports work
node -e "import('./src/phase5-batch-image-gen.js').catch(e => console.log('Expected: needs exercise arg'))"
```

### Level 2: Environment Validation

```bash
# Should show usage if no args
node src/phase5-batch-image-gen.js

# Should error about FAL_KEY if missing
FAL_KEY= node src/phase5-batch-image-gen.js test
```

### Level 3: Functional Test

```bash
# Generate images for a video script (requires phase4 output)
npm run phase5 -- "bent-over-barbell-row"

# Verify output
ls output/video-scripts/bent-over-barbell-row/shots/*/image.png
```

### Level 4: Resumability Test

```bash
# Run twice - second run should skip existing images
npm run phase5 -- "bent-over-barbell-row"
npm run phase5 -- "bent-over-barbell-row"
# Second run should show "⏭️ image.png exists, skipping" for all shots
```

---

## ACCEPTANCE CRITERIA

- [ ] `src/phase5-batch-image-gen.js` runs without syntax errors
- [ ] Running `npm run phase5 -- <exercise>` generates images for all shots
- [ ] Each shot folder gets an `image.png` file
- [ ] Skip-if-exists pattern prevents regenerating existing images
- [ ] Anchor images are loaded correctly from prompt.json paths
- [ ] Progress logging matches project ASCII style
- [ ] Error handling continues to next shot on failure
- [ ] `--all` flag processes all exercises in video-scripts directory
- [ ] Completion summary shows generated/skipped/error counts
- [ ] Missing FAL_KEY shows clear error message
- [ ] Rate limiting prevents API throttling (300ms between calls)

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully:
  - [ ] Level 1: Import check
  - [ ] Level 2: Environment validation
  - [ ] Level 3: Functional test with real exercise
  - [ ] Level 4: Resumability test
- [ ] Output structure matches PRD specification
- [ ] ASCII logging follows CLAUDE.md conventions
- [ ] Skip-if-exists pattern implemented
- [ ] Error handling with clear messages
- [ ] All acceptance criteria met

---

## NOTES

### Design Decisions

1. **Reuse helper functions**: Copy from phase2-variations.js rather than creating shared module (simpler, matches existing pattern)
2. **In-memory anchor caching**: Avoids reloading same anchor for multiple shots
3. **Continue on error**: Don't fail entire batch for single shot failure
4. **Rate limiting**: 300ms delay prevents API throttling

### Trade-offs

1. **No retry logic**: Single attempt per shot, user can re-run for failures
2. **No parallel processing**: Sequential for rate limit safety and easier debugging
3. **Duplicated helpers**: Could extract to shared utils but matches existing project pattern

### Future Considerations

1. **Parallel processing**: Could batch 2-3 shots at once if rate limits allow
2. **Retry with backoff**: Auto-retry failed shots with exponential backoff
3. **Progress file**: Save progress to JSON for crash recovery
4. **Validation hook**: Run phase6 validation immediately after each image
