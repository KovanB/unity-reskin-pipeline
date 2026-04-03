"""Job management — create, track, and run Unity reskin pipeline jobs."""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .models import CreateJobRequest, JobProgress, JobResponse, JobStatus

import os

_jobs: dict[str, dict[str, Any]] = {}
_subscribers: dict[str, list[asyncio.Queue]] = {}

JOBS_DIR = Path(os.environ.get("DATA_DIR", "/tmp/unity-reskin-data")) / "jobs"


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _job_dir(job_id: str) -> Path:
    return JOBS_DIR / job_id


def _to_response(job: dict) -> JobResponse:
    job_dir = _job_dir(job["id"])
    package_dir = job_dir / "output" / "package"

    preview_urls = []
    preview_dir = job_dir / "output" / "generated"
    if preview_dir.exists():
        for img in sorted(preview_dir.rglob("*.png"))[:12]:
            preview_urls.append(f"/api/jobs/{job['id']}/preview/{img.relative_to(preview_dir)}")

    download_url = None
    if job["progress"].status == JobStatus.COMPLETED and package_dir.exists():
        download_url = f"/api/jobs/{job['id']}/download"

    return JobResponse(
        id=job["id"],
        name=job["name"],
        status=job["progress"].status,
        style_prompt=job["style_prompt"],
        backend=job["backend"],
        output_mode=job.get("output_mode", "project"),
        created_at=job["created_at"],
        updated_at=job["updated_at"],
        progress=job["progress"],
        asset_count=job.get("asset_count", 0),
        preview_urls=preview_urls,
        download_url=download_url,
        error=job.get("error"),
    )


async def _notify(job_id: str, progress: JobProgress) -> None:
    for queue in _subscribers.get(job_id, []):
        await queue.put(progress.model_dump())


def subscribe(job_id: str) -> asyncio.Queue:
    queue: asyncio.Queue = asyncio.Queue()
    _subscribers.setdefault(job_id, []).append(queue)
    return queue


def unsubscribe(job_id: str, queue: asyncio.Queue) -> None:
    subs = _subscribers.get(job_id, [])
    if queue in subs:
        subs.remove(queue)


def create_job(req: CreateJobRequest, unity_project_path: str) -> JobResponse:
    job_id = uuid.uuid4().hex[:12]
    job_dir = _job_dir(job_id)
    job_dir.mkdir(parents=True, exist_ok=True)

    job = {
        "id": job_id,
        "name": req.name,
        "style_prompt": req.style_prompt,
        "backend": req.backend.value,
        "output_mode": req.output_mode.value,
        "categories": req.categories,
        "quality": req.quality.model_dump(),
        "atlas_mode": req.atlas_mode,
        "api_key": req.api_key,
        "author": req.author,
        "description": req.description,
        "unity_project_path": unity_project_path,
        "created_at": _now(),
        "updated_at": _now(),
        "progress": JobProgress(status=JobStatus.PENDING),
    }
    _jobs[job_id] = job
    return _to_response(job)


def get_job(job_id: str) -> JobResponse | None:
    job = _jobs.get(job_id)
    return _to_response(job) if job else None


def list_jobs() -> list[JobResponse]:
    return [_to_response(j) for j in sorted(_jobs.values(), key=lambda j: j["created_at"], reverse=True)]


def get_job_dir(job_id: str) -> Path:
    return _job_dir(job_id)
