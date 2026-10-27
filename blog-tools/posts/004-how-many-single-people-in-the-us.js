// Published 2026-10-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "how-many-single-people-in-the-us",
  date: "2026-10-27",
  build({ run, W, pct, oneIn, count, note, cell, ht, table, AGES, ageLabel, NOT_OBESE, cta }) {
  let totM = 0, totW = 0;
  const rows = AGES.map((ab) => {
    const [ageLo, ageHi] = ab;
    const m = run({ ageLo, ageHi, excludeMarried: true });
    const w = run({ targetSex: "women", ageLo, ageHi, excludeMarried: true });
    totM += m.matchingCount; totW += w.matchingCount;
    return [ageLabel(ab), `${pct(m.pct)}<br>${count(m.matchingCount)}`, `${pct(w.pct)}<br>${count(w.matchingCount)}`, `${Math.round((m.matchingCount / w.matchingCount) * 100)}`];
  });
  rows.push(["All, 18&ndash;80", `${pct(run({ excludeMarried: true }).pct)}<br>${count(totM)}`, `${pct(run({ targetSex: "women", excludeMarried: true }).pct)}<br>${count(totW)}`, `${Math.round((totM / totW) * 100)}`]);

  return {
    title: "How Many Single People Are There in the U.S.? Unmarried Men and Women by Age | Out Of Pocket TV",
    description: "About 59 million men and 63 million women in the U.S. are not married. Unmarried adults at every age, and where men and women are out of balance.",
    h1: "How many single people are there in the U.S.?",
    summary: "About 122 million American adults aren’t married. How that splits by age, and where men and women are out of balance.",
    body: `      <p class="content-lede">About <strong>59 million men</strong> and <strong>63 million women</strong> aged 18 to 80 in the U.S. aren&rsquo;t married: just under half of all adults. But the balance between men and women swings a lot with age.</p>

      <h2>Unmarried adults by age</h2>
      <p>Share and number of U.S. adults in each age group who aren&rsquo;t currently married, with the number of unmarried men for every 100 unmarried women:</p>
      ${table(["Age", "Men", "Women", "Men per 100 women"], rows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Under 25, almost everyone is unmarried.</strong> About 95% of men and 93% of women.</li>
        <li><strong>Women marry earlier, so single men outnumber single women in their late twenties and thirties.</strong> At 30 to 34, 57% of men aren&rsquo;t married against 48% of women: about 119 unmarried men for every 100 unmarried women.</li>
        <li><strong>The middle is the most married.</strong> From the mid-thirties to the mid-sixties, only about a third to two-fifths of adults aren&rsquo;t married.</li>
        <li><strong>After 65 it flips hard.</strong> Women live longer and are more often widowed, so 45% of women 65 to 80 aren&rsquo;t married against 30% of men. That&rsquo;s about 59 unmarried men for every 100 unmarried women.</li>
      </ul>

      <h2>&ldquo;Not married&rdquo; isn&rsquo;t the same as single</h2>
      <p>These are people who aren&rsquo;t currently married: never married, divorced, widowed or separated. Plenty of them are dating, living with a partner or engaged. The Census Bureau counts marriage, not relationships, so the number of people who are truly available is smaller than this table, by an amount nobody measures well.</p>

      <h2>How these numbers are worked out</h2>
      <p>Counted from the individual records of the Census Bureau&rsquo;s Current Population Survey, March 2025: about 108,000 adults in 56,000 households, weighted to represent the U.S. population. The calculator uses these same records for every single year of age, together with income and race, so &ldquo;unmarried and 30&rdquo; is a real count. See <a href="/how-it-works.html">how the odds are calculated</a>.</p>
${cta("See how many unmarried people match the rest of your list.")}`,
  };
  },
};
