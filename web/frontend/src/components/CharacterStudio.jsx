import { useState, useEffect, useRef } from "react";
import CharacterViewer from "./CharacterViewer";
import useSkinBaker from "../hooks/useSkinBaker";

const API = import.meta.env.VITE_API_URL || "";

const PRESETS = [
  { id: "suit", label: "Business Suit", color: "#2C3E50", prompt: "sharp navy business suit, white dress shirt, silk tie, polished shoes, professional" },
  { id: "streetwear", label: "Streetwear", color: "#E74C3C", prompt: "urban streetwear, oversized hoodie, baggy cargo pants, sneakers, hip hop style" },
  { id: "armor", label: "Knight Armor", color: "#8B8B8B", prompt: "medieval knight armor, polished steel plates, chainmail, leather straps, battle-worn" },
  { id: "cyber", label: "Cyberpunk", color: "#00ffff", prompt: "futuristic cyberpunk outfit, neon glowing accents, dark tech bodysuit, holographic panels" },
  { id: "leather", label: "Leather Jacket", color: "#8B4513", prompt: "black leather biker jacket, white t-shirt, dark jeans, motorcycle boots, rebel style" },
  { id: "athletic", label: "Athletic", color: "#27AE60", prompt: "athletic sportswear, compression shirt, running shorts, sport shoes, fitness gear" },
  { id: "formal", label: "Tuxedo", color: "#1A1A2E", prompt: "black tuxedo, white bow tie, cummerbund, patent leather shoes, elegant formal wear" },
  { id: "military", label: "Military", color: "#556B2F", prompt: "military tactical gear, camouflage uniform, combat boots, tactical vest, army style" },
];

