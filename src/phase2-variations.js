import * as fal from "@fal-ai/serverless-client";
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
// CHARACTER DEFINITION - Must match Phase 1
// ============================================
const CHARACTER = {
  base_prompt: `Orange anatomical mannequin figure with 3D wireframe mesh grid pattern across entire body surface, faceless head with simple black oval eyes, wearing olive army green athletic shorts, grey athletic sneakers with white soles, solid cream beige background, clean vector illustration style, professional fitness character design, full body visible, sharp clean lines`,

  negative_prompt: `realistic human skin, facial features, hair, beard, text, watermark, signature, blurry, low quality, distorted anatomy, extra limbs, missing limbs, deformed, cropped, multiple figures, busy background`,
};

// ============================================
// POSE VARIATIONS - Each references an anchor
// ============================================
const VARIATIONS = [
  // PULL-UP / HANGING variations (from "hanging" anchor)
  { id: "pullup_top", anchor: "hanging", prompt: "chin above the bar, elbows bent down, lats contracted, pulling up", strength: 0.55 },
  { id: "pullup_mid", anchor: "hanging", prompt: "halfway up, arms bent 90 degrees, actively pulling", strength: 0.5 },
  { id: "chinup_top", anchor: "hanging", prompt: "chin-up with palms facing body, chin over bar, biceps flexed", strength: 0.55 },
  { id: "hanging_leg_raise", anchor: "hanging", prompt: "legs raised to 90 degrees in front, core engaged", strength: 0.6 },

  // BENT OVER / ROW variations (from "bent" anchor)
  { id: "barbell_row_start", anchor: "bent", prompt: "gripping barbell, arms extended down", strength: 0.45 },
  { id: "barbell_row_top", anchor: "bent", prompt: "rowing barbell to chest, elbows back, squeezing back", strength: 0.55 },
  { id: "dumbbell_row", anchor: "bent", prompt: "one arm rowing dumbbell, other arm on bench", strength: 0.55 },
  { id: "deadlift_start", anchor: "bent", prompt: "gripping barbell on ground, about to lift", strength: 0.55 },

  // SEATED variations (from "seated" anchor)
  { id: "lat_pulldown_start", anchor: "seated", prompt: "arms extended up gripping lat pulldown bar", strength: 0.55 },
  { id: "lat_pulldown_end", anchor: "seated", prompt: "pulling bar to chest, elbows down, lats squeezed", strength: 0.55 },
  { id: "cable_row_start", anchor: "seated", prompt: "arms extended forward holding cable handle", strength: 0.5 },
  { id: "cable_row_end", anchor: "seated", prompt: "pulling cable to stomach, elbows back", strength: 0.55 },
  { id: "seated_press", anchor: "seated", prompt: "pressing dumbbells overhead, arms extended", strength: 0.55 },

  // FRONT STANDING variations (from "front" anchor)
  { id: "bicep_curl_start", anchor: "front", prompt: "holding dumbbells at sides, arms straight", strength: 0.4 },
  { id: "bicep_curl_top", anchor: "front", prompt: "curling dumbbells up, biceps fully flexed", strength: 0.5 },
  { id: "front_double_bicep", anchor: "front", prompt: "front double bicep pose, arms raised and flexed", strength: 0.55 },
  { id: "front_lat_spread", anchor: "front", prompt: "hands on hips, lats flared wide, front lat spread", strength: 0.5 },
  { id: "shrug", anchor: "front", prompt: "shrugging shoulders up, holding dumbbells", strength: 0.45 },

  // BACK STANDING variations (from "back" anchor)
  { id: "rear_lat_spread", anchor: "back", prompt: "hands on hips, lats spread wide, rear view", strength: 0.5 },
  { id: "rear_double_bicep", anchor: "back", prompt: "rear double bicep pose, arms raised showing back", strength: 0.55 },

  // ARMS UP variations (from "arms_up" anchor)
  { id: "shoulder_press_top", anchor: "arms_up", prompt: "arms fully extended pressing dumbbells overhead", strength: 0.45 },
  { id: "shoulder_press_mid", anchor: "arms_up", prompt: "dumbbells at shoulder level, about to press", strength: 0.5 },
  { id: "tricep_overhead", anchor: "arms_up", prompt: "holding dumbbell behind head, tricep stretch", strength: 0.55 },

  // SIDE VIEW variations (from "side" anchor)
  { id: "squat_bottom", anchor: "side", prompt: "deep squat, thighs parallel, barbell on back", strength: 0.6 },
  { id: "squat_top", anchor: "side", prompt: "standing tall with barbell on upper back", strength: 0.5 },
  { id: "pushup_top", anchor: "side", prompt: "push-up position, arms extended, body straight", strength: 0.6 },
  { id: "pushup_bottom", anchor: "side", prompt: "push-up bottom, chest near ground", strength: 0.6 },
  { id: "plank", anchor: "side", prompt: "plank on forearms, body straight, core tight", strength: 0.6 },

  // QUARTER VIEW variations (from "quarter" anchor)
  { id: "lunge_front", anchor: "quarter", prompt: "forward lunge, front knee bent, back knee down", strength: 0.6 },
  { id: "lunge_back", anchor: "quarter", prompt: "reverse lunge stepping back", strength: 0.6 },
  { id: "step_up", anchor: "quarter", prompt: "stepping up onto box, one leg raised", strength: 0.55 },
];

