// Published 2026-10-27. See blog-tools/README.md for how posts work.
module.exports = {
  slug: "odds-of-finding-your-perfect-match",
  date: "2026-10-27",
  build({ run, W, pct, oneIn, count, note, cell, ht, table, AGES, ageLabel, NOT_OBESE, cta }) {
  const stepTable = (base, steps) => {
    let acc = { ...base }, prev = run(acc);
    const rows = [[steps[0][0], "100%", count(prev.matchingCount), "&ndash;"]];
    for (const [label, f] of steps.slice(1)) {
      acc = { ...acc, ...f };
      const r = run(acc);
      rows.push([label, cell(r), count(r.matchingCount), `&minus;${Math.round((1 - r.pct / prev.pct) * 100)}%`]);
      prev = r;
    }
    return { html: table(["Standard added", "Still matching", "People in the U.S.", "Cut by this step"], rows), last: prev };
  };
  const him = stepTable({ ageLo: 28, ageHi: 38 }, [
    ["A man aged 28&ndash;38", {}],
    ["Not married", { excludeMarried: true }],
    ["6&prime;0&Prime; or taller", { minHeight: 72 }],
    ["Earns $100,000+", { minIncome: 100000 }],
    ["Has never had a child", { excludeKids: true }],
    ["Not obese", { selectedBodyTypes: NOT_OBESE }],
    ["Straight", { selectedOrientations: ["straight"] }],
    ["Doesn&rsquo;t gamble", { excludeGambles: true }],
  ]);
  const her = stepTable({ targetSex: "women", ageLo: 22, ageHi: 30 }, [
    ["A woman aged 22&ndash;30", {}],
    ["Not married", { excludeMarried: true }],
    ["Has never had a child", { excludeKids: true }],
    ["Not obese", { selectedBodyTypes: NOT_OBESE }],
    ["5&prime;5&Prime; or taller", { minHeight: 65 }],
    ["Straight", { selectedOrientations: ["straight"] }],
    ["Doesn&rsquo;t gamble", { excludeGambles: true }],
  ]);

  return {
    title: "What Are the Odds of Finding Your Perfect Match? We Did the Math | Out Of Pocket TV",
    description: "What are the odds of finding your perfect match? We add common dating standards one at a time, using Census and CDC data, to show how fast the pool shrinks.",
    h1: "What are the odds of finding your perfect match?",
    summary: "We add common dating standards one at a time and watch the pool shrink, for a man’s list and a woman’s list.",
    body: `      <p class="content-lede">Your &ldquo;perfect match&rdquo; is really just someone who meets every standard on your list, and that&rsquo;s something we can count. A typical list for a man in his thirties leaves about <strong>${pct(him.last.pct)}</strong> of men, roughly ${count(him.last.matchingCount)} people in the whole country. A typical list for a woman in her twenties leaves about <strong>${pct(her.last.pct)}</strong>.</p>

      <p>People have tried this before. In 2010 an economics student, Peter Backus, borrowed the Drake equation, which astronomers use to estimate how many alien civilizations might exist, and worked out that there were only 26 women in London he might plausibly date. He was guessing at most of his inputs. We don&rsquo;t have to: the Census Bureau and the CDC publish the real figures.</p>

      <h2>A list for him</h2>
      <p>Here&rsquo;s a list we hear on the street all the time, added one standard at a time:</p>
      ${him.html}
      <p>Only a few of these are unusual on their own: height, income and, more surprisingly, gambling, since about two-thirds of men placed a bet in the past year. But there are seven standards, and they compound: the list ends at ${oneIn(him.last.pct)}.</p>

      <h2>A list for her</h2>
      <p>And a typical list in the other direction:</p>
      ${her.html}
      <p>This one ends at ${oneIn(her.last.pct)}, around ${count(her.last.matchingCount)} women. It&rsquo;s much less severe than the first list, mostly because it has no income standard. Its height minimum still does the most damage: 5&prime;5&Prime; is two inches above the average American woman and rules out more than 60% of the women still left.</p>

      <h2>What the math says about &ldquo;the one&rdquo;</h2>
      <ul>
        <li><strong>Standards multiply, they don&rsquo;t add.</strong> Four standards that each keep half of people leave one in sixteen. That&rsquo;s why short lists can still produce tiny numbers.</li>
        <li><strong>The order doesn&rsquo;t matter.</strong> You end in the same place whichever standard you apply first. What matters is which ones cut the most, and for men&rsquo;s lists that&rsquo;s nearly always height and income.</li>
        <li><strong>Small isn&rsquo;t zero.</strong> Even 0.2% of men in their thirties is tens of thousands of people. The odds of someone existing are rarely the problem; meeting them is.</li>
        <li><strong>This counts people, not chemistry.</strong> Nothing here knows who lives near you, who&rsquo;s looking, or who&rsquo;d be into you. Those cut the pool further, which is the honest reason most people don&rsquo;t end up with every box ticked.</li>
      </ul>

      <h2>How these numbers are worked out</h2>
      <p>Age, marital status and income are counted together from the Census Bureau&rsquo;s Current Population Survey (March 2025). Height and build come from the CDC&rsquo;s measured health survey (NHANES 2021&ndash;2023), children from Census surveys, orientation from the CDC&rsquo;s National Health Interview Survey (2024) and gambling from a 2023 Harris Poll for NerdWallet. <a href="/how-it-works.html">How the odds are calculated</a> lists every source and where the estimates can be off.</p>
${cta("Build your own list and see where it lands.")}`,
  };
  },
};
