import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const htmlPath = join(root, "index.html");
const html = readFileSync(htmlPath, "utf8");
const checkExternal = process.argv.includes("--check-external");

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function uniq(values) {
  return [...new Set(values)].sort();
}

function extractAttr(attr) {
  const pattern = new RegExp(`${attr}=["']([^"']+)["']`, "gi");
  const matches = [];
  let match;
  while ((match = pattern.exec(html))) {
    matches.push(match[1]);
  }
  return matches;
}

function isExternal(value) {
  return /^https?:\/\//i.test(value);
}

function isSkippable(value) {
  return (
    !value ||
    value.includes("${") ||
    value.startsWith("#") ||
    value.startsWith("mailto:") ||
    value.startsWith("tel:") ||
    value.startsWith("data:") ||
    value.startsWith("javascript:")
  );
}

function localPathFor(value) {
  const clean = value.split("#")[0].split("?")[0];
  return normalize(join(root, clean));
}

const refs = uniq([...extractAttr("src"), ...extractAttr("href")]);
const localRefs = refs.filter((ref) => !isSkippable(ref) && !isExternal(ref));
const externalRefs = refs.filter((ref) => isExternal(ref));

for (const ref of localRefs) {
  const path = localPathFor(ref);
  if (!path.startsWith(root)) {
    fail(`Local reference escapes project root: ${ref}`);
    continue;
  }
  if (!existsSync(path)) {
    fail(`Missing local asset/reference: ${ref}`);
  } else if (statSync(path).isDirectory()) {
    fail(`Local reference points to directory: ${ref}`);
  }
}

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/g,
  /ghp_[A-Za-z0-9_]{20,}/g,
  /github_pat_[A-Za-z0-9_]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]{20,}/g,
  /AKIA[0-9A-Z]{16}/g
];

for (const pattern of secretPatterns) {
  const matches = html.match(pattern) || [];
  for (const match of matches) {
    fail(`Secret-looking token found in index.html: ${match.slice(0, 8)}...`);
  }
}

const passwordCopyCalls = html.match(/copy\(['"][^'"]{8,}['"]/g) || [];
if (passwordCopyCalls.length > 0) {
  warn(`Found ${passwordCopyCalls.length} copy() calls containing long literal strings. Confirm this portfolio is intended to expose those values.`);
}

async function checkExternalLinks(urls) {
  const results = [];
  for (const url of urls) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8000);
      const response = await fetch(url, {
        method: "HEAD",
        redirect: "follow",
        signal: controller.signal
      });
      clearTimeout(timer);
      results.push({ url, status: response.status });
      if (response.status >= 400) {
        warn(`External link returned ${response.status}: ${url}`);
      }
    } catch (error) {
      warn(`External link check failed: ${url} (${error?.message || error})`);
    }
  }
  return results;
}

console.log(`Portfolio QA`);
console.log(`- Local refs checked: ${localRefs.length}`);
console.log(`- External refs found: ${externalRefs.length}`);

if (checkExternal) {
  console.log(`- Checking external links with HEAD requests...`);
  await checkExternalLinks(externalRefs);
}

if (warnings.length > 0) {
  console.log(`\nWarnings:`);
  for (const message of warnings) console.log(`- ${message}`);
}

if (failures.length > 0) {
  console.error(`\nFailures:`);
  for (const message of failures) console.error(`- ${message}`);
  process.exit(1);
}

console.log(`\nOK`);
