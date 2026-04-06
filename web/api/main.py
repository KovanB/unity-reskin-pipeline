"""FastAPI application — Unity reskin pipeline web API.

Uses real assets from Unity's Endless Runner Sample Game (Trash Dash).
"""

from __future__ import annotations

import asyncio
import json
import shutil
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse

from .jobs import create_job, get_job, get_job_dir, list_jobs
from .models import CreateJobRequest, JobListResponse, JobProgress, JobStatus

app = FastAPI(title="Unity Reskin Pipeline", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATA_ROOT = Path(os.environ.get("DATA_DIR", "/tmp/unity-reskin-data"))
DATA_ROOT.mkdir(parents=True, exist_ok=True)
(DATA_ROOT / "jobs").mkdir(parents=True, exist_ok=True)
(DATA_ROOT / "uploads").mkdir(parents=True, exist_ok=True)

# Path to bundled real Unity assets from Trash Dash
DEMO_ASSETS = Path(__file__).parent.parent.parent / "templates" / "demo_project"


def _get_demo_dir() -> Path:
    """Return the demo project path. Uses bundled real Unity assets."""
    if DEMO_ASSETS.exists() and (DEMO_ASSETS / "Assets").exists():
        return DEMO_ASSETS
    # Fallback: copy to temp if needed for write access
    demo_dir = DATA_ROOT / "demo_project"
    if not demo_dir.exists() and DEMO_ASSETS.exists():
        shutil.copytree(DEMO_ASSETS, demo_dir)
    return demo_dir if demo_dir.exists() else DEMO_ASSETS


# Asset categories matching the real Trash Dash structure
DEMO_CATEGORIES = {
    "Characters": {
        "label": "Characters",
        "description": "Playable character skins — Cat, Dog, Raccoon",
        "path": "Characters",
        "recurse": True,
    },
    "Obstacles": {
        "label": "Obstacles",
        "description": "Trashcans, dumpsters, cars — things the player dodges",
        "path": "Obstacles",
    },
    "Collectibles": {
        "label": "Coins & Collectibles",
        "description": "Fishbones, sardines — items the player collects",
        "path": "Collectibles",
    },
    "Graffiti": {
        "label": "Graffiti (Wall Art)",
        "description": "Street art textures on walls — the most visually impactful to reskin",
        "path": "Environment/Graffiti",
    },
    "Environment": {
        "label": "Environment",
        "description": "Trees, props, background elements",
        "path": "Environment",
        "exclude_subdirs": True,  # Don't include Graffiti subdir
    },
    "UI": {
        "label": "UI Elements",
        "description": "Game logo, store icon, UI sprite sheet, borders",
        "path": "UI",
    },
    "Particles": {
        "label": "Particles & Effects",
        "description": "Hearts, sparks, smoke, sparkles, stars",
        "path": "Particles",
    },
}


# ──────────────────────────── REST endpoints ────────────────────────────────

@app.get("/api/demo/info")
async def api_demo_info():
    """Return info about the demo project and all available textures."""
    demo = _get_demo_dir()
    assets_dir = demo / "Assets"

    categories = {}
    all_textures = []

    for cat_id, cat_info in DEMO_CATEGORIES.items():
        cat_dir = assets_dir / cat_info["path"]
        if not cat_dir.exists():
            continue

        textures = []
        if cat_info.get("recurse"):
            # Scan subdirectories (e.g. Characters/Cat/CatAlbedo.png)
            for png in sorted(cat_dir.rglob("*.png")):
                rel = png.relative_to(assets_dir)
                textures.append({
                    "name": png.stem,
                    "filename": png.name,
                    "category": cat_id,
                    "url": f"/api/demo/texture/{rel.as_posix()}",
                })
        else:
            for png in sorted(cat_dir.glob("*.png")):
                textures.append({
                    "name": png.stem,
                    "filename": png.name,
                    "category": cat_id,
                    "url": f"/api/demo/texture/{cat_info['path']}/{png.name}",
                })

        categories[cat_id] = {
            "label": cat_info["label"],
            "description": cat_info["description"],
            "count": len(textures),
            "textures": textures,
        }
        all_textures.extend(textures)

    return {
        "project": "Unity Endless Runner (Trash Dash)",
        "source": "github.com/Unity-Technologies/EndlessRunnerSampleGame",
        "license": "Unity Companion License",
        "total_textures": len(all_textures),
        "categories": categories,
    }


@app.get("/api/demo/texture/{path:path}")
async def api_demo_texture(path: str):
    """Serve a demo texture file."""
    demo = _get_demo_dir()
    file_path = demo / "Assets" / path
    if not file_path.exists() or not file_path.suffix.lower() == ".png":
        raise HTTPException(404, "Texture not found")
    return FileResponse(file_path, media_type="image/png")


@app.get("/api/skins")
async def api_list_skins():
    """List all permanently baked skins."""
    skins_dir = DATA_ROOT / "skins"
    if not skins_dir.exists():
        return {"skins": []}

    skins = []
    for skin_dir in sorted(skins_dir.iterdir()):
        if not skin_dir.is_dir():
            continue
        manifest_path = skin_dir / "manifest.json"
        if manifest_path.exists():
            from unity_reskin.utils import load_json
            manifest = load_json(manifest_path)
            # Build texture URLs
            textures = {}
            for cat, tex_list in manifest.get("textures", {}).items():
                textures[cat] = []
                for tex_name in tex_list:
                    textures[cat].append({
                        "name": tex_name,
                        "url": f"/api/skins/{skin_dir.name}/{cat}/{tex_name}.png",
                    })
            manifest["textures"] = textures
            skins.append(manifest)

    return {"skins": skins}


@app.get("/api/skins/{skin_id}/{path:path}")
async def api_skin_texture(skin_id: str, path: str):
    """Serve a permanently baked skin texture."""
    file_path = DATA_ROOT / "skins" / skin_id / path
    if not file_path.exists():
        raise HTTPException(404, "Skin texture not found")
    return FileResponse(file_path, media_type="image/png")


@app.get("/api/skins/{skin_id}/download")
async def api_skin_download(skin_id: str):
    """Download a baked skin as a zip."""
    skin_dir = DATA_ROOT / "skins" / skin_id
    if not skin_dir.exists():
        raise HTTPException(404, "Skin not found")

    zip_path = DATA_ROOT / "skins" / f"{skin_id}"
    if not Path(f"{zip_path}.zip").exists():
        shutil.make_archive(str(zip_path), "zip", skin_dir)

    return FileResponse(f"{zip_path}.zip", media_type="application/zip", filename=f"{skin_id}.zip")


@app.post("/api/bake-skin")
async def api_bake_skin(
    skin_id: str = "dracula",
    style_prompt: str = "Dracula gothic horror",
    strength: float = 0.80,
    category: str = "Graffiti",
):
    """
    Permanently bake a skin for a specific category.
    Lucy runs ONCE, results saved as permanent assets.
    If already baked, returns cached immediately.
    """
    import base64, io

    skins_dir = DATA_ROOT / "skins" / skin_id
    manifest_path = skins_dir / "manifest.json"

    cat_info = DEMO_CATEGORIES.get(category)
    if not cat_info:
        async def err():
            yield json.dumps({"type": "status", "message": f"Unknown category: {category}", "cls": "error"}) + "\n"
        return StreamingResponse(err(), media_type="application/x-ndjson")

    # Check if this skin+category is already baked
    if manifest_path.exists():
        from unity_reskin.utils import load_json
        manifest = load_json(manifest_path)
        if category in manifest.get("textures", {}):
            async def cached():
                yield json.dumps({"type": "status", "message": f"Skin '{skin_id}/{category}' already baked — serving cached"}) + "\n"

                for tex_name in manifest["textures"][category]:
                    tex_path = skins_dir / category / f"{tex_name}.png"
                    orig_dir = _get_demo_dir() / "Assets" / cat_info["path"]
                    orig_path = orig_dir / f"{tex_name}.png"

                    if tex_path.exists():
                        def to_b64(p):
                            with open(p, "rb") as f:
                                return base64.b64encode(f.read()).decode()

                        from PIL import Image as PILImage
                        img = PILImage.open(tex_path)

                        yield json.dumps({
                            "type": "card", "texture": tex_name, "category": category,
                            "original": to_b64(orig_path) if orig_path.exists() else "",
                            "reskinned": to_b64(tex_path),
                            "width": img.width, "height": img.height, "cached": True,
                        }) + "\n"

                yield json.dumps({"type": "done", "message": f"Skin '{skin_id}' ready!", "skin_id": skin_id}) + "\n"

            return StreamingResponse(cached(), media_type="application/x-ndjson")

    # Generate new skin
    async def bake():
        import yaml

        demo_dir = _get_demo_dir()
        cat_dir = demo_dir / "Assets" / cat_info["path"]

        if not cat_dir.exists():
            yield json.dumps({"type": "status", "message": f"Category dir not found: {cat_dir}", "cls": "error"}) + "\n"
            return

        api_key = os.environ.get("LUCY_API_KEY", "")
        if not api_key:
            yield json.dumps({"type": "status", "message": "LUCY_API_KEY not set — set it in Vercel env vars", "cls": "error"}) + "\n"
            return

        config_data = {
            "name": skin_id,
            "style_prompt": style_prompt,
            "backend": "lucy",
            "unity_project_path": str(demo_dir),
            "output_dir": str(DATA_ROOT / "tmp_bake"),
            "categories": ["characters"],
            "quality": {"strength": strength, "guidance_scale": 7.5, "steps": 30,
                        "preserve_pbr": True, "tile_seam_fix": True, "consistency_pass": False},
            "api_key": api_key,
        }

        config_path = DATA_ROOT / "tmp_bake" / "config.yaml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(config_data, f)

        from unity_reskin.config import load_config
        from unity_reskin.generator import get_backend
        from unity_reskin.utils import load_image, save_image

        config = load_config(config_path)
        gen_backend = get_backend(config)

        textures = sorted(cat_dir.glob("*.png"))
        total = len(textures)
        baked_names = []

        yield json.dumps({"type": "status", "message": f"Baking '{skin_id}/{category}' — {total} textures with Lucy..."}) + "\n"

        out_dir = skins_dir / category
        out_dir.mkdir(parents=True, exist_ok=True)

        for i, tex_path in enumerate(textures):
            yield json.dumps({"type": "status", "message": f"({i+1}/{total}) {tex_path.stem}..."}) + "\n"

            try:
                source = load_image(tex_path)
                asset_info = {"relative_path": str(tex_path.relative_to(demo_dir / "Assets")), "category": category}
                result = await asyncio.to_thread(gen_backend.generate, source, style_prompt, [], asset_info)

                out_path = out_dir / tex_path.name
                save_image(result, out_path)
                baked_names.append(tex_path.stem)

                def to_b64(img):
                    buf = io.BytesIO()
                    img.convert("RGB").save(buf, format="PNG")
                    return base64.b64encode(buf.getvalue()).decode()

                yield json.dumps({
                    "type": "card", "texture": tex_path.stem, "category": category,
                    "width": source.width, "height": source.height,
                    "original": to_b64(source), "reskinned": to_b64(result),
                }) + "\n"

            except Exception as e:
                yield json.dumps({"type": "status", "message": f"Error on {tex_path.stem}: {e}", "cls": "error"}) + "\n"

        # Save/update manifest
        from unity_reskin.utils import save_json, load_json
        if manifest_path.exists():
            manifest = load_json(manifest_path)
        else:
            manifest = {"skin_id": skin_id, "style_prompt": style_prompt, "strength": strength, "textures": {}}

        manifest["textures"][category] = baked_names
        save_json(manifest, manifest_path)

        yield json.dumps({"type": "done", "message": f"Skin '{skin_id}/{category}' baked! {len(baked_names)} textures saved.", "skin_id": skin_id}) + "\n"

    return StreamingResponse(bake(), media_type="application/x-ndjson")


# ──────────────────────────── Single-texture bake (for customize panel) ───────

@app.post("/api/bake-single")
async def api_bake_single(
    element: str = "Graffiti01",
    style_prompt: str = "Dracula gothic horror",
    strength: float = 0.80,
):
    """
    Generate ONE reskinned texture via Lucy. Returns streaming NDJSON with
    a single before/after card. Does NOT persist — user must call /api/approve.
    """
    import base64, io

    async def generate_single():
        demo_dir = _get_demo_dir()

        # Find the original texture file
        tex_path = None

        # Check bundled 3D model textures first (e.g. fox_texture.png)
        models_dir = Path(__file__).parent.parent.parent / "web" / "frontend" / "public" / "models"
        candidate = models_dir / f"{element}.png"
        if candidate.exists():
            tex_path = candidate

        # Then check demo project assets
        if not tex_path:
            for cat_id, cat_info in DEMO_CATEGORIES.items():
                cat_dir = demo_dir / "Assets" / cat_info["path"]
                candidate = cat_dir / f"{element}.png"
                if candidate.exists():
                    tex_path = candidate
                    break
                if cat_info.get("recurse"):
                    for match in cat_dir.rglob(f"{element}.png"):
                        tex_path = match
                        break
                if tex_path:
                    break

        if not tex_path:
            yield json.dumps({"type": "status", "message": f"Element '{element}' not found", "cls": "error"}) + "\n"
            return

        api_key = os.environ.get("LUCY_API_KEY", "")
        if not api_key:
            yield json.dumps({"type": "status", "message": "LUCY_API_KEY not set", "cls": "error"}) + "\n"
            return

        yield json.dumps({"type": "status", "message": f"Generating {element}..."}) + "\n"

        try:
            import yaml
            config_data = {
                "name": "single_bake",
                "style_prompt": style_prompt,
                "backend": "lucy",
                "unity_project_path": str(demo_dir),
                "output_dir": str(DATA_ROOT / "tmp_single"),
                "categories": ["characters"],
                "quality": {"strength": strength, "guidance_scale": 7.5, "steps": 30,
                            "preserve_pbr": True, "tile_seam_fix": True, "consistency_pass": False},
                "api_key": api_key,
            }
            config_path = DATA_ROOT / "tmp_single" / "config.yaml"
            config_path.parent.mkdir(parents=True, exist_ok=True)
            with open(config_path, "w") as f:
                yaml.dump(config_data, f)

            from unity_reskin.config import load_config
            from unity_reskin.generator import get_backend
            from unity_reskin.utils import load_image

            config = load_config(config_path)
            gen_backend = get_backend(config)

            source = load_image(tex_path)
            try:
                rel_path = str(tex_path.relative_to(demo_dir / "Assets"))
            except ValueError:
                rel_path = tex_path.name
            asset_info = {"relative_path": rel_path, "category": "single"}
            result = await asyncio.to_thread(gen_backend.generate, source, style_prompt, [], asset_info)

            def to_b64(img):
                buf = io.BytesIO()
                img.convert("RGB").save(buf, format="PNG")
                return base64.b64encode(buf.getvalue()).decode()

            yield json.dumps({
                "type": "card",
                "element": element,
                "width": source.width, "height": source.height,
                "original": to_b64(source),
                "reskinned": to_b64(result),
            }) + "\n"

            yield json.dumps({"type": "done", "message": f"{element} generated!"}) + "\n"

        except Exception as e:
            yield json.dumps({"type": "status", "message": f"Error: {e}", "cls": "error"}) + "\n"

    return StreamingResponse(generate_single(), media_type="application/x-ndjson")


@app.post("/api/approve")
async def api_approve(
    skin_id: str = "custom",
    element: str = "Graffiti01",
    category: str = "Graffiti",
    base64_png: str = "",
    request: Request = None,
):
    """
    Persist an approved texture. Pass base64_png as query param or raw body.
    Saves to DATA_ROOT/skins/{skin_id}/{category}/{element}.png
    """
    import base64

    # Read from body if not in query params
    if not base64_png and request:
        base64_png = (await request.body()).decode("utf-8").strip()

    if not base64_png:
        return {"error": "base64_png is required"}

    skins_dir = DATA_ROOT / "skins" / skin_id / category
    skins_dir.mkdir(parents=True, exist_ok=True)

    png_bytes = base64.b64decode(base64_png)
    out_path = skins_dir / f"{element}.png"
    with open(out_path, "wb") as f:
        f.write(png_bytes)

    # Update manifest
    from unity_reskin.utils import save_json, load_json
    manifest_path = DATA_ROOT / "skins" / skin_id / "manifest.json"
    if manifest_path.exists():
        manifest = load_json(manifest_path)
    else:
        manifest = {"skin_id": skin_id, "textures": {}}

    if category not in manifest["textures"]:
        manifest["textures"][category] = []
    if element not in manifest["textures"][category]:
        manifest["textures"][category].append(element)
    save_json(manifest, manifest_path)

    return {"status": "saved", "path": str(out_path)}


@app.get("/api/skins/active")
async def api_active_skins(skin_id: str = "custom"):
    """
    Return all saved skin textures as base64 for Unity startup loading.
    Returns a JSON object mapping elementId -> base64Png.
    """
    import base64

    skins_dir = DATA_ROOT / "skins" / skin_id
    manifest_path = skins_dir / "manifest.json"

    if not manifest_path.exists():
        return {"skin_id": skin_id, "textures": {}}

    from unity_reskin.utils import load_json
    manifest = load_json(manifest_path)

    textures = {}
    for category, elements in manifest.get("textures", {}).items():
        for elem in elements:
            tex_path = skins_dir / category / f"{elem}.png"
            if tex_path.exists():
                with open(tex_path, "rb") as f:
                    textures[elem] = base64.b64encode(f.read()).decode()

    return {"skin_id": skin_id, "textures": textures}


# ──────────────────────────── Meshy Retexture (3D-aware texturing) ──────────

@app.post("/api/retexture")
async def api_retexture(
    style_prompt: str = "red samurai armor",
):
    """
    Retexture the character model via Meshy.ai.
    Uploads the GLB, sends a text prompt, polls for result.
    Returns streaming NDJSON with progress and final model URL.
    """
    import base64
    import httpx
    import time

    meshy_key = os.environ.get("MESHY_API_KEY", "")
    if not meshy_key:
        async def err():
            yield json.dumps({"type": "error", "message": "MESHY_API_KEY not set — add it in Vercel env vars"}) + "\n"
        return StreamingResponse(err(), media_type="application/x-ndjson")

    async def retexture_stream():
        # Read the GLB model file
        model_path = Path(__file__).parent.parent.parent / "web" / "frontend" / "public" / "models" / "character.glb"
        if not model_path.exists():
            yield json.dumps({"type": "error", "message": "character.glb not found"}) + "\n"
            return

        with open(model_path, "rb") as f:
            model_bytes = f.read()
        model_b64 = base64.b64encode(model_bytes).decode()
        model_data_uri = f"data:application/octet-stream;base64,{model_b64}"

        yield json.dumps({"type": "status", "message": "Uploading model to Meshy..."}) + "\n"

        headers = {
            "Authorization": f"Bearer {meshy_key}",
            "Content-Type": "application/json",
        }

        # Create retexture task
        payload = {
            "model_url": model_data_uri,
            "text_style_prompt": style_prompt,
            "enable_original_uv": True,
            "enable_pbr": True,
            "target_formats": ["glb"],
        }

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(
                "https://api.meshy.ai/openapi/v1/retexture",
                headers=headers,
                json=payload,
            )
            if resp.status_code != 202:
                yield json.dumps({"type": "error", "message": f"Meshy API error {resp.status_code}: {resp.text}"}) + "\n"
                return

            task_id = resp.json().get("result")
            if not task_id:
                yield json.dumps({"type": "error", "message": f"No task ID returned: {resp.text}"}) + "\n"
                return

        yield json.dumps({"type": "status", "message": f"Processing (task {task_id[:8]}...)", "task_id": task_id}) + "\n"

        # Poll for completion
        async with httpx.AsyncClient(timeout=30) as client:
            for attempt in range(120):  # Max ~10 minutes
                await asyncio.sleep(5)

                poll_resp = await client.get(
                    f"https://api.meshy.ai/openapi/v1/retexture/{task_id}",
                    headers={"Authorization": f"Bearer {meshy_key}"},
                )
                if poll_resp.status_code != 200:
                    yield json.dumps({"type": "error", "message": f"Poll error: {poll_resp.status_code}"}) + "\n"
                    return

                task = poll_resp.json()
                status = task.get("status", "")
                progress = task.get("progress", 0)

                if status == "IN_PROGRESS":
                    yield json.dumps({"type": "status", "message": f"Generating texture... {progress}%", "progress": progress}) + "\n"
                elif status == "SUCCEEDED":
                    model_urls = task.get("model_urls", {})
                    texture_urls = task.get("texture_urls", [])
                    glb_url = model_urls.get("glb", "")

                    yield json.dumps({
                        "type": "done",
                        "message": "Retexture complete!",
                        "model_url": glb_url,
                        "texture_urls": texture_urls,
                        "task_id": task_id,
                    }) + "\n"
                    return
                elif status == "FAILED":
                    yield json.dumps({"type": "error", "message": f"Meshy task failed: {task.get('task_error', {}).get('message', 'Unknown error')}"}) + "\n"
                    return

        yield json.dumps({"type": "error", "message": "Timeout waiting for Meshy result"}) + "\n"

    return StreamingResponse(retexture_stream(), media_type="application/x-ndjson")


@app.post("/api/retexture/save")
async def api_retexture_save(
    skin_id: str = "custom",
    model_url: str = "",
):
    """
    Download a retextured model from Meshy and save it permanently.
    """
    import httpx

    if not model_url:
        raise HTTPException(400, "model_url is required")

    skins_dir = DATA_ROOT / "skins" / skin_id
    skins_dir.mkdir(parents=True, exist_ok=True)

    # Download the GLB
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.get(model_url)
        resp.raise_for_status()

    out_path = skins_dir / "character.glb"
    with open(out_path, "wb") as f:
        f.write(resp.content)

    return {"status": "saved", "skin_id": skin_id, "path": str(out_path), "size": len(resp.content)}


@app.get("/api/retexture/skins")
async def api_retexture_skins():
    """List all saved retextured skins."""
    skins_dir = DATA_ROOT / "skins"
    if not skins_dir.exists():
        return {"skins": []}

    skins = []
    for d in sorted(skins_dir.iterdir()):
        if d.is_dir() and (d / "character.glb").exists():
            skins.append({
                "skin_id": d.name,
                "model_url": f"/api/retexture/skins/{d.name}/model",
            })
    return {"skins": skins}


@app.get("/api/retexture/skins/{skin_id}/model")
async def api_retexture_skin_model(skin_id: str):
    """Serve a saved retextured model."""
    model_path = DATA_ROOT / "skins" / skin_id / "character.glb"
    if not model_path.exists():
        raise HTTPException(404, "Skin not found")
    return FileResponse(model_path, media_type="model/gltf-binary", filename=f"{skin_id}.glb")


# ──────────────────────────── Job endpoints (advanced mode) ──────────────────

@app.post("/api/jobs")
async def api_create_job(req: CreateJobRequest, unity_project_path: str = "") -> dict:
    if not unity_project_path or unity_project_path == "demo":
        unity_project_path = str(_get_demo_dir())
    if req.backend.value == "lucy" and not req.api_key:
        env_key = os.environ.get("LUCY_API_KEY")
        if env_key:
            req.api_key = env_key
    job = create_job(req, unity_project_path)
    return job.model_dump()


@app.get("/api/jobs")
async def api_list_jobs() -> dict:
    jobs = list_jobs()
    return JobListResponse(jobs=jobs, total=len(jobs)).model_dump()


@app.get("/api/jobs/{job_id}")
async def api_get_job(job_id: str) -> dict:
    job = get_job(job_id)
    if not job:
        raise HTTPException(404, "Job not found")
    return job.model_dump()


@app.post("/api/upload/project")
async def api_upload_project(file: UploadFile = File(...)) -> dict:
    upload_dir = DATA_ROOT / "uploads" / file.filename.replace(".zip", "")
    upload_dir.mkdir(parents=True, exist_ok=True)
    zip_path = upload_dir / file.filename
    with open(zip_path, "wb") as f:
        content = await file.read()
        f.write(content)
    shutil.unpack_archive(zip_path, upload_dir / "project")
    return {"project_path": str(upload_dir / "project"), "message": "Unity project uploaded"}
