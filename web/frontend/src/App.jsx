import { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_URL || "";

const SKINS = [
  { id: "dracula", label: "Dracula", color: "#8B0000", emoji: "🧛",
    prompt: "Dracula gothic horror aesthetic, dark crimson and midnight purple palette, bat silhouettes, cobblestone, iron gates, fog, gothic stained glass, Victorian horror, blood red accents on black" },
  { id: "alice", label: "Alice", color: "#5B9BD5", emoji: "🐇",
    prompt: "Alice in Wonderland aesthetic, whimsical Victorian fantasy, playing card motifs, checkerboard, oversized mushrooms, teacup details, pastel purple and teal, storybook illustration" },
  { id: "robinhood", label: "Robin Hood", color: "#2E8B57", emoji: "🏹",
    prompt: "Robin Hood medieval forest, Sherwood Forest deep greens and browns, medieval village, wooden architecture, archery targets, leaf and vine motifs, rustic hand-painted style" },
  { id: "oz", label: "Wizard of Oz", color: "#6495ED", emoji: "👠",
    prompt: "Wizard of Oz aesthetic, yellow brick road, emerald green Emerald City, poppy fields, tornado, ruby red and emerald green, whimsical storybook, rainbow" },
  { id: "frankenstein", label: "Frankenstein", color: "#4A6741", emoji: "🧟",
    prompt: "Frankenstein gothic laboratory, dark stone castle, electrical sparks, green-tinted torchlight, bubbling chemistry, stitched leather, stormy night, mad science horror" },
  { id: "cyberpunk", label: "Cyberpunk", color: "#ff00ff", emoji: "🌆",
    prompt: "cyberpunk neon aesthetic, glowing edges, dark background, vibrant pink and cyan accents, holographic shimmer, futuristic sci-fi, neon signs, circuit board patterns" },
];

export default function App() {
  const [demoInfo, setDemoInfo] = useState(null);
  const [selectedCat, setSelectedCat] = useState("Graffiti");
  const [skinIdx, setSkinIdx] = useState(0);
  const [useCustom, setUseCustom] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [strength, setStrength] = useState(0.80);
  const [status, setStatus] = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [results, setResults] = useState([]);
  const [bakedSkins, setBakedSkins] = useState({});

  const skin = useCustom ? null : SKINS[skinIdx];
  const activePrompt = useCustom ? customPrompt : skin?.prompt || "";
  const activeSkinId = useCustom ? "custom" : skin?.id;

  // Load demo info on mount
  useEffect(() => {
    fetch(`${API}/api/demo/info`).then(r => r.json()).then(setDemoInfo).catch(() => {});
    fetch(`${API}/api/skins`).then(r => r.json()).then(data => {
      const map = {};
      for (const s of data.skins || []) map[s.skin_id] = s;
      setBakedSkins(map);
    }).catch(() => {});
  }, []);

  const catInfo = demoInfo?.categories?.[selectedCat];
  const isBaked = !useCustom && bakedSkins[skin?.id]?.textures?.[selectedCat];

  const bakeSkin = async () => {
    if (!activePrompt) return;
    setStatus("running");
    setResults([]);
    setStatusMsg("Starting Lucy...");

    const params = new URLSearchParams({
      skin_id: activeSkinId,
      style_prompt: activePrompt,
      strength: strength.toString(),
      category: selectedCat,
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
              fetch(`${API}/api/skins`).then(r => r.json()).then(data => {
                const map = {};
                for (const s of data.skins || []) map[s.skin_id] = s;
                setBakedSkins(map);
              }).catch(() => {});
            }
            if (ev.cls === "error") { setStatus("error"); setStatusMsg(ev.message); }
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
          {demoInfo && (
            <span style={{ fontSize: 12, color: "#6b6b80" }}>
              {demoInfo.total_textures} real Unity textures from <span style={{ color: "#8888a0" }}>Trash Dash</span>
            </span>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

        {/* Project badge */}
        <div style={{ background: "#12121a", borderRadius: 12, border: "1px solid #1e1e2e", padding: "14px 18px", marginBottom: 24, display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 24 }}>🎮</span>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>Unity Endless Runner Sample Game</div>
            <div style={{ fontSize: 12, color: "#6b6b80" }}>Real Unity assets from Unity Technologies' Trash Dash — .meta files, materials, textures all intact</div>
          </div>
          <div style={{ flex: 1 }} />
          <a href="https://github.com/Unity-Technologies/EndlessRunnerSampleGame" target="_blank" rel="noopener"
            style={{ fontSize: 11, color: "#7c5cfc", textDecoration: "none", border: "1px solid #2a2a3a", padding: "4px 10px", borderRadius: 6 }}>
            View Source
          </a>
        </div>

        {/* Step 1: Asset Category */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#7c5cfc", letterSpacing: 1, marginBottom: 10 }}>
            Step 1 — Pick asset category
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12 }}>
            {demoInfo && Object.entries(demoInfo.categories).map(([catId, cat]) => {
              const active = catId === selectedCat;
              return (
                <button key={catId} onClick={() => { setSelectedCat(catId); setResults([]); setStatus("idle"); }} style={{
                  padding: 16, borderRadius: 14, border: active ? "2px solid #7c5cfc" : "2px solid #1e1e2e",
                  background: active ? "rgba(124,92,252,0.1)" : "#12121a", cursor: "pointer",
                  textAlign: "left", transition: "all 0.2s",
                  boxShadow: active ? "0 4px 14px rgba(124,92,252,0.2)" : "none",
                }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: active ? "#a78bfa" : "#e4e4ef", marginBottom: 4 }}>
                    {cat.label}
                  </div>
                  <div style={{ fontSize: 11, color: "#6b6b80", marginBottom: 8 }}>{cat.description}</div>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "#7c5cfc" }}>{cat.count} textures</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Texture gallery */}
        {catInfo && (
          <div style={{ marginBottom: 28 }}>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#6b6b80", letterSpacing: 1, marginBottom: 12 }}>
              {catInfo.label} — {catInfo.count} textures (real Unity .png assets)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: `repeat(auto-fill, minmax(${selectedCat === "Graffiti" ? 140 : 100}px, 1fr))`, gap: 10 }}>
              {catInfo.textures.map(tex => (
                <div key={tex.name} style={{ background: "#12121a", borderRadius: 10, border: "1px solid #1e1e2e", overflow: "hidden" }}>
                  <img src={`${API}${tex.url}`} alt={tex.name}
                    style={{ width: "100%", display: "block", aspectRatio: "1", objectFit: "cover", background: "#1a1a26" }}
                    loading="lazy"
                  />
                  <div style={{ padding: "4px 8px", fontSize: 10, color: "#6b6b80", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {tex.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Pick Skin */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#7c5cfc", letterSpacing: 1, marginBottom: 10 }}>
            Step 2 — Pick a skin <span style={{ fontSize: 10, color: "#6b6b80", textTransform: "none", letterSpacing: 0 }}>public domain — free to use</span>
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
            {SKINS.map((s, i) => {
              const active = !useCustom && i === skinIdx;
              const baked = !!bakedSkins[s.id]?.textures?.[selectedCat];
              return (
                <button key={s.id} onClick={() => { setSkinIdx(i); setUseCustom(false); setResults([]); setStatus("idle"); }} style={{
                  padding: "10px 16px", borderRadius: 12, minWidth: 90,
                  border: active ? `2px solid ${s.color}` : "2px solid #1e1e2e",
                  background: active ? s.color + "18" : "#12121a",
                  cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
                  transition: "all 0.2s", transform: active ? "translateY(-2px)" : "none",
                }}>
                  <span style={{ fontSize: 24 }}>{s.emoji}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, color: active ? s.color : "#8888a0" }}>{s.label}</span>
                  {baked && <span style={{ fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4, background: "rgba(52,211,153,0.15)", color: "#34d399" }}>BAKED</span>}
                </button>
              );
            })}
            <button onClick={() => { setUseCustom(true); setResults([]); setStatus("idle"); }} style={{
              padding: "10px 16px", borderRadius: 12, minWidth: 90,
              border: useCustom ? "2px solid #00d4aa" : "2px solid #1e1e2e",
              background: useCustom ? "rgba(0,212,170,0.1)" : "#12121a",
              cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
            }}>
              <span style={{ fontSize: 24 }}>✏️</span>
              <span style={{ fontSize: 11, fontWeight: 600, color: useCustom ? "#00d4aa" : "#8888a0" }}>Custom</span>
            </button>
          </div>

          {useCustom && (
            <textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="Describe your style... e.g. underwater ocean theme, coral textures, bioluminescent colors"
              style={{ width: "100%", padding: 12, borderRadius: 10, border: "1px solid #2a2a3a", background: "#12121a", color: "#e4e4ef", fontSize: 13, fontFamily: "inherit", resize: "vertical", minHeight: 60, outline: "none", marginBottom: 12 }}
            />
          )}

          {/* Controls */}
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
              background: status === "running" ? "#333" : "#00d4aa", color: status === "running" ? "#666" : "#0a0a0f",
              fontSize: 15, fontWeight: 700, cursor: status === "running" ? "not-allowed" : "pointer",
              boxShadow: status === "running" ? "none" : "0 4px 14px rgba(0,212,170,0.3)",
            }}>
              {status === "running" ? "Baking..." : isBaked ? "View Baked Skin" : `Bake ${selectedCat}`}
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
            {status === "running" && <div style={{ width: 16, height: 16, border: "2px solid transparent", borderTopColor: "currentColor", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />}
            {statusMsg}
            {status === "done" && !useCustom && skin && (
              <a href={`${API}/api/skins/${skin.id}/download`}
                style={{ marginLeft: "auto", padding: "4px 12px", borderRadius: 6, background: "#34d399", color: "#0a0a0f", fontSize: 12, fontWeight: 600, textDecoration: "none" }}>
                Download .zip
              </a>
            )}
          </div>
        )}

        {/* Before/After Results */}
        {results.length > 0 && (
          <div>
            <div style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase", color: "#7c5cfc", letterSpacing: 1, marginBottom: 14 }}>
              Before / After — {selectedCat}
              {results[0]?.cached && <span style={{ fontSize: 10, color: "#34d399", marginLeft: 8 }}>CACHED</span>}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {results.map((r, i) => (
                <div key={i} style={{ background: "#12121a", borderRadius: 12, border: "1px solid #1e1e2e", overflow: "hidden", animation: "fadeIn 0.4s" }}>
                  <div style={{ padding: "8px 12px", fontSize: 12, fontWeight: 600, borderBottom: "1px solid #1e1e2e", display: "flex", justifyContent: "space-between" }}>
                    <span>{r.texture}</span>
                    <span style={{ color: "#6b6b80", fontWeight: 400 }}>{r.width}x{r.height}</span>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr" }}>
                    <div style={{ position: "relative" }}>
                      <div style={{ position: "absolute", top: 6, left: 6, padding: "2px 8px", background: "rgba(0,0,0,0.75)", borderRadius: 4, fontSize: 10, fontWeight: 600, textTransform: "uppercase" }}>Before</div>
                      {r.original && <img src={`data:image/png;base64,${r.original}`} style={{ width: "100%", display: "block" }} />}
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

        {/* Footer */}
        <div style={{ marginTop: 48, paddingTop: 20, borderTop: "1px solid #1e1e2e", textAlign: "center" }}>
          <div style={{ fontSize: 11, color: "#6b6b80" }}>
            Unity Reskin Pipeline — Real Unity assets from Trash Dash (Unity Companion License)
          </div>
          <div style={{ fontSize: 11, color: "#444", marginTop: 4 }}>
            Skins generated once by Lucy AI, saved as permanent Unity-ready assets
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: translateY(0) } }
      `}</style>
    </div>
  );
}
