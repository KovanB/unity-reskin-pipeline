import { useState, useEffect } from "react";
import CharacterViewer from "./CharacterViewer";
import useMeshyRetexture from "../hooks/useMeshyRetexture";

const API = import.meta.env.VITE_API_URL || "";

const PRESETS = [
  { id: "suit", label: "Business Suit", color: "#2C3E50", prompt: "sharp navy business suit, white dress shirt, silk tie, polished shoes" },
  { id: "streetwear", label: "Streetwear", color: "#E74C3C", prompt: "urban streetwear, oversized hoodie, baggy cargo pants, high-top sneakers" },
  { id: "armor", label: "Knight Armor", color: "#8B8B8B", prompt: "medieval knight armor, polished steel plates, chainmail, leather straps" },
  { id: "cyber", label: "Cyberpunk", color: "#00ffff", prompt: "futuristic cyberpunk bodysuit, neon glowing accents, holographic panels" },
  { id: "leather", label: "Leather Jacket", color: "#8B4513", prompt: "black leather biker jacket, white t-shirt, dark jeans, motorcycle boots" },
  { id: "athletic", label: "Athletic", color: "#27AE60", prompt: "athletic sportswear, compression shirt, running shorts, sport shoes" },
  { id: "formal", label: "Tuxedo", color: "#1A1A2E", prompt: "black tuxedo, white bow tie, cummerbund, patent leather shoes" },
  { id: "military", label: "Military", color: "#556B2F", prompt: "military tactical gear, camouflage uniform, combat boots, tactical vest" },
];

