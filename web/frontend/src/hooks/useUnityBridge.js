import { useEffect, useRef, useCallback, useState } from "react";

/**
 * useUnityBridge — postMessage abstraction for React ↔ Unity iframe communication.
 *
 * Usage:
 *   const { sendToUnity, isReady } = useUnityBridge(iframeRef);
 *   sendToUnity("TextureSwapper", "ApplyTexture", jsonString);
 */
export default function useUnityBridge(iframeRef) {
  const [isReady, setIsReady] = useState(false);
  const listenersRef = useRef(new Set());

  // Listen for messages from Unity iframe
  useEffect(() => {
    function handleMessage(event) {
      if (!event.data) return;

      // Unity loader reports loaded
      if (event.data.source === "unity-loader" && event.data.payload?.type === "loaded") {
        console.log("[Bridge] Unity loader ready");
      }

      // Unity C# reports ready (via SkinLoader.cs)
      if (event.data.source === "unity" && event.data.payload?.type === "ready") {
        console.log("[Bridge] Unity game ready");
        setIsReady(true);
      }

      // Forward Unity events to listeners
      if (event.data.source === "unity") {
        for (const cb of listenersRef.current) {
          cb(event.data.payload);
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Send a message to Unity via the iframe
  const sendToUnity = useCallback((gameObject, method, data = "") => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({
      source: "react",
      payload: { gameObject, method, data },
    }, "*");
  }, [iframeRef]);

  // Apply a single texture to the game
  const applyTexture = useCallback((elementId, base64Png) => {
    const json = JSON.stringify({ elementId, base64Png });
    sendToUnity("TextureSwapper", "ApplyTexture", json);
  }, [sendToUnity]);

  // Apply multiple textures at once (startup)
  const applyBulkTextures = useCallback((textures) => {
    // textures: { elementId: base64Png, ... }
    const arr = Object.entries(textures).map(([elementId, base64Png]) => ({ elementId, base64Png }));
    const json = JSON.stringify({ textures: arr });
    sendToUnity("TextureSwapper", "ApplyBulkTextures", json);
  }, [sendToUnity]);

  // Pause / Resume
  const pauseGame = useCallback(() => sendToUnity("TextureSwapper", "PauseGame", ""), [sendToUnity]);
  const resumeGame = useCallback(() => sendToUnity("TextureSwapper", "ResumeGame", ""), [sendToUnity]);

  // Register a listener for Unity events
  const onUnityEvent = useCallback((callback) => {
    listenersRef.current.add(callback);
    return () => listenersRef.current.delete(callback);
  }, []);

  return { sendToUnity, applyTexture, applyBulkTextures, pauseGame, resumeGame, isReady, onUnityEvent };
}
