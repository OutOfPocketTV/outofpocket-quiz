// Published 2026-11-11. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "percentage-of-irish-men-6-feet-tall",
  date: "2026-11-11",
  build({ run, W, count, cell, ht, table, cta }) {
    const G = W.QuizGlobalStats;
    const IE = "IE";
    const UK = "GB";
    const cm = (inches) => `${Math.round(inches * 2.54)} cm`;
    const usYoung = { ageLo: 18, ageHi: 44 };

    const menRows = [68, 69, 70, 71, 72, 73, 74, 75, 76, 77].map((minHeight) => {
      const ie = run({ minHeight }, IE);
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, `${cell(ie)}<br>${count(ie.matchingCount)}`, cell(run({ minHeight }, UK)), cell(run({ ...usYoung, minHeight }))];
    });

    const womenRows = [64, 65, 66, 67, 68, 69, 70, 72].map((minHeight) => {
      const ie = run({ targetSex: "women", minHeight }, IE);
      return [`${ht(minHeight)} <span class="odds-note">(${cm(minHeight)})</span>`, `${cell(ie)}<br>${count(ie.matchingCount)}`, cell(run({ targetSex: "women", minHeight }, UK))];
    });

    const compare = ["Netherlands", "Norway", "Germany", "Australia", "Ireland", "United Kingdom", "Canada"]
      .map((name) => Object.keys(G.COUNTRIES).find((c) => G.getCountryMeta(c).name === name))
      .map((code) => [G.getCountryMeta(code).name, cell(run({ minHeight: 72 }, code))]);
    compare.push(["United States, men under 45", cell(run({ ...usYoung, minHeight: 72 }))]);
    compare.push(["United States, all men", cell(run({ minHeight: 72 }))]);

    return {
      title: "What Percentage of Men in Ireland Are 6 Feet Tall? Ireland Height Odds | Out Of Pocket TV",
      description: "About 1 in 4 Irish men is 6 feet (183 cm) or taller, roughly 480,000 men, against 1 in 5 in the UK. Height odds inch by inch for men and women in Ireland.",
      h1: "What percentage of men in Ireland are 6 feet tall?",
      summary: "About 1 in 4 Irish men is 6 feet or taller, about 40% more likely than men in the UK next door.",
      body: `      <p class="content-lede">About <strong>1 in 4</strong> men in Ireland is 6 feet (183 cm) or taller: 26.0% of men aged 18 to 80, or roughly <strong>480,000</strong> men. In the UK next door it&rsquo;s about 1 in 5.</p>

      <p>Here are Ireland&rsquo;s height odds, from the same calculator that runs the U.S. numbers, inch by inch and in centimeters, next to the UK and American men under 45.</p>

      <h2>Irish men, inch by inch</h2>
      <p>Share and number of Irish men aged 18 to 80 at or above each height, next to the share of UK men and U.S. men aged 18 to 44:</p>
      ${table(["Height", "Irish men", "UK men", "U.S. men under 45"], menRows)}

      <h2>Irish women</h2>
      <p>Share and number of Irish women aged 18 to 80 at or above each height, next to UK women:</p>
      ${table(["Height", "Irish women", "UK women"], womenRows)}

      <h2>How Ireland compares</h2>
      <p>Share of men who are 6&prime;0&Prime; or taller:</p>
      ${table(["Country", "6&prime;0&Prime; or taller"], compare)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>The typical Irish man is about 5&prime;10&Prime; (178 cm).</strong> 53% of Irish men are 5&prime;10&Prime; or taller, so a 5&prime;10&Prime; minimum rules out a little under half.</li>
        <li><strong>Irish men are about 40% more likely than men in the UK to be 6 feet.</strong> 26.0% against 18.6%. The averages behind those figures are less than an inch apart, but at 6 feet a small difference in the average becomes a big difference in the share.</li>
        <li><strong>From 6 feet up, each inch cuts the pool by about 40%, then more.</strong> About 1 Irish man in 4 is 6&prime;0&Prime;, 1 in 11 is 6&prime;2&Prime;, about 1 in 52 is 6&prime;4&Prime; and about 1 in 130 is 6&prime;5&Prime;.</li>
        <li><strong>Irish women are taller too.</strong> About 1 in 11 is 5&prime;8&Prime; or taller, against about 1 in 16 in the UK. About 1 in 58 is 5&prime;10&Prime; and about 1 in 510 is 6 feet.</li>
        <li><strong>Ireland is in the tall group, not the tallest.</strong> It comes 16th of the 177 countries with their own data, level with Australia and Czechia. Norway (32%), Germany (30%) and the Netherlands (46%) are taller.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>The Irish figures are estimates, not a count of measured men. The calculator takes an average height and spread for Irish adults (an average of about 5&prime;10&Prime; for men and 5&prime;4&frac12;&Prime; for women), drawn from CSO Ireland and WHO data, and fits a bell curve, the same way it treats every country outside the U.S. That curve is the same at every age, so it can&rsquo;t show that younger men tend to be taller, and the tallest rows are the least certain. Because the share above 6 feet is so sensitive to the average, treat the gap with the UK as a sign that Irish men are a little taller, not a precise figure. The U.S. figures come from the CDC&rsquo;s measured health survey (NHANES 2021&ndash;2023) for each age group, which is why the fair comparison is with American men under 45. Countries close together in the table are effectively tied. Centimeters are rounded. See also <a href="/blog/percentage-of-uk-men-6-feet-tall.html">the UK</a>, <a href="/blog/percentage-of-australian-men-6-feet-tall.html">Australia</a>, <a href="/blog/percentage-of-canadian-men-6-feet-tall.html">Canada</a> and <a href="/blog/countries-with-the-tallest-men.html">every country ranked</a>.</p>
${cta("Set a height minimum and see your odds in Ireland and 197 other countries.")}`,
    };
  },
};
