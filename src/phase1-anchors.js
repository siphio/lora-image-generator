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
// CHARACTER DEFINITION - EDIT THIS
// ============================================
const CHARACTER = {
  base_prompt: `Orange anatomical mannequin figure with 3D wireframe mesh grid pattern across entire body surface, faceless head with simple black oval eyes, wearing olive army green athletic shorts, grey athletic sneakers with white soles, solid cream beige background, clean vector illustration style, professional fitness character design, full body visible, sharp clean lines`,

  negative_prompt: `realistic human skin, facial features, hair, beard, text, watermark, signature, blurry, low quality, distorted anatomy, extra limbs, missing limbs, deformed, cropped, multiple figures, busy background`,
};

// ============================================
// 8 ANCHOR POSES - These become your reference images
// ============================================
const ANCHORS = [
  {
    id: "front",
    name: "Front Standing",
    prompt: "standing facing camera front view, arms relaxed at sides, feet shoulder width apart, neutral pose, full body head to toe",
  },
  {
    id: "back",
    name: "Back Standing",
    prompt: "standing with back to camera rear view, arms relaxed at sides, showing full back, full body head to toe",
  },
  {
    id: "side",
    name: "Side Profile",
    prompt: "standing side profile view, facing left, arms at sides, full body silhouette, full body head to toe",
  },
  {
    id: "quarter",
    name: "Three-Quarter View",
    prompt: "standing three-quarter angle, body turned 45 degrees to camera, relaxed stance, full body head to toe",
  },
  {
    id: "arms_up",
    name: "Arms Raised",
    prompt: "standing front view with both arms raised straight overhead, hands reaching up, full body head to toe",
  },
  {
    id: "bent",
    name: "Bent Over",
    prompt: "bent over at waist, torso parallel to ground, knees slightly bent, arms hanging down, side view, full body",
  },
  {
    id: "seated",
    name: "Seated",
    prompt: "sitting upright on bench, feet flat on ground, hands resting on thighs, front view, full body",
  },
  {
    id: "hanging",
    name: "Hanging from Bar",
    prompt: "hanging from pull-up bar, arms fully extended overhead gripping bar, body straight and relaxed, front view, full body",
  },
];

const IMAGES_PER_ANCHOR = 10;
const OUTPUT_DIR = path.join(__dirname, "../output/anchors");

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

async function generateImage(prompt) {
  const result = await fal.subscribe("fal-ai/flux-pro/v1.1-ultra", {
    input: {
      prompt: prompt,
      negative_prompt: CHARACTER.negative_prompt,
      image_size: "square_hd",
      num_images: 1,
      guidance_scale: 3.5,
      safety_tolerance: 2,
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
async function generateAnchors() {
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PHASE 1: ANCHOR IMAGE GENERATION                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Generating ${ANCHORS.length} anchor poses × ${IMAGES_PER_ANCHOR} images each = ${ANCHORS.length * IMAGES_PER_ANCHOR} total       ║
║  These will be your character reference images                ║
╚═══════════════════════════════════════════════════════════════╝
`);

  await ensureDir(OUTPUT_DIR);

  let totalGenerated = 0;
  let totalSkipped = 0;

  for (const anchor of ANCHORS) {
    const anchorDir = path.join(OUTPUT_DIR, anchor.id);
    await ensureDir(anchorDir);

    console.log(`\n┌─ ${anchor.name} (${anchor.id})`);
    console.log(`│  "${anchor.prompt.substring(0, 50)}..."`);

    const fullPrompt = `${CHARACTER.base_prompt}, ${anchor.prompt}`;

    for (let i = 1; i <= IMAGES_PER_ANCHOR; i++) {
      const filename = `${anchor.id}_${String(i).padStart(2, "0")}.png`;
      const filepath = path.join(anchorDir, filename);

      // Skip if exists
      try {
        await fs.access(filepath);
        console.log(`│  ⏭️  [${i}/${IMAGES_PER_ANCHOR}] ${filename} exists, skipping`);
        totalSkipped++;
        continue;
      } catch {}

      process.stdout.write(`│  🔄 [${i}/${IMAGES_PER_ANCHOR}] Generating ${filename}...`);

      try {
        const url = await generateImage(fullPrompt);
        await downloadImage(url, filepath);
        console.log(` ✅`);
        totalGenerated++;
      } catch (error) {
        console.log(` ❌ ${error.message}`);
      }

      // Rate limit protection
      await new Promise((r) => setTimeout(r, 300));
    }

    console.log(`└─ Done\n`);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  COMPLETE                                                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Generated: ${totalGenerated} images                                       ║
║  Skipped:   ${totalSkipped} images (already existed)                      ║
║  Location:  output/anchors/                                   ║
╠═══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                  ║
║  1. Run: npm run gallery                                      ║
║  2. Select the best image for each anchor pose                ║
║  3. Then run: npm run phase2                                  ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

generateAnchors().catch(console.error);
