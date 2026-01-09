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
  rateLimit: 500, // ms between API calls
  maxIterations: 2, // max regeneration attempts
  confidenceThreshold: 0.7, // minimum confidence to pass
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

// ============================================
// SHOT SCANNING AND LOADING
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

  // Sort by shot ID
  shotFolders.sort((a, b) => a.id.localeCompare(b.id));
  return shotFolders;
}

async function loadPromptJson(promptPath) {
  const data = await fs.readFile(promptPath, "utf-8");
  return JSON.parse(data);
}

async function savePromptJson(promptPath, promptData) {
  await fs.writeFile(promptPath, JSON.stringify(promptData, null, 2));
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

// Anchor cache
const anchorCache = new Map();

async function getAnchorPath(anchorRelativePath) {
  // anchorRelativePath is like "output/anchors-selected/bent.png"
  const absolutePath = path.join(__dirname, "..", anchorRelativePath);

  try {
    await fs.access(absolutePath);
    return absolutePath;
  } catch {
    throw new Error(`Anchor image not found: ${absolutePath}`);
  }
}

async function getAnchorDataUrl(anchorRelativePath) {
  const absolutePath = await getAnchorPath(anchorRelativePath);

  if (anchorCache.has(absolutePath)) {
    return anchorCache.get(absolutePath);
  }

  const dataUrl = await fileToDataUrl(absolutePath);
  anchorCache.set(absolutePath, dataUrl);
  return dataUrl;
}

// ============================================
// VALIDATION LOOP WITH REGENERATION
// ============================================
async function validateShot(shot, scriptData, skipRegen = false) {
  const imagePath = path.join(shot.dir, "image.png");
  const validationPath = path.join(shot.dir, "validation.json");

  // Check if image exists
  try {
    await fs.access(imagePath);
  } catch {
    return {
      status: "no_image",
      message: "No image.png found in shot folder",
    };
  }

  // Load prompt data
  let promptData;
  try {
    promptData = await loadPromptJson(shot.promptPath);
  } catch (error) {
    return {
      status: "error",
      message: `Failed to load prompt.json: ${error.message}`,
    };
  }

  // Get TTS context from script
  const ttsContext = getTtsContextForShot(shot.id, scriptData);

  // Get anchor path
  let anchorPath;
  try {
    anchorPath = await getAnchorPath(promptData.anchor_image);
  } catch (error) {
    return {
      status: "error",
      message: error.message,
    };
  }

  let iteration = promptData.validation_iteration || 0;
  let currentPrompt = promptData.engineered_prompt;
  let validationResult;

  while (iteration <= CONFIG.maxIterations) {
    console.log(`    │  📊 Validating (iteration ${iteration})...`);

    // Validate the image
    try {
      validationResult = await validateImage(
        imagePath,
        anchorPath,
        currentPrompt,
        ttsContext
      );
    } catch (error) {
      console.log(`    │  ❌ Validation error: ${error.message}`);
      return {
        status: "error",
        message: `Validation failed: ${error.message}`,
      };
    }

    // Check if passed
    if (validationResult.overall_pass) {
      console.log(`    │  ✅ Passed (confidence: ${validationResult.confidence.toFixed(2)})`);

      // Save validation result
      const validationData = {
        ...validationResult,
        iteration: iteration,
        timestamp: new Date().toISOString(),
        prompt_used: currentPrompt,
      };
      await fs.writeFile(validationPath, JSON.stringify(validationData, null, 2));

      return {
        status: "approved",
        validation: validationData,
      };
    }

    // Failed validation
    console.log(`    │  ⚠️  Failed (confidence: ${validationResult.confidence.toFixed(2)})`);

    if (validationResult.issues?.length > 0) {
      console.log(`    │     Issues: ${validationResult.issues.slice(0, 2).join(", ")}`);
    }

    // Check if we should regenerate
    if (skipRegen || iteration >= CONFIG.maxIterations) {
      console.log(`    │  🛑 Max iterations reached or regen disabled`);

      // Save final validation result as rejected/flagged
      const validationData = {
        ...validationResult,
        iteration: iteration,
        timestamp: new Date().toISOString(),
        prompt_used: currentPrompt,
        status: "flagged",
      };
      await fs.writeFile(validationPath, JSON.stringify(validationData, null, 2));

      return {
        status: "flagged",
        validation: validationData,
      };
    }

    // Refine prompt and regenerate
    console.log(`    │  🔄 Refining prompt and regenerating...`);

    try {
      // Refine the prompt
      const refinedPrompt = await refinePrompt(
        currentPrompt,
        validationResult.issues || [],
        validationResult.suggestions || [],
        validationResult.criteria_scores
      );

      // Get anchor data URL for regeneration
      const anchorDataUrl = await getAnchorDataUrl(promptData.anchor_image);

      // Regenerate image
      const newImageUrl = await editImage(anchorDataUrl, refinedPrompt);

      // Download new image (overwrite existing)
      await downloadImage(newImageUrl, imagePath);
      console.log(`    │  📥 New image saved`);

      // Update prompt data
      promptData.engineered_prompt = refinedPrompt;
      promptData.validation_iteration = iteration + 1;
      promptData.prompt_history = promptData.prompt_history || [];
      promptData.prompt_history.push({
        iteration: iteration,
        prompt: currentPrompt,
        issues: validationResult.issues,
      });
      await savePromptJson(shot.promptPath, promptData);

      currentPrompt = refinedPrompt;
      iteration++;

      // Rate limiting
      await new Promise(r => setTimeout(r, CONFIG.rateLimit));

    } catch (error) {
      console.log(`    │  ❌ Regeneration failed: ${error.message}`);

      // Save as error state
      const validationData = {
        ...validationResult,
        iteration: iteration,
        timestamp: new Date().toISOString(),
        prompt_used: currentPrompt,
        status: "error",
        error: error.message,
      };
      await fs.writeFile(validationPath, JSON.stringify(validationData, null, 2));

      return {
        status: "error",
        message: error.message,
        validation: validationData,
      };
    }
  }

  // Should not reach here, but just in case
  return {
    status: "error",
    message: "Unexpected end of validation loop",
  };
}

function getTtsContextForShot(shotId, scriptData) {
  if (!scriptData?.shots) {
    return "No script context available";
  }

  // Find the shot in the script
  const shot = scriptData.shots.find(s => {
    const scriptShotId = `${String(s.shot_number).padStart(2, "0")}-${s.type}`;
    return scriptShotId === shotId || s.shot_id === shotId;
  });

  if (shot) {
    return shot.tts_text || shot.description || "No TTS context";
  }

  return "Shot not found in script";
}

// ============================================
// EXERCISE VALIDATION ORCHESTRATOR
// ============================================
async function validateExercise(exerciseName, skipRegen = false) {
  const exerciseDir = path.join(CONFIG.videoScriptsDir, exerciseName);

  // Validate exercise directory exists
  try {
    await fs.access(exerciseDir);
  } catch {
    throw new Error(`Exercise not found: ${exerciseName}`);
  }

  // Load script for TTS context
  const scriptData = await loadScriptJson(exerciseDir);

  // Get all shot folders
  const shots = await getShotFolders(exerciseDir);

  if (shots.length === 0) {
    throw new Error(`No shots found in: ${exerciseDir}/shots/`);
  }

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
║   PHASE 6: QUALITY VALIDATION & AUTO-REGENERATION             ║
║   Validate images and auto-fix issues via Claude Vision       ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
║  Total shots: ${String(shots.length).padEnd(42)}║
║  Skip regen: ${String(skipRegen).padEnd(43)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  const results = {
    approved: [],
    flagged: [],
    rejected: [],
    no_image: [],
    errors: [],
  };

  for (let i = 0; i < shots.length; i++) {
    const shot = shots[i];
    console.log(`\n┌─ [${i + 1}/${shots.length}] ${shot.id}`);

    const result = await validateShot(shot, scriptData, skipRegen);

    switch (result.status) {
      case "approved":
        results.approved.push({ shot: shot.id, ...result });
        console.log(`└─ ✅ Approved`);
        break;
      case "flagged":
        results.flagged.push({ shot: shot.id, ...result });
        console.log(`└─ ⚠️  Flagged for review`);
        break;
      case "rejected":
        results.rejected.push({ shot: shot.id, ...result });
        console.log(`└─ ❌ Rejected`);
        break;
      case "no_image":
        results.no_image.push({ shot: shot.id, ...result });
        console.log(`└─ ⏭️  No image`);
        break;
      case "error":
        results.errors.push({ shot: shot.id, ...result });
        console.log(`└─ ❌ Error: ${result.message}`);
        break;
    }

    // Rate limiting between shots
    if (i < shots.length - 1) {
      await new Promise(r => setTimeout(r, CONFIG.rateLimit));
    }
  }

  // Generate and save summary
  const summary = generateValidationSummary(exerciseName, results, shots.length);
  const summaryPath = path.join(exerciseDir, "validation-summary.json");
  await fs.writeFile(summaryPath, JSON.stringify(summary, null, 2));

  return { results, summary };
}

// ============================================
// VALIDATION SUMMARY GENERATOR
// ============================================
function generateValidationSummary(exerciseName, results, totalShots) {
  const approved = results.approved.length;
  const flagged = results.flagged.length;
  const rejected = results.rejected.length;
  const noImage = results.no_image.length;
  const errors = results.errors.length;

  // Collect blocking issues
  const blockingIssues = [];

  for (const item of results.flagged) {
    if (item.validation?.issues) {
      blockingIssues.push({
        shot: item.shot,
        issues: item.validation.issues,
      });
    }
  }

  for (const item of results.errors) {
    blockingIssues.push({
      shot: item.shot,
      issues: [item.message],
    });
  }

  // Determine if ready for assembly
  const readyForAssembly =
    flagged === 0 &&
    rejected === 0 &&
    errors === 0 &&
    noImage === 0 &&
    approved === totalShots;

  return {
    exercise: exerciseName,
    timestamp: new Date().toISOString(),
    total_shots: totalShots,
    counts: {
      approved,
      flagged,
      rejected,
      no_image: noImage,
      errors,
    },
    ready_for_assembly: readyForAssembly,
    blocking_issues: blockingIssues,
    shots: {
      approved: results.approved.map(r => r.shot),
      flagged: results.flagged.map(r => r.shot),
      rejected: results.rejected.map(r => r.shot),
      no_image: results.no_image.map(r => r.shot),
      errors: results.errors.map(r => r.shot),
    },
  };
}

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
    console.error("  --skip-regen    Skip auto-regeneration, only validate");
    console.error("  --all           Process all exercises");
    console.error("");
    console.error("Examples:");
    console.error("  node phase6-validation.js bent-over-barbell-row");
    console.error("  node phase6-validation.js --all --skip-regen");
    process.exit(1);
  }

  // Validate environment
  if (!process.env.FAL_KEY) {
    console.error("❌ FAL_KEY not found in .env file");
    process.exit(1);
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY not found in .env file");
    process.exit(1);
  }

  // Validate video-scripts directory
  try {
    await fs.access(CONFIG.videoScriptsDir);
  } catch {
    console.error(`❌ Video scripts directory not found: ${CONFIG.videoScriptsDir}`);
    console.error("   Run phase4 and phase5 first.");
    process.exit(1);
  }

  let exercises = [];

  if (processAll) {
    const entries = await fs.readdir(CONFIG.videoScriptsDir, { withFileTypes: true });
    exercises = entries
      .filter(e => e.isDirectory())
      .map(e => e.name);

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
      const { results, summary } = await validateExercise(exercise, skipRegen);
      allResults.push({ exercise, success: true, summary });
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

  let totalApproved = 0, totalFlagged = 0, totalErrors = 0;

  for (const r of allResults) {
    if (r.success) {
      const s = r.summary.counts;
      const status = r.summary.ready_for_assembly ? "✅" : "⚠️ ";
      console.log(`║  ${r.exercise.padEnd(20)} ${status} ${s.approved} ok | ${s.flagged} flag | ${s.errors} err`.padEnd(64) + `║`);
      totalApproved += s.approved;
      totalFlagged += s.flagged;
      totalErrors += s.errors;
    } else {
      console.log(`║  ${r.exercise.padEnd(20)} ❌ ${r.error.substring(0, 30)}`.padEnd(64) + `║`);
    }
  }

  console.log(`╠═══════════════════════════════════════════════════════════════╣
║  TOTALS: ${String(totalApproved).padStart(3)} approved | ${String(totalFlagged).padStart(3)} flagged | ${String(totalErrors).padStart(3)} errors            ║
╠═══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                  ║
║  1. Review flagged shots in validation.json files             ║
║  2. Manually fix or regenerate problematic images             ║
║  3. Re-run validation to verify fixes                         ║
║  4. Proceed to video assembly when ready_for_assembly: true   ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Exit with error if any issues
  if (totalFlagged > 0 || totalErrors > 0 || allResults.some(r => !r.success)) {
    process.exit(1);
  }
}

// Run main only if this is the entry point
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[\\/]/, ''));
if (isMainModule) {
  main().catch(error => {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  });
}

// Export for pipeline usage
export { validateExercise };
