"""CLI entry point for the Unity reskin pipeline."""

from __future__ import annotations

from pathlib import Path

import click

from .config import load_config
from .utils import setup_logging, logger


@click.group()
@click.option("-v", "--verbose", is_flag=True, help="Enable debug logging")
def cli(verbose: bool) -> None:
    """Unity Reskin Pipeline — AI reskin generator for Unity game assets."""
    setup_logging(verbose)


@cli.command()
@click.option("-p", "--project", type=click.Path(exists=True, path_type=Path), help="Unity project path (overrides config)")
@click.option("-c", "--config", "config_path", required=True, type=click.Path(exists=True, path_type=Path), help="Skin config YAML")
def extract(project: Path | None, config_path: Path) -> None:
    """Extract and categorize textures from a Unity project."""
    from .extractor import extract as run_extract

    config = load_config(config_path)
    if project:
        config.unity_project_path = project

    manifest_path = run_extract(config)
    click.echo(f"Extraction complete: {manifest_path}")


@cli.command()
@click.option("-c", "--config", "config_path", required=True, type=click.Path(exists=True, path_type=Path), help="Skin config YAML")
@click.option("-b", "--backend", type=click.Choice(["lucy", "stability", "comfyui", "local"]), help="Override generation backend")
def generate(config_path: Path, backend: str | None) -> None:
    """Generate reskinned textures using AI."""
    from .generator import generate as run_generate

    config = load_config(config_path)
    if backend:
        config.backend = backend

    manifest_path = run_generate(config)
    click.echo(f"Generation complete: {manifest_path}")


@cli.command()
@click.option("-c", "--config", "config_path", required=True, type=click.Path(exists=True, path_type=Path), help="Skin config YAML")
def bake(config_path: Path) -> None:
    """Bake generated textures into Unity-compatible formats."""
    from .baker import bake as run_bake
    from .consistency import consistency_pass

    config = load_config(config_path)
    run_bake(config)

    if config.quality.consistency_pass:
        logger.info("Running consistency pass...")
        consistency_pass(config)

    click.echo("Bake complete")


@cli.command()
@click.option("-c", "--config", "config_path", required=True, type=click.Path(exists=True, path_type=Path), help="Skin config YAML")
@click.option("-m", "--mode", type=click.Choice(["project", "unitypackage"]), help="Override output mode")
def package(config_path: Path, mode: str | None) -> None:
    """Package baked assets into a Unity project or .unitypackage."""
    from .packager import package as run_package

    config = load_config(config_path)
    if mode:
        config.output_mode = mode

    output = run_package(config)
    click.echo(f"Package ready at: {output}")


@cli.command()
@click.option("-c", "--config", "config_path", required=True, type=click.Path(exists=True, path_type=Path), help="Skin config YAML")
@click.option("-b", "--backend", type=click.Choice(["lucy", "stability", "comfyui", "local"]), help="Override generation backend")
@click.option("-m", "--mode", type=click.Choice(["project", "unitypackage"]), help="Override output mode")
def run(config_path: Path, backend: str | None, mode: str | None) -> None:
    """Run the full reskin pipeline end-to-end."""
    from .extractor import extract as run_extract
    from .generator import generate as run_generate
    from .baker import bake as run_bake
    from .consistency import consistency_pass
    from .packager import package as run_package

    config = load_config(config_path)
    if backend:
        config.backend = backend
    if mode:
        config.output_mode = mode

    click.echo(f"=== Unity Reskin Pipeline: {config.name} ===\n")

    click.echo("--- Step 1/4: Extraction ---")
    run_extract(config)

    click.echo("\n--- Step 2/4: Generation ---")
    run_generate(config)

    click.echo("\n--- Step 3/4: Baking ---")
    run_bake(config)

    if config.quality.consistency_pass:
        click.echo("\n--- Step 3.5/4: Consistency Pass ---")
        consistency_pass(config)

    click.echo("\n--- Step 4/4: Packaging ---")
    output = run_package(config)

    click.echo(f"\n=== Done! Skin packaged at: {output} ===")
    if config.output_mode == "project":
        click.echo("Open this folder in Unity Editor to build your reskinned game.")
    else:
        click.echo("Import this .unitypackage into your Unity project to apply the skin.")


if __name__ == "__main__":
    cli()
