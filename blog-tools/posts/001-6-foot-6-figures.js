// Published 2026-10-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "6-foot-6-figures",
  date: "2026-10-27",
  build({ run, W, pct, oneIn, count, note, cell, ht, table, AGES, ageLabel, NOT_OBESE, cta }) {
  const rows = AGES.map((ab) => {
    const [ageLo, ageHi] = ab;
    const h = run({ ageLo, ageHi, minHeight: 72 });
    const i = run({ ageLo, ageHi, minIncome: 100000 });
    const both = run({ ageLo, ageHi, minHeight: 72, minIncome: 100000 });
    const single = run({ ageLo, ageHi, minHeight: 72, minIncome: 100000, excludeMarried: true });
    return [ageLabel(ab), pct(h.pct), pct(i.pct), cell(both), `${cell(single)}<br>${count(single.matchingCount)} men`];
  });
  const variants = [
    ["5&prime;10&Prime;+, $75,000+", { minHeight: 70, minIncome: 75000 }],
    ["6&prime;0&Prime;+, $100,000+", { minHeight: 72, minIncome: 100000 }],
    ["6&prime;0&Prime;+, $150,000+", { minHeight: 72, minIncome: 150000 }],
    ["6&prime;2&Prime;+, $100,000+", { minHeight: 74, minIncome: 100000 }],
    ["6&prime;2&Prime;+, $200,000+", { minHeight: 74, minIncome: 200000 }],
    ["6&prime;5&Prime;+, $250,000+", { minHeight: 77, minIncome: 250000 }],
  ].map(([label, f]) => {
    const r = run({ ageLo: 25, ageHi: 35, excludeMarried: true, ...f });
    return [label, cell(r), count(r.matchingCount)];
  });

  return {
    title: "How Many Men Are 6 Feet Tall and Make $100k? The Real 6 Foot, 6 Figures Odds | Out Of Pocket TV",
    description: "About 1 in 27 American men is 6 feet or taller and earns $100,000+. Add single and it is 1 in 108. The 6 foot, 6 figures odds by age, from Census and CDC data.",
    h1: "How many men are 6 feet tall and make six figures?",
    summary: "About 1 in 27 American men is both. Add “not married” and it’s about 1 in 108. The full breakdown by age.",
    body: `      <p class="content-lede">About <strong>1 in 27</strong> American men is 6 feet or taller <em>and</em> earns $100,000 or more a year: 3.7% of men aged 18 to 80, or roughly 4.6 million people. Require that he isn&rsquo;t married and it falls to <strong>0.93%</strong>, about 1 man in 108.</p>

      <p>&ldquo;6 foot, 6 figures&rdquo; is the most famous dating standard on the internet, and it comes up in almost every street interview we film. So we ran it through the calculator, using the Census Bureau&rsquo;s 2025 income records and the CDC&rsquo;s measured heights.</p>

      <h2>The two halves on their own</h2>
      <ul>
        <li><strong>6 feet or taller:</strong> 15.6% of men aged 18 to 80, about 1 in 6. The CDC measured them without shoes, so this isn&rsquo;t the dating-app version of 6 feet.</li>
        <li><strong>$100,000 or more:</strong> 23.6% of men, about 1 in 4. That&rsquo;s total personal income before tax, not household income.</li>
      </ul>
      <p>Put them together and only about 1 man in 27 has both.</p>

      <h2>By age</h2>
      <p>Share of U.S. men in each age group who meet each standard:</p>
      ${table(["Age", "6&prime;0&Prime;+", "$100k+", "Both", "Both, not married"], rows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Under 25, it&rsquo;s almost nobody.</strong> Only about 2% of men aged 18 to 24 earn $100,000, so 6 foot, 6 figures at that age is fewer than 1 in 250.</li>
        <li><strong>The pool of men with both peaks around 40.</strong> Men in their early forties are the most likely to clear both bars (6.7%), because incomes keep rising into the forties.</li>
        <li><strong>But the single ones peak in their late twenties.</strong> Once you add &ldquo;not married&rdquo;, 25 to 29 is the best age group (1.7%), and it drops with every decade after. Most men who are tall and earning six figures by 40 are already married.</li>
        <li><strong>Multiplying the percentages gets it wrong.</strong> For men aged 25 to 35, 6 feet is 18.2%, $100k is 20.1% and not married is 63.9%. Multiply them and you&rsquo;d expect 2.3%. The real figure is 1.60%, because married men earn more: counted from the same people, only 8.8% of men that age are both unmarried and earning $100,000.</li>
      </ul>

      <h2>Move either bar and the pool changes fast</h2>
      <p>Unmarried men aged 25 to 35 who meet each version of the standard:</p>
      ${table(["Standard", "Share of men 25&ndash;35", "Men in the U.S."], variants)}
      <p>Dropping to 5&prime;10&Prime; and $75,000 roughly quadruples the pool. Going the other way, 6&prime;5&Prime; with a quarter of a million a year is close to a rounding error.</p>

      <h2>How these numbers are worked out</h2>
      <p>Age, income and marital status are counted together from the Census Bureau&rsquo;s Current Population Survey (March 2025, about 108,000 adults). Height comes from the CDC&rsquo;s National Health and Nutrition Examination Survey (2021&ndash;2023) for each age group and is applied on top. Taller men do earn slightly more on average, so the true figure for height plus income is probably a little higher than shown. &ldquo;Not married&rdquo; includes never married, divorced, widowed and separated, and isn&rsquo;t the same as single. <a href="/how-it-works.html">How the odds are calculated</a> has every source.</p>
      <p>For more on each half, see <a href="/height-odds.html">height odds</a> and <a href="/income-odds.html">income odds</a>.</p>
${cta("Add your own standards on top of 6 foot, 6 figures.")}`,
  };
  },
};