export default function CharacterStudio() {
  const [modelUrl, setModelUrl] = useState("/models/character.glb");
  const [prompt, setPrompt] = useState("");
  const [activePreset, setActivePreset] = useState(-1);
  const [activeSkinName, setActiveSkinName] = useState("Default");
  const [savedSkins, setSavedSkins] = useState([]);
  const { status, statusMsg, progress, resultModelUrl, retexture, reset } = useMeshyRetexture();

  // Load saved skins
  useEffect(() => {
    fetch(`${API}/api/retexture/skins`)
      .then(r => r.json())
      .then(data => { if (data.skins?.length) setSavedSkins(data.skins); })
      .catch(() => {});
  }, []);

  const selectPreset = (i) => {
    setActivePreset(i);
    setPrompt(PRESETS[i].prompt);
  };

  const handleGenerate = () => {
    if (!prompt || status === "running") return;
    retexture(prompt);
  };

  const handleApprove = () => {
    if (!resultModelUrl) return;
    const skinName = activePreset >= 0 ? PRESETS[activePreset].id : "custom_" + Date.now();

    // Save to server
    fetch(`${API}/api/retexture/save?skin_id=${skinName}&model_url=${encodeURIComponent(resultModelUrl)}`, {
      method: "POST",
    }).then(() => {
      // Refresh saved skins
      fetch(`${API}/api/retexture/skins`).then(r => r.json()).then(data => {
        if (data.skins?.length) setSavedSkins(data.skins);
      }).catch(() => {});
    }).catch(() => {});

    setModelUrl(resultModelUrl);
    setActiveSkinName(activePreset >= 0 ? PRESETS[activePreset].label : "Custom");
    reset();
  };

  const handleRetry = () => {
    reset();
  };

  const handleReset = () => {
    setModelUrl("/models/character.glb");
    setActiveSkinName("Default");
    reset();
  };

  // Preview the result model when it's ready
  const displayModelUrl = resultModelUrl || modelUrl;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* 3D Viewer */}
      <div style={{ flex: 1, position: "relative" }}>
        <CharacterViewer modelUrl={displayModelUrl} />

        {/* Skin label */}
        <div style={{
          position: "absolute", top: 20, left: 20,
          padding: "6px 14px", borderRadius: 8,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
          fontSize: 12, fontWeight: 600,
        }}>
          {activeSkinName}
        </div>

        {/* Progress overlay */}
        {status === "running" && (
          <div style={{
            position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
            padding: "12px 24px", borderRadius: 12,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", gap: 12, minWidth: 240,
          }}>
            <div style={{
              width: 20, height: 20, border: "2px solid transparent",
              borderTopColor: "#7c5cfc", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <div>
              <div style={{ fontSize: 13, color: "#e4e4ef", fontWeight: 600 }}>{statusMsg}</div>
              {progress > 0 && (
                <div style={{ marginTop: 4, width: 160, height: 4, borderRadius: 2, background: "#1e1e2e", overflow: "hidden" }}>
                  <div style={{ width: `${progress}%`, height: "100%", background: "linear-gradient(90deg, #7c5cfc, #00d4aa)", borderRadius: 2, transition: "width 0.3s" }} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Style Panel */}
      <div style={{
        width: 380, height: "100%", background: "#0c0c14",
        borderLeft: "1px solid #1e1e2e", display: "flex", flexDirection: "column",
      }}>
        <div style={{ padding: "20px 24px", borderBottom: "1px solid #1e1e2e" }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            Character <span style={{ color: "#00d4aa" }}>Studio</span>
          </h1>
          <p style={{ fontSize: 12, color: "#6b6b80", margin: "4px 0 0 0" }}>
            Describe an outfit — Meshy generates the 3D texture
          </p>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Result actions */}
          {status === "done" && resultModelUrl && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "16px", borderRadius: 12, background: "#12121a", border: "1px solid #1e1e2e" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#00d4aa" }}>Retexture complete!</div>
              <p style={{ fontSize: 12, color: "#6b6b80", margin: 0 }}>
                The model is previewing in the viewer. Keep it or try again.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={handleApprove} style={{
                  flex: 1, padding: "10px", borderRadius: 8, border: "none",
                  background: "#00d4aa", color: "#0a0a0f", fontSize: 13, fontWeight: 700, cursor: "pointer",
                }}>
                  Keep This Skin
                </button>
                <button onClick={handleRetry} style={{
                  padding: "10px 16px", borderRadius: 8, border: "1px solid #2a2a3a",
                  background: "transparent", color: "#8888a0", fontSize: 13, cursor: "pointer",
                }}>
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Quick styles */}
          {status !== "done" && (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b6b80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  Quick Styles
                </div>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {PRESETS.map((s, i) => (
                    <button key={s.id} onClick={() => selectPreset(i)} style={{
                      padding: "6px 12px", borderRadius: 8, border: "none", fontSize: 11, fontWeight: 600,
                      background: activePreset === i ? s.color + "25" : "#14141e",
                      color: activePreset === i ? s.color : "#6b6b80",
                      cursor: "pointer", transition: "all 0.15s",
                    }}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b6b80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  Custom Prompt
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setActivePreset(-1); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  placeholder="Describe the character's outfit..."
                  rows={3}
                  style={{
                    width: "100%", padding: 12, borderRadius: 8, border: "1px solid #2a2a3a",
                    background: "#12121a", color: "#e4e4ef", fontSize: 13, fontFamily: "inherit",
                    resize: "none", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              <button onClick={handleGenerate} disabled={status === "running" || !prompt}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: status === "running" ? "#333"
                    : !prompt ? "#1a1a26"
                    : "linear-gradient(135deg, #7c5cfc, #00d4aa)",
                  color: !prompt ? "#444" : "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: status === "running" || !prompt ? "not-allowed" : "pointer",
                }}>
                {status === "running" ? "Generating..." : "Generate Skin"}
              </button>
            </>
          )}

          {/* Error */}
          {status === "error" && (
            <div style={{ fontSize: 12, color: "#f87171", padding: "8px 12px", borderRadius: 8, background: "rgba(248,113,113,0.1)" }}>
              {statusMsg}
              <button onClick={reset} style={{
                display: "block", marginTop: 8, padding: "6px 12px", borderRadius: 6,
                border: "1px solid #f87171", background: "transparent", color: "#f87171",
                fontSize: 11, cursor: "pointer",
              }}>
                Try Again
              </button>
            </div>
          )}

          {/* Reset */}
          {activeSkinName !== "Default" && status !== "done" && status !== "running" && (
            <button onClick={handleReset} style={{
              padding: "8px", borderRadius: 8, border: "1px solid #2a2a3a",
              background: "transparent", color: "#6b6b80", fontSize: 12, cursor: "pointer",
            }}>
              Reset to Default
            </button>
          )}

          {/* Saved skins */}
          {savedSkins.length > 0 && status !== "done" && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b6b80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Saved Skins
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {savedSkins.map(skin => (
                  <button key={skin.skin_id} onClick={() => {
                    setModelUrl(`${API}${skin.model_url}`);
                    setActiveSkinName(skin.skin_id);
                  }} style={{
                    padding: "6px 12px", borderRadius: 8, border: "1px solid #2a2a3a",
                    background: activeSkinName === skin.skin_id ? "#1e1e2e" : "transparent",
                    color: "#e4e4ef", fontSize: 11, cursor: "pointer",
                  }}>
                    {skin.skin_id}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  );
}
