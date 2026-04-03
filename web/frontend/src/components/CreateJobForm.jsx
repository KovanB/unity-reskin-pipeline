import { useState } from "react";
import { createJob, uploadProject } from "../hooks/useApi";

const BACKENDS = [
  { value: "lucy", label: "Decart Lucy (Recommended)" },
  { value: "local", label: "Local Diffusion (SDXL-Turbo)" },
  { value: "stability", label: "Stability AI" },
  { value: "comfyui", label: "ComfyUI (Local Server)" },
];

const CATEGORIES = ["characters", "environment", "ui", "collectibles", "particles", "sprites"];

const DEMO_CHARACTERS = ["Jake", "Tricky", "Fresh", "Yutani", "Spike"];

const PUBLIC_DOMAIN_PRESETS = [
  {
    name: "DraculaGothic",
    label: "Dracula",
    style_prompt: "Dracula gothic horror aesthetic, Transylvanian castle architecture, dark crimson and midnight purple palette, bat silhouettes, full moon, cobblestone streets, iron gates, candelabras, fog particles, gothic stained glass, Victorian horror style",
    description: "Gothic Transylvania runner fleeing through moonlit castle corridors and misty graveyards",
  },
  {
    name: "AliceWonderland",
    label: "Alice in Wonderland",
    style_prompt: "Alice in Wonderland aesthetic, whimsical Victorian fantasy, playing card motifs, checkerboard patterns, oversized mushrooms, teacup and pocket watch details, pastel purple and teal palette, storybook illustration style",
    description: "Wonderland-themed runner with playing card guards and mushroom obstacles",
  },
  {
    name: "RobinHood",
    label: "Robin Hood",
    style_prompt: "Robin Hood medieval forest aesthetic, Sherwood Forest deep greens and earthy browns, medieval English village, wooden architecture, archery targets, wanted posters, leaf and vine motifs, rustic hand-painted style",
    description: "Sherwood Forest runner dodging the Sheriff's guards and collecting gold coins",
  },
  {
    name: "WizardOfOz",
    label: "Wizard of Oz",
    style_prompt: "Wizard of Oz aesthetic, yellow brick road textures, emerald green Emerald City architecture, poppy fields, tornado particles, ruby red and emerald green palette, whimsical storybook style, rainbow skybox",
    description: "Oz-themed runner dashing down the Yellow Brick Road toward the Emerald City",
  },
  {
    name: "Frankenstein",
    label: "Frankenstein",
    style_prompt: "Frankenstein gothic laboratory aesthetic, dark stone castle, electrical sparks and lightning, green-tinted torchlight, bubbling chemistry equipment, stitched leather textures, stormy night atmosphere, mad science horror style",
    description: "Gothic laboratory runner through Dr. Frankenstein's castle during a thunderstorm",
  },
];

const STYLE_PRESETS = [
  { name: "Cyberpunk Neon", prompt: "cyberpunk neon aesthetic, glowing edges, dark background with vibrant pink and cyan accents, holographic shimmer" },
  { name: "Cel Shaded", prompt: "cel-shaded cartoon style, bold black outlines, flat vibrant colors, anime inspired, Borderlands aesthetic" },
  { name: "Vaporwave", prompt: "vaporwave aesthetic, pastel pink and purple, chrome reflections, retro 80s, sunset gradients, glitch art" },
  { name: "Ice Frost", prompt: "frozen ice crystal aesthetic, pale blue and white, frost patterns, translucent icy surfaces, arctic winter" },
  { name: "Lava Infernal", prompt: "molten lava and fire, glowing orange cracks, charred black surface, ember particles, volcanic demon" },
];

