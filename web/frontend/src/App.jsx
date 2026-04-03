import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

const CHARACTERS = [
  { name: "Jake", color: "#2196F3", emoji: "🛹" },
  { name: "Tricky", color: "#E91E63", emoji: "🎧" },
  { name: "Fresh", color: "#4CAF50", emoji: "🎤" },
  { name: "Yutani", color: "#9C27B0", emoji: "🛸" },
  { name: "Spike", color: "#F44336", emoji: "🔥" },
];

const TEXTURES = ["Body", "Face", "Shoes", "Board", "Hat"];

const SKINS = [
  { id: "dracula", label: "Dracula", color: "#8B0000", emoji: "🧛",
    prompt: "Dracula gothic horror aesthetic, Transylvanian castle architecture, dark crimson and midnight purple palette, bat silhouettes, cobblestone streets, iron gates, fog particles, gothic stained glass, Victorian horror style, blood red accents on black" },
  { id: "alice", label: "Alice", color: "#5B9BD5", emoji: "🐇",
    prompt: "Alice in Wonderland aesthetic, whimsical Victorian fantasy, playing card motifs, checkerboard patterns, oversized mushrooms, teacup and pocket watch details, pastel purple and teal palette, storybook illustration style" },
  { id: "robinhood", label: "Robin Hood", color: "#2E8B57", emoji: "🏹",
    prompt: "Robin Hood medieval forest aesthetic, Sherwood Forest deep greens and earthy browns, medieval village, wooden architecture, archery targets, leaf and vine motifs, golden treasure coins, rustic hand-painted style" },
  { id: "oz", label: "Wizard of Oz", color: "#6495ED", emoji: "👠",
    prompt: "Wizard of Oz aesthetic, yellow brick road textures, emerald green Emerald City architecture, poppy fields, tornado particles, ruby red and emerald green palette, whimsical storybook style, rainbow skybox" },
  { id: "frankenstein", label: "Frankenstein", color: "#4A6741", emoji: "🧟",
    prompt: "Frankenstein gothic laboratory aesthetic, dark stone castle, electrical sparks and lightning, green-tinted torchlight, bubbling chemistry equipment, stitched leather, stormy night, mad science horror style" },
  { id: "cyberpunk", label: "Cyberpunk", color: "#ff00ff", emoji: "🌆",
    prompt: "cyberpunk neon aesthetic, glowing edges, dark background with vibrant pink and cyan accents, holographic shimmer, futuristic sci-fi, neon signs, circuit board patterns" },
];

