# Commands Guide - Outfit Rating & Wardrobe Builder

This guide contains all commands to run both the **Outfit Rating** and **Wardrobe Builder** applications.

## 📋 Prerequisites

### 1. Activate Environment

```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
```

### 2. Install ngrok (Optional - for remote access)

```bash
pip install pyngrok
```

### 3. Set up ngrok Authtoken (Required for ngrok)

1. **Get your free authtoken:**
   - Visit: https://dashboard.ngrok.com/get-started/your-authtoken
   - Sign up for a free account (if needed)
   - Copy your authtoken

2. **Set the authtoken:**
   ```bash
   export NGROK_AUTHTOKEN='your_token_here'
   ```
   
   Or add to your `~/.bashrc` or `~/.zshrc`:
   ```bash
   echo "export NGROK_AUTHTOKEN='your_token_here'" >> ~/.bashrc
   source ~/.bashrc
   ```

**Note:** You can also use Gradio's built-in `--share` option as an alternative to ngrok (no setup required).

---

## 🎨 Outfit Rating App

### Local Access Only

```bash
python integrated_outfit_rating_app.py
```

**Access at:** `http://localhost:7860` or `http://0.0.0.0:7860`

### With ngrok (Public URL for Remote Access)

```bash
python integrated_outfit_rating_app.py --ngrok
```

This will:
- Start the app on port 7860
- Create a public ngrok URL (e.g., `https://abc123.ngrok.io`)
- Print the public URL in the terminal
- Share this URL to access from any device

### With Gradio Share (Alternative to ngrok)

```bash
python integrated_outfit_rating_app.py --share
```

This uses Gradio's built-in sharing (creates a temporary public URL).

### Custom Port

```bash
python integrated_outfit_rating_app.py --port 8080
python integrated_outfit_rating_app.py --port 8080 --ngrok  # With ngrok
```

---

## 🗂️ Wardrobe Builder App

### Local Access Only

```bash
python wardrobe_outfit_builder_app.py
```

**Access at:** `http://localhost:7862` or `http://0.0.0.0:7862`

### With ngrok (Public URL for Remote Access)

```bash
python wardrobe_outfit_builder_app.py --ngrok
```

This will:
- Start the app on port 7862
- Create a public ngrok URL (e.g., `https://xyz789.ngrok.io`)
- Print the public URL in the terminal
- Share this URL to access from any device

### With Gradio Share (Alternative to ngrok)

```bash
python wardrobe_outfit_builder_app.py --share
```

### Custom Port

```bash
python wardrobe_outfit_builder_app.py --port 8081
python wardrobe_outfit_builder_app.py --port 8081 --ngrok  # With ngrok
```

---

## 🚀 Quick Start Commands

### Run Both Apps Locally

**Terminal 1 (Rating App):**
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python integrated_outfit_rating_app.py
```

**Terminal 2 (Wardrobe Builder):**
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python wardrobe_outfit_builder_app.py
```

### Run Both Apps with ngrok (Remote Access)

**Terminal 1 (Rating App):**
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python integrated_outfit_rating_app.py --ngrok
```

**Terminal 2 (Wardrobe Builder):**
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python wardrobe_outfit_builder_app.py --ngrok
```

---

## 📱 Accessing from Other Devices

### Option 1: Using ngrok (Recommended)

1. Run the app with `--ngrok` flag
2. Copy the ngrok URL from terminal output (e.g., `https://abc123.ngrok.io`)
3. Open this URL on any device (phone, tablet, another computer)
4. The URL works as long as the app is running

**Note:** Free ngrok URLs change each time you restart. For permanent URLs, use ngrok's paid plan or set up a custom domain.

### Option 2: Using Gradio Share

1. Run the app with `--share` flag
2. Copy the Gradio share URL from terminal output
3. Open this URL on any device
4. The URL expires after 72 hours

### Option 3: Local Network Access

If devices are on the same network:

1. Find your machine's local IP:
   ```bash
   hostname -I  # Linux
   ipconfig getifaddr en0  # macOS
   ipconfig  # Windows (look for IPv4 Address)
   ```

2. Run app without ngrok:
   ```bash
   python integrated_outfit_rating_app.py
   ```

3. Access from other device:
   ```
   http://YOUR_LOCAL_IP:7860  # For rating app
   http://YOUR_LOCAL_IP:7862  # For wardrobe builder
   ```

---

## 🔧 Troubleshooting

### Port Already in Use

If you get a port error, use a different port:

```bash
python integrated_outfit_rating_app.py --port 8080
python wardrobe_outfit_builder_app.py --port 8081
```

### ngrok Not Working

1. **Check if pyngrok is installed:**
   ```bash
   pip install pyngrok
   ```

2. **Set ngrok authtoken (REQUIRED):**
   ```bash
   # Get token from: https://dashboard.ngrok.com/get-started/your-authtoken
   export NGROK_AUTHTOKEN='36gR2jzYxX6gM3tVCzSlqSpXggP_2ovQAtcJX7eGUqqYocHGE'
   ```

