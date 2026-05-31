import { useEffect, useState } from "react";

export default function WordCloudViewer() {
  const [prompts, setPrompts] = useState({});
  const [selected, setSelected] = useState("");

  useEffect(() => {
    fetch("/wordclouds/prompts.json")
      .then(res => res.json())
      .then(setPrompts);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <h2 style={{ textAlign: "center", marginBottom: 16 }}>Prompt Word Clouds</h2>
      <select
        value={selected}
        onChange={e => setSelected(e.target.value)}
        style={{ marginBottom: 24, minWidth: 320, textAlign: "center", fontSize: "1.1em", padding: "0.5em", borderRadius: 6 }}
      >
        <option value="">Select a prompt...</option>
        {Object.keys(prompts).map(prompt => (
          <option key={prompt} value={prompt}>{prompt}</option>
        ))}
      </select>
      {selected && (
        <div style={{ marginTop: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <img
            src={`/${prompts[selected]}`}
            alt={`Word cloud for ${selected}`}
            style={{ width: "1350px", height: "675px", maxWidth: "100%", border: "1px solid #333", borderRadius: 8, display: "block", margin: "0 auto" }}
          />
        </div>
      )}
    </div>
  );
}
