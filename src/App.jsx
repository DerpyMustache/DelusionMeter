import { useEffect, useMemo, useRef, useState } from "react";
import INITIAL_CHARTS from "./lib/initialCharts.js";
import VALUE_MAPS from "./lib/valueMaps.js";
import sharedConstants from "../shared/profile_constants.json";
const SPLASH_SEEN_KEY = "delusionmeter:splashSeen:v1";

import ChartCard from "./components/ChartCard.jsx";
import FilterPanel from "./components/FilterPanel.jsx";

const ALLOWED_FILTER_KEYS = new Set(sharedConstants.FILTER_KEYS || []);
const FILTER_POPULARITY_ORDER = [
  "height",
  "age",
  "gender",
  "looking_for",
  "politics",
  "religion",
  "drinking",
  "smoking",
  "cannabis",
  "kids",
  "education_level",
  "location",
  "exercise",
  "occupation",
  "star_sign",
];
const FILTER_POPULARITY_INDEX = new Map(
  FILTER_POPULARITY_ORDER.map((attr, index) => [attr, index])
);

function normalizeFilterObject(nextFilter = {}) {
  const cleaned = {};

  for (const [attr, raw] of Object.entries(nextFilter)) {
    const key = String(attr).trim();
    if (!key || !ALLOWED_FILTER_KEYS.has(key)) continue;

    if (Array.isArray(raw)) {
      const values = raw
        .map((v) => String(v).trim())
        .filter((v) => v !== "");
      if (values.length > 0) cleaned[key] = values;
      continue;
    }

    if (raw !== undefined && raw !== null) {
      const value = String(raw).trim();
      if (value !== "") cleaned[key] = value;
    }
  }

  return cleaned;
}

function hasFilterEntries(filterObj) {
  return Object.keys(filterObj).length > 0;
}

function stableFilterKey(filterObj) {
  const entries = Object.entries(filterObj)
    .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v])
    .sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify(entries);
}

