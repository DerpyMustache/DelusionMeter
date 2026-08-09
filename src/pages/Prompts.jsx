import WordCloudViewer from "../components/WordCloudViewer";

export default function Prompts() {
  return (
    <div className="container promptsPage">
      <div className="promptsIntroPanel">
        Part of the data collection was the responses of a given profile to a prompt. All these
        responses were aggregated together here to create word clouds showing the most common words
        found in each response, which gives you an idea of how people responded. Want to know how
        to create the most original response? Look no further.
      </div>
      <WordCloudViewer />
    </div>
  );
}
