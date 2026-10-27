# Blog tools

The blog at `/blog/` is built from the files in `blog-tools/posts/`. Every
number in it comes from the site's own calculator code, loaded into Node by
`calc.js`, so a post can never disagree with the calculator.

```
node blog-tools/build.js   # writes blog/*.html, blog/index.html, sitemap.xml blog entries
node blog-tools/check.js   # must print ALL CHECKS PASSED before anything is merged
```

This folder is not deployed (see `.vercelignore`).

## Adding a post

1. Pick the first topic in the backlog below that is not ticked, unless a
   seasonal one fits today's date better. Skip a topic (tick it with
   "skipped: reason") if the data can't honestly answer it.
2. Explore the numbers first with a scratch script:
   ```js
   const { run, runPlace, W } = require("./blog-tools/calc");
   run({ targetSex: "women", ageLo: 25, ageHi: 35, minIncome: 100000, excludeMarried: true });
   run({ minHeight: 72 }, "NL");          // a country (codes: W.QuizGlobalStats.COUNTRIES)
   runPlace("TX", { minIncome: 100000 }); // a state or metro (W.QuizUSStates.STATES, W.QuizUSMetros.METROS)
   ```
   Filters: `targetSex` (men/women), `ageLo`/`ageHi` (18 to 80),
   `minHeight` (inches), `minIncome` (dollars), `excludeMarried`,
   `excludeKids`, `excludeGambles`, `selectedRaces` (white, black, asian,
   hispanic), `selectedOrientations` (straight, gayLesbian, bisexual),
   `selectedReligions` (christian, jewish, muslim, hindu, buddhist, none),
   `selectedBodyTypes` (balanced, athletic, obese). Each result has `pct` and
   `matchingCount`.
3. Copy an existing post to `posts/NNN-slug.js` (next number, slug in the
   file name and in `slug`, `date` = today in New York, `YYYY-MM-DD`). Build
   tables with the helpers (`table`, `cell`, `pct`, `count`, `oneIn`, `ht`,
   `AGES`, `ageLabel`, `cta`) so they are computed, never typed.
4. `node blog-tools/build.js && node blog-tools/check.js`. Read the built
   page's text and compare every number in your prose against the engine
   output.
5. Tick the topic below with the slug and date.

## Writing rules

- **Every number comes from the engine or from a page already on the site.**
  Never estimate, round from memory or add an outside statistic you can't
  source. If the prose says "about 1 in 27", the engine said 3.7%.
- Voice: plain, direct and a little playful, like the existing posts and
  `how-it-works.html`. Short sentences. Answer the question in the first
  paragraph (the `content-lede`), with the headline number in `<strong>`.
- **No em dashes**, anywhere. Use commas, colons or a new sentence. En dashes
  (`&ndash;`) only for ranges like 25&ndash;35.
- Structure: lede, a computed table or two, "What stands out" (3 to 5
  bullets), "How these numbers are worked out" (sources and honest caveats),
  then `cta(...)`. Link to one or two existing pages or posts. 500 to 1,100
  words.
- Title: the question people type into Google, then ` | Out Of Pocket TV`,
  under 110 characters. Description: 120 to 160 characters, with the answer
  in it. Each post targets a different search question from every other
  post.
- Caveats to state whenever they apply: "not married" includes divorced,
  widowed and separated, and isn't the same as single. Height is applied on
  top of income and marriage as if unrelated. Country figures are estimates
  from national averages (leave out the 21 `tier: "regional"` countries from
  rankings). State and metro figures are rough: height is the national
  figure everywhere, and marriage and age come from three broad patterns,
  so only rank places on income, obesity or race, which are published per
  place.
- Respect: never call anyone delusional or mock a group. Race, religion and
  orientation posts stay neutral and factual: pool sizes, not judgements.
  No real people, no invented quotes or street-interview anecdotes.
- Only touch `blog-tools/posts/`, this README's backlog, and what
  `build.js` writes (`blog/`, the blog entries in `sitemap.xml`). Fix an
  older post only to correct a mistake.

## Topic backlog

Seasonal: a cuffing-season post fits October to December, Valentine's Day
the first two weeks of February, New Year's resolutions early January.

