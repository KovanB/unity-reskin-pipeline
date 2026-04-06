import { useState, useEffect } from "react";
import useSkinBaker from "../hooks/useSkinBaker";

const API = import.meta.env.VITE_API_URL || "";

const PRESETS = [
  { id: "gold", label: "Gold", color: "#FFD700", prompt: "luxurious golden metallic texture, shiny gold surface, polished, warm highlights" },
  { id: "pixel", label: "Pixel Art", color: "#4FC3F7", prompt: "retro pixel art style, 16-bit game aesthetic, chunky pixels, bright saturated colors" },
  { id: "neon", label: "Neon", color: "#ff00ff", prompt: "neon glowing edges, vibrant pink and cyan accents, dark background, futuristic" },
  { id: "sketch", label: "Hand Drawn", color: "#999", prompt: "hand-drawn pencil sketch style, rough charcoal lines, crosshatching, black and white" },
  { id: "candy", label: "Candy", color: "#FF69B4", prompt: "candy and sweets themed, bright pastel colors, sugar-coated, gummy texture" },
  { id: "zombie", label: "Zombie", color: "#4A6741", prompt: "post-apocalyptic zombie themed, decayed and weathered, torn, dark green and brown, horror" },
  { id: "galaxy", label: "Galaxy", color: "#6B5CE7", prompt: "cosmic galaxy nebula texture, swirling stars, deep purple and blue space, glowing" },
  { id: "lava", label: "Lava", color: "#FF4500", prompt: "molten lava surface, glowing orange cracks, volcanic rock, fiery, intense heat" },
];

