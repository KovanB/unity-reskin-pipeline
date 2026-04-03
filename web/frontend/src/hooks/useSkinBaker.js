import { useState, useCallback } from "react";

const API = import.meta.env.VITE_API_URL || "";

/**
 * useSkinBaker — Streams a single-texture generation from Lucy.
 *
 * Usage:
 *   const { status, result, statusMsg, bake } = useSkinBaker();
 *   bake({ element: "Graffiti01", style_prompt: "...", strength: 0.8 });
 */
export default function useSkinBaker() {
  const [status, setStatus] = useState("idle"); // idle | running | done | error
  const [statusMsg, setStatusMsg] = useState("");
  const [result, setResult] = useState(null); // { element, original, reskinned, width, height }

  const bake = useCallback(async ({ element, style_prompt, strength = 0.8 }) => {
    setStatus("running");
    setResult(null);
    setStatusMsg(`Generating ${element}...`);

    const params = new URLSearchParams({ element, style_prompt, strength: strength.toString() });

    try {
      const res = await fetch(`${API}/api/bake-single?${params}`, { method: "POST" });
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
            if (ev.type === "card") setResult(ev);
            if (ev.type === "done") { setStatus("done"); setStatusMsg(ev.message); }
            if (ev.cls === "error") { setStatus("error"); setStatusMsg(ev.message); }
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
    setResult(null);
    setStatusMsg("");
  }, []);

  return { status, result, statusMsg, bake, reset };
}
