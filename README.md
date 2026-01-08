# LoRA Image Generator

Generate consistent character images for LoRA training using an anchor-based approach.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set API key
export FAL_KEY="your-fal-ai-key"

# 3. Generate anchor images (8 poses × 10 each)
npm run phase1

# 4. Open gallery, select best anchor for each pose
npm run gallery

# 5. Generate variations from anchors (~100 images)
npm run phase2

# 6. In gallery, select best 20-30 for training, click Export
```

## How It Works

```
Phase 1                    Phase 2                    Output
────────                   ────────                   ──────
Generate 8 anchors    →    Edit anchors into     →   20-30 consistent
(front, back, side,        100 pose variations       images for LoRA
quarter, arms_up,          using image-to-image      training
bent, seated, hanging)     API
```

**Key insight:** Editing from a reference image maintains character consistency. Random generation causes drift.

## Cost

~$6-7 total for ~180 images

## Docs

See [PROCESS.md](./PROCESS.md) for full documentation.
