import React from "react";

const faqs = [
  {
    q: "How did you get this data?",
    a: "I wrote a script to manually swipe left on bumble profiles one by one and scrape the the data from the api responses. Was it the most efficient way? Maybe not, but it worked."
  },
  {
    q: "How do I use the filters?",
    a: "Select attributes in the charts to filter the profiles and see breakdowns."
  },
  {
    q: "How are word clouds generated?",
    a: "Word clouds are based on the most common words in prompt answers."
  },
  {
    q: "Why are some of the word clouds so small?",
    a: "This was pretty confusing to me as well at first, but after checking the raw data, these prompts somehow only have a few (usually less than 10) responses out of the 500000+ profiles. Talk about unpopular."
  }
];

export default function FAQ() {
  return (
    <div className="container">
      <h1 style={{ fontSize: "2.2em", marginBottom: 32 }}>FAQ</h1>
      <div style={{ display: "flex", flexDirection: "row", gap: 32, justifyContent: "center", alignItems: "flex-start", flexWrap: "nowrap" }}>
        {faqs.map(({ q, a }, i) => (
          <div key={i} style={{ background: "#181a1b", borderRadius: 12, boxShadow: "0 2px 12px #0006", padding: "32px 36px", minWidth: 320, maxWidth: 420, flex: "1 1 320px", display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
            <div style={{ fontWeight: 700, fontSize: "1.35em", marginBottom: 12 }}>{q}</div>
            <div style={{ fontSize: "1.15em", color: "#d1d5db" }}>{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
