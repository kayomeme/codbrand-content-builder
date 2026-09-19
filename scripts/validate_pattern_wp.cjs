#!/usr/bin/env node
/**
 * validate_pattern_wp.cjs — GROUND-TRUTH validator for block markup.
 *
 * Runs WordPress's OWN block parser and save() implementations headlessly
 * (via @wordpress/blocks + @wordpress/block-library + jsdom) and reports any
 * block whose saved markup does not match what the block editor would produce.
 * A failure here is either the "Block contains unexpected or invalid content"
 * error you would see after pasting into WordPress, or markup WordPress accepts
 * only as an OLDER version of the block and silently rewrites on the next save.
 *
 * This COMPLEMENTS scripts/validate_pattern.mjs — it does not replace it.
 *   validate_pattern.mjs  : fast, no deps; also checks the cod-brand marker,
 *                           dead fragment links, emoji, style whitelist.
 *   validate_pattern_wp.cjs (this): slow, heavy deps; answers one question
 *                           definitively — will this paste cleanly, and stay
 *                           exactly as written when the page is next saved?
 *
 * THE FALLBACK, NOT THE FIRST CHOICE (since 15-09-2026 — SKILL.md step 5 (c), route 2). A COD Leads
 * storefront runs the same check on its own wp-admin page, with the site's real WordPress and
 * nothing installed. Use THIS script for a publish only when BOTH hold:
 *   1. that page cannot run for this user — no browser the agent can drive, nobody logged in,
 *      or the page reports it cannot run on an older WordPress; and
 *   2. this machine has the toolbox installed (the npm install below has been done).
 * When neither route can run, the procedure pauses and asks — it never publishes unchecked.
 * It stays the tool for checking this skill's own snippets and corpus.
 *
 * Takes EITHER a single markup file (validate what you just generated) or a
 * directory of <category>/<name>/content.html. With no argument it validates the
 * teaching corpus that ships inside this skill.
 *
 * SETUP (one time):
 *   cd .claude/skills/codbrand-content-builder/scripts && npm install
 *
 * USAGE (from anywhere):
 *   node .claude/skills/codbrand-content-builder/scripts/validate_pattern_wp.cjs [file|dir] [--json] [--verbose]
 *
 * Exit code 0 = every block valid, 1 = at least one invalid block (or setup error).
 *
 * IMPORTANT: the pinned package versions encode ONE WordPress release's save()
 * functions. Output is ground truth for that version only. See
 * references/headless-validation.md -> "Version-drift finding" before acting on
 * a diff that concerns text alignment.
 */

const fs = require("node:fs");
const path = require("node:path");

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const verbose = args.includes("--verbose");
const positional = args.filter((a) => !a.startsWith("--"));

// The corpus ships INSIDE the skill, so it is one level up from scripts/ — not four levels up and
// out to a sibling folder, which is what this resolved to while the library lived outside.
const EXAMPLES_ROOT = path.resolve(__dirname, "..", "examples");

// A positional argument may be EITHER a single markup file (validate just that — what an agent uses
// on output it just generated) or a directory to walk.
const ARG = positional[0] ? path.resolve(process.cwd(), positional[0]) : null;
const SINGLE_FILE = ARG && fs.existsSync(ARG) && fs.statSync(ARG).isFile() ? ARG : null;
const PATTERNS_ROOT = SINGLE_FILE ? path.dirname(ARG) : ARG || EXAMPLES_ROOT;

function bail(msg, code = 1) {
  if (asJson) console.log(JSON.stringify({ ok: false, error: msg }, null, 2));
  else console.error(msg);
  process.exit(code);
}

if (!fs.existsSync(PATTERNS_ROOT)) {
  bail(`Nothing to validate at: ${PATTERNS_ROOT}\nPass a markup file, or a directory of <category>/<name>/content.html.`);
}
if (!fs.existsSync(path.join(__dirname, "node_modules", "@wordpress", "blocks"))) {
  bail(
    "Dependencies are not installed.\n\n" +
    "Run once:\n" +
    "  cd .claude/skills/codbrand-content-builder/scripts\n" +
    "  npm install\n\n" +
    "(~400 packages, ~1.3 GB on disk (measured 15-09-2026). See references/headless-validation.md.)"
  );
}

/* ---------------------------------------------------------------- DOM shim */
// Must exist BEFORE any @wordpress/* module is required.
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>", {
  url: "http://localhost",
  pretendToBeVisual: true,
});
dom.window.matchMedia =
  dom.window.matchMedia ||
  (() => ({
    matches: false, media: "", onchange: null,
    addListener() {}, removeListener() {},
    addEventListener() {}, removeEventListener() {},
    dispatchEvent() { return false; },
  }));
