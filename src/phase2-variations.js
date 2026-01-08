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
// CHARACTER DEFINITION - Must match Phase 1
// ============================================
const CHARACTER = {
  base_prompt: `Orange anatomical mannequin figure with 3D wireframe mesh grid pattern across entire body surface, faceless head with simple black oval eyes, wearing olive army green athletic shorts, grey athletic sneakers with white soles, on seamless solid flat cream beige background color hex F5E6D3, no gym equipment, no machines, no weights, no bench, no cables, no props, no floor, figure floating on solid cream beige background, clean matte backdrop, clean vector illustration style, professional fitness character design, full body visible, sharp clean lines`,

  negative_prompt: `realistic human skin, facial features, hair, beard, text, watermark, signature, blurry, low quality, distorted anatomy, extra limbs, missing limbs, deformed, cropped, multiple figures, busy background, gym equipment, weights, machines, bench, cables, floor, environment`,
};

// ============================================
// AVAILABLE ANCHORS (9 total)
// ============================================
const ANCHORS = ["front", "back", "side", "quarter", "arms_up", "bent", "seated", "hanging", "lying"];

// ============================================
// ESSENTIAL POSE VARIATIONS (50 total)
// All prompts describe BODY POSITION only, no equipment
// ============================================
const VARIATIONS = [
  // ==========================================
  // CHEST (6 variations)
  // ==========================================
  { id: "bench_press_bottom", anchor: "lying", prompt: "lying supine, elbows bent 90 degrees out to sides, upper arms parallel to ground, hands at chest level in pressing grip, chest stretched open", strength: 0.55 },
  { id: "bench_press_top", anchor: "lying", prompt: "lying supine, arms extended straight up toward ceiling, hands shoulder width apart in pressing grip, chest contracted, shoulders stable", strength: 0.55 },
  { id: "chest_fly_open", anchor: "lying", prompt: "lying supine, arms spread wide to sides with slight elbow bend, palms facing up, chest stretched open wide in hugging position", strength: 0.55 },
  { id: "chest_fly_closed", anchor: "lying", prompt: "lying supine on back, both arms raised straight up above chest then brought together with hands touching in center above sternum, arms nearly straight with only slight bend at elbows, palms facing each other, chest muscles squeezed tight", strength: 0.55 },
  { id: "pushup_bottom", anchor: "side", prompt: "prone position, chest lowered near ground, elbows bent back at 45 degrees, body straight from head to heels, about to push up", strength: 0.60 },
  { id: "pushup_top", anchor: "side", prompt: "prone plank position, arms fully extended, body straight as board from head to heels, hands flat below shoulders, core tight", strength: 0.60 },

  // ==========================================
  // BACK (8 variations)
  // ==========================================
  { id: "pullup_hang", anchor: "hanging", prompt: "figure with BOTH arms stretched straight up overhead reaching to sky, body hanging vertically relaxed, legs straight down, lats stretched long, no bar no equipment just empty hands reaching up, dead hang position", strength: 0.50 },
  { id: "pullup_top", anchor: "hanging", prompt: "figure pulled up high with BOTH arms overhead bent at elbows, hands above head level, elbows pulled down toward ribs, lats fully contracted and squeezed, back muscles engaged, no bar no equipment, body elevated", strength: 0.55 },
  { id: "lat_pulldown_start", anchor: "seated", prompt: "seated upright, arms extended up overhead reaching high, lats stretched long, chest up proud", strength: 0.55 },
  { id: "lat_pulldown_contracted", anchor: "seated", prompt: "seated upright, arms pulled down with elbows driving to sides, hands at upper chest level, lats squeezed tight", strength: 0.55 },
  { id: "barbell_row_down", anchor: "bent", prompt: "torso bent forward at hips hinged at 45-90 degrees, upper body leaning forward parallel to ground, BOTH arms hanging straight DOWN toward floor with empty hands, back flat, looking down, bent over row starting position, no equipment", strength: 0.50 },
  { id: "barbell_row_up", anchor: "bent", prompt: "torso bent forward at hips hinged at 45-90 degrees, upper body leaning forward, BOTH arms pulled UP with elbows bent and raised past torso pointing back, hands near ribcage, shoulder blades squeezed together, rowing motion top position, no equipment empty hands", strength: 0.55 },
  { id: "deadlift_start", anchor: "bent", prompt: "bent at hips in deep hip hinge, arms extended down between knees, back flat, hips loaded back, ready to lift", strength: 0.55 },
  { id: "deadlift_lockout", anchor: "front", prompt: "STANDING FULLY UPRIGHT on both feet, completely vertical torso, legs straight, hips pushed forward, proud chest, shoulders pulled back, arms hanging relaxed straight down at sides with empty hands, tall proud standing posture from front view", strength: 0.50 },

  // ==========================================
  // SHOULDERS (6 variations)
  // ==========================================
  { id: "shoulder_press_start", anchor: "front", prompt: "standing tall, hands at shoulder level palms facing forward, elbows bent and flared out to sides", strength: 0.50 },
  { id: "shoulder_press_top", anchor: "hands-up", prompt: "standing tall, arms fully extended overhead, hands above head, shoulders engaged, deltoids contracted", strength: 0.50 },
  { id: "lateral_raise_down", anchor: "front", prompt: "standing tall, arms hanging straight down at sides, palms facing thighs, shoulders relaxed", strength: 0.45 },
  { id: "lateral_raise_up", anchor: "front", prompt: "standing tall, both arms raised out to sides at shoulder height, T-pose position, palms facing down, deltoids engaged", strength: 0.55 },
  { id: "rear_delt_fly_open", anchor: "bent", prompt: "upper body BENT FORWARD at waist with torso hinged parallel to ground, NOT squatting, legs relatively straight with slight knee bend, arms hanging straight DOWN toward floor beneath chest, palms facing each other, flat back, head looking down, bent over position NOT a squat", strength: 0.50 },
  { id: "rear_delt_fly_contracted", anchor: "bent", prompt: "bent over at waist, arms raised out to sides squeezing shoulder blades together, rear deltoids contracted", strength: 0.55 },

  // ==========================================
  // BICEPS (4 variations)
  // ==========================================
  { id: "bicep_curl_start", anchor: "front", prompt: "standing tall upright, BOTH arms hanging straight down at sides completely relaxed, EMPTY HANDS with palms facing forward, NO weights NO dumbbells NO kettlebells NO equipment, just empty open hands at thigh level, biceps stretched and relaxed", strength: 0.45 },
  { id: "bicep_curl_top", anchor: "front", prompt: "standing tall, forearms curled up, hands at shoulder level, biceps fully flexed and peaked, elbows at sides", strength: 0.50 },
  { id: "hammer_curl_start", anchor: "front", prompt: "standing tall upright, BOTH arms hanging straight DOWN at sides completely relaxed, EMPTY HANDS with palms facing inward toward thighs, NO weights NO dumbbells NO kettlebells NO equipment, just empty relaxed hands hanging at thigh level, neutral grip position", strength: 0.45 },
  { id: "hammer_curl_top", anchor: "front", prompt: "standing tall, forearms curled up with thumbs pointing up, neutral grip maintained, brachialis and biceps engaged", strength: 0.50 },

  // ==========================================
  // TRICEPS (4 variations)
  // ==========================================
  { id: "tricep_pushdown_start", anchor: "front", prompt: "standing upright, BOTH elbows bent at 90 degree angle and pinned tight against sides of torso, forearms pointing FORWARD parallel to ground, empty hands positioned at chest/belly button height in front of body, upper arms vertical against ribs, ready to push down", strength: 0.50 },
  { id: "tricep_pushdown_contracted", anchor: "front", prompt: "standing upright, arms extended straight down at sides, elbows locked out, triceps squeezed tight", strength: 0.50 },
  { id: "skull_crusher_start", anchor: "lying", prompt: "lying supine, arms extended straight up perpendicular to body, hands together above chest, triceps engaged", strength: 0.55 },
  { id: "skull_crusher_extended", anchor: "lying", prompt: "lying supine, upper arms vertical, forearms hinged back toward forehead, elbows fixed in place, triceps stretched", strength: 0.55 },

  // ==========================================
  // LEGS (10 variations)
  // ==========================================
  { id: "squat_top", anchor: "side", prompt: "standing upright, legs straight, torso vertical, hands positioned at upper back level, tall posture", strength: 0.50 },
  { id: "squat_bottom", anchor: "side", prompt: "deep squat position, thighs below parallel to ground, knees tracking over toes, torso upright, glutes low", strength: 0.60 },
  { id: "lunge_standing", anchor: "quarter", prompt: "standing upright, feet together, arms at sides, tall posture, ready to step forward into lunge", strength: 0.50 },
  { id: "lunge_down", anchor: "quarter", prompt: "forward lunge position, front knee bent 90 degrees over ankle, back knee low near ground, torso upright", strength: 0.60 },
  { id: "rdl_top", anchor: "side", prompt: "standing tall, legs straight, arms hanging straight down in front, shoulders back, proud posture", strength: 0.50 },
  { id: "rdl_stretched", anchor: "bent", prompt: "hip hinged forward, slight knee bend, torso tilted toward ground, arms hanging down, hamstrings stretched long", strength: 0.55 },
  { id: "leg_extension_bent", anchor: "seated", prompt: "seated upright, knees bent 90 degrees, feet back under seat, quadriceps relaxed", strength: 0.55 },
  { id: "leg_extension_extended", anchor: "seated", prompt: "seated upright on seat, BOTH legs kicked out and FULLY EXTENDED STRAIGHT in front of body parallel to ground, knees completely straight and locked, toes pointing up, quadriceps flexed hard, legs making 90 degree angle with torso", strength: 0.55 },
  { id: "calf_raise_down", anchor: "side", prompt: "standing with heels dropped below toe level, calves stretched deep, ankles in dorsiflexion", strength: 0.50 },
  { id: "calf_raise_up", anchor: "side", prompt: "standing high on tiptoes, heels raised to maximum height, calves fully contracted, ankles in plantarflexion", strength: 0.50 },

  // ==========================================
  // CORE (6 variations)
  // ==========================================
  { id: "plank_hold", anchor: "side", prompt: "prone plank on forearms, body straight as board from head to heels, core braced tight, holding static position", strength: 0.55 },
  { id: "crunch_down", anchor: "lying", prompt: "lying supine, knees bent, feet flat, hands behind head, shoulders resting on ground, abs relaxed", strength: 0.50 },
  { id: "crunch_up", anchor: "lying", prompt: "lying on back with knees bent feet flat, SHOULDERS AND UPPER BACK LIFTED OFF THE GROUND curling up toward knees, hands behind head, chin tucked toward chest, abdominal muscles visibly contracted and crunched, upper body raised in crunch position NOT flat on ground", strength: 0.55 },
  { id: "hanging_leg_raise_start", anchor: "hanging", prompt: "body vertical with BOTH arms stretched straight up overhead reaching to sky, legs hanging straight down relaxed below body, no bar no equipment, just figure suspended with arms up and legs down, core ready to engage", strength: 0.50 },
  { id: "hanging_leg_raise_up", anchor: "hanging", prompt: "body with BOTH arms stretched up overhead, BOTH legs raised up FORWARD in front of body to 90 degrees creating L-shape or L-sit position, legs together pointing forward NOT split to sides, abs contracted hard, no bar no equipment", strength: 0.60 },
  { id: "side_plank", anchor: "side", prompt: "side plank on one forearm, body sideways in straight line, hips raised high, top arm on hip, obliques engaged", strength: 0.60 },

  // ==========================================
  // POSES (6 variations)
  // ==========================================
  { id: "front_double_bicep", anchor: "front", prompt: "front double bicep bodybuilding pose, arms raised to sides with elbows bent, biceps flexed and peaked, fists clenched", strength: 0.55 },
  { id: "front_lat_spread", anchor: "front", prompt: "front lat spread pose, hands on hips, elbows flared wide, lats spread showing V-taper from front", strength: 0.50 },
  { id: "rear_lat_spread", anchor: "back", prompt: "rear view, hands on hips, lats flared wide to sides, V-taper visible from behind, back muscles spread", strength: 0.50 },
  { id: "rear_double_bicep", anchor: "back", prompt: "rear view, arms raised with elbows bent and biceps flexed, back muscles visible, lat width displayed", strength: 0.55 },
  { id: "side_chest", anchor: "side", prompt: "side chest bodybuilding pose, near arm across body gripping far wrist, chest flexed, pec thickness displayed", strength: 0.55 },
  { id: "most_muscular", anchor: "front", prompt: "most muscular crab pose, torso hunched forward, arms pulled in tensed, all muscles flexed hard, intense pose", strength: 0.60 },
];

