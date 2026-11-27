// Published 2026-11-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "how-many-people-are-bisexual",
  date: "2026-11-27",
  build({ run, pct, count, table, cta }) {
    const AGE_GROUPS = [[18, 24], [25, 29], [30, 34], [35, 44], [45, 54], [55, 64], [65, 80]];
    const share = (targetSex, ageLo, ageHi, o) => run({ targetSex, ageLo, ageHi, selectedOrientations: [o] });
    // "Something else" and "don't know" are kept in the survey's base, so the
    // three named groups don't add to 100%; the rest is shown as its own column.
    const rows = (sex) => AGE_GROUPS.map(([a, b]) => {
      const st = share(sex, a, b, "straight");
      const gl = share(sex, a, b, "gayLesbian");
      const bi = share(sex, a, b, "bisexual");
      return [`${a}&ndash;${b}`, pct(st.pct), pct(gl.pct), `${pct(bi.pct)}<br>${count(bi.matchingCount)}`, pct(100 - st.pct - gl.pct - bi.pct)];
    });
    const head = (gay) => ["Age", "Straight", gay, "Bisexual", "Something else or don&rsquo;t know"];

    return {
      title: "How Many People Are Bisexual? By Age and Sex | Out Of Pocket TV",
      description: "About 7.7 million American adults identify as bisexual: 4.6% of women and 1.5% of men. Among women aged 18 to 24 it's about 1 in 7. By age and sex.",
      h1: "How many people are bisexual?",
      summary: "About 7.7 million American adults identify as bisexual, including about 1 in 7 women aged 18 to 24. By age and sex.",
      body: `      <p class="content-lede">About <strong>7.7 million</strong> American adults identify as bisexual: 4.6% of women and 1.5% of men aged 18 to 80. Among women aged 18 to 24 it&rsquo;s about <strong>1 in 7</strong>.</p>

      <p>Orientation is one of the standards in the calculator, and it changes the pool far more for some ages than others. Here is how Americans describe their orientation, by age and sex, from the CDC&rsquo;s national health survey.</p>

      <h2>Women</h2>
      <p>Share of U.S. women in each age group who describe themselves as each orientation, and the number who say bisexual:</p>
      ${table(head("Lesbian"), rows("women"))}

      <h2>Men</h2>
      <p>The same for U.S. men:</p>
      ${table(head("Gay"), rows("men"))}

      <h2>What stands out</h2>
      <ul>
        <li><strong>Among women, bisexual is the most common answer after straight.</strong> About 4.6% of women say bisexual against 1.6% who say lesbian, nearly three times as many. That holds at every age under 55.</li>
        <li><strong>Among men it&rsquo;s the other way round, except the youngest.</strong> Overall 2.5% of men say gay and 1.5% bisexual. Only among men aged 18 to 24 is bisexual the more common answer, at 4.7% against 2.7%.</li>
        <li><strong>The younger the group, the more people say bisexual.</strong> It goes from 14% of women aged 18 to 24 to 0.3% of women 65 and over. A single survey can&rsquo;t say whether that is a difference between generations or something that changes as people age.</li>
        <li><strong>So a &ldquo;straight&rdquo; standard means different things at different ages.</strong> It keeps about 3 in 4 women aged 18 to 24, but 98% of women 65 and over.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Orientation comes from the CDC&rsquo;s National Health Interview Survey (2024, about 32,600 adults), in which people describe their own orientation. Shares are of everyone who answered the question; refusals are left out, and the answers &ldquo;something else&rdquo; and &ldquo;don&rsquo;t know&rdquo; are kept in, which is why the three named groups don&rsquo;t add up to 100%. The calculator uses these figures for each age group and sex, applied on top of the Census counts for the number of people. Self-description in a survey isn&rsquo;t the same as attraction or behavior, and some people won&rsquo;t tell an interviewer, so treat these as how many people say so. See <a href="/how-it-works.html">how the odds are calculated</a> for every source.</p>
${cta("Set the orientation you&rsquo;re looking for and see how it changes your pool.")}`,
    };
  },
};
