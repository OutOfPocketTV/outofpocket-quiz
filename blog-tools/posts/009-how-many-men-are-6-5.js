// Published 2026-10-30. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "how-many-men-are-6-5",
  date: "2026-10-30",
  build({ run, count, cell, ht, table, cta }) {
    const young = { ageLo: 25, ageHi: 35, excludeMarried: true };

    const heightRows = [72, 73, 74, 75, 76, 77, 78, 79, 80].map((minHeight) => {
      const all = run({ minHeight });
      const single = run({ ...young, minHeight });
      return [`${ht(minHeight)} or taller`, `${cell(all)}<br>${count(all.matchingCount)}`, `${cell(single)}<br>${count(single.matchingCount)}`];
    });

    let list = { ...young };
    const memeRows = [
      ["Unmarried, aged 25&ndash;35, 6&prime;5&Prime; or taller", { minHeight: 77 }],
      ["&hellip; and earns $100,000+", { minIncome: 100000 }],
      ["&hellip; and earns $250,000+", { minIncome: 250000 }],
      ["&hellip; and has never had a child", { excludeKids: true }],
    ].map(([label, f]) => {
      list = { ...list, ...f };
      const r = run(list);
      return [label, cell(r), count(r.matchingCount)];
    });

    return {
      title: "How Many Men Are 6′5″ or Taller? The Real Odds of the 6′5″ Man | Out Of Pocket TV",
      description: "About 1 in 240 American men is 6′5″ or taller, roughly 520,000 men. Unmarried, aged 25 to 35 and earning $250k: fewer than 1,000. The odds by height.",
      h1: "How many men are 6′5″ or taller?",
      summary: "About 1 in 240 American men. Then we ran the rest of the viral “6′5″, finance” list through the calculator.",
      body: `      <p class="content-lede">About <strong>1 in 240</strong> American men is 6&prime;5&Prime; or taller: 0.42% of men aged 18 to 80, or roughly <strong>520,000</strong> men in the whole country. Narrow it to unmarried men aged 25 to 35 and it&rsquo;s about 79,000.</p>

      <p>6&prime;5&Prime; became the internet&rsquo;s shorthand for the impossible standard after a 2024 song went viral asking for a man in finance, with a trust fund, 6&prime;5&Prime; and blue eyes. We can&rsquo;t count trust funds, jobs or eye color: no national survey records them alongside height. But we can count the height, the income and the rest.</p>

      <h2>Inch by inch, from 6 feet up</h2>
      <p>Share and number of U.S. men at or above each height, for all men aged 18 to 80 and for unmarried men aged 25 to 35:</p>
      ${table(["Height", "All men 18&ndash;80", "Unmarried men 25&ndash;35"], heightRows)}

      <h2>The rest of the list</h2>
      <p>Starting from unmarried men aged 25 to 35 and adding one standard at a time, with income standing in for &ldquo;finance&rdquo;:</p>
      ${table(["Standard", "Share of unmarried men 25&ndash;35", "Men in the U.S."], memeRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Above 6 feet, each inch cuts the pool by about half, and by more the taller you go.</strong> 6&prime;0&Prime; is about 1 man in 6, 6&prime;2&Prime; about 1 in 21, 6&prime;4&Prime; about 1 in 97 and 6&prime;5&Prime; about 1 in 240.</li>
        <li><strong>A 6&prime;5&Prime; man is rarer than a 5&prime;10&Prime; woman.</strong> About 1 woman in 100 is 5&prime;10&Prime; or taller. A 6&prime;5&Prime; man is closer to a 5&prime;11&Prime; woman, at about 1 in 280.</li>
        <li><strong>Add six figures and the young, unmarried 6&prime;5&Prime; pool falls to about 11,000.</strong> That&rsquo;s about 1 unmarried man aged 25 to 35 in 2,400.</li>
        <li><strong>At $250,000 it&rsquo;s fewer than 1,000 men in the country.</strong> About 900, or 1 in 29,000. With no kids as well, about 700. That is before eye color, the job title or the trust fund.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Height comes from the CDC&rsquo;s National Health and Nutrition Examination Survey (2021&ndash;2023), which measures people rather than asking them. Very few men in the sample are 6&prime;5&Prime; or taller, too few to count directly, so these figures come from the bell curve the calculator fits to each age group&rsquo;s measured heights. That makes them estimates, and the tallest rows are the least certain: the measured count on our <a href="/height-odds.html">height odds</a> page puts 6&prime;4&Prime; at about 1 in 110, a little rarer than the curve&rsquo;s 1 in 97. Age, marital status and income are counted together from the Census Bureau&rsquo;s Current Population Survey (March 2025); height is applied on top as if unrelated to income, and taller men do earn slightly more on average. &ldquo;Not married&rdquo; includes divorced, widowed and separated men, and isn&rsquo;t the same as single.</p>
${cta("Set your own height minimum and see what it does to the rest of your list.")}`,
    };
  },
};
