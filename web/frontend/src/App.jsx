import { useEffect, useState, useRef } from "react";
import GamePanel from "./components/GamePanel";
import CustomizePanel from "./components/CustomizePanel";
import useUnityBridge from "./hooks/useUnityBridge";

const API = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [demoInfo, setDemoInfo] = useState(null);
  const iframeRef = useRef(null);
  const { applyTexture, applyBulkTextures, pauseGame, resumeGame, isReady } = useUnityBridge(iframeRef);

  // Load demo info + saved skins on mount
  useEffect(() => {
    fetch(`${API}/api/demo/info`).then(r => r.json()).then(setDemoInfo).catch(() => {});
  }, []);

  // When Unity is ready, push saved skins
  useEffect(() => {
    if (!isReady) return;
    fetch(`${API}/api/skins/active?skin_id=custom`)
      .then(r => r.json())
      .then(data => {
        if (data.textures && Object.keys(data.textures).length > 0) {
          applyBulkTextures(data.textures);
          console.log(`[App] Loaded ${Object.keys(data.textures).length} saved skins`);
        }
      })
      .catch(() => {});
  }, [isReady]);

  const openCustomize = () => {
    setIsCustomizing(true);
    pauseGame();
  };

  const closeCustomize = () => {
    setIsCustomizing(false);
    resumeGame();
  };

  const handleApplyTexture = (elementId, base64Png) => {
    applyTexture(elementId, base64Png);
  };

  return (
    <div style={{ display: "flex", height: "100vh", background: "#08080d", color: "#e4e4ef", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Header bar */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, height: 48, borderBottom: "1px solid #1e1e2e", background: "#0c0c14", display: "flex", alignItems: "center", padding: "0 20px" }}>
        <span style={{ fontSize: 18, fontWeight: 700 }}>unity<span style={{ color: "#00d4aa" }}>.reskin</span></span>
        <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 6px", borderRadius: 4, background: "rgba(0,212,170,0.12)", color: "#00d4aa", marginLeft: 8 }}>Unity</span>
        <div style={{ flex: 1 }} />
        {demoInfo && <span style={{ fontSize: 11, color: "#6b6b80" }}>{demoInfo.total_textures} textures from Trash Dash</span>}
        {isReady && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: "rgba(52,211,153,0.15)", color: "#34d399", marginLeft: 10 }}>Game Connected</span>}
      </div>

      {/* Main layout */}
      <div style={{ display: "flex", flex: 1, marginTop: 48 }}>
        {/* Game area */}
        <div style={{ flex: 1, position: "relative" }}>
          <GamePanel ref={iframeRef} onCustomize={openCustomize} isCustomizing={isCustomizing} />
        </div>

        {/* Customize panel (slides in) */}
        {isCustomizing && (
          <CustomizePanel
            demoInfo={demoInfo}
            onClose={closeCustomize}
            onApplyTexture={handleApplyTexture}
          />
        )}
      </div>
    </div>
  );
}
