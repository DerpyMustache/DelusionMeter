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
    q: "Why are some of the word clouds so small?",
    a: "This was pretty confusing to me as well at first, but after checking the raw data, these prompts somehow only have a few responses out of the 500000+ profiles. Talk about unpopular. I did remove the ones with too little responses to actually see anything interesting."
  },
  {
    q: "Why is the number of profiles different for each attribute?",
    a: "Bumble doesn't require you to fill out every attribute of your profile, so the number varies based on how many profiles actually included that info."
  },
  {
    q: "Where is the sexuality option?",
    a: "For whatever reason Bumble doesn't have an actual sexuality option. You simply choose between men, women, and nonbinary people as to who you're looking to date. These selections were not available in the data, so if you're a woman filtering by men, it includes gay men as well. So rest easy knowing whatever your delusion percentage is, it's actually higher."
  },
  {
    q: "How accurate is this data?",
    a: "I probably wouldn't apply it to the general population, but in terms of Bumble users, it should be quite accurate to the profiles you will find on there. Obviously people can lie in their profiles, but I have no way to discern that. The data is also less accurate for locations that have a smaller sample size. I had to constantly change my location with the passport feature to try and collect data from as many places as possible, so I did my best."
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
