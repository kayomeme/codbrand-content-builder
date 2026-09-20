#!/usr/bin/env node
/**
 * diff_source_fidelity.mjs — did the conversion silently DROP something the source stated?
 *
 * The two validators cannot answer this, by construction. `validate_pattern_wp.cjs` checks the markup
 * round-trips through WordPress's own save(); `validate_pattern.mjs` checks our conventions. NEITHER
 * HAS SEEN THE SOURCE. A flattened heading and a dropped max-width are both perfectly valid markup.
 *
 * So this tool is not a third validator. They check CORRECTNESS; this checks FIDELITY.
 *
 * It REPORTS, it never fails (always exit 0). It cannot judge intent: dropping a `max-width` may be
 * exactly right for a destination whose width mode already owns the measure. The rule this serves is
 * NAME IT, NOT PRESERVE IT — every difference gets one line in the delivery report and the owner
 * decides. A tool that failed the build here would train people to "fix" deliberate decisions.
 *
 * USAGE
 *   node diff_source_fidelity.mjs <source.html> <output.html>
 *   node diff_source_fidelity.mjs <source.html> <output.html> --json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Each marker is counted the same way on both sides; counting is enough, pairing is not needed. */
const MARKERS = [
  {
    key: "br-in-heading",
    label: "<br> inside a heading",
    note: "flattened to a space — a deliberate line break in the source disappears",
    count: (t) =>
      (t.match(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi) ?? [])
        .reduce((n, h) => n + (h.match(/<br\s*\/?>/gi) ?? []).length, 0),
  },
  {
    key: "br-total",
    label: "<br> anywhere",
    note: "<br><br> in a paragraph correctly becomes two paragraphs — that is not a loss",
    count: (t) => (t.match(/<br\s*\/?>/gi) ?? []).length,
  },
  {
    key: "max-width",
    label: "max-width",
    note: "without it the container silently inherits the full width",
    count: (t) => (t.match(/max-width/gi) ?? []).length,
  },
  {
    key: "position-absolute",
    label: "position:absolute",
    note: "the element rejoins normal flow",
    count: (t) => (t.match(/position\s*:\s*absolute/gi) ?? []).length,
  },
  {
    key: "embed-fixed-size",
    label: "fixed width/height on an embed",
    note: "commonly replaced by a 'reasonable' value — measure the real one instead",
    count: (t) =>
      (t.match(/<(iframe|video|embed|object)\b[^>]*>/gi) ?? [])
        .filter((tag) => /\b(width|height)\s*=/.test(tag) || /\b(width|height)\s*:/.test(tag)).length,
  },
  {
    key: "object-fit",
    label: "object-fit / object-position",
    note: "reverts to default centring, which crops differently",
    count: (t) => (t.match(/object-(fit|position)/gi) ?? []).length,
  },
];

export function diffFidelity(sourceText, outputText) {
  return MARKERS.map((m) => {
    const src = m.count(sourceText);
    const out = m.count(outputText);
    return { key: m.key, label: m.label, note: m.note, source: src, output: out, delta: out - src };
  });
}

function main() {
  const args = process.argv.slice(2);
  const asJson = args.includes("--json");
  const [srcPath, outPath] = args.filter((a) => !a.startsWith("--"));

  if (!srcPath || !outPath) {
    process.stdout.write("usage: node diff_source_fidelity.mjs <source.html> <output.html> [--json]\n");
    process.exit(0);
  }
  for (const p of [srcPath, outPath]) {
    if (!fs.existsSync(p)) {
      process.stdout.write(`file not found: ${p}\n`);
      process.exit(0);
    }
  }

  const rows = diffFidelity(fs.readFileSync(srcPath, "utf8"), fs.readFileSync(outPath, "utf8"));

  if (asJson) {
    process.stdout.write(JSON.stringify({ tool: "diff_source_fidelity", source: srcPath, output: outPath, rows }, null, 2) + "\n");
    process.exit(0);
  }

  process.stdout.write(`Source fidelity — ${path.basename(srcPath)} vs ${path.basename(outPath)}\n`);
  process.stdout.write("REPORT ONLY. A difference is a decision to NAME, not automatically a defect.\n\n");
  process.stdout.write(`  ${"marker".padEnd(34)} ${"source".padStart(6)} ${"output".padStart(6)}  \n`);
  process.stdout.write(`  ${"-".repeat(34)} ${"-".repeat(6)} ${"-".repeat(6)}\n`);

  let dropped = 0;
  for (const r of rows) {
    const flag = r.delta < 0 ? "  <-- DROPPED" : r.delta > 0 ? "  <-- ADDED" : "";
    if (r.delta < 0) dropped++;
    process.stdout.write(`  ${r.label.padEnd(34)} ${String(r.source).padStart(6)} ${String(r.output).padStart(6)}${flag}\n`);
    if (r.delta !== 0) process.stdout.write(`  ${"".padEnd(34)} ${r.note}\n`);
  }

  process.stdout.write(
    dropped
      ? `\n${dropped} marker type(s) reduced. Put ONE LINE per row in the delivery report and let the owner decide.\n`
      : "\nNo marker type lost.\n"
  );
  process.exit(0);
}

// COMPARE REAL PATHS, NOT AS-TYPED ONES. Node resolves symlinks in `import.meta.url` but leaves
// `process.argv[1]` exactly as invoked. This skill is installed at ~/.claude/skills/<skill> as a
// SYMLINK into the repo (dev/link-skills.sh), so that is how every agent runs it -- and the two
// sides never matched, the main block was skipped, and the script exited 0 having checked
// NOTHING. Measured 20-09-2026: a file with real errors passed silently through the symlink and
// failed correctly via the real path. Reported by a merchant build that published unvalidated
// markup believing it had passed.
const __realPath = (p) => { try { return fs.realpathSync(p); } catch { return path.resolve(p); } };
if (process.argv[1] && __realPath(process.argv[1]) === __realPath(fileURLToPath(import.meta.url))) {
  main();
}
