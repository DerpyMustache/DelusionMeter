import React from "react";
import WordCloudViewer from "../components/WordCloudViewer";

export default function Prompts() {
  return (
    <div className="container" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <h1 style={{ textAlign: "center", marginBottom: 24 }}>Prompt Data</h1>
      <WordCloudViewer />
    </div>
  );
}
