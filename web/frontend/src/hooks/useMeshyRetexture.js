import { useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "";

/**
 * useMeshyRetexture — Streams a retexture job from Meshy via our backend.
 *
 * Returns { status, statusMsg, progress, resultModelUrl, retexture, reset }
 */
export default function useMeshyRetexture() {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [statusMsg, setStatusMsg] = useState("");
  const [progress, setProgress] = useState(0);
  const [resultModelUrl, setResultModelUrl] = useState(null);

  const retexture = useCallback(async (stylePrompt) => {
    setStatus("running");
    setResultModelUrl(null);
    setProgress(0);
    setStatusMsg("Starting retexture...");

    const params = new URLSearchParams({ style_prompt: stylePrompt });

    try {
      const res = await fetch(`${API}/api/retexture?${params}`, { method: "POST" });
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
            if (ev.type === "status") {
              setStatusMsg(ev.message);
              if (ev.progress !== undefined) setProgress(ev.progress);
            }
            if (ev.type === "done") {
              setStatus("done");
              setStatusMsg(ev.message);
              setProgress(100);
              setResultModelUrl(ev.model_url);
            }
            if (ev.type === "error") {
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
  }, []);

  const reset = useCallback(() => {
    setStatus("idle");
    setResultModelUrl(null);
    setStatusMsg("");
    setProgress(0);
  }, []);

  return { status, statusMsg, progress, resultModelUrl, retexture, reset };
}
