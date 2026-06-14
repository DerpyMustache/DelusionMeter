import React from "react";
import WordCloudViewer from "../components/WordCloudViewer";

export default function Prompts() {
  return (
    <div className="container promptsPage">
      <h1 className="promptsTitle">Prompt Data</h1>
      <WordCloudViewer />
    </div>
  );
}
