const DISPLAY_NAME_MAP = {
  education_level: "Education",
  looking_for: "Looking for",
  star_sign: "Star sign",
};


function titleCaseFirst(s) {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function prettifyAttributeName(attr) {
  if (DISPLAY_NAME_MAP[attr]) return DISPLAY_NAME_MAP[attr];
  return titleCaseFirst(attr.replace(/_/g, " "));
}

