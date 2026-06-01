
import { prettifyAttributeName } from "../lib/transform.js";

function religionToNoun(value) {
  const normalized = String(value).trim().toLowerCase();
  switch (normalized) {
    case "agnostic":
      return "agnostics";
    case "atheist":
      return "atheists";
    case "buddhist":
      return "buddhists";
    case "catholic":
      return "catholics";
    case "christian":
      return "christians";
    case "hindu":
      return "hindus";
    case "jain":
      return "jains";
    case "jewish":
      return "jewish people";
    case "latter-day saint":
      return "latter-day saints";
    case "mormon":
      return "mormons";
    case "muslim":
      return "muslims";
    case "other":
      return "people of other religions";
    case "sikh":
      return "sikhs";
    case "spiritual":
      return "spiritual people";
    case "zoroastrian":
      return "zoroastrians";
    default:
      return `${normalized} people`;
  }
}


export default function FilterPanel({ rows, headers, filter, onFilterChange, filteredRows }) {
  if (!rows || !headers) return null;

  // Use filteredRows length if provided, else fallback
  let filteredCount = filteredRows ? filteredRows.length : rows.length;

  // Build the improved, natural sentence
  const filterEntries = Object.entries(filter).filter(([, v]) => v);
  // Order: height, age, gender, politics, star_sign, then the rest
  const order = ["height", "age", "gender", "politics", "star_sign"];
  const sorted = [
    ...order.map(key => filterEntries.find(([k]) => k === key)).filter(Boolean),
    ...filterEntries.filter(([k]) => !order.includes(k)),
  ];

  let adjectives = [];
  let noun = null;
  let verbPhrases = [];
  let ageSelected = false;
  let ageValueText = "";
  let ageAdjectiveIndex = -1;

  for (const [attr, val] of sorted) {
    if (attr === "politics") {
      adjectives.push(val.toLowerCase());
    } else if (attr === "age") {
      const ageValue = String(val).trim();
      const isAgeRange = /^\d{1,3}-\d{1,3}$/.test(ageValue);
      const isSingleAge = /^\d{1,3}$/.test(ageValue);
      const isAgeBound = /^<\d{1,3}$|^>\d{1,3}$/.test(ageValue);

      if (isSingleAge || isAgeRange || isAgeBound) {
        ageSelected = true;
        ageValueText = ageValue;
        adjectives.push(`${ageValue} year old`);
        ageAdjectiveIndex = adjectives.length - 1;
      } else {
        adjectives.push(ageValue);
      }
    } else if (attr === "gender") {
      const lowerVal = val.toLowerCase();
      if (["man", "woman", "other"].includes(lowerVal)) {
        if (lowerVal === "man") {
          noun = "men";
        } else if (lowerVal === "woman") {
          noun = "women";
        } else if (lowerVal === "other") {
          noun = "other people";
        }
      } else if (val === "Non-binary/Gender Nonconforming") {
        noun = "Non-binary/Gender Nonconforming people";
      } else {
        noun = val;
      }
    } else if (attr === "star_sign") {
      verbPhrases.push(`have the star sign ${val}`);
    } else if (attr === "height") {
      adjectives.push(`${val}`);
    } else if (attr === "drinking") {
      if (val.toLowerCase() === "never") {
        verbPhrases.push("never drink");
      } else {
        verbPhrases.push(`drink ${val.toLowerCase()}`);
      }
    } else if (attr === "cannabis") {
      if (val.toLowerCase() === "never") {
        verbPhrases.push("never use cannabis");
      } else {
        verbPhrases.push(`use cannabis ${val.toLowerCase()}`);
      }
        } else if (attr === "smoking") {
          if (val.toLowerCase() === "never") {
            verbPhrases.push("never smoke");
          } else {
            verbPhrases.push(`smoke ${val.toLowerCase()}`);
          }
    } else if (attr === "exercise") {
      const exerciseText = val.toLowerCase();
      if (exerciseText === "active") {
        verbPhrases.push("exercise often");
      } else if (exerciseText === "sometimes") {
        verbPhrases.push("exercise sometimes");
      } else if (exerciseText === "never") {
        verbPhrases.push("never exercise");
      } else {
        verbPhrases.push(`exercise ${exerciseText}`);
      }
    } else if (attr === "education_level") {
      const normalizedEducation = String(val).trim().toLowerCase();
      if (normalizedEducation === "high school") {
        adjectives.push("high school educated");
      } else if (normalizedEducation === "undergraduate degree" || normalizedEducation === "college") {
        verbPhrases.push("have college degrees");
      } else if (normalizedEducation === "graduate degree") {
        verbPhrases.push("have graduate degrees");
      } else if (normalizedEducation === "trade/tech school") {
        verbPhrases.push("have trade or tech school backgrounds");
      } else if (normalizedEducation === "in grad school") {
        verbPhrases.push("are in grad school");
      } else {
        adjectives.push(`${val}`);
      }
    } else if (attr === "looking_for") {
      let lookingText = val.toLowerCase();
      if (lookingText === "relationship") {
        verbPhrases.push("are looking for a relationship");
      } else if (lookingText === "something casual") {
        verbPhrases.push("are looking for something casual");
      } else if (lookingText === "marriage") {
        verbPhrases.push("are looking for marriage");
      } else if (lookingText === "don’t know yet") {
        verbPhrases.push("don't know what they are looking for yet");
      } else {
        verbPhrases.push(`are looking for ${val}`);
      }
    } else if (attr === "kids") {
      let kidsText = null;
      const normalizedKids = String(val).trim().toLowerCase().replace(/’/g, "'");
      switch (normalizedKids) {
        case "don't want":
          kidsText = "do not want kids";
          break;
        case "have and don't want more":
          kidsText = "have kids and do not want more";
          break;
        case "have and want more":
          kidsText = "have kids and want more";
          break;
        case "have kids":
        case "has kids":
          kidsText = "have kids";
          break;
        case "not sure yet":
          kidsText = "are not sure about having kids";
          break;
        case "open to kids":
          kidsText = "are open to having kids";
          break;
        case "want someday":
          kidsText = "want to have kids someday";
          break;
        default:
          kidsText = `have kids preference: ${val}`;
      }
      verbPhrases.push(kidsText);
    } else if (attr === "religion") {
      const religionNoun = religionToNoun(val);
      if (!noun) {
        noun = religionNoun;
      } else {
        adjectives.push(String(val).trim().toLowerCase());
      }
    } else if (attr === "occupation") {
      if (val.trim().toLowerCase() === "unemployed") {
        verbPhrases.push("are unemployed");
      } else {
        verbPhrases.push(`work in ${val}`);
      }
    } else if (attr === "location") {
      // Locations are now just state names
        verbPhrases.push(`are in ${val}`);
    } else {
      verbPhrases.push(`${prettifyAttributeName(attr).toLowerCase()}: ${val}`);
    }
  }

  let sentence = "";
  if (filterEntries.length === 0) {
    sentence = `Showing all ${filteredCount} profiles`;
  } else {
    sentence = `Showing ${filteredCount} profiles from`;
    if (!noun) {
      if (ageSelected && ageAdjectiveIndex !== -1) {
        adjectives[ageAdjectiveIndex] = ageValueText;
        noun = "year olds";
      } else {
        noun = "people";
      }
    }

    if (adjectives.length > 0) {
      sentence += " " + adjectives.join(" ");
    }
    sentence += " " + noun;
    if (verbPhrases.length > 0) {
      sentence += " who " + verbPhrases.join(" and ");
    }
  }

  return (
    <div style={styles.container}>
      <div style={{ marginBottom: "1rem", fontSize: "1.1em", color: "#e5e7eb" }}>
        {sentence}
        {filterEntries.length > 0 && (
          <>
            {filterEntries.map(([attr]) => (
              <button
                key={attr}
                onClick={() => {
                  const newFilter = { ...filter };
                  delete newFilter[attr];
                  onFilterChange(newFilter);
                }}
                style={{ marginLeft: 6, color: "#f87171", background: "none", border: "none", cursor: "pointer", fontSize: "1em" }}
                title={`Remove ${prettifyAttributeName(attr)}`}
              >
                ×
              </button>
            ))}
          </>
        )}
      </div>
    </div>
  );
}

const styles = {
  container: {
    marginBottom: "1.5rem",
    padding: "1rem",
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderRadius: "0.5rem",
    borderLeft: "4px solid rgba(255, 255, 255, 0.2)",
  },
  controls: {
    display: "flex",
    gap: "1rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  label: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  labelText: {
    fontWeight: "500",
    color: "#e5e7eb",
  },
  select: {
    padding: "0.5rem 0.75rem",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    color: "#e5e7eb",
    border: "1px solid rgba(255, 255, 255, 0.2)",
    borderRadius: "0.375rem",
    fontSize: "0.875rem",
    cursor: "pointer",
    minWidth: "150px",
  },
};
