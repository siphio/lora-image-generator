# Product Requirements Document: AI Video Script Generator Pipeline

## 1. Executive Summary

The AI Video Script Generator Pipeline is an automated system for creating short-form fitness video content featuring a consistent character. The system takes an exercise name as input and produces a complete content package: a professional TTS voiceover script, engineered image prompts, and AI-generated images showing the character performing exercises with highlighted muscle activation.

The pipeline leverages AI at multiple stages—researching exercise mechanics, generating scripts, planning animation sequences, creating images via fal-ai's nano-banana endpoint, and validating output quality. This creates an efficient workflow where users manually stitch the final video from high-quality, validated assets.

**MVP Goal:** Build a functional three-phase pipeline that generates complete video content packages for fitness exercises, with automated quality validation and regeneration capabilities.

---

## 2. Mission

**Mission Statement:** Automate the creation of professional, educational short-form fitness content using AI-generated imagery of a consistent character, enabling rapid content production at scale.

**Core Principles:**
1. **Character Consistency** - Every generated image maintains the same character appearance using anchor reference images
2. **Educational Quality** - Content accurately teaches proper exercise form and muscle engagement
3. **Automation First** - Minimize manual intervention through AI-driven validation and regeneration
4. **Structured Output** - Well-organized file structure enables efficient manual video assembly
5. **Iterative Improvement** - Failed generations are automatically refined and retried

---

## 3. Target Users

**Primary User: Content Creator (You)**
- Creating fitness content for TikTok/short-form platforms
- Technical comfort: High (comfortable with CLI tools, JSON, Node.js)
- Needs: Fast, consistent content generation with minimal manual image creation
- Pain points: Manual image generation is slow; maintaining character consistency is difficult

**Secondary User: Future Content Creators**
- May use the system as a template for their own characters
- Would need their own anchor image library

---

## 4. MVP Scope

### In Scope

**Core Functionality:**
- ✅ Exercise name input triggers full pipeline
- ✅ AI researches exercise (muscles, form, technique)
- ✅ Generates continuous TTS voiceover script
- ✅ Plans video segments with shot list
- ✅ Identifies animation sequences and spawns sub-agent for 3-5 frame planning
- ✅ Generates engineered prompts for nano-banana
- ✅ Maps exercises to appropriate anchor images
- ✅ Batch image generation through nano-banana API
- ✅ AI validation of generated images against prompts
- ✅ Auto-regeneration with refined prompts (max 2 iterations)
- ✅ Manual review flagging after failed iterations

**Technical:**
- ✅ Nested folder structure per video/shot
- ✅ JSON metadata files (script.json, prompt.json, validation.json)
- ✅ Integration with existing fal-ai nano-banana endpoint
- ✅ Use of 9 existing anchor images as reference library

**Output Structure:**
- ✅ Complete video package in `output/video-scripts/[exercise-name]/`
- ✅ Per-shot folders with prompt, image, and validation files
- ✅ Master script.json with TTS segments mapped to shots
- ✅ Validation summary for entire video

### Out of Scope

**Deferred to Future Phases:**
- ❌ Automatic video stitching/editing
- ❌ TTS audio file generation (text only for now)
- ❌ Music/sound effects integration
- ❌ Web UI for pipeline control
- ❌ Multiple character support
- ❌ Custom anchor image upload flow
- ❌ Social media auto-posting

---

## 5. User Stories

### Primary User Stories

1. **As a content creator, I want to input an exercise name and receive a complete content package**, so that I can quickly assemble fitness videos without manual image generation.
   - *Example: Input "bent-over barbell row" → receive folder with TTS script, 6-8 images, all prompts and metadata*

2. **As a content creator, I want the AI to research which muscles an exercise targets**, so that the content is educational and accurate without my manual research.
   - *Example: AI identifies lats, rhomboids (primary) and biceps, rear delts (secondary) for rows*

3. **As a content creator, I want muscles highlighted in red on the character when mentioned in the script**, so that viewers can see which muscles are being worked.
   - *Example: During "this targets your lats" voiceover, the image shows lats highlighted in red*

4. **As a content creator, I want animation sequences of 3-5 frames showing range of motion**, so that when stitched together they create a mock animation of the exercise.
   - *Example: Pull-start → pull-mid → pull-peak frames that show the rowing motion*

5. **As a content creator, I want all images to use my anchor images as reference**, so that the character remains consistent across all content.
   - *Example: All bent-over row shots use `bent.png` as the nano-banana reference image*

