# CLAUDE.md - LoRA Image Generator

## 1. Core Principles

- **Character Consistency**: All generated images must maintain the same character appearance using anchor reference images from `output/anchors-selected/`
- **Phase-Based Pipeline**: Work progresses through distinct phases (anchor generation → variations → training → video scripts). Respect phase boundaries and dependencies
- **Structured Output**: All outputs follow strict folder structures with JSON metadata for traceability and automation
- **No Magic Numbers**: Configuration values (steps, strength, paths) live in CONFIG objects or JSON files, not scattered in code
- **Graceful Skipping**: Always check if files exist before regenerating - use skip logic to resume interrupted runs
- **Console Feedback**: Use ASCII box formatting for phase headers and progress reporting

## 2. Tech Stack

### Runtime & Language
- **Runtime**: Node.js (ES Modules)
- **Language**: JavaScript (ES2022+)
- **Package Manager**: npm

### Dependencies
```json
{
  "@fal-ai/client": "^1.2.0",    // Image generation API
  "archiver": "^7.0.1",          // ZIP file creation for training
  "dotenv": "^16.4.5",           // Environment variable management
  "express": "^4.18.2",          // Gallery server
  "open": "^10.1.0"              // Browser opening utility
}
```

### External Services
- **fal-ai/flux-pro/v1.1-ultra**: Base image generation
- **fal-ai/nano-banana/edit**: Reference-based image editing (character consistency)
- **fal-ai/flux-lora-fast-training**: LoRA model training
- **fal-ai/flux-lora**: LoRA inference

## 3. Architecture

### Directory Structure
```
lora-image-generator/
├── config/
│   ├── character.json          # Character definition (prompts, settings)
│   ├── anchors.json            # Anchor pose definitions
│   └── variations.json         # Variation definitions
│
├── src/
│   ├── phase1-anchors.js       # Generate base anchor images
│   ├── phase2-variations.js    # Generate pose variations
│   ├── phase2-rejected-regen.js # Regenerate rejected variations
│   ├── phase3-train-lora.js    # Train LoRA model
│   ├── test-lora.js            # Test trained LoRA
│   └── gallery-server.js       # Image selection UI
│
├── output/
│   ├── anchors/                # Raw anchor generations (multiple per pose)
│   ├── anchors-selected/       # Curated anchor images (1 per pose)
│   ├── variations/             # Generated pose variations
│   ├── variations-final/       # Approved variations for training
│   ├── lora-training/          # Training artifacts and results
│   └── video-scripts/          # Video script outputs (new feature)
│
└── .env                        # FAL_KEY environment variable
```

### Key Patterns
- **Pipeline Pattern**: Sequential phases with clear inputs/outputs
- **Reference-Based Generation**: Always use anchor images for character consistency
- **Skip-if-exists**: Check file existence before expensive API calls
- **Structured Logging**: ASCII box formatting for visibility

## 4. Code Style

### Naming Conventions
```javascript
// Constants: SCREAMING_SNAKE_CASE
const IMAGES_PER_ANCHOR = 10;
const OUTPUT_DIR = path.join(__dirname, "../output/anchors");

// Config objects: PascalCase for main object, camelCase for properties
const CONFIG = {
  inputDir: path.join(__dirname, "../output/variations-final"),
  training: {
    triggerWord: "fitness_boss",
    steps: 1000,
  },
};

// Functions: camelCase, verb-first
async function generateImage(prompt) {}
async function downloadImage(url, filepath) {}
async function ensureDir(dir) {}

// Files: kebab-case with phase prefix
// phase1-anchors.js, phase2-variations.js, phase3-train-lora.js
```

### ES Module Patterns
```javascript
// Always use ES module imports
import 'dotenv/config';
import { fal } from "@fal-ai/client";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

// __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
```

### Character/Prompt Definitions
```javascript
// Character definitions at top of file with clear section markers
// ============================================
// CHARACTER DEFINITION
// ============================================
const CHARACTER = {
  base_prompt: `Orange anatomical mannequin figure...`,
  negative_prompt: `realistic human skin, facial features...`,
};
```

