import * as fal from "@fal-ai/serverless-client";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load configs
const character = JSON.parse(
  await fs.readFile(path.join(__dirname, "../config/character.json"), "utf-8")
);
const variationsConfig = JSON.parse(
  await fs.readFile(path.join(__dirname, "../config/variations.json"), "utf-8")
);

// Configure fal.ai
fal.config({
  credentials: process.env.FAL_KEY,
});

const ANCHORS_DIR = path.join(__dirname, "../output/anchors");
const SELECTED_DIR = path.join(__dirname, "../output/anchors-selected");
const OUTPUT_DIR = path.join(__dirname, "../output/variations");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
}

async function fileToBase64(filepath) {
  const buffer = await fs.readFile(filepath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function findSelectedAnchor(anchorId) {
  // First check selected folder
  const selectedPath = path.join(SELECTED_DIR, `${anchorId}.png`);
  try {
    await fs.access(selectedPath);
    return selectedPath;
  } catch {
    // Not in selected folder, use first from anchors folder
    const anchorDir = path.join(ANCHORS_DIR, anchorId);
    const files = await fs.readdir(anchorDir);
    const pngFiles = files.filter((f) => f.endsWith(".png")).sort();
    if (pngFiles.length > 0) {
      console.log(
        `   ⚠️  Using first image for anchor "${anchorId}" (no selection made)`
      );
      return path.join(anchorDir, pngFiles[0]);
    }
    throw new Error(`No anchor images found for: ${anchorId}`);
  }
}

async function generateVariations(variationId = null) {
  const variations = variationId
    ? variationsConfig.variations.filter((v) => v.id === variationId)
    : variationsConfig.variations;

  const countPerVariation = variationsConfig.generate_count_per_variation || 5;

  console.log(`\n🎨 LoRA Variation Generator`);
  console.log(`============================`);
  console.log(`Character: ${character.name}`);
  console.log(`Variations to generate: ${variations.length}`);
  console.log(`Images per variation: ${countPerVariation}`);
  console.log(`Total images: ${variations.length * countPerVariation}`);
  console.log(`\n`);

  await ensureDir(OUTPUT_DIR);

  for (const variation of variations) {
    const variationDir = path.join(OUTPUT_DIR, variation.id);
    await ensureDir(variationDir);

    console.log(`\n📸 Generating: ${variation.name} (${variation.id})`);
    console.log(`   Anchor: ${variation.anchor}`);
    console.log(`   Strength: ${variation.strength}`);
    console.log(`   Edit: ${variation.edit_prompt.substring(0, 50)}...`);

    // Find anchor image
    let anchorPath;
    try {
      anchorPath = await findSelectedAnchor(variation.anchor);
    } catch (error) {
      console.log(`   ❌ Skipping: ${error.message}`);
      continue;
    }

    const anchorBase64 = await fileToBase64(anchorPath);
    const fullPrompt = `${character.base_prompt}, ${variation.edit_prompt}`;

    for (let i = 1; i <= countPerVariation; i++) {
      const filename = `${variation.id}_${String(i).padStart(3, "0")}.png`;
      const filepath = path.join(variationDir, filename);

      // Check if already exists
      try {
        await fs.access(filepath);
        console.log(`   ⏭️  [${i}/${countPerVariation}] Already exists, skipping`);
        continue;
      } catch {
        // File doesn't exist, generate it
      }

      console.log(`   🔄 [${i}/${countPerVariation}] Generating...`);

      try {
        // Using Flux Dev image-to-image
        const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
          input: {
            image_url: anchorBase64,
            prompt: fullPrompt,
            strength: variation.strength || 0.55,
            num_images: 1,
            guidance_scale: 3.5,
            num_inference_steps: 28,
            enable_safety_checker: false,
          },
          logs: false,
        });

        if (result.images && result.images.length > 0) {
          await downloadImage(result.images[0].url, filepath);
          console.log(`   ✅ [${i}/${countPerVariation}] Saved: ${filename}`);
        } else {
          console.log(`   ❌ [${i}/${countPerVariation}] No image returned`);
        }
      } catch (error) {
        console.error(
          `   ❌ [${i}/${countPerVariation}] Error: ${error.message}`
        );
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`   ✅ Completed: ${variation.name}`);
  }

  console.log(`\n\n🎉 All variation images generated!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Run: npm run select-variations`);
  console.log(`   2. Pick the best 20-30 images for LoRA training`);
  console.log(`   3. Export to training folder`);
}

// CLI
const args = process.argv.slice(2);
const variationId = args[0] || null;

if (variationId) {
  console.log(`Generating only: ${variationId}`);
}

generateVariations(variationId).catch(console.error);
