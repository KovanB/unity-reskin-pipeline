import { forwardRef, useState } from "react";

/**
 * GamePanel — Renders the Unity WebGL game in an iframe with an overlay Customize button.
 */
const GamePanel = forwardRef(function GamePanel({ onCustomize, isCustomizing }, ref) {
  const [gameLoaded, setGameLoaded] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", borderRadius: 16, overflow: "hidden" }}>
      <iframe
        ref={ref}
        src="/unity/index.html"
        title="Trash Dash"
        onLoad={() => setGameLoaded(true)}
        style={{
          position: "relative",
          zIndex: 1,
          width: "100%",
          height: "100%",
          border: "none",
          display: "block",
          opacity: isCustomizing ? 0.4 : 1,
          transition: "opacity 0.3s",
          pointerEvents: isCustomizing ? "none" : "auto",
        }}
        allow="autoplay; fullscreen; gamepad"
        tabIndex={0}
      />

      {/* Placeholder when Unity build is not present */}
      {!gameLoaded && (
      <div style={{
        position: "absolute", inset: 0, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", gap: 16,
        background: "linear-gradient(135deg, #0a0a1a 0%, #1a1030 100%)",
        zIndex: 0,
      }}>
        <div style={{ fontSize: 48 }}>🎮</div>
        <div style={{ fontSize: 18, fontWeight: 700, color: "#e4e4ef" }}>Trash Dash</div>
        <div style={{ fontSize: 13, color: "#6b6b80", textAlign: "center", maxWidth: 300 }}>
          Loading Unity WebGL game...
        </div>
      </div>
      )}

      {/* Customize button */}
      {!isCustomizing && (
        <button onClick={onCustomize} style={{
          position: "absolute", bottom: 20, right: 20, zIndex: 10,
          padding: "12px 24px", borderRadius: 12, border: "none",
          background: "rgba(0, 212, 170, 0.9)", color: "#0a0a0f",
          fontSize: 14, fontWeight: 700, cursor: "pointer",
          backdropFilter: "blur(8px)",
          boxShadow: "0 4px 20px rgba(0,212,170,0.4)",
          transition: "all 0.2s",
        }}>
          ✨ Customize
        </button>
      )}
    </div>
  );
});

export default GamePanel;
