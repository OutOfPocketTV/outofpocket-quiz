// Builds the blog from blog-tools/posts/*.js:
//   blog/<slug>.html for every post, blog/index.html (newest first) and the
//   blog entries in sitemap.xml. Run it with `node blog-tools/build.js`.
//
// Each post computes its own tables with the site's engine (calc.js), so a
// post can never disagree with the calculator. Rebuilding is safe: the same
// posts always produce the same pages. How to add a post: README.md.
const fs = require("fs");
const path = require("path");
const { run, runPlace, W } = require("./calc");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "blog");
const SITE = "https://www.outofpocket.tv";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const dateText = (iso) => { const [y, m, d] = iso.split("-").map(Number); return `${MONTHS[m - 1]} ${d}, ${y}`; };

// ---------- formatting ----------
const pct = (p) => (p >= 99.95 ? "100%" : p >= 99.5 ? "over 99%" : p < 0.01 ? "under 0.01%" : p >= 10 ? `${Math.round(p)}%` : p >= 1 ? `${p.toFixed(1)}%` : `${p.toFixed(2)}%`);
// Two significant figures past 100, like the rest of the site ("about 1 in 110").
const oneIn = (p) => { const n = 100 / p; if (n < 1.5) return ""; const m = n < 100 ? Math.round(n) : Number(n.toPrecision(2)); return `about 1 in ${m.toLocaleString("en-US")}`; };
const count = (n) => n >= 1e6 ? `${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)} million` : n >= 1e4 ? `${Math.round(n / 1000).toLocaleString("en-US")},000` : (Math.round(n / 100) * 100).toLocaleString("en-US");
const note = (s) => (s ? ` <span class="odds-note">(${s})</span>` : "");
const cell = (r) => `${pct(r.pct)}${note(r.pct < 30 ? oneIn(r.pct) : "")}`;
const ht = (i) => `${Math.floor(i / 12)}&prime;${i % 12}&Prime;`;
const table = (head, rows) => `<div class="report-table-wrap">
        <table class="report-table">
          <thead><tr>${head.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>
${rows.map((r) => `          <tr>${r.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("\n")}
          </tbody>
        </table>
      </div>`;
const AGES = [[18, 24], [25, 29], [30, 34], [35, 39], [40, 44], [45, 54], [55, 64], [65, 80]];
const ageLabel = ([a, b]) => `${a}&ndash;${b}`;
const NOT_OBESE = ["balanced", "athletic"];

// ---------- layout ----------
const NAV = [
  ["/", "Calculator"], ["/how-it-works.html", "How it works"], ["/height-odds.html", "Height odds"],
  ["/income-odds.html", "Income odds"], ["/blog/", "Blog"], ["/faq.html", "FAQ"], ["/about.html", "About"],
];

function page({ path, title, description, h1, dateLine, body, jsonld, ogType = "article" }) {
  const url = SITE + path;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${description}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="${ogType}" />
<meta property="og:site_name" content="Out Of Pocket TV" />
<meta property="og:title" content="${title}" />
<meta property="og:description" content="${description}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/og-preview.png" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${title}" />
<meta name="twitter:description" content="${description}" />
<meta name="twitter:image" content="${SITE}/og-preview.png" />
<link rel="icon" href="/logo-mark.png" type="image/png" />
<meta name="theme-color" content="#060606" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap" />
<link rel="stylesheet" href="/style.css" />
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-4262567659603132"
     crossorigin="anonymous"></script>

<!-- Google Analytics 4 (Out Of Pocket TV property) -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-BQPW0R8CEJ"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-BQPW0R8CEJ');
</script>
<script type="application/ld+json">
${JSON.stringify(jsonld, null, 2)}
</script>
</head>
<body>

<header class="brand-bar">
  <a class="brand-home" href="/" aria-label="Out Of Pocket TV home">
    <img class="brand-logo" src="/logo-mark.png" alt="Out Of Pocket TV logo" />
    <span class="brand-name">OUT OF POCKET TV</span>
  </a>
</header>

<nav class="site-tabs" aria-label="Site">
  <div class="site-tabs-track">
${NAV.map(([href, label]) => `    <a class="site-tab" href="${href}"${href === "/blog/" ? ' aria-current="page"' : ""}>${label}</a>`).join("\n")}
  </div>
</nav>
<script>
  (function () {
    var track = document.querySelector(".site-tabs-track");
    var tab = track && track.querySelector("[aria-current]");
    if (tab && track.scrollWidth > track.clientWidth) {
      track.scrollLeft = tab.offsetLeft - (track.clientWidth - tab.offsetWidth) / 2;
    }
  })();
</script>

<main class="quiz">
  <article class="card content-page">
    <h1>${h1}</h1>
    <p class="legal-updated">${dateLine}</p>

    <div class="legal-content">
${body}
    </div>
  </article>
</main>

<footer class="site-footer">
  <div>Seen us on the street? Follow Out Of Pocket TV</div>
  <div class="socials">
    <a href="https://instagram.com/OutOfPocket_TV" target="_blank" rel="noopener">Instagram</a>
    <a href="https://tiktok.com/@OuttaPocketTV" target="_blank" rel="noopener">TikTok</a>
    <a href="https://youtube.com/@OutOfPocket_TV" target="_blank" rel="noopener">YouTube</a>
  </div>
  <nav class="site-nav" aria-label="More from Out Of Pocket TV">
${NAV.map(([href, label]) => `    <a href="${href}">${label}</a>`).join("\n")}
  </nav>
  <div class="legal-links">
    <a href="/privacy.html">Privacy Policy</a>
    <a href="/terms.html">Terms of Service</a>
    <a href="/refund-policy.html">Refund Policy</a>
  </div>
</footer>

<script defer src="/_vercel/insights/script.js"></script>
</body>
</html>
`;
}

