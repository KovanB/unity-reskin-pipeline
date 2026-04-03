"""FastAPI application — Unity reskin pipeline web API."""

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


def _ensure_demo_project() -> Path:
    """Generate demo Unity project with Subway Surfers-style character textures."""
    demo_dir = DATA_ROOT / "demo_project"
    assets_dir = demo_dir / "Assets" / "Characters"
    if assets_dir.exists():
        return demo_dir

    from PIL import Image, ImageDraw

    def hex_to_rgb(h):
        h = h.lstrip("#")
        return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))

    # Subway Surfers-style characters
    chars = {
        "Jake": {"body": "#2196F3", "accent": "#FFC107", "trim": "#1565C0", "skin": "#D4A574"},
        "Tricky": {"body": "#E91E63", "accent": "#00BCD4", "trim": "#AD1457", "skin": "#8D5524"},
        "Fresh": {"body": "#4CAF50", "accent": "#FF9800", "trim": "#2E7D32", "skin": "#C68642"},
        "Yutani": {"body": "#9C27B0", "accent": "#FFEB3B", "trim": "#6A1B9A", "skin": "#F1C27D"},
        "Spike": {"body": "#F44336", "accent": "#CDDC39", "trim": "#C62828", "skin": "#D4A574"},
    }

    # Also generate .meta files for each texture
    guid_counter = 0

    for name, pal in chars.items():
        char_dir = assets_dir / name
        char_dir.mkdir(parents=True, exist_ok=True)
        body_c = hex_to_rgb(pal["body"])
        acc_c = hex_to_rgb(pal["accent"])
        trim_c = hex_to_rgb(pal["trim"])
        skin_c = hex_to_rgb(pal["skin"])

        # Body texture (hoodie/shirt)
        img = Image.new("RGB", (512, 512), body_c)
        d = ImageDraw.Draw(img)
        # Hoodie pattern
        d.rectangle([0, 0, 512, 200], fill=body_c)
        d.rectangle([0, 200, 512, 512], fill=trim_c)
        d.rectangle([180, 50, 332, 180], fill=acc_c, outline=trim_c, width=3)
        d.ellipse([210, 70, 302, 160], fill=body_c, outline=acc_c, width=3)
        # Zipper line
        d.line([(256, 0), (256, 512)], fill=acc_c, width=3)
        img.save(str(char_dir / f"{name}_Body.png"))

        # Face
        face = Image.new("RGB", (256, 256), skin_c)
        fd = ImageDraw.Draw(face)
        fd.ellipse([30, 10, 226, 230], fill=skin_c, outline=(skin_c[0]-30, skin_c[1]-30, skin_c[2]-30), width=2)
        # Eyes
        fd.ellipse([70, 80, 110, 115], fill="white", outline="#333")
        fd.ellipse([146, 80, 186, 115], fill="white", outline="#333")
        fd.ellipse([82, 90, 98, 108], fill="#333")
        fd.ellipse([158, 90, 174, 108], fill="#333")
        # Mouth
        fd.arc([90, 130, 166, 175], 0, 180, fill=(139, 94, 60), width=3)
        # Hair (colored like the character theme)
        fd.rectangle([20, 0, 236, 40], fill=body_c, outline=trim_c, width=2)
        face.save(str(char_dir / f"{name}_Face.png"))

        # Shoes
        shoes = Image.new("RGB", (256, 256), acc_c)
        sd = ImageDraw.Draw(shoes)
        # Left shoe
        sd.rounded_rectangle([10, 20, 120, 120], radius=15, fill=acc_c, outline=trim_c, width=3)
        sd.rounded_rectangle([15, 80, 115, 115], radius=10, fill="white")
        # Right shoe
        sd.rounded_rectangle([136, 20, 246, 120], radius=15, fill=acc_c, outline=trim_c, width=3)
        sd.rounded_rectangle([141, 80, 241, 115], radius=10, fill="white")
        # Sole
        sd.rectangle([10, 120, 120, 145], fill=trim_c)
        sd.rectangle([136, 120, 246, 145], fill=trim_c)
        shoes.save(str(char_dir / f"{name}_Shoes.png"))

        # Board (hoverboard/skateboard)
        board = Image.new("RGBA", (512, 256), (0, 0, 0, 0))
        bd = ImageDraw.Draw(board)
        bd.rounded_rectangle([20, 60, 492, 196], radius=30, fill=body_c, outline=trim_c, width=4)
        # Grip tape pattern
        for x in range(40, 480, 20):
            bd.line([(x, 80), (x, 176)], fill=trim_c, width=1)
        # Accent stripe
        bd.rectangle([20, 120, 492, 136], fill=acc_c)
        # Wheels
        bd.ellipse([60, 185, 100, 225], fill="#333", outline="#555", width=2)
        bd.ellipse([412, 185, 452, 225], fill="#333", outline="#555", width=2)
        board.save(str(char_dir / f"{name}_Board.png"))

        # Accessory (hat/cap)
        hat = Image.new("RGBA", (256, 256), (0, 0, 0, 0))
        hd = ImageDraw.Draw(hat)
        hd.ellipse([30, 60, 226, 200], fill=body_c, outline=trim_c, width=3)
        hd.rectangle([20, 140, 236, 175], fill=body_c, outline=trim_c, width=2)
        hd.rectangle([80, 90, 176, 130], fill=acc_c, outline=trim_c, width=2)
        hat.save(str(char_dir / f"{name}_Hat.png"))

        # Generate .meta files for each texture
        textures = ["Body", "Face", "Shoes", "Board", "Hat"]
        for tex in textures:
            guid_counter += 1
            guid = f"{guid_counter:032x}"
            meta_content = f"""fileFormatVersion: 2
guid: {guid}
TextureImporter:
  maxTextureSize: 2048
  textureFormat: -1
  filterMode: 1
  wrapU: 0
  wrapV: 0
  spriteMode: 0
  spritePixelsPerUnit: 100
  mipmapEnabled: 1
  isReadable: 0
  npotScale: 0
"""
            meta_path = char_dir / f"{name}_{tex}.png.meta"
            meta_path.write_text(meta_content)

    # Create minimal ProjectSettings
    ps_dir = demo_dir / "ProjectSettings"
    ps_dir.mkdir(parents=True, exist_ok=True)
    (ps_dir / "ProjectVersion.txt").write_text("m_EditorVersion: 2022.3.0f1\n")

    return demo_dir


