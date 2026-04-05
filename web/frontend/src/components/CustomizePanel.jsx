import { useState } from "react";
import useSkinBaker from "../hooks/useSkinBaker";

const API = import.meta.env.VITE_API_URL || "";

const SKIN_PRESETS = [
  { id: "gold", label: "Gold", emoji: "✨", color: "#FFD700",
    prompt: "luxurious golden metallic texture, shiny gold surface, polished, warm highlights, premium feel" },
  { id: "pixel", label: "Pixel Art", emoji: "🕹️", color: "#4FC3F7",
    prompt: "retro pixel art style, 16-bit game aesthetic, chunky pixels, bright saturated colors, nostalgic" },
  { id: "neon", label: "Neon", emoji: "💜", color: "#ff00ff",
    prompt: "neon glowing edges, vibrant pink and cyan accents, dark background, futuristic, electric feel" },
  { id: "sketch", label: "Hand Drawn", emoji: "✏️", color: "#888888",
    prompt: "hand-drawn pencil sketch style, rough charcoal lines, crosshatching, black and white, artistic illustration" },
  { id: "candy", label: "Candy", emoji: "🍬", color: "#FF69B4",
    prompt: "candy and sweets themed, bright pastel colors, sugar-coated, gummy texture, playful and sweet" },
  { id: "zombie", label: "Zombie", emoji: "🧟", color: "#4A6741",
    prompt: "post-apocalyptic zombie themed, decayed and weathered, torn and scratched, dark green and brown, horror" },
];

/**
 * CustomizePanel — Slide-in panel for selecting and reskinning game elements.
 */
