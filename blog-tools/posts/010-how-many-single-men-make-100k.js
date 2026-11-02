// Published 2026-11-02. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "how-many-single-men-make-100k",
  date: "2026-11-02",
  build({ run, pct, count, cell, table, AGES, ageLabel, NOT_OBESE, cta }) {
    const unmarried = { excludeMarried: true };
    // Share of unmarried men (not of all men) who clear a bar.
    const ofUnmarried = (f) => {
      const pool = run({ ...unmarried, ageLo: f.ageLo || 18, ageHi: f.ageHi || 80 }).matchingCount;
      const r = run({ ...unmarried, ...f });
      return { pct: (r.matchingCount / pool) * 100, matchingCount: r.matchingCount };
    };

    const ageRows = AGES.map((ab) => {
      const [ageLo, ageHi] = ab;
      const share = ofUnmarried({ ageLo, ageHi, minIncome: 100000 });
      const earners = run({ ageLo, ageHi, minIncome: 100000 }).matchingCount;
      return [ageLabel(ab), cell(share), count(share.matchingCount), pct((share.matchingCount / earners) * 100)];
    });

    const levelRows = [50000, 75000, 100000, 150000, 200000, 250000, 500000].map((minIncome) => {
      const share = ofUnmarried({ minIncome });
      return [`$${minIncome.toLocaleString("en-US")}+`, cell(share), count(share.matchingCount)];
    });

    let list = { ...unmarried, ageLo: 25, ageHi: 40 };
    const stepRows = [
      ["Unmarried, aged 25&ndash;40, earns $100,000+", { minIncome: 100000 }],
      ["&hellip; and has never had a child", { excludeKids: true }],
      ["&hellip; and not obese", { selectedBodyTypes: NOT_OBESE }],
      ["&hellip; and straight", { selectedOrientations: ["straight"] }],
    ].map(([label, f]) => {
      list = { ...list, ...f };
      const r = run(list);
      return [label, cell(r), count(r.matchingCount)];
    });

    return {
      title: "How Many Single Men Make $100k? Unmarried Men Earning Six Figures, by Age | Out Of Pocket TV",
      description: "About 7.2 million unmarried American men earn $100,000 or more: about 1 in 8 unmarried men, half the rate for men overall. By age and income level.",
      h1: "How many single men make $100k?",
      summary: "About 7.2 million unmarried American men earn six figures: 1 in 8 unmarried men, half the rate for men overall.",
      body: `      <p class="content-lede">About <strong>7.2 million</strong> unmarried American men earn $100,000 or more a year. That&rsquo;s about <strong>1 in 8</strong> unmarried men, half the rate for men overall: about 1 in 4 of all men earn six figures.</p>

      <p>The tempting shortcut is to multiply two percentages: 23.6% of men earn six figures and 47.9% aren&rsquo;t married, which would put unmarried six-figure men at about 11% of all men. The real count is 5.8%, about half that, because the Census Bureau counts income and marital status from the same people, and the two go together.</p>

      <h2>By age</h2>
      <p>For unmarried U.S. men in each age group: the share who earn $100,000 or more, how many that is, and what share of all six-figure men that age are unmarried:</p>
      ${table(["Age", "Share of unmarried men", "Unmarried men earning $100k+", "Share of six-figure men who are unmarried"], ageRows)}

      <h2>By income level</h2>
      <p>Unmarried U.S. men aged 18 to 80 at or above each income:</p>
      ${table(["Income", "Share of unmarried men", "Men"], levelRows)}

      <h2>Add a few more standards</h2>
      <p>Starting from unmarried six-figure men aged 25 to 40, one standard at a time. Shares here are of all men in that age range, married or not, as the calculator shows them:</p>
      ${table(["Standard", "Share of all men 25&ndash;40", "Men in the U.S."], stepRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Unmarried men are half as likely to earn six figures.</strong> About 12% of unmarried men do, against about 24% of all men. Married men are far more likely to earn six figures, so most six-figure men are married.</li>
        <li><strong>From 30 on, most six-figure men are married.</strong> At 25 to 29, about 62% of men earning $100,000 aren&rsquo;t married. At 30 to 34 it&rsquo;s 37%, and from 40 to 54 only about 18%.</li>
        <li><strong>Among unmarried men, the share earning six figures rises with age.</strong> It&rsquo;s about 2% under 25, around 12% in the late twenties, 15 to 16% through the thirties and 18 to 19% from 45 to 64.</li>
        <li><strong>The late twenties and early thirties hold the most per year of age.</strong> There are about 1 million unmarried six-figure men in each of those five-year groups. The 45&ndash;54 and 55&ndash;64 groups are slightly bigger, but they cover ten years each.</li>
        <li><strong>Each step up in income roughly halves the pool.</strong> 7.2 million at $100,000, 3.2 million at $150,000, 1.6 million at $200,000 and about 780,000 at $250,000.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Age, income and marital status are counted together, from the same people, in the Census Bureau&rsquo;s Current Population Survey (March 2025, about 108,000 adults), weighted to represent the U.S. Income is total personal income before tax for 2024, not household income. &ldquo;Not married&rdquo; means never married, divorced, widowed or separated, so it includes men who are dating or living with a partner, and isn&rsquo;t the same as single. Children, build and orientation in the last table come from other surveys and are applied on top for each age. For the same question about women, see <a href="/blog/how-many-women-make-six-figures.html">how many women make six figures</a>, and for height as well, <a href="/blog/6-foot-6-figures.html">6 foot, 6 figures</a>.</p>
${cta("Add your income minimum to the rest of your list.")}`,
    };
  },
};
