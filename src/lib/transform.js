const IGNORE_FIELDS = new Set(["user_id", "name", "about_me", "education", "occupation_raw"]);
const MIN_SLICE_PCT = 2;

// --- Display name mapping ---
const DISPLAY_NAME_MAP = {
  education_level: "Education",
  looking_for: "Looking for",
  star_sign: "Star sign",
};

const ZODIAC_ORDER = [
  "Aries", "Taurus", "Gemini", "Cancer",
  "Leo", "Virgo", "Libra", "Scorpio",
  "Sagittarius", "Capricorn", "Aquarius", "Pisces"
];


function titleCaseFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function prettifyAttributeName(attr) {
  if (DISPLAY_NAME_MAP[attr]) return DISPLAY_NAME_MAP[attr];
  return titleCaseFirst(attr.replace(/_/g, " "));
}


// -------- Age bucketing --------
function bucketAge(ageValue) {
  const n = parseInt(String(ageValue).trim(), 10);
  if (!Number.isFinite(n)) return null;

  if (n < 21) return "<21";
  const start = 21 + Math.floor((n - 21) / 5) * 5;
  const end = start + 4;
  return `${start}-${end}`;
}

function parseAgeBucketStart(label) {
  if (label.startsWith("<")) return Number.NEGATIVE_INFINITY;
  if (label.startsWith(">")) return Number.POSITIVE_INFINITY;
  const m = label.match(/^(\d+)-/);
  return m ? parseInt(m[1], 10) : Number.POSITIVE_INFINITY;
}

