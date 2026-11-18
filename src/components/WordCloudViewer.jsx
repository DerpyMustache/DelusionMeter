import { useEffect, useMemo, useState } from "react";

const PROMPT_INDEX_URL = "/wordclouds/prompt_index.json";

const COUNTS_MAPS = {
  all: "/wordclouds/counts_all.json",
  men: "/wordclouds/counts_men.json",
  women: "/wordclouds/counts_women.json",
};

const BAR_PAGE_SIZE = 25;

export default function WordCloudViewer() {
  const [promptFiles, setPromptFiles] = useState({});
  const [countsByGender, setCountsByGender] = useState({});
  const [selectedGender, setSelectedGender] = useState("all");
  const [selectedPrompt, setSelectedPrompt] = useState("");
  const [barSearch, setBarSearch] = useState("");
  const [barPage, setBarPage] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadPromptMaps() {
      try {
        const [promptData, countEntries] = await Promise.all([
          fetch(PROMPT_INDEX_URL).then((response) => {
            if (!response.ok) throw new Error(`Failed to load ${PROMPT_INDEX_URL}`);
            return response.json();
          }),
          Promise.all(
            Object.entries(COUNTS_MAPS).map(async ([gender, url]) => {
              const response = await fetch(url);
              if (!response.ok) throw new Error(`Failed to load ${url}`);
              const data = await response.json();
              return [gender, data];
            })
          ),
        ]);

        if (!cancelled) {
          setPromptFiles(promptData);
          setCountsByGender(Object.fromEntries(countEntries));
          setError("");
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError?.message || "Failed to load word clouds");
        }
      }
    }

    loadPromptMaps();
    return () => {
      cancelled = true;
    };
  }, []);

  const prompts = promptFiles;

  const rankedWords = useMemo(() => {
    if (!selectedPrompt) return [];
    const counts = countsByGender[selectedGender]?.[selectedPrompt] || {};
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [countsByGender, selectedGender, selectedPrompt]);

  const filteredWords = useMemo(() => {
    const query = barSearch.trim().toLowerCase();
    if (!query) return rankedWords;
    return rankedWords.filter(([word]) => word.toLowerCase().includes(query));
  }, [rankedWords, barSearch]);

  const barPageCount = Math.max(1, Math.ceil(filteredWords.length / BAR_PAGE_SIZE));
  const pagedWords = filteredWords.slice(
    barPage * BAR_PAGE_SIZE,
    (barPage + 1) * BAR_PAGE_SIZE
  );
  const maxCount = filteredWords.length ? filteredWords[0][1] : 0;

  return (
    <div className="wordCloudViewer">
      <div className="wordCloudControlsPanel">
        <h2 className="wordCloudTitle">Word Clouds</h2>

        <div className="wordCloudControlsRow">
          <div className="wordCloudGenderBox">
            <div className="wordCloudGenderTitle">Responses From:</div>
            <div className="wordCloudGenderOptions" role="group" aria-label="Responses from">
              {[
                ["all", "Everyone"],
                ["men", "Men"],
                ["women", "Women"],
              ].map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={selectedGender === value}
                  className="wordCloudGenderButton"
                  onClick={() => {
                    if (value !== selectedGender) {
                      setBarPage(0);
                    }
                    setSelectedGender(value);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <select
            value={selectedPrompt}
            onChange={(event) => {
              setSelectedPrompt(event.target.value);
              setBarPage(0);
            }}
            className="wordCloudSelect"
          >
            <option value="">Select a prompt...</option>
            {Object.keys(prompts).map((prompt) => (
              <option key={prompt} value={prompt}>
                {prompt}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <div className="wordCloudError">{error}</div>}

      {selectedPrompt && prompts[selectedPrompt] && (
        <div className="wordCloudImageWrap">
          <img
            src={`/wordclouds/${selectedGender}/${promptFiles[selectedPrompt]}`}
            alt={`Word cloud for ${selectedPrompt}`}
            className="wordCloudImage"
          />
          {rankedWords.length > 0 && (
            <div className="wordCloudBars">
              <input
                type="text"
                className="wordCloudBarSearch"
                placeholder="Search words..."
                value={barSearch}
                onChange={(event) => {
                  setBarSearch(event.target.value);
                  setBarPage(0);
                }}
              />
              {pagedWords.length === 0 && (
                <div className="wordCloudSearchEmpty">No words match</div>
              )}
              {pagedWords.map(([word, count]) => (
                <div className="wordCloudBarRow" key={word}>
                  <span className="wordCloudBarLabel">{word}</span>
                  <div className="wordCloudBarTrack">
                    <div
                      className="wordCloudBarFill"
                      style={{ width: `${(count / maxCount) * 100}%` }}
                    />
                  </div>
                  <span className="wordCloudBarCount">{count}</span>
                </div>
              ))}
              {barPageCount > 1 && (
                <div className="wordCloudBarPager">
                  {barPage > 0 && (
                    <button
                      type="button"
                      aria-label="First page"
                      title="First page"
                      onClick={() => setBarPage(0)}
                    >
                      &lt;&lt;
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setBarPage((p) => Math.max(0, p - 1))}
                    disabled={barPage === 0}
                  >
                    Previous
                  </button>
                  <span>
                    Page {barPage + 1} of {barPageCount}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBarPage((p) => Math.min(barPageCount - 1, p + 1))}
                    disabled={barPage >= barPageCount - 1}
                  >
                    Next
                  </button>
                  {barPage < barPageCount - 1 && (
                    <button
                      type="button"
                      aria-label="Last page"
                      title="Last page"
                      onClick={() => setBarPage(barPageCount - 1)}
                    >
                      &gt;&gt;
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
