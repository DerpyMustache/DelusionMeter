import { useEffect, useMemo, useState } from "react";
// Decoding logic for numbered profile keys and values
const ATTRIBUTE_MAP = {
  1: "age",
  2: "cannabis",
  3: "drinking",
  4: "education_level",
  5: "exercise",
  6: "gender",
  7: "height",
  8: "kids",
  9: "location",
  10: "looking_for",
  11: "occupation",
  12: "politics",
  13: "religion",
  14: "smoking",
  15: "star_sign"
};

import VALUE_MAPS from "./lib/valueMaps.js";
import INITIAL_CHARTS from "./lib/initialCharts.js";

const FIXED_HEADERS = Object.values(ATTRIBUTE_MAP);

function decodeProfile(profile) {
  const decoded = {};
  for (const key in profile) {
    const attr = ATTRIBUTE_MAP[key] || key;
    let val = profile[key];
    if (VALUE_MAPS[attr] && VALUE_MAPS[attr][val]) {
      val = VALUE_MAPS[attr][val];
    }
    decoded[attr] = val;
  }
  return decoded;
}

import ChartCard from "./components/ChartCard.jsx";
import FilterPanel from "./components/FilterPanel.jsx";
import { buildAttributeCharts } from "./lib/transform.js";

export default function App() {
  const [rows, setRows] = useState(null);
  const [headers, setHeaders] = useState(null);
  const [error, setError] = useState(null);
  const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");
  // filter: { [attribute]: value }
  const [filter, setFilter] = useState({});

  useEffect(() => {
    fetch(apiBaseUrl + "/profiles")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load data");
        return res.json();
      })
      .then((data) => {
        // Decode numbered keys and values if present
        const decoded = Array.isArray(data) && typeof data[0] === 'object' && Object.keys(data[0]).some(k => ATTRIBUTE_MAP[k])
          ? data.map(decodeProfile)
          : data;
        setRows(decoded);
        if (decoded.length > 0) {
          setHeaders(FIXED_HEADERS);
        } else {
          setHeaders([]);
        }
      })
      .catch((err) => setError(err?.message || "Failed to load data"));
  }, [apiBaseUrl]);

  // Filter rows based on all active filters
  const filteredRows = useMemo(() => {
    if (!rows || !filter || Object.keys(filter).length === 0) return rows;
    // Use centralized normalization helpers from transform.js
    return rows.filter((row) =>
      Object.entries(filter).every(([attr, val]) => {
        return val === undefined || val === null || val === "" ? true : row[attr] === val;
      })
    );
  }, [rows, filter]);

  const allCharts = useMemo(() => {
    if (!filteredRows || !headers) return [];
    return buildAttributeCharts(filteredRows, headers);
  }, [filteredRows, headers]);

  const charts = useMemo(() => {
    if (!rows && Object.keys(filter).length === 0) {
      return INITIAL_CHARTS;
    }

    if (!allCharts.length) return [];

    // Remove charts for filtered attributes
    if (filter && Object.keys(filter).length > 0) {
      return allCharts.filter((c) => !filter[c.attribute]);
    }
    return allCharts;
  }, [allCharts, filter, rows]);

  if (error) {
    return (
      <div className="container">
        <h1>Profile Attribute Breakdown</h1>
        <div className="loading">Error: {error}</div>
      </div>
    );
  }

  if ((!rows || !headers) && INITIAL_CHARTS.length === 0) {
    return (
      <div className="loadingLoveScreen">
        <div className="loadingLoveContent">
          <div className="heartIcon" aria-hidden="true" />
          <div className="loadingLoveText">Loading love...</div>
        </div>
      </div>
    );
  }

  // Calculate delusion meter value (based on answered count for filtered attribute)
  let delusionPct = 0;
  if (rows && Object.keys(filter).length > 0) {
    // Find the attribute with the smallest answeredCount among active filters
    let minAnswered = null;
    let minAttr = null;
    for (const attr of Object.keys(filter)) {
      // Count how many profiles answered this attribute
      const answered = rows.filter(r => {
        const v = r[attr];
        return v !== undefined && v !== null && String(v).trim() !== "";
      }).length;
      if (minAnswered === null || answered < minAnswered) {
        minAnswered = answered;
        minAttr = attr;
      }
    }
    if (minAnswered > 0) {
      // Count how many filteredRows answered this attribute
      const filteredAnswered = filteredRows.filter(r => {
        const v = r[minAttr];
        return v !== undefined && v !== null && String(v).trim() !== "";
      }).length;
      delusionPct = 100 * (1 - filteredAnswered / minAnswered);
      delusionPct = delusionPct.toFixed(2);
    } else {
      delusionPct = 0;
    }
  } else {
    delusionPct = 0;
  }

  return (
    <div className="container">
      <div className="huge-title">How delusional are you? *</div>
      {rows && headers ? (
        <FilterPanel
          rows={rows}
          headers={headers}
          filter={filter}
          onFilterChange={setFilter}
          filteredRows={filteredRows}
        />
      ) : (
        <div style={{ marginBottom: "1.5rem", color: "#9ca3af", textAlign: "center" }}>
          Loading filter options...
        </div>
      )}

      {/* Delusion Meter Progress Bar */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", margin: "16px 0 24px 0", padding: "0 0 8px 0" }}>
        <div style={{ position: "relative", display: "inline-block", fontWeight: 600, color: "#a7f3d0", marginBottom: 18, fontSize: "1.6em", alignSelf: "center" }}>
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
        <div style={{ width: "100%", maxWidth: 1400, margin: "0 auto", background: "#222", borderRadius: 12, height: 44, position: "relative", boxShadow: "0 1px 6px #0004", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{
            width: `${delusionPct}%`,
            height: "100%",
            background: "linear-gradient(90deg, #f87171 0%, #fbbf24 50%, #a7f3d0 100%)",
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
            fontSize: "1.2em",
            textShadow: "-1px -1px 0 #222, 1px -1px 0 #222, -1px 1px 0 #222, 1px 1px 0 #222, 0 1px 4px #0008",
            width: "100%",
            textAlign: "center"
          }}>{delusionPct}%</div>
        </div>
      </div>

      {charts.length === 0 ? (
        <div style={{
          margin: "60px 0 80px 0",
          fontSize: "2.5rem",
          color: "#a7f3d0",
          fontWeight: 700,
          textAlign: "center",
          lineHeight: 1.2
        }}>
          Congrats! You are completely delusional. There are 0 profiles that meet this criteria.<br />
          <span style={{ fontWeight: 400, color: "#9ca3af", fontSize: "1.3rem" }}>
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
              onFilterChange={setFilter}
              rows={rows || []}
              canFilter={Boolean(rows)}
            />
          ))}
        </div>
      )}

      <div className="smallNote">
        <div style={{ marginTop: "2em", color: "#9ca3af", fontSize: "13px" }}>
          * Compared to a sample size of ~10000 Bumble profiles within a 100 miles radius of Seattle.
        </div>
      </div>
    </div>
  );
}
