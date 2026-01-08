import Anthropic from "@anthropic-ai/sdk";
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
const anchorsConfig = JSON.parse(
  await fs.readFile(path.join(__dirname, "../config/anchors.json"), "utf-8")
);

// Configure fal.ai
fal.config({
  credentials: process.env.FAL_KEY,
});

const OUTPUT_DIR = path.join(__dirname, "../output/anchors");

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function downloadImage(url, filepath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
}

async function generateAnchorImages(anchorId = null) {
  const anchors = anchorId
    ? anchorsConfig.anchors.filter((a) => a.id === anchorId)
    : anchorsConfig.anchors;

  const countPerAnchor = anchorsConfig.generate_count_per_anchor || 10;

  console.log(`\n🎨 LoRA Anchor Image Generator`);
  console.log(`================================`);
  console.log(`Character: ${character.name}`);
  console.log(`Anchors to generate: ${anchors.length}`);
  console.log(`Images per anchor: ${countPerAnchor}`);
  console.log(`Total images: ${anchors.length * countPerAnchor}`);
  console.log(`\n`);

  for (const anchor of anchors) {
    const anchorDir = path.join(OUTPUT_DIR, anchor.id);
    await ensureDir(anchorDir);

    console.log(`\n📸 Generating: ${anchor.name} (${anchor.id})`);
    console.log(`   Pose: ${anchor.pose_prompt.substring(0, 60)}...`);

    const fullPrompt = `${character.base_prompt}, ${anchor.pose_prompt}`;

    for (let i = 1; i <= countPerAnchor; i++) {
      const filename = `${anchor.id}_${String(i).padStart(3, "0")}.png`;
      const filepath = path.join(anchorDir, filename);

      // Check if already exists
      try {
        await fs.access(filepath);
        console.log(`   ⏭️  [${i}/${countPerAnchor}] Already exists, skipping`);
        continue;
      } catch {
        // File doesn't exist, generate it
      }

      console.log(`   🔄 [${i}/${countPerAnchor}] Generating...`);

      try {
        const result = await fal.subscribe("fal-ai/flux-pro/v1.1-ultra", {
          input: {
            prompt: fullPrompt,
            negative_prompt: character.negative_prompt,
            image_size: character.generation_settings.image_size || "square_hd",
            num_images: 1,
            guidance_scale:
              character.generation_settings.guidance_scale || 3.5,
            safety_tolerance:
              character.generation_settings.safety_tolerance || 2,
            enable_safety_checker: false,
          },
          logs: false,
        });

        if (result.images && result.images.length > 0) {
          await downloadImage(result.images[0].url, filepath);
          console.log(`   ✅ [${i}/${countPerAnchor}] Saved: ${filename}`);
        } else {
          console.log(`   ❌ [${i}/${countPerAnchor}] No image returned`);
        }
      } catch (error) {
        console.error(`   ❌ [${i}/${countPerAnchor}] Error: ${error.message}`);
      }

      // Small delay to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`   ✅ Completed: ${anchor.name}`);
  }

  console.log(`\n\n🎉 All anchor images generated!`);
  console.log(`📁 Output directory: ${OUTPUT_DIR}`);
  console.log(`\n📋 Next steps:`);
  console.log(`   1. Run: npm run select-anchors`);
  console.log(`   2. Pick the best image for each anchor pose`);
  console.log(`   3. Then run: npm run generate-variations`);
}

// CLI
const args = process.argv.slice(2);
const anchorId = args[0] || null;

if (anchorId) {
  console.log(`Generating only: ${anchorId}`);
}

generateAnchorImages(anchorId).catch(console.error);
