import { forwardRef, useState } from "react";

/**
 * GamePanel — Renders the Unity WebGL game in an iframe with an overlay Customize button.
 * Game is lazy-loaded (not fetched until user clicks Play) to avoid 45MB auto-download.
 */
const GamePanel = forwardRef(function GamePanel({ onCustomize, isCustomizing }, ref) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const [gameLoaded, setGameLoaded] = useState(false);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000", borderRadius: 16, overflow: "hidden" }}>
      {shouldLoad && (
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
      )}

      {/* Placeholder — shown before game loads */}
      {!gameLoaded && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", gap: 16,
          background: "linear-gradient(135deg, #0a0a1a 0%, #1a1030 100%)",
          zIndex: shouldLoad ? 0 : 1,
        }}>
          <div style={{ fontSize: 48 }}>🎮</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#e4e4ef" }}>Trash Dash</div>
          {!shouldLoad ? (
            <>
              <button onClick={() => setShouldLoad(true)} style={{
                padding: "14px 36px", borderRadius: 12, border: "none",
                background: "linear-gradient(135deg, #7c5cfc 0%, #00d4aa 100%)",
                color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer",
                boxShadow: "0 4px 24px rgba(124,92,252,0.4)",
                transition: "transform 0.2s",
              }}
                onMouseEnter={(e) => e.currentTarget.style.transform = "scale(1.05)"}
                onMouseLeave={(e) => e.currentTarget.style.transform = "scale(1)"}
              >
                Play Game
              </button>
              <a href="/unity/index.html" target="_blank" rel="noopener" style={{
                fontSize: 12, color: "#7c5cfc", marginTop: 8, textDecoration: "underline", cursor: "pointer",
              }}>
                Open in full window
              </a>
              <div style={{ fontSize: 12, color: "#6b6b80", marginTop: 4 }}>
                Use arrow keys to play. Click the game to interact.
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, color: "#a78bfa" }}>Loading game...</div>
              <div style={{ width: 200, height: 4, borderRadius: 2, background: "#1e1e2e", overflow: "hidden" }}>
                <div style={{
                  width: "60%", height: "100%", borderRadius: 2,
                  background: "linear-gradient(90deg, #7c5cfc, #00d4aa)",
                  animation: "loadPulse 1.5s ease-in-out infinite",
                }} />
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes loadPulse {
          0%, 100% { opacity: 0.5; width: 30%; }
          50% { opacity: 1; width: 80%; }
        }
      `}</style>
    </div>
  );
});

export default GamePanel;