export default function SkinScreen({ onPlay }) {
  const [catTexture, setCatTexture] = useState(null);
  const [prompt, setPrompt] = useState("");
  const [activePreset, setActivePreset] = useState(-1);
  const [approvedSkin, setApprovedSkin] = useState(null);
  const { status, result, statusMsg, bake, reset } = useSkinBaker();

  // Load cat texture on mount
  useEffect(() => {
    fetch(`${API}/api/demo/texture/Characters/Cat/CatAlbedo.png`)
      .then(r => r.blob())
      .then(blob => {
        const reader = new FileReader();
        reader.onload = () => setCatTexture(reader.result);
        reader.readAsDataURL(blob);
      })
      .catch(() => {});
  }, []);

  const selectPreset = (i) => {
    setActivePreset(i);
    setPrompt(PRESETS[i].prompt);
  };

  const handleGenerate = () => {
    if (!prompt) return;
    setApprovedSkin(null);
    bake({ element: "CatAlbedo", style_prompt: prompt, strength: 0.8 });
  };

  const handleApprove = () => {
    setApprovedSkin({ element: "CatAlbedo", base64Png: result.reskinned });
  };

  const handleRetry = () => {
    setApprovedSkin(null);
    reset();
  };

  const displayImage = approvedSkin
    ? `data:image/png;base64,${approvedSkin.base64Png}`
    : result
      ? `data:image/png;base64,${result.reskinned}`
      : catTexture;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 32, gap: 24 }}>
      {/* Title */}
      <div style={{ textAlign: "center" }}>
        <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0, letterSpacing: -1 }}>
          Trash <span style={{ color: "#00d4aa" }}>Dash</span>
        </h1>
        <p style={{ fontSize: 14, color: "#6b6b80", margin: "6px 0 0 0" }}>
          Skin your cat, then hit the streets
        </p>
      </div>

      {/* Cat preview */}
      <div style={{
        width: 220, height: 220, borderRadius: 20, overflow: "hidden",
        border: "3px solid #1e1e2e", background: "#12121a",
        display: "flex", alignItems: "center", justifyContent: "center",
        position: "relative",
      }}>
        {displayImage ? (
          <img src={displayImage} alt="Cat skin" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ fontSize: 64 }}>🐱</div>
        )}
        {approvedSkin && (
          <div style={{
            position: "absolute", bottom: 8, left: "50%", transform: "translateX(-50%)",
            padding: "4px 12px", borderRadius: 8, background: "rgba(0,212,170,0.9)",
            color: "#0a0a0f", fontSize: 11, fontWeight: 700,
          }}>
            Skin Applied
          </div>
        )}
        {status === "running" && (
          <div style={{
            position: "absolute", inset: 0, background: "rgba(0,0,0,0.7)",
            display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8,
          }}>
            <div style={{
              width: 28, height: 28, border: "3px solid transparent", borderTopColor: "#7c5cfc",
              borderRadius: "50%", animation: "spin 0.8s linear infinite",
            }} />
            <div style={{ fontSize: 11, color: "#a78bfa" }}>Generating...</div>
          </div>
        )}
      </div>

      {/* Before/After comparison when result is ready but not yet approved */}
      {result && !approvedSkin && (
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#6b6b80", marginBottom: 4, fontWeight: 600 }}>BEFORE</div>
            <img src={`data:image/png;base64,${result.original}`}
              style={{ width: 80, height: 80, borderRadius: 10, border: "2px solid #1e1e2e", objectFit: "cover" }} />
          </div>
          <div style={{ fontSize: 20, color: "#6b6b80" }}>→</div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 10, color: "#00d4aa", marginBottom: 4, fontWeight: 600 }}>AFTER</div>
            <img src={`data:image/png;base64,${result.reskinned}`}
              style={{ width: 80, height: 80, borderRadius: 10, border: "2px solid #00d4aa", objectFit: "cover" }} />
          </div>
        </div>
      )}

      {/* Approve / Retry buttons */}
      {result && !approvedSkin && (
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={handleApprove} style={{
            padding: "10px 28px", borderRadius: 10, border: "none",
            background: "#00d4aa", color: "#0a0a0f", fontSize: 14, fontWeight: 700, cursor: "pointer",
          }}>
            Use This Skin
          </button>
          <button onClick={handleRetry} style={{
            padding: "10px 20px", borderRadius: 10, border: "1px solid #2a2a3a",
            background: "transparent", color: "#8888a0", fontSize: 14, cursor: "pointer",
          }}>
            Try Again
          </button>
        </div>
      )}

      {/* Style presets */}
      {!approvedSkin && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", maxWidth: 500 }}>
          {PRESETS.map((s, i) => (
            <button key={s.id} onClick={() => selectPreset(i)} style={{
              padding: "6px 14px", borderRadius: 10, border: "none", fontSize: 12, fontWeight: 600,
              background: activePreset === i ? s.color + "25" : "#14141e",
              color: activePreset === i ? s.color : "#6b6b80",
              cursor: "pointer", transition: "all 0.15s",
            }}>
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Custom prompt */}
      {!approvedSkin && (
        <div style={{ display: "flex", gap: 8, width: "100%", maxWidth: 460 }}>
          <input
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setActivePreset(-1); }}
            onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
            placeholder="Describe your cat's style..."
            style={{
              flex: 1, padding: "12px 16px", borderRadius: 10, border: "1px solid #2a2a3a",
              background: "#12121a", color: "#e4e4ef", fontSize: 14, fontFamily: "inherit", outline: "none",
            }}
          />
          <button onClick={handleGenerate} disabled={status === "running" || !prompt}
            style={{
              padding: "12px 24px", borderRadius: 10, border: "none",
              background: status === "running" ? "#333" : "linear-gradient(135deg, #7c5cfc, #00d4aa)",
              color: "#fff", fontSize: 14, fontWeight: 700,
              cursor: status === "running" ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}>
            {status === "running" ? "..." : "Generate"}
          </button>
        </div>
      )}

      {/* Status message */}
      {status === "error" && (
        <div style={{ fontSize: 12, color: "#f87171" }}>{statusMsg}</div>
      )}

      {/* Play buttons */}
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        {approvedSkin ? (
          <button onClick={() => onPlay(approvedSkin)} style={{
            padding: "14px 40px", borderRadius: 12, border: "none",
            background: "linear-gradient(135deg, #7c5cfc 0%, #00d4aa 100%)",
            color: "#fff", fontSize: 18, fontWeight: 800, cursor: "pointer",
            boxShadow: "0 4px 24px rgba(124,92,252,0.4)",
            transition: "transform 0.2s",
          }}
            onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
            onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
          >
            Play with Custom Skin
          </button>
        ) : (
          <button onClick={() => onPlay(null)} style={{
            padding: "10px 24px", borderRadius: 10, border: "1px solid #2a2a3a",
            background: "transparent", color: "#6b6b80", fontSize: 13, cursor: "pointer",
          }}>
            Skip — Play with default skin
          </button>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
