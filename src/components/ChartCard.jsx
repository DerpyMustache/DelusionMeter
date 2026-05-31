import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { colorForLabel } from "../lib/colors.js";
import { useState } from "react";
import { getAttributeValues } from "../lib/transform.js";

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

export default function ChartCard({ attribute, title, answeredCount, labels, values, filter, onFilterChange, rows }) {
  const [showDropdown, setShowDropdown] = useState(false);
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

  return (
    <div className="card" style={{ position: "relative" }}>
      <div className="cardHeader" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", position: "relative" }}>
        <h2>{title}</h2>
        <div style={{ position: "relative" }}>
          {!filter[attribute] && (
            <button
              style={{ fontSize: "0.9em", background: "#222", color: "#a7f3d0", border: "none", borderRadius: 4, padding: "0.3em 0.7em", cursor: "pointer" }}
              onClick={() => setShowDropdown((v) => !v)}
            >
              Filter by
            </button>
          )}
          {showDropdown && !filter[attribute] && (
            <div style={{ position: "absolute", top: "110%", right: 0, zIndex: 10, background: "#222", borderRadius: 4, boxShadow: "0 2px 12px #0008", padding: "0.3em 0.7em" }}>
              <select
                autoFocus
                size={attribute === "gender" ? 4 : Math.max(2, Math.min(6, getAttributeValues(rows, attribute).length + 1))}
                style={{
                  background: "#222",
                  color: "#a7f3d0",
                  border: "none",
                  fontWeight: 600,
                  fontSize: "0.9em",
                  borderRadius: 4,
                  cursor: "pointer",
                  minWidth: 120,
                  outline: "none"
                }}
                onBlur={() => setShowDropdown(false)}
                onChange={e => {
                  if (e.target.value) {
                    onFilterChange({ ...filter, [attribute]: e.target.value });
                    setShowDropdown(false);
                  }
                }}
                defaultValue=""
              >
                <option value="" disabled>
                  Select value…
                </option>
                {attribute === "gender"
                  ? ["Man", "Woman", "Non-binary/Gender Nonconforming"].map(val => (
                      <option key={val} value={val}>{val}</option>
                    ))
                  : attribute === "age"
                    ? labels.map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))
                    : getAttributeValues(rows, attribute).map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
              </select>
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
