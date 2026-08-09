import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { useEffect, useRef, useState } from "react";
import { colorsForLabels } from "../lib/colors.js";

ChartJS.register(ArcElement, Tooltip, Legend);

// Keep chart text readable against the themed dark background.
ChartJS.defaults.color = "#dcb6ea";
ChartJS.defaults.plugins.legend.labels.color = "#ffe9fa";

const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart, args, options) {
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;

    const { ctx } = chart;
    const { x, y } = meta.data[0];

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.font = "700 18px Trebuchet MS";
    ctx.fillStyle = "#ffe9fa";
    ctx.fillText(options.topText, x, y - 8);

    ctx.font = "500 12px Trebuchet MS";
    ctx.fillStyle = "#dcb6ea";
    ctx.fillText(options.bottomText, x, y + 10);

    ctx.restore();
  },
};

export default function ChartCard({
  attribute,
  title,
  answeredCount,
  labels,
  values,
  filter,
  onFilterChange,
  canFilter = true,
  isFilterEditorOpen = false,
  onToggleFilterEditor,
}) {
  const [pendingValues, setPendingValues] = useState([]);
  const [selectionError, setSelectionError] = useState("");
  const showDropdown = isFilterEditorOpen;
  const dropdownRef = useRef(null);

  useEffect(() => {
    if (!showDropdown) return undefined;

    const onPointerDown = (event) => {
      if (!dropdownRef.current?.contains(event.target)) {
        onToggleFilterEditor?.(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [showDropdown, onToggleFilterEditor]);

  const displayLabels = attribute === "gender"
    ? labels.map((l) => (l === "Other" ? "Non-binary/Gender Nonconforming" : l))
    : labels;
  const chartColors = colorsForLabels(displayLabels, attribute);

  const originalEntries = displayLabels.map((label, idx) => ({
    label,
    value: values[idx],
    color: chartColors[idx],
    originalIndex: idx,
  }));

  const sortedEntries = attribute === "star_sign"
    ? [...originalEntries]
    : [...originalEntries].sort((a, b) => {
        if (a.value !== b.value) return a.value - b.value;
        return a.originalIndex - b.originalIndex;
      });

  const sortedLabels = sortedEntries.map((entry) => entry.label);
  const sortedValues = sortedEntries.map((entry) => entry.value);
  const sortedColors = sortedEntries.map((entry) => entry.color);
  const sortedIndexByLabel = new Map(sortedEntries.map((entry, idx) => [entry.label, idx]));

  const data = {
    labels: sortedLabels,
    datasets: [
      {
        data: sortedValues,
        backgroundColor: sortedColors,
        borderColor: "rgba(255,255,255,0.10)",
        borderWidth: 1,
        cutout: "65%",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: {
        top: 8,
        right: 4,
        left: 4,
        bottom: 0,
      },
    },
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          color: "#ffe9fa",
          // Keep legend in original order while arcs are sorted.
          generateLabels: (chart) => originalEntries.map((entry) => {
            const sortedIndex = sortedIndexByLabel.get(entry.label) ?? 0;
            return {
              text: entry.label,
              fillStyle: entry.color,
              strokeStyle: "rgba(255,255,255,0.10)",
              fontColor: "#ffe9fa",
              lineWidth: 1,
              hidden: !chart.getDataVisibility(sortedIndex),
              index: sortedIndex,
            };
          }),
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const v = ctx.raw;
            const pct = ((v / answeredCount) * 100).toFixed(1);
            return `${ctx.label}: ${pct}%`;
          },
        },
      },
      centerText: {
        topText: answeredCount.toLocaleString(),
        bottomText: "profiles",
      },
    },
  };

  const selectedValues = Array.isArray(filter[attribute])
    ? filter[attribute]
    : filter[attribute]
      ? [filter[attribute]]
      : [];

  const filterOptions = attribute === "gender"
    ? ["Man", "Woman", "Non-binary/Gender Nonconforming"]
    : labels;

  const togglePendingValue = (value) => {
    setSelectionError("");
    setPendingValues((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  };

  const applyPendingSelection = () => {
    const nextValues = [...pendingValues];
    if (nextValues.length === filterOptions.length) {
      setSelectionError("Try removing at least one option.");
      return;
    }

    const currentSorted = [...selectedValues].sort();
    const nextSorted = [...nextValues].sort();
    const unchanged =
      currentSorted.length === nextSorted.length &&
      currentSorted.every((v, i) => v === nextSorted[i]);

    onToggleFilterEditor?.(false);
    if (unchanged) return;

    const nextFilter = { ...filter };
    if (nextValues.length === 0) {
      delete nextFilter[attribute];
    } else {
      nextFilter[attribute] = nextValues;
    }
    onFilterChange(nextFilter);
  };

  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="cardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <h2>{title}</h2>
        <div ref={dropdownRef} style={{ position: "relative" }}>
          {canFilter && (
            <button
              style={{
                fontSize: "0.98em",
                background: "#3a1c55",
                color: "#ffd3ef",
                border: "1px solid rgba(255, 176, 228, 0.45)",
                borderRadius: 6,
                padding: "0.22em 0.64em",
                lineHeight: 1.1,
                cursor: "pointer",
              }}
              onClick={() => {
                setPendingValues(selectedValues);
                setSelectionError("");
                onToggleFilterEditor?.(!showDropdown);
              }}
            >
              {selectedValues.length > 0 ? `Edit filter (${selectedValues.length})` : "Filter by"}
            </button>
          )}
          {showDropdown && (
            <div
              style={{
                position: "absolute",
                top: "110%",
                right: 0,
                zIndex: 10,
                background: "#2a1239",
                border: "1px solid rgba(255, 176, 228, 0.35)",
                borderRadius: 8,
                boxShadow: "0 6px 16px rgba(0, 0, 0, 0.45)",
                padding: "0.3em 0.7em",
                width: "fit-content",
              }}
            >
              <div style={{ width: "max-content", minWidth: 120, maxWidth: 260, maxHeight: 240, overflowY: "auto", padding: "0.2rem 0 0 0" }}>
                {filterOptions.map((val) => {
                  const checked = pendingValues.includes(val);
                  return (
                    <label
                      key={val}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.45rem",
                        padding: "0.2rem 0.1rem",
                        color: checked ? "#ffb8e7" : "#ffe9fa",
                        fontSize: "0.9em",
                        whiteSpace: "nowrap",
                        cursor: "pointer",
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => togglePendingValue(val)}
                      />
                      <span>{val}</span>
                    </label>
                  );
                })}
              </div>
              {selectionError && (
                <div style={{ color: "#ffcde2", fontSize: "0.78em", marginTop: 6, maxWidth: 220, lineHeight: 1.3 }}>
                  {selectionError}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "center", marginTop: selectionError ? 8 : 4, paddingTop: 2, gap: 10 }}>
                <button
                  style={{
                    fontSize: "0.8em",
                    background: "transparent",
                    color: "#e7c7f2",
                    border: "1px solid rgba(231, 199, 242, 0.4)",
                    borderRadius: 4,
                    padding: "0.25em 0.7em",
                    minWidth: 68,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  onClick={() => {
                    setPendingValues(selectedValues);
                    setSelectionError("");
                    onToggleFilterEditor?.(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  style={{
                    fontSize: "0.8em",
                    background: "rgba(255, 126, 196, 0.18)",
                    color: "#ffd9ef",
                    border: "1px solid rgba(255, 126, 196, 0.55)",
                    borderRadius: 4,
                    padding: "0.25em 0.7em",
                    minWidth: 68,
                    cursor: "pointer",
                    textAlign: "center",
                  }}
                  onClick={applyPendingSelection}
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="chartBox">
        <Doughnut data={data} options={options} plugins={[centerTextPlugin]} />
      </div>
    </div>
  );
}
