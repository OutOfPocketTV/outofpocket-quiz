// Published 2026-11-09. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "percentage-of-canadian-men-6-feet-tall",
  date: "2026-11-09",
  build({ run, W, count, cell, ht, table, cta }) {
    const G = W.QuizGlobalStats;
    const CA = "CA";
    const cm = (inches) => `${Math.round(inches * 2.54)} cm`;
    const usYoung = { ageLo: 18, ageHi: 44 };

    const menRows = [68, 69, 70, 71, 72, 73, 74, 75, 76, 77].map((minHeight) => {
      const ca = run({ minHeight }, CA);
      const us = run({ ...usYoung, minHeight });
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, `${cell(ca)}<br>${count(ca.matchingCount)}`, cell(us)];
    });

    const womenRows = [64, 65, 66, 67, 68, 69, 70, 72].map((minHeight) => {
      const ca = run({ targetSex: "women", minHeight }, CA);
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, cell(ca), count(ca.matchingCount)];
    });

    const compare = ["Netherlands", "Australia", "Ireland", "United Kingdom", "Canada"]
      .map((name) => Object.keys(G.COUNTRIES).find((c) => G.getCountryMeta(c).name === name))
      .map((code) => [G.getCountryMeta(code).name, cell(run({ minHeight: 72 }, code))]);
    compare.push(["United States, men under 45", cell(run({ ...usYoung, minHeight: 72 }))]);
    compare.push(["United States, all men", cell(run({ minHeight: 72 }))]);
    compare.push(["Mexico", cell(run({ minHeight: 72 }, "MX"))]);

    return {
      title: "What Percentage of Men in Canada Are 6 Feet Tall? Canada Height Odds | Out Of Pocket TV",
      description: "About 1 in 5 Canadian men is 6 feet (183 cm) or taller, roughly 2.6 million men. Height odds inch by inch for men and women, and how Canada compares.",
      h1: "What percentage of men in Canada are 6 feet tall?",
      summary: "About 1 in 5 Canadian men is 6 feet or taller: almost exactly the same as young American men and the UK.",
      body: `      <p class="content-lede">About <strong>1 in 5</strong> men in Canada is 6 feet (183 cm) or taller: 18.5% of men aged 18 to 80, or roughly <strong>2.6 million</strong> men. That&rsquo;s almost exactly the same as American men under 45, at 18.8%.</p>

      <p>Here are Canada&rsquo;s height odds, from the same calculator that runs the U.S. numbers, inch by inch and in centimeters, next to American men under 45.</p>

      <h2>Canadian men, inch by inch</h2>
      <p>Share and number of Canadian men aged 18 to 80 at or above each height, next to the share of U.S. men aged 18 to 44:</p>
      ${table(["Height", "Canadian men", "U.S. men under 45"], menRows)}

      <h2>Canadian women</h2>
      <p>Share and number of Canadian women aged 18 to 80 at or above each height:</p>
      ${table(["Height", "Canadian women", "Women"], womenRows)}

      <h2>How Canada compares</h2>
      <p>Share of men who are 6&prime;0&Prime; or taller:</p>
      ${table(["Country", "6&prime;0&Prime; or taller"], compare)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>The typical Canadian man is about 5&prime;9&frac12;&Prime; (176 cm).</strong> 55% of Canadian men are 5&prime;9&Prime; or taller and 42% are 5&prime;10&Prime; or taller, so a 5&prime;10&Prime; minimum rules out more than half.</li>
        <li><strong>Canada, young America and the UK are all but tied.</strong> 18.5% of Canadian men are 6 feet or taller, against 18.8% of American men under 45 and 18.6% in the UK. Inch for inch, the Canadian and young American columns stay within 1.5 percentage points of each other at every height.</li>
        <li><strong>From 6 feet up, each inch roughly halves the pool.</strong> About 1 Canadian man in 5 is 6&prime;0&Prime;, 1 in 18 is 6&prime;2&Prime;, about 1 in 88 is 6&prime;4&Prime; and about 1 in 230 is 6&prime;5&Prime;.</li>
        <li><strong>Australia and Ireland are taller, Mexico much shorter.</strong> Around 1 man in 4 is 6 feet or taller in Australia and Ireland. In Mexico it&rsquo;s about 1 in 31. Canada comes 31st of the 177 countries with their own data.</li>
        <li><strong>For women, 5&prime;8&Prime; is about 1 in 18.</strong> About 1 Canadian woman in 100 is 5&prime;10&Prime; or taller, and about 1 in 950 is 6 feet.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>The Canadian figures are estimates, not a count of measured men. The calculator takes an average height and spread for Canadian adults (an average of about 5&prime;9&frac12;&Prime; for men and 5&prime;4&Prime; for women), drawn from Statistics Canada and WHO data, and fits a bell curve, the same way it treats every country outside the U.S. That curve is the same at every age, so it can&rsquo;t show that younger men tend to be taller, and the tallest rows are the least certain. The U.S. figures come from the CDC&rsquo;s measured health survey (NHANES 2021&ndash;2023) for each age group; older Americans measure shorter, which is why the fair comparison is with American men under 45. Countries close together in the table are effectively tied. Centimeters are rounded. See also <a href="/blog/percentage-of-uk-men-6-feet-tall.html">the UK</a>, <a href="/blog/percentage-of-australian-men-6-feet-tall.html">Australia</a> and <a href="/blog/countries-with-the-tallest-men.html">every country ranked</a>.</p>
${cta("Set a height minimum and see your odds in Canada and 197 other countries.")}`,
    };
  },
};
