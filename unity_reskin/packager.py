"""Package baked assets back into a Unity project or .unitypackage.

Mode 1 (project): Copy entire Unity project, replace textures in-place,
preserve all .meta files. Result opens directly in Unity Editor.

Mode 2 (unitypackage): Create a .unitypackage file (gzip'd tar) with the
standard Unity import structure. Users drag-and-drop into their project.
"""

from __future__ import annotations

import gzip
import io
import os
import shutil
import tarfile
from pathlib import Path

from .config import SkinConfig
from .utils import load_json, logger, save_json


def sanitize_name(name: str) -> str:
    """Convert skin name to a safe identifier."""
    return "".join(c if c.isalnum() else "_" for c in name)


def _copy_project_with_reskins(
    assets: list[dict],
    source_project: Path,
    dest_project: Path,
) -> int:
    """
    Copy the entire Unity project, then overwrite textures with baked versions.
    All .meta files are preserved from the original — GUIDs stay intact.
    """
    # Copy the full project tree (skip Library/ and Temp/ — Unity regenerates these)
    if dest_project.exists():
        shutil.rmtree(dest_project)

    def ignore_fn(directory, files):
        skip = set()
        dir_name = os.path.basename(directory)
        if dir_name in ("Library", "Temp", "obj", "Logs", ".git"):
            skip = set(files)
        return skip

    shutil.copytree(source_project, dest_project, ignore=ignore_fn)
    logger.info(f"Copied project to: {dest_project}")

    # Overwrite textures with baked versions
    count = 0
    for asset in assets:
        baked_path = asset.get("baked_path")
        if not baked_path or not Path(baked_path).exists():
            continue

        rel = Path(asset["relative_path"])
        dest = dest_project / "Assets" / rel

        if dest.exists():
            shutil.copy2(baked_path, dest)
            count += 1
            logger.debug(f"  Replaced: {rel}")

    return count


def _build_unitypackage(
    assets: list[dict],
    source_project: Path,
    output_path: Path,
) -> int:
    """
    Build a .unitypackage file.

    Unity package format is a gzip'd tar containing:
      {guid}/
        asset         — the actual file
        asset.meta    — the .meta file
        pathname      — text file with "Assets/path/to/file.png"
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    count = 0
    with tarfile.open(output_path, "w:gz") as tar:
        for asset in assets:
            baked_path = asset.get("baked_path")
            guid = asset.get("guid")
            if not baked_path or not Path(baked_path).exists() or not guid:
                continue

            rel = Path(asset["relative_path"])
            meta_path = asset.get("meta_path")

            # Add asset file
            tar.add(baked_path, arcname=f"{guid}/asset")

            # Add .meta file
            if meta_path and Path(meta_path).exists():
                tar.add(meta_path, arcname=f"{guid}/asset.meta")

            # Add pathname file
            pathname = f"Assets/{str(rel).replace(chr(92), '/')}"
            pathname_bytes = pathname.encode("utf-8")
            info = tarfile.TarInfo(name=f"{guid}/pathname")
            info.size = len(pathname_bytes)
            tar.addfile(info, io.BytesIO(pathname_bytes))

            count += 1

    return count


def package(config: SkinConfig) -> Path:
    """
    Run the packaging phase:
    1. Load bake manifest
    2. Build output in configured mode (project or unitypackage)
    3. Write skin manifest

    Returns path to the packaged output.
    """
    bake_manifest_path = config.output_dir / "bake_manifest.json"
    manifest = load_json(bake_manifest_path)
    assets = manifest["assets"]

    skin_name = sanitize_name(config.name)
    package_dir = config.package_dir()
    package_dir.mkdir(parents=True, exist_ok=True)

    logger.info(f"Packaging skin: {skin_name} (mode: {config.output_mode})")

    if config.output_mode == "unitypackage":
        # Mode 2: .unitypackage export
        pkg_path = package_dir / f"{skin_name}.unitypackage"
        count = _build_unitypackage(assets, config.unity_project_path, pkg_path)
        logger.info(f"  Built .unitypackage with {count} assets: {pkg_path}")
        output_path = pkg_path
    else:
        # Mode 1: Full project copy with in-place replacement
        project_dir = package_dir / f"{skin_name}_Project"
        count = _copy_project_with_reskins(assets, config.unity_project_path, project_dir)
        logger.info(f"  Replaced {count} textures in project copy: {project_dir}")
        output_path = project_dir

    # Write skin manifest
    skin_manifest = {
        "name": config.name,
        "skin_id": skin_name,
        "engine": "unity",
        "output_mode": config.output_mode,
        "author": config.author,
        "description": config.description,
        "version": config.version,
        "asset_count": count,
        "categories": list(set(a["category"] for a in assets if a.get("baked_path"))),
        "atlas_count": sum(1 for a in assets if a.get("is_atlas") and a.get("baked_path")),
    }
    save_json(skin_manifest, package_dir / "skin_manifest.json")

    logger.info(f"Package ready at: {output_path}")
    return output_path
