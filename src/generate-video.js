import 'dotenv/config';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { generateVideoScript } from "./phase4-script-generator.js";
import { generateImagesForExercise } from "./phase5-batch-image-gen.js";
import { validateExercise } from "./phase6-validation.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
  anchorsDir: path.join(__dirname, "../output/anchors-selected"),
  outputDir: path.join(__dirname, "../output/video-scripts"),
};

// ============================================
// HELPER FUNCTIONS
// ============================================
function parseArgs(args) {
  const options = {
    exerciseName: null,
    skipRegen: false,
    force: false,
    verbose: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === "--skip-regen") {
      options.skipRegen = true;
    } else if (arg === "--force") {
      options.force = true;
    } else if (arg === "--verbose") {
      options.verbose = true;
    } else if (arg === "--help" || arg === "-h") {
      options.help = true;
    } else if (!arg.startsWith("--")) {
      options.exerciseName = arg;
    }
  }

  return options;
}

function showUsage() {
  console.log(`
Usage: node generate-video.js <exercise-name> [options]

Options:
  --skip-regen    Skip auto-regeneration during validation (validate only)
  --force         Clear existing outputs and regenerate everything
  --verbose       Show detailed progress information
  --help, -h      Show this help message

Examples:
  node generate-video.js bent-over-barbell-row
  node generate-video.js deadlift --skip-regen
  node generate-video.js squat --force
  npm run generate-video bent-over-barbell-row
`);
}

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  const seconds = (ms / 1000).toFixed(1);
  if (ms < 60000) return `${seconds}s`;
  const minutes = Math.floor(ms / 60000);
  const secs = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${secs}s`;
}

// ============================================
// ENVIRONMENT VALIDATION
// ============================================
async function validateEnvironment() {
  const errors = [];

  // Check API keys
  if (!process.env.ANTHROPIC_API_KEY) {
    errors.push("ANTHROPIC_API_KEY not found in .env file");
  }

  if (!process.env.FAL_KEY) {
    errors.push("FAL_KEY not found in .env file");
  }

  // Check anchors directory
  try {
    await fs.access(CONFIG.anchorsDir);
    const files = await fs.readdir(CONFIG.anchorsDir);
    const pngFiles = files.filter(f => f.endsWith(".png"));
    if (pngFiles.length === 0) {
      errors.push(`No anchor images found in ${CONFIG.anchorsDir}`);
    }
  } catch {
    errors.push(`Anchors directory not found: ${CONFIG.anchorsDir}`);
    errors.push("Run phase 1 and 2 first to generate anchor images.");
  }

  return errors;
}

// ============================================
// PIPELINE ORCHESTRATION
// ============================================
async function runPipeline(exerciseName, options) {
  const results = {
    phase4: null,
    phase5: null,
    phase6: null,
  };
  const startTime = Date.now();
  const exerciseSlug = slugify(exerciseName);
  const exerciseDir = path.join(CONFIG.outputDir, exerciseSlug);

  // Handle --force flag: clear existing outputs
  if (options.force) {
    try {
      await fs.access(exerciseDir);
      console.log(`\n🗑️  Clearing existing outputs (--force)`);
      await fs.rm(exerciseDir, { recursive: true });
    } catch {
      // Directory doesn't exist, nothing to clear
    }
  }

  // ========================================
  // PHASE 4: Script Generation
  // ========================================
  console.log(`
┌───────────────────────────────────────────────────────────────┐
│  📝 PHASE 4: Script Generation                                │
└───────────────────────────────────────────────────────────────┘`);

  const phase4Start = Date.now();
  results.phase4 = await generateVideoScript(exerciseName);
  const phase4Duration = Date.now() - phase4Start;

  if (!results.phase4.success) {
    throw new Error(`Phase 4 failed: ${results.phase4.error}`);
  }

  console.log(`\n✅ Phase 4 complete (${formatDuration(phase4Duration)})`);
  console.log(`   Total shots: ${results.phase4.totalShots}`);

  // ========================================
  // PHASE 5: Image Generation
  // ========================================
  console.log(`
