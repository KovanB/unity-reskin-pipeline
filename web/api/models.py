"""Pydantic models for the Unity reskin web API."""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class JobStatus(str, Enum):
    PENDING = "pending"
    EXTRACTING = "extracting"
    GENERATING = "generating"
    BAKING = "baking"
    PACKAGING = "packaging"
    COMPLETED = "completed"
    FAILED = "failed"


class BackendChoice(str, Enum):
    LUCY = "lucy"
    STABILITY = "stability"
    COMFYUI = "comfyui"
    LOCAL = "local"


class OutputModeChoice(str, Enum):
    PROJECT = "project"
    UNITYPACKAGE = "unitypackage"


class QualitySettingsInput(BaseModel):
    strength: float = Field(0.75, ge=0.0, le=1.0)
    guidance_scale: float = Field(7.5, ge=1.0, le=30.0)
    steps: int = Field(30, ge=1, le=100)
    preserve_pbr: bool = True
    tile_seam_fix: bool = True
    consistency_pass: bool = True


class CreateJobRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    style_prompt: str = Field(..., min_length=1)
    backend: BackendChoice = BackendChoice.LUCY
    output_mode: OutputModeChoice = OutputModeChoice.PROJECT
    categories: list[str] = ["characters", "environment", "ui", "collectibles", "particles", "sprites"]
    quality: QualitySettingsInput = QualitySettingsInput()
    atlas_mode: str = "auto"
    api_key: str | None = None
    author: str = ""
    description: str = ""


class JobProgress(BaseModel):
    status: JobStatus
    stage: str = ""
    current: int = 0
    total: int = 0
    message: str = ""
    percent: float = 0.0


class JobResponse(BaseModel):
    id: str
    name: str
    status: JobStatus
    style_prompt: str
    backend: str
    output_mode: str
    created_at: datetime
    updated_at: datetime
    progress: JobProgress
    asset_count: int = 0
    preview_urls: list[str] = []
    download_url: str | None = None
    error: str | None = None


class JobListResponse(BaseModel):
    jobs: list[JobResponse]
    total: int
