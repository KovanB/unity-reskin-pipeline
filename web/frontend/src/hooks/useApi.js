const API_BASE = import.meta.env.VITE_API_URL || "";

async function apiFetch(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json();
}

export function createJob(form, projectPath) {
  return apiFetch(`/api/jobs?unity_project_path=${encodeURIComponent(projectPath)}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(form),
  });
}

export function listJobs() {
  return apiFetch("/api/jobs");
}

export function getJob(id) {
  return apiFetch(`/api/jobs/${id}`);
}

export function getJobAssets(id) {
  return apiFetch(`/api/jobs/${id}/assets`);
}

export function uploadProject(file) {
  const formData = new FormData();
  formData.append("file", file);
  return apiFetch("/api/upload/project", { method: "POST", body: formData });
}

export function connectJobSSE(jobId, onEvent) {
  const url = `${API_BASE}/api/jobs/${jobId}/run`;
  const es = new EventSource(url);
  es.onmessage = (e) => {
    try {
      onEvent(JSON.parse(e.data));
    } catch {}
  };
  es.onerror = () => {
    es.close();
    onEvent({ status: "failed", message: "Connection lost" });
  };
  return es;
}
