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

// Run main only if this is the entry point
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[\\/]/, ''));
if (isMainModule) {
  main().catch(error => {
    console.error("❌ Fatal error:", error.message);
    process.exit(1);
  });
}

// Export for pipeline usage
export { generateImagesForExercise };
