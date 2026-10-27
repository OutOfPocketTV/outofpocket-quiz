// Published 2026-10-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "are-my-standards-too-high",
  date: "2026-10-27",
  build({ run, W, pct, oneIn, count, note, cell, ht, table, AGES, ageLabel, NOT_OBESE, cta }) {
  const STANDARDS = (sex) => [
    ["Not married", { excludeMarried: true }],
    ["Has never had a child", { excludeKids: true }],
    ["Not obese", { selectedBodyTypes: NOT_OBESE }],
    ["Athletic build", { selectedBodyTypes: ["athletic"] }],
    ["Straight", { selectedOrientations: ["straight"] }],
    ["Christian", { selectedReligions: ["christian"] }],
    ["Not religious", { selectedReligions: ["none"] }],
    ["Doesn&rsquo;t gamble", { excludeGambles: true }],
    ...(sex === "men"
      ? [["5&prime;10&Prime; or taller", { minHeight: 70 }], ["6&prime;0&Prime; or taller", { minHeight: 72 }], ["6&prime;2&Prime; or taller", { minHeight: 74 }]]
      : [["5&prime;5&Prime; or taller", { minHeight: 65 }], ["5&prime;7&Prime; or taller", { minHeight: 67 }], ["5&prime;9&Prime; or taller", { minHeight: 69 }]]),
    ["Earns $50,000+", { minIncome: 50000 }],
    ["Earns $100,000+", { minIncome: 100000 }],
    ["Earns $150,000+", { minIncome: 150000 }],
  ];
  const ranked = (sex) => {
    const rows = STANDARDS(sex).map(([label, f]) => [label, run({ targetSex: sex, ageLo: 25, ageHi: 35, ...f })]);
    rows.sort((a, b) => b[1].pct - a[1].pct);
    return table(["Standard", `Share of ${sex} 25&ndash;35 who meet it`], rows.map(([l, r]) => [l, cell(r)]));
  };

  return {
    title: "Are My Standards Too High? Every Dating Standard Ranked by How Much It Shrinks the Pool | Out Of Pocket TV",
    description: "Which dating standards rule out the most people? Height, income, kids, religion, build and more, ranked for men and women aged 25 to 35 using U.S. Census and CDC data.",
    h1: "Are my standards too high? Every standard, ranked",
    summary: "Height, income, kids, religion, build and more, ranked by how many people each one rules out on its own.",
    body: `      <p class="content-lede">Most dating standards are mild on their own. &ldquo;Not married&rdquo; or &ldquo;no kids&rdquo; each keeps around half of people in their late twenties and early thirties. The ones that do real damage are a height minimum near the top of the range and an income minimum, and those are exactly the ones people argue about.</p>

      <p>You may have seen a &ldquo;delusion calculator&rdquo; going around, or our street interviews asking people whether their standards are realistic. The honest answer is that it depends almost entirely on which standards are on the list. So here is each one on its own, ranked from the gentlest to the harshest.</p>

      <h2>Standards for men, ranked</h2>
      <p>Share of U.S. men aged 25 to 35 who meet each standard on its own:</p>
      ${ranked("men")}

      <h2>Standards for women, ranked</h2>
      <p>Share of U.S. women aged 25 to 35 who meet each standard on its own:</p>
      ${ranked("women")}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Height is the harshest standard there is, for both sexes.</strong> Asking for 6&prime;2&Prime; rules out about 94% of men. For women, 5&prime;9&Prime; is rarer still: about 1 in 28.</li>
        <li><strong>Each inch costs more than the last.</strong> 5&prime;10&Prime; keeps 41% of men, 6&prime;0&Prime; keeps 18% and 6&prime;2&Prime; keeps 5.7%. Going from 6&prime;0&Prime; to 6&prime;2&Prime; cuts the pool by more than two-thirds.</li>
        <li><strong>Income works the same way.</strong> $50,000 keeps more than half of men, $100,000 keeps 1 in 5 and $150,000 keeps about 1 in 11.</li>
        <li><strong>&ldquo;Doesn&rsquo;t gamble&rdquo; is stricter than people expect.</strong> Only about a third of men and 42% of women didn&rsquo;t place a single bet in the past year, lottery tickets and sports apps included.</li>
        <li><strong>&ldquo;Athletic&rdquo; is a big ask.</strong> Not obese keeps about two-thirds of people. Athletic keeps 22% of men and 16% of women.</li>
      </ul>

      <h2>So are your standards too high?</h2>
      <p>No single standard here is unreasonable, and none of them is a moral failing. The question is how many you stack. A list of mild standards can still end below 1%, because they multiply. If your result is tiny, the fastest way to grow it is almost never to drop the standards you care most about. It&rsquo;s to loosen the one at the top of this table that you care about least. <a href="/blog/odds-of-finding-your-perfect-match.html">What are the odds of finding your perfect match?</a> shows two full lists added up step by step.</p>

      <h2>How these numbers are worked out</h2>
      <p>Each figure is for U.S. adults aged 25 to 35 and comes from the Census Bureau (marital status, income, children), the CDC (measured height and build, sexual orientation), Pew Research (religion) and a Harris Poll for NerdWallet (gambling). &ldquo;Athletic&rdquo; is the least certain figure, because no national survey measures it directly. <a href="/how-it-works.html">How the odds are calculated</a> explains each one.</p>
${cta("Find out which of your own standards costs you the most.")}`,
  };
  },
};
