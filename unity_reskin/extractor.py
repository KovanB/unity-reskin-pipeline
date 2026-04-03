"""Extract and categorize textures from a Unity project."""

from __future__ import annotations

import shutil
from pathlib import Path

from PIL import Image

from .config import SkinConfig
from .unity_meta import parse_meta, build_guid_map
from .utils import file_hash, logger, save_json

# File extensions we treat as image assets
IMAGE_EXTENSIONS = {".png", ".tga", ".bmp", ".jpg", ".jpeg", ".tif", ".tiff", ".psd"}

# Path patterns for categorization (checked against relative path within Assets/)
CATEGORY_PATTERNS: dict[str, list[str]] = {
    "characters": ["Character", "Player", "Avatar", "Skin", "Hero", "Runner", "Person"],
    "environment": ["Environment", "Background", "Ground", "Track", "Rail", "Road",
                     "Building", "Scenery", "Terrain", "Props", "Level", "World"],
    "ui": ["UI", "Canvas", "HUD", "Menu", "Button", "Panel", "Font", "Icon", "Widget"],
    "collectibles": ["Coin", "Powerup", "Collectible", "Pickup", "Item", "Gem",
                      "Reward", "Token", "Key", "Star"],
    "particles": ["Particles", "FX", "Effect", "VFX", "Trail", "Explosion", "Sparkle"],
    "sprites": ["Sprite", "Atlas", "SpriteSheet", "Tilemap", "Tileset"],
}


def categorize_asset(rel_path: Path, meta_info: dict | None = None) -> str:
    """Determine asset category from its path within Assets/ and meta info."""
    path_str = str(rel_path).replace("\\", "/")
    parts_upper = path_str.upper()

    # Check if it's a sprite atlas based on meta
    if meta_info and meta_info.get("is_sprite_atlas"):
        return "sprites"

    for category, patterns in CATEGORY_PATTERNS.items():
        for pattern in patterns:
            if pattern.upper() in parts_upper:
                return category

    return "environment"  # default for Unity games (most assets are environment)


def get_image_info(path: Path) -> dict | None:
    """Get image metadata. Returns None if file can't be read as image."""
    try:
        with Image.open(path) as img:
            return {
                "width": img.width,
                "height": img.height,
                "mode": img.mode,
                "format": img.format,
            }
    except Exception:
        return None


def scan_assets_dir(assets_dir: Path) -> list[dict]:
    """Recursively scan Assets/ for image assets, parsing .meta files."""
    assets = []

    if not assets_dir.exists():
        logger.error(f"Assets directory not found: {assets_dir}")
        return assets

    for file_path in sorted(assets_dir.rglob("*")):
        if not file_path.is_file():
            continue
        if file_path.suffix.lower() not in IMAGE_EXTENSIONS:
            continue
        # Skip Library, Temp, and hidden folders
        rel_str = str(file_path.relative_to(assets_dir))
        if any(skip in rel_str for skip in ["Library", "Temp", ".", "~"]):
            continue

        rel_path = file_path.relative_to(assets_dir)
        info = get_image_info(file_path)

        if info is None:
            logger.warning(f"Skipping unreadable image: {rel_path}")
            continue

        # Parse companion .meta file
        meta_path = Path(str(file_path) + ".meta")
        meta_info = None
        guid = None
        sprite_rects = []
        is_atlas = False

        if meta_path.exists():
            meta_info = parse_meta(meta_path)
            guid = meta_info.get("guid")
            is_atlas = meta_info.get("is_sprite_atlas", False)
            sprite_rects = meta_info.get("sprite_rects", [])

        category = categorize_asset(rel_path, meta_info)

        assets.append({
            "source_path": str(file_path),
            "relative_path": str(rel_path),
            "meta_path": str(meta_path) if meta_path.exists() else None,
            "guid": guid,
            "category": category,
            "width": info["width"],
            "height": info["height"],
            "mode": info["mode"],
            "format": info["format"],
            "is_atlas": is_atlas,
            "sprite_rects": sprite_rects,
            "texture_settings": meta_info.get("texture_settings", {}) if meta_info else {},
            "hash": file_hash(file_path),
        })

    return assets


def extract(config: SkinConfig) -> Path:
    """
    Run the extraction phase:
    1. Scan the Unity project's Assets/ directory
    2. Categorize all image assets using paths + .meta info
    3. Copy them to a staging directory organized by category
    4. Write an extraction manifest with GUID tracking

    Returns the path to the extraction manifest.
    """
    assets_dir = config.assets_dir()
    extracted_dir = config.extracted_dir()
    extracted_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Scanning Unity project: {assets_dir}")
    all_assets = scan_assets_dir(assets_dir)

    # Filter by configured categories
    assets = [a for a in all_assets if a["category"] in config.categories]
    logger.info(f"Found {len(assets)} assets ({len(all_assets)} total, {len(all_assets) - len(assets)} filtered out)")

    # Build GUID map for reference tracking
    guid_map = build_guid_map(assets_dir)

    # Copy to staging organized by category
    for asset in assets:
        src = Path(asset["source_path"])
        category = asset["category"]
        rel = Path(asset["relative_path"])
        dest = extracted_dir / category / rel
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)
        asset["extracted_path"] = str(dest)

        # Also copy .meta file to preserve it
        if asset["meta_path"]:
            meta_src = Path(asset["meta_path"])
            meta_dest = Path(str(dest) + ".meta")
            shutil.copy2(meta_src, meta_dest)

    # Write manifest
    manifest_path = config.output_dir / "extraction_manifest.json"
    manifest = {
        "skin_name": config.name,
        "unity_project": str(config.unity_project_path),
        "engine": "unity",
        "total_assets": len(assets),
        "total_atlases": sum(1 for a in assets if a["is_atlas"]),
        "guid_map_size": len(guid_map),
        "by_category": {},
        "assets": assets,
    }
    for cat in config.categories:
        count = sum(1 for a in assets if a["category"] == cat)
        if count > 0:
            manifest["by_category"][cat] = count

    save_json(manifest, manifest_path)
    logger.info(f"Extraction manifest written to: {manifest_path}")

    for cat, count in manifest["by_category"].items():
        logger.info(f"  {cat}: {count} assets")

    return manifest_path
