# Feature: Unified CLI Pipeline (generate-video.js)

The following plan should be complete, but it's important that you validate documentation and codebase patterns and task sanity before you start implementing.

Pay special attention to naming of existing utils, types and models. Import from the right files etc.

## Feature Description

Create a unified CLI script (`generate-video.js`) that orchestrates the complete video content generation pipeline. This script runs phases 4, 5, and 6 in sequence with a single command, providing progress reporting, error handling, and a final summary of results.

This is PRD Phase 4: "Polish & Integration" - the final MVP milestone.

## User Story

As a content creator
I want to run a single command to generate a complete video content package
So that I can produce fitness videos without manually running multiple phase scripts

## Problem Statement

Currently, generating a complete video package requires running three separate commands:
1. `npm run phase4 <exercise>` - Script generation
2. `npm run phase5 <exercise>` - Image generation
3. `npm run phase6 <exercise>` - Validation

This is error-prone, requires manual intervention between phases, and lacks a unified view of the pipeline status.

## Solution Statement

Create `src/generate-video.js` that:
1. Validates prerequisites (env vars, anchor images)
2. Runs Phase 4, 5, 6 sequentially with proper error handling
3. Provides unified progress reporting
4. Generates a final summary report
5. Supports CLI flags for customization (--skip-regen, --force, --verbose)

## Feature Metadata

**Feature Type**: New Capability (Pipeline Integration)
**Estimated Complexity**: Medium
**Primary Systems Affected**: CLI entry point, all phase scripts
**Dependencies**: phase4-script-generator.js, phase5-batch-image-gen.js, phase6-validation.js

---

## CONTEXT REFERENCES

### Relevant Codebase Files - MUST READ BEFORE IMPLEMENTING!

- `src/phase4-script-generator.js` (lines 294-391) - Main function structure, CLI argument parsing, ASCII header pattern
- `src/phase5-batch-image-gen.js` (lines 136-237) - generateImagesForExercise function, return structure with stats
- `src/phase6-validation.js` (lines 295-400) - validateExercise function, skipRegen flag handling, summary generation
- `package.json` (lines 6-14) - npm scripts pattern
- `CLAUDE.md` (full file) - Project conventions, logging patterns, skip-if-exists

### New Files to Create

- `src/generate-video.js` - Unified CLI that orchestrates phases 4, 5, 6

### Relevant Documentation

- PRD.md (lines 571-586) - Phase 4 requirements: single CLI command, progress reporting, summary output, documentation

### Patterns to Follow

**ES Module Imports (from phase4-script-generator.js:1-6):**
```javascript
import 'dotenv/config';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
```

**CONFIG Object Pattern (from phase4-script-generator.js:14-18):**
```javascript
const CONFIG = {
  anchorsDir: path.join(__dirname, "../output/anchors-selected"),
  outputDir: path.join(__dirname, "../output/video-scripts"),
  // ...
};
```

