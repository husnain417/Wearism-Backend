# How the Outfit Rating Pipeline Works

This document explains the full pipeline in simple words: what models are used, what each one does, and how the final rating is computed.

---

## 1. Overview: What Happens When You Upload a Photo

1. **You upload one photo** (e.g. a person wearing an outfit or a flat-lay of clothes).
2. **SAM (detection + segmentation)** finds each clothing item in the image and cuts it out.
3. **FashionCLIP** looks at each cut-out and says: “This is a shirt, it’s casual, it has stripes,” etc.
4. **Outfit Transformer** (optional) scores how well the items go together (compatibility).
5. **Rating modules** use all that information (plus simple rules) to give scores for color, patterns, formality, style, etc., and one overall score out of 10.

So: **one image → detected items → labels and attributes per item → compatibility (optional) → rule-based rating → final score and feedback.**

---

## 2. The Three Main Models

| Model | Role | Input | Output |
|-------|------|--------|--------|
| **SAM** (Grounding DINO + MobileSAM) | Find and cut out each clothing item | One full outfit image | Boxes, labels (e.g. “shirt”, “pants”), and a mask per item |
| **FashionCLIP** | Describe each item | Cropped image of one item | Main category, sub-category, attributes (e.g. “casual”, “striped”) |
| **Outfit Transformer** | How well items go together | All items (images + text) | One compatibility score (0–1) |

---

## 3. Pipeline Step by Step: SAM → FashionCLIP → Outfit Transformer

### Step 1: SAM (Detection + Segmentation)

**What it is**  
SAM here means two parts working together:

- **Grounding DINO**: an object detector that finds “things” in the image using text (e.g. “shirt”, “jacket”, “pants”, “shoes”, “accessories”).
- **MobileSAM**: a lighter version of Segment Anything that, for each detected box, draws a precise mask (which pixels belong to that item).

**What it does in the pipeline**

1. The pipeline sends your image to Grounding DINO with a list of clothing categories (shoes, pants, shirt, jacket, accessories).
2. Grounding DINO returns **bounding boxes** and **labels** (e.g. “shirt or top”, “pants or trousers”) and a **confidence** per box.
3. Boxes with confidence below a threshold (e.g. 0.45) are dropped.
4. For each kept box, MobileSAM is run to get a **mask** (which pixels are that item).
5. Each item is then **cropped** using its mask so we get a small image of just that piece of clothing (with black or padding where the rest of the image was).

**What you get after SAM**

- A list of **segmented items**: each has a label (e.g. “shirt”, “pants”), a confidence, a crop image, and a mask.  
- If **no** clothing is detected (e.g. you upload a cat photo), the pipeline stops and shows an error; FashionCLIP and Outfit Transformer are not run.

**Features of this “SAM” stage**

- Detects multiple items (e.g. shirt, pants, shoes, jacket).
- Gives one label per item (high-level: shirt, jacket, pants, footwear, accessories).
- Gives a mask so we only use pixels that belong to the item (not background).
- Runs on GPU if available, else CPU.

---

### Step 2: FashionCLIP (Classification + Attributes)

**What it is**  
FashionCLIP is a model trained to understand fashion images and text in the same “language” (like CLIP, but for fashion). It can:

- Compare an image to many text labels at once.
- Give scores for how well the image matches each label.

**What it does in the pipeline**

1. For **each cropped item** from SAM, the pipeline sends that crop (as an image) to FashionCLIP.
2. FashionCLIP compares the image to fixed sets of labels:
   - **Main categories** (e.g. top, bottom, outerwear, shoes, accessories).
   - **Sub-categories** (e.g. t-shirt, blazer, jeans, loafers).
   - **Attributes** (e.g. casual, striped, leather, fitted).
3. For each set, it returns the **top matches** (e.g. “t-shirt 0.9, blouse 0.2” and “casual 0.8, striped 0.6”).
4. The pipeline builds a short **text description** per item (e.g. “shirt, t-shirt, casual, striped”) from the top label and top attributes.

