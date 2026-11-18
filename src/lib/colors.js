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
const EXERCISE_COLORS = {
  "Almost never": "#ef4444",
  Sometimes: "#3b82f6",
  Often: "#f59e0b",
  "Every day": "#8b5cf6",
  Active: "#22c55e",
};
const LOCATION_COLORS = {
  California: "#ef4444",
  Texas: "#f97316",
  Florida: "#eab308",
  "New York": "#22c55e",
  Pennsylvania: "#14b8a6",
  "New Jersey": "#a855f7",
  Washington: "#ec4899",
  Louisiana: "#f43f5e",
  Oklahoma: "#84cc16",
  Connecticut: "#06b6d4",
  Illinois: "#6366f1",
  Ohio: "#fb923c",
  Georgia: "#10b981",
  Michigan: "#c084fc",
  Arizona: "#fbbf24",
  "North Carolina": "#38bdf8",
  Virginia: "#4ade80",
  Massachusetts: "#e879f9",
  Colorado: "#ff7a00",
  Tennessee: "#67e8f9",
  Indiana: "#f87171",
  Missouri: "#a3e635",
  Maryland: "#818cf8",
  Wisconsin: "#fdba74",
  Minnesota: "#34d399",
  "South Carolina": "#fb7185",
  Alabama: "#7dd3fc",
  Oregon: "#fde68a",
  Kentucky: "#d946ef",
  Nevada: "#4ade80",
  Other: "#94a3b8",
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
  Liberal: "#3b82f6",
  Conservative: "#ef4444",
  Moderate: "#a855f7",
  Apolitical: "#9ca3af",
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

const ATTRIBUTE_COLORS = {
  looking_for: LOOKING_FOR_COLORS,
  smoking: SMOKING_COLORS,
  cannabis: CANNABIS_COLORS,
  exercise: EXERCISE_COLORS,
  location: LOCATION_COLORS,
  star_sign: ZODIAC_COLORS,
  politics: POLITICS_COLORS,
  gender: GENDER_COLORS,
  religion: RELIGION_COLORS,
};

function getMappedColor(label, attribute = null) {
  return ATTRIBUTE_COLORS[attribute]?.[label] ?? null;
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
