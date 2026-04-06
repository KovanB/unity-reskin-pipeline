import { useEffect, useState, useRef } from "react";
import SkinScreen from "./components/SkinScreen";
import useUnityBridge from "./hooks/useUnityBridge";

const API = import.meta.env.VITE_API_URL || "";

export default function App() {
  const [phase, setPhase] = useState("skin"); // "skin" | "play"
  const [approvedSkin, setApprovedSkin] = useState(null); // { element, base64Png }
  const iframeRef = useRef(null);
  const { applyTexture, isReady } = useUnityBridge(iframeRef);

  // When Unity is ready and we have an approved skin, push it
  useEffect(() => {
    if (!isReady || !approvedSkin) return;
    applyTexture(approvedSkin.element, approvedSkin.base64Png);
    // Retry a few times in case Unity needs a moment
    const t1 = setTimeout(() => applyTexture(approvedSkin.element, approvedSkin.base64Png), 2000);
    const t2 = setTimeout(() => applyTexture(approvedSkin.element, approvedSkin.base64Png), 5000);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [isReady, approvedSkin]);

  const handlePlay = (skinData) => {
    if (skinData) {
      setApprovedSkin(skinData);
      // Persist to server
      fetch(`${API}/api/approve?skin_id=custom&element=${skinData.element}&category=Characters`, {
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        body: skinData.base64Png,
      }).catch(() => {});
    }
    setPhase("play");
  };

  return (
    <div style={{ height: "100vh", background: "#08080d", color: "#e4e4ef", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {phase === "skin" && (
        <SkinScreen onPlay={handlePlay} />
      )}

      {phase === "play" && (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#08080d" }}>
          <iframe
            ref={iframeRef}
            src="/unity/index.html"
            title="Trash Dash"
            style={{
              width: "100%",
              height: "100%",
              maxWidth: "calc(100vh * 960 / 600)",
              aspectRatio: "960 / 600",
              border: "none",
              display: "block",
              borderRadius: 12,
            }}
            allow="autoplay; fullscreen; gamepad"
            tabIndex={0}
          />
        </div>
      )}
    </div>
  );
}
