import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// APP-SPEC section 10. Usage: node scripts/check-bundle.mjs [distDir] (default apps/web/dist).
const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = process.argv[2] ? resolve(process.argv[2]) : join(root, "dist");
const manifestPath = join(distDir, ".vite", "manifest.json");

const KB = 1024;
/** The entry chunk and its static imports: the shell index.html loads on every page. */
const ENTRY_BUDGET = 180 * KB;
/** A public page: the entry plus the page's lazy chunk and its static imports. */
const PAGE_BUDGET = 180 * KB;

// Every public page (APP-SPEC 3) by its source file, which is its key in the manifest.
// A new public page is lazy (router.tsx) and gets a line here.
const PUBLIC_PAGES = {
  "/": "src/pages/Landing.tsx",
  "/quick": "src/features/quick-schedule/QuickSchedule.tsx",
  "/rules": "src/pages/Rules.tsx",
  "/privacy": "src/pages/Privacy.tsx",
};
// Only when a visitor opens their own page (Firebase) or a PDF (pdf.js); never in the above.
const FORBIDDEN = [
  { pattern: /@firebase\/|firebase\/app/, what: "the Firebase SDK; Firebase must load only through lazy app routes" },
  { pattern: /GlobalWorkerOptions/, what: "pdfjs-dist; pdf.js must load only when a PDF is opened" },
];

function fail(message) {
  console.error(`check-bundle: ${message}`);
  process.exit(1);
}

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch {
  fail(`could not read ${manifestPath}; run "vite build" first`);
}

/**
 * Manifest keys are source ids ("index.html", "src/pages/Rules.tsx", "_shared-abc.js"); a
 * chunk's `imports` lists the keys of the chunks it imports statically. Returns every key a
 * chunk needs before it can run.
 */
function staticGraph(key, seen = new Set()) {
  if (seen.has(key)) return seen;
  const chunk = manifest[key];
  if (!chunk) fail(`manifest has no chunk for ${key}`);
  seen.add(key);
  for (const imported of chunk.imports ?? []) staticGraph(imported, seen);
  return seen;
}

const gzipCache = new Map();
function gzipOf(key) {
  if (!gzipCache.has(key)) {
    const code = readFileSync(join(distDir, manifest[key].file), "utf8");
    gzipCache.set(key, { raw: Buffer.byteLength(code), gzip: gzipSync(code).length, code });
  }
  return gzipCache.get(key);
}

function measure(label, keys, budget) {
  let total = 0;
  console.log(`check-bundle: ${label}`);
  for (const key of keys) {
    const { raw, gzip, code } = gzipOf(key);
    total += gzip;
    console.log(`  ${manifest[key].file}  ${(raw / KB).toFixed(1)} KB -> ${(gzip / KB).toFixed(1)} KB`);
    if (/node_modules\/firebase|node_modules\/@firebase/.test(manifest[key].src ?? "")) {
      fail(`${manifest[key].file} imports Firebase SDK code (${manifest[key].src})`);
    }
    for (const { pattern, what } of FORBIDDEN) {
      if (pattern.test(code)) fail(`${manifest[key].file} (${label}) references ${what}`);
    }
  }
  console.log(`  total gzip: ${(total / KB).toFixed(1)} KB (budget ${budget / KB} KB)`);
  if (total > budget) fail(`${label} is ${(total / KB).toFixed(1)} KB gzip, over the ${budget / KB} KB budget`);
}

if (!manifest["index.html"]) fail("manifest has no entry for index.html");
const entry = staticGraph("index.html");
measure("entry chunk + static imports (gzip)", [...entry], ENTRY_BUDGET);

for (const [path, source] of Object.entries(PUBLIC_PAGES)) {
  if (!manifest[source]?.isDynamicEntry) {
    fail(`${source} (${path}) is not a lazy page chunk; public pages load with React.lazy (router.tsx)`);
  }
  const page = staticGraph(source, new Set(entry));
  measure(`page ${path}: entry + ${source} and its static imports (gzip)`, [...page], PAGE_BUDGET);
}

console.log("check-bundle: ok");