export default function CreateJobForm({ onCreated }) {
  const [form, setForm] = useState({
    name: "",
    style_prompt: "",
    backend: "lucy",
    output_mode: "project",
    categories: [...CATEGORIES],
    atlas_mode: "auto",
    author: "",
    description: "",
    api_key: "",
    quality: { strength: 0.75, guidance_scale: 7.5, steps: 30, preserve_pbr: true, tile_seam_fix: true, consistency_pass: true },
  });
  const [projectPath, setProjectPath] = useState("demo");
  const [useDemo, setUseDemo] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const update = (key, val) => setForm((f) => ({ ...f, [key]: val }));
  const updateQuality = (key, val) => setForm((f) => ({ ...f, quality: { ...f.quality, [key]: val } }));

  const toggleCategory = (cat) => {
    setForm((f) => {
      const cats = f.categories.includes(cat) ? f.categories.filter((c) => c !== cat) : [...f.categories, cat];
      return { ...f, categories: cats };
    });
  };

  const handleUpload = async (file) => {
    setUploading(true);
    try {
      const result = await uploadProject(file);
      setProjectPath(result.project_path);
      setUseDemo(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const job = await createJob(form, useDemo ? "demo" : projectPath);
      onCreated(job);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const needsApiKey = form.backend === "stability";

  return (
    <form onSubmit={handleSubmit} className="card">
      <div className="card-header">
        <h2 className="card-title">New Unity Reskin Job</h2>
      </div>

      {error && <div style={{ color: "var(--error)", marginBottom: 16, fontSize: 13 }}>{error}</div>}

      <div className="form-row">
        <div className="form-group">
          <label>Skin Name</label>
          <input className="form-input" value={form.name} onChange={(e) => update("name", e.target.value)} placeholder="DraculaGothic" required />
        </div>
        <div className="form-group">
          <label>Backend</label>
          <select className="form-select" value={form.backend} onChange={(e) => update("backend", e.target.value)}>
            {BACKENDS.map((b) => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </div>
      </div>

      {/* Public Domain Presets */}
      <div className="form-group">
        <label>Public Domain Skins (free to use)</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PUBLIC_DOMAIN_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className={`btn ${form.name === preset.name ? "btn-unity" : "btn-secondary"}`}
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => setForm((f) => ({ ...f, name: preset.name, style_prompt: preset.style_prompt, description: preset.description }))}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Style Presets */}
      <div className="form-group">
        <label>Style Presets</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {STYLE_PRESETS.map((preset) => (
            <button
              key={preset.name}
              type="button"
              className="btn btn-secondary"
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => update("style_prompt", preset.prompt)}
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      <div className="form-group">
        <label>Style Prompt</label>
        <textarea
          className="form-textarea"
          value={form.style_prompt}
          onChange={(e) => update("style_prompt", e.target.value)}
          placeholder="Describe the visual style you want..."
          required
        />
      </div>

      {needsApiKey && (
        <div className="form-group">
          <label>API Key</label>
          <input className="form-input" type="password" value={form.api_key} onChange={(e) => update("api_key", e.target.value)} placeholder="sk-..." />
        </div>
      )}

      {/* Source project */}
      <div className="form-group">
        <label>Source Project</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <button type="button" className={`btn ${useDemo ? "btn-unity" : "btn-secondary"}`}
            onClick={() => { setUseDemo(true); setProjectPath("demo"); }}>
            Demo Characters (5 Subway Surfers-style)
          </button>
          <button type="button" className={`btn ${!useDemo ? "btn-unity" : "btn-secondary"}`}
            onClick={() => setUseDemo(false)}>
            Upload Unity Project
          </button>
        </div>

        {useDemo ? (
          <div style={{ background: "var(--bg-input)", borderRadius: 8, padding: 16 }}>
            <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 10 }}>
              5 characters with Body, Face, Shoes, Board, and Hat textures each (25 total assets):
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {DEMO_CHARACTERS.map((c) => (
                <span key={c} style={{
                  padding: "4px 12px", borderRadius: 6, fontSize: 13, fontWeight: 500,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                }}>{c}</span>
              ))}
            </div>
          </div>
        ) : (
          <div className="form-row">
            <input className="form-input" value={projectPath === "demo" ? "" : projectPath}
              onChange={(e) => setProjectPath(e.target.value)}
              placeholder="Path to Unity project or upload zip" />
            <label className="btn btn-secondary" style={{ justifyContent: "center" }}>
              {uploading ? "Uploading..." : "Upload .zip"}
              <input type="file" accept=".zip" style={{ display: "none" }}
                onChange={(e) => e.target.files[0] && handleUpload(e.target.files[0])} />
            </label>
          </div>
        )}
      </div>

      <div className="form-group">
        <label>Asset Categories</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {CATEGORIES.map((cat) => (
            <button key={cat} type="button"
              className={`btn ${form.categories.includes(cat) ? "btn-primary" : "btn-secondary"}`}
              style={{ padding: "6px 14px", fontSize: 13 }}
              onClick={() => toggleCategory(cat)}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Output Mode</label>
          <select className="form-select" value={form.output_mode} onChange={(e) => update("output_mode", e.target.value)}>
            <option value="project">Full Unity Project</option>
            <option value="unitypackage">.unitypackage (import file)</option>
          </select>
        </div>
        <div className="form-group">
          <label>Sprite Atlas Mode</label>
          <select className="form-select" value={form.atlas_mode} onChange={(e) => update("atlas_mode", e.target.value)}>
            <option value="auto">Auto (recommended)</option>
            <option value="whole">Whole Atlas</option>
            <option value="per_sprite">Per Sprite</option>
          </select>
        </div>
      </div>

      <div className="form-group">
        <label>Strength: {form.quality.strength}</label>
        <div className="slider-group">
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Keep original</span>
          <input type="range" min="0" max="1" step="0.05" value={form.quality.strength} onChange={(e) => updateQuality("strength", parseFloat(e.target.value))} />
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Full restyle</span>
        </div>
      </div>

      <div className="form-row">
        <div className="form-group">
          <label>Author</label>
          <input className="form-input" value={form.author} onChange={(e) => update("author", e.target.value)} placeholder="Your name" />
        </div>
        <div className="form-group">
          <label>Description</label>
          <input className="form-input" value={form.description} onChange={(e) => update("description", e.target.value)} placeholder="What this skin does" />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
          <input type="checkbox" checked={form.quality.preserve_pbr} onChange={(e) => updateQuality("preserve_pbr", e.target.checked)} />
          Preserve PBR maps
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
          <input type="checkbox" checked={form.quality.tile_seam_fix} onChange={(e) => updateQuality("tile_seam_fix", e.target.checked)} />
          Fix tile seams
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
          <input type="checkbox" checked={form.quality.consistency_pass} onChange={(e) => updateQuality("consistency_pass", e.target.checked)} />
          Consistency pass
        </label>
      </div>

      <div style={{ marginTop: 20 }}>
        <button type="submit" className="btn btn-unity" disabled={submitting || !form.name || !form.style_prompt}>
          {submitting ? "Creating..." : "Start Reskin Job"}
        </button>
      </div>
    </form>
  );
}
