import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { colorForLabel } from "../lib/colors.js";
import { useState } from "react";

ChartJS.register(ArcElement, Tooltip, Legend);

// Dark-mode readable defaults
ChartJS.defaults.color = "#e5e7eb";
ChartJS.defaults.plugins.legend.labels.color = "#e5e7eb";

// Center text plugin (true doughnut center, two lines)
const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart, args, options) {
    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || !meta.data.length) return;

    const { ctx } = chart;
    const { x, y } = meta.data[0]; // arc center

    ctx.save();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // Top line: number
    ctx.font = "700 18px system-ui";
    ctx.fillStyle = "#e5e7eb";
    ctx.fillText(options.topText, x, y - 8);

    // Bottom line: label
    ctx.font = "500 12px system-ui";
    ctx.fillStyle = "#9ca3af";
    ctx.fillText(options.bottomText, x, y + 10);

    ctx.restore();
  },
};

export default function ChartCard({ attribute, title, answeredCount, labels, values, filter, onFilterChange, canFilter = true }) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [pendingValues, setPendingValues] = useState([]);
  const [selectionError, setSelectionError] = useState("");
  // Replace 'Other' with 'Non-binary/Gender Nonconforming' for gender labels
  const displayLabels = attribute === "gender"
    ? labels.map(l => l === "Other" ? "Non-binary/Gender Nonconforming" : l)
    : labels;
  const colors = displayLabels.map((label) => colorForLabel(label, attribute));

  const data = {
    labels: displayLabels,
    datasets: [
      {
        data: values,
        backgroundColor: colors,
        borderColor: "rgba(255,255,255,0.10)",
        borderWidth: 1,
        cutout: "65%",
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: "bottom" },
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

    setShowDropdown(false);
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
        <div style={{ position: "relative" }}>
          {canFilter && (
            <button
              style={{ fontSize: "0.9em", background: "#222", color: "#a7f3d0", border: "none", borderRadius: 4, padding: "0.3em 0.7em", cursor: "pointer" }}
              onClick={() => {
                setPendingValues(selectedValues);
                setSelectionError("");
                setShowDropdown((v) => !v);
              }}
            >
              {selectedValues.length > 0 ? `Edit filter (${selectedValues.length})` : "Filter by"}
            </button>
          )}
          {showDropdown && (
            <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 10, background: "#222", borderRadius: 4, boxShadow: "0 2px 12px #0008", padding: "0.3em 0.7em", width: "fit-content" }}>
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
                        color: checked ? "#a7f3d0" : "#e5e7eb",
                        fontSize: "0.9em",
                        whiteSpace: "nowrap",
                        cursor: "pointer"
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
                <div style={{ color: "#fca5a5", fontSize: "0.78em", marginTop: 6, maxWidth: 220, lineHeight: 1.3 }}>
                  {selectionError}
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "center", marginTop: selectionError ? 8 : 4, paddingTop: 2, gap: 10 }}>
                <button
                  style={{
                    fontSize: "0.8em",
                    background: "transparent",
                    color: "#d1d5db",
                    border: "1px solid #4b5563",
                    borderRadius: 4,
                    padding: "0.25em 0.7em",
                    minWidth: 68,
                    cursor: "pointer",
                    textAlign: "center"
                  }}
                  onClick={() => {
                    setPendingValues(selectedValues);
                    setSelectionError("");
                    setShowDropdown(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  style={{
                    fontSize: "0.8em",
                    background: "#111827",
                    color: "#93c5fd",
                    border: "1px solid #1e3a8a",
                    borderRadius: 4,
                    padding: "0.25em 0.7em",
                    minWidth: 68,
                    cursor: "pointer",
                    textAlign: "center"
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
