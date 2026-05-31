const LOOKING_FOR_COLORS = {
  Relationship: "#ef4444", // red
  "Something casual": "#ec4899", // pink
  "Don't know yet": "#7c3aed", // purple
  Marriage: "#ffffff", // white
};
const SMOKING_COLORS = {
  Never: "#f5f5f2",      // paper
  Socially: "#d6a04a",   // filter
  Regularly: "#b6b28b",  // band/ash
};
const ZODIAC_COLORS = {
  Aries: "#e53935",        // red
  Taurus: "#ef6c00",      // orange
  Gemini: "#f9a825",      // yellow
  Cancer: "#fdd835",      // yellow-gold
  Leo: "#cddc39",         // yellow-green
  Virgo: "#8bc34a",       // green
  Libra: "#43a047",       // green-teal
  Scorpio: "#26a69a",     // teal
  Sagittarius: "#1e88e5", // blue
  Capricorn: "#3949ab",   // indigo
  Aquarius: "#8e24aa",    // purple
  Pisces: "#d81b60",      // magenta
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
  Other: "#facc15",
  "Non-binary/Gender Nonconforming": "#facc15", // yellow
};

export function colorForLabel(label, attribute = null) {
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

  if (attribute === "looking_for" && LOOKING_FOR_COLORS[label]) {
    return LOOKING_FOR_COLORS[label];
  }

  // fallback
  const h = Math.abs(hash(label)) % 360;
  return `hsl(${h},70%,55%)`;
}

function hash(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return h;
}
