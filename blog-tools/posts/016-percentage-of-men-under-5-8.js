// Published 2026-11-16. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "percentage-of-men-under-5-8",
  date: "2026-11-16",
  build({ run, pct, count, oneIn, note, ht, table, cta }) {
    // Share and number of people shorter than a height: everyone minus
    // those at or above it, both straight from the engine.
    const under = (minHeight, f = {}) => {
      const all = run(f);
      const tall = run({ ...f, minHeight });
      return { pct: 100 - tall.pct, matchingCount: all.matchingCount - tall.matchingCount };
    };
    const show = (r) => `${pct(r.pct)}${note(r.pct < 30 ? oneIn(r.pct) : "")}`;

    const heightRows = [64, 65, 66, 67, 68, 69, 70, 72].map((h) => {
      const r = under(h);
      return [`Under ${ht(h)}`, show(r), count(r.matchingCount)];
    });

    const ageRows = [[18, 29], [30, 44], [45, 54], [55, 64], [65, 80]].map(([ageLo, ageHi]) => [
      `${ageLo}&ndash;${ageHi}`,
      show(under(66, { ageLo, ageHi })),
      show(under(68, { ageLo, ageHi })),
      show(under(70, { ageLo, ageHi })),
    ]);

    const womenRows = [66, 67, 68, 69, 70].map((h) => [ht(h), pct(under(h, { targetSex: "women" }).pct)]);

    return {
      title: "What Percentage of Men Are Under 5′8″? The Short King Numbers | Out Of Pocket TV",
      description: "About 3 in 8 American men are under 5′8″, roughly 47 million men. Half are under 5′9″ and nearly 2 in 3 under 5′10″. The numbers by height and age.",
      h1: "What percentage of men are under 5′8″?",
      summary: "About 3 in 8 American men are under 5′8″, and nearly 2 in 3 are under 5′10″. By height and by age.",
      body: `      <p class="content-lede">About <strong>3 in 8</strong> American men are under 5&prime;8&Prime;: 37.7% of men aged 18 to 80, or roughly <strong>47 million</strong> men. About half are under 5&prime;9&Prime;, and nearly 2 in 3 are under 5&prime;10&Prime;.</p>

      <p>Our other height posts start at the tall end. This one starts at the other, which is a lot more crowded: how many men fall under each height, measured rather than self-reported.</p>

      <h2>Under each height</h2>
      <p>Share and number of U.S. men aged 18 to 80 shorter than each height:</p>
      ${table(["Height", "Share of men", "Men"], heightRows)}

      <h2>By age</h2>
      <p>Share of U.S. men in each age group shorter than 5&prime;6&Prime;, 5&prime;8&Prime; and 5&prime;10&Prime;:</p>
      ${table(["Age", "Under 5&prime;6&Prime;", "Under 5&prime;8&Prime;", "Under 5&prime;10&Prime;"], ageRows)}

      <h2>Compared with women</h2>
      <p>Share of U.S. women shorter than each height, for a sense of how tall these men are to a woman:</p>
      ${table(["Height", "Women shorter than this"], womenRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>5&prime;9&Prime; is the middle.</strong> About half of American men are under 5&prime;9&Prime; and half are 5&prime;9&Prime; or taller.</li>
        <li><strong>Under 5&prime;10&Prime; is the majority.</strong> About 64% of men are shorter than 5&prime;10&Prime;, and 84% are shorter than 6 feet.</li>
        <li><strong>Younger men are taller.</strong> About a third of men under 45 are under 5&prime;8&Prime;, against nearly half of men aged 65 to 80.</li>
        <li><strong>A 5&prime;8&Prime; man is taller than about 95% of women.</strong> Even a 5&prime;6&Prime; man is taller than about 4 in 5 women.</li>
        <li><strong>Under 5&prime;6&Prime; is about 1 man in 6.</strong> Under 5&prime;4&Prime; it&rsquo;s about 1 in 20.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Height comes from the CDC&rsquo;s National Health and Nutrition Examination Survey (NHANES, 2021&ndash;2023), which measures people without shoes rather than asking them. The calculator fits a bell curve to each age group&rsquo;s measured heights; near the middle of the range, where these figures sit, it matches the measured count to within about a percentage point. Each share here is everyone minus the share at or above that height. For the tall end, see <a href="/height-odds.html">height odds</a> and <a href="/blog/how-many-men-are-6-5.html">how many men are 6&prime;5&Prime; or taller</a>.</p>
${cta("Set your own height minimum and see what it does to the pool.")}`,
    };
  },
};
