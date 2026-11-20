// Published 2026-11-20. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "do-married-men-earn-more",
  date: "2026-11-20",
  build({ run, pct, table, cta }) {
    // Share earning at least `minIncome` among married and unmarried people
    // in an age group. Married = everyone minus the unmarried, all counts
    // straight from the engine.
    const split = (targetSex, ageLo, ageHi, minIncome) => {
      const all = run({ targetSex, ageLo, ageHi }).matchingCount;
      const un = run({ targetSex, ageLo, ageHi, excludeMarried: true }).matchingCount;
      const earn = run({ targetSex, ageLo, ageHi, minIncome }).matchingCount;
      const unEarn = run({ targetSex, ageLo, ageHi, minIncome, excludeMarried: true }).matchingCount;
      return { married: ((earn - unEarn) / (all - un)) * 100, unmarried: (unEarn / un) * 100 };
    };
    const AGE_GROUPS = [[25, 34], [35, 44], [45, 54], [55, 64]];
    const rows = (sex) => AGE_GROUPS.map(([a, b]) => {
      const fifty = split(sex, a, b, 50000);
      const hundred = split(sex, a, b, 100000);
      return [`${a}&ndash;${b}`, pct(fifty.married), pct(fifty.unmarried), pct(hundred.married), pct(hundred.unmarried), `${(hundred.married / hundred.unmarried).toFixed(1)}&times;`];
    });
    const head = ["Age", "Married, $50k+", "Unmarried, $50k+", "Married, $100k+", "Unmarried, $100k+", "Gap at $100k"];

    return {
      title: "Do Married Men Earn More? Married vs Single Income, by Age | Out Of Pocket TV",
      description: "Yes. Married men aged 35 to 44 are about 2.6 times as likely as unmarried men their age to earn $100,000. For women the gap is much smaller. By age.",
      h1: "Do married men earn more?",
      summary: "Yes: at the same age, married men are 2.2 to 2.6 times as likely to earn six figures. For women the gap is much smaller.",
      body: `      <p class="content-lede">Yes, by a lot. Married men aged 35 to 44 are about <strong>2.6 times</strong> as likely as unmarried men the same age to earn $100,000 or more: 42% against 16%. For women the gap is much smaller.</p>

      <p>This is the reason the calculator counts income and marriage together instead of multiplying two percentages. Here is the gap itself, age group by age group, from Census records that report both for the same people.</p>

      <h2>Men</h2>
      <p>Share of U.S. men earning at least $50,000 and $100,000 a year, married against not married, in each age group:</p>
      ${table(head, rows("men"))}

      <h2>Women</h2>
      <p>The same for U.S. women:</p>
      ${table(head, rows("women"))}

      <h2>What stands out</h2>
      <ul>
        <li><strong>For men, the six-figure gap is 2.2 to 2.6 times at every age from 25 to 54.</strong> It&rsquo;s widest at 35 to 44 and narrows to about 1.9 times after 55.</li>
        <li><strong>It shows up well below six figures too.</strong> Around three-quarters of married men aged 35 to 54 earn $50,000 or more, against under half of unmarried men.</li>
        <li><strong>For women, marriage makes much less difference.</strong> At $50,000 married women are only slightly ahead, and at $100,000 the gap is about 1.4 to 1.7 times.</li>
        <li><strong>Comparing all ages at once exaggerates it.</strong> Across men 18 to 80, 34% of married men earn six figures against 12% of unmarried men, nearly three times as many. But unmarried men are younger on average, and younger men earn less. Matching ages, as the tables do, gives the fairer picture.</li>
      </ul>

      <h2>Why?</h2>
      <p>The survey can&rsquo;t say which way it runs. It may be that men who earn more are more likely to marry, or that being married helps men earn more, or both. These numbers show the pattern, not the cause. What they do show is why a list that asks for six figures and &ldquo;not married&rdquo; shrinks faster than you&rsquo;d expect: the two standards pull against each other. <a href="/blog/how-many-single-men-make-100k.html">How many single men make $100k</a> works through what that means for the pool.</p>

      <h2>How these numbers are worked out</h2>
      <p>Age, income and marital status are counted together, from the same people, in the Census Bureau&rsquo;s Current Population Survey (March 2025, about 108,000 adults), weighted to represent the U.S. The married share is everyone in the age group minus the unmarried. Income is total personal income before tax for 2024, so it measures what each person earns, not their household. &ldquo;Not married&rdquo; means never married, divorced, widowed or separated, so it includes people living with a partner.</p>
${cta("See how income and marriage combine on your own list.")}`,
    };
  },
};
