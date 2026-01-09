import 'dotenv/config';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { researchExercise, generateScript, planShots, planAnimationFrames } from "./utils/ai-client.js";
import { mapExerciseToAnchor, getAllAnchors } from "./utils/anchor-mapper.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  anchorsDir: path.join(__dirname, "../output/anchors-selected"),
  outputDir: path.join(__dirname, "../output/video-scripts"),
  character: null, // Loaded dynamically
};

// ============================================
// HELPER FUNCTIONS
// ============================================
async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function loadCharacter() {
  const charPath = path.join(__dirname, "../config/character.json");
  const data = await fs.readFile(charPath, "utf-8");
  return JSON.parse(data);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

// ============================================
// STEP 1: RESEARCH EXERCISE
// ============================================
async function stepResearchExercise(exerciseName, exerciseDir) {
  console.log(`\n┌─ Step 1: Research Exercise`);
  console.log(`│  Exercise: ${exerciseName}`);

  const researchPath = path.join(exerciseDir, "research.json");

  // Skip if exists
  try {
    await fs.access(researchPath);
    console.log(`│  ⏭️  research.json exists, loading`);
    const data = await fs.readFile(researchPath, "utf-8");
    console.log(`└─ Loaded existing research\n`);
    return JSON.parse(data);
  } catch {}

  console.log(`│  🔄 Researching via Claude AI...`);

  try {
    const research = await researchExercise(exerciseName);
    await fs.writeFile(researchPath, JSON.stringify(research, null, 2));
    console.log(`│  ✅ Research complete`);
    console.log(`│     Primary muscles: ${research.muscles.primary.join(", ")}`);
    console.log(`│     Secondary muscles: ${research.muscles.secondary.join(", ")}`);
    console.log(`└─ Saved to research.json\n`);
    return research;
  } catch (error) {
    console.log(`│  ❌ Error: ${error.message}`);
    console.log(`└─ Failed\n`);
    throw error;
  }
}

// ============================================
// STEP 2: GENERATE TTS SCRIPT
// ============================================
async function stepGenerateScript(exerciseData, exerciseDir) {
  console.log(`\n┌─ Step 2: Generate TTS Script`);

  const scriptPath = path.join(exerciseDir, "script.json");
  const ttsPath = path.join(exerciseDir, "tts-script.txt");

  // Skip if exists
  try {
    await fs.access(scriptPath);
    console.log(`│  ⏭️  script.json exists, loading`);
    const data = await fs.readFile(scriptPath, "utf-8");
    console.log(`└─ Loaded existing script\n`);
    return JSON.parse(data);
  } catch {}

  console.log(`│  🔄 Generating script via Claude AI...`);

  try {
    const scriptData = await generateScript(exerciseData);

    // Build full script.json
    const fullScript = {
      exercise: slugify(exerciseData.exercise_name),
      exercise_display_name: exerciseData.display_name,
      created_at: new Date().toISOString(),
      muscles: exerciseData.muscles,
      tts_script_file: "tts-script.txt",
      tts_full_text: scriptData.tts_full_text,
      total_shots: 0, // Updated later
      segments: scriptData.segments,
    };

    await fs.writeFile(scriptPath, JSON.stringify(fullScript, null, 2));
    await fs.writeFile(ttsPath, scriptData.tts_full_text);

    console.log(`│  ✅ Script generated`);
    console.log(`│     Segments: ${scriptData.segments.length}`);
    console.log(`│     Word count: ${scriptData.tts_full_text.split(/\s+/).length}`);
    console.log(`└─ Saved to script.json and tts-script.txt\n`);

    return fullScript;
  } catch (error) {
    console.log(`│  ❌ Error: ${error.message}`);
    console.log(`└─ Failed\n`);
    throw error;
  }
}

// ============================================
// STEP 3: PLAN SHOTS
// ============================================
async function stepPlanShots(exerciseData, scriptData, exerciseDir) {
  console.log(`\n┌─ Step 3: Plan Shots`);

  const shotsDir = path.join(exerciseDir, "shots");
  await ensureDir(shotsDir);

  console.log(`│  🔄 Planning shots via Claude AI...`);

  try {
    const anchors = await getAllAnchors();
    const shotPlan = await planShots(exerciseData, scriptData, anchors);

    console.log(`│  ✅ Shot plan created`);
    console.log(`│     Total shots: ${shotPlan.shots.length}`);

    // Identify animation sequences
    const sequences = [];
    for (const segment of scriptData.segments) {
      if (segment.is_animation_sequence) {
        sequences.push({
          name: segment.sequence_name,
          segment_index: scriptData.segments.indexOf(segment),
        });
      }
    }

    if (sequences.length > 0) {
      console.log(`│  🎬 Animation sequences found: ${sequences.length}`);
    }

    console.log(`└─ Proceeding to create shot folders\n`);

    return { shots: shotPlan.shots, sequences };
  } catch (error) {
    console.log(`│  ❌ Error: ${error.message}`);
    console.log(`└─ Failed\n`);
    throw error;
  }
}

// ============================================
// STEP 4: CREATE SHOT FOLDERS & PROMPTS
// ============================================
async function stepCreateShotPrompts(shots, sequences, exerciseData, scriptData, exerciseDir, character) {
  console.log(`\n┌─ Step 4: Create Shot Prompts`);

  const shotsDir = path.join(exerciseDir, "shots");
  let created = 0;
  let skipped = 0;

  for (const shot of shots) {
    const shotDir = path.join(shotsDir, shot.shot_id);
    await ensureDir(shotDir);

    const promptPath = path.join(shotDir, "prompt.json");

    // Skip if exists
    try {
      await fs.access(promptPath);
      console.log(`│  ⏭️  ${shot.shot_id}/prompt.json exists`);
      skipped++;
      continue;
    } catch {}

    // Build engineered prompt
    const highlightedMuscles = shot.highlighted_muscles || [];
    const muscleHighlightText = highlightedMuscles.length > 0
      ? `, ${highlightedMuscles.join(" and ")} muscles highlighted in bright red glowing overlay`
      : "";

    const engineeredPrompt = `${character.base_prompt}, ${shot.visual_description}${muscleHighlightText}`;

    const promptJson = {
      shot_id: shot.shot_id,
      shot_name: shot.shot_name,
      anchor_image: `output/anchors-selected/${shot.anchor_image}`,
      visual_description: shot.visual_description,
      highlighted_muscles: highlightedMuscles,
      engineered_prompt: engineeredPrompt,
      is_sequence_frame: shot.is_sequence_frame || false,
      sequence_name: shot.sequence_name || null,
      sequence_order: shot.sequence_order || null,
      sequence_total: shot.sequence_total || null,
      iteration: 1,
      max_iterations: 2,
      prompt_history: [],
    };

    await fs.writeFile(promptPath, JSON.stringify(promptJson, null, 2));
    console.log(`│  ✅ ${shot.shot_id}/prompt.json created`);
    created++;
  }

  // Handle animation sequences
  for (const seq of sequences) {
    console.log(`│  🎬 Planning animation: ${seq.name}`);

    // Find shots for this sequence
    const seqShots = shots.filter(s => s.sequence_name === seq.name);
    if (seqShots.length === 0) {
      // Need to generate animation frames
      const segment = scriptData.segments[seq.segment_index];
      const anchor = await mapExerciseToAnchor(exerciseData.exercise_name);

      console.log(`│     Generating ${seq.name} frames...`);

      try {
        const frames = await planAnimationFrames(seq.name, segment.tts_segment, anchor);

        for (let i = 0; i < frames.frames.length; i++) {
          const frame = frames.frames[i];
          const frameId = `${String(shots.length + i + 1).padStart(2, "0")}-${seq.name}-frame-${frame.frame_order}`;
          const frameDir = path.join(shotsDir, frameId);
          await ensureDir(frameDir);

          const framePrompt = {
            shot_id: frameId,
            shot_name: `${seq.name} Frame ${frame.frame_order}`,
            anchor_image: `output/anchors-selected/${frames.anchor}.png`,
            visual_description: frame.position_description,
            highlighted_muscles: [],
            engineered_prompt: `${character.base_prompt}, ${frame.position_description}, ${frame.body_changes}`,
            is_sequence_frame: true,
            sequence_name: seq.name,
            sequence_order: frame.frame_order,
            sequence_total: frames.total_frames,
            iteration: 1,
            max_iterations: 2,
            prompt_history: [],
          };

          await fs.writeFile(path.join(frameDir, "prompt.json"), JSON.stringify(framePrompt, null, 2));
          console.log(`│     ✅ ${frameId}/prompt.json created`);
          created++;
        }
      } catch (error) {
        console.log(`│     ❌ Animation planning failed: ${error.message}`);
      }
    }
  }

  console.log(`│  Created: ${created} prompts`);
  console.log(`│  Skipped: ${skipped} prompts`);
  console.log(`└─ Shot prompts complete\n`);

  return created + skipped;
}

// ============================================
// STEP 5: UPDATE SCRIPT WITH SHOT COUNT
// ============================================
async function stepFinalizeScript(exerciseDir, totalShots) {
  console.log(`\n┌─ Step 5: Finalize Script`);

  const scriptPath = path.join(exerciseDir, "script.json");
  const data = await fs.readFile(scriptPath, "utf-8");
  const script = JSON.parse(data);

  script.total_shots = totalShots;

  await fs.writeFile(scriptPath, JSON.stringify(script, null, 2));

  console.log(`│  ✅ Updated total_shots: ${totalShots}`);
  console.log(`└─ Script finalized\n`);
}

// ============================================
// EXPORTABLE FUNCTION FOR PIPELINE
// ============================================
async function generateVideoScript(exerciseName) {
  // Validate environment
  if (!process.env.ANTHROPIC_API_KEY) {
    return { success: false, error: "ANTHROPIC_API_KEY not found in .env file" };
  }

  // Validate anchors directory
  try {
    await fs.access(CONFIG.anchorsDir);
  } catch {
    return { success: false, error: `Anchors directory not found: ${CONFIG.anchorsDir}` };
  }

  // Load character
  CONFIG.character = await loadCharacter();

  // Create exercise directory
  const exerciseSlug = slugify(exerciseName);
  const exerciseDir = path.join(CONFIG.outputDir, exerciseSlug);
  await ensureDir(exerciseDir);

  console.log(`📁 Output directory: ${exerciseDir}\n`);

  try {
    // Step 1: Research
    const exerciseData = await stepResearchExercise(exerciseName, exerciseDir);

    // Step 2: Generate Script
    const scriptData = await stepGenerateScript(exerciseData, exerciseDir);

    // Step 3: Plan Shots
    const { shots, sequences } = await stepPlanShots(exerciseData, scriptData, exerciseDir);

    // Step 4: Create Shot Prompts
    const totalShots = await stepCreateShotPrompts(
      shots,
      sequences,
      exerciseData,
      scriptData,
      exerciseDir,
      CONFIG.character
    );

    // Step 5: Finalize
    await stepFinalizeScript(exerciseDir, totalShots);

    return {
      success: true,
      exerciseDir,
      exerciseSlug,
      totalShots,
    };
  } catch (error) {
    return {
      success: false,
      exerciseDir,
      error: error.message,
    };
  }
}

// ============================================
// MAIN (CLI entry point)
// ============================================
async function main() {
  const exerciseName = process.argv[2];

  if (!exerciseName) {
    console.error("Usage: node phase4-script-generator.js <exercise-name>");
    console.error("Example: node phase4-script-generator.js bent-over-barbell-row");
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ███████╗ ██████╗██████╗ ██╗██████╗ ████████╗                ║
║   ██╔════╝██╔════╝██╔══██╗██║██╔══██╗╚══██╔══╝                ║
║   ███████╗██║     ██████╔╝██║██████╔╝   ██║                   ║
║   ╚════██║██║     ██╔══██╗██║██╔═══╝    ██║                   ║
║   ███████║╚██████╗██║  ██║██║██║        ██║                   ║
║   ╚══════╝ ╚═════╝╚═╝  ╚═╝╚═╝╚═╝        ╚═╝                   ║
║                                                               ║
║   PHASE 4: VIDEO SCRIPT GENERATOR                             ║
║   Generate complete video content packages                    ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseName.padEnd(45)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  const result = await generateVideoScript(exerciseName);

  if (!result.success) {
    console.error(`\n❌ Script generation failed: ${result.error}`);
    process.exit(1);
  }

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎉 SCRIPT GENERATION COMPLETE                                ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${result.exerciseSlug.padEnd(45)}║
║  Total shots: ${String(result.totalShots).padEnd(42)}║
║  Output: output/video-scripts/${result.exerciseSlug.substring(0, 25).padEnd(25)}║
╠═══════════════════════════════════════════════════════════════╣
║  NEXT STEPS:                                                  ║
║  1. Review script.json and tts-script.txt                     ║
║  2. Run phase5 to generate images from prompts                ║
║  3. Run phase6 for validation and quality checks              ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

// Run main only if this is the entry point
const isMainModule = process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/^.*[\\/]/, ''));
if (isMainModule) {
  main();
}

// Export for pipeline usage
export { generateVideoScript };
