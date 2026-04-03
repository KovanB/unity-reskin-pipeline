const STATUS_BADGES = {
  pending: { cls: "badge-pending", label: "Pending" },
  extracting: { cls: "badge-running", label: "Extracting" },
  generating: { cls: "badge-running", label: "Generating" },
  baking: { cls: "badge-running", label: "Baking" },
  packaging: { cls: "badge-running", label: "Packaging" },
  completed: { cls: "badge-completed", label: "Completed" },
  failed: { cls: "badge-failed", label: "Failed" },
};

export default function JobCard({ job, onClick }) {
  const badge = STATUS_BADGES[job.status] || STATUS_BADGES.pending;
  const isRunning = ["extracting", "generating", "baking", "packaging"].includes(job.status);
  const pct = job.progress?.percent || 0;

  return (
    <div className="card" style={{ cursor: "pointer" }} onClick={() => onClick(job)}>
      <div className="job-card">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontWeight: 600, fontSize: 15 }}>{job.name}</span>
            <span className={`badge ${badge.cls}`}>{badge.label}</span>
          </div>
          <div className="job-meta">
            <span>{job.backend}</span>
            <span>{job.output_mode || "project"}</span>
            {job.asset_count > 0 && <span>{job.asset_count} assets</span>}
            <span>{new Date(job.created_at).toLocaleTimeString()}</span>
          </div>
          {isRunning && (
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${pct}%` }} />
            </div>
          )}
        </div>
        <div>
          {job.status === "completed" && job.download_url && (
            <a href={job.download_url} className="btn btn-unity" style={{ fontSize: 13, padding: "6px 14px" }}
              onClick={(e) => e.stopPropagation()}>
              Download
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
