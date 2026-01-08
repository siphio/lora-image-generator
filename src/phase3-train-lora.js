import 'dotenv/config';
import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import { createWriteStream, createReadStream } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import archiver from "archiver";

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
  // Where your curated images live
  inputDir: path.join(__dirname, "../output/variations-final"),

  // Where to save training data ZIP and results
  outputDir: path.join(__dirname, "../output/lora-training"),

  // LoRA training settings
  training: {
    // The trigger word you'll use in prompts to activate your character
    triggerWord: "fitness_boss",

    // Training steps (more = better fit, but risk overfitting)
    // 1000-1500 is usually good for 20-50 images
    steps: 1000,

    // Is this a style LoRA? Set false for character/subject training
    isStyle: false,

    // Create masks for training (helps with character training)
    createMasks: true,
  },

  // Base caption describing your character (used for all images)
  baseCaption:
    "anatomical muscle mannequin figure, orange-amber colored with wireframe mesh grid lines across body, faceless head with black oval eyes, wearing olive green shorts and grey sneakers, cream background",
};

// ============================================
// HELPER FUNCTIONS
// ============================================
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function getAllImages(dir) {
  const images = [];

  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (entry.isFile() && /\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
        images.push(fullPath);
      }
    }
  }

  await scan(dir);
  return images;
}

function getPoseFromPath(imagePath) {
  const parts = imagePath.split(path.sep);
  const poseFolder = parts[parts.length - 2];
  return poseFolder.replace(/_/g, " ");
}

function generateCaption(imagePath) {
  const pose = getPoseFromPath(imagePath);
  const triggerWord = CONFIG.training.triggerWord;
  return `A photo of ${triggerWord}, ${CONFIG.baseCaption}, ${pose} pose`;
}