# ──────────────────────────── REST endpoints ────────────────────────────────

@app.get("/api/demo/characters")
async def api_demo_characters() -> dict:
    """List the bundled demo characters and their textures."""
    _ensure_demo_project()
    characters = ["Jake", "Tricky", "Fresh", "Yutani", "Spike"]
    textures = ["Body", "Face", "Shoes", "Board", "Hat"]
    return {
        "characters": characters,
        "textures_per_character": textures,
        "total_assets": len(characters) * len(textures),
        "project_path": "demo",
    }


@app.post("/api/jobs")
async def api_create_job(req: CreateJobRequest, unity_project_path: str = "") -> dict:
    """Create a new reskin job."""
    if not unity_project_path or unity_project_path == "demo":
        unity_project_path = str(_ensure_demo_project())

    if req.backend.value == "lucy" and not req.api_key:
        env_key = os.environ.get("LUCY_API_KEY")
        if env_key:
            req.api_key = env_key

    job = create_job(req, unity_project_path)
    return job.model_dump()


@app.get("/api/jobs/{job_id}/run")
async def api_run_job(job_id: str):
    """Run the full pipeline as a streaming SSE response."""
    import yaml
    from .jobs import _jobs, _now

    job = _jobs.get(job_id)
    if not job:
        raise HTTPException(404, "Job not found")

    async def run_pipeline():
        job_dir = get_job_dir(job_id)
        output_dir = job_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        config_data = {
            "name": job["name"],
            "style_prompt": job["style_prompt"],
            "backend": job["backend"],
            "output_mode": job.get("output_mode", "project"),
            "unity_project_path": job["unity_project_path"],
            "output_dir": str(output_dir),
            "categories": job["categories"],
            "quality": job["quality"],
            "atlas_mode": job.get("atlas_mode", "auto"),
            "author": job["author"],
            "description": job["description"],
        }
        if job.get("api_key"):
            config_data["api_key"] = job["api_key"]

        config_path = job_dir / "config.yaml"
        with open(config_path, "w") as f:
            yaml.dump(config_data, f)

        def send_event(status, stage, message, current=0, total=0):
            pct = (current / total * 100) if total > 0 else 0
            progress = {"status": status, "stage": stage, "message": message,
                        "current": current, "total": total, "percent": round(pct, 1)}
            job["progress"] = JobProgress(**progress)
            job["updated_at"] = _now()
            return f"data: {json.dumps(progress)}\n\n"

        try:
            from unity_reskin.config import load_config
            config = load_config(config_path)

            yield send_event("extracting", "extract", "Scanning Unity project...")

            from unity_reskin.extractor import extract as run_extract
            manifest_path = await asyncio.to_thread(run_extract, config)

            from unity_reskin.utils import load_json
            manifest = load_json(manifest_path)
            total = manifest["total_assets"]
            job["asset_count"] = total

            yield send_event("generating", "generate", f"Generating {total} assets...", 0, total)

            from unity_reskin.generator import generate as run_generate
            await asyncio.to_thread(run_generate, config)

            yield send_event("baking", "bake", "Baking textures...", total, total)

            from unity_reskin.baker import bake as run_bake
            await asyncio.to_thread(run_bake, config)

            if config.quality.consistency_pass:
                yield send_event("baking", "consistency", "Running consistency pass...", total, total)
                from unity_reskin.consistency import consistency_pass
                await asyncio.to_thread(consistency_pass, config)

            yield send_event("packaging", "package", "Building Unity package...", total, total)

            from unity_reskin.packager import package as run_package
            await asyncio.to_thread(run_package, config)

            yield send_event("completed", "done", "Skin ready for download!", total, total)

        except Exception as e:
            job["error"] = str(e)
            yield send_event("failed", "error", f"Pipeline failed: {e}")

    return StreamingResponse(run_pipeline(), media_type="text/event-stream")


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


