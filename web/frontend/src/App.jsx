import { useState } from "react";
import CharacterStudio from "./components/CharacterStudio";

export default function App() {
  return (
    <div style={{ height: "100vh", background: "#0a0a0f", color: "#e4e4ef", fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      <CharacterStudio />
    </div>
  );
}