// ============================================
// CREATE TRAINING ZIP FILE
// ============================================
async function createTrainingZip(trainingData) {
  const zipPath = path.join(CONFIG.outputDir, "training-data.zip");

  return new Promise((resolve, reject) => {
    const output = createWriteStream(zipPath);
    const archive = archiver("zip", { zlib: { level: 9 } });

    output.on("close", () => {
      console.log(`   ZIP created: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
      resolve(zipPath);
    });

    archive.on("error", (err) => reject(err));
    archive.pipe(output);

    // Add each image and its caption file
    let index = 1;
    for (const item of trainingData) {
      const baseName = `image_${String(index).padStart(3, "0")}`;
      const ext = path.extname(item.path);

      // Add image
      archive.file(item.path, { name: `${baseName}${ext}` });

      // Add caption as .txt file with same base name
      archive.append(item.caption, { name: `${baseName}.txt` });

      index++;
    }

    archive.finalize();
  });
}

// ============================================
// STEP 1: PREPARE TRAINING DATA
// ============================================
async function prepareTrainingData() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           STEP 1: PREPARE TRAINING DATA                       ║
╚═══════════════════════════════════════════════════════════════╝
`);

  await ensureDir(CONFIG.outputDir);

  console.log(`📂 Scanning ${CONFIG.inputDir}...`);
  const images = await getAllImages(CONFIG.inputDir);
  console.log(`   Found ${images.length} images\n`);

  if (images.length < 10) {
    console.error("❌ Need at least 10 images for LoRA training. Found:", images.length);
    process.exit(1);
  }

  const trainingData = [];

  console.log("📝 Generating captions...\n");

  for (const imagePath of images) {
    const caption = generateCaption(imagePath);
    const relativePath = path.relative(CONFIG.inputDir, imagePath);

    trainingData.push({
      path: imagePath,
      relativePath,
      caption,
    });

    console.log(`   ${relativePath}`);
    console.log(`   └─ "${caption.substring(0, 60)}..."\n`);
  }

  // Save caption manifest
  const manifestPath = path.join(CONFIG.outputDir, "captions.json");
  await fs.writeFile(manifestPath, JSON.stringify(trainingData, null, 2));

  console.log(`\n✅ Prepared ${trainingData.length} images with captions`);
  console.log(`📄 Caption manifest saved to: ${manifestPath}`);

  return trainingData;
}

// ============================================
// STEP 2: UPLOAD AND TRAIN LORA
// ============================================
async function trainLora(trainingData) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           STEP 2: CREATE ZIP & UPLOAD                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Model: Flux LoRA Fast Training                               ║
║  Images: ${String(trainingData.length).padEnd(3)} images                                          ║
║  Steps: ${String(CONFIG.training.steps).padEnd(4)} iterations                                     ║
║  Trigger: "${CONFIG.training.triggerWord}"                                       ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Step 2a: Create ZIP file with images and captions
  console.log("📦 Creating training ZIP file...\n");
  const zipPath = await createTrainingZip(trainingData);

  // Step 2b: Upload ZIP to fal.ai storage
  console.log("\n📤 Uploading ZIP to fal.ai storage...");
  const zipBuffer = await fs.readFile(zipPath);
  const zipFile = new File([zipBuffer], "training-data.zip", { type: "application/zip" });
  const zipUrl = await fal.storage.upload(zipFile);
  console.log(`   ✅ Uploaded: ${zipUrl}`);

  // Step 2c: Start training
  console.log(`\n🚀 Starting LoRA training on fal.ai...`);
  console.log(`   Using endpoint: fal-ai/flux-lora-fast-training`);
  console.log(`   This typically takes 10-30 minutes.\n`);

  try {
    const result = await fal.subscribe("fal-ai/flux-lora-fast-training", {
      input: {
        images_data_url: String(zipUrl),
        trigger_word: CONFIG.training.triggerWord,
        steps: CONFIG.training.steps,
        is_style: CONFIG.training.isStyle,
        create_masks: CONFIG.training.createMasks,
      },
      logs: true,
      onQueueUpdate: (update) => {
        if (update.status === "IN_PROGRESS") {
          console.log(`   ⏳ Training in progress...`);
          if (update.logs) {
            update.logs.forEach((log) => console.log(`      ${log.message}`));
          }
        } else if (update.status === "IN_QUEUE") {
          console.log(`   🕐 Position in queue: ${update.queue_position || "unknown"}`);
        }
      },
    });

    console.log(`\n✅ Training complete!`);

    // Save results
    const resultsPath = path.join(CONFIG.outputDir, "training-result.json");
    await fs.writeFile(resultsPath, JSON.stringify(result, null, 2));

    console.log(`\n📊 Training Results:`);
    console.log(`   LoRA URL: ${result.diffusers_lora_file?.url || "Check training-result.json"}`);
    console.log(`   Results saved to: ${resultsPath}`);

    return result;
  } catch (error) {
    console.error(`\n❌ Training failed: ${error.message}`);

    const errorPath = path.join(CONFIG.outputDir, "training-error.json");
    await fs.writeFile(
      errorPath,
      JSON.stringify(
        {
          error: error.message,
          details: error.body || error,
          timestamp: new Date().toISOString(),
        },
        null,
        2
      )
    );

    console.log(`   Error details saved to: ${errorPath}`);
    throw error;
  }
}

// ============================================
// STEP 3: TEST THE TRAINED LORA
// ============================================
async function testLora(trainingResult) {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           STEP 3: TEST TRAINED LORA                           ║
╚═══════════════════════════════════════════════════════════════╝
`);

  const loraUrl = trainingResult.diffusers_lora_file?.url;

  if (!loraUrl) {
    console.log("⚠️  No LoRA URL found in training result. Skipping test.");
    return;
  }

  const testPrompts = [
    `${CONFIG.training.triggerWord} doing a squat, side view`,
    `${CONFIG.training.triggerWord} in a boxing stance, front view`,
    `${CONFIG.training.triggerWord} doing jumping jacks, arms up`,
  ];

  const testDir = path.join(CONFIG.outputDir, "test-outputs");
  await ensureDir(testDir);

  console.log(`🧪 Generating test images with your new LoRA...\n`);

  for (let i = 0; i < testPrompts.length; i++) {
    const prompt = testPrompts[i];
    console.log(`   [${i + 1}/${testPrompts.length}] "${prompt}"`);

    try {
      const result = await fal.subscribe("fal-ai/flux-lora", {
        input: {
          prompt: prompt,
          loras: [
            {
              path: loraUrl,
              scale: 1.0,
            },
          ],
          image_size: "square_hd",
          num_images: 1,
          guidance_scale: 3.5,
        },
        logs: false,
      });

      if (result.images && result.images.length > 0) {
        const imageUrl = result.images[0].url;
        const response = await fetch(imageUrl);
        const buffer = await response.arrayBuffer();

        const filename = `test_${i + 1}.png`;
        const filepath = path.join(testDir, filename);
        await fs.writeFile(filepath, Buffer.from(buffer));

        console.log(`      ✅ Saved to ${filename}`);
      }
    } catch (error) {
      console.log(`      ❌ Failed: ${error.message}`);
    }
  }

  console.log(`\n📁 Test images saved to: ${testDir}`);
}

// ============================================
// MAIN
// ============================================
async function main() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗      ██████╗ ██████╗  █████╗                            ║
║   ██║     ██╔═══██╗██╔══██╗██╔══██╗                           ║
║   ██║     ██║   ██║██████╔╝███████║                           ║
║   ██║     ██║   ██║██╔══██╗██╔══██║                           ║
║   ███████╗╚██████╔╝██║  ██║██║  ██║                           ║
║   ╚══════╝ ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝                           ║
║                                                               ║
║   PHASE 3: LORA TRAINING PIPELINE                             ║
║   Train a custom character model on fal.ai                    ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
`);

  if (!process.env.FAL_KEY) {
    console.error("❌ FAL_KEY not found in .env file");
    process.exit(1);
  }

  try {
    await fs.access(CONFIG.inputDir);
  } catch {
    console.error(`❌ Input directory not found: ${CONFIG.inputDir}`);
    console.error("   Run phase 1 and 2 first to generate and curate images.");
    process.exit(1);
  }

  try {
    const trainingData = await prepareTrainingData();

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  READY TO TRAIN                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Images: ${String(trainingData.length).padEnd(3)} curated images                                 ║
║  Cost: ~$5-10 (depending on steps)                            ║
║  Time: ~10-30 minutes                                         ║
╠═══════════════════════════════════════════════════════════════╣
║  The script will now create ZIP, upload, and start training.  ║
║  Press Ctrl+C within 10 seconds to cancel.                    ║
╚═══════════════════════════════════════════════════════════════╝
`);

    await new Promise((resolve) => setTimeout(resolve, 10000));

    const result = await trainLora(trainingData);

    if (result) {
      await testLora(result);
    }

    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎉 ALL DONE!                                                 ║
╠═══════════════════════════════════════════════════════════════╣
║  Your LoRA is trained and ready to use.                       ║
║                                                               ║
║  NEXT STEPS:                                                  ║
║  1. Check test images in output/lora-training/test-outputs/   ║
║  2. Download your LoRA from the URL in training-result.json   ║
║  3. Use trigger word "${CONFIG.training.triggerWord}" in prompts              ║
║                                                               ║
║  EXAMPLE PROMPT:                                              ║
║  "${CONFIG.training.triggerWord} doing a deadlift, side view"                 ║
╚═══════════════════════════════════════════════════════════════╝
`);
  } catch (error) {
    console.error("\n❌ Pipeline failed:", error.message);
    process.exit(1);
  }
}

main();