@app.get("/api/jobs/{job_id}/preview/{path:path}")
async def api_preview(job_id: str, path: str) -> FileResponse:
    job_dir = get_job_dir(job_id)
    file_path = job_dir / "output" / "generated" / path
    if not file_path.exists():
        raise HTTPException(404, "Preview not found")
    return FileResponse(file_path, media_type="image/png")


@app.get("/api/jobs/{job_id}/originals/{path:path}")
async def api_original(job_id: str, path: str) -> FileResponse:
    job_dir = get_job_dir(job_id)
    file_path = job_dir / "output" / "extracted" / path
    if not file_path.exists():
        raise HTTPException(404, "Original not found")
    return FileResponse(file_path)


@app.get("/api/jobs/{job_id}/download")
async def api_download(job_id: str) -> FileResponse:
    job_dir = get_job_dir(job_id)
    package_dir = job_dir / "output" / "package"
    if not package_dir.exists():
        raise HTTPException(404, "Package not ready")

    # Check for .unitypackage file first
    for f in package_dir.iterdir():
        if f.suffix == ".unitypackage":
            return FileResponse(f, media_type="application/octet-stream", filename=f.name)

    # Otherwise zip the project
    zip_path = job_dir / "skin_package"
    if not Path(f"{zip_path}.zip").exists():
        shutil.make_archive(str(zip_path), "zip", package_dir)

    return FileResponse(f"{zip_path}.zip", media_type="application/zip", filename=f"reskin_{job_id}.zip")


@app.post("/api/upload/project")
async def api_upload_project(file: UploadFile = File(...)) -> dict:
    """Upload a zipped Unity project for processing."""
    upload_dir = DATA_ROOT / "uploads" / file.filename.replace(".zip", "")
    upload_dir.mkdir(parents=True, exist_ok=True)

    zip_path = upload_dir / file.filename
    with open(zip_path, "wb") as f:
        content = await file.read()
        f.write(content)

    shutil.unpack_archive(zip_path, upload_dir / "project")
    return {"project_path": str(upload_dir / "project"), "message": "Unity project uploaded"}


@app.get("/api/jobs/{job_id}/assets")
async def api_list_assets(job_id: str) -> dict:
    job_dir = get_job_dir(job_id)

    for manifest_name in ("bake_manifest.json", "generation_manifest.json", "extraction_manifest.json"):
        manifest_path = job_dir / "output" / manifest_name
        if manifest_path.exists():
            break
    else:
        raise HTTPException(404, "No manifest found yet")

    from unity_reskin.utils import load_json
    manifest = load_json(manifest_path)
    assets = manifest.get("assets", [])

    result = []
    for asset in assets:
        rel = asset["relative_path"]
        cat = asset["category"]
        entry = {
            "relative_path": rel,
            "category": cat,
            "width": asset["width"],
            "height": asset["height"],
            "is_atlas": asset.get("is_atlas", False),
            "guid": asset.get("guid"),
            "original_url": f"/api/jobs/{job_id}/originals/{cat}/{rel}",
        }
        if asset.get("generated_path"):
            entry["preview_url"] = f"/api/jobs/{job_id}/preview/{cat}/{rel}"
        result.append(entry)

    return {"assets": result, "total": len(result)}


@app.get("/api/demo/thumb/{character}/{texture}")
async def api_demo_thumb(character: str, texture: str):
    """Serve a demo character texture as a thumbnail."""
    demo_dir = _ensure_demo_project()
    file_path = demo_dir / "Assets" / "Characters" / character / f"{character}_{texture}.png"
    if not file_path.exists():
        raise HTTPException(404, "Texture not found")
    return FileResponse(file_path, media_type="image/png")


