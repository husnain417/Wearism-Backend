# Integrated Outfit Rating Pipeline

A comprehensive outfit rating system that combines **SAM (Segment Anything Model)**, **Fashion-CLIP**, and **Outfit-Transformer** to provide detailed outfit analysis and ratings.

## 🎯 Overview

This pipeline automatically:
1. **Segments** clothing items from an outfit image using SAM (confidence > 0.45)
2. **Classifies** each item using Fashion-CLIP to extract:
   - Main categories
   - Sub-categories
   - Attributes
   - Text feature vectors
3. **Rates** the complete outfit using:
   - Outfit-Transformer compatibility prediction
   - Detailed rating module with fashion principles

## 🔄 Flow

```
Input Image
    ↓
SAM Segmentation (confidence > 0.45)
    ↓
Fashion-CLIP Classification (per item)
    ├── Main Category (from SAM)
    ├── Sub-Category (from Fashion-CLIP)
    ├── Attributes (from Fashion-CLIP)
    └── Text Feature Vector (from Fashion-CLIP)
    ↓
Outfit-Transformer
    ├── Compatibility Score
    └── Detailed Rating
        ├── Color Harmony
        ├── Layering (Rule of 7)
        ├── Pattern Coordination
        ├── Texture Balance
        ├── Formality Consistency
        ├── Seasonal Appropriateness
        ├── Accessory Balance
        └── Style Coherence
```

## 📋 Features

### SAM Segmentation
- Uses MobileSAM for fast segmentation
- GroundingDINO for detection
- Filters items by confidence threshold (> 0.45)
- Main categories: shirt, coat/jacket, pants, footwear, accessories

### Fashion-CLIP Classification
- Extracts main categories, sub-categories, and attributes
- Generates text feature vectors for each item
- Provides rich semantic descriptions

### Outfit-Transformer Rating
- **Compatibility Score**: 0-1 scale prediction
- **Detailed Rating**: 0-10 scale across multiple dimensions
- **Layering Analysis**: Considers the Rule of 7
- **Fashion Principles**: Applies color theory, pattern mixing, texture balance, etc.

## 🚀 Usage

### Command Line Interface

```bash
python integrated_outfit_rating_pipeline.py path/to/outfit.jpg --season summer --occasion casual
```

Options:
- `--season`: spring, summer, fall, winter
- `--occasion`: casual, formal, business, etc.
- `--sam-confidence`: Confidence threshold (default: 0.45)
- `--no-transformer`: Don't use outfit-transformer model

### Python API

```python
from integrated_outfit_rating_pipeline import IntegratedOutfitRatingPipeline

# Initialize pipeline
pipeline = IntegratedOutfitRatingPipeline(
    sam_confidence_threshold=0.45,
)

# Process an outfit
result = pipeline.process(
    image_input="path/to/outfit.jpg",
    season="summer",
    occasion="casual",
    use_outfit_transformer=True,
)

# Access results
print(f"Compatibility Score: {result['compatibility_score']}")
print(f"Overall Rating: {result['rating']['overall_score']}/10")
print(f"Items: {result['num_items']}")
```

### Gradio Web Interface

```bash
python integrated_outfit_rating_app.py
```

Then open your browser to `http://localhost:7860`

## 📊 Output Format

The pipeline returns a dictionary with:

```python
{
    "segmented_items": [
        {
            "index": 0,
            "sam_label": "shirt",
            "sam_confidence": 0.87,
            "main_category": "tops",
            "sub_category": "t-shirt",
            "top_attributes": ["cotton", "casual", "short sleeve"],
            "description": "shirt, t-shirt, cotton, casual, short sleeve"
        },
        # ... more items
    ],
    "compatibility_score": 0.823,  # 0-1 scale
    "rating": {
        "overall_score": 8.5,  # 0-10 scale
        "breakdown": {
            "color_harmony": {"score": 9.2},
            "layering": {"score": 8.0},
            # ... more dimensions
        },
        "feedback": [
            "✅ Excellent complementary color harmony",
            "✅ Strong layering and visual interest"
        ],
        "strengths": ["color_harmony", "layering"],
        "improvements": []
    },
    "num_items": 5,
    "layering_count": 4  # Excluding accessories
}
```

## 🎨 Rating Dimensions

The rating module evaluates outfits across:

1. **Color Harmony** (20% weight)
   - Monochromatic, analogous, complementary, triadic schemes
   - Temperature consistency
   - 60-30-10 rule

2. **Layering** (15% weight)
   - Rule of 7: 2-3 layers, 5-9 visual interest points
   - Balance between simplicity and complexity

3. **Proportions** (15% weight)
   - Item count and balance
   - Silhouette considerations

4. **Formality Consistency** (10% weight)
   - Matching formality levels across items

5. **Pattern Coordination** (10% weight)
   - 0-1 patterns preferred
   - Scale variation when multiple patterns

6. **Texture Balance** (10% weight)
   - 2-3 noticeable textures
   - Mix of flat and textured

7. **Seasonal Appropriateness** (8% weight)
   - Matching season requirements

8. **Accessory Balance** (7% weight)
   - Appropriate accessory count

9. **Style Coherence** (5% weight)
   - Overall style consistency

## 🔧 Requirements

The pipeline requires:
- SAM models (MobileSAM + GroundingDINO)
- Fashion-CLIP model
- Outfit-Transformer (optional, for compatibility scores)
- All dependencies from the respective projects

## 📁 Project Structure

```
recomendation/
├── integrated_outfit_rating_pipeline.py  # Main pipeline
├── integrated_outfit_rating_app.py      # Gradio interface
├── Segment_Model_SAM/                   # SAM segmentation
├── fashion-clip/                        # Fashion-CLIP classification
└── outfit-transformer/                  # Outfit rating
```

## 🎯 Key Features

### Confidence Filtering
Only items with SAM confidence > 0.45 are processed, ensuring high-quality segmentation.

### Text Feature Vectors
Each segmented item gets a 512-dimensional text feature vector from Fashion-CLIP, providing rich semantic context.

### Layering Analysis
The system properly counts layers (excluding accessories) and applies the Rule of 7 for visual interest.

### Comprehensive Rating
Combines multiple fashion principles to provide honest, detailed ratings with actionable feedback.

## 💡 Tips

1. **Image Quality**: Use clear, well-lit outfit photos for best results
2. **Confidence Threshold**: Adjust `sam_confidence_threshold` if too many/few items are detected
3. **Season/Occasion**: Providing these helps with more accurate ratings
4. **Layering**: The system automatically detects layering, but ensure items are clearly visible

## 🐛 Troubleshooting

- **No items detected**: Lower the confidence threshold or check image quality
- **Import errors**: Ensure all project paths are correctly set in the pipeline
- **Model loading errors**: Check that model checkpoints are in the expected locations

## 📝 Notes

- The pipeline processes items in parallel for efficiency
- Text feature vectors are extracted for each item but currently stored in metadata
- The outfit-transformer model is optional; the rating module works independently
- All processing respects the confidence threshold to ensure quality