## 5. Logging

### Console Output Format
```javascript
// Phase headers: ASCII box art
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║           PHASE 1: ANCHOR IMAGE GENERATION                    ║
╠═══════════════════════════════════════════════════════════════╣
║  Generating 8 anchor poses × 10 images each = 80 total        ║
╚═══════════════════════════════════════════════════════════════╝
`);

// Progress logging: Tree-style with emojis
console.log(`\n┌─ ${anchor.name} (${anchor.id})`);
console.log(`│  "${anchor.prompt.substring(0, 50)}..."`);
console.log(`│  🔄 [${i}/${total}] Generating ${filename}...`);
console.log(`│  ✅ Done`);
console.log(`│  ❌ Error: ${error.message}`);
console.log(`│  ⏭️  Skipped (exists)`);
console.log(`└─ Done\n`);

// Completion summaries
console.log(`
╔═══════════════════════════════════════════════════════════════╗
║  COMPLETE                                                     ║
╠═══════════════════════════════════════════════════════════════╣
║  Generated: ${generated} images                               ║
║  Skipped:   ${skipped} images                                 ║
╚═══════════════════════════════════════════════════════════════╝
`);
```

## 6. Testing

### Manual Testing Commands
```bash
# Run individual phases
npm run phase1          # Generate anchor images
npm run phase2          # Generate variations
npm run phase3          # Train LoRA
npm run gallery         # Launch selection UI
npm run test-lora       # Test trained model
```

### Validation Approach
- Visual inspection via gallery server (`npm run gallery`)
- Image-prompt alignment checked manually
- Character consistency verified against anchor references

## 7. API Patterns

### fal-ai Client Setup
```javascript
import 'dotenv/config';
import { fal } from "@fal-ai/client";