// -------- Height parsing & bucketing --------
function parseHeightToInches(value) {
  const v = String(value).toLowerCase();

  const feetInches = v.match(/(\d+)\s*'\s*(\d+)?/);
  if (feetInches) {
    const feet = parseInt(feetInches[1], 10);
    const inches = parseInt(feetInches[2] || 0, 10);
    return feet * 12 + inches;
  }

  const ft = v.match(/(\d+)\s*ft/);
  const inch = v.match(/(\d+)\s*in/);
  if (ft) {
    const feet = parseInt(ft[1], 10);
    const inches = inch ? parseInt(inch[1], 10) : 0;
    return feet * 12 + inches;
  }

  const cm = v.match(/(\d+)\s*cm/);
  if (cm) return parseInt(cm[1], 10) / 2.54;

  return null;
}

function formatInches(n) {
  const inches = Math.round(n);
  const ft = Math.floor(inches / 12);
  const inch = inches % 12;
  return `${ft}'${inch}"`;
}

// 4-inch buckets
function bucketHeight(heightValue) {
  const inches = parseHeightToInches(heightValue);
  if (!Number.isFinite(inches)) return null;

  const start = Math.floor(inches / 4) * 4;
  const end = start + 3;

  return `${formatInches(start)}-${formatInches(end)}`;
}

function parseHeightBucketStart(label) {
  if (label.startsWith("<")) return Number.NEGATIVE_INFINITY;
  if (label.startsWith(">")) return Number.POSITIVE_INFINITY;

  const m = label.match(/^(\d+)'\s*(\d+)"/);
  if (!m) return Number.POSITIVE_INFINITY;
  return parseInt(m[1], 10) * 12 + parseInt(m[2], 10);
}

// -------- Tail collapsing for age/height (no "Other") --------
function collapseTailsNoOther({ entries, answeredCount, kind }) {
  const isSmall = (count) => (count / answeredCount) * 100 < MIN_SLICE_PCT;

  let lowEnd = -1;
  for (let i = 0; i < entries.length; i++) {
    if (isSmall(entries[i][1])) lowEnd = i;
    else break;
  }

  let highStart = entries.length;
  for (let i = entries.length - 1; i >= 0; i--) {
    if (isSmall(entries[i][1])) highStart = i;
    else break;
  }

  const allSmall = lowEnd === entries.length - 1;
  if (allSmall) {
    return { labels: entries.map(e => e[0]), values: entries.map(e => e[1]) };
  }

  const labels = [];
  const values = [];

  // Low tail
  if (lowEnd >= 0) {
    const lowCount = entries.slice(0, lowEnd + 1).reduce((s, [, c]) => s + c, 0);
    const firstKeptLabel = entries[lowEnd + 1]?.[0];

    if (kind === "age") {
      const start = parseAgeBucketStart(firstKeptLabel);
      labels.push(Number.isFinite(start) ? `<${start}` : "Low");
    } else {
      const startIn = parseHeightBucketStart(firstKeptLabel);
      labels.push(Number.isFinite(startIn) ? `<${formatInches(startIn)}` : "Low");
    }

    values.push(lowCount);
  }

  // Middle
  const midStart = lowEnd + 1;
  const midEnd = highStart - 1;
  for (let i = midStart; i <= midEnd; i++) {
    if (i < 0 || i >= entries.length) continue;
    labels.push(entries[i][0]);
    values.push(entries[i][1]);
  }

  // High tail
  if (highStart < entries.length) {
    const highCount = entries.slice(highStart).reduce((s, [, c]) => s + c, 0);
    const lastKeptLabel = entries[highStart - 1]?.[0];

    if (kind === "age") {
      const start = parseAgeBucketStart(lastKeptLabel);
      labels.push(Number.isFinite(start) ? `>${start + 4}` : "High");
    } else {
      // For 4-inch buckets: upper bound = start + 3
      const startIn = parseHeightBucketStart(lastKeptLabel);
      if (Number.isFinite(startIn)) {
        const upperBound = startIn + 3;
        labels.push(`>${formatInches(upperBound)}`);
      } else {
        labels.push("High");
      }
    }

    values.push(highCount);
  }

  return { labels, values };
}

export function buildAttributeCharts(rows, headers) {
  const charts = [];

  for (const attr of headers) {
    if (!attr || IGNORE_FIELDS.has(attr)) continue;

    const isAge = attr === "age";
    const isHeight = attr === "height";

    const counts = new Map();
    let answeredCount = 0;

    for (const r of rows) {
      let value = r[attr];
      if (value == null) continue;

      // Special case: for gender, treat blanks as Non-binary/Gender Nonconforming (instead of skipping)
      if (attr === "gender") {
        const raw = String(value).trim();
        value = raw ? raw : "Non-binary/Gender Nonconforming";
      } else {
        value = String(value);
        if (!value.trim()) continue;
      }



      if (isAge) {
        const b = bucketAge(value);
        if (!b) continue;
        value = b;
      }

      if (isHeight) {
        const b = bucketHeight(value);
        if (!b) continue;
        value = b;
      }

      counts.set(value, (counts.get(value) || 0) + 1);
      answeredCount++;
    }

    if (answeredCount === 0) continue;

    let entries = Array.from(counts.entries());

    if (isAge) {
      entries.sort((a, b) => parseAgeBucketStart(a[0]) - parseAgeBucketStart(b[0]));
    } else if (isHeight) {
      entries.sort((a, b) => parseHeightBucketStart(a[0]) - parseHeightBucketStart(b[0]));
    } else {
      entries.sort((a, b) => b[1] - a[1]);
    }

    if (attr === "star_sign") {
  entries.sort((a, b) =>
    ZODIAC_ORDER.indexOf(a[0]) - ZODIAC_ORDER.indexOf(b[0])
  );
}

    let labels = [];
    let values = [];

    if (isAge || isHeight) {
      const collapsed = collapseTailsNoOther({
        entries,
        answeredCount,
        kind: isAge ? "age" : "height",
      });
      labels = collapsed.labels;
      values = collapsed.values;
    } else if (attr === "star_sign" || attr === "looking_for" || attr === "religion" || attr === "kids") {
      // Do not collapse small slices into 'Other' for star_sign, looking_for, religion, or kids
      for (const [label, count] of entries) {
        labels.push(label);
        values.push(count);
      }
    } else {
      let otherCount = 0;
      for (const [label, count] of entries) {
        const pct = (count / answeredCount) * 100;
        if (pct < MIN_SLICE_PCT) otherCount += count;
        else {
          labels.push(label);
          values.push(count);
        }
      }
      if (otherCount > 0) {
        labels.push("Other");
        values.push(otherCount);
      }
    }

    charts.push({
      attribute: attr,
      title: prettifyAttributeName(attr),
      answeredCount,
      labels,
      values,
    });
  }

  return charts;
}

export function getAttributeValues(rows, attribute) {
  if (!rows || !rows.length) return [];

  const values = new Set();
  for (const row of rows) {
    let val = row[attribute];
    if (val != null && String(val).trim()) {
      // No location normalization needed; locations are now just state names
      values.add(String(val).trim());
    }
  }

  return Array.from(values).sort();
}

