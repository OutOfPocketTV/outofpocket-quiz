// Published 2026-11-04. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "percentage-of-uk-men-6-feet-tall",
  date: "2026-11-04",
  build({ run, W, count, cell, ht, table, cta }) {
    const G = W.QuizGlobalStats;
    const UK = "GB";
    const cm = (inches) => `${Math.round(inches * 2.54)} cm`;

    const menRows = [68, 69, 70, 71, 72, 73, 74, 75, 76, 77].map((minHeight) => {
      const uk = run({ minHeight }, UK);
      const us = run({ minHeight });
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, `${cell(uk)}<br>${count(uk.matchingCount)}`, cell(us)];
    });

    const womenRows = [64, 65, 66, 67, 68, 69, 70, 72].map((minHeight) => {
      const uk = run({ targetSex: "women", minHeight }, UK);
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, cell(uk), count(uk.matchingCount)];
    });

    const compare = ["Netherlands", "Germany", "Australia", "Ireland", "France", "United Kingdom", "Canada"]
      .map((name) => Object.keys(G.COUNTRIES).find((c) => G.getCountryMeta(c).name === name))
      .map((code) => [G.getCountryMeta(code).name, cell(run({ minHeight: 72 }, code))]);
    compare.push(["United States, men under 45", cell(run({ ageLo: 18, ageHi: 44, minHeight: 72 }))]);
    compare.push(["United States, all men", cell(run({ minHeight: 72 }))]);

    return {
      title: "What Percentage of Men in the UK Are 6 Feet Tall? UK Height Odds | Out Of Pocket TV",
      description: "About 1 in 5 men in the UK is 6 feet (183 cm) or taller, roughly 4.4 million men. UK height odds inch by inch for men and women, and how the UK compares.",
      h1: "What percentage of men in the UK are 6 feet tall?",
      summary: "About 1 in 5 UK men is 6 feet or taller. Inch by inch for men and women, and how the UK compares with the U.S. and Europe.",
      body: `      <p class="content-lede">About <strong>1 in 5</strong> men in the UK is 6 feet (183 cm) or taller: 18.6% of men aged 18 to 80, or roughly <strong>4.4 million</strong> men. That&rsquo;s about the same share as American men under 45.</p>

      <p>Here are the UK&rsquo;s own height odds, from the same calculator that runs the U.S. numbers, inch by inch, with the U.S. alongside.</p>

      <h2>UK men, inch by inch</h2>
      <p>Share and number of UK men aged 18 to 80 at or above each height, next to the share of U.S. men:</p>
      ${table(["Height", "UK men", "U.S. men"], menRows)}

      <h2>UK women</h2>
      <p>Share and number of UK women aged 18 to 80 at or above each height:</p>
      ${table(["Height", "UK women", "Women"], womenRows)}

      <h2>How the UK compares</h2>
      <p>Share of men who are 6&prime;0&Prime; or taller:</p>
      ${table(["Country", "6&prime;0&Prime; or taller"], compare)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>The typical UK man is about 5&prime;9&frac12;&Prime;.</strong> 57% of UK men are 5&prime;9&Prime; or taller and 43% are 5&prime;10&Prime; or taller, so a 5&prime;10&Prime; minimum already rules out more than half.</li>
        <li><strong>From 6 feet up, each inch roughly halves the pool.</strong> About 1 UK man in 5 is 6&prime;0&Prime;, 1 in 19 is 6&prime;2&Prime;, about 1 in 99 is 6&prime;4&Prime; and about 1 in 270 is 6&prime;5&Prime;.</li>
        <li><strong>UK men aren&rsquo;t really taller than Americans.</strong> The UK&rsquo;s 18.6% beats the 15.6% for all U.S. men, but that&rsquo;s because the U.S. figure includes older men, who measure shorter. American men under 45 come out at about the same, 18.8%.</li>
        <li><strong>For women, 5&prime;8&Prime; is already uncommon.</strong> About 1 UK woman in 16 is 5&prime;8&Prime; or taller, 1 in 95 is 5&prime;10&Prime; and about 1 in 960 is 6 feet.</li>
        <li><strong>Several countries are taller.</strong> The Netherlands is close to half, Germany about 30% and Ireland and Australia around 26%. The UK comes 28th of the 177 countries with their own data.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>The UK figures are estimates, not a count of measured men. The calculator takes an average height and spread for UK adults (an average of about 5&prime;9&frac12;&Prime; for men and 5&prime;4&Prime; for women), drawn from national statistics and WHO data, and fits a bell curve, the same way it treats every country outside the U.S. That curve is the same at every age, so it can&rsquo;t show that younger men tend to be taller, and the tallest rows are the least certain. The U.S. figures come from the CDC&rsquo;s measured health survey (NHANES 2021&ndash;2023) for each age group, which is why the fair comparison is with American men under 45. Countries close together in the table are effectively tied. Centimeters are rounded. For the full country ranking, see <a href="/blog/countries-with-the-tallest-men.html">where the tall men are</a>.</p>
${cta("Set a height minimum and see your odds in the UK and 197 other countries.")}`,
    };
  },
};