**ASCII Box Header Pattern (from phase4-script-generator.js:304-320):**
```javascript
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║   TITLE                                                       ║
╠═══════════════════════════════════════════════════════════════╣
║  Key: ${value.padEnd(45)}║
╚═══════════════════════════════════════════════════════════════╝
`);
```

**Environment Validation Pattern (from phase4-script-generator.js:323-335):**
```javascript
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("❌ ANTHROPIC_API_KEY not found in .env file");
  process.exit(1);
}
```

**Skip-if-exists Pattern (from phase4-script-generator.js:46-53):**
```javascript
try {
  await fs.access(filepath);
  console.log(`│  ⏭️  file exists, loading`);
  // load and return
} catch {}
// generate if not exists
```

---

## IMPLEMENTATION PLAN

### Phase 1: Foundation

Create the basic file structure with imports, CONFIG, and CLI argument parsing.

**Tasks:**
- Set up ES module structure with imports
- Define CONFIG object with paths
- Implement CLI argument parsing with flags
- Add environment validation

### Phase 2: Core Implementation

Refactor phase scripts to export their main functions, then import and call them sequentially.

**Tasks:**
- Refactor phase4 to export generateVideoScript function
- Refactor phase5 to export generateImagesForExercise function
- Refactor phase6 to export validateExercise function
- Implement runPipeline function that orchestrates all phases

### Phase 3: Integration

Add progress reporting, error handling, and summary generation.

**Tasks:**
- Implement unified progress logging
- Add inter-phase error handling
- Create generation-report.json output
- Add --force flag to bypass skip-if-exists

### Phase 4: Testing & Validation

Ensure the script works end-to-end with all flag combinations.

**Tasks:**
- Test basic usage with exercise name
- Test --skip-regen flag
- Test --force flag
- Test error scenarios (missing files, API failures)

---

## STEP-BY-STEP TASKS

IMPORTANT: Execute every task in order, top to bottom. Each task is atomic and independently testable.

### Task 1: UPDATE src/phase4-script-generator.js - Export main function

- **IMPLEMENT**: Refactor to export `generateVideoScript(exerciseName)` function that returns result object
- **PATTERN**: Keep existing main() for CLI, add new exported function
- **CHANGES**:
  1. Extract core logic from main() into `generateVideoScript(exerciseName)`
  2. Return `{ success: boolean, exerciseDir: string, totalShots: number, error?: string }`
  3. Export the function: `export { generateVideoScript }`
  4. Keep main() calling generateVideoScript for standalone usage
- **GOTCHA**: Don't break existing `npm run phase4` functionality
- **VALIDATE**: `node -e "import('./src/phase4-script-generator.js').then(m => console.log('generateVideoScript' in m ? '✅ Export found' : '❌ Missing'))"`

### Task 2: UPDATE src/phase5-batch-image-gen.js - Export main function

- **IMPLEMENT**: Refactor to export `generateImagesForExercise(exerciseName)` function
- **PATTERN**: Function already exists, just need to export it
- **CHANGES**:
  1. Add at end of file: `export { generateImagesForExercise };`
  2. Ensure function returns the stats object it already returns
- **GOTCHA**: Function is already defined at line 136, just needs export
- **VALIDATE**: `node -e "import('./src/phase5-batch-image-gen.js').then(m => console.log('generateImagesForExercise' in m ? '✅ Export found' : '❌ Missing'))"`

### Task 3: UPDATE src/phase6-validation.js - Export main function

- **IMPLEMENT**: Refactor to export `validateExercise(exerciseName, skipRegen)` function
- **PATTERN**: Function already exists, just need to export it
- **CHANGES**:
  1. Add at end of file: `export { validateExercise };`
  2. Ensure function returns `{ results, summary }` object
- **GOTCHA**: Function is already defined at line 206, just needs export
- **VALIDATE**: `node -e "import('./src/phase6-validation.js').then(m => console.log('validateExercise' in m ? '✅ Export found' : '❌ Missing'))"`

### Task 4: CREATE src/generate-video.js - Foundation

- **IMPLEMENT**: Create new file with imports, CONFIG, CLI parsing
- **PATTERN**: Mirror phase4-script-generator.js structure
- **IMPORTS**:
  ```javascript
  import 'dotenv/config';
  import fs from "fs/promises";
  import path from "path";
  import { fileURLToPath } from "url";
  import { generateVideoScript } from "./phase4-script-generator.js";
  import { generateImagesForExercise } from "./phase5-batch-image-gen.js";
  import { validateExercise } from "./phase6-validation.js";
  ```
- **CONFIG**:
  ```javascript
  const CONFIG = {
    anchorsDir: path.join(__dirname, "../output/anchors-selected"),
    outputDir: path.join(__dirname, "../output/video-scripts"),
  };
  ```
- **CLI ARGS**: Parse exercise name, --skip-regen, --force, --verbose flags
- **GOTCHA**: Use `process.argv.slice(2)` for args, filter flags with `startsWith("--")`
- **VALIDATE**: `node src/generate-video.js 2>&1 | head -5` (should show usage message)

### Task 5: UPDATE src/generate-video.js - Environment validation

- **IMPLEMENT**: Add pre-flight checks before running pipeline
- **PATTERN**: MIRROR phase4-script-generator.js:323-335
- **CHECKS**:
  1. ANTHROPIC_API_KEY exists
  2. FAL_KEY exists
  3. anchors-selected directory exists with files
  4. Exercise name provided (show usage if not)
- **VALIDATE**: `FAL_KEY= node src/generate-video.js test 2>&1 | grep "FAL_KEY"` (should show error)

### Task 6: UPDATE src/generate-video.js - ASCII header

- **IMPLEMENT**: Add unified pipeline header
- **PATTERN**: MIRROR phase4-script-generator.js:304-320
- **CONTENT**:
  ```
  ╔═══════════════════════════════════════════════════════════════╗
  ║   VIDEO CONTENT GENERATOR                                     ║
  ║   Complete Pipeline: Script → Images → Validation             ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║  Exercise: {exerciseName}                                     ║
  ║  Flags: {flags summary}                                       ║
  ╚═══════════════════════════════════════════════════════════════╝
  ```
- **VALIDATE**: `node src/generate-video.js test --skip-regen 2>&1 | grep "VIDEO CONTENT"`

### Task 7: UPDATE src/generate-video.js - Pipeline orchestration

- **IMPLEMENT**: Add runPipeline function that calls phases sequentially
- **PATTERN**: Sequential async/await with error handling
- **STRUCTURE**:
  ```javascript
  async function runPipeline(exerciseName, options) {
    const results = { phase4: null, phase5: null, phase6: null };
    const startTime = Date.now();

    // Phase 4: Script Generation
    console.log("\n📝 PHASE 4: Script Generation");
    results.phase4 = await generateVideoScript(exerciseName);
    if (!results.phase4.success) throw new Error(results.phase4.error);

    // Phase 5: Image Generation
    console.log("\n🎨 PHASE 5: Image Generation");
    results.phase5 = await generateImagesForExercise(exerciseName);

    // Phase 6: Validation
    console.log("\n✅ PHASE 6: Validation");
    results.phase6 = await validateExercise(exerciseName, options.skipRegen);

    return { results, duration: Date.now() - startTime };
  }
  ```
- **GOTCHA**: Each phase has different return signatures - normalize in results
- **VALIDATE**: `node src/generate-video.js bent-over-barbell-row --verbose` (dry run if no anchors)

### Task 8: UPDATE src/generate-video.js - Summary report

- **IMPLEMENT**: Generate and save generation-report.json after pipeline completes
- **PATTERN**: Similar to validation-summary.json structure
- **SCHEMA**:
  ```json
  {
    "exercise": "exercise-name",
    "generated_at": "ISO timestamp",
    "duration_ms": 12345,
    "phases": {
      "script_generation": { "success": true, "total_shots": 6 },
      "image_generation": { "generated": 5, "skipped": 1, "errors": 0 },
      "validation": { "approved": 5, "flagged": 1, "errors": 0 }
    },
    "ready_for_assembly": true,
    "flags_used": ["--skip-regen"],
    "next_steps": ["Review flagged shots", "Assemble video"]
  }
  ```
- **OUTPUT PATH**: `output/video-scripts/{exercise}/generation-report.json`
- **VALIDATE**: Check file exists after full run

### Task 9: UPDATE src/generate-video.js - Final summary output

- **IMPLEMENT**: Print summary ASCII box after pipeline completes
- **PATTERN**: MIRROR phase6-validation.js final summary
- **CONTENT**:
  ```
  ╔═══════════════════════════════════════════════════════════════╗
  ║  🎉 VIDEO CONTENT GENERATION COMPLETE                         ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║  Exercise: bent-over-barbell-row                              ║
  ║  Duration: 45.2s                                              ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║  RESULTS:                                                     ║
  ║  • Script: 6 shots planned                                    ║
  ║  • Images: 5 generated, 1 skipped                             ║
  ║  • Validation: 5 approved, 1 flagged                          ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║  STATUS: Ready for assembly ✅ (or: Needs review ⚠️)          ║
  ╠═══════════════════════════════════════════════════════════════╣
  ║  OUTPUTS:                                                     ║
  ║  • output/video-scripts/bent-over-barbell-row/                ║
  ║  • generation-report.json                                     ║
  ╚═══════════════════════════════════════════════════════════════╝
  ```
- **VALIDATE**: Full run shows summary

### Task 10: UPDATE src/generate-video.js - Error handling

- **IMPLEMENT**: Wrap pipeline in try/catch with graceful failure
- **PATTERN**: Exit with code 1 on failure, print error details
- **BEHAVIOR**:
  1. If phase fails, log which phase failed
  2. Save partial generation-report.json with failure info
  3. Suggest remediation steps
  4. Exit with code 1
- **VALIDATE**: `node src/generate-video.js nonexistent-exercise 2>&1; echo "Exit code: $?"`

### Task 11: UPDATE package.json - Add generate-video script

- **IMPLEMENT**: Add npm script for unified command
- **PATTERN**: MIRROR existing phase scripts
- **CHANGE**: Add `"generate-video": "node src/generate-video.js"` to scripts
- **VALIDATE**: `npm run generate-video 2>&1 | head -5` (should show usage)

### Task 12: UPDATE src/generate-video.js - --force flag support

- **IMPLEMENT**: Add --force flag that clears existing outputs before running
- **BEHAVIOR**:
  1. If --force: Delete {exercise} folder before starting
  2. Log: "🗑️ Clearing existing outputs (--force)"
  3. This bypasses all skip-if-exists checks
- **GOTCHA**: Only delete the specific exercise folder, not all video-scripts
- **VALIDATE**: Run twice with --force, second run should regenerate everything

---

## TESTING STRATEGY

### Unit Tests

No formal unit tests required - validation through CLI commands.

### Integration Tests

Test the full pipeline with a known exercise:

```bash
# Test 1: Basic usage
npm run generate-video bent-over-barbell-row