const ORG = { "@type": "Organization", name: "Out Of Pocket TV", url: SITE + "/" };
const PUBLISHER = { ...ORG, logo: { "@type": "ImageObject", url: SITE + "/logo-mark.png" } };


function cta(text) {
  return `
    <div class="content-cta">
      <p>${text}</p>
      <a class="content-cta-btn" href="/">Try the calculator</a>
    </div>`;
}

// ---------- posts ----------
const helpers = { run, runPlace, W, pct, oneIn, count, note, cell, ht, table, AGES, ageLabel, NOT_OBESE, cta };
const posts = fs.readdirSync(path.join(__dirname, "posts"))
  .filter((f) => /^\d{3}-.+\.js$/.test(f))
  .sort()
  .map((f) => {
    const mod = require(path.join(__dirname, "posts", f));
    if (`${f.slice(4, -3)}` !== mod.slug) throw new Error(`${f}: file name and slug differ`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(mod.date)) throw new Error(`${f}: date must be YYYY-MM-DD`);
    return { slug: mod.slug, date: mod.date, ...mod.build(helpers) };
  });
const seen = new Set();
for (const p of posts) {
  for (const k of ["title", "description", "h1", "summary", "body"]) if (!p[k]) throw new Error(`${p.slug}: missing ${k}`);
  if (seen.has(p.slug)) throw new Error(`duplicate slug ${p.slug}`);
  seen.add(p.slug);
}

// The next three posts, wrapping round, so every post links to newer ones
// and the newest links back to the oldest.
function related(self) {
  const i = posts.findIndex((p) => p.slug === self);
  const others = [1, 2, 3].map((k) => posts[(i + k) % posts.length]).filter((p) => p.slug !== self);
  return `
      <h2>More from the blog</h2>
      <ul>
${[...new Set(others)].map((p) => `        <li><a href="/blog/${p.slug}.html">${p.h1}</a></li>`).join("\n")}
      </ul>`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const p of posts) {
  const url = `/blog/${p.slug}.html`;
  const jsonld = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article", headline: p.h1, description: p.description, image: SITE + "/og-preview.png",
        datePublished: p.date, dateModified: p.date, author: ORG, publisher: PUBLISHER, mainEntityOfPage: SITE + url,
      },
      {
        "@type": "BreadcrumbList", itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: SITE + "/" },
          { "@type": "ListItem", position: 2, name: "Blog", item: SITE + "/blog/" },
          { "@type": "ListItem", position: 3, name: p.h1, item: SITE + url },
        ],
      },
    ],
  };
  fs.writeFileSync(path.join(OUT, p.slug + ".html"), page({
    path: url, title: p.title, description: p.description, h1: p.h1, jsonld,
    dateLine: `Out Of Pocket TV &middot; ${dateText(p.date)}`,
    body: p.body + "\n" + related(p.slug),
  }));
}

// ---------- index ----------
const newestFirst = [...posts].reverse();
fs.writeFileSync(path.join(OUT, "index.html"), page({
  path: "/blog/", ogType: "website",
  title: "Dating Odds Blog: The Real Numbers Behind Dating Standards | Out Of Pocket TV",
  description: "Real numbers on dating standards from Census and CDC data: height, income, age, kids, religion and more, for the U.S. and 198 countries.",
  h1: "The blog",
  dateLine: "The real numbers behind the questions we ask on the street",
  jsonld: {
    "@context": "https://schema.org", "@type": "Blog", name: "Out Of Pocket TV blog", url: SITE + "/blog/", publisher: PUBLISHER,
    blogPost: newestFirst.map((p) => ({ "@type": "BlogPosting", headline: p.h1, url: `${SITE}/blog/${p.slug}.html`, datePublished: p.date })),
  },
  body: `      <p class="content-lede">We ask strangers what they want in a partner. Then we count how many people actually fit. These posts are the numbers behind the questions that come up most, all from the same Census Bureau and CDC data the calculator uses.</p>
${newestFirst.map((p) => `
      <h2><a href="/blog/${p.slug}.html">${p.h1.charAt(0).toUpperCase() + p.h1.slice(1)}</a></h2>
      <p>${p.summary}</p>`).join("\n")}
${cta("Or skip ahead and run your own list.")}`,
}));

// ---------- sitemap ----------
// Blog entries are rewritten every build; everything else is left alone.
const sitemapPath = path.join(ROOT, "sitemap.xml");
let sitemap = fs.readFileSync(sitemapPath, "utf8").replace(/  <url>\n    <loc>https:\/\/www\.outofpocket\.tv\/blog\/[^<]*<\/loc>[\s\S]*?<\/url>\n/g, "");
const entry = (loc, lastmod, freq, prio) => `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${lastmod}</lastmod>\n    <changefreq>${freq}</changefreq>\n    <priority>${prio}</priority>\n  </url>\n`;
const blogEntries = entry(`${SITE}/blog/`, newestFirst[0].date, "weekly", "0.8")
  + posts.map((p) => entry(`${SITE}/blog/${p.slug}.html`, p.date, "monthly", "0.7")).join("");
const anchor = "  <url>\n    <loc>https://www.outofpocket.tv/faq.html</loc>";
if (!sitemap.includes(anchor)) throw new Error("sitemap.xml: FAQ entry not found to insert the blog before");
sitemap = sitemap.replace(anchor, blogEntries + anchor);
fs.writeFileSync(sitemapPath, sitemap);

console.log(`built ${posts.length} posts + index; newest: ${newestFirst[0].slug} (${newestFirst[0].date})`);
