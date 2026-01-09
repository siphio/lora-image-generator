# LoRA Training Image Generator

## Overview

This tool automates the generation of consistent character images for LoRA training. Instead of generating 100+ random images (which causes character drift), we use a **two-phase anchor-based approach** that maintains character consistency throughout.

---

## The Problem

When generating many images of the same character, each generation is independent. This causes:

- Character drift (features change between images)
- Inconsistent proportions
- Style variations
- Unusable training data

---

## The Solution: Anchor-Based Generation

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PHASE 1: Generate 8 Anchor Images (Character Sheet)            │
│  ═══════════════════════════════════════════════════            │
│                                                                  │
│  Use Flux Pro to generate 10 images of each base pose.          │
│  Manually select the BEST one for each pose.                    │
│  These 8 images become your "character sheet" - the ground      │
│  truth reference for all future generations.                    │
│                                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │ FRONT  │ │ BACK   │ │ SIDE   │ │QUARTER │                   │
│  │standing│ │standing│ │profile │ │ view   │                   │
│  └────────┘ └────────┘ └────────┘ └────────┘                   │
│                                                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐                   │
│  │ARMS UP │ │ BENT   │ │SEATED  │ │HANGING │                   │
│  │overhead│ │ over   │ │  on    │ │from bar│                   │
│  └────────┘ └────────┘ └────────┘ └────────┘                   │
│                                                                  │
│  Total: 8 anchors × 10 generations = 80 images                  │
│  Output: 8 hand-picked anchor images                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PHASE 2: Generate Variations via Image-to-Image Edit           │
│  ════════════════════════════════════════════════════           │
│                                                                  │
│  For each exercise pose:                                        │
│    1. Select the closest anchor (e.g., "hanging" for pull-ups)  │
│    2. Use fal.ai image-to-image with anchor as reference        │
│    3. Edit prompt describes the pose change                     │
│    4. Strength parameter controls how much to deviate           │
│                                                                  │
│  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐     │
│  │   ANCHOR    │  +   │ EDIT PROMPT │  →   │  VARIATION  │     │
│  │ hanging.png │      │"pull-up top │      │  pullup.png │     │
│  │             │      │ chin above  │      │  (consistent│     │
│  │             │      │ bar, lats   │      │  character) │     │
│  │             │      │ contracted" │      │             │     │
│  └─────────────┘      └─────────────┘      └─────────────┘     │
│                                                                  │
│  Key: Small edits from reference = consistent character         │
│                                                                  │
│  Total: ~30 variations × 3-5 images = ~100-150 images           │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                                                                  │
│  PHASE 3: Curate & Export                                       │
│  ════════════════════════                                       │
│                                                                  │
│  Use gallery UI to:                                             │
│    • Review all generated images                                │
│    • Select best 20-30 for LoRA training                        │
│    • Export to training folder                                  │
│                                                                  │
│  Final output: 20-30 high-quality, consistent images            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why This Works

| Approach | Character Consistency | Why |
|----------|----------------------|-----|
| 100 random generations | ❌ Poor | Each image is independent |
| Edit from 1 anchor | ⚠️ Medium | Extreme poses break consistency |
| Edit from 8 anchors | ✅ High | Small edits preserve character |

The key insight: **Smaller edit distance = higher consistency**

```
hanging.png → "pull-up top"     ✅ Small change, character preserved
front.png   → "pull-up top"     ❌ Large change, character drifts
```

By selecting the **closest anchor** for each variation, we minimize how much the AI needs to "imagine" and maximize character consistency.

---

## Anchor Selection Logic

Each variation maps to its most appropriate anchor:

| Exercise Pose | Best Anchor | Why |
|---------------|-------------|-----|
| Pull-up variations | `hanging` | Already in bar-hanging position |
| Chin-up variations | `hanging` | Same base position |
| Barbell row | `bent` | Already bent over |
| Deadlift start | `bent` | Similar hip hinge |
| Lat pulldown | `seated` | Already seated |
| Cable row | `seated` | Same position |
| Bicep curl | `front` | Standing front view |
| Front poses | `front` | Direct match |
| Rear poses | `back` | Direct match |
| Shoulder press | `arms_up` | Arms already overhead |
| Squat | `side` | Side view shows depth |
| Push-up | `side` | Side view shows form |
| Lunge | `quarter` | Dynamic angle |

---

## Strength Parameter Guide

The `strength` parameter (0.0 - 1.0) controls how much the output differs from the anchor:

| Strength | Use Case | Character Consistency |
|----------|----------|----------------------|
| 0.3 - 0.4 | Minor adjustments (arm position) | ⭐⭐⭐⭐⭐ Excellent |
| 0.5 - 0.55 | Moderate changes (different pose) | ⭐⭐⭐⭐ Good |
| 0.6 - 0.7 | Significant changes (body position) | ⭐⭐⭐ Acceptable |
| 0.8+ | Major transformation | ⚠️ Risk of drift |

**Rule of thumb:** Use the lowest strength that achieves the pose.

---

## Tool Location

```
/Users/hugemarley/Dev/Tools/lora-image-generator/
```

---

## Directory Structure

