
import { useEffect, useMemo, useState } from "react";
import sharedConstants from "../../shared/profile_constants.json";

const CHIP_TUTORIAL_SEEN_KEY = "delusionmeter:chipEditHintSeen:v1";
const CHIP_TUTORIAL_DELAY_MS = 2200;
const FILTER_PRIORITY_ORDER = ["height", "age", "gender", "politics", "star_sign"];
const TUTORIAL_CANNABIS_OPTIONS = ["Never", "Socially", "Frequently"];
const DISPLAY_NAME_MAP = sharedConstants.DISPLAY_NAME_MAP || {};

function prettifyAttributeName(attr) {
  if (DISPLAY_NAME_MAP[attr]) return DISPLAY_NAME_MAP[attr];
  const label = attr.replace(/_/g, " ");
  return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
}

function religionToNoun(value) {
  const normalized = String(value).trim();
  switch (normalized) {
    case "Agnostic":
      return "agnostics";
    case "Atheist":
      return "atheists";
    case "Buddhist":
      return "buddhists";
    case "Catholic":
      return "catholics";
    case "Christian":
      return "christians";
    case "Hindu":
      return "hindus";
    case "Jain":
      return "jains";
    case "Jewish":
      return "jewish people";
    case "Latter-day Saint":
      return "latter-day saints";
    case "Mormon":
      return "mormons";
    case "Muslim":
      return "muslims";
    case "Other":
      return "people of other religions";
    case "Sikh":
      return "sikhs";
    case "Spiritual":
      return "spiritual people";
    case "Zoroastrian":
      return "zoroastrians";
    default:
      return `${normalized.toLowerCase()} people`;
  }
}

function politicsToNoun(value) {
  const normalized = String(value).trim();
  switch (normalized) {
    case "Conservative":
      return "conservatives";
    case "Liberal":
      return "liberals";
    case "Moderate":
      return "moderates";
    case "Apolitical":
      return "apolitical people";
    case "Other":
      return "people with other political views";
    default:
      return `${normalized.toLowerCase()} people`;
  }
}

function normalizeValues(raw) {
  if (Array.isArray(raw)) {
    return raw.map((v) => String(v).trim()).filter(Boolean);
  }
  if (raw === undefined || raw === null) return [];
  const value = String(raw).trim();
  return value ? [value] : [];
}

function normalizeLowerWithNever(values) {
  return values.map((value) => String(value).trim().toLowerCase());
}

function isSingleNever(values) {
  return values.length === 1 && values[0] === "never";
}

function joinWithOr(values) {
  if (values.length === 0) return "";
  if (values.length === 1) return values[0];
  if (values.length === 2) return `${values[0]} or ${values[1]}`;
  return `${values.slice(0, -1).join(", ")}, or ${values[values.length - 1]}`;
}

