import 'dotenv/config';
import { fal } from "@fal-ai/client";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ANCHORS_DIR = path.join(__dirname, "../output/anchors-selected");
const OUTPUT_DIR = path.join(__dirname, "../output/variations-final");

// Character definition
const CHARACTER = {
  base_prompt:
    "orange anatomical mannequin figure with wireframe mesh topology lines, humanoid art reference model, matte orange skin with black grid lines, simple black dot eyes, wearing dark green shorts, grey sneakers, neutral studio background",
};

// REJECTED IMAGES - Re-engineered prompts with optimal anchors
const REJECTED_VARIATIONS = [
  // 1. PULLUP_HANG - Was blank. Use "front" anchor, very explicit vertical stretch
  {
    id: "pullup_hang",
    anchor: "front",
    prompt: "standing figure reaching BOTH arms straight up to the sky as high as possible, arms fully extended vertically overhead with hands open, body stretched tall and elongated, like hanging from an invisible bar, feet together on ground, maximum vertical arm extension, empty hands reaching upward"
  },

  // 2. PULLUP_TOP - Was blank. Use "front" anchor, pulled up position
  {
    id: "pullup_top",
    anchor: "front",
    prompt: "standing figure with BOTH arms raised and bent at elbows, hands at head level beside ears, elbows pointing outward to sides, like at the top of a pull-up with chin over bar, shoulders down and back engaged, compact upper body position, empty hands in fist grip"
  },

  // 3. BARBELL_ROW_DOWN - Had dumbbells. Use "bent" anchor, EXTREME no equipment emphasis
  {
    id: "barbell_row_down",
    anchor: "bent",
    prompt: "figure bent forward at waist with flat back parallel to floor, BOTH arms dangling straight DOWN toward ground completely relaxed, fingers pointing to floor, ABSOLUTELY NO OBJECTS IN HANDS no weights no dumbbells no barbells no kettlebells just EMPTY OPEN HANDS hanging loosely, head looking down"
  },

  // 4. BARBELL_ROW_UP - Hands on hips. Use "bent" anchor, clear rowing position
  {
    id: "barbell_row_up",
    anchor: "bent",
    prompt: "figure bent forward at waist with flat back, BOTH arms pulled UP and BACK with elbows bent pointing toward ceiling behind body, hands pulled up near lower ribcage/belly, shoulder blades squeezed together, rowing motion at top position, EMPTY HANDS no equipment, elbows raised high past torso"
  },

  // 5. SHOULDER_PRESS_TOP - Blue ball. Use "front" anchor, prevent object hallucination
  {
    id: "shoulder_press_top",
    anchor: "front",
    prompt: "standing figure with BOTH arms pressed straight UP overhead, arms fully extended vertically with hands directly above shoulders, palms facing forward with fingers spread open, NO OBJECTS no balls no weights just EMPTY OPEN HANDS above head, shoulders pressed down, triumphant overhead reach pose"
  },

  // 6. TRICEP_PUSHDOWN_CONTRACTED - Showed bicep flex. Use "front" anchor, arms DOWN
  {
    id: "tricep_pushdown_contracted",
    anchor: "front",
    prompt: "standing upright with BOTH arms pointing STRAIGHT DOWN at sides, arms completely vertical and locked out at elbows, hands at thigh level with palms facing thighs, triceps squeezed and flexed, NOT a bicep pose arms are DOWN not up, relaxed shoulders, military attention stance with arms at sides"
  },

  // 7. LUNGE_STANDING - Running motion. Use "front" anchor for stable standing
  {
    id: "lunge_standing",
    anchor: "front",
    prompt: "standing completely STILL and STATIONARY, feet together side by side, legs straight, arms relaxed at sides, tall upright posture, NOT walking NOT running NOT stepping, completely static neutral standing pose like standing at attention, weight evenly distributed on both feet"
  },

  // 8. LEG_EXTENSION_BENT - Standing not seated. Use "seated" anchor, emphasize seated
  {
    id: "leg_extension_bent",
    anchor: "seated",
    prompt: "figure SITTING DOWN with buttocks on seat, torso upright vertical, BOTH knees bent at 90 degrees with feet tucked back under the seat, thighs horizontal, lower legs vertical pointing down, hands resting on thighs, clearly SEATED not standing, sitting on invisible chair or bench"
  },

  // 9. CRUNCH_UP - Shoulders not lifted. Use "lying" anchor, extreme emphasis on lifted
  {
    id: "crunch_up",
    anchor: "lying",
    prompt: "lying on back with knees bent feet flat, UPPER BACK AND SHOULDERS VISIBLY LIFTED OFF THE GROUND curling toward knees, head and shoulders raised up in crunch position, hands behind head, chin tucked, abdominal muscles contracted, clearly NOT flat on ground, upper body curled up at 30-45 degree angle from floor"
  },

  // 10. HANGING_LEG_RAISE_UP - Weird pose. Use "seated" anchor for L-sit look
  {
    id: "hanging_leg_raise_up",
    anchor: "seated",
    prompt: "figure in L-SIT position with torso upright vertical, BOTH legs extended STRAIGHT OUT horizontally in front of body parallel to ground, legs together side by side, creating 90 degree angle between torso and legs, arms at sides or slightly back for support, gymnastic L-sit hold position"
  }
];

