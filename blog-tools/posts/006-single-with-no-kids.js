// Published 2026-10-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "single-with-no-kids",
  date: "2026-10-27",
  build({ run, W, pct, oneIn, count, note, cell, ht, table, AGES, ageLabel, NOT_OBESE, cta }) {
  const rows = AGES.map((ab) => {
    const [ageLo, ageHi] = ab;
    const m = run({ ageLo, ageHi, excludeKids: true });
    const w = run({ targetSex: "women", ageLo, ageHi, excludeKids: true });
    const ms = run({ ageLo, ageHi, excludeKids: true, excludeMarried: true });
    const ws = run({ targetSex: "women", ageLo, ageHi, excludeKids: true, excludeMarried: true });
    return [ageLabel(ab), pct(m.pct), pct(w.pct), `${pct(ms.pct)}<br>${count(ms.matchingCount)}`, `${pct(ws.pct)}<br>${count(ws.matchingCount)}`];
  });

  return {
    title: "How Many Single People Have No Kids? Unmarried and Childless, by Age | Out Of Pocket TV",
    description: "What share of single men and women have never had a child? By 30 to 34, about 24% of women and 40% of men are both unmarried and childless. The full breakdown by age.",
    h1: "How many single people have no kids?",
    summary: "“Single with no kids” keeps most people in their twenties and drops fast after 30, faster for women than men.",
    body: `      <p class="content-lede">&ldquo;Single, no kids&rdquo; is one of the most common things people ask for, and in your twenties it barely narrows anything down. By the early thirties it rules out most people: about <strong>24% of women</strong> and <strong>40% of men</strong> aged 30 to 34 are both unmarried and have never had a child.</p>

      <h2>By age</h2>
      <p>Share of U.S. adults who have never had a child, and who are both not married and have never had a child:</p>
      ${table(["Age", "No kids: men", "No kids: women", "Not married, no kids: men", "Not married, no kids: women"], rows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>The big drop is between 25 and 35.</strong> Unmarried and childless goes from 62% of men aged 25 to 29 to 25% at 35 to 39. For women it goes from 54% to 17%.</li>
        <li><strong>Women have children earlier than men,</strong> so at every age a smaller share of women than men have never had a child.</li>
        <li><strong>In the early forties, it&rsquo;s about 1 in 5 men and 1 in 9 women.</strong> That&rsquo;s still millions of people, but it&rsquo;s a standard that does a lot of work.</li>
        <li><strong>&ldquo;No kids&rdquo; and &ldquo;not married&rdquo; aren&rsquo;t independent.</strong> People who have never married are much less likely to have children, so the calculator counts the two together for each age rather than multiplying them.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>&ldquo;No kids&rdquo; means the person has never had a child, by age and by whether they have ever married. The women&rsquo;s figures come from the Census Bureau&rsquo;s Current Population Survey (June 2024). The men&rsquo;s come from the Census Bureau&rsquo;s Survey of Income and Program Participation (2014), the most recent it has published on men&rsquo;s fertility, so they are the older of the two. Marital status is from the Current Population Survey, March 2025. <a href="/how-it-works.html">How the odds are calculated</a> has the details.</p>
${cta("Add no kids to the rest of your list.")}`,
  };
  },
};
