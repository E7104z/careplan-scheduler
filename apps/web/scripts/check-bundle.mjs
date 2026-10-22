import { readFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = join(root, "dist");
const manifestPath = join(distDir, ".vite", "manifest.json");

const BUDGET_BYTES = 180 * 1024;

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

const entry = manifest["index.html"];
if (!entry) {
  fail("manifest has no entry for index.html");
}

const seen = new Set();
const chunks = [];
function addChunk(name) {
  if (!name || seen.has(name)) return;
  seen.add(name);
  chunks.push(name);
  const chunk = manifest[name];
  for (const imp of chunk?.imports ?? []) {
    addChunk(imp);
  }
}
addChunk(entry.file);

const rows = [];
let totalGzip = 0;
for (const name of chunks) {
  const path = join(distDir, name);
  const code = readFileSync(path, "utf8");
  const size = Buffer.byteLength(code);
  const gzip = gzipSync(code).length;
  totalGzip += gzip;
  rows.push({ name, size, gzip });
}

console.log("check-bundle: entry chunk + static imports (gzip)");
for (const row of rows) {
  console.log(
    `  ${row.name}  ${(row.size / 1024).toFixed(1)} KB -> ${(row.gzip / 1024).toFixed(1)} KB`,
  );
}
console.log(
  `  total gzip: ${(totalGzip / 1024).toFixed(1)} KB (budget ${BUDGET_BYTES / 1024} KB)`,
);

if (totalGzip > BUDGET_BYTES) {
  fail(
    `bundle is ${(totalGzip / 1024).toFixed(1)} KB gzip, over the ${BUDGET_BYTES / 1024} KB budget`,
  );
}

for (const name of chunks) {
  const chunk = manifest[name];
  const src = chunk?.src ?? "";
  if (/node_modules\/firebase|node_modules\/@firebase/.test(src)) {
    fail(`${name} imports Firebase SDK code (${src})`);
  }
  const path = join(distDir, name);
  const code = readFileSync(path, "utf8");
  if (/@firebase\/|firebase\/app/.test(code)) {
    fail(`${name} references the Firebase SDK; Firebase must load only through lazy routes`);
  }
  if (/GlobalWorkerOptions/.test(code)) {
    fail(`${name} references pdfjs-dist; pdf.js must load only when a PDF is opened`);
  }
}

console.log("check-bundle: ok");
