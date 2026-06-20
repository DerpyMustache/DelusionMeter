import { useEffect, useMemo, useRef, useState } from "react";
import INITIAL_CHARTS from "./lib/initialCharts.js";
const SPLASH_SEEN_KEY = "delusionmeter:splashSeen:v1";

import ChartCard from "./components/ChartCard.jsx";
import FilterPanel from "./components/FilterPanel.jsx";

export default function App() {
  const [summary, setSummary] = useState(null);
  const [loadedFilter, setLoadedFilter] = useState({});
  const [error, setError] = useState(null);
  const requestIdRef = useRef(0);
  const [showSplash, setShowSplash] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.sessionStorage.getItem(SPLASH_SEEN_KEY) !== "1";
  });
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
  // filter: { [attribute]: value }
  const [filter, setFilter] = useState({});
  const hasActiveFilters = Object.keys(filter).length > 0;
  const filterKey = useMemo(() => {
    const entries = Object.entries(filter)
      .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v])
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
  }, [filter]);
  const loadedFilterKey = useMemo(() => {
    const entries = Object.entries(loadedFilter)
      .map(([k, v]) => [k, Array.isArray(v) ? [...v].sort() : v])
      .sort(([a], [b]) => a.localeCompare(b));
    return JSON.stringify(entries);
  }, [loadedFilter]);
  const isCurrentFilterLoaded = hasActiveFilters && summary && loadedFilterKey === filterKey;
  const showLoadedFilteredData = Boolean(summary) && Object.keys(loadedFilter).length > 0;
  const isRefreshing = hasActiveFilters && !isCurrentFilterLoaded;
  const defaultTotalCount = useMemo(
    () => Math.max(0, ...INITIAL_CHARTS.map((c) => Number(c.answeredCount) || 0)),
    []
  );

  function handleFilterChange(nextFilter) {
    const cleaned = {};
    for (const [attr, raw] of Object.entries(nextFilter)) {
      if (Array.isArray(raw)) {
        const values = raw
          .map((v) => String(v).trim())
          .filter((v) => v !== "");
        if (values.length > 0) cleaned[attr] = values;
        continue;
      }

      if (raw !== undefined && raw !== null && String(raw).trim() !== "") {
        cleaned[attr] = String(raw).trim();
      }
    }
    if (Object.keys(cleaned).length === 0) {
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

  const baseCharts = useMemo(
    () => (showLoadedFilteredData ? summary?.charts || [] : INITIAL_CHARTS),
    [showLoadedFilteredData, summary]
  );

  const filterOptionsByAttribute = useMemo(() => {
    const options = {};

    // Keep editor choices stable even when charts are filtered/hidden.
    for (const chart of INITIAL_CHARTS) {
      options[chart.attribute] = [...(chart.labels || [])];
    }

    return options;
  }, []);

  const charts = useMemo(() => {
    if (!baseCharts.length) return [];
    return baseCharts.filter((c) => !filter[c.attribute]);
  }, [baseCharts, filter]);

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

  const delusionPct = showLoadedFilteredData && Number.isFinite(summary?.delusionPct) ? summary.delusionPct : 0;
  const clampedDelusionPct = Math.max(0, Math.min(100, delusionPct));
  const delusionHue = 140 - (clampedDelusionPct / 100) * 140;
  const delusionFillGradient = `linear-gradient(90deg, hsl(${delusionHue} 70% 72%) 0%, hsl(${delusionHue} 84% 58%) 100%)`;
  const filteredCount = showLoadedFilteredData
    ? Number.isFinite(summary?.filteredCount)
      ? summary.filteredCount
      : 0
    : defaultTotalCount;

  return (
    <div className="container">
      <div className="huge-title">How delusional are you?</div>
      <FilterPanel
        filter={filter}
        onFilterChange={handleFilterChange}
        filteredCount={filteredCount}
        attributeOptions={filterOptionsByAttribute}
      />
      {isRefreshing && (
        <div className="loading" style={{ marginBottom: "0.75rem" }}>
          Applying filters...
        </div>
      )}
      {error && (
        <div className="loading" style={{ marginBottom: "0.75rem", color: "#fca5a5" }}>
          Error: {error}
        </div>
      )}

      {/* Delusion Meter Progress Bar */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", margin: "16px 0 24px 0", padding: "0 0 8px 0" }}>
        <div style={{ position: "relative", display: "inline-block", fontWeight: 600, color: "#a7f3d0", marginBottom: 18, fontSize: "clamp(1.2rem, 4.8vw, 1.6rem)", alignSelf: "center" }}>
          Delusion Meter
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 16,
              height: 16,
              borderRadius: "50%",
              background: "#444",
              color: "#fff",
              fontWeight: 900,
              fontSize: "0.55em",
              cursor: "pointer",
              position: "absolute",
              top: -4,
              right: -16,
              boxShadow: "0 1px 4px #0004"
            }}
            title={"The Delusion Meter shows how picky your filters are. 0% means you're seeing all profiles, 100% means no profiles match your criteria."}
          >
            ?
          </span>
        </div>
        <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", background: "#222", borderRadius: 12, height: "clamp(36px, 7vw, 44px)", position: "relative", boxShadow: "0 1px 6px #0004", display: "flex", alignItems: "center", justifyContent: "center" }}>
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
            color: delusionPct > 80 ? "#f87171" : delusionPct > 40 ? "#fbbf24" : "#a7f3d0",
            fontWeight: 700,
            fontSize: "clamp(0.95rem, 3.8vw, 1.2rem)",
            textShadow: "-1px -1px 0 #222, 1px -1px 0 #222, -1px 1px 0 #222, 1px 1px 0 #222, 0 1px 4px #0008",
            width: "100%",
            textAlign: "center"
          }}>{delusionPct.toFixed(1)}% Delusional</div>
        </div>
      </div>

      {charts.length === 0 ? (
        <div style={{
          margin: "60px 0 80px 0",
          fontSize: "clamp(1.4rem, 6.4vw, 2.5rem)",
          color: "#a7f3d0",
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2
        }}>
          Congrats! You are completely delusional. There are 0 profiles that meet this criteria.<br />
          <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: "clamp(1rem, 4.4vw, 1.3rem)" }}>
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
              canFilter
            />
          ))}
        </div>
      )}
    </div>
  );
}