globalThis.window = dom.window;
globalThis.document = dom.window.document;
// Node >=22 exposes globalThis.navigator as a read-only getter -> redefine it.
Object.defineProperty(globalThis, "navigator", {
  value: dom.window.navigator, configurable: true, writable: true,
});
for (const k of [
  "self", "HTMLElement", "Element", "Node", "getComputedStyle", "CustomEvent",
  "MutationObserver", "matchMedia", "requestAnimationFrame",
  "cancelAnimationFrame", "DOMParser", "XMLSerializer",
]) {
  if (globalThis[k] === undefined) {
    globalThis[k] = k === "self" ? dom.window : dom.window[k];
  }
}

/* ------------------------------------------------- quiet console during WP */
const REAL = { ...console };
const MUTED = ["log", "warn", "error", "info", "debug", "groupCollapsed", "groupEnd"];
const mute = () => MUTED.forEach((k) => (console[k] = () => {}));
const unmute = () => MUTED.forEach((k) => (console[k] = REAL[k]));

/* --------------------------------------------------------------- load core */
let B, versions;
try {
  mute();
  // block-editor MUST be required first: importing it registers the block-support
  // filters (color / spacing / typography / border). Without it, save() output
  // silently omits has-* classes and inline styles -> FALSE "valid" results.
  require("@wordpress/block-editor");
  const { registerCoreBlocks } = require("@wordpress/block-library");
  B = require("@wordpress/blocks");
  registerCoreBlocks();
  versions = {
    blocks: require("@wordpress/blocks/package.json").version,
    blockLibrary: require("@wordpress/block-library/package.json").version,
    blockEditor: require("@wordpress/block-editor/package.json").version,
  };
  unmute();
} catch (e) {
  unmute();
  bail(`Failed to initialise WordPress packages: ${e.message}`);
}

/* ------------------------------------------------------------------ helpers */
function findPatternFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) findPatternFiles(p, out);
    else if (entry.name === "content.html") out.push(p);
  }
  return out;
}

/**
 * The plugin's OWN dynamic blocks (`cl/…`) are not core, so registerCoreBlocks() does not know them
 * and `parse()` returns `core/missing` — which this validator would report as an error even though
 * the markup is perfectly correct for the target site.
 *
 * So: any `cl/…` block the markup references is registered on demand as a DYNAMIC block —
 * `save: () => null`, which is how WordPress itself registers a server-rendered block. The
 * consequence is exactly right: a self-closing `<!-- wp:cl/x {…} /-->` validates, while the same
 * block carrying saved inner HTML does NOT, because a dynamic block must not have any.
 *
 * WHY A NAMESPACE RULE AND NOT A LIST OF BLOCK NAMES: which `cl/` blocks exist is an API-side fact,
 * and this skill's CLAUDE.md forbids copying those here — a hardcoded list goes stale the moment the
 * plugin adds a block. The NAMESPACE is the stable convention; the membership is not ours to hold.
 *
 * The trade-off is that a typo (`cl/produts-listing`) registers just as happily as a real block. It
 * is mitigated, not ignored: every auto-registered name is reported per pattern, so an unfamiliar
 * one is visible in the output. Same principle as the docs system leaving an unknown `@token`
 * unresolved so the typo shows.
 */
function registerPluginDynamicBlocks(markup, seen) {
  const found = new Set();
  const re = /<!--\s*wp:(cl\/[a-z0-9-]+)/g;
  let m;
  while ((m = re.exec(markup)) !== null) {
    found.add(m[1]);
  }
  for (const name of found) {
    seen.add(name);
    if (B.getBlockType(name)) continue;
    mute();
    try {
      B.registerBlockType(name, {
        title: name,
        category: "widgets",
        // No attribute schema on purpose: a dynamic block's save() output is empty regardless of
        // attributes, so declaring them would add drift without changing a single verdict.
        save: () => null,
      });
    } catch (e) {
      /* already registered by a previous file — harmless */
    }
    unmute();
  }
  return found;
}

function flatten(blocks, out = []) {
  for (const b of blocks) {
    out.push(b);
    if (b.innerBlocks && b.innerBlocks.length) flatten(b.innerBlocks, out);
  }
  return out;
}

/** First differing character between two strings, with a little context. */
function firstDifference(expected, actual) {
  const n = Math.min(expected.length, actual.length);
  let i = 0;
  while (i < n && expected[i] === actual[i]) i++;
  if (i === n && expected.length === actual.length) return null;
  const from = Math.max(0, i - 60);
  return {
    index: i,
    expected: expected.slice(from, i + 80),
    actual: actual.slice(from, i + 80),
  };
}

/* --------------------------------------------------------------------- run */
const files = SINGLE_FILE ? [SINGLE_FILE] : findPatternFiles(PATTERNS_ROOT).sort();
const report = {
  tool: { name: "validate_pattern_wp", version: "1.0.0", wordpressPackages: versions },
  patternsRoot: PATTERNS_ROOT,
  count: files.length,
  invalidBlockCount: 0,
  failedPatterns: 0,
  patterns: [],
};

