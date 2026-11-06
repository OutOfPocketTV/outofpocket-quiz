// Published 2026-11-06. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "percentage-of-australian-men-6-feet-tall",
  date: "2026-11-06",
  build({ run, W, count, cell, ht, table, cta }) {
    const G = W.QuizGlobalStats;
    const AU = "AU";
    const cm = (inches) => `${Math.round(inches * 2.54)} cm`;

    const menRows = [68, 69, 70, 71, 72, 73, 74, 75, 76, 77].map((minHeight) => {
      const au = run({ minHeight }, AU);
      const us = run({ minHeight });
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, `${cell(au)}<br>${count(au.matchingCount)}`, cell(us)];
    });

    const womenRows = [64, 65, 66, 67, 68, 69, 70, 72].map((minHeight) => {
      const au = run({ targetSex: "women", minHeight }, AU);
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, cell(au), count(au.matchingCount)];
    });

    const compare = ["Netherlands", "Australia", "Ireland", "New Zealand", "United Kingdom", "Canada"]
      .map((name) => Object.keys(G.COUNTRIES).find((c) => G.getCountryMeta(c).name === name))
      .map((code) => [G.getCountryMeta(code).name, cell(run({ minHeight: 72 }, code))]);
    compare.push(["United States, men under 45", cell(run({ ageLo: 18, ageHi: 44, minHeight: 72 }))]);
    compare.push(["United States, all men", cell(run({ minHeight: 72 }))]);

    return {
      title: "What Percentage of Men in Australia Are 6 Feet Tall? Australia Height Odds | Out Of Pocket TV",
      description: "About 1 in 4 Australian men is 6 feet (183 cm) or taller, roughly 2.5 million men. Height odds inch by inch for men and women, and how Australia compares.",
      h1: "What percentage of men in Australia are 6 feet tall?",
      summary: "About 1 in 4 Australian men is 6 feet or taller, the tallest of any country outside Europe in the calculator.",
      body: `      <p class="content-lede">About <strong>1 in 4</strong> men in Australia is 6 feet (183 cm) or taller: 26.7% of men aged 18 to 80, or roughly <strong>2.5 million</strong> men. That&rsquo;s a bigger share than in the U.S., the UK or Canada.</p>

      <p>Here are Australia&rsquo;s height odds, from the same calculator that runs the U.S. numbers, inch by inch and in centimeters, with the U.S. alongside.</p>

      <h2>Australian men, inch by inch</h2>
      <p>Share and number of Australian men aged 18 to 80 at or above each height, next to the share of U.S. men:</p>
      ${table(["Height", "Australian men", "U.S. men"], menRows)}

      <h2>Australian women</h2>
      <p>Share and number of Australian women aged 18 to 80 at or above each height:</p>
      ${table(["Height", "Australian women", "Women"], womenRows)}

      <h2>How Australia compares</h2>
      <p>Share of men who are 6&prime;0&Prime; or taller:</p>
      ${table(["Country", "6&prime;0&Prime; or taller"], compare)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>The typical Australian man is about 5&prime;10&Prime; (178 cm).</strong> 53% of Australian men are 5&prime;10&Prime; or taller, so a 5&prime;10&Prime; minimum rules out a little under half.</li>
        <li><strong>From 6 feet up, each inch cuts the pool by about 40%, then more.</strong> About 1 Australian man in 4 is 6&prime;0&Prime;, 1 in 11 is 6&prime;2&Prime;, about 1 in 44 is 6&prime;4&Prime; and about 1 in 110 is 6&prime;5&Prime;.</li>
        <li><strong>Australian men are taller than Americans, even young ones.</strong> 26.7% of Australian men are 6 feet or taller, against 18.8% of American men under 45: about 40% more likely.</li>
        <li><strong>The tallest country outside Europe.</strong> Australia comes 15th of the 177 countries with their own data, and first outside Europe, ahead of New Zealand at 22.7%.</li>
        <li><strong>Australian women are taller too.</strong> About 1 woman in 12 is 5&prime;8&Prime; or taller, against about 1 in 16 in the UK. About 1 in 58 is 5&prime;10&Prime; and about 1 in 460 is 6 feet.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>The Australian figures are estimates, not a count of measured men. The calculator takes an average height and spread for Australian adults (an average of about 5&prime;10&Prime; for men and 5&prime;4&Prime; for women), drawn from Australian Bureau of Statistics and WHO data, and fits a bell curve, the same way it treats every country outside the U.S. That curve is the same at every age, so it can&rsquo;t show that younger men tend to be taller, and the tallest rows are the least certain. The U.S. figures come from the CDC&rsquo;s measured health survey (NHANES 2021&ndash;2023) for each age group, which is why the fair comparison is with American men under 45. Countries close together in the table are effectively tied. Centimeters are rounded. For the UK, see <a href="/blog/percentage-of-uk-men-6-feet-tall.html">what percentage of men in the UK are 6 feet tall</a>, and for every country, <a href="/blog/countries-with-the-tallest-men.html">where the tall men are</a>.</p>
${cta("Set a height minimum and see your odds in Australia and 197 other countries.")}`,
    };
  },
};
