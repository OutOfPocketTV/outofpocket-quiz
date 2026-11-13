// Published 2026-11-13. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "best-cities-to-find-a-man-who-makes-100k",
  date: "2026-11-13",
  build({ run, runPlace, W, pct, count, cell, table, cta }) {
    const M = W.QuizUSMetros;
    const metros = Object.keys(M.METROS).map((code) => ({
      code,
      name: M.getMetroMeta(code).name,
      six: runPlace(code, { minIncome: 100000 }),
      two: runPlace(code, { minIncome: 200000 }),
    }));
    const byShare = [...metros].sort((a, b) => b.six.pct - a.six.pct || b.six.matchingCount - a.six.matchingCount);
    const byCount = [...metros].sort((a, b) => b.six.matchingCount - a.six.matchingCount);
    const us = run({ minIncome: 100000 });
    const us200 = run({ minIncome: 200000 });

    // Metros with the same median income come out exactly tied, so they
    // share a rank ("27=") rather than being ordered by noise.
    const key = (m) => m.six.pct.toFixed(1);
    const rankOf = (m) => {
      const rank = 1 + byShare.filter((o) => key(o) !== key(m) && o.six.pct > m.six.pct).length;
      const tied = byShare.filter((o) => key(o) === key(m)).length > 1;
      return tied ? `${rank}=` : `${rank}`;
    };
    const rankRows = byShare.map((m) => [rankOf(m), m.name, cell(m.six), pct(m.two.pct), count(m.six.matchingCount)]);
    rankRows.push(["", "<strong>United States</strong>", cell(us), pct(us200.pct), count(us.matchingCount)]);
    const countRows = byCount.slice(0, 6).map((m) => [m.name, count(m.six.matchingCount), pct(m.six.pct)]);

    return {
      title: "Best U.S. Cities to Find a Man Who Makes $100k | Out Of Pocket TV",
      description: "In the San Jose metro about 2 in 5 men earn $100,000 or more, against 1 in 4 nationally. All 40 of the biggest U.S. metros ranked by six-figure men.",
      h1: "The best U.S. cities to find a man who makes $100k",
      summary: "The 40 biggest U.S. metro areas ranked by the share of men earning six figures, from San Jose to San Antonio.",
      body: `      <p class="content-lede">In the San Jose metro, about <strong>2 in 5</strong> men earn $100,000 or more a year, against about 1 in 4 across the U.S. San Francisco, Washington and New York round out the top four. By sheer numbers, though, nowhere comes close to New York, with about <strong>2.2 million</strong> six-figure men.</p>

      <p>Where you live makes a big difference to an income standard. Here are the 40 biggest U.S. metro areas, ranked by the share of men aged 18 to 80 who earn $100,000 or more.</p>

      <h2>All 40 metros, ranked</h2>
      <p>Share of men earning $100,000 or more and $200,000 or more, and the number of six-figure men, in each metro area. An = marks a tie:</p>
      ${table(["", "Metro area", "$100k+", "$200k+", "Men earning $100k+"], rankRows)}

      <h2>Where the most six-figure men live</h2>
      <p>A high share in a smaller metro can still be fewer people. By number of men earning $100,000 or more:</p>
      ${table(["Metro area", "Men earning $100k+", "Share"], countRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Silicon Valley is in a league of its own.</strong> About 40% of men in the San Jose metro and 37% in the San Francisco metro earn six figures. Around San Jose, about 1 man in 7 earns $200,000 or more, more than twice the national share.</li>
        <li><strong>Washington, New York, Boston and Seattle come next.</strong> Each is around 30% to 33%, so roughly 1 man in 3.</li>
        <li><strong>New York wins on numbers.</strong> About 2.2 million men there earn six figures, nearly twice as many as in the Los Angeles metro, the next biggest.</li>
        <li><strong>Even the bottom of the list isn&rsquo;t far below the national rate.</strong> San Antonio and Cleveland come last at around 19% to 20%, about 1 man in 5, against 23.6% nationally.</li>
        <li><strong>A paycheck isn&rsquo;t the same everywhere.</strong> $100,000 goes a lot further in Cleveland than in San Jose, so a six-figure minimum is a stricter standard in some places than others.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Metro areas are the Census Bureau&rsquo;s own Metropolitan Statistical Areas, which take in the suburbs, not just the city itself. The national figures are a real count from the Census Bureau&rsquo;s Current Population Survey (March 2025). For each metro, the calculator adjusts that national count by how the metro&rsquo;s median personal income (from the Census Bureau&rsquo;s American Community Survey, rounded) compares with the national median, so the metro figures are estimates. Metros with the same median come out exactly tied. This ranks all men, married or not: marriage rates are only available for metros as a few broad patterns, too rough to rank cities on. For unmarried men nationally, see <a href="/blog/how-many-single-men-make-100k.html">how many single men make $100k</a>.</p>
${cta("Pick your city and add an income minimum to the rest of your list.")}`,
    };
  },
};
