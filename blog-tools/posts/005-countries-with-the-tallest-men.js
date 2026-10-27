// Published 2026-10-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "countries-with-the-tallest-men",
  date: "2026-10-27",
  build({ run, W, pct, oneIn, count, note, cell, ht, table, AGES, ageLabel, NOT_OBESE, cta }) {
  const G = W.QuizGlobalStats;
  const codes = Object.keys(G.COUNTRIES).filter((c) => G.getCountryMeta(c).tier !== "regional");
  const rank = (f) => codes.map((c) => ({ c, name: G.getCountryMeta(c).name, r: run(f, c) })).sort((a, b) => b.r.pct - a.r.pct);
  const men = rank({ minHeight: 72 });
  const women = rank({ targetSex: "women", minHeight: 68 });
  const top = (list, n) => table(["", "Country", "Share", "People"], list.slice(0, n).map((x, i) => [`${i + 1}`, x.name, cell(x.r), count(x.r.matchingCount)]));
  const byCount = (list) => table(["Country", "Share", "People"], [...list].sort((a, b) => b.r.matchingCount - a.r.matchingCount).slice(0, 6).map((x) => [x.name, cell(x.r), count(x.r.matchingCount)]));
  const usM = men.findIndex((x) => x.c === "US") + 1, usW = women.findIndex((x) => x.c === "US") + 1;
  const usMen = men[usM - 1].r;

  return {
    title: "Where Are the Tall Men? Countries Where the Most Men Are 6 Feet or Taller | Out Of Pocket TV",
    description: "In Montenegro, Bosnia and the Netherlands nearly half of men are 6 feet or taller. In the U.S. it is about 1 in 6. The countries with the most tall men and tall women.",
    h1: "Where are the tall men? Countries ranked by share of men 6 feet or taller",
    summary: "In parts of the Balkans and the Netherlands nearly half of men are 6 feet or taller. In the U.S. it’s 1 in 6.",
    body: `      <p class="content-lede">In the U.S., about <strong>1 man in 6</strong> is 6 feet or taller. In Montenegro, Bosnia and Herzegovina and the Netherlands, it&rsquo;s about <strong>half</strong>. If height is high on your list, where you look matters as much as what you ask for.</p>

      <h2>Most men 6 feet or taller</h2>
      <p>Share of adult men (18 to 80) who are 6&prime;0&Prime; or taller:</p>
      ${top(men, 15)}
      <p>The United States comes ${usM}th of the ${codes.length} countries with their own data, at ${pct(usMen.pct)}.</p>

      <h2>Most women 5&prime;8&Prime; or taller</h2>
      <p>The same countries lead for women. Share of adult women who are 5&prime;8&Prime; or taller:</p>
      ${top(women, 10)}
      <p>The U.S. comes ${usW}th, at ${pct(women[usW - 1].r.pct)}.</p>

      <h2>Where the most tall men actually live</h2>
      <p>A high share in a small country is still not many people. By sheer numbers, the big countries win:</p>
      ${byCount(men)}

      <h2>What stands out</h2>
      <ul>
        <li><strong>The tallest people in the world are in Europe.</strong> The Dinaric Alps (Montenegro, Bosnia and Herzegovina, Croatia, Serbia), the Netherlands, the Baltics, Scandinavia and central Europe fill the top 14. Australia, at 15th, is the first country outside Europe.</li>
        <li><strong>A small difference in average height is a big difference at 6 feet.</strong> The average Dutch man is less than 3 inches taller than the average American man, yet a Dutch man is about three times as likely to be 6 feet or taller.</li>
        <li><strong>Tall women are rare almost everywhere.</strong> Outside Montenegro, even the tallest countries have only around 1 woman in 4 or 5 who is 5&prime;8&Prime; or taller. In the U.S. it&rsquo;s about 1 in 20.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>For the U.S., height comes from the CDC&rsquo;s measured health survey (NHANES 2021&ndash;2023). For other countries, the calculator uses each country&rsquo;s published average height and spread for men and women and fits a bell curve, so these are estimates rather than counts, and countries close together in the table are effectively tied. The ${Object.keys(G.COUNTRIES).length - codes.length} countries where only regional estimates exist are left out. The Global Dream Partner Report runs your full list, not just height, across all 198 countries.</p>
      <p>For the U.S. inch by inch, see <a href="/height-odds.html">height odds</a>.</p>
${cta("See which country gives your whole list the best odds.")}`,
  };
  },
};
