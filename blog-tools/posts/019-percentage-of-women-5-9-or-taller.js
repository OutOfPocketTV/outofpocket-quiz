// Published 2026-11-23. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "percentage-of-women-5-9-or-taller",
  date: "2026-11-23",
  build({ run, count, cell, ht, table, NOT_OBESE, cta }) {
    const women = { targetSex: "women" };

    const heightRows = [66, 67, 68, 69, 70, 71, 72].map((minHeight) => {
      const all = run({ ...women, minHeight });
      const single = run({ ...women, minHeight, excludeMarried: true });
      return [`${ht(minHeight)} or taller`, `${cell(all)}<br>${count(all.matchingCount)}`, count(single.matchingCount)];
    });

    const ageRows = [[18, 29], [30, 44], [45, 54], [55, 64], [65, 80]].map(([ageLo, ageHi]) => {
      const nine = run({ ...women, ageLo, ageHi, minHeight: 69 });
      const single = run({ ...women, ageLo, ageHi, minHeight: 69, excludeMarried: true });
      return [`${ageLo}&ndash;${ageHi}`, cell(nine), cell(run({ ...women, ageLo, ageHi, minHeight: 70 })), count(single.matchingCount)];
    });

    let list = { ...women, ageLo: 25, ageHi: 35, excludeMarried: true };
    const stepRows = [
      ["Unmarried, aged 25&ndash;35, 5&prime;9&Prime; or taller", { minHeight: 69 }],
      ["&hellip; and has never had a child", { excludeKids: true }],
      ["&hellip; and not obese", { selectedBodyTypes: NOT_OBESE }],
    ].map(([label, f]) => {
      list = { ...list, ...f };
      const r = run(list);
      return [label, cell(r), count(r.matchingCount)];
    });

    return {
      title: "What Percentage of Women Are 5′9″ or Taller? And How Many Are Single | Out Of Pocket TV",
      description: "About 1 in 41 American women is 5′9″ or taller, roughly 3.1 million, and about 1.7 million of them aren't married. Tall women by height and by age.",
      h1: "What percentage of women are 5′9″ or taller?",
      summary: "About 1 in 41 American women is 5′9″ or taller, about as rare as a 6′3″ man. How many are single, by height and age.",
      body: `      <p class="content-lede">About <strong>1 in 41</strong> American women is 5&prime;9&Prime; or taller: 2.4% of women aged 18 to 80, or roughly 3.1 million women. About <strong>1.7 million</strong> of them aren&rsquo;t married.</p>

      <p>A 5&prime;9&Prime; woman is about as rare as a 6&prime;3&Prime; man. Here is how many women there are at each height from 5&prime;6&Prime; up, how many of them are single, and how it changes with age.</p>

      <h2>Women, inch by inch</h2>
      <p>Share and number of U.S. women aged 18 to 80 at or above each height, and how many of them aren&rsquo;t married:</p>
      ${table(["Height", "Women", "Not married"], heightRows)}

      <h2>By age</h2>
      <p>Share of U.S. women in each age group who are 5&prime;9&Prime; or taller and 5&prime;10&Prime; or taller, and the number of unmarried women 5&prime;9&Prime; or taller:</p>
      ${table(["Age", "5&prime;9&Prime;+", "5&prime;10&Prime;+", "Unmarried, 5&prime;9&Prime;+"], ageRows)}

      <h2>A typical list</h2>
      <p>Starting from unmarried women aged 25 to 35 who are 5&prime;9&Prime; or taller. Shares are of all women in that age range:</p>
      ${table(["Standard", "Share of women 25&ndash;35", "Women in the U.S."], stepRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Each inch above 5&prime;7&Prime; roughly halves the pool, or worse.</strong> About 1 woman in 9 is 5&prime;7&Prime; or taller, 1 in 19 is 5&prime;8&Prime;, 1 in 41 is 5&prime;9&Prime;, about 1 in 100 is 5&prime;10&Prime; and about 1 in 880 is 6 feet.</li>
        <li><strong>A 5&prime;9&Prime; woman is about as rare as a 6&prime;3&Prime; man.</strong> 2.4% of women are 5&prime;9&Prime; or taller and 2.3% of men are 6&prime;3&Prime; or taller.</li>
        <li><strong>Younger women are taller.</strong> About 1 woman in 26 under 30 is 5&prime;9&Prime; or taller, against about 1 in 120 aged 65 to 80.</li>
        <li><strong>Most tall women under 30 are single.</strong> About 810,000 of the roughly 990,000 women under 30 who are 5&prime;9&Prime; or taller aren&rsquo;t married.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Height comes from the CDC&rsquo;s National Health and Nutrition Examination Survey (NHANES, 2021&ndash;2023), which measures people without shoes rather than asking them. The calculator fits a bell curve to each age group&rsquo;s measured heights, and this far above the average the curve and the direct count part company a little: the measured count on our <a href="/height-odds.html">height odds</a> page puts women 5&prime;9&Prime; or taller at about 1 in 50, a bit rarer than the curve&rsquo;s 1 in 41. Treat the tallest rows as estimates. Marital status comes from the Census Bureau&rsquo;s Current Population Survey (March 2025); &ldquo;not married&rdquo; includes divorced, widowed and separated women and isn&rsquo;t the same as single.</p>
${cta("Set a height minimum for her, or for him, and see what it does to the pool.")}`,
    };
  },
};