// Convert file to data URL
async function fileToDataUrl(filePath) {
  const buffer = fs.readFileSync(filePath);
  const base64 = buffer.toString("base64");
  const ext = path.extname(filePath).slice(1);
  const mimeType = ext === "jpg" ? "image/jpeg" : `image/${ext}`;
  return `data:${mimeType};base64,${base64}`;
}

// Edit image using fal.ai
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
  throw new Error("No image returned");
}

// Download image
async function downloadImage(url, outputPath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  fs.writeFileSync(outputPath, Buffer.from(buffer));
}

// Main
async function main() {
  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log("║     REGENERATING 10 REJECTED IMAGES WITH BETTER PROMPTS       ║");
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Load anchors
  const anchorCache = {};

  let generated = 0;
  let errors = 0;

  for (const variation of REJECTED_VARIATIONS) {
    console.log(`\n┌─ ${variation.id}`);
    console.log(`│  Anchor: ${variation.anchor}`);
    console.log(`│  "${variation.prompt.substring(0, 60)}..."`);

    try {
      // Load anchor if not cached
      if (!anchorCache[variation.anchor]) {
        const anchorPath = path.join(ANCHORS_DIR, `${variation.anchor}.png`);
        if (!fs.existsSync(anchorPath)) {
          console.log(`│  ❌ Anchor not found: ${anchorPath}`);
          errors++;
          continue;
        }
        anchorCache[variation.anchor] = await fileToDataUrl(anchorPath);
        console.log(`│  📁 Loaded anchor: ${variation.anchor}`);
      }

      const anchorDataUrl = anchorCache[variation.anchor];
      const fullPrompt = `${CHARACTER.base_prompt}, ${variation.prompt}`;

      // Create output directory for this variation
      const varOutputDir = path.join(OUTPUT_DIR, variation.id);
      if (!fs.existsSync(varOutputDir)) {
        fs.mkdirSync(varOutputDir, { recursive: true });
      }

      const outputPath = path.join(varOutputDir, `${variation.id}_01.png`);

      process.stdout.write(`│  🔄 Generating ${variation.id}_01.png... `);
      const url = await editImage(anchorDataUrl, fullPrompt);
      await downloadImage(url, outputPath);
      console.log("✅");
      generated++;

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      errors++;
    }

    console.log(`└─ Done`);
  }

  console.log("\n╔═══════════════════════════════════════════════════════════════╗");
  console.log(`║  COMPLETE: Generated ${generated}, Errors ${errors}                          ║`);
  console.log("╚═══════════════════════════════════════════════════════════════╝\n");
}

main().catch(console.error);