export default function CharacterStudio() {
  const [textureUrl, setTextureUrl] = useState("/models/character_texture.png");
  const [prompt, setPrompt] = useState("");
  const [activePreset, setActivePreset] = useState(-1);
  const [savedSkins, setSavedSkins] = useState([]);
  const [activeSkinName, setActiveSkinName] = useState("Default");
  const { status, result, statusMsg, bake, reset } = useSkinBaker();

  // Load saved skins on mount
  useEffect(() => {
    fetch(`${API}/api/skins`)
      .then(r => r.json())
      .then(data => {
        if (data.skins?.length) setSavedSkins(data.skins);
      })
      .catch(() => {});
  }, []);

  const selectPreset = (i) => {
    setActivePreset(i);
    setPrompt(PRESETS[i].prompt);
  };

  const handleGenerate = () => {
    if (!prompt || status === "running") return;
    bake({ element: "character_texture", style_prompt: prompt, strength: 0.8 });
  };

  const handleApprove = () => {
    if (!result) return;
    const skinName = activePreset >= 0 ? PRESETS[activePreset].label : "Custom";
    setTextureUrl(`data:image/png;base64,${result.reskinned}`);
    setActiveSkinName(skinName);

    // Persist to server
    fetch(`${API}/api/approve?skin_id=${skinName.toLowerCase().replace(/\s+/g, '_')}&element=character_texture&category=Characters`, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: result.reskinned,
    }).then(() => {
      // Refresh saved skins list
      fetch(`${API}/api/skins`).then(r => r.json()).then(data => {
        if (data.skins?.length) setSavedSkins(data.skins);
      }).catch(() => {});
    }).catch(() => {});

    reset();
  };

  const handleRetry = () => {
    reset();
  };

  const handleReset = () => {
    setTextureUrl("/models/character_texture.png");
    setActiveSkinName("Default");
    reset();
  };

  // When result comes in, preview it on the model immediately
  const previewTexture = result
    ? `data:image/png;base64,${result.reskinned}`
    : textureUrl;

  return (
    <div style={{ display: "flex", height: "100%" }}>
      {/* 3D Viewer — left side */}
      <div style={{ flex: 1, position: "relative" }}>
        <CharacterViewer textureUrl={previewTexture} />

        {/* Active skin label */}
        <div style={{
          position: "absolute", top: 20, left: 20,
          padding: "6px 14px", borderRadius: 8,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(10px)",
          fontSize: 12, fontWeight: 600, color: "#e4e4ef",
        }}>
          {activeSkinName}
        </div>

        {/* Status overlay */}
        {status === "running" && (
          <div style={{
            position: "absolute", bottom: 30, left: "50%", transform: "translateX(-50%)",
            padding: "10px 20px", borderRadius: 10,
            background: "rgba(0,0,0,0.7)", backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", gap: 10,
          }}>
            <div style={{
              width: 16, height: 16, border: "2px solid transparent",
              borderTopColor: "#7c5cfc", borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
            }} />
            <span style={{ fontSize: 13, color: "#a78bfa" }}>{statusMsg}</span>
          </div>
        )}
      </div>

      {/* Style Panel — right side */}
      <div style={{
        width: 380, height: "100%", background: "#0c0c14",
        borderLeft: "1px solid #1e1e2e", display: "flex", flexDirection: "column",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 24px", borderBottom: "1px solid #1e1e2e",
        }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>
            Character <span style={{ color: "#00d4aa" }}>Studio</span>
          </h1>
          <p style={{ fontSize: 12, color: "#6b6b80", margin: "4px 0 0 0" }}>
            Describe a style — see it on your character
          </p>
        </div>

        <div style={{ flex: 1, overflow: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {/* Before/After when result ready */}
          {result && (
            <div>
              <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#6b6b80", marginBottom: 4, fontWeight: 600 }}>BEFORE</div>
                  <img src={`data:image/png;base64,${result.original}`}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #1e1e2e" }} />
                </div>
                <div style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ fontSize: 10, color: "#00d4aa", marginBottom: 4, fontWeight: 600 }}>AFTER</div>
                  <img src={`data:image/png;base64,${result.reskinned}`}
                    style={{ width: "100%", borderRadius: 8, border: "1px solid #00d4aa" }} />
                </div>
              </div>
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

          {/* Style presets */}
          {!result && (
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

              {/* Custom prompt */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, color: "#6b6b80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                  Custom Prompt
                </div>
                <textarea
                  value={prompt}
                  onChange={(e) => { setPrompt(e.target.value); setActivePreset(-1); }}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleGenerate(); } }}
                  placeholder="Describe the character's appearance..."
                  rows={3}
                  style={{
                    width: "100%", padding: 12, borderRadius: 8, border: "1px solid #2a2a3a",
                    background: "#12121a", color: "#e4e4ef", fontSize: 13, fontFamily: "inherit",
                    resize: "none", outline: "none", boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Generate button */}
              <button onClick={handleGenerate} disabled={status === "running" || !prompt}
                style={{
                  width: "100%", padding: "12px", borderRadius: 10, border: "none",
                  background: status === "running" ? "#333"
                    : !prompt ? "#1a1a26"
                    : "linear-gradient(135deg, #7c5cfc, #00d4aa)",
                  color: !prompt ? "#444" : "#fff",
                  fontSize: 14, fontWeight: 700,
                  cursor: status === "running" || !prompt ? "not-allowed" : "pointer",
                  transition: "all 0.2s",
                }}>
                {status === "running" ? "Generating..." : "Generate Skin"}
              </button>
            </>
          )}

          {/* Error */}
          {status === "error" && (
            <div style={{ fontSize: 12, color: "#f87171", padding: "8px 12px", borderRadius: 8, background: "rgba(248,113,113,0.1)" }}>
              {statusMsg}
            </div>
          )}

          {/* Reset to default */}
          {activeSkinName !== "Default" && !result && (
            <button onClick={handleReset} style={{
              padding: "8px", borderRadius: 8, border: "1px solid #2a2a3a",
              background: "transparent", color: "#6b6b80", fontSize: 12, cursor: "pointer",
            }}>
              Reset to Default
            </button>
          )}

          {/* Saved skins gallery */}
          {savedSkins.length > 0 && !result && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#6b6b80", textTransform: "uppercase", letterSpacing: 1, marginBottom: 8 }}>
                Saved Skins
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {savedSkins.map(skin => (
                  <button key={skin.skin_id} onClick={() => {
                    // Load this saved skin
                    const cat = skin.textures?.Characters;
                    if (cat?.length) {
                      setTextureUrl(`${API}${cat[0].url}`);
                      setActiveSkinName(skin.skin_id);
                    }
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