# Test 2: With skip-regen
npm run generate-video bent-over-barbell-row -- --skip-regen

# Test 3: Force regeneration
npm run generate-video bent-over-barbell-row -- --force

# Test 4: Error handling (no exercise name)
npm run generate-video
```

### Edge Cases

1. Exercise folder already exists with partial outputs
2. Missing anchor images
3. API rate limit during image generation
4. Validation fails all iterations

---

## VALIDATION COMMANDS

Execute every command to ensure zero regressions and 100% feature correctness.

### Level 1: Syntax & Style

```bash
# Check all modified files have valid syntax
node --check src/generate-video.js && echo "✅ generate-video.js valid"
node --check src/phase4-script-generator.js && echo "✅ phase4 valid"
node --check src/phase5-batch-image-gen.js && echo "✅ phase5 valid"
node --check src/phase6-validation.js && echo "✅ phase6 valid"
```

**Expected**: All pass with exit code 0

### Level 2: Export Verification

```bash
# Verify exports work
node -e "import('./src/phase4-script-generator.js').then(m => console.log('phase4 exports:', Object.keys(m)))"
node -e "import('./src/phase5-batch-image-gen.js').then(m => console.log('phase5 exports:', Object.keys(m)))"
node -e "import('./src/phase6-validation.js').then(m => console.log('phase6 exports:', Object.keys(m)))"
```

**Expected**: Each shows the exported function name

### Level 3: CLI Behavior

```bash
# Usage message (no args)
npm run generate-video 2>&1 | grep -q "Usage:" && echo "✅ Usage shown"

