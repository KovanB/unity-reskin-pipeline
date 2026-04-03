"""Bake generated images into Unity-compatible asset formats.

Unlike the UE version, Unity doesn't require power-of-2 textures.
We match the original dimensions exactly and preserve sprite atlas boundaries.
"""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageFilter

from .config import SkinConfig
from .utils import load_image, load_json, logger, save_image, save_json


def _np():
    import numpy
    return numpy


def resize_to_match(generated: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Resize generated image to match original asset resolution exactly."""
    if generated.size != (target_w, target_h):
        generated = generated.resize((target_w, target_h), Image.LANCZOS)
    return generated


def generate_normal_from_albedo(albedo: Image.Image) -> Image.Image:
    """Generate a normal map from albedo using Sobel-like edge detection."""
    gray = albedo.convert("L")
    arr = _np().array(gray, dtype=_np().float32) / 255.0

    dx = _np().zeros_like(arr)
    dy = _np().zeros_like(arr)
    dx[:, 1:-1] = (arr[:, 2:] - arr[:, :-2]) / 2.0
    dy[1:-1, :] = (arr[2:, :] - arr[:-2, :]) / 2.0

    strength = 2.0
    nx = -dx * strength
    ny = -dy * strength
    nz = _np().ones_like(arr)

    length = _np().sqrt(nx**2 + ny**2 + nz**2)
    nx /= length
    ny /= length
    nz /= length

    r = ((nx + 1) / 2 * 255).clip(0, 255).astype(_np().uint8)
    g = ((ny + 1) / 2 * 255).clip(0, 255).astype(_np().uint8)
    b = ((nz + 1) / 2 * 255).clip(0, 255).astype(_np().uint8)

    return Image.merge("RGB", [
        Image.fromarray(r), Image.fromarray(g), Image.fromarray(b),
    ]).convert("RGBA")


def generate_roughness_from_albedo(albedo: Image.Image) -> Image.Image:
    """Estimate a roughness map from albedo."""
    gray = albedo.convert("L")
    arr = _np().array(gray, dtype=_np().float32) / 255.0
    roughness = 1.0 - arr * 0.5
    roughness = (roughness * 255).clip(0, 255).astype(_np().uint8)
    return Image.fromarray(roughness, mode="L").convert("RGBA")


def fix_tile_seams(img: Image.Image, border_px: int = 16) -> Image.Image:
    """Blend tile borders to reduce visible seams when tiling."""
    arr = _np().array(img, dtype=_np().float32)
    h, w = arr.shape[:2]

    if border_px >= min(h, w) // 4:
        return img

    for i in range(border_px):
        alpha = i / border_px
        left_col = arr[:, i].copy()
        right_col = arr[:, w - border_px + i].copy()
        arr[:, i] = left_col * alpha + right_col * (1 - alpha)
        arr[:, w - border_px + i] = left_col * (1 - alpha) + right_col * alpha

    for i in range(border_px):
        alpha = i / border_px
        top_row = arr[i].copy()
        bottom_row = arr[h - border_px + i].copy()
        arr[i] = top_row * alpha + bottom_row * (1 - alpha)
        arr[h - border_px + i] = top_row * (1 - alpha) + bottom_row * alpha

    return Image.fromarray(arr.clip(0, 255).astype(_np().uint8), mode=img.mode)


def is_tiling_texture(asset_info: dict) -> bool:
    """Heuristic: textures in certain categories/paths are likely tiling."""
    rel = asset_info.get("relative_path", "").lower()
    tiling_hints = ["floor", "wall", "ground", "tile", "brick", "wood", "stone",
                    "metal", "fabric", "concrete", "grass", "rock", "terrain",
                    "road", "track", "rail"]
    return any(hint in rel for hint in tiling_hints)


def bake(config: SkinConfig) -> Path:
    """
    Run the baking phase:
    1. Load generation manifest
    2. Resize each generated image to match original resolution exactly
    3. Fix tile seams where appropriate
    4. Generate PBR maps if needed
    5. Write baked assets and manifest

    Returns path to bake manifest.
    """
    manifest_path = config.output_dir / "generation_manifest.json"
    manifest = load_json(manifest_path)
    assets = manifest["assets"]

    baked_dir = config.baked_dir()
    baked_dir.mkdir(parents=True, exist_ok=True)

    fmt = config.quality.output_format
    baked_count = 0

    for i, asset in enumerate(assets):
        gen_path = asset.get("generated_path")
        if not gen_path or not Path(gen_path).exists():
            continue

        rel_path = Path(asset["relative_path"])
        target_w = asset["width"]
        target_h = asset["height"]

        logger.info(f"[{i + 1}/{len(assets)}] Baking: {rel_path}")

        generated = load_image(Path(gen_path))

        # Resize to match original exactly (no power-of-2 rounding for Unity)
        baked = resize_to_match(generated, target_w, target_h)

        # Seam fix for tiling textures
        if config.quality.tile_seam_fix and is_tiling_texture(asset):
            baked = fix_tile_seams(baked)
            logger.debug(f"  Applied seam fix: {rel_path}")

        # Save baked albedo
        out_path = baked_dir / asset["category"] / rel_path.with_suffix(f".{fmt}")
        save_image(baked, out_path, fmt=fmt)
        asset["baked_path"] = str(out_path)

        # PBR map generation
        if not config.quality.preserve_pbr:
            normal = generate_normal_from_albedo(baked)
            normal_path = baked_dir / asset["category"] / rel_path.with_name(
                rel_path.stem + "_Normal"
            ).with_suffix(f".{fmt}")
            save_image(normal, normal_path, fmt=fmt)
            asset["baked_normal_path"] = str(normal_path)

            roughness = generate_roughness_from_albedo(baked)
            roughness_path = baked_dir / asset["category"] / rel_path.with_name(
                rel_path.stem + "_Roughness"
            ).with_suffix(f".{fmt}")
            save_image(roughness, roughness_path, fmt=fmt)
            asset["baked_roughness_path"] = str(roughness_path)

        baked_count += 1

    bake_manifest_path = config.output_dir / "bake_manifest.json"
    manifest["baked_count"] = baked_count
    save_json(manifest, bake_manifest_path)
    logger.info(f"Baking complete: {baked_count} assets baked")

    return bake_manifest_path