```
lora-image-generator/
├── config/
│   ├── character.json       # Character definition (prompts, style)
│   ├── anchors.json         # 8 anchor pose definitions
│   └── variations.json      # All variation definitions
├── src/
│   ├── phase1-anchors.js    # Generate anchor images
│   ├── phase2-variations.js # Generate variations from anchors
│   └── gallery-server.js    # Web UI for selection
├── output/
│   ├── anchors/             # Phase 1: Raw anchor generations
│   │   ├── front/           #   10 images per anchor
│   │   ├── back/
│   │   ├── side/
│   │   ├── quarter/
│   │   ├── arms_up/
│   │   ├── bent/
│   │   ├── seated/
│   │   └── hanging/
│   ├── anchors-selected/    # Your 8 chosen anchors
│   │   ├── front.png
│   │   ├── back.png
│   │   └── ...
│   ├── variations/          # Phase 2: All variations
│   │   ├── pullup_top/
│   │   ├── pullup_mid/
│   │   ├── barbell_row/
│   │   └── ...
│   └── training/            # Final export: 20-30 images for LoRA
└── package.json
```

---

## Usage

### Prerequisites

```bash
# Install dependencies
cd /Users/hugemarley/Dev/Tools/lora-image-generator
npm install

# Set your fal.ai API key
export FAL_KEY="your-fal-ai-key"
```

### Step 1: Generate Anchors

```bash
npm run phase1
```

This generates 80 images (8 anchors × 10 each) in `output/anchors/`.

**Time:** ~5-10 minutes  
**Cost:** ~$3-4

### Step 2: Select Best Anchors

```bash
npm run gallery
```

Opens web UI at `http://localhost:3456`. Click the **best image** for each of the 8 anchor poses. Selected images are copied to `output/anchors-selected/`.

### Step 3: Generate Variations

```bash
npm run phase2
```

Uses your selected anchors to generate ~100 variations in `output/variations/`.

**Time:** ~15-20 minutes  
**Cost:** ~$3-5

### Step 4: Curate Training Set

```bash
npm run gallery
```

Switch to "Phase 2: Variations" tab. Click images to select for training. Aim for **20-30 diverse, high-quality images**.

### Step 5: Export

Click the **"Export Training Set"** button in the gallery. Selected images are copied to `output/training/`.

---

## API Endpoints Used

### Phase 1: Flux Pro (Text-to-Image)

```
Endpoint: fal-ai/flux-pro/v1.1-ultra
Purpose: Generate high-quality anchor images from text prompts
Cost: ~$0.04 per image
```

### Phase 2: Flux Dev Image-to-Image

```
Endpoint: fal-ai/flux/dev/image-to-image
Purpose: Edit anchor images into new poses
Cost: ~$0.03 per image
```

---

## Character Definition

Edit `config/character.json` to customize your character:

```json
{
  "base_prompt": "Orange anatomical mannequin figure with 3D wireframe mesh grid pattern across entire body surface, faceless head with simple black oval eyes, wearing olive army green athletic shorts, grey athletic sneakers with white soles, solid cream beige background, clean vector illustration style...",
  
  "negative_prompt": "realistic human skin, facial features, hair, text, watermark, blurry, low quality, extra limbs..."
}
```

---

## Adding New Variations

Edit `src/phase2-variations.js` to add poses:

```javascript
const VARIATIONS = [
  // Add new variation
  {
    id: "new_exercise",           // Unique ID
    anchor: "front",              // Which anchor to use
    prompt: "doing new exercise", // What pose to create
    strength: 0.5                 // How much to change (0.3-0.7)
  },
  // ... existing variations
];
```

---

## Cost Summary

| Phase | Images | Cost |
|-------|--------|------|
| Phase 1: Anchors | 80 | ~$3.20 |
| Phase 2: Variations | ~100 | ~$3.00 |
| **Total** | ~180 | **~$6-7** |

---

## Tips for Best Results

### Selecting Anchors (Phase 1)
- Look for consistent proportions
- Check that grid lines are clean
- Ensure outfit is correct (shorts, shoes)
- Pick images with neutral, clear poses

### Selecting Training Images (Phase 2)
- Diversity matters: include various poses
- Reject images with obvious defects
- Include your 8 anchors in the training set
- Aim for 20-30 total images

### Training the LoRA
- Upload to fal.ai or Replicate
- Use trigger word: `fitmannequin` (or your choice)
- Training steps: 1000-1500
- Rank: 16-32

---

## Next Steps After Export

1. **Upload training images** to fal.ai LoRA training
2. **Set trigger word** (e.g., `fitmannequin`)
3. **Train LoRA** (~30 min, ~$5)
4. **Test generation** with your new LoRA
5. **Integrate** into main video pipeline

---

## Troubleshooting

### "No anchor image found"
Run Phase 1 first, or manually place an image in `output/anchors-selected/`.

### Character looks different in variations
- Reduce strength parameter (try 0.4-0.5)
- Ensure you're using the closest anchor
- Check that anchor images are consistent

### API rate limits
The tool includes 300ms delays between requests. If you hit limits, increase the delay in the source files.

---

## File Reference

| File | Purpose |
|------|---------|
| `src/phase1-anchors.js` | Generate 8 anchor poses × 10 images each |
| `src/phase2-variations.js` | Generate variations using anchors as reference |
| `src/gallery-server.js` | Web UI for image selection |
| `config/character.json` | Character prompt definitions |
| `config/anchors.json` | Anchor pose definitions |
| `config/variations.json` | Variation definitions |

---

*Last Updated: January 2025*