const IMAGES_PER_VARIATION = 3;
const ANCHORS_DIR = path.join(__dirname, "../output/anchors-selected");
const OUTPUT_DIR = path.join(__dirname, "../output/variations");

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

async function getAnchorImage(anchorId) {
  // Check for selected anchor first
  const selectedPath = path.join(ANCHORS_DIR, `${anchorId}.png`);
  try {
    await fs.access(selectedPath);
    return selectedPath;
  } catch {}

  // Fall back to first image in anchor folder
  const anchorDir = path.join(__dirname, "../output/anchors", anchorId);
  const files = await fs.readdir(anchorDir);
  const pngs = files.filter((f) => f.endsWith(".png")).sort();
  if (pngs.length > 0) {
    return path.join(anchorDir, pngs[0]);
  }

  throw new Error(`No anchor image found for: ${anchorId}`);
}

async function fileToDataUrl(filepath) {
  const buffer = await fs.readFile(filepath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function editImage(imageUrl, prompt, strength) {
  // Using fal.ai image-to-image endpoint
  const result = await fal.subscribe("fal-ai/flux/dev/image-to-image", {
    input: {
      image_url: imageUrl,
      prompt: prompt,
      strength: strength,
      num_images: 1,
      guidance_scale: 3.5,
      num_inference_steps: 28,
      enable_safety_checker: false,
    },
    logs: false,
  });

  if (result.images && result.images.length > 0) {
    return result.images[0].url;
  }
  throw new Error("No image returned");
}

// ============================================
// MAIN GENERATION
// ============================================
async function generateVariations() {
  const totalImages = VARIATIONS.length * IMAGES_PER_VARIATION;

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PHASE 2: VARIATION GENERATION                       ║
╠═══════════════════════════════════════════════════════════════╣
║  ${VARIATIONS.length} variations × ${IMAGES_PER_VARIATION} images each = ${totalImages} total images           ║
║  Using anchor images as reference for consistency             ║
╚═══════════════════════════════════════════════════════════════╝
`);

  await ensureDir(OUTPUT_DIR);
  await ensureDir(ANCHORS_DIR);

  // Cache loaded anchors
  const anchorCache = {};

  let totalGenerated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  for (const variation of VARIATIONS) {
    const varDir = path.join(OUTPUT_DIR, variation.id);
    await ensureDir(varDir);

    console.log(`\n┌─ ${variation.id}`);
    console.log(`│  Anchor: ${variation.anchor} | Strength: ${variation.strength}`);
    console.log(`│  "${variation.prompt.substring(0, 50)}..."`);

    // Load anchor image
    let anchorDataUrl;
    try {
      if (!anchorCache[variation.anchor]) {
        const anchorPath = await getAnchorImage(variation.anchor);
        anchorCache[variation.anchor] = await fileToDataUrl(anchorPath);
        console.log(`│  📁 Loaded anchor: ${variation.anchor}`);
      }
      anchorDataUrl = anchorCache[variation.anchor];
    } catch (error) {
      console.log(`│  ❌ No anchor found: ${error.message}`);
      console.log(`└─ Skipped\n`);
      totalErrors += IMAGES_PER_VARIATION;
      continue;
    }

    const fullPrompt = `${CHARACTER.base_prompt}, ${variation.prompt}`;

    for (let i = 1; i <= IMAGES_PER_VARIATION; i++) {
      const filename = `${variation.id}_${String(i).padStart(2, "0")}.png`;
      const filepath = path.join(varDir, filename);

      // Skip if exists
      try {
        await fs.access(filepath);
        console.log(`│  ⏭️  [${i}/${IMAGES_PER_VARIATION}] ${filename} exists`);
        totalSkipped++;
        continue;
      } catch {}

      process.stdout.write(`│  🔄 [${i}/${IMAGES_PER_VARIATION}] ${filename}...`);

      try {
        const url = await editImage(anchorDataUrl, fullPrompt, variation.strength);
        await downloadImage(url, filepath);
        console.log(` ✅`);
        totalGenerated++;
      } catch (error) {
        console.log(` ❌ ${error.message}`);
        totalErrors++;
      }

      // Rate limit
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`└─ Done`);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  COMPLETE                                                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Generated: ${String(totalGenerated).padEnd(4)} images                                    ║
║  Skipped:   ${String(totalSkipped).padEnd(4)} images (already existed)                   ║
║  Errors:    ${String(totalErrors).padEnd(4)} images                                      ║
║  Location:  output/variations/                                ║
╠═══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                  ║
║  1. Run: npm run gallery                                      ║
║  2. Select the best 20-30 images for LoRA training            ║
║  3. Run: npm run export                                       ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

generateVariations().catch(console.error);