**What you get after FashionCLIP**

- For each item:
  - **Main category** (e.g. top, bottom).
  - **Sub-category** (e.g. t-shirt, jeans).
  - **Attributes** (e.g. casual, striped, cotton).
- A **description** string per item (used later by Outfit Transformer and by the rating logic).

**Features of FashionCLIP**

- No need to train it on your data; it works in a “zero-shot” way with fixed label sets.
- Gives both **categories** and **attributes**, so the rating can use “casual”, “blazer”, “shorts”, “striped”, etc.
- Text embeddings for labels are computed once and reused for speed.
- Images are processed in a **batch** for speed.
- Runs on GPU if available, else CPU.

---

### Step 3: Outfit Transformer (Compatibility, Optional)

**What it is**  
Outfit Transformer is a small network that takes the **set of items** (each as image + text) and outputs a single number: how compatible the outfit is (how well the pieces “go together”).

**What it does in the pipeline**

1. For each item we have: crop image + short description (from FashionCLIP).
2. The pipeline builds a list of **FashionItem** objects (image + description) for the whole outfit.
3. Outfit Transformer uses its **own CLIP-style encoder** to turn each item’s image and text into a vector, then runs a small “head” on top that predicts **compatibility** (0–1).
4. That number is turned into a 0–10 score and mixed into the overall rating (when a **trained checkpoint** is loaded).

**What you get**

- **Compatibility score** (0–1 from the model, shown as 0–10 in the UI).
- If **no trained checkpoint** is set, the model is not trusted and this score is **omitted** from the rating (so a random-looking low score does not drag the overall down).

**Features of Outfit Transformer**

- Uses **image + text** per item (the same descriptions FashionCLIP helped build).
- Trained to predict “do these items go together?”.
- Needs a **trained checkpoint** for meaningful scores; without it, the pipeline skips using this score in the overall rating.

---

## 4. How the Rating Modules Work

After SAM and FashionCLIP (and optionally Outfit Transformer), the pipeline has for each item:

- Crop **image** and **mask**
- **Tag** (e.g. “shirt t-shirt”)
- **Attributes** (e.g. casual, striped)
- **Main / sub category**

The **rating** step does not use neural networks. It uses **simple rules and small helpers** (extractors + scorers) that read colors, patterns, and textures from the images and use the tags and attributes to score different aspects of the outfit.

---

### 4.1 Extractors (Get Numbers from Images)

These take the **cropped images** (and masks) and produce simple numbers or lists:

| Extractor | What it does | Used for |
|-----------|----------------|----------|
| **Color extractor** | Runs k-means on the pixels (only on the mask) to find a few main colors per item. Returns RGB colors. | Color harmony |
| **Pattern detector** | Uses Laplacian (edge strength) on the image to get a “pattern strength” number per item (no pattern ≈ 0, strong pattern ≈ high). | Pattern coordination |
| **Texture analyzer** | Uses Sobel (gradient) to get a “texture” number per item. | Texture balance |
| **Layer detector** | Counts how many items are **not** accessories. | Layering |
| **Category detector** | Just passes through the tags (e.g. from SAM + FashionCLIP). | Formality / categories |

So: **images + masks** → **colors, pattern strengths, textures, layer count, tags**.

---

### 4.2 Rating Scorers (Turn Numbers into 0–10 Scores)

Each scorer takes the results from the extractors (and sometimes the **attributes** and **tags**) and returns a **score (0–10)** and sometimes a short reason.

