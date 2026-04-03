# Unity WebGL Build Guide

One-time setup to make Trash Dash playable in the browser with live reskinning.

## Prerequisites
- Unity 2021.3.6f1 (or compatible LTS version) installed via Unity Hub
- The Trash Dash project cloned: `git clone https://github.com/Unity-Technologies/EndlessRunnerSampleGame.git`

## Step 1: Copy Scripts

Run this from the repo root:

```bash
# Copy C# scripts into Unity project
cp templates/unity-scripts/TextureSwapper.cs  <path-to-trash-dash>/Assets/Scripts/
cp templates/unity-scripts/SkinLoader.cs      <path-to-trash-dash>/Assets/Scripts/
cp templates/unity-scripts/GamePauser.cs      <path-to-trash-dash>/Assets/Scripts/

# Copy WebGL JavaScript bridge
mkdir -p <path-to-trash-dash>/Assets/Plugins/WebGL/
cp templates/unity-scripts/Plugins/WebGL/WebGLBridge.jslib <path-to-trash-dash>/Assets/Plugins/WebGL/
```

## Step 2: Scene Setup

1. Open Trash Dash in Unity Editor
2. Open the **Main** scene (`Assets/Scenes/Main.unity`)
3. Create an empty GameObject named **"TextureSwapper"**
4. Add these components to it:
   - `TextureSwapper` script
   - `SkinLoader` script
   - `GamePauser` script
5. The scripts use `DontDestroyOnLoad`, so they persist across scenes

## Step 3: Build for WebGL

1. Go to **File → Build Settings**
2. Switch platform to **WebGL**
3. In **Player Settings → WebGL**:
   - Compression Format: **Gzip**
   - Memory Size: **256**
   - Exception Support: **Explicitly Thrown Exceptions Only**
   - Name Resolution: **Embedded** (smaller build)
4. Click **Build**
5. Choose an output folder (e.g., `WebGLBuild/`)

## Step 4: Copy Build to Web Project

```bash
# Copy the Build folder (contains .data.gz, .framework.js.gz, .wasm.gz, .loader.js)
cp -r WebGLBuild/Build/ <path-to-reskin-pipeline>/web/frontend/public/unity/Build/

# Copy StreamingAssets if present
cp -r WebGLBuild/StreamingAssets/ <path-to-reskin-pipeline>/web/frontend/public/unity/StreamingAssets/ 2>/dev/null

# Replace the placeholder index.html with the real WebGL template
cp templates/unity-webgl/index.html <path-to-reskin-pipeline>/web/frontend/public/unity/index.html
```

> **Note:** Update the filenames in `unity/index.html` if your build output uses different names than `TrashDash.*`.

## Step 5: Deploy

```bash
cd <path-to-reskin-pipeline>
npx vercel --prod
```

The game is now playable at your Vercel URL with the Customize panel for live reskinning!

## File Size Notes

Expected WebGL build size: ~15-25MB compressed. Vercel serves `.gz` files with proper Content-Encoding headers automatically.