@app.get("/api/skins")
async def api_list_skins():
    """List all permanently baked skins with their textures."""
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
            for char_name, char_texs in manifest.get("textures", {}).items():
                textures[char_name] = {}
                for tex_name in char_texs:
                    textures[char_name][tex_name] = f"/api/skins/{skin_dir.name}/{char_name}/{tex_name}"
            manifest["textures"] = textures
            skins.append(manifest)

    return {"skins": skins}


@app.get("/api/skins/{skin_id}/{character}/{texture}")
async def api_skin_texture(skin_id: str, character: str, texture: str):
    """Serve a permanently baked skin texture."""
    file_path = DATA_ROOT / "skins" / skin_id / character / f"{texture}.png"
    if not file_path.exists():
        raise HTTPException(404, "Skin texture not found")
    return FileResponse(file_path, media_type="image/png")


@app.get("/api/skins/{skin_id}/download")
async def api_skin_download(skin_id: str):
    """Download a baked skin as a zip of Unity-ready textures."""
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
    characters: str = "",
):
    """
    Permanently bake a skin: run Lucy ONCE, save results as permanent assets.
    Returns streaming progress, then the skin is available at /api/skins/{skin_id}.
    If the skin already exists, returns it immediately (cached).
    """
    import base64, io

    skins_dir = DATA_ROOT / "skins" / skin_id
    manifest_path = skins_dir / "manifest.json"

    # If already baked, return cached result
    if manifest_path.exists():
        from unity_reskin.utils import load_json
        manifest = load_json(manifest_path)

        async def cached():
            yield json.dumps({"type": "status", "message": f"Skin '{skin_id}' already baked — serving cached"}) + "\n"

            for char_name, char_texs in manifest.get("textures", {}).items():
                for tex_name in char_texs:
                    tex_path = skins_dir / char_name / f"{tex_name}.png"
                    orig_path = DATA_ROOT / "demo_project" / "Assets" / "Characters" / char_name / f"{char_name}_{tex_name}.png"
                    if tex_path.exists():
                        def to_b64(p):
                            with open(p, "rb") as f:
                                return base64.b64encode(f.read()).decode()
                        yield json.dumps({
                            "type": "card", "character": char_name, "texture": tex_name,
                            "original": to_b64(orig_path) if orig_path.exists() else "",
                            "reskinned": to_b64(tex_path),
                            "width": 512, "height": 512, "cached": True,
                        }) + "\n"

            yield json.dumps({"type": "done", "message": f"Skin '{skin_id}' ready!", "skin_id": skin_id}) + "\n"

        return StreamingResponse(cached(), media_type="application/x-ndjson")

    # Otherwise, generate and permanently save
    char_list = [c.strip() for c in characters.split(",")] if characters else [c["name"] for c in [
        {"name": "Jake"}, {"name": "Tricky"}, {"name": "Fresh"}, {"name": "Yutani"}, {"name": "Spike"}
    ]]
    textures_list = ["Body", "Face", "Shoes", "Board", "Hat"]

    async def bake():
        import yaml
        demo_dir = _ensure_demo_project()

        api_key = os.environ.get("LUCY_API_KEY", "")
        if not api_key:
            yield json.dumps({"type": "status", "message": "LUCY_API_KEY not set", "cls": "error"}) + "\n"
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
        }
        config_data["api_key"] = api_key

        config_path = DATA_ROOT / "tmp_bake" / "config.yaml"
        config_path.parent.mkdir(parents=True, exist_ok=True)
        with open(config_path, "w") as f:
            yaml.dump(config_data, f)

        from unity_reskin.config import load_config
        from unity_reskin.generator import get_backend
        from unity_reskin.utils import load_image, save_image

        config = load_config(config_path)
        gen_backend = get_backend(config)

        total = len(char_list) * len(textures_list)
        done = 0
        skin_textures = {}

        yield json.dumps({"type": "status", "message": f"Baking skin '{skin_id}' — {total} textures with Lucy..."}) + "\n"

        for char_name in char_list:
            char_dir = demo_dir / "Assets" / "Characters" / char_name
            if not char_dir.exists():
                continue

            skin_textures[char_name] = []
            out_char_dir = skins_dir / char_name
            out_char_dir.mkdir(parents=True, exist_ok=True)

            for tex_name in textures_list:
                tex_path = char_dir / f"{char_name}_{tex_name}.png"
                if not tex_path.exists():
                    continue

                done += 1
                yield json.dumps({"type": "status", "message": f"({done}/{total}) {char_name} / {tex_name}..."}) + "\n"

                try:
                    source = load_image(tex_path)
                    asset_info = {"relative_path": f"Characters/{char_name}/{char_name}_{tex_name}.png", "category": "characters"}
                    result = await asyncio.to_thread(gen_backend.generate, source, style_prompt, [], asset_info)

                    # Save permanently
                    out_path = out_char_dir / f"{tex_name}.png"
                    save_image(result, out_path)
                    skin_textures[char_name].append(tex_name)

                    def to_b64(img):
                        buf = io.BytesIO()
                        img.convert("RGB").save(buf, format="PNG")
                        return base64.b64encode(buf.getvalue()).decode()

                    yield json.dumps({
                        "type": "card", "character": char_name, "texture": tex_name,
                        "width": source.width, "height": source.height,
                        "original": to_b64(source), "reskinned": to_b64(result),
                    }) + "\n"

                except Exception as e:
                    yield json.dumps({"type": "status", "message": f"Error on {tex_name}: {e}", "cls": "error"}) + "\n"

        # Write permanent manifest
        from unity_reskin.utils import save_json
        save_json({
            "skin_id": skin_id,
            "style_prompt": style_prompt,
            "strength": strength,
            "textures": skin_textures,
            "total": done,
        }, manifest_path)

        yield json.dumps({"type": "done", "message": f"Skin '{skin_id}' permanently baked! {done} textures saved.", "skin_id": skin_id}) + "\n"

    return StreamingResponse(bake(), media_type="application/x-ndjson")