export default function App() {
  const [charIdx, setCharIdx] = useState(0);
  const [skinIdx, setSkinIdx] = useState(0);
  const [customPrompt, setCustomPrompt] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [strength, setStrength] = useState(0.80);
  const [bakedSkins, setBakedSkins] = useState({});  // {skinId: {charName: {texName: url}}}

  const char = CHARACTERS[charIdx];
  const skin = useCustom ? null : SKINS[skinIdx];
  const activePrompt = useCustom ? customPrompt : skin?.prompt || "";
  const activeSkinId = useCustom ? `custom_${customPrompt.slice(0, 20).replace(/\s/g, "_")}` : skin?.id;

  // Load already-baked skins on mount
  useEffect(() => {
    fetch(`${API}/api/skins`).then(r => r.json()).then(data => {
      const map = {};
      for (const s of data.skins || []) {
        map[s.skin_id] = s.textures;
      }
      setBakedSkins(map);
    }).catch(() => {});
  }, []);

  // Check if current skin is already baked for current character
  const isBaked = !useCustom && bakedSkins[skin?.id]?.[char.name];
  const bakedTextures = isBaked ? bakedSkins[skin.id][char.name] : null;

  // Bake skin (run Lucy once, save permanently)
  const bakeSkin = async () => {
    if (!activePrompt) return;
    setStatus("running");
    setResults([]);
    setStatusMsg("Starting Lucy...");

    const params = new URLSearchParams({
      skin_id: activeSkinId,
      style_prompt: activePrompt,
      strength: strength.toString(),
      characters: char.name,  // only bake selected character (faster)
    });

    try {
      const res = await fetch(`${API}/api/bake-skin?${params}`, { method: "POST" });
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.type === "status") setStatusMsg(ev.message);
            if (ev.type === "card") setResults(prev => [...prev, ev]);
            if (ev.type === "done") {
              setStatus("done");
              setStatusMsg(ev.message);
              // Refresh baked skins list
              fetch(`${API}/api/skins`).then(r => r.json()).then(data => {
                const map = {};
                for (const s of data.skins || []) map[s.skin_id] = s.textures;
                setBakedSkins(map);
              }).catch(() => {});
            }
            if (ev.cls === "error") {
              setStatus("error");
              setStatusMsg(ev.message);
            }
          } catch {}
        }
      }
    } catch (e) {
      setStatus("error");
      setStatusMsg("Connection failed: " + e.message);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#08080d", color: "#e4e4ef", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ borderBottom: "1px solid #1e1e2e", padding: "14px 0" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 20, fontWeight: 700 }}>unity<span style={{ color: "#00d4aa" }}>.reskin</span></span>
          <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "rgba(0,212,170,0.12)", color: "#00d4aa" }}>Unity</span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 12, color: "#6b6b80" }}>AI-powered game reskinning</span>
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Step 1: Characters */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#7c5cfc", letterSpacing: 1, marginBottom: 10 }}>
            Step 1 — Pick a character
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
            {CHARACTERS.map((c, i) => {
              const active = i === charIdx;
              return (
                <button key={c.name} onClick={() => { setCharIdx(i); setResults([]); setStatus("idle"); }} style={{
                  padding: 16, borderRadius: 14, border: active ? `2px solid ${c.color}` : "2px solid #1e1e2e",
                  background: active ? c.color + "18" : "#12121a", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
                  transition: "all 0.2s", transform: active ? "translateY(-3px)" : "none",
                  boxShadow: active ? `0 6px 20px ${c.color}30` : "0 2px 4px rgba(0,0,0,0.2)",
                }}>
                  <div style={{
                    width: 64, height: 64, borderRadius: 32, overflow: "hidden",
                    border: active ? `3px solid ${c.color}` : "3px solid #2a2a3a",
                    boxShadow: active ? `0 0 0 4px ${c.color}30` : "none",
                  }}>
                    <img src={`${API}/api/demo/thumb/${c.name}/Body`}
                      style={{ width: 64, height: 64, objectFit: "cover" }}
                      onError={(e) => { e.target.style.display = "none"; }}
                    />
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600, color: active ? c.color : "#b0b0c0" }}>{c.name}</span>
                  <div style={{ display: "flex", gap: 3 }}>
                    {TEXTURES.map(t => (
                      <img key={t} src={`${API}/api/demo/thumb/${c.name}/${t}`}
                        style={{ width: 24, height: 24, borderRadius: 4, objectFit: "cover", border: "1px solid #2a2a3a" }}
                        title={t}
                        onError={(e) => { e.target.style.background = "#1a1a26"; }}
                      />
                    ))}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Step 2: Skins */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#7c5cfc", letterSpacing: 1, marginBottom: 10 }}>
            Step 2 — Pick a skin
            <span style={{ fontSize: 10, color: "#6b6b80", textTransform: "none", marginLeft: 8, letterSpacing: 0 }}>
              Public domain — free to use, no licensing
            </span>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {SKINS.map((s, i) => {
              const active = !useCustom && i === skinIdx;
              const alreadyBaked = !!bakedSkins[s.id];
              return (
                <button key={s.id} onClick={() => { setSkinIdx(i); setUseCustom(false); setResults([]); setStatus("idle"); }} style={{
                  padding: "12px 16px", borderRadius: 12, minWidth: 100,
                  border: active ? `2px solid ${s.color}` : "2px solid #1e1e2e",
                  background: active ? s.color + "18" : "#12121a",
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  transition: "all 0.2s",
                  transform: active ? "translateY(-2px)" : "none",
                  boxShadow: active ? `0 4px 14px ${s.color}30` : "none",
                  position: "relative",
                }}>
                  <div style={{ width: 44, height: 44, borderRadius: 22, background: s.color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                    {s.emoji}
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 600, color: active ? s.color : "#8888a0" }}>{s.label}</span>
                  {alreadyBaked && (
                    <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(52,211,153,0.15)", color: "#34d399" }}>BAKED</span>
                  )}
                </button>
              );
            })}

            {/* Custom */}
            <button onClick={() => { setUseCustom(true); setResults([]); setStatus("idle"); }} style={{
              padding: "12px 16px", borderRadius: 12, minWidth: 100,
              border: useCustom ? "2px solid #00d4aa" : "2px solid #1e1e2e",
              background: useCustom ? "rgba(0,212,170,0.1)" : "#12121a",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
            }}>
              <div style={{ width: 44, height: 44, borderRadius: 22, background: "#00d4aa", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>
                ✏️
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: useCustom ? "#00d4aa" : "#8888a0" }}>Custom</span>
            </button>
          </div>

          {useCustom && (
            <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe your style... e.g. underwater ocean theme, coral textures, bioluminescent colors"
              style={{
                width: "100%", padding: 12, borderRadius: 10, border: "1px solid #2a2a3a",
                background: "#12121a", color: "#e4e4ef", fontSize: 13, fontFamily: "inherit",
                resize: "vertical", minHeight: 60, outline: "none", marginBottom: 12,
              }}
            />
          )}

          {/* Strength + Bake button */}
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flex: 1 }}>
              <span style={{ fontSize: 12, color: "#6b6b80" }}>Subtle</span>
              <input type="range" min="0.3" max="1" step="0.05" value={strength}
                onChange={(e) => setStrength(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: "#7c5cfc" }} />
              <span style={{ fontSize: 12, color: "#6b6b80" }}>Full</span>
              <span style={{ fontSize: 13, color: "#7c5cfc", fontWeight: 600, width: 36 }}>{strength}</span>
            </div>
            <button onClick={bakeSkin} disabled={status === "running" || !activePrompt} style={{
              padding: "12px 32px", borderRadius: 10, border: "none",
              background: status === "running" ? "#333" : isBaked ? "#34d399" : "#00d4aa",
              color: status === "running" ? "#666" : "#0a0a0f",
              fontSize: 15, fontWeight: 700,
              cursor: status === "running" ? "not-allowed" : "pointer",
              boxShadow: status === "running" ? "none" : "0 4px 14px rgba(0,212,170,0.3)",
            }}>
              {status === "running" ? "Baking..." : isBaked ? `View ${skin?.label} Skin` : `Bake ${char.name} Skin`}
            </button>
          </div>
        </div>

        {/* Status */}
        {status !== "idle" && (
          <div style={{
            padding: "10px 16px", borderRadius: 10, marginBottom: 24, fontSize: 13,
            display: "flex", alignItems: "center", gap: 10,
            background: status === "running" ? "rgba(124,92,252,0.1)" : status === "done" ? "rgba(52,211,153,0.1)" : "rgba(248,113,113,0.1)",
            color: status === "running" ? "#a78bfa" : status === "done" ? "#34d399" : "#f87171",
          }}>
            {status === "running" && (
              <div style={{ width: 16, height: 16, border: "2px solid transparent", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            )}
            {statusMsg}
            {status === "done" && !useCustom && skin && (
              <a href={`${API}/api/skins/${skin.id}/download`}
                style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6, background: "#34d399", color: "#0a0a0f", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Download .zip
              </a>
            )}
          </div>
        )}

        {/* Results: before/after cards */}
        {results.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#7c5cfc", letterSpacing: 1, marginBottom: 14 }}>
              {useCustom ? "Custom Skin" : skin?.label} — {char.name}
              {results[0]?.cached && <span style={{ fontSize: 10, color: "#34d399", marginLeft: 8 }}>CACHED</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {results.map((r, i) => (
                <div key={i} style={{ background: "#12121a", borderRadius: 12, border: "1px solid #1e1e2e", overflow: "hidden", animation: "fadeIn 0.4s" }}>
                  <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between" }}>
                    <span>{r.character} / {r.texture}</span>
                    <span style={{ color: "#6b6b80", fontWeight: 400 }}>{r.width}x{r.height}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", top: 6, left: 6, padding: "2px 8px", background: "rgba(0,0,0,0.75)", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Before</div>
                      <img src={`data:image/png;base64,${r.original}`} style={{ width: "100%", display: "block" }} />
                    </div>
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", top: 6, left: 6, padding: "2px 8px", background: "rgba(0,0,0,0.75)", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase", color: "#00d4aa" }}>After</div>
                      <img src={`data:image/png;base64,${r.reskinned}`} style={{ width: "100%", display: "block" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Preloaded textures when idle */}
        {results.length === 0 && status === "idle" && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#6b6b80", letterSpacing: 1, marginBottom: 14 }}>
              {char.name}'s Unity textures
              {isBaked && <span style={{ color: "#34d399", marginLeft: 8 }}>— {skin.label} skin available! Click Bake to view</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {TEXTURES.map(tex => (
                <div key={tex} style={{ background: "#12121a", borderRadius: 12, border: "1px solid #1e1e2e", overflow: "hidden" }}>
                  <div style={{ padding: "6px 10px", fontSize: 11, fontWeight: 600, borderBottom: "1px solid #1e1e2e", color: "#8888a0" }}>{tex}</div>
                  <img src={`${API}/api/demo/thumb/${char.name}/${tex}`}
                    style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover" }}
                    onError={(e) => { e.target.style.background = "#1a1a26"; }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid #1e1e2e", textAlign: "center" }}>
          <span style={{ fontSize: 11, color: "#6b6b80" }}>Unity Reskin Pipeline — Skins generated once by Lucy, saved as permanent Unity assets</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
