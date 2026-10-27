// Published 2026-10-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "single-people-your-age",
  date: "2026-10-27",
  build({ run, pct, count, table, cta }) {
    const single = (targetSex, ageLo, ageHi) => run({ targetSex, ageLo, ageHi, excludeMarried: true });
    // Three years either side of an age, kept inside the calculator's 18 to 80.
    const around = (age) => [Math.max(18, age - 3), Math.min(80, age + 3)];

    const windowRows = [20, 22, 25, 28, 30, 32, 35, 38, 40, 45, 50, 55, 60, 65, 70, 75].map((age) => {
      const [lo, hi] = around(age);
      const m = single("men", lo, hi);
      const w = single("women", lo, hi);
      return [`${age} <span class="odds-note">(${lo}&ndash;${hi})</span>`, count(m.matchingCount), count(w.matchingCount), `${Math.round((m.matchingCount / w.matchingCount) * 100)}`];
    });

    const exactRows = [20, 25, 30, 35, 40, 50, 60, 70].map((age) => {
      const m = single("men", age, age);
      const w = single("women", age, age);
      return [`${age}`, `${pct(m.pct)}<br>${count(m.matchingCount)}`, `${pct(w.pct)}<br>${count(w.matchingCount)}`];
    });

    return {
      title: "Cuffing Season: How Many Single People Are There Your Age? | Out Of Pocket TV",
      description: "At 30 there are about 10.2 million unmarried men and 8.7 million unmarried women within three years of your age. The single pool for every age, men and women.",
      h1: "Cuffing season: how many single people are your age?",
      summary: "The single pool within three years of your age, for men and women, and the age where the balance flips.",
      body: `      <p class="content-lede">If you&rsquo;re 30, there are about <strong>10.2 million unmarried men</strong> and <strong>8.7 million unmarried women</strong> in the U.S. within three years of your age. That pool shrinks every year through your thirties, and somewhere in your mid-forties the balance between men and women flips.</p>

      <p>It&rsquo;s cuffing season, the stretch from October to February when people supposedly pair up before the holidays. So here is the one number most people actually want: how many single people are around my age?</p>

      <h2>Your age, give or take three years</h2>
      <p>Unmarried U.S. adults within three years either side of each age, and how many unmarried men there are for every 100 unmarried women:</p>
      ${table(["Your age", "Single men", "Single women", "Men per 100 women"], windowRows)}

      <h2>Exactly your age</h2>
      <p>Share and number of U.S. adults at each exact age who aren&rsquo;t married:</p>
      ${table(["Age", "Men", "Women"], exactRows)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Most women are married by 32, and most men by 34.</strong> Before that, the unmarried are the majority at every age.</li>
        <li><strong>From 25 to 35, single men outnumber single women.</strong> Women marry a little younger, so there are 110 to 120 single men for every 100 single women in that range, the most around 32.</li>
        <li><strong>The mid-forties are close to even.</strong> At 45 it&rsquo;s about 99 single men for every 100 single women.</li>
        <li><strong>From 50 on, single women outnumber single men, and the gap widens with age.</strong> Women live longer and are more often widowed, so there are about 89 single men per 100 single women at 50, 80 at 60, 62 at 70 and 55 at 75.</li>
        <li><strong>Even at 40, the pool is big.</strong> There are still about 6.2 million single men and 5.9 million single women within three years of a 40-year-old. Cuffing season is not a numbers problem.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Counted from the individual records of the Census Bureau&rsquo;s Current Population Survey, March 2025: about 108,000 adults, weighted to represent the U.S. population. &ldquo;Not married&rdquo; means never married, divorced, widowed or separated, so it includes people who are dating, engaged or living with a partner, and isn&rsquo;t the same as single. Figures for a single year of age rest on fewer survey records than the three-year windows, so the windows are the steadier guide. The calculator covers ages 18 to 80. For the same data in broader age groups, see <a href="/blog/how-many-single-people-in-the-us.html">how many single people there are in the U.S.</a></p>
${cta("See how many of the singles your age match the rest of your list.")}`,
    };
  },
};