const IMAGES_PER_VARIATION = 1;
const ANCHORS_DIR = path.join(__dirname, "../output/anchors-selected");
const OUTPUT_DIR = path.join(__dirname, "../output/variations-2");

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

async function editImage(imageUrl, prompt) {
  // Using fal.ai nano-banana edit endpoint
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

// ============================================
// MAIN GENERATION
// ============================================
async function generateVariations() {
  const totalImages = VARIATIONS.length * IMAGES_PER_VARIATION;

  // Count variations by anchor
  const anchorCounts = {};
  ANCHORS.forEach((a) => (anchorCounts[a] = 0));
  VARIATIONS.forEach((v) => anchorCounts[v.anchor]++);

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PHASE 2: VARIATION GENERATION                       ║
╠═══════════════════════════════════════════════════════════════╣
║  ${VARIATIONS.length} variations × ${IMAGES_PER_VARIATION} image each = ${totalImages} total images              ║
║  Using anchor images as reference for consistency             ║
╠═══════════════════════════════════════════════════════════════╣
║  ANCHORS USED:                                                ║`);

  ANCHORS.forEach((anchor) => {
    console.log(`║    ${anchor.padEnd(10)} : ${String(anchorCounts[anchor]).padStart(3)} variations                              ║`);
  });

  console.log(`╚═══════════════════════════════════════════════════════════════╝
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
    console.log(`│  "${variation.prompt.substring(0, 60)}..."`);

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
        const url = await editImage(anchorDataUrl, fullPrompt);
        await downloadImage(url, filepath);
        console.log(` ✅`);
        totalGenerated++;
      } catch (error) {
        console.log(` ❌ ${error.message}`);
        console.error("Error details:", error.body || error);
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
