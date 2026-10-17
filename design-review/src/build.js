// Builds the self-contained design lab from the live site files.
// usage: node design-review/src/build.js . design-review/src design-review/index.html
//   ARTIFACT=<file>  also write a body-only copy (for hosting inside a page skeleton)
//   TEST=<file>      also write the patched site alone, driven by ?on=p-...,hook&screen=...
const fs = require("fs");
const path = require("path");

const [repo, labDir, outFile] = process.argv.slice(2);
const testFile = process.env.TEST;
const artifactFile = process.env.ARTIFACT;
const read = (p) => fs.readFileSync(path.join(repo, p), "utf8");
const lab = (p) => fs.readFileSync(path.join(labDir, p), "utf8");
const dataUri = (p, type) => `data:${type};base64,${fs.readFileSync(path.join(repo, p)).toString("base64")}`;

const imgs = {
  "images/aloni.jpg": dataUri("images/aloni.jpg", "image/jpeg"),
  "images/peres.jpg": dataUri("images/peres.jpg", "image/jpeg"),
  "images/rabin.jpg": dataUri("images/rabin.jpg", "image/jpeg"),
};

const must = (s, find) => {
  if (!s.includes(find)) throw new Error("build: pattern not found: " + find.slice(0, 80));
  return s;
};

let html = read("index.html");
let css = read("css/style.css");
let quiz = read("js/quiz-data.js");
let app = read("js/app.js");

for (const [k, v] of Object.entries(imgs)) {
  html = must(html, `src="${k}"`).split(`src="${k}"`).join(`src="${v}"`);
  quiz = quiz.split(`"${k}"`).join(`"${v}"`);
}

const HOOK_FIND = "  init();\n})();";
must(app, HOOK_FIND);
app = app.replace(
  HOOK_FIND,
  "  window.__smolo = { render, state, el, setupChallenge, runMeasuring, tierFor, clearTimers, buildStamp, total };\n" + HOOK_FIND
);

const FONT_FIND = "family=Rubik:wght@400;500;600&display=swap";
must(html, FONT_FIND);
html = html.replace(FONT_FIND, "family=Rubik:wght@400;500;600&family=Gveret+Levin&family=Playpen+Sans+Hebrew:wght@500;600&display=swap");

html = html
  .replace(/\s*<link rel="icon"[^>]*>/, "")
  .replace(/\s*<link rel="apple-touch-icon"[^>]*>/, "");

const CSS_LINK = '<link rel="stylesheet" href="css/style.css">';
must(html, CSS_LINK);
html = html.replace(CSS_LINK, () => `<style>\n${css}\n</style>\n<style id="lab-patches">\n${lab("patches.css")}\n</style>`);

const SCRIPTS = '<script src="js/quiz-data.js"></script>\n  <script src="js/app.js"></script>';
must(html, SCRIPTS);
html = html.replace(
  SCRIPTS,
  () => `<script>\n${lab("prelude.js")}\n</script>\n<script>\n${quiz}\n</script>\n<script>\n${app}\n</script>\n<script>\n${lab("bridge.js")}\n</script>`
);

if (/(src|href)="(images|css|js)\//.test(html)) throw new Error("build: unresolved relative asset left in srcdoc");

const srcdocJson = JSON.stringify(html).replace(/<\//g, "<\\/").replace(/<!--/g, "<\\!--");

if (outFile) {
  // isolate number runs like 390×664 or 695–704px so they don't flip inside Hebrew text
  let page = lab("lab.template.html").replace(/\d+(?:[.,]\d+)*(?:\s?[×–]\s?\d+(?:[.,]\d+)*)+(?:px|KB|%)?/g, (m) => "\u2066" + m + "\u2069");
  const DATA_MARK = "/*__SITE_SRCDOC__*/";
  must(page, DATA_MARK);
  page = page.replace(DATA_MARK, () => `const SITE_SRCDOC = ${srcdocJson};`);
  const HEAD_MARK = "<!--HEAD-END-->";
  must(page, HEAD_MARK);
  const [head, body] = page.split(HEAD_MARK);
  const full =
    `<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n` +
    `<meta name="robots" content="noindex">\n${head.trim()}\n</head>\n<body>\n${body.trim()}\n</body>\n</html>\n`;
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, full);
  console.log("lab:", outFile, (full.length / 1024).toFixed(0) + " KB");
  if (artifactFile) {
    fs.writeFileSync(artifactFile, head.trim() + "\n" + body.trim() + "\n");
    console.log("artifact:", artifactFile);
  }
}

if (testFile) {
  // standalone copy of the site with the bridge driven from the query string, for screenshots
  const driver = `<script>
(function(){
  const p = new URLSearchParams(location.search);
  const on = (p.get("on") || "").split(",").filter(Boolean);
  const classes = on.filter(x => x.startsWith("p-"));
  const hooks = on.filter(x => !x.startsWith("p-"));
  const go = { lab: 1, cmd: "goto", screen: p.get("screen") || "intro", q: +(p.get("q") || 0), a: +(p.get("a") || 0), pct: +(p.get("pct") || 50) };
  addEventListener("load", () => {
    postMessage({ lab: 1, cmd: "patches", classes, hooks }, "*");
    setTimeout(() => postMessage(go, "*"), 60);
  });
})();
</script>`;
  fs.writeFileSync(testFile, html.replace("</body>", driver + "\n</body>"));
  console.log("test:", testFile);
}
