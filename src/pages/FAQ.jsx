const faqs = [
  {
    q: "How did you get this data?",
    a: "I wrote a script to manually swipe left on bumble profiles one by one and scrape the the data from the api responses. Was it the most efficient way? Maybe not, but it worked."
  },
  {
    q: "How did you choose the filters for each attribute?",
    a: "All of the options are just the choices Bumble gives you when setting up your profile."
  },
  {
    q: "How are word clouds generated?",
    a: "Word clouds are based on the most common words in prompt answers."
  },
  {
    q: "Why are some of the word clouds so small?",
    a: "This was pretty confusing to me as well at first, but after checking the raw data, these prompts somehow only have a few (usually less than 10) responses out of the 500000+ profiles. Talk about unpopular."
  },
  {
    q: "Why is the number of profiles different for each attribute?",
    a: "Bumble doesn't require you to fill out every attribute of your profile, so the number varies based on how many profiles actually included that info."
  },
  {
    q: "Where is the sexuality option?",
    a: "For whatever reason Bumble doesn't have an actual sexuality option. You simply choose between men, women, and nonbinary people as to who you're looking to date. These selections were not available in the data, so if you're a woman filtering by men, it includes gay men as well. So rest easy knowing whatever your delusion percentage is, it's actually higher."
  }
];

export default function FAQ() {
  return (
    <div className="container faqPage">
      <h1 className="faqTitle">FAQ</h1>
      <div className="faqGrid">
        {faqs.map(({ q, a }, i) => (
          <div key={i} className="faqCard">
            <div className="faqQuestion">{q}</div>
            <div className="faqAnswer">{a}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