export default function CustomizePanel({ demoInfo, onClose, onApplyTexture }) {
  const [selectedElement, setSelectedElement] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [presetIdx, setPresetIdx] = useState(-1);
  const [strength, setStrength] = useState(0.80);
  const { status, result, statusMsg, bake, reset } = useSkinBaker();

  const categories = demoInfo?.categories || {};

  const selectPreset = (i) => {
    setPresetIdx(i);
    setPrompt(SKIN_PRESETS[i].prompt);
  };

  const handleGenerate = () => {
    if (!selectedElement || !prompt) return;
    bake({ element: selectedElement.name, style_prompt: prompt, strength });
  };

  const handleApprove = () => {
    if (!result) return;
    // Push to Unity game live
    onApplyTexture(result.element, result.reskinned);

    // Persist to server
    const skinId = presetIdx >= 0 ? SKIN_PRESETS[presetIdx].id : "custom";
    fetch(`${API}/api/approve?skin_id=${skinId}&element=${result.element}&category=${selectedElement.category}`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: result.reskinned,
    }).catch(() => {});

    // Reset for next element
    reset();
    setSelectedElement(null);
  };

  return (
    <div style={{
      width: 380, height: "100%", background: "#0c0c14", borderLeft: "1px solid #1e1e2e",
      display: "flex", flexDirection: "column", overflow: "hidden",
      animation: "slideIn 0.3s ease-out",
    }}>
      {/* Header */}
      <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e1e2e", display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 16, fontWeight: 700, flex: 1 }}>Customize</span>
        <button onClick={onClose} style={{
          padding: "6px 14px", borderRadius: 8, border: "1px solid #2a2a3a",
          background: "transparent", color: "#8888a0", fontSize: 13, cursor: "pointer",
        }}>
          Back to Game
        </button>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: "0 0 20px 0" }}>
        {/* Preview / Generation area (when element selected) */}
        {selectedElement && (
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #1e1e2e" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
              <button onClick={() => { setSelectedElement(null); reset(); }} style={{
                padding: "2px 8px", borderRadius: 4, border: "1px solid #2a2a3a",
                background: "transparent", color: "#6b6b80", fontSize: 11, cursor: "pointer",
              }}>←</button>
              <span style={{ fontSize: 14, fontWeight: 600 }}>{selectedElement.name}</span>
              <span style={{ fontSize: 11, color: "#6b6b80" }}>{selectedElement.category}</span>
            </div>

            {/* Style presets */}
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
              {SKIN_PRESETS.map((s, i) => (
                <button key={s.id} onClick={() => selectPreset(i)} style={{
                  padding: "4px 10px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 600,
                  background: presetIdx === i ? s.color + "30" : "#1a1a26",
                  color: presetIdx === i ? s.color : "#6b6b80",
                  cursor: "pointer",
                }}>
                  {s.emoji} {s.label}
                </button>
              ))}
            </div>

            {/* Prompt */}
            <textarea value={prompt} onChange={(e) => { setPrompt(e.target.value); setPresetIdx(-1); }}
              placeholder="Describe the style..."
              style={{
                width: "100%", padding: 10, borderRadius: 8, border: "1px solid #2a2a3a",
                background: "#12121a", color: "#e4e4ef", fontSize: 12, fontFamily: "inherit",
                resize: "none", height: 56, outline: "none",
              }}
            />

            {/* Strength */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8 }}>
              <span style={{ fontSize: 11, color: "#6b6b80" }}>Strength</span>
              <input type="range" min="0.3" max="1" step="0.05" value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "#7c5cfc" }} />
              <span style={{ fontSize: 12, color: "#7c5cfc", fontWeight: 600, width: 28 }}>{strength}</span>
            </div>

            {/* Generate button */}
            <button onClick={handleGenerate} disabled={status === "running" || !prompt}
              style={{
                width: "100%", padding: "10px", borderRadius: 8, border: "none", marginTop: 10,
                background: status === "running" ? "#333" : "#7c5cfc", color: "#fff",
                fontSize: 13, fontWeight: 600, cursor: status === "running" ? "not-allowed" : "pointer",
              }}>
              {status === "running" ? "Generating..." : "Generate with Lucy"}
            </button>

            {/* Status */}
            {status !== "idle" && !result && (
              <div style={{ marginTop: 8, fontSize: 11, color: status === "error" ? "#f87171" : "#a78bfa", display: "flex", alignItems: "center", gap: 6 }}>
                {status === "running" && <div style={{ width: 12, height: 12, border: "2px solid transparent", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
                {statusMsg}
              </div>
            )}

            {/* Before/After preview */}
            {result && (
              <div style={{ marginTop: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 2, borderRadius: 8, overflow: "hidden", border: "1px solid #2a2a3a" }}>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", top: 4, left: 4, padding: "1px 6px", background: "rgba(0,0,0,0.7)", borderRadius: 3, fontSize: 9, fontWeight: 600 }}>BEFORE</div>
                    <img src={`data:image/png;base64,${result.original}`} style={{ width: "100%", display: "block" }} />
                  </div>
                  <div style={{ position: "relative" }}>
                    <div style={{ position: "absolute", top: 4, left: 4, padding: "1px 6px", background: "rgba(0,0,0,0.7)", borderRadius: 3, fontSize: 9, fontWeight: 600, color: "#00d4aa" }}>AFTER</div>
                    <img src={`data:image/png;base64,${result.reskinned}`} style={{ width: "100%", display: "block" }} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                  <button onClick={handleApprove} style={{
                    flex: 1, padding: "10px", borderRadius: 8, border: "none",
                    background: "#00d4aa", color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer",
                  }}>
                    Looks Good ✓
                  </button>
                  <button onClick={() => { reset(); }} style={{
                    padding: "10px 16px", borderRadius: 8, border: "1px solid #2a2a3a",
                    background: "transparent", color: "#8888a0", fontSize: 13, cursor: "pointer",
                  }}>
                    Retry
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Element list (when no element selected) */}
        {!selectedElement && Object.entries(categories).map(([catId, cat]) => (
          <div key={catId} style={{ padding: "0 20px" }}>
            <div style={{
              fontSize: 11, fontWeight: 600, textTransform: "uppercase", color: "#6b6b80",
              letterSpacing: 1, padding: "14px 0 8px 0", borderBottom: "1px solid #1a1a26",
            }}>
              {cat.label} <span style={{ color: "#444" }}>({cat.count})</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(70px, 1fr))", gap: 8, padding: "10px 0" }}>
              {cat.textures.map(tex => (
                <button key={tex.name} onClick={() => setSelectedElement({ ...tex, category: catId })}
                  style={{
                    padding: 0, border: "2px solid transparent", borderRadius: 8, overflow: "hidden",
                    background: "#12121a", cursor: "pointer", transition: "all 0.15s",
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.borderColor = "#7c5cfc"}
                  onMouseLeave={(e) => e.currentTarget.style.borderColor = "transparent"}
                >
                  <img src={`${API}${tex.url}`} alt={tex.name}
                    style={{ width: "100%", aspectRatio: "1", objectFit: "cover", display: "block" }}
                    loading="lazy"
                  />
                  <div style={{ padding: "3px 4px", fontSize: 9, color: "#6b6b80", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tex.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
