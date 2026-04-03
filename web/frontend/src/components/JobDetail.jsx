import { useEffect, useState, useRef } from "react";
import { getJob, getJobAssets, connectJobSSE } from "../hooks/useApi";

export default function JobDetail({ jobId, onBack }) {
  const [job, setJob] = useState(null);
  const [assets, setAssets] = useState([]);
  const [tab, setTab] = useState("preview");
  const [compareIdx, setCompareIdx] = useState(0);
  const [progress, setProgress] = useState(null);
  const esRef = useRef(null);

  useEffect(() => {
    getJob(jobId).then(setJob).catch(() => {});
  }, [jobId]);

  // Auto-start SSE for pending jobs
  useEffect(() => {
    if (!job || job.status !== "pending") return;

    const es = connectJobSSE(jobId, (ev) => {
      setProgress(ev);
      if (ev.status === "completed" || ev.status === "failed") {
        getJob(jobId).then(setJob);
        getJobAssets(jobId).then((r) => setAssets(r.assets || [])).catch(() => {});
      }
    });
    esRef.current = es;
    return () => es.close();
  }, [job?.status]);

  // Load assets if job is already done
  useEffect(() => {
    if (job && job.status === "completed") {
      getJobAssets(jobId).then((r) => setAssets(r.assets || [])).catch(() => {});
    }
  }, [job?.status]);

  if (!job) return <div style={{ padding: 24 }}>Loading...</div>;

  const isRunning = ["extracting", "generating", "baking", "packaging"].includes(progress?.status || job.status);
  const isDone = (progress?.status || job.status) === "completed";
  const isFailed = (progress?.status || job.status) === "failed";
  const pct = progress?.percent || job.progress?.percent || 0;
  const assetsWithPreview = assets.filter((a) => a.preview_url);

  return (
    <div>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 16 }}>
        Back to Jobs
      </button>

      <div className="card">
        <div className="card-header">
          <h2 className="card-title">{job.name}</h2>
          <span className={`badge ${isDone ? "badge-completed" : isFailed ? "badge-failed" : isRunning ? "badge-running" : "badge-pending"}`}>
            {progress?.status || job.status}
          </span>
        </div>

        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>
          {job.style_prompt}
        </div>

        <div className="job-meta" style={{ marginBottom: 16 }}>
          <span>Backend: {job.backend}</span>
          <span>Output: {job.output_mode || "project"}</span>
          <span>Assets: {job.asset_count}</span>
        </div>

        {isRunning && (
          <div>
            <div style={{ fontSize: 13, color: "var(--accent)", marginBottom: 6 }}>
              {progress?.message || "Processing..."}
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          </div>
        )}

        {isDone && job.download_url && (
          <a href={job.download_url} className="btn btn-unity" style={{ marginTop: 12 }}>
            Download {job.output_mode === "unitypackage" ? ".unitypackage" : "Project"}
          </a>
        )}

        {isFailed && (
          <div style={{ color: "var(--error)", fontSize: 13, marginTop: 12 }}>
            {progress?.message || job.error || "Pipeline failed"}
          </div>
        )}
      </div>

      {/* Asset Browser */}
      {assetsWithPreview.length > 0 && (
        <div className="card">
          <div className="tabs">
            <button className={`tab ${tab === "preview" ? "active" : ""}`} onClick={() => setTab("preview")}>
              Preview Grid
            </button>
            <button className={`tab ${tab === "compare" ? "active" : ""}`} onClick={() => setTab("compare")}>
              Before / After
            </button>
          </div>

          {tab === "preview" && (
            <div className="preview-grid">
              {assetsWithPreview.map((asset, i) => (
                <div key={asset.relative_path} className="preview-item" onClick={() => { setCompareIdx(i); setTab("compare"); }}>
                  <img src={asset.preview_url} alt={asset.relative_path} />
                  <div className="preview-overlay">
                    {asset.relative_path.split("/").pop()}
                    {asset.is_atlas && <span className="atlas-badge">ATLAS</span>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === "compare" && assetsWithPreview[compareIdx] && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" }}>
                {assetsWithPreview.map((a, i) => (
                  <button key={a.relative_path}
                    className={`btn ${i === compareIdx ? "btn-primary" : "btn-secondary"}`}
                    style={{ padding: "4px 12px", fontSize: 12 }}
                    onClick={() => setCompareIdx(i)}>
                    {a.relative_path.split("/").pop()}
                    {a.is_atlas && <span className="atlas-badge">ATLAS</span>}
                  </button>
                ))}
              </div>
              <div className="compare-container">
                <div className="compare-side">
                  <div className="compare-label">Before</div>
                  <img src={assetsWithPreview[compareIdx].original_url} alt="Original" />
                </div>
                <div className="compare-side">
                  <div className="compare-label" style={{ color: "var(--unity)" }}>After</div>
                  <img src={assetsWithPreview[compareIdx].preview_url} alt="Reskinned" />
                </div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                {assetsWithPreview[compareIdx].width}x{assetsWithPreview[compareIdx].height}
                {" | "}{assetsWithPreview[compareIdx].category}
                {assetsWithPreview[compareIdx].guid && ` | GUID: ${assetsWithPreview[compareIdx].guid.slice(0, 8)}...`}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