┌───────────────────────────────────────────────────────────────┐
│  🎨 PHASE 5: Image Generation                                 │
└───────────────────────────────────────────────────────────────┘`);

  const phase5Start = Date.now();
  try {
    results.phase5 = await generateImagesForExercise(exerciseName);
  } catch (error) {
    results.phase5 = {
      totalGenerated: 0,
      totalSkipped: 0,
      totalErrors: 1,
      total: 0,
      error: error.message,
    };
    throw new Error(`Phase 5 failed: ${error.message}`);
  }
  const phase5Duration = Date.now() - phase5Start;

  console.log(`\n✅ Phase 5 complete (${formatDuration(phase5Duration)})`);
  console.log(`   Generated: ${results.phase5.totalGenerated}, Skipped: ${results.phase5.totalSkipped}, Errors: ${results.phase5.totalErrors}`);

  // ========================================
  // PHASE 6: Validation
  // ========================================
  console.log(`
┌───────────────────────────────────────────────────────────────┐
│  ✅ PHASE 6: Validation & Quality Check                       │
└───────────────────────────────────────────────────────────────┘`);

  const phase6Start = Date.now();
  try {
    const { results: validationResults, summary } = await validateExercise(exerciseName, options.skipRegen);
    results.phase6 = {
      approved: validationResults.approved.length,
      flagged: validationResults.flagged.length,
      rejected: validationResults.rejected.length,
      noImage: validationResults.no_image.length,
      errors: validationResults.errors.length,
      summary,
    };
  } catch (error) {
    results.phase6 = {
      approved: 0,
      flagged: 0,
      rejected: 0,
      noImage: 0,
      errors: 1,
      error: error.message,
    };
    throw new Error(`Phase 6 failed: ${error.message}`);
  }
  const phase6Duration = Date.now() - phase6Start;

  console.log(`\n✅ Phase 6 complete (${formatDuration(phase6Duration)})`);
  console.log(`   Approved: ${results.phase6.approved}, Flagged: ${results.phase6.flagged}, Errors: ${results.phase6.errors}`);

  return {
    results,
    duration: Date.now() - startTime,
    exerciseDir,
    exerciseSlug,
  };
}

// ============================================
// REPORT GENERATION
// ============================================
async function generateReport(exerciseName, pipelineResult, options) {
  const { results, duration, exerciseDir, exerciseSlug } = pipelineResult;

  const readyForAssembly =
    results.phase6.flagged === 0 &&
    results.phase6.errors === 0 &&
    results.phase6.noImage === 0;

  const report = {
    exercise: exerciseSlug,
    exercise_display_name: exerciseName,
    generated_at: new Date().toISOString(),
    duration_ms: duration,
    duration_formatted: formatDuration(duration),
    phases: {
      script_generation: {
        success: results.phase4.success,
        total_shots: results.phase4.totalShots,
      },
      image_generation: {
        generated: results.phase5.totalGenerated,
        skipped: results.phase5.totalSkipped,
        errors: results.phase5.totalErrors,
      },
      validation: {
        approved: results.phase6.approved,
        flagged: results.phase6.flagged,
        rejected: results.phase6.rejected,
        no_image: results.phase6.noImage,
        errors: results.phase6.errors,
      },
    },
    ready_for_assembly: readyForAssembly,
    flags_used: [
      options.skipRegen && "--skip-regen",
      options.force && "--force",
      options.verbose && "--verbose",
    ].filter(Boolean),
    next_steps: readyForAssembly
      ? ["Assemble video from generated assets"]
      : [
          results.phase6.flagged > 0 && "Review flagged shots in validation.json files",
          results.phase6.errors > 0 && "Check error logs and retry failed shots",
          "Re-run validation after fixes: npm run phase6 " + exerciseSlug,
        ].filter(Boolean),
  };

  const reportPath = path.join(exerciseDir, "generation-report.json");
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));

  return { report, reportPath };
}

// ============================================
// FINAL SUMMARY
// ============================================
function printSummary(exerciseName, pipelineResult, report) {
  const { results, duration, exerciseDir, exerciseSlug } = pipelineResult;

  const statusEmoji = report.ready_for_assembly ? "✅" : "⚠️ ";
  const statusText = report.ready_for_assembly ? "Ready for assembly" : "Needs review";

  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  🎉 VIDEO CONTENT GENERATION COMPLETE                         ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${exerciseSlug.padEnd(45)}║
║  Duration: ${formatDuration(duration).padEnd(45)}║
╠═══════════════════════════════════════════════════════════════╣
║  RESULTS:                                                     ║
║  • Script: ${String(results.phase4.totalShots).padEnd(3)} shots planned                                  ║
║  • Images: ${String(results.phase5.totalGenerated).padEnd(3)} generated, ${String(results.phase5.totalSkipped).padEnd(3)} skipped, ${String(results.phase5.totalErrors).padEnd(3)} errors       ║
║  • Validation: ${String(results.phase6.approved).padEnd(3)} approved, ${String(results.phase6.flagged).padEnd(3)} flagged, ${String(results.phase6.errors).padEnd(3)} errors    ║
╠═══════════════════════════════════════════════════════════════╣
║  STATUS: ${statusEmoji} ${statusText.padEnd(43)}║
╠═══════════════════════════════════════════════════════════════╣
║  OUTPUTS:                                                     ║
║  • ${("output/video-scripts/" + exerciseSlug + "/").padEnd(55)}║
║  • generation-report.json                                     ║
╚═══════════════════════════════════════════════════════════════╝
`);
}

