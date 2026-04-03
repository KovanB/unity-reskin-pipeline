"""FastAPI application — Unity reskin pipeline web API.

Uses real assets from Unity's Endless Runner Sample Game (Trash Dash).
"""

from __future__ import annotations

import asyncio
import json
import shutil
import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile
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
        for png in sorted(cat_dir.glob("*.png")):
            textures.append({
                "name": png.stem,
                "filename": png.name,
                "category": cat_id,
                "url": f"/api/demo/texture/{cat_info['path']}/{png.name}",
            })

        # Include subdir textures for Graffiti
        if not cat_info.get("exclude_subdirs"):
            for png in sorted(cat_dir.rglob("*.png")):
                if png.parent != cat_dir:
                    continue  # already handled above for direct children
        else:
            # For Environment, only direct children (no Graffiti subdir)
            pass

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
