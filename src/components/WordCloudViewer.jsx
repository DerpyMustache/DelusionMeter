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
    <div className="wordCloudViewer">
      <div className="wordCloudControlsPanel">
        <h2 className="wordCloudTitle">Word Clouds</h2>
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="wordCloudSelect"
        >
          <option value="">Select a prompt...</option>
          {Object.keys(prompts).map(prompt => (
            <option key={prompt} value={prompt}>{prompt}</option>
          ))}
        </select>
      </div>
      {selected && (
        <div className="wordCloudImageWrap">
          <img
            src={`/${prompts[selected]}`}
            alt={`Word cloud for ${selected}`}
            className="wordCloudImage"
          />
        </div>
      )}
    </div>
  );
}