@app.get("/api/reskin")
async def api_reskin(
    character: str = "Jake",
    style_prompt: str = "cyberpunk neon aesthetic",
    strength: float = 0.75,
):
    """Stream Lucy reskin results for a single character."""
    import base64
    import io
    import yaml

    async def stream_reskin():
        demo_dir = _ensure_demo_project()
        char_dir = demo_dir / "Assets" / "Characters" / character

        if not char_dir.exists():
            yield json.dumps({"type": "status", "message": f"Character '{character}' not found", "cls": "error"}) + "\n"
            return

        job_dir = DATA_ROOT / f"reskin_{character}"
        job_dir.mkdir(parents=True, exist_ok=True)
        output_dir = job_dir / "output"
        output_dir.mkdir(parents=True, exist_ok=True)

        api_key = os.environ.get("LUCY_API_KEY", "")
        config_data = {
            "name": f"Reskin_{character}",
            "style_prompt": style_prompt,
            "backend": "lucy",
            "unity_project_path": str(demo_dir),
            "output_dir": str(output_dir),
            "categories": ["characters"],
            "quality": {"strength": strength, "guidance_scale": 7.5, "steps": 30,
                        "preserve_pbr": True, "tile_seam_fix": True, "consistency_pass": False},
        }
        if api_key:
            config_data["api_key"] = api_key

        config_path = job_dir / "config.yaml"
        with open(config_path, "w") as f:
            yaml.dump(config_data, f)

        from unity_reskin.config import load_config
        from unity_reskin.generator import get_backend
        from unity_reskin.utils import load_image

        config = load_config(config_path)
        gen_backend = get_backend(config)

        textures = sorted(char_dir.glob("*.png"))
        total = len(textures)

        yield json.dumps({"type": "status", "message": f"Reskinning {character} ({total} textures)..."}) + "\n"

        def img_to_b64(img):
            buf = io.BytesIO()
            img.convert("RGB").save(buf, format="PNG")
            return base64.b64encode(buf.getvalue()).decode()

        for i, tex_path in enumerate(textures):
            tex_name = tex_path.stem.replace(f"{character}_", "")

            yield json.dumps({"type": "status", "message": f"({i+1}/{total}) {character} / {tex_name}..."}) + "\n"

            try:
                source = load_image(tex_path)
                orig_b64 = img_to_b64(source)

                asset_info = {"relative_path": str(tex_path.relative_to(demo_dir / "Assets")), "category": "characters"}
                result = await asyncio.to_thread(gen_backend.generate, source, style_prompt, [], asset_info)
                gen_b64 = img_to_b64(result)

                yield json.dumps({
                    "type": "card",
                    "character": character,
                    "texture": tex_name,
                    "width": source.width,
                    "height": source.height,
                    "original": orig_b64,
                    "reskinned": gen_b64,
                }) + "\n"

            except Exception as e:
                yield json.dumps({"type": "status", "message": f"Error on {tex_name}: {e}", "cls": "error"}) + "\n"

        yield json.dumps({"type": "done", "message": f"Done! {total} textures reskinned for {character}."}) + "\n"

    return StreamingResponse(stream_reskin(), media_type="application/x-ndjson")