for (const file of files) {
  const rel = path.relative(PATTERNS_ROOT, file).replace(/\\/g, "/");
  const markup = fs.readFileSync(file, "utf8");
  const entry = { path: rel, blockCount: 0, invalid: [], pluginBlocks: [] };

  // Must run BEFORE parse(): an unregistered cl/* block parses to core/missing and cannot be
  // rescued afterwards.
  const pluginBlocksSeen = new Set();
  registerPluginDynamicBlocks(markup, pluginBlocksSeen);
  entry.pluginBlocks = [...pluginBlocksSeen].sort();

  let parsed;
  try {
    mute();
    parsed = B.parse(markup);
    unmute();
  } catch (e) {
    unmute();
    entry.invalid.push({ block: "(parse threw)", message: e.message });
    report.failedPatterns++;
    report.invalidBlockCount++;
    report.patterns.push(entry);
    continue;
  }

  const all = flatten(parsed);
  entry.blockCount = all.length;

  for (const block of all) {
    const isMissing = block.name === "core/missing";

    // core/html is skipped entirely, exactly as WordPress does: parse() returns a Custom HTML block as
    // valid before any check and keeps its markup as written, and on WordPress 7.1 its save() writes
    // nothing, so checking it would fail every non-empty one. The store's check page skips it the same way.
    if (block.name === "core/html") continue;

    // parse()'s own isValid is NOT a strict verdict. When markup matches an OLDER version of a block,
    // parse() migrates it and reports it valid with no issue, and WordPress rewrites that markup the
    // next time the page is saved — measured on WordPress 7.1, a paragraph came back with a second
    // paragraph nested inside it, and a button's width moved to a different setting. So every block
    // parse() accepts is checked again against the CURRENT block type. Found 15-09-2026; locked by
    // verify-ground-truth-validator.mjs.
    let isOlderVersion = false;
    if (!isMissing && block.isValid !== false) {
      mute();
      try {
        isOlderVersion = B.validateBlock(block, block.name)[0] === false;
      } finally {
        unmute();
      }
      if (!isOlderVersion) continue;
    }

    const item = { block: block.name };

    if (isMissing) {
      item.message = "unknown block type (core/missing) — is this a core block?";
    } else {
      let expected = null;
      try {
        mute();
        expected = B.getSaveContent(
          B.getBlockType(block.name), block.attributes, block.innerBlocks
        );
        unmute();
      } catch (e) {
        unmute();
      }
      const actual = block.originalContent || "";
      item.message = isOlderVersion
        ? "accepted only as an older version of this block — WordPress rewrites the markup the next time the page is saved"
        : "saved markup does not match what WordPress's save() produces";
      if (expected !== null) {
        const diff = firstDifference(expected, actual);
        if (diff) {
          item.firstDifferenceAt = diff.index;
          item.expectedAround = diff.expected;
          item.actualAround = diff.actual;
        }
        if (verbose || asJson) {
          item.expectedFull = expected;
          item.actualFull = actual;
        }
      }
    }

    entry.invalid.push(item);
    report.invalidBlockCount++;
  }

  if (entry.invalid.length) report.failedPatterns++;
  report.patterns.push(entry);
}

report.ok = report.invalidBlockCount === 0;

/* ------------------------------------------------------------------ output */
if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(
    `WordPress ground-truth validator  ` +
    `(@wordpress/blocks ${versions.blocks}, block-library ${versions.blockLibrary})`
  );
  console.log(`Scanning ${files.length} file(s) under ${PATTERNS_ROOT}\n`);

  for (const p of report.patterns) {
    if (!p.invalid.length) {
      // Plugin blocks are listed, not just counted: this validator cannot tell a real cl/ block from
      // a typo (see registerPluginDynamicBlocks), so the names are surfaced for a human to recognise.
      const plugin = p.pluginBlocks.length ? `  [plugin: ${p.pluginBlocks.join(", ")}]` : "";
      console.log(`  PASS  ${p.path}  (${p.blockCount} blocks)${plugin}`);
      continue;
    }
    console.log(`  FAIL  ${p.path}  (${p.invalid.length}/${p.blockCount} invalid)`);
    for (const inv of p.invalid) {
      console.log(`          ${inv.block}: ${inv.message}`);
      if (inv.expectedAround !== undefined) {
        console.log(`            WP expects : …${inv.expectedAround}`);
        console.log(`            we have    : …${inv.actualAround}`);
      }
      if (verbose && inv.expectedFull !== undefined) {
        console.log(`            --- full expected ---\n            ${inv.expectedFull}`);
        console.log(`            --- full actual   ---\n            ${inv.actualFull}`);
      }
    }
  }

  console.log("");
  if (report.ok) {
    console.log(`OK — all ${files.length} file(s) parse and validate against WordPress's own save().`);
  } else {
    console.log(`FAILED — ${report.invalidBlockCount} invalid block(s) across ${report.failedPatterns} pattern(s).`);
    console.log(`Re-run with --verbose for the complete expected/actual markup.`);
    console.log(`See references/headless-validation.md before acting on text-alignment diffs.`);
  }
}

process.exit(report.ok ? 0 : 1);
