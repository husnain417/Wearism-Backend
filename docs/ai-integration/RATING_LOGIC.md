# Outfit Rating System - Logic Documentation

This document explains the algorithms, techniques, and libraries used to determine each rating factor in the outfit evaluation system.

## Table of Contents

1. [Color Harmony](#color-harmony)
2. [Layering](#layering)
3. [Proportions](#proportions)
4. [Formality Consistency](#formality-consistency)
5. [Pattern Coordination](#pattern-coordination)
6. [Texture Balance](#texture-balance)
7. [Seasonal Appropriateness](#seasonal-appropriateness)
8. [Weather Appropriateness](#weather-appropriateness)
9. [Accessory Balance](#accessory-balance)
10. [Style Coherence](#style-coherence)
11. [Occasion Matching](#occasion-matching)
12. [Overall Score Calculation](#overall-score-calculation)

---

## Color Harmony

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 20% (highest weight)

### Technique: HSV Color Space Analysis + Color Theory

### Libraries Used:
- **OpenCV (cv2)**: Image processing and color extraction
- **NumPy**: Numerical operations for color calculations
- **Custom Color Wheel Module**: RGB to HSV conversion, hue distance calculation

### Algorithm:

1. **Color Extraction** (`extractors/color_extractor.py`):
   - Uses **K-Means Clustering** (OpenCV) to extract dominant colors from each clothing item
   - Resizes images to 224px for performance
   - Extracts up to 3 dominant colors per item
   - Converts BGR to RGB format

2. **Color Space Conversion** (`utils/color_wheel.py`):
   - Converts RGB colors to **HSV (Hue, Saturation, Value)** color space
   - Formula: `rgb_to_hsv()` - standard RGB to HSV conversion algorithm
   - HSV is preferred because hue represents the actual color, independent of brightness

3. **Neutral Color Detection**:
   - Identifies neutral colors (black, white, gray) using saturation and value thresholds:
     - `saturation < 0.15` OR `value < 0.15` (very dark) OR `value > 0.9` (very light)
   - Neutrals get special treatment as they "go with everything"

4. **Harmony Type Detection** (`rating/color_theory.py`):
   - Analyzes hue relationships to classify harmony type:
     - **Monochromatic**: Same hue family (hue distance < 30°)
     - **Analogous**: Adjacent hues on color wheel (hue distance < 30°)
     - **Complementary**: Opposite colors (hue distance ≈ 180° ± 25°)
     - **Triadic**: Three evenly spaced colors (120° apart ± 25°)
     - **Split Complementary**: One color + two adjacent to its complement
     - **Tetradic**: Four evenly spaced colors
     - **Mixed**: No clear harmony pattern

5. **Temperature Consistency**:
   - Classifies colors as "warm" (0-180°) or "cool" (180-360°)
   - Penalizes mixing warm and cool colors (multiplier: 0.7 if inconsistent)

6. **Scoring Formula**:
   ```python
   base_scores = {
       "monochromatic": 9.0,
       "analogous": 8.5,
       "complementary": 9.5,
       "split_complementary": 8.0,
       "triadic": 8.5,
       "tetradic": 7.5,
       "mixed": 6.5,
   }
   
   # Apply bonuses/penalties:
   score = base_score * temperature_consistency
   + distribution_bonus (0.5 if good contrast)
   + neutral_bonus (0.7 if ≥1 neutral color)
   + neutral_soft_cap (0.5 if mostly neutrals)
   - color_penalty (0.5 per color over 4)
   
   final_score = clamp(score, 0.0, 10.0)
   ```

### Key Features:
- **60-30-10 Rule Proxy**: Checks brightness distribution for visual balance
- **Neutral Color Bonus**: Black, white, gray, and denim get special treatment
- **Color Count Penalty**: More than 4 distinct colors reduces score

---

## Layering

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 15%

### Technique: Rule-Based Scoring (Rule of 7)

### Algorithm:

1. **Layer Detection** (`extractors/layer_detector.py`):
   - Counts distinct clothing layers (tops, outerwear, bottoms, accessories)
   - Identifies visual interest points (VIP) = layer_count + color_count

2. **Scoring Formula** (`rating/layering_rules.py`):
   ```python
   layer_score_map = {
       1: 5.0,   # Too simple
       2: 8.0,   # Good
       3: 10.0,  # Perfect (Rule of 7)
       4: 8.5,   # Good but getting complex
       5+: 6.0   # Too many layers
   }
   
   # Visual Interest Points (VIP) scoring:
   target_vip = 7
   if vip < 5: penalty = (5 - vip) * 0.5
   if vip > 9: penalty = (vip - 9) * 0.5
   vip_score = 10.0 - penalty
   
   final_score = 0.6 * layer_score + 0.4 * vip_score
   ```

### Key Features:
- **Rule of 7**: Optimal outfit has 3 layers with ~7 visual interest points
- **Visual Interest**: Combines layer count with color variety
- **Balance**: 60% weight on layer count, 40% on visual interest

---

## Proportions

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 15%

### Technique: Item Count Proxy

### Algorithm:

Since body measurements aren't available, the system uses item count as a proxy for proportion balance:

```python
if items_count <= 1:
    score = 6.0  # Too simple
elif items_count == 2:
    score = 8.5  # Good top-bottom balance
else:
    score = 8.0  # Layered outfit
```

### Key Features:
- **Simplified Approach**: Without body measurements, uses item count
- **Optimal**: 2 items (top + bottom) scores highest
- **Future Enhancement**: Could integrate body measurements for true proportion analysis

---

## Formality Consistency

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 10%

### Technique: Variance Analysis + Fashion Knowledge Base

### Libraries Used:
- **Fashion-CLIP Attributes**: Zero-shot classification attributes
- **Fashion Knowledge Base**: Predefined formality scores for categories

### Algorithm:

1. **Formality Scoring** (`rating/formality_checker.py`):
   - Maps clothing categories to formality scores (0.0 = very casual, 1.0 = very formal)
   - Uses Fashion-CLIP attributes to refine scores:
     ```python
     formality_keywords = {
         "black tie": 0.95,
         "formal": 0.95,
         "business": 0.8,
         "smart": 0.65,
         "casual": 0.4,
         "athletic": 0.25,
     }
     ```

2. **Variance Calculation**:
   ```python
   avg_formality = mean(all_item_formality_scores)
   variance = mean((score - avg)² for all scores)
   
   if variance < 0.01: score = 10.0  # Very consistent
   elif variance < 0.04: score = 8.0
   elif variance < 0.09: score = 6.0
   else: score = 4.0  # Inconsistent
   ```

### Key Features:
- **Dual Input**: Uses both category tags and Fashion-CLIP attributes
- **Variance-Based**: Measures consistency across items
- **Attribute Mapping**: Maps Fashion-CLIP attributes to formality levels

---

## Pattern Coordination

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 10%

### Technique: Laplacian Variance (Pattern Detection)

### Libraries Used:
- **OpenCV**: Laplacian operator for edge/texture detection
- **NumPy**: Numerical operations

### Algorithm:

1. **Pattern Strength Detection** (`extractors/pattern_detector.py`):
   ```python
   # Convert to grayscale
   gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
   
   # Apply Laplacian operator (detects edges/patterns)
   laplacian = cv2.Laplacian(gray, cv2.CV_64F)
   variance = laplacian.var()
   
   # Normalize to 0-1 scale
   pattern_strength = min(variance / 500.0, 1.0)
   ```

2. **Pattern Coordination Scoring** (`rating/pattern_mixing.py`):
   ```python
   strong_patterns = [p for p in pattern_strengths if p > 0.2]
   count = patterns with strength > 0.15
   
   if count == 0: base = 8.5  # No patterns (safe)
   elif count == 1: base = 9.0  # Single pattern (focused)
   elif count == 2: base = 7.5  # Two patterns (can work)
   else: base = 5.5  # Multiple patterns (competing)
   
   # Penalty for multiple strong patterns
   if count >= 2 and sum(strengths) > 1.2:
       base -= 1.0  # Strong patterns clash
   ```

### Key Features:
- **Laplacian Operator**: Detects edges/textures (higher variance = more pattern)
- **Pattern Count Logic**: Fewer patterns = better coordination
- **Strength Penalty**: Multiple strong patterns reduce score

---

## Texture Balance

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 10%

### Technique: Sobel Gradient Magnitude (Texture Analysis)

### Libraries Used:
- **OpenCV**: Sobel operator for gradient detection
- **NumPy**: Magnitude calculation

### Algorithm:

1. **Texture Score Calculation** (`extractors/texture_analyzer.py`):
   ```python
   # Convert to grayscale
   gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
   
   # Calculate gradients in X and Y directions
   grad_x = cv2.Sobel(gray, cv2.CV_32F, 1, 0, ksize=3)
   grad_y = cv2.Sobel(gray, cv2.CV_32F, 0, 1, ksize=3)
   
   # Calculate magnitude (texture intensity)
   magnitude = cv2.magnitude(grad_x, grad_y)
   texture_score = clip(magnitude.mean() / 50.0, 0, 1)
   ```

2. **Texture Balance Scoring** (`rating/texture_analysis.py`):
   ```python
   count = textures with score > 0.15
   avg_texture = mean(all_texture_scores)
   
   if count == 0: base = 6.0  # Flat (no texture)
   elif count == 1: base = 8.0  # Some texture
   elif count == 2: base = 9.0  # Balanced
   else: base = 8.0  # Rich texture
   
   final_score = base + (avg_texture - 0.3)
   ```

### Key Features:
- **Sobel Operator**: Detects texture by measuring gradient intensity
- **Balance Logic**: 2 textured items = optimal balance
- **Average Adjustment**: Adjusts score based on average texture intensity

---

## Seasonal Appropriateness

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 6%

### Technique: Color Palette Matching

### Algorithm:

1. **Season Palette Definition** (`utils/fashion_knowledge.py`):
   ```python
   SEASON_PALETTES = {
       "winter": ["navy", "black", "burgundy", "emerald", "charcoal"],
       "spring": ["peach", "coral", "yellow", "mint", "cream"],
       "summer": ["lavender", "rose", "sky", "white", "sand"],
       "fall": ["rust", "olive", "camel", "chocolate", "mustard"],
   }
   ```

2. **Scoring** (`rating/seasonal_rules.py`):
   ```python
   if season in SEASON_PALETTES:
       score = 8.0  # Season recognized
   else:
       score = 6.5  # Neutral/unspecified
   ```

### Key Features:
- **Color Palette Matching**: Checks if outfit colors match seasonal palettes
- **Simple Scoring**: Binary check (recognized vs. unspecified)

---

## Weather Appropriateness

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 4%

### Technique: Season-Weather Alignment Mapping

### Algorithm:

1. **Weather-Season Mapping** (`rating/overall_scorer.py`):
   ```python
   weather_map = {
       "hot": ["summer"],
       "warm": ["spring", "summer"],
       "mild": ["spring", "fall"],
       "cool": ["fall", "winter"],
       "cold": ["winter"],
   }
   ```

2. **Scoring Logic**:
   ```python
   if weather and season:
       if season in weather_map[weather]:
           score = 9.0  # Aligned
       else:
           score = 6.0  # Misaligned
   elif weather:
       score = 7.0  # Weather specified, season not
   else:
       score = 7.0  # Unspecified
   ```

### Key Features:
- **Alignment Check**: Verifies weather matches season
- **Default Score**: 7.0 if unspecified

---

## Accessory Balance

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 7%

### Technique: Rule of 3

### Algorithm:

1. **Accessory Counting**:
   - Counts items marked as `is_accessory = True`
   - Target: 3 accessories (Rule of 3)

2. **Scoring** (`rating/accessory_balance.py`):
   ```python
   ACCESSORY_TARGET = 3
   
   if count == ACCESSORY_TARGET: score = 9.0  # Perfect
   elif count == 0: score = 6.0  # Missing accessories
   elif count <= 2: score = 8.0  # Good
   elif count <= 4: score = 7.0  # Acceptable
   else: score = 4.5  # Too many
   ```

### Key Features:
- **Rule of 3**: Optimal number of accessories
- **Penalty for Excess**: Too many accessories reduces score

---

## Style Coherence

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** 5%

### Technique: Formality Alignment + Style Keyword Matching

### Algorithm:

1. **Formality Alignment**:
   ```python
   target_formality = occasion_target_formality
   avg_formality = outfit_average_formality
   formality_gap = abs(avg_formality - target_formality)
   formality_alignment = max(0.0, 10.0 - formality_gap * 12)
   ```

2. **Style Keyword Matching** (`utils/fashion_knowledge.py`):
   ```python
   STYLE_KEYWORDS = {
       "formal": ["formal", "evening wear", "business", "tailored"],
       "casual": ["casual", "t-shirt", "sneakers", "denim"],
       "streetwear": ["streetwear", "hoodie", "oversized", "sneakers"],
       "old_money": ["preppy", "cashmere", "polo", "loafers", "navy"],
       # ... more styles
   }
   
   # Check if outfit attributes match occasion style
   for style, keywords in STYLE_KEYWORDS:
       if style in occasion:
           if any(keyword in attributes for keyword in keywords):
               style_match += 1
           else:
               style_match -= 0.5
   ```

3. **Final Score**:
   ```python
   style_coherence = (
       0.4 * min(color_score, pattern_score) +
       0.6 * formality_alignment +
       style_keyword_bonus
   )
   ```

### Key Features:
- **Multi-Factor**: Combines color, pattern, formality, and style keywords
- **Occasion Matching**: Checks if outfit style matches occasion requirements
- **Keyword-Based**: Uses Fashion-CLIP attributes to match style archetypes

---

## Occasion Matching

**Score Range:** 0.0 - 10.0  
**Weight in Overall Score:** Included in Style Coherence

### Technique: Formality Target Mapping

### Algorithm:

1. **Occasion Formality Mapping** (`rating/occasion_matcher.py`):
   ```python
   OCCASION_FORMALITY = {
       "black_tie": 0.95,
       "formal": 0.9,
       "wedding": 0.85,
       "business": 0.75,
       "smart_casual": 0.6,
       "casual": 0.4,
       "streetwear": 0.4,
       "old_money": 0.75,
       # ... more occasions
   }
   ```

2. **Scoring**:
   ```python
   target_formality = OCCASION_FORMALITY.get(occasion, 0.5)
   base_score = 8.0  # Default if occasion recognized
   ```

### Key Features:
- **Formality Target**: Each occasion has a target formality level
- **Used in Style Coherence**: Occasion score feeds into style coherence calculation

---

## Overall Score Calculation

### Weighted Average Formula

The overall score is calculated as a weighted average of all factors:

```python
weights = {
    "color_harmony": 0.20,        # 20% - Most important
    "layering": 0.15,             # 15%
    "proportions": 0.15,          # 15%
    "formality_consistency": 0.10, # 10%
    "pattern_coordination": 0.10, # 10%
    "texture_balance": 0.10,      # 10%
    "seasonal_appropriateness": 0.06,  # 6%
    "weather_appropriateness": 0.04,   # 4%
    "accessory_balance": 0.07,    # 7%
    "style_coherence": 0.05,      # 5%
}

overall_score = sum(score[factor] * weight[factor] for all factors)
```

### Score Range
- **0.0 - 10.0**: Overall outfit rating
- **Target**: ~8.3/10 (83%) for well-coordinated outfits

---

## Technical Stack Summary

### Core Libraries:
1. **OpenCV (cv2)**: Image processing, color extraction, pattern/texture detection
2. **NumPy**: Numerical operations, array manipulation
3. **Fashion-CLIP**: Zero-shot classification for attributes and categories
4. **Custom Modules**: Color wheel, fashion knowledge base, extractors

### Key Techniques:
1. **K-Means Clustering**: Color extraction
2. **HSV Color Space**: Color analysis
3. **Laplacian Operator**: Pattern detection
4. **Sobel Operator**: Texture analysis
5. **Variance Analysis**: Formality consistency
6. **Rule-Based Scoring**: Layering, accessories, proportions
7. **Keyword Matching**: Style coherence

### Data Flow:
```
Images → Color/Pattern/Texture Extraction → Feature Analysis → 
Rule-Based Scoring → Weighted Average → Overall Score
```

---

## Example Calculation

For an outfit with:
- Color Harmony: 9.2
- Layering: 9.1
- Proportions: 8.0
- Formality: 10.0
- Pattern: 4.5
- Texture: 8.22
- Season: 6.5
- Weather: 7.0
- Accessories: 8.0
- Style: 7.8
- Occasion: 7.0

**Overall Score**:
```
= 9.2*0.20 + 9.1*0.15 + 8.0*0.15 + 10.0*0.10 + 4.5*0.10 + 
  8.22*0.10 + 6.5*0.06 + 7.0*0.04 + 8.0*0.07 + 7.8*0.05
= 1.84 + 1.365 + 1.2 + 1.0 + 0.45 + 0.822 + 0.39 + 0.28 + 0.56 + 0.39
= 8.457 ≈ 8.5/10
```

---

## Future Enhancements

1. **Body Measurements**: True proportion analysis
2. **Machine Learning**: Learn optimal weights from fashion expert ratings
3. **Context Awareness**: Location, time of day, cultural factors
4. **Personal Style**: User preference learning
5. **Advanced Pattern Recognition**: Deep learning for pattern classification
6. **Material Analysis**: Fabric type detection and compatibility

---

*Last Updated: 2024*

