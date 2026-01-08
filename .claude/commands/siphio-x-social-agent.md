---
description: Generate and post branded SIPHIO content to @siphioai X account
argument-hint: [category]
---

# SIPHIO X Social Agent: Post to @siphioai

## Objective

Generate branded SIPHIO content following the warm humanist visual identity and post to the official @siphioai X account. This command supports both autonomous news posting and manual strategic announcements.

**v3.1 Enhancement:** News-type posts now include a research phase to verify claims and check developer sentiment before posting.

## Category Selection

If no argument provided, present these options:

**News Categories (WITH research phase):**
1. **news** - Breaking AI/tech news
2. **quick_take** - Quick commentary
3. **spotlight** - Tool/resource highlight
4. **roundup** - Weekly summary (manual trigger)

**SIPHIO Categories (NO research - you're the source):**
5. **launch** - Product launch (thread)
6. **update** - Feature update
7. **milestone** - Celebration post
8. **case_study** - Client success story (thread)
9. **announcement** - General announcement

## Process

### Step 1: Determine Category

If argument provided (e.g., `/siphio-x-social-agent launch`), use that category.
Otherwise, ask user to select from the categories above.

### Step 2: Gather Inputs

Based on category, collect required information:

**For news/quick_take/spotlight:**
- Topic or URL to cover
- Any specific angle or focus

**For launch:**
- Product name
- Key features (3-4)
- Target audience
- Pricing (if applicable)
- Launch URL/link
- Any personal note from Marley

**For update:**
- App name (e.g., ShowedUp, SIPHIO)
- Features/fixes to announce (bullet list)
- Changelog URL

**For milestone:**
- Specific milestone (e.g., "1000 users", "$10K MRR")
- Brief story of how we got here
- What's next

**For case_study:**
- Client/project name (can be anonymized)
- The challenge they faced
- Solution we built
- Key results with numbers
- Client quote (optional)

**For announcement:**
- What we're announcing
- Key details
- Why it matters

### Step 3: Research Phase (News Categories Only)

**FOR NEWS/QUICK_TAKE/SPOTLIGHT ONLY:**

Before generating content, perform research using Grok's search capabilities:

1. **research_topic(query)** - Get broader context about the topic
   - Search for developer reviews, opinions, and context
   - Example: `"Cursor AI editor developer reviews 2025"`

2. **check_dev_sentiment(topic)** - Check what developers on X are saying
   - Search X for real developer reactions
   - Example: `"Claude 3.5 Sonnet developer reaction"`

3. **verify_claim(claim, source_type)** - Fact-check specific claims
   - Verify benchmarks, pricing, availability claims
   - Example: `"GPT-5 scores 95% on MATH-500", "web"`

**Research Decision:**
- If research reveals vaporware, old news rehash, overwhelmingly negative sentiment, or unverified claims → Skip posting, explain why
- If research confirms claims → Proceed with confident tone
- If research shows mixed sentiment → Proceed but note concerns
- If research is inconclusive → Proceed with hedged language

**SKIP RESEARCH for SIPHIO categories (launch, update, milestone, case_study, announcement)** - Marley is the source for these.

### Step 4: Generate Content

Using the SIPHIO brand voice and visual identity:

**Brand Voice:**
- Knowledgeable but approachable
- Warm, not robotic or corporate
- Concise and scannable
- Confident but not arrogant

**Brand Colors (for image prompts):**
- Background: Warm charcoal (#1C1917)
- Line art: Warm cream (#F3F0E9)
- Primary accent: Terracotta (#DA7756)
- Secondary accent: Mustard yellow (#F0B857)

**Image Prompt Formula:**
```
Warm charcoal background (#1C1917). Hand-drawn cream (#F3F0E9) line art depicting [SUBJECT]. Solid terracotta (#DA7756) organic blob shape [POSITION]. Mustard yellow (#F0B857) accent [ELEMENT]. Academic humanist illustration style. Imperfect, hand-sketched aesthetic. No text, no logos, no gradients.
```

**Confidence-Tiered Language (for news categories based on research):**
- **High confidence** (verified claims + positive sentiment): "This one's worth the noise"
- **Medium confidence** (mixed sentiment): "Worth watching, but [concern]"
- **Low confidence** (unverified): "They claim X, no verification yet"

Generate:
1. Tweet text (or thread for multi-tweet categories)
2. Image prompt following SIPHIO brand guidelines
3. Preview of full content
4. Research summary (for news categories)

### Step 5: Present for Approval

Display the generated content:

```
-------------------------------------------
PREVIEW: @siphioai post
-------------------------------------------

Category: [category]
Type: [Single tweet / Thread (N tweets)]

Tweet:
[Generated tweet text]

Image Prompt:
[Generated image prompt]

Research Summary (news categories only):
[Key findings from research tools]
-------------------------------------------
```

Ask: "Ready to post? (yes/edit/cancel)"

### Step 6: Post to X

If approved:
1. Generate image using fal.ai Nano Banana Pro
2. Upload image to X
3. Post tweet with image
4. Log to Supabase with content_category and source_type='manual_command'
5. Return confirmation with X post URL

If edit requested:
- Ask what to change
- Regenerate and return to Step 4

If cancelled:
- Confirm cancellation, offer to save draft

## Output

After successful post:

```
Posted to @siphioai!

URL: https://x.com/siphioai/status/[post_id]

Category: [category]
Source: manual_command
Image: [generated/none]

Logged to database.
```

## Notes

- This skill requires X API credentials and fal.ai API key
- For threads, posts are created sequentially with proper reply threading
- All content follows SIPHIO warm humanist brand identity
- Images use Nano Banana Pro model for consistent style
- Content is logged to Supabase for analytics and weekly roundup

## Quick Commands

```
/siphio-x-social-agent launch      # Product launch thread
/siphio-x-social-agent update      # Feature update post
/siphio-x-social-agent milestone   # Milestone celebration
/siphio-x-social-agent roundup     # Trigger weekly roundup
```
