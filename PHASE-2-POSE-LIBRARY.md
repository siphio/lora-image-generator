# Phase 2: Pose Library - Step-by-Step Workflow

## Overview

The pose library is a collection of **skeleton images** extracted from real fitness videos. These skeletons tell ControlNet exactly how to position your AI character.

---

## The Complete Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                 POSE LIBRARY CREATION PIPELINE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  STEP 1: Identify exercises needed                               │
│       ↓                                                          │
│  STEP 2: Find stock videos showing proper form                   │
│       ↓                                                          │
│  STEP 3: Extract key frames (screenshots)                        │
│       ↓                                                          │
│  STEP 4: Run pose detection (DWPose) → skeleton images           │
│       ↓                                                          │
│  STEP 5: Organize into pose library                              │
│       ↓                                                          │
│  READY: Use skeletons with ControlNet                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Step 1: Identify Exercises Needed

**Purpose:** Define what poses you need to generate

**Action:** Make a list of exercises your videos will cover

```
Example list for "Back Workout" niche:

exercises/
├── pull-up
│   ├── start (arms extended)
│   ├── mid (halfway up)
│   └── top (chin over bar)
├── lat-pulldown
│   ├── start
│   ├── mid
│   └── contracted
├── barbell-row
│   ├── start
│   └── pulled
├── deadlift
│   ├── start
│   ├── mid
│   └── lockout
└── face-pull
    ├── start
    └── contracted
```

**Output:** List of ~30-50 pose variations needed

---

## Step 2: Find Stock Videos

**Purpose:** Get real human reference for each exercise

**Action:** Source videos showing proper exercise form

**Where to find:**

| Source | Cost | Quality |
|--------|------|---------|
| Pexels.com | Free | Good |
| Pixabay.com | Free | Good |
| Envato Elements | $16/mo | Excellent |
| Artgrid | $25/mo | Excellent |
| YouTube (for reference) | Free | Varies |

**What to look for:**
- Clear full-body view
- Neutral background (easier extraction)
- Proper form demonstration
- Multiple angles if possible

**Output:** Collection of ~10-20 stock videos

---

## Step 3: Extract Key Frames

**Purpose:** Get still images at the exact pose positions needed

**Tool:** Our Video Analyzer Tool (Puppeteer screenshots)

**Action:**
```powershell
cd C:\Users\marley\video-analyzer-tool

# For each stock video, extract frames
node claude-tool.js screenshot "./stock-videos/pull-up.mp4" 0.5
```

**Or manually:**
- Play video
- Pause at key positions (start, mid, end of movement)
- Screenshot

**Output:** 
```
frames/
├── pull-up/
│   ├── pull-up-start.png      # Person hanging, arms extended
│   ├── pull-up-mid.png        # Person halfway up
│   └── pull-up-top.png        # Person at top, chin over bar
├── deadlift/
│   ├── deadlift-start.png
│   └── deadlift-lockout.png
└── ...
```

---

## Step 4: Run Pose Detection (DWPose)

**Purpose:** Convert human photos into skeleton stick figures

**API:** fal.ai DWPose endpoint

### How DWPose Works

```
INPUT                           OUTPUT
┌─────────────────┐            ┌─────────────────┐
│                 │            │       ●         │
│    [Photo of    │  DWPose    │      /|\        │
│     person      │ ────────▶  │     / | \       │
│     doing       │   API      │    ●  |  ●      │
│     pull-up]    │            │       |         │
│                 │            │      / \        │
└─────────────────┘            └─────────────────┘
   Real human                    Skeleton only
```

### API Call

**Endpoint:** `fal.ai/fal-ai/dwpose`

```javascript
// Example API call
const response = await fal.run("fal-ai/dwpose", {
  input: {
    image_url: "https://your-storage.com/pull-up-frame.png"
  }
});

// Response contains skeleton image URL
const skeletonImage = response.image.url;
```

### What You Get Back

The API returns an image with:
- Stick figure skeleton
- Joint positions marked
- Black background (or transparent)

```
Skeleton output:

        ●  ← Head
      ──┼──
        │
       /│\
      ● │ ●  ← Elbows
        │
        │
       / \
      ●   ●  ← Knees
      │   │
      ●   ●  ← Ankles
```

