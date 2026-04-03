"""Sprite atlas decomposition and recomposition for Unity sprite sheets.

Unity sprite atlases pack multiple sub-sprites into a single texture.
The .meta file defines each sprite's rect within the atlas.
This module handles splitting them apart for AI reskinning and
stitching them back together afterward.
"""

from __future__ import annotations

from PIL import Image


def decompose_atlas(
    atlas_img: Image.Image,
    sprite_rects: list[dict],
) -> dict[str, Image.Image]:
    """
    Cut a sprite atlas into individual sprite images.

    Unity sprite rects use bottom-left origin (y=0 is bottom of image),
    so we need to flip the y coordinate.

    Args:
        atlas_img: The full atlas image
        sprite_rects: List of {name, x, y, w, h} from .meta

    Returns:
        Dict mapping sprite name to cropped Image
    """
    sprites: dict[str, Image.Image] = {}
    atlas_h = atlas_img.height

    for rect in sprite_rects:
        name = rect.get("name", "")
        rx = int(rect["x"])
        # Flip Y: Unity y=0 is bottom, PIL y=0 is top
        ry = atlas_h - int(rect["y"]) - int(rect["h"])
        rw = int(rect["w"])
        rh = int(rect["h"])

        if rw <= 0 or rh <= 0:
            continue

        # Clamp to atlas bounds
        rx = max(0, rx)
        ry = max(0, ry)
        rx2 = min(atlas_img.width, rx + rw)
        ry2 = min(atlas_img.height, ry + rh)

        sprite = atlas_img.crop((rx, ry, rx2, ry2))
        sprites[name] = sprite

    return sprites


def recompose_atlas(
    reskinned_sprites: dict[str, Image.Image],
    sprite_rects: list[dict],
    atlas_size: tuple[int, int],
    background: Image.Image | None = None,
) -> Image.Image:
    """
    Reassemble reskinned sprites back into a full atlas.

    Args:
        reskinned_sprites: Dict mapping sprite name to reskinned Image
        sprite_rects: Original rect definitions from .meta
        atlas_size: (width, height) of the output atlas
        background: Optional background image (e.g. the AI-reskinned whole atlas)

    Returns:
        The recomposed atlas Image
    """
    if background is not None:
        atlas = background.copy()
        if atlas.size != atlas_size:
            atlas = atlas.resize(atlas_size, Image.LANCZOS)
    else:
        atlas = Image.new("RGBA", atlas_size, (0, 0, 0, 0))

    atlas_h = atlas_size[1]

    for rect in sprite_rects:
        name = rect.get("name", "")
        if name not in reskinned_sprites:
            continue

        sprite = reskinned_sprites[name]
        rx = int(rect["x"])
        ry = atlas_h - int(rect["y"]) - int(rect["h"])
        rw = int(rect["w"])
        rh = int(rect["h"])

        if rw <= 0 or rh <= 0:
            continue

        # Resize sprite to match original rect dimensions
        if sprite.size != (rw, rh):
            sprite = sprite.resize((rw, rh), Image.LANCZOS)

        # Paste into atlas
        rx = max(0, rx)
        ry = max(0, ry)
        atlas.paste(sprite, (rx, ry), sprite if sprite.mode == "RGBA" else None)

    return atlas


def detect_atlas_mode(asset_info: dict, config_mode: str = "auto") -> str:
    """
    Decide whether to reskin the whole atlas or individual sprites.

    Returns "whole" or "per_sprite".
    """
    if config_mode != "auto":
        return config_mode

    sprite_rects = asset_info.get("sprite_rects", [])
    num_sprites = len(sprite_rects)

    if num_sprites == 0:
        return "whole"

    # Small number of large sprites → per-sprite is better
    # Large number of small sprites → whole atlas is faster and often good enough
    if num_sprites <= 8:
        return "per_sprite"
    elif num_sprites <= 32:
        # Check average sprite size — if they're big enough, do per-sprite
        if sprite_rects:
            avg_area = sum(r.get("w", 0) * r.get("h", 0) for r in sprite_rects) / num_sprites
            if avg_area > 64 * 64:
                return "per_sprite"
        return "whole"
    else:
        return "whole"
