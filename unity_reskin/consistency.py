"""Cross-asset style consistency pass — harmonize palettes across related assets.

Ported from reskin-pipeline — fully engine-agnostic.
"""

from __future__ import annotations

from collections import defaultdict
from pathlib import Path

from PIL import Image

from .config import SkinConfig
from .utils import load_image, load_json, logger, save_image, save_json


def _np():
    import numpy
    return numpy


def extract_palette(img: Image.Image, n_colors: int = 8):
    """Extract dominant colors using quantization."""
    small = img.convert("RGB").resize((64, 64), Image.LANCZOS)
    quantized = small.quantize(colors=n_colors, method=Image.Quantize.MEDIANCUT)
    palette = quantized.getpalette()[:n_colors * 3]
    return _np().array(palette, dtype=_np().float32).reshape(-1, 3)


def compute_target_palette(style_refs, generated_images, n_colors=8):
    sources = style_refs if style_refs else generated_images
    if not sources:
        return _np().array([[128, 128, 128]] * n_colors, dtype=_np().float32)
    all_palettes = [extract_palette(img, n_colors) for img in sources]
    return _np().mean(all_palettes, axis=0)


def shift_palette(img, current_palette, target_palette, strength=0.3):
    arr = _np().array(img.convert("RGB"), dtype=_np().float32)
    for c in range(3):
        channel = arr[:, :, c]
        src_mean = channel.mean()
        src_std = channel.std() + 1e-6
        tgt_mean = target_palette[:, c].mean()
        tgt_std = current_palette[:, c].std() + 1e-6
        shifted = (channel - src_mean) * (tgt_std / src_std) + tgt_mean
        arr[:, :, c] = channel * (1 - strength) + shifted * strength

    arr = arr.clip(0, 255).astype(_np().uint8)
    result = Image.fromarray(arr, mode="RGB")
    if img.mode == "RGBA":
        result = result.convert("RGBA")
        result.putalpha(img.getchannel("A"))
    return result


# Unity-specific grouping heuristics
ASSET_GROUPS = {
    "character": ["character", "player", "avatar", "skin", "hero", "runner"],
    "track": ["track", "rail", "road", "ground", "floor", "path"],
    "building": ["building", "house", "shop", "wall", "roof", "structure"],
    "nature": ["tree", "grass", "leaf", "flower", "bush", "plant"],
    "vehicle": ["train", "car", "bus", "truck", "vehicle"],
    "collectible": ["coin", "gem", "star", "powerup", "item", "pickup"],
    "ui": ["button", "panel", "frame", "border", "icon", "hud", "menu"],
    "sky": ["sky", "cloud", "background", "backdrop"],
}


def group_assets(assets):
    groups = defaultdict(list)
    for asset in assets:
        rel = asset.get("relative_path", "").lower()
        assigned = False
        for group_name, keywords in ASSET_GROUPS.items():
            if any(kw in rel for kw in keywords):
                groups[group_name].append(asset)
                assigned = True
                break
        if not assigned:
            groups["other"].append(asset)
    return dict(groups)


def consistency_pass(config: SkinConfig) -> None:
    """Run a consistency pass across baked assets."""
    bake_manifest_path = config.output_dir / "bake_manifest.json"
    manifest = load_json(bake_manifest_path)
    assets = manifest["assets"]

    baked_assets = [a for a in assets if a.get("baked_path")]
    if not baked_assets:
        logger.warning("No baked assets to harmonize")
        return

    style_refs = []
    for ref_path in config.style_reference_images:
        if ref_path.exists():
            style_refs.append(load_image(ref_path))

    groups = group_assets(baked_assets)
    logger.info(f"Consistency pass: {len(baked_assets)} assets in {len(groups)} groups")

    for group_name, group_assets_list in groups.items():
        if len(group_assets_list) < 2:
            continue

        logger.info(f"  Harmonizing group '{group_name}': {len(group_assets_list)} assets")

        images = []
        for asset in group_assets_list:
            baked_path = Path(asset["baked_path"])
            if baked_path.exists():
                images.append(load_image(baked_path))

        if not images:
            continue

        target = compute_target_palette(style_refs, images)

        for asset, img in zip(group_assets_list, images):
            current = extract_palette(img)
            harmonized = shift_palette(img, current, target, strength=0.3)
            baked_path = Path(asset["baked_path"])
            fmt = config.quality.output_format
            save_image(harmonized, baked_path, fmt=fmt)

    manifest["consistency_pass"] = True
    save_json(manifest, bake_manifest_path)
    logger.info("Consistency pass complete")
