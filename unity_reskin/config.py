"""Skin configuration loading and validation for Unity projects."""

from __future__ import annotations

import yaml
from dataclasses import dataclass, field
from pathlib import Path
from typing import Literal


ASSET_CATEGORIES = ("characters", "environment", "ui", "collectibles", "particles", "sprites")

BackendName = Literal["lucy", "stability", "comfyui", "local"]
OutputMode = Literal["project", "unitypackage"]


@dataclass
class QualitySettings:
    """Controls generation and baking quality."""

    strength: float = 0.75
    guidance_scale: float = 7.5
    steps: int = 30
    output_format: str = "png"
    preserve_pbr: bool = True
    tile_seam_fix: bool = True
    consistency_pass: bool = True


@dataclass
class SkinConfig:
    """Full configuration for a Unity reskin job."""

    name: str
    style_prompt: str
    unity_project_path: Path
    output_dir: Path
    backend: BackendName = "local"
    output_mode: OutputMode = "project"
    style_reference_images: list[Path] = field(default_factory=list)
    categories: list[str] = field(default_factory=lambda: list(ASSET_CATEGORIES))
    quality: QualitySettings = field(default_factory=QualitySettings)

    # Backend-specific config
    api_key: str | None = None
    api_url: str | None = None
    comfyui_workflow: Path | None = None

    # Sprite atlas handling
    atlas_mode: Literal["whole", "per_sprite", "auto"] = "auto"

    # Metadata
    author: str = ""
    description: str = ""
    version: str = "1.0.0"

    def assets_dir(self) -> Path:
        return self.unity_project_path / "Assets"

    def staging_dir(self) -> Path:
        return self.output_dir / "staging"

    def extracted_dir(self) -> Path:
        return self.output_dir / "extracted"

    def generated_dir(self) -> Path:
        return self.output_dir / "generated"

    def baked_dir(self) -> Path:
        return self.output_dir / "baked"

    def package_dir(self) -> Path:
        return self.output_dir / "package"


def load_config(path: Path) -> SkinConfig:
    """Load a SkinConfig from a YAML file."""
    with open(path) as f:
        raw = yaml.safe_load(f)

    quality_raw = raw.pop("quality", {})
    quality = QualitySettings(**quality_raw)

    config_dir = path.parent
    for key in ("unity_project_path", "output_dir", "comfyui_workflow"):
        if raw.get(key):
            p = Path(raw[key])
            if not p.is_absolute():
                raw[key] = config_dir / p
            else:
                raw[key] = p

    ref_images = raw.pop("style_reference_images", [])
    resolved_refs = []
    for img in ref_images:
        p = Path(img)
        resolved_refs.append(p if p.is_absolute() else config_dir / p)

    return SkinConfig(
        **raw,
        style_reference_images=resolved_refs,
        quality=quality,
    )
