const LOOKING_FOR_COLORS = {
  Relationship: "#ef4444",
  "Something casual": "#ec4899", 
  "Don't know yet": "#7c3aed",
  Marriage: "#ffffff",
};
const SMOKING_COLORS = {
  Never: "#f5f5f2",
  Socially: "#d6a04a",
  Regularly: "#b6b28b", 
};

const CANNABIS_COLORS = {
  Never: "#e4483c",
  Socially: "#14532d",
  Frequently: "#22c55e",
};
const ZODIAC_COLORS = {
  Aries: "#ff3b30",
  Taurus: "#ff7a00",
  Gemini: "#ffb300",
  Cancer: "#ffe119",
  Leo: "#b7e10f",
  Virgo: "#41d93f",
  Libra: "#00c97f",
  Scorpio: "#00b8d9",
  Sagittarius: "#2196f3",
  Capricorn: "#4f63ff",
  Aquarius: "#8a3ffc",
  Pisces: "#d81b9c",
};

const POLITICS_COLORS = {
  liberal: "#3b82f6",
  conservative: "#ef4444",
  moderate: "#a855f7",
  apolitical: "#9ca3af",
};

const GENDER_COLORS = {
  Man: "#3b82f6",
  Woman: "#ec4899",
  "Non-binary/Gender Nonconforming": "#facc15",
};

const RELIGION_COLORS = {
  Christian: "#e11d48",
  Agnostic: "#f97316",
  Catholic: "#c7d72f",   
  Spiritual: "#4ade80",    
  Other: "#2dd4bf",         
  Atheist: "#60a5fa",      
  Jewish: "#6366f1",        
  Hindu: "#a855f7",        
  Muslim: "#14b8a6",         
  Buddhist: "#f59e0b",     
  Sikh: "#22c55e",        
  "Latter-day Saint": "#eab308",
  Jain: "#10b981",         
  Mormon: "#f43f5e",     
  Zoroastrian: "#3b82f6", 
};

function getMappedColor(label, attribute = null) {
  if (attribute === "star_sign" && ZODIAC_COLORS[label]) {
    return ZODIAC_COLORS[label];
  }

  if (attribute === "politics" && POLITICS_COLORS[label?.toLowerCase()]) {
    return POLITICS_COLORS[label.toLowerCase()];
  }

  if (attribute === "gender" && GENDER_COLORS[label]) {
    return GENDER_COLORS[label];
  }

  if (attribute === "smoking" && SMOKING_COLORS[label]) {
    return SMOKING_COLORS[label];
  }

  if (attribute === "cannabis" && CANNABIS_COLORS[label]) {
    return CANNABIS_COLORS[label];
  }

  if (attribute === "looking_for" && LOOKING_FOR_COLORS[label]) {
    return LOOKING_FOR_COLORS[label];
  }

  if (attribute === "religion" && RELIGION_COLORS[label]) {
    return RELIGION_COLORS[label];
  }

  return null;
}

// Produces visually separated colors within a single chart.
export function colorsForLabels(labels, attribute = null) {
  return labels.map((label) => {
    const mapped = getMappedColor(label, attribute);
    if (mapped) return mapped;

    // Stable fallback by attribute+label so filtering/order changes do not recolor slices.
    const seed = `${attribute || "default"}:${label}`;
    const h = Math.abs(hash(seed));
    const hue = h % 360;
    const saturation = 64 + (h % 12); // 64-75
    const lightness = 48 + (h % 10);  // 48-57
    return `hsl(${hue},${saturation}%,${lightness}%)`;
  });
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}