function parseFeetInches(text) {
  const match = String(text).trim().match(/^(\d+)\s*'\s*(\d+)"?$/);
  if (!match) return null;
  return Number(match[1]) * 12 + Number(match[2]);
}

function formatFeetInches(inches) {
  const feet = Math.floor(inches / 12);
  const rem = inches % 12;
  return `${feet}'${rem}"`;
}

function combineAgeBuckets(values) {
  const ranges = values
    .map((value) => {
      const trimmed = String(value).trim();

      const rangeMatch = trimmed.match(/^(\d{1,3})-(\d{1,3})$/);
      if (rangeMatch) {
        return {
          start: Number(rangeMatch[1]),
          end: Number(rangeMatch[2]),
          ltBoundary: null,
          gtBoundary: null,
        };
      }

      const ltMatch = trimmed.match(/^<(\d{1,3})$/);
      if (ltMatch) {
        const boundary = Number(ltMatch[1]);
        return {
          start: Number.NEGATIVE_INFINITY,
          end: boundary - 1,
          ltBoundary: boundary,
          gtBoundary: null,
        };
      }

      const gtMatch = trimmed.match(/^>(\d{1,3})$/);
      if (gtMatch) {
        const boundary = Number(gtMatch[1]);
        return {
          start: boundary + 1,
          end: Number.POSITIVE_INFINITY,
          ltBoundary: null,
          gtBoundary: boundary,
        };
      }

      const singleMatch = trimmed.match(/^(\d{1,3})$/);
      if (singleMatch) {
        const n = Number(singleMatch[1]);
        return { start: n, end: n, ltBoundary: null, gtBoundary: null };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  if (ranges.length !== values.length) return joinWithOr(values);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
      if (last.ltBoundary == null && range.ltBoundary != null) {
        last.ltBoundary = range.ltBoundary;
      }
      if (last.gtBoundary == null && range.gtBoundary != null) {
        last.gtBoundary = range.gtBoundary;
      }
    }
  }

  const labels = merged.map((r) => {
    if (r.start === Number.NEGATIVE_INFINITY) {
      if (r.ltBoundary != null && Number.isFinite(r.end) && r.end >= r.ltBoundary) {
        return `<${r.ltBoundary}-${r.end}`;
      }
      if (r.ltBoundary != null) {
        return `<${r.ltBoundary}`;
      }
      return `<${r.end + 1}`;
    }

    if (r.end === Number.POSITIVE_INFINITY) {
      if (r.gtBoundary != null && Number.isFinite(r.start) && r.start <= r.gtBoundary) {
        return `${r.start}+`;
      }
      if (r.gtBoundary != null && Number.isFinite(r.start) && r.start <= r.gtBoundary + 1) {
        return `>${r.gtBoundary}`;
      }
      if (Number.isFinite(r.start)) {
        return `${r.start}+`;
      }
      return `>${r.gtBoundary ?? ""}`;
    }

    return r.start === r.end ? String(r.start) : `${r.start}-${r.end}`;
  });
  return joinWithOr(labels);
}

function combineHeightBuckets(values) {
  const ranges = values
    .map((value) => {
      const trimmed = String(value).trim();

      const rangeMatch = trimmed.match(/^(\d+\s*'\s*\d+"?)-(\d+\s*'\s*\d+"?)$/);
      if (rangeMatch) {
        const start = parseFeetInches(rangeMatch[1]);
        const end = parseFeetInches(rangeMatch[2]);
        if (start === null || end === null) return null;
        return {
          start,
          end,
          ltBoundary: null,
          gtBoundary: null,
        };
      }

      const ltMatch = trimmed.match(/^<(\d+\s*'\s*\d+"?)$/);
      if (ltMatch) {
        const boundary = parseFeetInches(ltMatch[1]);
        if (boundary === null) return null;
        return {
          start: Number.NEGATIVE_INFINITY,
          end: boundary - 1,
          ltBoundary: boundary,
          gtBoundary: null,
        };
      }

      const gtMatch = trimmed.match(/^>(\d+\s*'\s*\d+"?)$/);
      if (gtMatch) {
        const boundary = parseFeetInches(gtMatch[1]);
        if (boundary === null) return null;
        return {
          start: boundary + 1,
          end: Number.POSITIVE_INFINITY,
          ltBoundary: null,
          gtBoundary: boundary,
        };
      }

      const single = parseFeetInches(trimmed);
      if (single !== null) {
        return {
          start: single,
          end: single,
          ltBoundary: null,
          gtBoundary: null,
        };
      }

      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  if (ranges.length !== values.length) return joinWithOr(values);

  const merged = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (!last || range.start > last.end + 1) {
      merged.push({ ...range });
    } else {
      last.end = Math.max(last.end, range.end);
      if (last.ltBoundary == null && range.ltBoundary != null) {
        last.ltBoundary = range.ltBoundary;
      }
      if (last.gtBoundary == null && range.gtBoundary != null) {
        last.gtBoundary = range.gtBoundary;
      }
    }
  }

  const labels = merged.map((r) => {
    if (r.start === Number.NEGATIVE_INFINITY) {
      if (r.ltBoundary != null && Number.isFinite(r.end) && r.end >= r.ltBoundary) {
        return `<${formatFeetInches(r.ltBoundary)}-${formatFeetInches(r.end)}`;
      }
      if (r.ltBoundary != null) {
        return `<${formatFeetInches(r.ltBoundary)}`;
      }
      return `<${formatFeetInches(r.end + 1)}`;
    }

    if (r.end === Number.POSITIVE_INFINITY) {
      if (r.gtBoundary != null && Number.isFinite(r.start) && r.start <= r.gtBoundary) {
        return `${formatFeetInches(r.start)}+`;
      }
      if (r.gtBoundary != null && Number.isFinite(r.start) && r.start <= r.gtBoundary + 1) {
        return `>${formatFeetInches(r.gtBoundary)}`;
      }
      if (Number.isFinite(r.start)) {
        return `${formatFeetInches(r.start)}+`;
      }
      return `>${formatFeetInches(r.gtBoundary ?? 0)}`;
    }

    return r.start === r.end
      ? formatFeetInches(r.start)
      : `${formatFeetInches(r.start)}-${formatFeetInches(r.end)}`;
  });

  return joinWithOr(labels);
}

function buildSentenceParts(sorted) {
  let adjectiveParts = [];
  let nounPart = null;
  let verbParts = [];
  let ageSelected = false;
  let ageValueText = "";
  let ageAdjectiveIndex = -1;
  let politicsValues = [];
  let politicsAdjectiveIndex = -1;

  for (const [attr, val] of sorted) {
    const values = normalizeValues(val);
    if (values.length === 0) continue;

    if (attr === "politics") {
      politicsValues = values;
      adjectiveParts.push({ attr, text: joinWithOr(values.map((v) => v.toLowerCase())) });
      politicsAdjectiveIndex = adjectiveParts.length - 1;
    } else if (attr === "age") {
      const ageValue = combineAgeBuckets(values);
      ageSelected = true;
      ageValueText = ageValue;
      adjectiveParts.push({ attr, text: `${ageValue} year old` });
      ageAdjectiveIndex = adjectiveParts.length - 1;
    } else if (attr === "gender") {
      const mapped = values.map((value) => {
        const lowerVal = value.toLowerCase();
        if (lowerVal === "man") return "men";
        if (lowerVal === "woman") return "women";
        if (lowerVal === "other") return "other people";
        if (value === "Non-binary/Gender Nonconforming") return "Non-binary/Gender Nonconforming people";
        return value;
      });
      nounPart = { attr, text: joinWithOr(mapped) };
    } else if (attr === "star_sign") {
      verbParts.push({ attr, text: `have the star sign ${joinWithOr(values)}` });
    } else if (attr === "height") {
      adjectiveParts.push({ attr, text: combineHeightBuckets(values) });
    } else if (attr === "drinking") {
      const drinkingText = normalizeLowerWithNever(values);
      if (isSingleNever(drinkingText)) {
        verbParts.push({ attr, text: "never drink" });
      } else {
        verbParts.push({ attr, text: `drink ${joinWithOr(drinkingText)}` });
      }
    } else if (attr === "cannabis") {
      const cannabisText = normalizeLowerWithNever(values);
      if (isSingleNever(cannabisText)) {
        verbParts.push({ attr, text: "never use cannabis" });
      } else {
        verbParts.push({ attr, text: `use cannabis ${joinWithOr(cannabisText)}` });
      }
        } else if (attr === "smoking") {
          const smokingText = normalizeLowerWithNever(values);
          if (isSingleNever(smokingText)) {
            verbParts.push({ attr, text: "never smoke" });
          } else {
            verbParts.push({ attr, text: `smoke ${joinWithOr(smokingText)}` });
          }
    } else if (attr === "exercise") {
      const exerciseParts = values.map((value) => {
        const exerciseText = value.toLowerCase();
        if (exerciseText === "active") return "often";
        if (exerciseText === "sometimes") return "sometimes";
        if (exerciseText === "never") return "never";
        return exerciseText;
      });
      if (isSingleNever(exerciseParts)) {
        verbParts.push({ attr, text: "never exercise" });
      } else {
        verbParts.push({ attr, text: `exercise ${joinWithOr(exerciseParts)}` });
      }
    } else if (attr === "education_level") {
      const educationPhrases = values.map((value) => {
        const normalizedEducation = String(value).trim().toLowerCase();
        if (normalizedEducation === "high school") return "are high school educated";
        if (normalizedEducation === "undergraduate degree") return "have undergraduate degrees";
        if (normalizedEducation === "college" || normalizedEducation === "in college") return "are in college";
        if (normalizedEducation === "graduate degree") return "have graduate degrees";
        if (normalizedEducation === "trade/tech school") return "have trade or tech school backgrounds";
        if (normalizedEducation === "in grad school") return "are in grad school";
        return `have education level ${value}`;
      });

      if (educationPhrases.length === 1) {
        verbParts.push({ attr, text: educationPhrases[0] });
      } else {
        verbParts.push({ attr, text: joinWithOr(educationPhrases) });
      }
    } else if (attr === "looking_for") {
      const lookingText = values.map((value) => value.toLowerCase());
      if (lookingText.length === 1) {
        if (lookingText[0] === "relationship") {
          verbParts.push({ attr, text: "are looking for a relationship" });
        } else if (lookingText[0] === "something casual") {
          verbParts.push({ attr, text: "are looking for something casual" });
        } else if (lookingText[0] === "marriage") {
          verbParts.push({ attr, text: "are looking for marriage" });
        } else if (lookingText[0] === "don’t know yet") {
          verbParts.push({ attr, text: "don't know what they are looking for yet" });
        } else {
          verbParts.push({ attr, text: `are looking for ${values[0]}` });
        }
      } else {
        verbParts.push({ attr, text: `are looking for ${joinWithOr(values)}` });
      }
    } else if (attr === "kids") {
      const kidsText = values.map((value) => {
        const normalizedKids = String(value).trim().toLowerCase().replace(/’/g, "'");
        switch (normalizedKids) {
          case "don't want":
            return "do not want kids";
          case "have and don't want more":
            return "have kids and do not want more";
          case "have and want more":
            return "have kids and want more";
          case "have kids":
          case "has kids":
            return "have kids";
          case "not sure yet":
            return "are not sure about having kids";
          case "open to kids":
            return "are open to having kids";
          case "want someday":
            return "want to have kids someday";
          default:
            return `have kids preference: ${value}`;
        }
      });
      if (kidsText.length === 1) {
        verbParts.push({ attr, text: kidsText[0] });
      } else {
        verbParts.push({ attr, text: joinWithOr(kidsText) });
      }
    } else if (attr === "religion") {
      const religionNoun = joinWithOr(values.map((value) => religionToNoun(value)));
      if (!nounPart) {
        nounPart = { attr, text: religionNoun };
      } else {
        adjectiveParts.push({ attr, text: joinWithOr(values.map((value) => String(value).trim().toLowerCase())) });
      }
    } else if (attr === "occupation") {
      const occupationText = values.map((value) => String(value).trim());
      if (occupationText.length === 1 && occupationText[0].toLowerCase() === "unemployed") {
        verbParts.push({ attr, text: "are unemployed" });
      } else {
        verbParts.push({ attr, text: `work in ${joinWithOr(occupationText)}` });
      }
    } else if (attr === "location") {
      // Locations are now just state names
        verbParts.push({ attr, text: `are in ${joinWithOr(values)}` });
    } else {
      verbParts.push({ attr, text: `${prettifyAttributeName(attr).toLowerCase()}: ${joinWithOr(values)}` });
    }
  }

  return {
    adjectiveParts,
    nounPart,
    verbParts,
    ageSelected,
    ageValueText,
    ageAdjectiveIndex,
    politicsValues,
    politicsAdjectiveIndex,
  };
}


export default function FilterPanel({ filter, onFilterChange, filteredCount = 0, isRefreshing = false, totalCount = 0, attributeOptions = {}, onTypeDescriptionChange }) {
  const [editingAttr, setEditingAttr] = useState(null);
  const [pendingValues, setPendingValues] = useState([]);
  const [selectionError, setSelectionError] = useState("");
  const [animatedFilteredCount, setAnimatedFilteredCount] = useState(0);
  const [editorPosition, setEditorPosition] = useState({ top: 0, left: 0 });
  const [editorIsCentered, setEditorIsCentered] = useState(false);
  const [chipTutorialVisible, setChipTutorialVisible] = useState(false);
  const [tutorialDemoValues, setTutorialDemoValues] = useState(["Socially"]);
  const [tutorialDemoPendingValues, setTutorialDemoPendingValues] = useState(["Socially"]);
  const [tutorialDemoOpen, setTutorialDemoOpen] = useState(false);
  const [tutorialDemoError, setTutorialDemoError] = useState("");
  const [chipTutorialSeen, setChipTutorialSeen] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(CHIP_TUTORIAL_SEEN_KEY) === "1";
  });

  useEffect(() => {
    if (!isRefreshing) return undefined;

    const upperBound = Math.max(2, totalCount);
    const updateCount = () => {
      setAnimatedFilteredCount(Math.floor(Math.random() * upperBound) + 1);
    };
    const kickoffId = window.setTimeout(updateCount, 0);
    const intervalId = window.setInterval(updateCount, 70);

    return () => {
      window.clearTimeout(kickoffId);
      window.clearInterval(intervalId);
    };
  }, [isRefreshing, totalCount]);

  const displayFilteredCount = isRefreshing ? animatedFilteredCount : filteredCount;

  // Build the improved, natural sentence
  const filterEntries = useMemo(
    () => Object.entries(filter).filter(([, v]) => v),
    [filter]
  );
  const showChipTutorial = filterEntries.length > 0 && !chipTutorialSeen;

  useEffect(() => {
    if (!showChipTutorial || chipTutorialVisible) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setChipTutorialVisible(true);
    }, CHIP_TUTORIAL_DELAY_MS);

    return () => window.clearTimeout(timeoutId);
  }, [showChipTutorial, chipTutorialVisible]);

  const markChipTutorialSeen = () => {
    if (chipTutorialSeen) return;
    setChipTutorialSeen(true);
    setChipTutorialVisible(false);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(CHIP_TUTORIAL_SEEN_KEY, "1");
    }
  };

  const toggleTutorialDemoValue = (value) => {
    setTutorialDemoPendingValues((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
    setTutorialDemoError("");
  };

  const applyTutorialDemoSelection = () => {
    if (tutorialDemoPendingValues.length === TUTORIAL_CANNABIS_OPTIONS.length) {
      setTutorialDemoError("Try removing at least one option.");
      return;
    }
    setTutorialDemoValues([...tutorialDemoPendingValues]);
    setTutorialDemoOpen(false);
    setTutorialDemoError("");
  };

  // Order: height, age, gender, politics, star_sign, then the rest
  const sorted = useMemo(() => {
    const orderRank = new Map(FILTER_PRIORITY_ORDER.map((key, index) => [key, index]));
    return filterEntries
      .map((entry, index) => ({ entry, index }))
      .sort((a, b) => {
        const aRank = orderRank.has(a.entry[0]) ? orderRank.get(a.entry[0]) : FILTER_PRIORITY_ORDER.length;
        const bRank = orderRank.has(b.entry[0]) ? orderRank.get(b.entry[0]) : FILTER_PRIORITY_ORDER.length;
        if (aRank !== bRank) return aRank - bRank;
        return a.index - b.index;
      })
      .map(({ entry }) => entry);
  }, [filterEntries]);

  let {
    adjectiveParts,
    nounPart,
    verbParts,
    ageSelected,
    ageValueText,
    ageAdjectiveIndex,
    politicsValues,
    politicsAdjectiveIndex,
  } = useMemo(() => buildSentenceParts(sorted), [sorted]);

  // Avoid mutating values directly from a memoized object.
  adjectiveParts = [...adjectiveParts];

  if (!nounPart && politicsValues.length > 0 && politicsAdjectiveIndex !== -1) {
    nounPart = { attr: "politics", text: joinWithOr(politicsValues.map((value) => politicsToNoun(value))) };
    adjectiveParts = adjectiveParts.filter((_, idx) => idx !== politicsAdjectiveIndex);
  }

  let sentence = "";
  if (filterEntries.length === 0) {
    sentence = `Showing all ${displayFilteredCount} profiles`;
  } else {
    sentence = `Showing ${displayFilteredCount} profiles from`;
    if (!nounPart) {
      if (ageSelected && ageAdjectiveIndex !== -1) {
        adjectiveParts[ageAdjectiveIndex] = { attr: "age", text: `${ageValueText} year olds` };
        nounPart = { attr: null, text: "" };
      } else {
        nounPart = { attr: null, text: "people" };
      }
    }
  }

  // Extract type description for share functionality
  useEffect(() => {
    if (onTypeDescriptionChange) {
      let typeDesc = "";
      if (filterEntries.length === 0) {
        typeDesc = "everyone";
      } else {
        // Build "adjectives noun who verbs" part
        const parts = [];
        adjectiveParts.forEach((part) => {
          if (part?.text) parts.push(part.text);
        });
        if (nounPart?.text) parts.push(nounPart.text);
        if (verbParts.length > 0) {
          parts.push("who");
          const verbTexts = verbParts.map((part) => part?.text).filter(Boolean);
          if (verbTexts.length === 1) {
            parts.push(verbTexts[0]);
          } else if (verbTexts.length === 2) {
            parts.push(`${verbTexts[0]} and ${verbTexts[1]}`);
          } else if (verbTexts.length > 2) {
            parts.push(`${verbTexts.slice(0, -1).join(", ")}, and ${verbTexts[verbTexts.length - 1]}`);
          }
        }
        typeDesc = parts.join(" ");
      }
      onTypeDescriptionChange(typeDesc);
    }
  }, [adjectiveParts, nounPart, verbParts, onTypeDescriptionChange, filterEntries.length]);

  const chipButtonStyle = {
    color: "#ffd3ef",
    background: "rgba(255, 126, 196, 0.14)",
    border: "1px solid rgba(255, 184, 232, 0.45)",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: "0.82em",
    fontWeight: 700,
    padding: "0.22rem 0.48rem",
    verticalAlign: "middle"
  };

  const renderPhrasePart = (part, key) => {
    if (!part || !part.text) return null;
    if (!part.attr) {
      return <span key={key}>{part.text}</span>;
    }

    return (
      <span key={key} style={{ position: "relative", display: "inline-flex" }}>
        <button
          onClick={(event) => openAttrEditor(part.attr, event)}
          style={chipButtonStyle}
          title={`Edit ${prettifyAttributeName(part.attr)}`}
        >
          {part.text}
        </button>
      </span>
    );
  };

  const getOptionsForAttr = (attr) => {
    if (attr === "gender") {
      return ["Man", "Woman", "Non-binary/Gender Nonconforming"];
    }
    return attributeOptions[attr] || normalizeValues(filter[attr]);
  };

  const openAttrEditor = (attr, event) => {
    markChipTutorialSeen();

    if (window.innerWidth <= 700) {
      setEditorIsCentered(true);
    } else {
      const rect = event?.currentTarget?.getBoundingClientRect?.();
      const panelWidth = 280;
      const margin = 10;
      const scrollX = window.scrollX || window.pageXOffset || 0;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const leftInViewport = Math.max(
        margin,
        Math.min((rect?.right ?? margin) + 8, window.innerWidth - panelWidth - margin)
      );
      const topInViewport = Math.max(margin, (rect?.bottom ?? margin) + 6);
      setEditorIsCentered(false);
      setEditorPosition({ top: topInViewport + scrollY, left: leftInViewport + scrollX });
    }

    setEditingAttr(attr);
    setPendingValues(normalizeValues(filter[attr]));
    setSelectionError("");
  };

  const togglePendingValue = (value) => {
    setSelectionError("");
    setPendingValues((current) =>
      current.includes(value)
        ? current.filter((v) => v !== value)
        : [...current, value]
    );
  };

  const applyAttrSelection = () => {
    if (!editingAttr) return;
    const options = getOptionsForAttr(editingAttr);
    const nextValues = [...pendingValues];
    if (options.length > 0 && nextValues.length === options.length) {
      setSelectionError("Try removing at least one option.");
      return;
    }

    const currentValues = normalizeValues(filter[editingAttr]);
    const currentSorted = [...currentValues].sort();
    const nextSorted = [...nextValues].sort();
    const unchanged =
      currentSorted.length === nextSorted.length &&
      currentSorted.every((v, i) => v === nextSorted[i]);

    setEditingAttr(null);
    if (unchanged) return;

    const nextFilter = { ...filter };
    if (nextValues.length === 0) {
      delete nextFilter[editingAttr];
    } else {
      nextFilter[editingAttr] = nextValues;
    }
    onFilterChange(nextFilter);
  };

  if (filterEntries.length === 0) {
    return null;
  }

  return (
    <div style={styles.container}>
      {showChipTutorial && chipTutorialVisible && (
        <div
          onClick={markChipTutorialSeen}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 300,
            background: "rgba(12, 4, 20, 0.78)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(14px, 4vw, 32px)",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "#241136",
              border: "1px solid rgba(255, 156, 211, 0.5)",
              borderRadius: 14,
              boxShadow: "0 14px 34px rgba(0, 0, 0, 0.55)",
              padding: "clamp(1.2rem, 3vw, 2rem)",
              maxWidth: "min(480px, 92vw)",
              textAlign: "center",
              color: "var(--text-main)",
            }}
          >
            <div style={{ fontSize: "clamp(1.1rem, 2.2vw, 1.45rem)", fontWeight: 800, color: "#ffd3ef", marginBottom: "0.7rem" }}>
              Editing filters:
            </div>
            <div style={{ fontSize: "clamp(0.88rem, 1.5vw, 1rem)", color: "var(--text-muted)", lineHeight: 1.55, marginBottom: "1rem" }}>
              The highlighted words in your summary are clickable. For example:
            </div>
            {/* Interactive example mirrors the real filter-chip editor without changing dashboard filters. */}
            <div style={{
              background: "rgba(41, 15, 62, 0.65)",
              border: "1px solid rgba(255, 184, 232, 0.22)",
              borderRadius: 8,
              padding: "0.7rem 0.9rem",
              marginBottom: "1.1rem",
              fontSize: "clamp(0.88rem, 1.5vw, 1rem)",
              color: "#ffe9fa",
              textAlign: "left",
              lineHeight: 1.6,
            }}>
              {tutorialDemoValues.length > 0 ? (
                <>
                  {"Example: people who use "}
                  <button
                    type="button"
                    aria-expanded={tutorialDemoOpen}
                    onClick={() => {
                      setTutorialDemoPendingValues([...tutorialDemoValues]);
                      setTutorialDemoError("");
                      setTutorialDemoOpen((open) => !open);
                    }}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      color: "#ffd3ef",
                      background: "rgba(255, 126, 196, 0.22)",
                      border: "1px solid rgba(255, 184, 232, 0.55)",
                      borderRadius: 6,
                      padding: "0.12rem 0.42rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    cannabis {joinWithOr(tutorialDemoValues.map((value) => value.toLowerCase()))}
                  </button>
                  <span style={{
                    display: "inline-block",
                    marginLeft: "0.4rem",
                    fontSize: "0.82em",
                    color: "#ff9cd3",
                    fontStyle: "italic",
                  }}>
                    click to edit
                  </span>
                </>
              ) : (
                "Example: all profiles, with no cannabis filter"
              )}
            </div>
            {tutorialDemoOpen && (
              <div
                role="group"
                aria-label="Example cannabis filter"
                onClick={(event) => event.stopPropagation()}
                style={{ textAlign: "left", margin: "-0.65rem 0 1rem", padding: "0.25rem 0.9rem 0.75rem" }}
              >
                {TUTORIAL_CANNABIS_OPTIONS.map((value) => (
                  <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, padding: "0.3rem 0", cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={tutorialDemoPendingValues.includes(value)}
                      onChange={() => toggleTutorialDemoValue(value)}
                    />
                    {value}
                  </label>
                ))}
                {tutorialDemoError && (
                  <div role="alert" style={{ color: "#ffcde2", fontSize: "0.82em", marginTop: 4 }}>
                    {tutorialDemoError}
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                  <button
                    type="button"
                    onClick={() => setTutorialDemoOpen(false)}
                    style={{ cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={applyTutorialDemoSelection}
                    style={{ cursor: "pointer" }}
                  >
                    Done
                  </button>
                </div>
              </div>
            )}
            <button
              onClick={markChipTutorialSeen}
              style={{
                background: "rgba(255, 126, 196, 0.22)",
                color: "#ffe9fa",
                border: "1px solid rgba(255, 184, 232, 0.55)",
                borderRadius: 8,
                padding: "0.55rem 1.4rem",
                cursor: "pointer",
                fontWeight: 700,
                fontSize: "clamp(0.95rem, 1.4vw, 1.05rem)",
              }}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
      <div
        style={{
          marginBottom: "1rem",
          fontSize: "1.1em",
          color: "#ffe9fa",
          textShadow: "0 1px 3px rgba(0, 0, 0, 0.55)",
          lineHeight: 1.35,
          display: "flow-root"
        }}
      >
        {filterEntries.length > 0 && (
          <button
            onClick={() => onFilterChange({})}
            style={{
              float: "right",
              marginLeft: 10,
              marginBottom: 6,
              color: "#ffd0ef",
              background: "rgba(255, 126, 196, 0.14)",
              border: "1px solid rgba(255, 184, 232, 0.45)",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: "0.82em",
              fontWeight: 700,
              padding: "0.2rem 0.45rem",
              verticalAlign: "middle"
            }}
            title="Clear all filters"
          >
            Clear all
          </button>
        )}

        <span style={{ overflowWrap: "anywhere" }}>
          {filterEntries.length === 0 ? (
            sentence
          ) : (
            <>
              {`Showing ${displayFilteredCount} profiles from `}
              {adjectiveParts.map((part, idx) => (
                <span key={`adj-${idx}`}>
                  {idx > 0 ? " " : ""}
                  {renderPhrasePart(part, `adj-part-${idx}`)}
                </span>
              ))}
              {nounPart?.text ? (
                <span>
                  {adjectiveParts.length > 0 ? " " : ""}
                  {renderPhrasePart(nounPart, "noun-part")}
                </span>
              ) : null}
              {verbParts.length > 0 ? (
                <>
                  {" who "}
                  {verbParts.map((part, idx) => (
                    <span key={`verb-${idx}`}>
                      {idx === 0
                        ? ""
                        : verbParts.length === 2
                          ? " and "
                          : idx === verbParts.length - 1
                            ? ", and "
                            : ", "}
                      {renderPhrasePart(part, `verb-part-${idx}`)}
                    </span>
                  ))}
                </>
              ) : null}
            </>
          )}
        </span>
      </div>

      {editingAttr && (
        <div
          onClick={editorIsCentered ? () => { setPendingValues(normalizeValues(filter[editingAttr])); setSelectionError(""); setEditingAttr(null); setEditorIsCentered(false); } : undefined}
          style={editorIsCentered ? {
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background: "rgba(12, 4, 20, 0.78)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(14px, 4vw, 32px)",
          } : { position: "absolute", top: editorPosition.top, left: editorPosition.left, zIndex: 10000, display: "inline-block" }}
        >
        <div style={{ background: "#2a1239", borderRadius: 8, boxShadow: "0 6px 22px #000b", padding: "0.6rem 0.9rem", border: "1px solid rgba(255,184,232,0.35)", ...(editorIsCentered ? { width: "min(320px, 88vw)" } : {}) }} onClick={(e) => e.stopPropagation()}>
          <div style={{ color: "#dcb6ea", fontSize: "0.86em", marginBottom: 8 }}>
            Edit {prettifyAttributeName(editingAttr)}
          </div>
          <div style={{ minWidth: 220, maxHeight: 280, overflowY: "auto", padding: "0.25rem 0" }}>
            {getOptionsForAttr(editingAttr).map((val) => {
              const checked = pendingValues.includes(val);
              return (
                <label
                  key={val}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.58rem",
                    padding: "0.34rem 0.15rem",
                    color: checked ? "#ffb8e7" : "#ffe9fa",
                    fontSize: "0.99em",
                    cursor: "pointer"
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => togglePendingValue(val)}
                    style={{ width: 18, height: 18, cursor: "pointer" }}
                  />
                  <span>{val}</span>
                </label>
              );
            })}
          </div>
          {selectionError && (
            <div style={{ color: "#ffcde2", fontSize: "0.78em", marginTop: 6, maxWidth: 240, lineHeight: 1.3 }}>
              {selectionError}
            </div>
          )}
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, gap: 8 }}>
            <button
              style={{
                fontSize: "0.9em",
                background: "transparent",
                color: "#ffcde2",
                border: "1px solid rgba(255, 111, 158, 0.65)",
                borderRadius: 4,
                padding: "0.38em 0.7em",
                minWidth: 86,
                cursor: "pointer"
              }}
              onClick={() => {
                if (!editingAttr) return;
                const nextFilter = { ...filter };
                delete nextFilter[editingAttr];
                setPendingValues([]);
                setSelectionError("");
                setEditingAttr(null);
                setEditorIsCentered(false);
                onFilterChange(nextFilter);
              }}
            >
              Remove
            </button>
            <button
              style={{
                fontSize: "0.9em",
                background: "transparent",
                color: "#e7c7f2",
                border: "1px solid rgba(231, 199, 242, 0.4)",
                borderRadius: 4,
                padding: "0.38em 0.7em",
                minWidth: 86,
                cursor: "pointer"
              }}
              onClick={() => {
                setPendingValues(normalizeValues(filter[editingAttr]));
                setSelectionError("");
                setEditingAttr(null);
                setEditorIsCentered(false);
              }}
            >
              Cancel
            </button>
            <button
              style={{
                fontSize: "0.9em",
                background: "rgba(255, 126, 196, 0.18)",
                color: "#ffd9ef",
                border: "1px solid rgba(255, 126, 196, 0.55)",
                borderRadius: 4,
                padding: "0.38em 0.7em",
                minWidth: 86,
                cursor: "pointer"
              }}
              onClick={applyAttrSelection}
            >
              Done
            </button>
          </div>
        </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    marginBottom: "1.5rem",
    padding: "1rem",
    backgroundColor: "#241136",
    borderRadius: "0.5rem",
    borderLeft: "4px solid rgba(255, 126, 196, 0.48)",
    border: "1px solid rgba(255, 176, 228, 0.2)",
  },
};