| Scorer | What it uses | What it does in simple words |
|--------|----------------|------------------------------|
| **Color harmony** | List of colors from all items | Converts colors to hue/saturation; checks if they are monochromatic, analogous, complementary, etc.; counts neutrals; gives 0–10 and a harmony type. |
| **Layering** | Number of clothing layers (non-accessories) + “visual interest” (layers + colors) | Favors 4–5 layers; too few or too many is penalized. |
| **Proportions** | Number of items | Simple rule: 2–3+ items get a decent score; just 1 item is penalized. |
| **Pattern coordination** | Pattern strength per item + attributes (e.g. “striped”, “print”) | Rewards 0–1 strong patterns; penalizes many patterned items or “pattern” in attributes on multiple items. |
| **Texture balance** | Texture number per item | Rewards a mix of textures (not all flat, not all super busy). |
| **Formality consistency** | Tag + sub_category + main_category + attributes per item | Maps each item to a formality (e.g. blazer high, shorts low); if range is big (e.g. blazer + shorts), score is lowered. |
| **Seasonal appropriateness** | User season + colors + attributes | Checks if colors and attributes (e.g. wool, linen) fit the season (warm/cool, bright/muted). |
| **Weather appropriateness** | User weather + attributes | Checks for “good” attributes (e.g. linen for hot) and “bad” ones (e.g. puffer for hot). |
| **Accessory balance** | Number of accessories | Favors around 2–3 accessories (rule of 3). |
| **Occasion** | User occasion (e.g. formal, casual) | Scores how well the outfit fits the occasion; gives a target formality. |
| **Style coherence** | Formality alignment + color/pattern scores + **style clash** | Combines formality fit and color/pattern; if several **style archetypes** (e.g. bohemian + utilitarian + streetwear) appear together, applies a penalty. |
| **Compatibility** | Score from Outfit Transformer (if available) | Converts 0–1 to 0–10 and feeds into the overall score. |

So: **extractor outputs + attributes + tags + user inputs** → **one 0–10 score per dimension**.

---

### 4.3 Overall Score and Feedback

- Each dimension has a **weight** (e.g. color 0.15, layering 0.12, compatibility 0.13 when available).
- **Overall score** = weighted sum of all dimension scores (weights sum to 1.0).
- **Feedback** is built from rules, e.g.:
  - “Excellent color harmony” if color ≥ 8.5.
  - “Formality mismatch” if formality is low.
  - “Multiple patterned items can clash” if pattern score is low.
  - “Style clash detected: mixing X, Y, Z” if several clashing style archetypes are found.
  - “No trained checkpoint” if compatibility was omitted.

Nothing is hard-coded per outfit; the numbers come from the actual images and labels.

---

## 5. Summary Diagram (Simple)

```
[Your outfit image]
        ↓
   SAM (Grounding DINO + MobileSAM)
   → boxes, labels, masks, crops
        ↓
   FashionCLIP (per crop)
   → main category, sub-category, attributes, description
        ↓
   Outfit Transformer (optional, with trained checkpoint)
   → compatibility score 0–1
        ↓
   Rating modules
   → extractors: colors, pattern strength, texture, layer count
   → scorers: color harmony, layering, proportions, pattern, texture,
              formality, season, weather, accessories, occasion,
              style coherence, compatibility
        ↓
   Weighted sum + feedback
   → overall 0–10 + “Why you got these scores”
```

---

## 6. Where the Code Lives

- **Pipeline**: `integrated_outfit_rating_pipeline.py` (orchestrates SAM → FashionCLIP → OT → rating).
- **SAM**: `Segment_Model_SAM/clothing_segmentation.py` (Grounding DINO + MobileSAM).
- **FashionCLIP**: `fashion-clip/fashionclip_pipeline.py` and `fashion_clip/fashion_clip.py`.
- **Outfit Transformer**: `outfit-transformer/src/models/` (load and CLIP-based model).
- **Rating**: `outfit-transformer/src/rating/overall_scorer.py` (calls extractors and all scorers).
- **Extractors**: `outfit-transformer/src/extractors/` (color, pattern, texture, layer, category).
- **Scorers**: `outfit-transformer/src/rating/` (color_theory, layering_rules, pattern_mixing, formality_checker, etc.).
- **Knowledge**: `outfit-transformer/src/utils/fashion_knowledge.py` (formality tags, style keywords, style clashes).

This doc and the code use the same flow: **SAM → FashionCLIP → Outfit Transformer → Rating (extractors + scorers) → overall score and feedback.**
