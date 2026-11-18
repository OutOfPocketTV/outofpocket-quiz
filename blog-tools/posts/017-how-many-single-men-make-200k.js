// Published 2026-11-18. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "how-many-single-men-make-200k",
  date: "2026-11-18",
  build({ run, pct, count, cell, table, AGES, ageLabel, cta }) {
    const unmarried = { excludeMarried: true };
    const pool = (ageLo = 18, ageHi = 80) => run({ ...unmarried, ageLo, ageHi }).matchingCount;
    // Share of unmarried men (not of all men) at or above an income.
    const ofUnmarried = (f) => {
      const r = run({ ...unmarried, ...f });
      return { pct: (r.matchingCount / pool(f.ageLo, f.ageHi)) * 100, matchingCount: r.matchingCount };
    };

    // $500k+ by age rests on too few survey records to show, so the age
    // table stops at $250k.
    const ageRows = AGES.map((ab) => {
      const [ageLo, ageHi] = ab;
      const two = ofUnmarried({ ageLo, ageHi, minIncome: 200000 });
      const allTwo = run({ ageLo, ageHi, minIncome: 200000 }).matchingCount;
      return [
        ageLabel(ab),
        cell(ofUnmarried({ ageLo, ageHi, minIncome: 150000 })),
        `${cell(two)}<br>${count(two.matchingCount)}`,
        cell(ofUnmarried({ ageLo, ageHi, minIncome: 250000 })),
        pct((two.matchingCount / allTwo) * 100),
      ];
    });

    const levelRows = [150000, 200000, 250000, 500000].map((minIncome) => {
      const men = ofUnmarried({ minIncome });
      const all = run({ minIncome });
      const women = run({ targetSex: "women", ...unmarried, minIncome });
      return [`$${minIncome.toLocaleString("en-US")}+`, `${cell(men)}<br>${count(men.matchingCount)}`, pct((men.matchingCount / all.matchingCount) * 100), count(women.matchingCount)];
    });

    let list = { ...unmarried, ageLo: 25, ageHi: 40 };
    const stepRows = [
      ["Unmarried, aged 25&ndash;40, earns $200,000+", { minIncome: 200000 }],
      ["&hellip; and has never had a child", { excludeKids: true }],
      ["&hellip; and 6&prime;0&Prime; or taller", { minHeight: 72 }],
    ].map(([label, f]) => {
      list = { ...list, ...f };
      const r = run(list);
      return [label, cell(r), count(r.matchingCount)];
    });

    return {
      title: "How Many Single Men Make $200k a Year? Unmarried High Earners, by Age | Out Of Pocket TV",
      description: "About 1.6 million unmarried American men earn $200,000 or more: about 1 in 38 unmarried men. Only about 1 in 5 men at that income isn't married.",
      h1: "How many single men make $200k a year?",
      summary: "About 1.6 million unmarried American men earn $200,000 or more, and only about 1 in 5 men at that income isn’t married.",
      body: `      <p class="content-lede">About <strong>1.6 million</strong> unmarried American men earn $200,000 or more a year. That&rsquo;s about <strong>1 in 38</strong> unmarried men. And most men at that income are married: only about 1 in 5 isn&rsquo;t.</p>

      <p>We&rsquo;ve covered <a href="/blog/how-many-single-men-make-100k.html">single men earning $100k</a>. This is the high end: $150,000, $200,000, $250,000 and up, counted from Census records that report income and marital status for the same people.</p>

      <h2>By income level</h2>
      <p>Unmarried U.S. men aged 18 to 80 at or above each income, what share of all men at that income are unmarried, and the number of unmarried women who reach it:</p>
      ${table(["Income", "Unmarried men", "Share of earners who are unmarried", "Unmarried women"], levelRows)}

      <h2>By age</h2>
      <p>Share of unmarried U.S. men in each age group earning $150,000, $200,000 and $250,000 or more, and the share of all $200,000 earners that age who are unmarried:</p>
      ${table(["Age", "$150k+", "$200k+", "$250k+", "$200k earners who are unmarried"], ageRows)}

      <h2>Add a few more standards</h2>
      <p>Starting from unmarried men aged 25 to 40 earning $200,000 or more. Shares here are of all men in that age range, married or not, as the calculator shows them:</p>
      ${table(["Standard", "Share of all men 25&ndash;40", "Men in the U.S."], stepRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Most $200,000 men are married.</strong> About 19% of men earning $200,000 or more aren&rsquo;t. At 25 to 29 it&rsquo;s about 63%, but by 35 to 39 it&rsquo;s down to about 17%, and it stays between about 14% and 17% after that.</li>
        <li><strong>Among unmarried men, high incomes come later.</strong> Only about 0.3% of unmarried men under 25 earn $200,000. It&rsquo;s around 3% in the thirties and peaks at about 5% between 55 and 64.</li>
        <li><strong>The pool shrinks fast as the bar rises.</strong> About 3.2 million unmarried men earn $150,000, 1.6 million earn $200,000, 780,000 earn $250,000 and about 200,000 earn $500,000. Up to $250,000, each step roughly halves it.</li>
        <li><strong>Add no kids and 6 feet, and it&rsquo;s about 72,000 men.</strong> Unmarried, aged 25 to 40, earning $200,000 and 6 feet or taller with no children: about 1 man in 510 in that age range.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Age, income and marital status are counted together, from the same people, in the Census Bureau&rsquo;s Current Population Survey (March 2025, about 108,000 adults), weighted to represent the U.S. Income is total personal income before tax for 2024, not household income. The higher the income, the fewer survey records each figure rests on: the $250,000 and $500,000 rows are the least precise, and $500,000 is too thin to split by age. &ldquo;Not married&rdquo; means never married, divorced, widowed or separated, and isn&rsquo;t the same as single. Children and height in the last table come from other surveys and are applied on top for each age; taller men earn slightly more on average, so the last row is probably a little low.</p>
${cta("Set your own income minimum and see what it does to the rest of your list.")}`,
    };
  },
};
