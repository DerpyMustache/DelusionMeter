// All value maps for profile attributes

const VALUE_MAPS = {
  education_level: {
    1: "Undergraduate degree",
    2: "College",
    3: "High school",
    4: "Graduate degree",
    5: "Trade/tech school",
    6: "In grad school"
  },
  gender: {
    1: "Man",
    2: "Woman",
    3: "Non-binary/Gender Nonconforming"
  },
  height: Object.fromEntries(
    Array.from({ length: 49 }, (_, i) => {
      const n = i + 1;
      const feet = Math.floor((n - 1) / 12) + 3;
      const inch = (n - 1) % 12;
      return [n, `${feet}' ${inch}''`];
    })
  ),
  religion: {
    1: "Agnostic",
    2: "Atheist",
    3: "Buddhist",
    4: "Catholic",
    5: "Christian",
    6: "Hindu",
    7: "Jain",
    8: "Jewish",
    9: "Latter-day Saint",
    10: "Mormon",
    11: "Muslim",
    12: "Other",
    13: "Sikh",
    14: "Spiritual",
    15: "Zoroastrian"
  },
  kids: {
    1: "Don't want",
    2: "Not sure yet",
    3: "Open to kids",
    4: "Has kids",
    5: "Want someday"
  },
  exercise: {
    1: "Almost never",
    2: "Sometimes",
    3: "Often",
    4: "Every day",
    5: "Active"
  },
  location: {
    1: "Alabama", 2: "Alaska", 3: "Arizona", 4: "Arkansas", 5: "California", 6: "Colorado", 7: "Connecticut", 8: "Delaware", 9: "Florida", 10: "Georgia",
    11: "Hawaii", 12: "Idaho", 13: "Illinois", 14: "Indiana", 15: "Iowa", 16: "Kansas", 17: "Kentucky", 18: "Louisiana", 19: "Maine", 20: "Maryland",
    21: "Massachusetts", 22: "Michigan", 23: "Minnesota", 24: "Mississippi", 25: "Missouri", 26: "Montana", 27: "Nebraska", 28: "Nevada", 29: "New Hampshire",
    30: "New Jersey", 31: "New Mexico", 32: "New York", 33: "North Carolina", 34: "North Dakota", 35: "Ohio", 36: "Oklahoma", 37: "Oregon", 38: "Pennsylvania",
    39: "Rhode Island", 40: "South Carolina", 41: "South Dakota", 42: "Tennessee", 43: "Texas", 44: "Utah", 45: "Vermont", 46: "Virginia", 47: "Washington",
    48: "West Virginia", 49: "Wisconsin", 50: "Wyoming"
  },
  star_sign: {
    1: "Aries", 2: "Taurus", 3: "Gemini", 4: "Cancer", 5: "Leo", 6: "Virgo", 7: "Libra", 8: "Scorpio", 9: "Sagittarius", 10: "Capricorn", 11: "Aquarius", 12: "Pisces"
  },
  drinking: {
    1: "Socially",
    2: "Frequently",
    3: "Rarely",
    4: "Never",
    5: "Sober"
  },
  politics: {
    1: "Liberal",
    2: "Conservative",
    3: "Moderate",
    4: "Apolitical"
  },
  smoking: {
    1: "Never",
    2: "Socially",
    3: "Regularly"
  },
  cannabis: {
    1: "Never",
    2: "Socially",
    3: "Frequently",
    4: "Rarely"
  },
  looking_for: {
    1: "Relationship",
    2: "Something casual",
    3: "Don't know yet",
    4: "Marriage"
  }
};

export default VALUE_MAPS;