// ============================================
// MAIN
// ============================================
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);

  // Show help
  if (options.help || (!options.exerciseName && args.length === 0)) {
    showUsage();
    process.exit(options.help ? 0 : 1);
  }

  if (!options.exerciseName) {
    console.error("❌ Exercise name required");
    showUsage();
    process.exit(1);
  }

  // ASCII Header
  console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   ██╗   ██╗██╗██████╗ ███████╗ ██████╗                        ║
║   ██║   ██║██║██╔══██╗██╔════╝██╔═══██╗                       ║
║   ██║   ██║██║██║  ██║█████╗  ██║   ██║                       ║
║   ╚██╗ ██╔╝██║██║  ██║██╔══╝  ██║   ██║                       ║
║    ╚████╔╝ ██║██████╔╝███████╗╚██████╔╝                       ║
║     ╚═══╝  ╚═╝╚═════╝ ╚══════╝ ╚═════╝                        ║
║                                                               ║
║   VIDEO CONTENT GENERATOR                                     ║
║   Complete Pipeline: Script → Images → Validation             ║
║                                                               ║
╠═══════════════════════════════════════════════════════════════╣
║  Exercise: ${options.exerciseName.padEnd(45)}║
║  Flags: ${([
    options.skipRegen && "--skip-regen",
    options.force && "--force",
    options.verbose && "--verbose",
  ].filter(Boolean).join(" ") || "(none)").padEnd(49)}║
╚═══════════════════════════════════════════════════════════════╝
`);

  // Validate environment
  const envErrors = await validateEnvironment();
  if (envErrors.length > 0) {
    console.error("\n❌ Environment validation failed:");
    for (const error of envErrors) {
      console.error(`   • ${error}`);
    }
    process.exit(1);
  }

  console.log("✅ Environment validated\n");

  // Run pipeline
  try {
    const pipelineResult = await runPipeline(options.exerciseName, options);

    // Generate report
    const { report } = await generateReport(options.exerciseName, pipelineResult, options);

    // Print summary
    printSummary(options.exerciseName, pipelineResult, report);

    // Exit with appropriate code
    if (!report.ready_for_assembly) {
      process.exit(1);
    }
  } catch (error) {
    console.error(`\n❌ Pipeline failed: ${error.message}`);
    console.error("\nSuggestions:");
    console.error("  • Check the error logs above for details");
    console.error("  • Verify API keys are valid");
    console.error("  • Try running individual phases to isolate the issue:");
    console.error(`    npm run phase4 ${options.exerciseName}`);
    console.error(`    npm run phase5 ${options.exerciseName}`);
    console.error(`    npm run phase6 ${options.exerciseName}`);
    process.exit(1);
  }
}

main();