### Batch Processing Script

```javascript
// process-poses.js
import * as fal from "@fal-ai/serverless-client";

fal.config({
  credentials: process.env.FAL_KEY
});

async function extractPose(imagePath) {
  const result = await fal.run("fal-ai/dwpose", {
    input: {
      image_url: imagePath
    }
  });
  return result.image.url;
}

// Process all frames
const frames = [
  "frames/pull-up/pull-up-start.png",
  "frames/pull-up/pull-up-mid.png",
  "frames/pull-up/pull-up-top.png",
  // ... more frames
];

for (const frame of frames) {
  const skeleton = await extractPose(frame);
  console.log(`Skeleton saved: ${skeleton}`);
  // Download and save skeleton image
}
```

**Cost:** ~$0.01 per image

**Output:**
```
poses/
├── pull-up/
│   ├── pull-up-start-skeleton.png
│   ├── pull-up-mid-skeleton.png
│   └── pull-up-top-skeleton.png
└── ...
```

---

## Step 5: Organize Pose Library

**Purpose:** Structure for easy lookup during video generation

**Final Structure:**
```
pose-library/
├── index.json                    # Master index
├── upper-body/
│   ├── pull-up/
│   │   ├── start.png
│   │   ├── mid.png
│   │   └── top.png
│   ├── lat-pulldown/
│   │   └── ...
│   └── face-pull/
│       └── ...
├── back/
│   ├── barbell-row/
│   │   └── ...
│   └── cable-row/
│       └── ...
├── legs/
│   ├── squat/
│   │   └── ...
│   └── deadlift/
│       └── ...
└── core/
    └── ...
```

**Index File (index.json):**
```json
{
  "exercises": {
    "pull-up": {
      "category": "upper-body",
      "poses": {
        "start": "upper-body/pull-up/start.png",
        "mid": "upper-body/pull-up/mid.png",
        "top": "upper-body/pull-up/top.png"
      },
      "muscles": ["lats", "biceps", "forearms"],
      "equipment": ["pull-up-bar"]
    },
    "deadlift": {
      "category": "back",
      "poses": {
        "start": "back/deadlift/start.png",
        "mid": "back/deadlift/mid.png",
        "lockout": "back/deadlift/lockout.png"
      },
      "muscles": ["lower-back", "glutes", "hamstrings", "traps"],
      "equipment": ["barbell"]
    }
  }
}
```

---

## How It's Used in the Full Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                    USING THE POSE LIBRARY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Scene Planner Output:                                           │
│  {                                                               │
│    "exercise": "pull-up",                                        │
│    "position": "top",                                            │
│    "muscles": ["lats", "biceps"]                                 │
│  }                                                               │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  Pose Library   │                                            │
│  │  Lookup         │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  poses/upper-body/pull-up/top.png  (skeleton image)             │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────┐        │
│  │  ControlNet API Call                                │        │
│  │                                                     │        │
│  │  Inputs:                                            │        │
│  │   - control_image: skeleton (pull-up top position) │        │
│  │   - prompt: "orange mannequin, lats highlighted"   │        │
│  │   - lora: your-trained-character                   │        │
│  │                                                     │        │
│  └────────┬────────────────────────────────────────────┘        │
│           │                                                      │
│           ▼                                                      │
│  OUTPUT: Your character doing pull-up, top position              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## API Summary

| Step | API/Tool | Purpose | Cost |
|------|----------|---------|------|
| 1 | Manual | List exercises | Free |
| 2 | Stock sites | Get reference videos | Free-$25/mo |
| 3 | Video Analyzer Tool | Extract frames | Free |
| 4 | **fal.ai DWPose** | Convert to skeletons | ~$0.01/image |
| 5 | Manual | Organize files | Free |

**Total for 50 poses:** ~$0.50

---

## Checklist

- [ ] List 10-15 exercises to start
- [ ] Find stock videos for each (2-3 angles)
- [ ] Extract 3-5 frames per exercise (start, mid, end)
- [ ] Run DWPose on all frames (~50 total)
- [ ] Organize into folder structure
- [ ] Create index.json for programmatic lookup
- [ ] Test with ControlNet to verify quality

---

*This pose library is built once and reused for every video you create.*
