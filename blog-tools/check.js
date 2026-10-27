// Everything a post must pass before it is merged. Scheduled runs publish
// with nobody reading first, so this is the reader: run it after build.js
// and merge only on "ALL CHECKS PASSED".
//
//   node blog-tools/check.js
//
// Exits non-zero, listing every problem, if anything fails.
const fs = require("fs");
const path = require("path");
const http = require("http");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const BLOG = path.join(ROOT, "blog");
const problems = [];
const fail = (msg) => problems.push(msg);

// 1. The build is reproducible: building again changes nothing.
const snapshot = () => Object.fromEntries(
  [...fs.readdirSync(BLOG).map((f) => path.join(BLOG, f)), path.join(ROOT, "sitemap.xml")]
    .map((f) => [f, fs.readFileSync(f, "utf8")]),
);
function build() {
  try {
    execFileSync("node", [path.join(__dirname, "build.js")], { stdio: ["ignore", "ignore", "pipe"] });
  } catch (e) {
    console.error("BUILD FAILED:\n" + String(e.stderr || e.message).trim());
    process.exit(1);
  }
}
build();
const first = snapshot();
build();
const second = snapshot();
for (const f of Object.keys(second)) if (first[f] !== second[f]) fail(`${path.relative(ROOT, f)} changes between two builds`);

// 2. Every page, read as text.
const pages = fs.readdirSync(BLOG).filter((f) => f.endsWith(".html"));
const postFiles = fs.readdirSync(path.join(__dirname, "posts")).filter((f) => f.endsWith(".js"));
const sitemap = fs.readFileSync(path.join(ROOT, "sitemap.xml"), "utf8");

for (const f of postFiles) {
  if (fs.readFileSync(path.join(__dirname, "posts", f), "utf8").includes("—")) fail(`posts/${f}: contains an em dash (the site uses none)`);
}

for (const f of pages) {
  const html = fs.readFileSync(path.join(BLOG, f), "utf8");
  const where = `blog/${f}`;
  const text = html.replace(/<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");

  if (html.includes("—") || html.includes("&mdash;")) fail(`${where}: contains an em dash`);
  for (const bad of ["NaN", "undefined", "Infinity", "[object Object]", "about about", "${"]) {
    if (text.includes(bad)) fail(`${where}: page text contains "${bad}"`);
  }
  if ((html.match(/<h1>/g) || []).length !== 1) fail(`${where}: needs exactly one <h1>`);

  const title = (html.match(/<title>([^<]*)<\/title>/) || [])[1] || "";
  if (!title.endsWith(" | Out Of Pocket TV")) fail(`${where}: title should end with " | Out Of Pocket TV"`);
  if (title.length > 110) fail(`${where}: title is ${title.length} characters (keep it under 110)`);
  const desc = (html.match(/<meta name="description" content="([^"]*)"/) || [])[1] || "";
  if (desc.length < 70 || desc.length > 170) fail(`${where}: description is ${desc.length} characters (aim for 120 to 160)`);

  for (const block of html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g) || []) {
    try { JSON.parse(block.replace(/<\/?script[^>]*>/g, "")); } catch (e) { fail(`${where}: structured data is not valid JSON`); }
  }

  // Internal links must point at a file that exists.
  for (const [, , href] of html.matchAll(/href=(["'])(\/[^"'#?]*)\1/g)) {
    if (href.startsWith("/_vercel/") || href === "/live" || href === "/tip" || href === "/donate") continue;
    const file = href === "/" ? "index.html" : href.endsWith("/") ? href.slice(1) + "index.html" : href.slice(1);
    if (!fs.existsSync(path.join(ROOT, file))) fail(`${where}: broken link ${href}`);
  }

  const loc = f === "index.html" ? "https://www.outofpocket.tv/blog/" : `https://www.outofpocket.tv/blog/${f}`;
  if (!sitemap.includes(`<loc>${loc}</loc>`)) fail(`${where}: missing from sitemap.xml`);
}
if ((sitemap.match(/<url>/g) || []).length !== (sitemap.match(/<\/url>/g) || []).length) fail("sitemap.xml: unbalanced <url> tags");
if (pages.length !== postFiles.length + 1) fail(`blog/ has ${pages.length} pages but there are ${postFiles.length} posts (+ index)`);

// 3. Every page renders at phone width without errors or sideways scrolling.
async function render() {
  let chromium;
  try { ({ chromium } = require("playwright")); } catch (e) { fail("playwright is not available, so pages could not be rendered"); return; }
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".png": "image/png" };
  const server = http.createServer((req, res) => {
    let p = decodeURIComponent(req.url.split("?")[0]);
    if (p.endsWith("/")) p += "index.html";
    const file = path.join(ROOT, p);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); return res.end(); }
    res.writeHead(200, { "Content-Type": types[path.extname(file)] || "application/octet-stream" });
    fs.createReadStream(file).pipe(res);
  }).listen(0);
  const port = server.address().port;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    // Only the site's own errors count: ads and analytics can't load offline.
    page.on("pageerror", (e) => fail(`${page.url()}: script error ${e.message}`));
    for (const f of pages) {
      await page.goto(`http://localhost:${port}/blog/${f}`, { waitUntil: "load" });
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      if (width > 390) fail(`blog/${f}: ${width}px wide at phone width (scrolls sideways)`);
    }
  } finally {
    await browser.close();
    server.close();
  }
}

render().catch((e) => fail("render failed: " + e.message)).then(() => {
  if (problems.length) {
    console.error(`${problems.length} PROBLEM(S):\n- ` + problems.join("\n- "));
    process.exit(1);
  }
  console.log(`ALL CHECKS PASSED (${pages.length - 1} posts + index)`);
});