# Help detection
npm run generate-video -- --help 2>&1 | grep -q "Usage:" && echo "✅ Help works"

# Missing env var detection
FAL_KEY= npm run generate-video test 2>&1 | grep -q "FAL_KEY" && echo "✅ Env check works"
```

### Level 4: Full Pipeline Test

```bash
# Run full pipeline on test exercise (requires API keys)
npm run generate-video bent-over-barbell-row

# Verify outputs exist
ls output/video-scripts/bent-over-barbell-row/
cat output/video-scripts/bent-over-barbell-row/generation-report.json
```

### Level 5: Existing Scripts Still Work

```bash
# Ensure we didn't break standalone phase scripts
npm run phase4 bent-over-barbell-row 2>&1 | head -10
npm run phase5 bent-over-barbell-row 2>&1 | head -10
npm run phase6 bent-over-barbell-row 2>&1 | head -10
```

---

## ACCEPTANCE CRITERIA

- [ ] Single command `npm run generate-video <exercise>` runs full pipeline
- [ ] Progress reported during execution with phase indicators
- [ ] `generation-report.json` created with complete stats
- [ ] Final summary shows results and next steps
- [ ] `--skip-regen` flag passes through to phase6
- [ ] `--force` flag clears existing outputs before running
- [ ] Error in any phase fails gracefully with helpful message
- [ ] Existing phase scripts (`npm run phase4/5/6`) still work independently
- [ ] All syntax checks pass
- [ ] Exit code 0 on success, 1 on failure

---

## COMPLETION CHECKLIST

- [ ] All tasks completed in order
- [ ] Each task validation passed immediately
- [ ] All validation commands executed successfully:
  - [ ] Level 1: Syntax checks pass
  - [ ] Level 2: Exports verified
  - [ ] Level 3: CLI behavior correct
  - [ ] Level 4: Full pipeline test
  - [ ] Level 5: Existing scripts unbroken
- [ ] Full test suite passes
- [ ] No linting errors
- [ ] All acceptance criteria met
- [ ] Code follows project conventions (CLAUDE.md)

---

## NOTES

### Design Decisions

1. **Refactor vs. Import**: Chose to export functions from existing phase scripts rather than duplicate code. This keeps DRY and ensures standalone scripts still work.

2. **Sequential vs. Parallel**: Phases must run sequentially (4→5→6) because each depends on the previous output. No opportunity for parallelization.

3. **Error Handling**: Fail fast on phase failure. Don't attempt to continue to next phase if current phase fails.

4. **Report Format**: JSON for machine parsing, ASCII summary for human readability.

### Risks

1. **API Rate Limits**: Full pipeline makes many API calls. Rate limiting between phases may be needed.

2. **Long Running**: A full pipeline can take several minutes. Consider adding progress indicators.

3. **Partial Failures**: If phase 5 fails mid-way, need to handle resuming from where it left off (already handled by skip-if-exists pattern).
