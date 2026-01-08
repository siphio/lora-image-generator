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
// CONFIGURATION - EDIT THESE AFTER TRAINING
// ============================================

// Your LoRA URL from training-result.json (after running phase3)
// Example: "https://v3.fal.media/files/abc123/lora.safetensors"
const LORA_URL = process.env.LORA_URL || "";

// Your trigger word (must match what you used in training)
const TRIGGER_WORD = "fitness_boss";

// Output directory for test images
const OUTPUT_DIR = path.join(__dirname, "../output/lora-tests");

// ============================================
// TEST PROMPTS - ADD YOUR OWN
// ============================================
const TEST_PROMPTS = [
  // Basic poses
  `${TRIGGER_WORD} standing front view, arms at sides, neutral pose`,
  `${TRIGGER_WORD} standing back view, showing full back muscles`,
  `${TRIGGER_WORD} side profile view, athletic stance`,

  // Exercise poses
  `${TRIGGER_WORD} doing a squat, side view, quads highlighted in red`,
  `${TRIGGER_WORD} at top of pull-up, chin over bar, lats highlighted`,
  `${TRIGGER_WORD} doing a deadlift, mid-lift position, back muscles engaged`,
  `${TRIGGER_WORD} doing a bicep curl, arm flexed, biceps highlighted`,

  // Dynamic poses
  `${TRIGGER_WORD} in a running pose, dynamic motion`,
  `${TRIGGER_WORD} throwing a punch, boxing stance`,
  `${TRIGGER_WORD} doing a jumping jack, arms and legs spread`,
];

// ============================================
// GENERATION SETTINGS
// ============================================
const SETTINGS = {
  image_size: "square_hd",
  num_images: 1,
  guidance_scale: 3.5,
  lora_scale: 1.0, // How strongly to apply the LoRA (0.5-1.0)
  // Add negative prompt to avoid common issues
  negative_prompt:
    "blurry, low quality, distorted, extra limbs, missing limbs, text, watermark, realistic skin, face features, hair",
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

function sanitizeFilename(prompt) {
  return prompt
    .replace(TRIGGER_WORD, "")
    .trim()
    .replace(/[^a-z0-9]/gi, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);
}

// ============================================
// MAIN GENERATION
// ============================================
async function generateTestImages() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           LORA TEST IMAGE GENERATOR                           ║
╠═══════════════════════════════════════════════════════════════╣
║  Trigger Word: ${TRIGGER_WORD.padEnd(20)}                            ║
║  Test Prompts: ${String(TEST_PROMPTS.length).padEnd(3)} prompts                                    ║
║  LoRA Scale: ${String(SETTINGS.lora_scale).padEnd(5)}                                          ║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Check for LoRA URL
  if (!LORA_URL) {
    console.error(`
❌ No LORA_URL configured!

To fix this, either:

1. Set LORA_URL in your .env file:
   LORA_URL=https://v3.fal.media/files/your-lora-url/lora.safetensors

2. Or edit the LORA_URL constant at the top of this file.

You can find your LoRA URL in:
   output/lora-training/training-result.json
   (Look for "diffusers_lora_file.url")
`);
    process.exit(1);
  }

  console.log(`🔗 Using LoRA: ${LORA_URL.substring(0, 60)}...`);

  await ensureDir(OUTPUT_DIR);

  // Create timestamped subfolder for this test run
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").substring(0, 19);
  const runDir = path.join(OUTPUT_DIR, timestamp);
  await ensureDir(runDir);

  console.log(`📁 Output folder: ${runDir}\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < TEST_PROMPTS.length; i++) {
    const prompt = TEST_PROMPTS[i];
    const filename = `${String(i + 1).padStart(2, "0")}_${sanitizeFilename(prompt)}.png`;

    console.log(`[${i + 1}/${TEST_PROMPTS.length}] ${prompt.substring(0, 60)}...`);

    try {
      const result = await fal.subscribe("fal-ai/flux-lora", {
        input: {
          prompt: prompt,
          loras: [
            {
              path: LORA_URL,
              scale: SETTINGS.lora_scale,
            },
          ],
          image_size: SETTINGS.image_size,
          num_images: SETTINGS.num_images,
          guidance_scale: SETTINGS.guidance_scale,
          output_format: "png",
        },
        logs: false,
      });

      // Handle both result.images and result.data.images formats
      const images = result.images || result.data?.images;
      if (images && images.length > 0) {
        const imageUrl = images[0].url;
        const filepath = path.join(runDir, filename);
        await downloadImage(imageUrl, filepath);
        console.log(`   ✅ Saved: ${filename}`);
        successCount++;
      } else {
        console.log(`   ⚠️ No image returned`);
        console.log(`   Debug: ${JSON.stringify(result).substring(0, 200)}`);
        failCount++;
      }
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
      failCount++;
    }

    // Small delay between requests
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  COMPLETE                                                     ║
╠═══════════════════════════════════════════════════════════════╣
║  ✅ Success: ${String(successCount).padEnd(3)} images                                       ║
║  ❌ Failed:  ${String(failCount).padEnd(3)} images                                       ║
║  📁 Output:  ${runDir.substring(runDir.length - 40).padEnd(40)}   ║
╚═══════════════════════════════════════════════════════════════╝

💡 Tips:
   - If images don't look right, try adjusting lora_scale (0.5-1.0)
   - Add more specific prompts to TEST_PROMPTS array
   - Check training-result.json for the correct LoRA URL
`);
}

// ============================================
// SINGLE IMAGE MODE (for quick tests)
// ============================================
async function generateSingle(customPrompt) {
  console.log(`\n🎨 Generating single image...`);
  console.log(`   Prompt: ${customPrompt}\n`);

  if (!LORA_URL) {
    console.error("❌ No LORA_URL configured!");
    process.exit(1);
  }

  try {
    const result = await fal.subscribe("fal-ai/flux-lora", {
      input: {
        prompt: customPrompt,
        loras: [
          {
            path: LORA_URL,
            scale: SETTINGS.lora_scale,
          },
        ],
        image_size: SETTINGS.image_size,
        num_images: 1,
        guidance_scale: SETTINGS.guidance_scale,
        output_format: "png",
      },
      logs: false,
    });

    const images = result.images || result.data?.images;
    if (images && images.length > 0) {
      await ensureDir(OUTPUT_DIR);
      const filename = `single_${Date.now()}.png`;
      const filepath = path.join(OUTPUT_DIR, filename);
      await downloadImage(images[0].url, filepath);
      console.log(`✅ Saved: ${filepath}`);
    } else {
      console.log(`⚠️ No image returned`);
      console.log(`Debug: ${JSON.stringify(result).substring(0, 300)}`);
    }
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
  }
}

// ============================================
// CLI HANDLING
// ============================================
const args = process.argv.slice(2);

if (args.length > 0) {
  // Single image mode: npm run test-lora "your prompt here"
  const prompt = args.join(" ");
  generateSingle(prompt);
} else {
  // Batch mode: npm run test-lora
  generateTestImages();
}