Done:
- [x] How many men are 6 feet tall and make six figures? (`6-foot-6-figures`, 2026-10-27)
- [x] What are the odds of finding your perfect match? (`odds-of-finding-your-perfect-match`, 2026-10-27)
- [x] Are my standards too high? Every standard ranked (`are-my-standards-too-high`, 2026-10-27)
- [x] How many single people are there in the U.S.? (`how-many-single-people-in-the-us`, 2026-10-27)
- [x] Where are the tall men? Countries ranked (`countries-with-the-tallest-men`, 2026-10-27)
- [x] How many single people have no kids? (`single-with-no-kids`, 2026-10-27)
- [x] Cuffing season: how many single people are your age? (`single-people-your-age`, 2026-10-27)

To do, roughly in order:
- [ ] How many women make six figures? ($100k+ women by age, and single)
- [ ] How many men are 6′5″ or taller? (and single, and with $250k: the "6′5″, trust fund" meme, honest that eyes and jobs aren't in the data)
- [ ] Best U.S. cities to find a man who makes $100k (metro ranking on income only)
- [ ] Countries with the most single people (marriage share, `tier: "full"` only)
- [ ] What percentage of men are under 5′8″? (short kings: share below each height by age)
- [ ] How many single men make $200,000 or more? (by age; $150k, $200k, $250k, $500k)
- [ ] At what age do most people get married? (not-married share by single year of age, men vs women)
- [ ] The age where single men outnumber single women (unmarried men per 100 unmarried women by single year of age)
- [ ] Best countries to find a man earning $100k
- [ ] Do married men earn more? ($100k+ among all men vs unmarried men, by age)
- [ ] What percentage of women are 5′9″ or taller, and how many are single?
- [ ] Best states to find a man who makes six figures (state income)
- [ ] How many people are bisexual? (by age and sex; the big gap among women 18 to 24)
- [ ] How many single gay men are there in the U.S.? (and single lesbians; by age)
- [ ] Dating within your religion: how big is the pool? (single Christian, Jewish, Muslim, Hindu, Buddhist and non-religious men and women, 25 to 35)
- [ ] How many people gamble? (men vs women; what "doesn't gamble" does to a list)
- [ ] What percentage of people are obese, by age? (and what "not obese" does to a list)
- [ ] How many men are athletic? (and why "athletic" is the least certain figure)
- [ ] Countries with the most men per woman (and the most women per man)
- [ ] Dating within your race: how big is each pool? (single White, Black, Hispanic and Asian men and women, 25 to 35; neutral)
- [ ] How many men over 35 have never been married and have no kids?
- [ ] Age gaps by the numbers: single women 10 years younger vs single men your age
- [ ] What makes a man top 1%? (combinations of height, income and single that land near 1%)
- [ ] What makes a woman top 1%? (the same for women)
- [ ] The best countries for a 6 foot, 6 figures man
- [ ] States with the lowest obesity rates (state obesity)
- [ ] The most diverse U.S. cities for dating (metro race shares)
- [ ] Countries where the most people have no kids
- [ ] How many single women under 30 have no kids and aren't obese? (a common men's list, step by step)
- [ ] How many single men under 30 make $75k? (the young-earner pool)
- [ ] Best countries in Europe for tall men (continent ranking)
- [ ] Best countries in Latin America for the dating pool (continent ranking on the U.S.-style list)
- [ ] Best countries in Asia for tall men and women (continent ranking)
- [ ] How much does each inch of height cost? (pool lost per inch, 5′8″ to 6′4″)
- [ ] How much does each $10k of income cost? (pool lost per income step)
- [ ] How many men are 6 feet tall, by age? (younger men are taller)
- [ ] How many non-religious single people are there under 30?
- [ ] How many single parents are there? (unmarried and has had a child, by age)
- [ ] Countries with the lowest obesity
- [ ] Best U.S. cities to find a woman who makes six figures
- [ ] How rare is a man who doesn't gamble and makes $100k? (gambling plus one other standard)
- [ ] Valentine's Day: how many single people there are tonight (seasonal, February)
- [ ] New year, new standards: the one change that grows your pool most (seasonal, January)
