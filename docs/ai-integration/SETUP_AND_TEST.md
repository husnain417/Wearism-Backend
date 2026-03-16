# Environment Setup and Testing Guide

## 🐍 Environment Setup

Based on your terminal output, you're using the `clothing_seg_env` environment. Here's how to set it up and test the model:

### 1. Activate the Environment

```bash
# Navigate to your project directory
cd ~/recomendation

# Activate the clothing segmentation environment
conda activate clothing_seg_env
# OR if using virtualenv:
# source clothing_seg_env/bin/activate
```

### 2. Install/Update Required Packages

The error shows that Gradio might be an older version. Update it:

```bash
# Update Gradio to latest version (supports theme parameter)
pip install --upgrade gradio

# If that doesn't work, install specific version
pip install gradio>=4.0.0

# Verify Gradio version
python -c "import gradio; print(gradio.__version__)"
```

### 3. Install Other Dependencies (if needed)

```bash
# Core dependencies
pip install opencv-python numpy pillow torch torchvision

# Gradio dependencies
pip install gradio

# If you need to install from requirements files
pip install -r requirements.txt  # if you have one
```

## 🚀 Testing Commands

### Option 1: Test via Web UI (Gradio)

```bash
# Make sure you're in the project root
cd ~/recomendation

# Activate environment
conda activate clothing_seg_env

# Run the Gradio app
python integrated_outfit_rating_app.py
```

**Expected Output:**
- Pipeline initialization messages
- "Pipeline ready!"
- A local URL like: `Running on local URL:  http://127.0.0.1:7860`
- Open this URL in your browser

### Option 2: Test via Command Line

```bash
# Activate environment
conda activate clothing_seg_env

# Navigate to project root
cd ~/recomendation

# Test with an image
python integrated_outfit_rating_pipeline.py path/to/your/outfit/image.jpg --season summer --occasion casual
```

**Example:**
```bash
python integrated_outfit_rating_pipeline.py test_images/outfit1.jpg --season summer --occasion casual
```

### Option 3: Test Individual Components

#### Test SAM Segmentation Only:
```bash
cd ~/recomendation/Segment_Model_SAM
python clothing_segmentation.py --image path/to/image.jpg --output output/
```

#### Test Fashion-CLIP Only:
```bash
cd ~/recomendation/fashion-clip
python fashionclip_pipeline.py path/to/image.jpg
```

## 🔧 Troubleshooting

### Issue: Gradio Theme Error

**Error:** `TypeError: BlockContext.__init__() got an unexpected keyword argument 'theme'`

**Solution:**
```bash
# Update Gradio
pip install --upgrade gradio

# OR use older syntax (already fixed in the code)
# The code now has a fallback for older Gradio versions
```

### Issue: Import Errors

**Error:** `attempted relative import beyond top-level package`

**Solution:**
```bash
# Make sure you're running from the project root
cd ~/recomendation
python integrated_outfit_rating_app.py
```

### Issue: CUDA/Device Errors

**Solution:**
- The pipeline auto-detects CUDA
- If you see device errors, check: `python -c "import torch; print(torch.cuda.is_available())"`
- Models will fall back to CPU if CUDA unavailable

### Issue: Model Files Not Found

**Check these paths exist:**
```bash
# SAM models
ls ~/recomendation/Segment_Model_SAM/models/mobile_sam.pt
ls ~/recomendation/Segment_Model_SAM/models/groundingdino_swint_ogc.pth

# Fashion-CLIP model
ls ~/recomendation/fashion-clip/hf_model/config.json
```

## 📋 Quick Test Checklist

- [ ] Environment activated (`clothing_seg_env`)
- [ ] Gradio updated (`pip install --upgrade gradio`)
- [ ] In project root directory (`~/recomendation`)
- [ ] Model files exist in expected locations
- [ ] Test image ready

## 🎯 Recommended Test Flow

1. **First, test CLI version** (simpler, faster feedback):
   ```bash
   python integrated_outfit_rating_pipeline.py test_image.jpg
   ```

2. **Then test Web UI**:
   ```bash
   python integrated_outfit_rating_app.py
   ```

3. **Check the output**:
   - Segmentation visualization
   - Item classifications
   - Rating scores
   - Feedback messages

## 📝 Environment Summary

**Current Environment:** `clothing_seg_env`

**Key Packages:**
- PyTorch (with CUDA support)
- Gradio (for web UI)
- OpenCV (for image processing)
- NumPy, PIL (for image handling)
- SAM models (MobileSAM, GroundingDINO)
- Fashion-CLIP model

**Device:** CUDA (GPU) - automatically detected

## 🐛 If Still Having Issues

1. **Check Python version:**
   ```bash
   python --version  # Should be 3.8+
   ```

2. **Check all imports:**
   ```bash
   python -c "from integrated_outfit_rating_pipeline import IntegratedOutfitRatingPipeline; print('OK')"
   ```

3. **Verify paths:**
   ```bash
   python -c "from pathlib import Path; print(Path('Segment_Model_SAM').exists())"
   ```

4. **Run with verbose output:**
   ```bash
   python integrated_outfit_rating_app.py 2>&1 | tee output.log
   ```