6. **As a content creator, I want failed images to be automatically regenerated with improved prompts**, so that I don't have to manually troubleshoot each failure.
   - *Example: Image missing muscle highlighting → AI refines prompt → regenerates → validates again*

7. **As a content creator, I want a clear folder structure with all assets organized per shot**, so that I can easily navigate and assemble the final video.
   - *Example: `shots/03-pull-start/` contains prompt.json, image.png, validation.json all together*

8. **As a content creator, I want a validation summary showing which shots need manual review**, so that I can quickly identify and fix remaining issues.
   - *Example: validation-summary.json shows 5/6 shots approved, 1 flagged for manual review*

### Technical User Stories

9. **As the system, I need to spawn a sub-agent when animation sequences are needed**, so that frame-by-frame motion planning is handled by a specialized process.

10. **As the system, I need to track prompt iteration history**, so that failed attempts inform better subsequent prompts.

---

## 6. Core Architecture & Patterns

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     VIDEO SCRIPT GENERATOR                       │
├─────────────────────────────────────────────────────────────────┤
│  INPUT: Exercise Name (e.g., "bent-over-barbell-row")           │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 1: SCRIPT GENERATION                    │
├─────────────────────────────────────────────────────────────────┤
│  • AI researches exercise mechanics & muscles                    │
│  • Generates TTS voiceover script                                │
│  • Plans video segments & shot list                              │
│  • Identifies animation sequences                                │
│    └── Spawns Animation Planner Sub-Agent (3-5 frames)          │
│  • Maps shots to anchor images                                   │
│  • Generates engineered prompts                                  │
│  • Creates folder structure & metadata files                     │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                 PHASE 2: BATCH IMAGE GENERATION                  │
├─────────────────────────────────────────────────────────────────┤
│  • Iterates through all shot folders                             │
│  • Loads prompt.json + anchor reference image                    │
│  • Calls fal-ai/nano-banana/edit endpoint                        │
│  • Saves image.png to shot folder                                │
└─────────────────────┬───────────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PHASE 3: VALIDATION                           │
├─────────────────────────────────────────────────────────────────┤
│  FOR EACH SHOT:                                                  │
│  • Load prompt.json, image.png, TTS context                      │
│  • AI vision analysis against criteria:                          │
│    - Character consistency (vs anchor)                           │
│    - Pose accuracy                                               │
│    - Muscle highlighting present                                 │
│    - Matches TTS context                                         │
│    - No hallucinations                                           │
│  • If PASS → validation.json status: "approved"                  │
│  • If FAIL → refine prompt → regenerate → retry (max 2x)        │
│  • If still FAIL → flag for manual review                        │
│  • Output validation-summary.json                                │
└─────────────────────────────────────────────────────────────────┘
```

### Directory Structure

```
lora-image-generator/
├── output/
│   ├── anchors-selected/           # Reference images (9 anchors)
│   │   ├── front.png
│   │   ├── back.png
│   │   ├── side.png
│   │   ├── quarter.png
│   │   ├── bent.png
│   │   ├── hands-up.png
│   │   ├── seated.png
│   │   ├── lying.png
│   │   └── hanging.png
│   │
│   └── video-scripts/              # Generated content
│       └── [exercise-name]/
│           ├── script.json
│           ├── tts-script.txt
│           ├── validation-summary.json
│           └── shots/
│               └── [XX-descriptive-name]/
│                   ├── prompt.json
│                   ├── image.png
│                   └── validation.json
│
├── src/
│   ├── phase1-script-generator.js
│   ├── phase2-batch-image-gen.js
│   ├── phase3-validation.js
│   └── utils/
│       ├── nano-banana-client.js
│       ├── anchor-mapper.js
│       └── ai-client.js
│
└── package.json
```

### Key Design Patterns

1. **Pipeline Pattern** - Three distinct phases that can run independently or in sequence
2. **Agent Delegation** - Main script generator spawns sub-agents for specialized tasks (animation planning)
3. **Self-Healing** - Validation phase automatically attempts to fix failures before flagging
4. **Traceability** - Full prompt history maintained for debugging and improvement

---

## 7. Features

### Feature 1: Script Generation Engine

**Purpose:** Transform an exercise name into a complete video script with all metadata

**Operations:**
- Research exercise via AI (web search or knowledge base)
- Generate engaging TTS script (personal trainer style)
- Plan video segments with timing guidance
- Map TTS segments to visual shots
- Generate engineered image prompts

**Key Features:**
- Identifies primary and secondary muscles automatically
- Determines appropriate anchor image per shot
- Flags animation sequences for sub-agent processing

### Feature 2: Animation Sequence Planner (Sub-Agent)

**Purpose:** Plan 3-5 frames that create mock animation of exercise movement

**Operations:**
- Receive movement description from main agent
- Plan frame progression (start → mid → peak positions)
- Ensure consistent camera angle across frames
- Generate individual prompts for each frame

**Key Features:**
- Frames share same anchor image for consistency
- Progressive muscle engagement across sequence
- Maintains spatial consistency (character position, environment)

### Feature 3: Batch Image Generator

**Purpose:** Generate all images for a video script via nano-banana API

**Operations:**
- Read all prompt.json files from shots/
- Load corresponding anchor reference image
- Call nano-banana edit endpoint
- Save generated images

**Key Features:**
- Parallel or sequential processing option
- Progress tracking
- Error handling with retry logic

### Feature 4: Quality Validator

**Purpose:** Ensure generated images meet quality standards

**Validation Criteria:**
- Character consistency (compared to anchor reference)
- Pose accuracy (matches prompt description)
- Muscle highlighting (red overlay visible when required)
- TTS context alignment (image matches what's being said)
- No hallucinations (correct limb count, no artifacts)

**Operations:**
- Load shot folder contents (prompt, image, TTS context)
- AI vision analysis against criteria
- Generate validation.json with pass/fail and details
- If failed: refine prompt, regenerate, re-validate (max 2 iterations)
- Flag for manual review after max iterations

### Feature 5: Anchor Image Mapper

**Purpose:** Map exercises/poses to appropriate anchor images

**Mapping Logic:**
| Exercise Type | Anchor |
|--------------|--------|
| Bent-over movements (rows, RDLs) | `bent.png` |
| Overhead movements (presses) | `hands-up.png` |
| Supine exercises (bench, skull crushers) | `lying.png` |
| Pull-ups, hanging leg raises | `hanging.png` |
| Seated exercises | `seated.png` |
| Front-facing poses | `front.png` |
| Back/rear views | `back.png` |
| Side profile shots | `side.png` |
| 3/4 angle views | `quarter.png` |

---

## 8. Technology Stack

### Backend
- **Runtime:** Node.js (existing project)
- **AI Client:** Anthropic Claude API (script generation, validation)
- **Image Generation:** fal-ai nano-banana/edit endpoint (existing integration)

### Dependencies
```json
{
  "dependencies": {
    "@anthropic-ai/sdk": "^0.x.x",
    "@fal-ai/client": "existing",
    "dotenv": "^16.x.x"
  }
}
```

### Third-Party Integrations
- **fal-ai/nano-banana/edit** - Image generation with reference image
- **Claude API** - Script generation, validation analysis
- **Web Search** (optional) - Exercise research

---

## 9. Security & Configuration

### Configuration (Environment Variables)

```env
ANTHROPIC_API_KEY=sk-ant-...
FAL_KEY=existing-key
```

### Settings

```javascript
const CONFIG = {
  maxValidationIterations: 2,
  animationFrameCount: { min: 3, max: 5 },
  anchorsPath: 'output/anchors-selected',
  outputPath: 'output/video-scripts'
};
```

### Security Scope

**In Scope:**
- API key management via environment variables
- No sensitive data in generated content

**Out of Scope:**
- User authentication (single-user CLI tool)
- Data encryption (local files only)

---

## 10. Data Schemas

### script.json

```json
{
  "exercise": "bent-over-barbell-row",
  "exercise_display_name": "Bent-Over Barbell Row",
  "created_at": "2025-01-08T12:00:00Z",
  "muscles": {
    "primary": ["latissimus dorsi", "rhomboids"],
    "secondary": ["biceps", "rear deltoids", "erector spinae"]
  },
  "tts_script_file": "tts-script.txt",
  "tts_full_text": "Here's how to nail the barbell row...",
  "total_shots": 6,
  "segments": [
    {
      "tts_segment": "Here's how to nail the barbell row.",
      "shots": ["01-intro"],
      "is_animation_sequence": false
    },
    {
      "tts_segment": "Pull toward your belly button and squeeze.",
      "shots": ["03-pull-start", "04-pull-mid", "05-pull-peak"],
      "is_animation_sequence": true,
      "sequence_name": "pull-motion"
    }
  ]
}
```

### prompt.json

```json
{
  "shot_id": "03-pull-start",
  "shot_name": "Pull Phase Start",
  "anchor_image": "output/anchors-selected/bent.png",
  "visual_description": "Character in bent-over row position, arms extended, bar hanging",
  "highlighted_muscles": [],
  "engineered_prompt": "Muscular male character in bent-over row starting position, torso hinged forward at 45 degrees, arms fully extended gripping barbell, gym environment, fitness instruction style, consistent character",
  "is_sequence_frame": true,
  "sequence_name": "pull-motion",
  "sequence_order": 1,
  "sequence_total": 3,
  "iteration": 1,
  "max_iterations": 2,
  "prompt_history": []
}
```

### validation.json

```json
{
  "shot_id": "03-pull-start",
  "status": "approved",
  "iteration": 1,
  "confidence_score": 0.89,
  "checks": {
    "character_consistency": { "passed": true, "notes": "" },
    "pose_accuracy": { "passed": true, "notes": "" },
    "muscle_highlighting": { "passed": true, "notes": "N/A - no highlighting required" },
    "matches_tts_context": { "passed": true, "notes": "" },
    "no_hallucinations": { "passed": true, "notes": "" }
  },
  "issues": [],
  "flagged_for_manual_review": false
}
```

### validation.json (Failed Example)

```json
{
  "shot_id": "05-pull-peak",
  "status": "rejected",
  "iteration": 2,
  "confidence_score": 0.42,
  "checks": {
    "character_consistency": { "passed": true, "notes": "" },
    "pose_accuracy": { "passed": false, "notes": "Bar position too high, near chest instead of belly" },
    "muscle_highlighting": { "passed": false, "notes": "Lat highlighting not visible" },
    "matches_tts_context": { "passed": true, "notes": "" },
    "no_hallucinations": { "passed": true, "notes": "" }
  },
  "issues": [
    "Bar position incorrect - should be at lower torso",
    "Muscle highlighting not visible on lats"
  ],
  "flagged_for_manual_review": true,
  "rejection_history": [
    {
      "attempt": 1,
      "issues": ["Muscle highlighting absent"],
      "prompt_adjustment": "Added 'latissimus dorsi highlighted in bright red, glowing muscle overlay'"
    }
  ]
}
```

### validation-summary.json

```json
{
  "exercise": "bent-over-barbell-row",
  "generated_at": "2025-01-08T12:30:00Z",
  "total_shots": 6,
  "approved": 5,
  "rejected": 0,
  "flagged_for_review": 1,
  "shots": [
    { "id": "01-intro", "status": "approved" },
    { "id": "02-setup", "status": "approved" },
    { "id": "03-pull-start", "status": "approved" },
    { "id": "04-pull-mid", "status": "approved" },
    { "id": "05-pull-peak", "status": "flagged_for_review" },
    { "id": "06-muscles-targeted", "status": "approved" }
  ],
  "ready_for_assembly": false,
  "blocking_issues": ["Shot 05-pull-peak requires manual review"]
}
```

---

## 11. Success Criteria

### MVP Success Definition

The MVP is successful when a user can:
1. Input an exercise name
2. Receive a complete, organized content package
3. Have 80%+ of images pass validation without manual intervention
4. Assemble a cohesive short-form video from the outputs

### Functional Requirements

- ✅ Single command triggers full pipeline
- ✅ AI accurately identifies muscles for common exercises
- ✅ TTS script is engaging and educational
- ✅ All images use correct anchor reference
- ✅ Animation sequences produce 3-5 coherent frames
- ✅ Validation catches obvious quality issues
- ✅ Auto-regeneration improves success rate
- ✅ Clear folder structure for manual assembly

### Quality Indicators

- Image-prompt alignment rate: >80%
- Character consistency rate: >90%
- Average validation iterations: <1.5
- Manual review rate: <20%

---

## 12. Implementation Phases

### Phase 1: Script Generation Foundation

**Goal:** Build the core script generation system

**Deliverables:**
- ✅ Exercise research via AI (muscles, form cues)
- ✅ TTS script generation
- ✅ Shot planning with anchor mapping
- ✅ Folder structure creation
- ✅ prompt.json generation for each shot
- ✅ Animation sequence detection and sub-agent spawning

**Validation:**
- Input "bent-over-barbell-row" produces complete folder structure
- script.json contains accurate muscle data
- All shots have valid prompt.json files

### Phase 2: Batch Image Generation

**Goal:** Integrate nano-banana for image generation

**Deliverables:**
- ✅ Read prompt.json from all shot folders
- ✅ Load anchor images as references
- ✅ Call nano-banana API
- ✅ Save images to correct locations
- ✅ Handle API errors gracefully

**Validation:**
- All shots receive generated images
- Images saved to correct shot folders
- No API failures cause pipeline crash

### Phase 3: Quality Validation & Auto-Regeneration

**Goal:** Automated quality assurance with self-healing

**Deliverables:**
- ✅ AI vision analysis of each image
- ✅ Validation checks (5 criteria)
- ✅ validation.json generation
- ✅ Prompt refinement on failure
- ✅ Regeneration loop (max 2 iterations)
- ✅ Manual review flagging
- ✅ validation-summary.json generation

**Validation:**
- Validation correctly identifies quality issues
- Refined prompts improve regeneration success
- Manual review flags appear after max iterations

### Phase 4: Polish & Integration

**Goal:** End-to-end pipeline with CLI interface

**Deliverables:**
- ✅ Single CLI command for full pipeline
- ✅ Progress reporting during execution
- ✅ Summary output showing results
- ✅ Documentation for usage

**Validation:**
- `node src/generate-video.js "deadlift"` produces complete package
- User can assemble video from outputs

---

## 13. Future Considerations

### Post-MVP Enhancements

- **TTS Audio Generation** - Generate actual audio files from scripts
- **Video Assembly Automation** - Auto-stitch images into video with TTS overlay
- **Exercise Library** - Pre-built database of exercises with muscle mappings
- **Template Variations** - Different video styles (quick tips, deep dive, comparison)
- **Batch Exercise Processing** - Generate multiple exercise videos in one run

### Integration Opportunities

- **TikTok API** - Direct posting of assembled videos
- **Eleven Labs** - High-quality TTS voice generation
- **CapCut API** - Automated video editing
- **Music Libraries** - Auto-add royalty-free background music

### Advanced Features

- **A/B Script Testing** - Generate multiple script variations
- **Analytics Integration** - Track which content performs best
- **Multi-Character Support** - Different avatar libraries
- **Injury Modification Mode** - Generate exercise modifications

---

## 14. Risks & Mitigations

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Nano-banana inconsistent character rendering** | High - breaks core value prop | Medium | Use high-quality anchor images; validation catches issues; prompt engineering |
| **Muscle highlighting doesn't render well** | Medium - educational value reduced | Medium | Test prompt variations; may need style-specific prompts; fallback to text overlays in editing |
| **AI validation false positives/negatives** | Medium - wrong images approved or good ones rejected | Medium | Tune validation prompts; add confidence thresholds; human spot-checks |
| **API rate limits or costs** | Low - slows production | Low | Batch processing with delays; cost monitoring; caching |
| **Exercise research inaccuracy** | Medium - wrong muscle information | Low | Use authoritative sources; human review of first few exercises |

---

## 15. Appendix

### Anchor Image Library

| Filename | Description | Use Cases |
|----------|-------------|-----------|
| `front.png` | Front-facing view | Intro shots, front muscle highlights |
| `back.png` | Rear view | Back exercises, posterior chain highlights |
| `side.png` | Profile view | Form checks, side angles |
| `quarter.png` | 3/4 angle | Dynamic poses, transitions |
| `bent.png` | Hinged/bent position | Rows, RDLs, bent-over movements |
| `hands-up.png` | Arms raised overhead | Presses, pulldown start position |
| `seated.png` | Seated position | Cable rows, leg extensions, seated presses |
| `lying.png` | Supine position | Bench press, skull crushers, floor work |
| `hanging.png` | Hanging from bar | Pull-ups, hanging leg raises |

### Example Exercise → Anchor Mapping

| Exercise | Primary Anchor | Secondary Anchors |
|----------|---------------|-------------------|
| Bent-over barbell row | `bent.png` | `back.png` (muscle highlight) |
| Deadlift | `bent.png` (start), `front.png` (lockout) | `back.png` |
| Bench press | `lying.png` | `front.png` |
| Pull-up | `hanging.png` | `back.png` |
| Shoulder press | `hands-up.png` or `seated.png` | `front.png`, `side.png` |
| Squat | `front.png`, `side.png` | `quarter.png` |
| Lat pulldown | `seated.png`, `hands-up.png` | `back.png` |

### Related Project Files

- `src/phase2-variations.js` - Existing image variation generation
- `src/phase3-train-lora.js` - LoRA training pipeline
- `output/variations-final/` - Previously generated pose variations
