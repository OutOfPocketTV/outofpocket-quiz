// Published 2026-10-28. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "how-many-women-make-six-figures",
  date: "2026-10-28",
  build({ run, pct, count, cell, table, AGES, ageLabel, cta }) {
    const women = { targetSex: "women" };

    const ageRows = AGES.map((ab) => {
      const [ageLo, ageHi] = ab;
      const all = run({ ...women, ageLo, ageHi, minIncome: 100000 });
      const single = run({ ...women, ageLo, ageHi, minIncome: 100000, excludeMarried: true });
      const men = run({ ageLo, ageHi, minIncome: 100000, excludeMarried: true });
      return [ageLabel(ab), cell(all), `${cell(single)}<br>${count(single.matchingCount)}`, (men.matchingCount / single.matchingCount).toFixed(1)];
    });

    const levelRows = [75000, 100000, 150000, 200000, 250000, 500000].map((minIncome) => {
      const all = run({ ...women, minIncome });
      const single = run({ ...women, minIncome, excludeMarried: true });
      const men = run({ minIncome, excludeMarried: true });
      return [`$${minIncome.toLocaleString("en-US")}+`, cell(all), count(single.matchingCount), count(men.matchingCount)];
    });

    // Married share earning $100k, worked out as everyone minus the unmarried.
    const marriageGap = (targetSex, ageLo, ageHi) => {
      const people = run({ targetSex, ageLo, ageHi }).matchingCount;
      const unmarried = run({ targetSex, ageLo, ageHi, excludeMarried: true }).matchingCount;
      const earners = run({ targetSex, ageLo, ageHi, minIncome: 100000 }).matchingCount;
      const unmarriedEarners = run({ targetSex, ageLo, ageHi, minIncome: 100000, excludeMarried: true }).matchingCount;
      return [pct((unmarriedEarners / unmarried) * 100), pct(((earners - unmarriedEarners) / (people - unmarried)) * 100)];
    };
    const gapRows = [[25, 34], [35, 44]].flatMap(([a, b]) => [
      [`Women ${a}&ndash;${b}`, ...marriageGap("women", a, b)],
      [`Men ${a}&ndash;${b}`, ...marriageGap("men", a, b)],
    ]);

    return {
      title: "How Many Women Make Six Figures? Women Earning $100k, by Age | Out Of Pocket TV",
      description: "About 1 in 8 American women earns $100,000 or more, and about 5.6 million of them aren't married. Six-figure women by age, and how they compare with men.",
      h1: "How many women make six figures?",
      summary: "About 1 in 8 American women earns $100,000 or more. How that changes with age and marriage, and how it compares with men.",
      body: `      <p class="content-lede">About <strong>1 in 8</strong> American women earns $100,000 or more a year: 12.5% of women aged 18 to 80, or roughly 16 million people. About <strong>5.6 million</strong> of them aren&rsquo;t married.</p>

      <p>&ldquo;Six figures&rdquo; usually comes up as a standard for men. Turn it around and the share is about half of men&rsquo;s (23.6% of men earn $100,000 or more), and it moves a lot with age.</p>

      <h2>By age</h2>
      <p>Share of U.S. women in each age group earning $100,000 or more, the share who earn it and aren&rsquo;t married, and how many unmarried six-figure men there are for each unmarried six-figure woman:</p>
      ${table(["Age", "Women earning $100k+", "Not married and $100k+", "Unmarried $100k+ men per woman"], ageRows)}

      <h2>By income level</h2>
      <p>Share of women aged 18 to 80 at or above each income, and the number of unmarried women and unmarried men who reach it:</p>
      ${table(["Income", "All women", "Unmarried women", "Unmarried men"], levelRows)}

      <h2>Married or not, who earns more?</h2>
      <p>Share earning $100,000 or more among people who aren&rsquo;t married and people who are:</p>
      ${table(["Group", "Not married", "Married"], gapRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Six-figure incomes for women peak between 45 and 54.</strong> Only 1.4% of women under 25 earn six figures. By 45 to 54 it&rsquo;s 19%, about 1 in 5.</li>
        <li><strong>Most six-figure women in their thirties are married.</strong> At 30 to 34, only about 39% of the women earning $100,000 aren&rsquo;t married. At 35 to 39 it&rsquo;s about a quarter.</li>
        <li><strong>Unmarried six-figure men outnumber unmarried six-figure women until 65.</strong> Under 40 there are about 1.6 to 1.7 such men for every such woman. From 45 to 54 it&rsquo;s nearly even, and over 65 the women are ahead.</li>
        <li><strong>Marriage and income go together far more for men.</strong> Among men aged 25 to 34, married men are more than twice as likely to earn six figures as unmarried men (30% against 14%). For women the gap is much smaller (13% against 9.9%). This is what the survey counts, not why: it doesn&rsquo;t say whether marriage raises men&rsquo;s pay or higher earners marry more.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Age, income and marital status are counted together, from the same people, in the Census Bureau&rsquo;s Current Population Survey (March 2025, about 108,000 adults). Income is total personal income before tax for 2024 (wages plus business, investment and benefit income), not household income, so a woman in a high-earning household can still be counted below $100,000. &ldquo;Not married&rdquo; means never married, divorced, widowed or separated, and isn&rsquo;t the same as single. The $250,000 and $500,000 rows rest on the fewest survey records and are the least precise. For men and women side by side at every income, see <a href="/income-odds.html">income odds</a>.</p>
${cta("Add an income minimum to the rest of your list.")}`,
    };
  },
};