export default function App() {
  const [summary, setSummary] = useState(null);
  const [loadedFilter, setLoadedFilter] = useState({});
  const [error, setError] = useState(null);
  const [showDelusionHelp, setShowDelusionHelp] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [shareStatus, setShareStatus] = useState("");
  const [showConfettiBurst, setShowConfettiBurst] = useState(false);
  const [confettiBurstId, setConfettiBurstId] = useState(0);
  const [openFilterEditorAttr, setOpenFilterEditorAttr] = useState(null);
  const [animatedFilteredCount, setAnimatedFilteredCount] = useState(0);
  const [typeDescription, setTypeDescription] = useState("everyone");
  const requestIdRef = useRef(0);
  const prevDelusionPctRef = useRef(0);
  const delusionHelpRef = useRef(null);
  const shareMenuRef = useRef(null);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(SPLASH_SEEN_KEY) !== "1";
  });
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");
  // filter: { [attribute]: value | value[] }
  const [filter, setFilter] = useState({});
  const hasActiveFilters = hasFilterEntries(filter);
  const filterKey = useMemo(() => stableFilterKey(filter), [filter]);
  const loadedFilterKey = useMemo(() => stableFilterKey(loadedFilter), [loadedFilter]);
  const isCurrentFilterLoaded = hasActiveFilters && summary && loadedFilterKey === filterKey;
  const showLoadedFilteredData = Boolean(summary) && hasFilterEntries(loadedFilter);
  const isRefreshing = hasActiveFilters && !isCurrentFilterLoaded;
  const defaultTotalCount = useMemo(
    () => Math.max(0, ...INITIAL_CHARTS.map((c) => Number(c.answeredCount) || 0)),
    []
  );

  function handleFilterChange(nextFilter) {
    const cleaned = normalizeFilterObject(nextFilter);
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
    setOpenFilterEditorAttr(null);
    if (!hasFilterEntries(cleaned)) {
      setSummary(null);
      setLoadedFilter({});
      setError(null);
    }
    setFilter(cleaned);
  }

  useEffect(() => {
    if (!showSplash) return undefined;

    const timer = window.setTimeout(() => {
      setShowSplash(false);
      window.sessionStorage.setItem(SPLASH_SEEN_KEY, "1");
    }, 2000);

    return () => window.clearTimeout(timer);
  }, [showSplash]);

  useEffect(() => {
    if (!hasActiveFilters) {
      return undefined;
    }

    const currentRequestId = ++requestIdRef.current;
    const requestFilter = { ...filter };
    const controller = new AbortController();

    fetch(apiBaseUrl + "/summary", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filter: requestFilter }),
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((data) => {
        if (currentRequestId !== requestIdRef.current) return;
        setSummary(data);
        setLoadedFilter(requestFilter);
        setError(null);
      })
      .catch((err) => {
        if (err?.name === "AbortError") return;
        if (currentRequestId !== requestIdRef.current) return;
        setError(err?.message || "Failed to load data");
      });

    return () => {
      controller.abort();
    };
  }, [apiBaseUrl, hasActiveFilters, filter]);

  useEffect(() => {
    if (!showDelusionHelp && !showShareMenu) return undefined;

    const onPointerDown = (event) => {
      const clickedInHelp = delusionHelpRef.current?.contains(event.target);
      const clickedInShare = shareMenuRef.current?.contains(event.target);
      
      if (!clickedInHelp) {
        setShowDelusionHelp(false);
      }
      if (!clickedInShare) {
        setShowShareMenu(false);
      }
    };

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        setShowDelusionHelp(false);
        setShowShareMenu(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [showDelusionHelp, showShareMenu]);

  const baseCharts = useMemo(
    () => (showLoadedFilteredData ? summary?.charts || [] : INITIAL_CHARTS),
    [showLoadedFilteredData, summary]
  );

  const filterOptionsByAttribute = useMemo(() => {
    const options = {};

    for (const chart of INITIAL_CHARTS) {
      options[chart.attribute] = [...(chart.labels || [])];
    }

    if (VALUE_MAPS?.religion) {
      options.religion = Object.values(VALUE_MAPS.religion);
    }

    return options;
  }, []);

  const charts = useMemo(() => {
    if (!baseCharts.length) return [];
    return baseCharts
      .filter((c) => !filter[c.attribute])
      .sort((a, b) => {
        const aRank = FILTER_POPULARITY_INDEX.has(a.attribute)
          ? FILTER_POPULARITY_INDEX.get(a.attribute)
          : Number.MAX_SAFE_INTEGER;
        const bRank = FILTER_POPULARITY_INDEX.has(b.attribute)
          ? FILTER_POPULARITY_INDEX.get(b.attribute)
          : Number.MAX_SAFE_INTEGER;
        if (aRank !== bRank) return aRank - bRank;
        return a.title.localeCompare(b.title);
      });
  }, [baseCharts, filter]);

  useEffect(() => {
    if (!isRefreshing) return undefined;

    const lowerBound = 1;
    const upperBound = Math.max(lowerBound + 1, defaultTotalCount);
    const nextRandomCount = () => {
      const value = Math.floor(Math.random() * (upperBound - lowerBound + 1)) + lowerBound;
      setAnimatedFilteredCount(value);
    };

    const kickoffId = window.setTimeout(nextRandomCount, 0);
    const intervalId = window.setInterval(nextRandomCount, 70);

    return () => {
      window.clearTimeout(kickoffId);
      window.clearInterval(intervalId);
    };
  }, [isRefreshing, defaultTotalCount]);

  const delusionPct = showLoadedFilteredData && Number.isFinite(summary?.delusionPct) ? summary.delusionPct : 0;
  const clampedDelusionPct = Math.max(0, Math.min(100, delusionPct));
  const shouldGlowShareButton = clampedDelusionPct >= 99 && !showShareMenu;
  const delusionHue = 140 - (clampedDelusionPct / 100) * 140;
  const delusionFillGradient = `linear-gradient(90deg, hsl(${delusionHue} 70% 72%) 0%, hsl(${delusionHue} 84% 58%) 100%)`;
  const filteredCount = showLoadedFilteredData
    ? Number.isFinite(summary?.filteredCount)
      ? summary.filteredCount
      : 0
    : defaultTotalCount;
  const displayedFilteredCount = isRefreshing ? animatedFilteredCount : filteredCount;
  const shareText = useMemo(() => {
    return `My type is ${typeDescription} which makes me ${delusionPct.toFixed(1)}% delusional. Are you more delusional than me?`;
  }, [typeDescription, delusionPct]);
  const shareUrl = "https://thedelusionmeter.com";
  const sharePayloadText = useMemo(() => {
    return `${shareText} ${shareUrl}`;
  }, [shareText, shareUrl]);
  const confettiPieces = useMemo(() => {
    const palette = ["#ff5fb4", "#ffd166", "#7c4dff", "#4cd964", "#7ae582", "#ff8fab", "#8ec5ff", "#ff9cd3"];
    return Array.from({ length: 42 }, (_, idx) => {
      const left = (idx * 17) % 100;
      const drift = ((idx % 2 === 0 ? 1 : -1) * (52 + (idx % 7) * 18));
      const rotation = 320 + (idx % 11) * 58;
      const duration = 3200 + (idx % 9) * 260;
      const delay = (idx % 8) * 90;
      const size = 6 + (idx % 5) * 2;
      return {
        id: idx,
        left,
        drift,
        rotation,
        duration,
        delay,
        size,
        color: palette[idx % palette.length],
      };
    });
  }, []);

  useEffect(() => {
    if (!showLoadedFilteredData) {
      prevDelusionPctRef.current = 0;
      return;
    }

    const previousPct = prevDelusionPctRef.current;
    let triggerTimeoutId;
    if (clampedDelusionPct >= 100 && previousPct < 100) {
      triggerTimeoutId = window.setTimeout(() => {
        setConfettiBurstId((v) => v + 1);
        setShowConfettiBurst(true);
      }, 0);
    }
    prevDelusionPctRef.current = clampedDelusionPct;

    return () => {
      if (triggerTimeoutId) {
        window.clearTimeout(triggerTimeoutId);
      }
    };
  }, [clampedDelusionPct, showLoadedFilteredData]);

  useEffect(() => {
    if (!showConfettiBurst) return undefined;

    const timeoutId = window.setTimeout(() => {
      setShowConfettiBurst(false);
    }, 5600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [showConfettiBurst, confettiBurstId]);

  if (showSplash) {
    return (
      <div className="loadingLoveScreen">
        <div className="loadingLoveContent">
          <div className="heartIcon" aria-hidden="true" />
          <div className="loadingLoveText">Loading love...</div>
        </div>
      </div>
    );
  }

  async function handleCopyShare() {
    try {
      await navigator.clipboard.writeText(sharePayloadText);
      setShareStatus("Copied!");
    } catch {
      setShareStatus("Copy failed");
    }
  }

  async function handleShareAction() {
    setShareStatus("");
    setShowDelusionHelp(false);

    const isMobileShareClient =
      typeof navigator !== "undefined" &&
      (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
        (navigator.maxTouchPoints > 1 && /Macintosh/i.test(navigator.userAgent)));

    if (isMobileShareClient && typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: "The Delusion Meter",
          text: sharePayloadText,
        });
        return;
      } catch (error) {
        // User-cancel or unsupported payload falls back to in-app share options.
        if (error?.name === "AbortError") {
          return;
        }
      }
    }

    setShowShareMenu((v) => !v);
  }

  return (
    <div className="container">
      {showConfettiBurst && (
        <div className="confettiBurst" key={confettiBurstId} aria-hidden="true">
          {confettiPieces.map((piece) => (
            <span
              key={`${confettiBurstId}-${piece.id}`}
              className="confettiPiece"
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: Math.round(piece.size * 1.75),
                background: piece.color,
                "--drift": `${piece.drift}px`,
                "--rot": `${piece.rotation}deg`,
                "--dur": `${piece.duration}ms`,
                "--delay": `${piece.delay}ms`,
              }}
            />
          ))}
        </div>
      )}
      <div style={{
        background: "linear-gradient(180deg, #2f1744 0%, #251136 100%)",
        border: "1px solid rgba(255, 167, 223, 0.3)",
        borderRadius: 12,
        boxShadow: "0 8px 20px rgba(11, 0, 19, 0.35)",
        padding: "1.5rem 1.5rem",
        marginBottom: "1.5rem",
      }}>
        <div className="huge-title" style={{ margin: "0 0 1.2rem 0" }}>How delusional are you?</div>
        <FilterPanel
          filter={filter}
          onFilterChange={handleFilterChange}
          filteredCount={displayedFilteredCount}
          attributeOptions={filterOptionsByAttribute}
          onTypeDescriptionChange={setTypeDescription}
        />
        {error && (
          <div className="loading" style={{ marginBottom: "0.75rem", color: "var(--danger)" }}>
            Error: {error}
          </div>
        )}

        {/* Delusion Meter Progress Bar */}
        <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", margin: "16px 0 0 0", padding: "0 0 8px 0", position: "relative" }}>
        <div ref={delusionHelpRef} style={{ position: "relative", display: "inline-block", fontWeight: 700, color: "var(--accent-soft)", marginBottom: 18, fontSize: "clamp(1.4rem, 5.5vw, 1.95rem)", alignSelf: "center", fontFamily: "Courier New, Lucida Console, monospace" }}>
         The Delusion Meter
          <button
            type="button"
            className="delusionHelpButton"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#4b5563",
              color: "#ffe9fa",
              border: "none",
              fontWeight: 900,
              fontSize: "0.55em",
              cursor: "pointer",
              position: "absolute",
              top: -4,
              right: -16,
              boxShadow: "0 1px 4px #0004"
            }}
            onClick={() => setShowDelusionHelp((v) => !v)}
            aria-label="Explain delusion percent"
            aria-expanded={showDelusionHelp}
          >
            ?
          </button>
          {showDelusionHelp && (
            <div
              className="delusionHelpPopover"
              style={{
                position: "absolute",
                top: "calc(100% + 8px)",
                right: -8,
                width: "min(280px, 85vw)",
                textAlign: "left",
                color: "var(--text-main)",
                background: "#2a113d",
                border: "1px solid rgba(255, 156, 211, 0.45)",
                borderRadius: 8,
                padding: "0.55rem 0.65rem",
                fontSize: "0.7em",
                fontWeight: 500,
                lineHeight: 1.35,
                boxShadow: "0 6px 20px rgba(0, 0, 0, 0.5)",
                zIndex: 20
              }}
            >
              The Delusion Meter shows how picky your filters are. 0% means you are seeing all profiles, 100% means no profiles match your criteria.
            </div>
          )}
        </div>
        <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", background: "#2a1239", borderRadius: 12, height: "clamp(36px, 7vw, 44px)", position: "relative", boxShadow: "0 2px 8px rgba(0,0,0,0.45)", border: "1px solid rgba(255,167,223,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: `${delusionPct}%`,
            height: "100%",
            background: delusionFillGradient,
            borderRadius: 12,
            transition: "width 1.2s cubic-bezier(0.4, 0.0, 0.2, 1)",
            position: "absolute",
            left: 0,
            top: 0,
          }} />
          <div style={{
            position: "relative",
            zIndex: 2,
            color: "#fff6ff",
            fontWeight: 700,
            fontSize: "clamp(0.95rem, 3.8vw, 1.2rem)",
            textShadow: "-1px -1px 0 #2a1239, 1px -1px 0 #2a1239, -1px 1px 0 #2a1239, 1px 1px 0 #2a1239, 0 0 8px rgba(0,0,0,0.7), 0 1px 4px #0008",
            width: "100%",
            textAlign: "center"
          }}>{delusionPct.toFixed(1)}% Delusional</div>
        </div>
        <div className="shareButtonAnchor">
          <button
            type="button"
            className={`${shouldGlowShareButton ? "sharePromptGlow " : ""}shareResultButton`}
            onClick={handleShareAction}
            aria-expanded={showShareMenu}
            aria-label="Share delusion meter result"
          >
            <span className="shareButtonDesktopLabel">Share</span>
            <span className="shareButtonMobileLabel">Share your results!</span>
          </button>
        </div>
      </div>
      </div>

      {showShareMenu && (
        <div
          onClick={() => setShowShareMenu(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 200,
            background: "rgba(16, 5, 25, 0.72)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(14px, 3vw, 28px)",
          }}
        >
          <div
            ref={shareMenuRef}
            onClick={(event) => event.stopPropagation()}
            style={{
              width: "min(880px, 95vw)",
              background: "#241136",
              border: "1px solid rgba(255, 156, 211, 0.5)",
              borderRadius: 14,
              boxShadow: "0 14px 34px rgba(0, 0, 0, 0.45)",
              padding: "clamp(1rem, 2.5vw, 2rem)",
              color: "var(--text-main)",
            }}
          >
            <div style={{ fontSize: "clamp(1.25rem, 2.3vw, 1.9rem)", fontWeight: 800, marginBottom: 12, color: "#ffd3ef", lineHeight: 1.2 }}>
              Share your delusion!
            </div>
            <div style={{ marginBottom: 16, color: "var(--text-muted)", lineHeight: 1.55, fontSize: "clamp(1rem, 1.5vw, 1.22rem)", background: "rgba(41, 15, 62, 0.65)", border: "1px solid rgba(255, 184, 232, 0.25)", borderRadius: 8, padding: "1rem", boxShadow: "inset 0 1px 4px rgba(0, 0, 0, 0.3)" }}>
              {shareText}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleCopyShare}
                style={{
                  background: "rgba(255, 184, 232, 0.16)",
                  color: "#ffe9fa",
                  border: "1px solid rgba(255, 184, 232, 0.5)",
                  borderRadius: 8,
                  padding: "0.6rem 1rem",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "clamp(0.95rem, 1.25vw, 1.1rem)",
                }}
              >
                Copy to clipboard
              </button>
              <button
                type="button"
                onClick={() => setShowShareMenu(false)}
                style={{
                  background: "transparent",
                  color: "#e7c7f2",
                  border: "1px solid rgba(231, 199, 242, 0.45)",
                  borderRadius: 8,
                  padding: "0.6rem 1rem",
                  cursor: "pointer",
                  fontWeight: 700,
                  fontSize: "clamp(0.95rem, 1.25vw, 1.1rem)",
                }}
              >
                Close
              </button>
            </div>
            {shareStatus && <div style={{ marginTop: 12, color: "#ffd4ef", fontWeight: 700, fontSize: "clamp(0.95rem, 1.2vw, 1.08rem)" }}>{shareStatus}</div>}
          </div>
        </div>
      )}

      {charts.length === 0 ? (
        <div style={{
          margin: "60px 0 80px 0",
          fontSize: "clamp(1.4rem, 6.4vw, 2.5rem)",
          color: "var(--accent-soft)",
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2
        }}>
          Congrats! You are completely delusional. There are 0 profiles that meet this criteria.<br />
          <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "clamp(1rem, 4.4vw, 1.3rem)" }}>
            (Or really unique if you just described yourself.)
          </span>
        </div>
      ) : (
        <div className="grid">
          {charts.map((c) => (
            <ChartCard
              key={c.attribute}
              attribute={c.attribute}
              title={c.title}
              answeredCount={c.answeredCount}
              labels={c.labels}
              values={c.values}
              filter={filter}
              onFilterChange={handleFilterChange}
              isFilterEditorOpen={openFilterEditorAttr === c.attribute}
              onToggleFilterEditor={(nextOpen) => setOpenFilterEditorAttr(nextOpen ? c.attribute : null)}
              canFilter
            />
          ))}
        </div>
      )}
    </div>
  );
}