fal.config({
  credentials: process.env.FAL_KEY,
});
```

### Image Generation (flux-pro)
```javascript
const result = await fal.subscribe("fal-ai/flux-pro/v1.1-ultra", {
  input: {
    prompt: fullPrompt,
    negative_prompt: CHARACTER.negative_prompt,
    image_size: "square_hd",
    num_images: 1,
    guidance_scale: 3.5,
    safety_tolerance: 2,
  },
  logs: false,
});
```

### Reference-Based Editing (nano-banana)
```javascript
const result = await fal.subscribe("fal-ai/nano-banana/edit", {
  input: {
    prompt: fullPrompt,
    image_urls: [anchorDataUrl],  // Base64 data URL
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
```

### File to Data URL Helper
```javascript
async function fileToDataUrl(filepath) {
  const buffer = await fs.readFile(filepath);
  return `data:image/png;base64,${buffer.toString("base64")}`;
}
```

### Image Download Helper
```javascript
async function downloadImage(url, filepath) {
  const response = await fetch(url);
  const buffer = await response.arrayBuffer();
  await fs.writeFile(filepath, Buffer.from(buffer));
}
```

## 8. Common Patterns

### Skip-if-exists Pattern
```javascript
// Always check before generating
const filepath = path.join(outputDir, filename);
try {
  await fs.access(filepath);
  console.log(`│  ⏭️  ${filename} exists, skipping`);
  totalSkipped++;
  continue;
} catch {}

// Generate if not exists
const url = await generateImage(prompt);
await downloadImage(url, filepath);
```

### Directory Scanning Pattern
```javascript
async function getAllImages(dir) {
  const images = [];

  async function scan(currentDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await scan(fullPath);
      } else if (/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) {
        images.push(fullPath);
      }
    }
  }

  await scan(dir);
  return images;
}
```

### Anchor Image Loading Pattern
```javascript
async function getAnchorImage(anchorId) {
  // Check selected anchor first
  const selectedPath = path.join(ANCHORS_DIR, `${anchorId}.png`);
  try {
    await fs.access(selectedPath);
    return selectedPath;
  } catch {}

  // Fall back to first in folder
  const anchorDir = path.join(OUTPUT_DIR, "anchors", anchorId);
  const files = await fs.readdir(anchorDir);
  const pngs = files.filter(f => f.endsWith(".png")).sort();
  if (pngs.length > 0) return path.join(anchorDir, pngs[0]);

  throw new Error(`No anchor found: ${anchorId}`);
}
```

## 9. Environment & Configuration

### Required Environment Variables
```env
FAL_KEY=your-fal-ai-api-key
```

### Startup Validation
```javascript
if (!process.env.FAL_KEY) {
  console.error("❌ FAL_KEY not found in .env file");
  process.exit(1);
}
```

## 10. Archon MCP Server

This project uses the **Archon MCP server** for documentation RAG (Retrieval-Augmented Generation) and task management.

### RAG Documentation Queries

Use Archon's RAG tools to search indexed documentation before implementing features:

```
# Get available documentation sources
mcp__archon__rag_get_available_sources()

# Search documentation (keep queries SHORT: 2-5 keywords)
mcp__archon__rag_search_knowledge_base(query="nano-banana edit", source_id="src_xxx")

# Search for code examples
mcp__archon__rag_search_code_examples(query="fal-ai flux", source_id="src_xxx")

# Read full page content after search
mcp__archon__rag_read_full_page(page_id="...")
```

**Query Best Practices:**
- Keep queries short and focused (2-5 keywords)
- Good: `"flux lora training"`, `"nano-banana reference"`
- Bad: `"how to train a lora model with flux on fal-ai using reference images"`

### Task Management

Use Archon for project and task tracking:

```
# Find/list tasks
mcp__archon__find_tasks()                                    # All tasks
mcp__archon__find_tasks(query="phase4")                      # Search tasks
mcp__archon__find_tasks(filter_by="status", filter_value="todo")  # Filter by status

# Manage tasks
mcp__archon__manage_task("create", project_id="...", title="Implement Phase 4")
mcp__archon__manage_task("update", task_id="...", status="doing")
mcp__archon__manage_task("update", task_id="...", status="done")

# Project management
mcp__archon__find_projects()
mcp__archon__manage_project("create", title="Video Script Generator", description="...")
```

**Task Status Flow:** `todo` → `doing` → `review` → `done`

### Workflow Integration

1. **Before implementing**: Search RAG for relevant documentation
2. **Starting work**: Create/update task to `doing` status
3. **Completing work**: Mark task as `review` or `done`
4. **Research phase**: Use RAG to find API patterns, examples, best practices

## 11. AI Coding Assistant Instructions

1. **Read before writing**: Always read existing files before modifying. Understand the CHARACTER definition, CONFIG structure, and output patterns already in use
2. **Maintain phase structure**: New features should follow the phase naming convention (e.g., `phase4-video-scripts.js`) and respect the pipeline flow
3. **Use anchor references**: Any image generation must use anchors from `output/anchors-selected/` via nano-banana for character consistency
4. **Follow logging style**: Use ASCII box headers for phases, tree-style progress logs with emojis (✅❌⏭️🔄)
5. **Implement skip logic**: Always check if output files exist before making API calls to allow resumable runs
6. **Keep prompts in constants**: Character prompts, negative prompts, and variation definitions should be in clearly marked constant blocks at file top
7. **Use ES modules**: All imports use ES module syntax, use the `__dirname` workaround for path resolution
8. **Structure outputs**: Follow the nested folder pattern with JSON metadata files alongside generated assets
9. **Handle API responses carefully**: fal-ai response structure varies - check both `result.data?.images` and `result.images`
10. **Test with gallery**: After generating images, use `npm run gallery` for visual verification before proceeding to next phase
11. **Use Archon for research**: Before implementing new features, search Archon RAG for relevant documentation and examples
12. **Track work in Archon**: Create and update tasks in Archon when working on significant features
