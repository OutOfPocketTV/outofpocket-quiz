// Published 2026-11-25. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "best-states-to-find-a-man-who-makes-six-figures",
  date: "2026-11-25",
  build({ run, runPlace, W, pct, count, cell, table, cta }) {
    const S = W.QuizUSStates;
    const states = Object.keys(S.STATES).map((code) => ({
      code,
      name: S.getStateMeta(code).name,
      six: runPlace(code, { minIncome: 100000 }),
      two: runPlace(code, { minIncome: 200000 }),
    }));
    const byShare = [...states].sort((a, b) => b.six.pct - a.six.pct || b.six.matchingCount - a.six.matchingCount);
    const byCount = [...states].sort((a, b) => b.six.matchingCount - a.six.matchingCount);
    const us = run({ minIncome: 100000 });
    const us200 = run({ minIncome: 200000 });

    // States with the same rounded median income come out exactly tied, so
    // they share a rank ("8=") rather than being ordered by noise.
    const key = (s) => s.six.pct.toFixed(1);
    const rankOf = (s) => {
      const rank = 1 + byShare.filter((o) => key(o) !== key(s) && o.six.pct > s.six.pct).length;
      const tied = byShare.filter((o) => key(o) === key(s)).length > 1;
      return tied ? `${rank}=` : `${rank}`;
    };
    const rankRows = byShare.map((s) => [rankOf(s), s.name, cell(s.six), pct(s.two.pct), count(s.six.matchingCount)]);
    rankRows.push(["", "<strong>United States</strong>", cell(us), pct(us200.pct), count(us.matchingCount)]);
    const countRows = byCount.slice(0, 6).map((s) => [s.name, count(s.six.matchingCount), pct(s.six.pct)]);

    return {
      title: "Best States to Find a Man Who Makes Six Figures | Out Of Pocket TV",
      description: "In Massachusetts almost 1 in 3 men earns $100,000 or more, the most of any state. In Mississippi it's about 1 in 7. All 50 states and DC, ranked.",
      h1: "The best states to find a man who makes six figures",
      summary: "All 50 states and DC ranked by the share of men earning $100,000 or more, from Massachusetts to Mississippi.",
      body: `      <p class="content-lede">In Massachusetts, almost <strong>1 in 3</strong> men earns $100,000 or more a year, the highest share of any state. Washington, DC is higher still, at about 35%. At the other end, in Mississippi and West Virginia, it&rsquo;s about <strong>1 in 7</strong>.</p>

      <p>We ranked <a href="/blog/best-cities-to-find-a-man-who-makes-100k.html">the biggest metro areas</a> already. Here are all 50 states and DC, ranked by the share of men aged 18 to 80 who earn six figures.</p>

      <h2>All 50 states and DC, ranked</h2>
      <p>Share of men earning $100,000 or more and $200,000 or more, and the number of six-figure men, in each state. An = marks a tie:</p>
      ${table(["", "State", "$100k+", "$200k+", "Men earning $100k+"], rankRows)}

      <h2>Where the most six-figure men live</h2>
      <p>Big states win on numbers even when their share is ordinary:</p>
      ${table(["State", "Men earning $100k+", "Share"], countRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>The Northeast corridor leads.</strong> Massachusetts is first among states at about 32%, with Connecticut, Maryland and New Jersey tied just behind at about 30%. California and New York come next, at about 28%.</li>
        <li><strong>The top state has more than twice the share of the bottom.</strong> About 32% of men in Massachusetts earn six figures, against about 15% in Mississippi and West Virginia.</li>
        <li><strong>At $200,000 the gap is wider still.</strong> About 1 man in 10 earns $200,000 or more in Massachusetts, against about 1 in 30 in Mississippi.</li>
        <li><strong>California has the most six-figure men by far.</strong> Almost 4 million, followed by Texas (2.4 million), New York (2.0 million) and Florida (1.8 million).</li>
        <li><strong>A paycheck isn&rsquo;t the same everywhere.</strong> $100,000 goes a lot further in Mississippi than in Massachusetts, so a six-figure minimum is a stricter standard in some states than others.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>The national figures are a real count from the Census Bureau&rsquo;s Current Population Survey (March 2025). For each state, the calculator adjusts that national count by how the state&rsquo;s median personal income (from the Census Bureau&rsquo;s American Community Survey, rounded) compares with the national median, so the state figures are estimates, and states with the same median come out exactly tied. This ranks all men, married or not: state marriage rates are only available as a few broad patterns, too rough to rank on. For unmarried men nationally, see <a href="/blog/how-many-single-men-make-100k.html">how many single men make $100k</a>.</p>
${cta("Pick your state and add an income minimum to the rest of your list.")}`,
    };
  },
};