3. **Try Gradio share instead (no setup needed):**
   ```bash
   python integrated_outfit_rating_app.py --share
   ```

4. **Check firewall settings** - ngrok needs outbound internet access

5. **If you see "ngrok tunnel not found" error:**
   - Make sure you set the NGROK_AUTHTOKEN environment variable
   - Restart your terminal after setting the token
   - Try running with `--share` instead

### Module Import Errors

Make sure you're in the correct environment:

```bash
source Segment_Model_SAM/clothing_seg_env/bin/activate
```

### Can't Access from Other Devices

1. **Check if server is bound to 0.0.0.0** (already set in code)
2. **Check firewall** - ports 7860/7862 may be blocked
3. **Use ngrok** - bypasses firewall issues
4. **Check network** - devices must be on same network for local access

---

## 📊 App Details

### Outfit Rating App
- **Port:** 7860 (default)
- **Purpose:** Rate uploaded outfit images
- **Features:**
  - SAM segmentation
  - Fashion-CLIP classification
  - Detailed rating with analysis
  - Style/occasion/weather matching

### Wardrobe Builder App
- **Port:** 7862 (default)
- **Purpose:** Build and rate outfits from Polyvore dataset
- **Features:**
  - Auto-generate outfit combinations
  - Rate using same principles
  - Find best-rated outfits
  - Uses Polyvore dataset at `/home/zarnab/recomendation/outfit-transformer/datasets/polyvore`

---

## 🎯 Example Workflows

### Test Rating App Locally
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python integrated_outfit_rating_app.py
# Open http://localhost:7860 in browser
```

### Share Rating App with Team
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python integrated_outfit_rating_app.py --ngrok
# Share the ngrok URL from terminal output
```

### Test Wardrobe Builder
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python wardrobe_outfit_builder_app.py
# Open http://localhost:7862 in browser
# Set wardrobe path to: /home/zarnab/recomendation/outfit-transformer/datasets/polyvore
```

---

## 📝 Notes

- Both apps can run simultaneously on different ports
- ngrok URLs are temporary (free tier)
- For production, consider using a permanent domain with ngrok or deploying to a cloud service
- The wardrobe builder uses the Polyvore dataset by default
- All rating principles (color, patterns, formality, style, weather) are applied in both apps

---

## 🧪 Running Test Cases

### Hardcoded Test Cases (15 test cases)

Test color cohesion, pattern coordination, categories, and attributes:

```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate

# Option 1: Use the wrapper script (recommended)
python testcases/run_tests.py

# Option 2: Use the shell script
./run_tests.sh

# Option 3: Direct execution
python testcases/test_rating_system.py
```

**Important:** Always use `python` command, not direct execution!

**Test Cases Cover:**
- Color harmony (monochromatic, complementary, analogous, triadic)
- Pattern coordination (no patterns, single pattern, pattern clash)
- Formality consistency (formal, casual, mismatches)
- Style coherence (old money, streetwear, minimalist)
- Category and attribute matching

**Results saved to:** `testcases/test_results.txt`

**Expected Average Score:** ~8.3/10 (83%)

### Test Data Format

Test cases are defined in: `testcases/images/image.txt`

Format:
```
TC1_ITEM1|image_path|main_category|sub_category|attributes|sam_label|confidence
```

## 🚀 Run Both Apps Simultaneously

### Option 1: Simple Script (Recommended)

Run both apps with ngrok in one command:

```bash
cd ~/recomendation
./run_both_apps.sh
```

This will:
- Start both apps in the background
- Create ngrok tunnels for both
- Display both public URLs
- Keep running until you press Ctrl+C

### Option 2: Python Script (Better URL Detection)

```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python start_both_apps.py
```

### Option 3: Tmux Sessions (Separate Terminals)

Run both apps in separate tmux sessions so you can view each separately:

```bash
cd ~/recomendation
./run_both_apps_tmux.sh
```

Then attach to sessions:
```bash
tmux attach -t rating_app      # View Rating App
tmux attach -t wardrobe_app     # View Wardrobe App
```

### Option 4: Manual (Two Terminals)

**Terminal 1:**
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python integrated_outfit_rating_app.py --ngrok
```

**Terminal 2:**
```bash
cd ~/recomendation
source Segment_Model_SAM/clothing_seg_env/bin/activate
python wardrobe_outfit_builder_app.py --ngrok
```

## 🔗 Quick Reference

| App | Default Port | ngrok Command | Share Command |
|-----|-------------|---------------|----------------|
| Rating | 7860 | `--ngrok` | `--share` |
| Wardrobe | 7862 | `--ngrok` | `--share` |
| Tests | N/A | N/A | N/A |
| Both Apps | 7860, 7862 | `./run_both_apps.sh` | N/A |

