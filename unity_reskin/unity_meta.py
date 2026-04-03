"""Unity .meta file parser — extract GUIDs, texture import settings, and sprite rects.

Unity .meta files use a YAML dialect with !u! type tags. We use ruamel.yaml with
custom constructors to handle these. For simpler cases we fall back to regex.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from ruamel.yaml import YAML


def _make_yaml_parser() -> YAML:
    """Create a YAML parser that tolerates Unity's !u! tags."""
    y = YAML()
    y.preserve_quotes = True

    # Unity tags like !u!1001 — just load them as plain mappings
    def _unity_tag_constructor(loader, tag_suffix, node):
        if hasattr(node, "value") and isinstance(node.value, list):
            return loader.construct_mapping(node, deep=True)
        return loader.construct_scalar(node)

    y.Constructor.add_multi_constructor("!u!", _unity_tag_constructor)
    # Also handle tag:unity3d.com tags
    y.Constructor.add_multi_constructor("tag:unity3d.com,", _unity_tag_constructor)

    return y


_yaml = _make_yaml_parser()


def parse_meta(path: Path) -> dict[str, Any]:
    """
    Parse a Unity .meta file, extracting:
    - guid: The asset GUID
    - texture_settings: maxTextureSize, filterMode, wrapMode, etc.
    - is_sprite_atlas: Whether this is a sprite atlas (spriteMode > 0)
    - sprite_rects: List of sub-sprite definitions [{name, x, y, w, h}, ...]
    - file_format_version: Meta file format version
    """
    result: dict[str, Any] = {
        "guid": None,
        "file_format_version": 2,
        "texture_settings": {},
        "is_sprite_atlas": False,
        "sprite_rects": [],
        "raw": {},
    }

    text = path.read_text(encoding="utf-8", errors="replace")

    # Fast GUID extraction with regex (works even if YAML parsing fails)
    guid_match = re.search(r"guid:\s*([a-f0-9]{32})", text)
    if guid_match:
        result["guid"] = guid_match.group(1)

    # Try full YAML parse
    try:
        docs = list(_yaml.load_all(text))
        if not docs:
            return result

        data = docs[0] if len(docs) == 1 else docs[0]
        if not isinstance(data, dict):
            return result

        result["raw"] = data
        result["file_format_version"] = data.get("fileFormatVersion", 2)

        if "guid" in data:
            result["guid"] = str(data["guid"])

        # TextureImporter settings
        tex_imp = data.get("TextureImporter", {})
        if tex_imp and isinstance(tex_imp, dict):
            result["texture_settings"] = {
                "max_texture_size": tex_imp.get("maxTextureSize", 2048),
                "filter_mode": tex_imp.get("filterMode", -1),
                "wrap_mode": tex_imp.get("wrapU", -1),
                "texture_format": tex_imp.get("textureFormat", -1),
                "sprite_mode": tex_imp.get("spriteMode", 0),
                "sprite_pixels_per_unit": tex_imp.get("spritePixelsPerUnit", 100),
                "npot_scale": tex_imp.get("npotScale", 0),
                "is_readable": tex_imp.get("isReadable", False),
                "generate_mip_maps": tex_imp.get("mipmapEnabled", True),
            }

            sprite_mode = tex_imp.get("spriteMode", 0)
            result["is_sprite_atlas"] = sprite_mode == 2  # 2 = Multiple

            # Extract sprite sheet rects
            sprite_sheet = tex_imp.get("spriteSheet", {})
            if isinstance(sprite_sheet, dict):
                sprites = sprite_sheet.get("sprites", [])
                if isinstance(sprites, list):
                    for sp in sprites:
                        if not isinstance(sp, dict):
                            continue
                        rect = sp.get("rect", {})
                        if isinstance(rect, dict):
                            result["sprite_rects"].append({
                                "name": sp.get("name", ""),
                                "x": float(rect.get("x", 0)),
                                "y": float(rect.get("y", 0)),
                                "w": float(rect.get("width", rect.get("z", 0))),
                                "h": float(rect.get("height", rect.get("w", 0))),
                            })

    except Exception:
        # YAML parse failed — we still have the regex-extracted GUID
        pass

    return result


def parse_material(path: Path) -> dict[str, Any]:
    """
    Parse a Unity .mat file to extract texture GUID references.
    Returns {property_name: guid} for all texture properties.
    """
    texture_refs: dict[str, str] = {}

    text = path.read_text(encoding="utf-8", errors="replace")

    # Regex approach — more reliable than YAML parsing for .mat files
    # Pattern: - _PropertyName:\n      m_Texture: {fileID: ..., guid: HEX, type: 3}
    pattern = re.compile(
        r"-\s+(\w+):\s*\n\s+m_Texture:\s*\{[^}]*guid:\s*([a-f0-9]{32})",
        re.MULTILINE,
    )
    for match in pattern.finditer(text):
        prop_name = match.group(1)
        guid = match.group(2)
        texture_refs[prop_name] = guid

    return {"texture_references": texture_refs}


def build_guid_map(assets_dir: Path) -> dict[str, Path]:
    """
    Build a GUID -> file path map by scanning all .meta files in Assets/.
    This is the master lookup for resolving texture references.
    """
    guid_map: dict[str, Path] = {}

    for meta_path in assets_dir.rglob("*.meta"):
        # The actual asset file is the meta path without .meta extension
        asset_path = meta_path.with_suffix("")
        if not asset_path.exists():
            continue

        text = meta_path.read_text(encoding="utf-8", errors="replace")
        guid_match = re.search(r"guid:\s*([a-f0-9]{32})", text)
        if guid_match:
            guid_map[guid_match.group(1)] = asset_path

    return guid_map


def validate_meta_preserved(original_meta: Path, current_meta: Path) -> bool:
    """Verify that a .meta file's GUID hasn't been corrupted during reskinning."""
    orig_text = original_meta.read_text(encoding="utf-8", errors="replace")
    curr_text = current_meta.read_text(encoding="utf-8", errors="replace")

    orig_guid = re.search(r"guid:\s*([a-f0-9]{32})", orig_text)
    curr_guid = re.search(r"guid:\s*([a-f0-9]{32})", curr_text)

    if not orig_guid or not curr_guid:
        return False

    return orig_guid.group(1) == curr_guid.group(1)
