#!/usr/bin/env node
/**
 * audit_design.mjs — ADVISORY design-coherence audit for generated block markup.
 *
 * The two validators answer "is this markup valid?". Both can be green on a page that renders
 * badly: a real page passed them on all eight publishes and was rejected three times on looks.
 * This script answers a different question — "is this markup DESIGNED?" — using only what can be
 * measured statically from the markup itself. No browser, no dependencies.
 *
 * It is ADVISORY and non-blocking by design. It encodes taste as numbers, and numbers about taste
 * are guidance, not law: a finding can be the right call, deliberately made. Exit code is 0 unless
 * --strict is passed. It is NOT part of the publish gate.
 *
 * Every threshold below is grounded in a measurement from a page that shipped and was rejected —
 * the evidence is quoted at each check, so a future reader can argue with the number rather than
 * guess at where it came from.
 *
 * USAGE
 *   node audit_design.mjs path/to/markup.html    audit ONE file
 *   node audit_design.mjs                        audit the teaching corpus
 *   node audit_design.mjs <file> --json          machine-readable
 *   node audit_design.mjs <file> --strict        exit 1 when a high-severity finding is present
 *   node audit_design.mjs <file> --report        print the design system this markup HAS
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findBlockMarkers } from "./validate_pattern.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EXAMPLES_ROOT = path.resolve(HERE, "..", "examples");
const CONTENT_FILE = "content.html";

const px = (v) => {
  const m = typeof v === "string" && v.match(/^(-?[\d.]+)px$/);
  return m ? parseFloat(m[1]) : null;
};

/** Perceived lightness 0-100 from a #rgb / #rrggbb colour. Non-hex (var(), rgba()) returns null. */
function lightness(hex) {
  if (typeof hex !== "string") return null;
  let h = hex.trim().replace(/^#/, "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return ((0.299 * r + 0.587 * g + 0.114 * b) / 255) * 100;
}

const IMAGE_BLOCKS = new Set(["image", "cover", "media-text", "gallery", "video"]);

export function collect(markup) {
  const markers = findBlockMarkers(markup);

  /* How many direct wp:column children does each wp:columns have? A column with no explicit
     width divides the row equally, so this count is what makes its real width knowable. */
  const columnChildren = new Map();
  {
    const st = [];
    for (const m of markers) {
      if (m.kind === "close") { st.pop(); continue; }
      if (m.kind === "self") continue;
      const parent = st[st.length - 1];
      if (m.name === "column" && parent && parent.name === "columns") {
        columnChildren.set(parent.position, (columnChildren.get(parent.position) || 0) + 1);
      }
      st.push(m);
    }
  }
  const fontSizes = new Map();
  const contentSizes = new Map();
  const radii = new Map();
  const families = new Map();
  const sections = [];
  const measures = [];
  const stack = [];
  let depth = 0;
  let images = 0;
  let dynamicBlocks = 0;
  let textBlocks = 0;
  let centeredText = 0;

  for (const m of markers) {
    if (m.kind === "close") {
      depth = Math.max(0, depth - 1);
      stack.pop();
      continue;
    }
    const a = m.attrs || {};
    const st = a.style || {};

    if (m.kind === "open" && depth === 0) {
      sections.push({
        name: m.name,
        padding: JSON.stringify((st.spacing || {}).padding || null),
        background: (st.color || {}).background ?? null,
      });
    }

    const size = px((st.typography || {}).fontSize);
    if (size !== null) fontSizes.set(size, (fontSizes.get(size) || 0) + 1);

    /* Only TOP-LEVEL measures count. The evidence behind this check is that SECTIONS did not share
       a left edge — a narrower measure NESTED inside a section does not move that section's left
       edge, and "one measure + an inner column" is the fix this very check recommends. Counting a
       nested group therefore punished the correct pattern. Verified against the real page: every
       measure on both the rejected and the final version sits at depth 0, so this refinement does
       not weaken the case the check was built from. */
    if (m.kind === "open" && depth === 0 && a.layout && a.layout.contentSize) {
      contentSizes.set(a.layout.contentSize, (contentSizes.get(a.layout.contentSize) || 0) + 1);
    }

    const ff = (st.typography || {}).fontFamily ?? a.fontFamily;
    if (typeof ff === "string" && ff) families.set(ff, (families.get(ff) || 0) + 1);

    const r = (st.border || {}).radius;
    if (typeof r === "string") radii.set(r, (radii.get(r) || 0) + 1);

    if (m.name === "heading" || m.name === "paragraph") {
      /* Is this text running at the page measure, or is it inside a card / column / flex row?
         BOTH the alignment and line-length checks depend on the answer, so it is computed once.
         Card-internal text is a different thing from page-level prose: a three-column card grid
         that centres its card titles is a legitimate design, not "everything centred". Counting
         it made `services-3-col` report "8 of 9 centred" for a layout doing nothing wrong. */
      const narrowed = stack.some(
        (s) => s.name === "columns" || s.name === "column" || s.flex
      );

      if (!narrowed) {
        textBlocks++;
        const al = (st.typography || {}).textAlign ?? a.textAlign ?? a.align;
        if (al === "center") centeredText++;
      }

      /* Prose inside a column DOES have a knowable width: the nearest ancestor measure times
         each column fraction on the way out. Skipping it entirely (as an earlier version did)
         left a long line inside a card invisible. A flex row is still skipped — its width is
         content-driven, so any number we invented would be fiction. */
      if (m.name === "paragraph" && size !== null) {
        let factor = 1;
        for (let i = stack.length - 1; i >= 0; i--) {
          const anc = stack[i];
          if (anc.flex) break;
          if (anc.name === "column") {
            if (anc.fraction === null) break;
            factor *= anc.fraction;
            continue;
          }
          const base = px(anc.contentSize);
          if (base === null) continue;
          const w = base * factor;
          const label = factor === 1
            ? anc.contentSize
            : `${Math.round(w)}px inside ${anc.contentSize}`;
          const chars = Math.round(w / (size * 0.5));
          /* A long MEASURE is only a long LINE if there is enough text to fill it. A 30-character
             label in a 1400px container never wraps, so flagging it invents a problem — which is
             exactly what an earlier version of this check did on every header in the corpus. */
          const close = markers.find((k) => k.kind === "close" && k.name === "paragraph" && k.position > m.position);
          const text = close
            ? markup.slice(m.position, close.position).replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "").trim()
            : "";
          measures.push({ width: label, size, chars, textLen: text.length });
          break;
        }
      }
    }
    if (IMAGE_BLOCKS.has(m.name)) images++;
    /* A NAMESPACED block (`wp:ns/name`) is somebody else's dynamic block — core blocks serialize
       without a namespace. We cannot see what it renders, and a listing block typically renders
       product / category / review imagery at runtime. Counting these separately keeps the imagery
       check from calling a page a wireframe when its pictures simply arrive later. Deliberately a
       SHAPE test, not a block list: this skill must never hardcode one. */
    if (m.name.includes("/")) dynamicBlocks++;

    if (m.kind === "open") {
      depth++;
      let fraction = null;
      if (m.name === "column") {
        const pct = typeof a.width === "string" && a.width.trim().endsWith("%")
          ? parseFloat(a.width) / 100 : null;
        if (pct !== null && !Number.isNaN(pct)) {
          fraction = pct;
        } else {
          const parent = stack[stack.length - 1];
          const kids = parent && parent.name === "columns" ? columnChildren.get(parent.position) : null;
          fraction = kids ? 1 / kids : null;
        }
      }
      stack.push({
        name: m.name,
        position: m.position,
        contentSize: (a.layout || {}).contentSize ?? null,
        flex: (a.layout || {}).type === "flex",
        fraction,
      });
    }
  }

  return { fontSizes, contentSizes, radii, families, sections, images, dynamicBlocks, textBlocks, centeredText, measures };
}

export function analyse(x) {
  const out = [];
  const add = (severity, id, message, evidence) => out.push({ severity, id, message, evidence });

  /* --- type scale -------------------------------------------------------------------
     Measured: a page carried 12 distinct sizes that resolved to 2 perceptible tiers; its
     four H2 sizes spanned 1.27x across four steps (~6% each), below the threshold at which
     a reader sees a step at all. More sizes is not more hierarchy. */
  const sizes = [...x.fontSizes.keys()].sort((a, b) => a - b);
  if (sizes.length > 5) {
    add("high", "type-scale-count",
      `${sizes.length} distinct font sizes (${sizes.join(", ")}px)`,
      "12 sizes produced 2 visible tiers on a rejected page. Aim for <=5 deliberate steps.");
  }
  const tight = [];
  for (let i = 1; i < sizes.length; i++) {
    const ratio = sizes[i] / sizes[i - 1];
    if (ratio < 1.15) tight.push(`${sizes[i - 1]}->${sizes[i]}px (${ratio.toFixed(2)}x)`);
  }
  if (tight.length) {
    add("high", "type-scale-steps",
      `${tight.length} adjacent size step(s) below 1.15x: ${tight.join(", ")}`,
      "Steps under ~15% are not perceived as hierarchy — they read as inconsistency.");
  }

  /* --- content measures --------------------------------------------------------------
     Measured: 7 distinct contentSize values. Two CENTRED measures never share a left edge —
     1100px and 780px landed at 163px and 273px, so narrow sections read as indented and the
     page had no vertical line for the eye to track. Control reading width with an inner
     column instead of a second measure.

     THRESHOLD CORRECTED (05-09-2026): this fired at `> 2`, which let through the exact defect
     it exists for — the measured case had TWO measures, not three. Verified on the real page's
     first published version: 1160px + 720px, both centred, and the check said nothing. TWO
     different centred measures is already the bug, so the threshold is `> 1`. */
  const cs = [...x.contentSizes.keys()];
  if (cs.length > 1) {
    add("high", "content-measures",
      `${cs.length} distinct contentSize values (${cs.join(", ")})`,
      "Centred measures of different widths never share a left edge. Use ONE measure + an inner column.");
  }

  /* --- radii ------------------------------------------------------------------------- */
  const rr = [...x.radii.keys()];
  if (rr.length > 3) {
    add("note", "radii",
      `${rr.length} distinct border radii (${rr.join(", ")})`,
      "5 radii on one page read as accidental rather than systematic.");
  }

  /* --- section rhythm ----------------------------------------------------------------
     Measured: identical 80px padding on 9 of 11 sections — every section the same height
     rhythm, so nothing was emphasised and nothing receded. */
  if (x.sections.length >= 4) {
    const tally = new Map();
    for (const s of x.sections) tally.set(s.padding, (tally.get(s.padding) || 0) + 1);
    const [sig, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
    if (sig !== "null" && n / x.sections.length > 0.6) {
      add("note", "section-rhythm",
        `${n} of ${x.sections.length} top-level sections share identical padding`,
        "Uniform padding gives a page no rhythm — vary it to signal what matters.");
    }
  }

  /* --- background separation ---------------------------------------------------------
     Measured: 4 section backgrounds within 6 points of lightness — they never visually
     separated, so the sections read as one undifferentiated field. */
  const bgs = [...new Set(x.sections.map((s) => s.background).filter(Boolean))];
  const ls = bgs.map((b) => [b, lightness(b)]).filter(([, l]) => l !== null);
  const close = [];
  for (let i = 0; i < ls.length; i++) {
    for (let j = i + 1; j < ls.length; j++) {
      const d = Math.abs(ls[i][1] - ls[j][1]);
      if (d < 6) close.push(`${ls[i][0]} / ${ls[j][0]} (${d.toFixed(1)} apart)`);
    }
  }
  if (close.length) {
    add("note", "background-separation",
      `${close.length} background pair(s) within 6 points of lightness: ${close.join(", ")}`,
      "Backgrounds this close do not separate sections; commit to a contrast or drop one.");
  }

  /* --- alignment ---------------------------------------------------------------------
     "Everything centred" was one of five markers a visual review used to call a page
     AI-generated. Centring is for emphasis; centring everything removes the emphasis. */
  if (x.textBlocks >= 6) {
    const ratio = x.centeredText / x.textBlocks;
    if (ratio > 0.7) {
      add("high", "alignment",
        `${x.centeredText} of ${x.textBlocks} text blocks centred (${Math.round(ratio * 100)}%)`,
        "Centring everything removes emphasis and reads as generic. Left-align body copy by default.");
    }
  }

  /* --- imagery -----------------------------------------------------------------------
     Measured: 0 images across 11 sections, on a page selling a visual product. */
  if (x.sections.length >= 4 && x.images === 0 && x.dynamicBlocks === 0) {
    add("high", "imagery",
      `no image blocks across ${x.sections.length} top-level sections`,
      "A page with no imagery reads as a wireframe. Add real images, or be sure none belong.");
  }

  /* --- line length -------------------------------------------------------------------
     Measured: ~145 characters per line, reduced to ~83 by narrowing the measure. Typographic
     convention puts comfortable reading at 45-85.

     THIS IS AN ESTIMATE AND THE OUTPUT MUST SAY SO. Characters are derived as
     width / (fontSize * 0.5) — a generic average glyph width. This script is static: it cannot know
     which face will actually render, so it cannot be made exact, and pretending otherwise is the
     bug. It runs OPTIMISTIC on condensed faces: a page set in Barlow Condensed measured ~4.7px per
     character at 14px against the 7px this assumes, and the audit reported ~120 characters where the
     real rendered longest line was 153. Under-reporting by a third is the failure mode to expect. */
  const longLines = x.measures.filter((m) => m.chars > 90 && m.textLen > 90);
  const worst = longLines.sort((a, b) => b.chars - a.chars)[0];
  if (worst) {
    const n = longLines.length;
    add("high", "line-length",
      `~${worst.chars} characters per line ESTIMATED (${worst.size}px text at contentSize ${worst.width})` +
        (n > 1 ? ` — ${n} paragraphs over 90` : ""),
      "Comfortable reading is 45-85 characters. Narrow the measure or raise the body size. " +
        "This is an ESTIMATE from a generic glyph width — a static script cannot know the rendered " +
        "face. It runs OPTIMISTIC on condensed faces (measured: ~120 estimated vs 153 real in " +
        "Barlow Condensed), so treat it as a floor and confirm in the browser.");
  }

  return out;
}

/**
 * --report: the design system this markup ACTUALLY has, stated as fact with no judgement.
 *
 * The audit says what looks wrong; this says what you built. It exists because nothing in the
 * procedure asks an agent to decide a typeface, a measure and a type scale BEFORE writing, and
 * two full rebuilds of a real page were rejected on design while the markup was valid every
 * time. Reading your own system back is the cheapest way to notice you never chose one — and it
 * needs no judgement to produce, so it works for a weaker agent too.
 */
function systemReport(name, x) {
  const L = [];
  const pad = (k) => `  ${k.padEnd(14)}`;

  const fams = [...x.families.keys()];
  L.push(pad("Typeface") + (fams.length ? fams.join(" · ") : "NONE SET — inherits the theme default"));
  /* A literal stack is CORRECT off-plugin and WRONG on a COD Leads storefront, where fonts belong to
     the font manager and are referenced by css_var. The check cannot know the destination, so this
     is a note here rather than a validator warning — it would fire on every destination-agnostic
     page otherwise (measured: all 6 corpus examples use literal stacks, legitimately). */
  const literalFams = fams.filter((f) => !/^var\(--cl-/.test(String(f).trim()));
  if (literalFams.length) {
    L.push(pad("") + `^ ${literalFams.length} literal stack(s), not plugin css_vars. On a COD Leads ` +
      `storefront register the face via design_controls/font_manager and use its css_var ` +
      `(var(--cl-fontN)) — see theme-tokens.md. Off-plugin, a literal is correct.`);
  }

  const sizes = [...x.fontSizes.keys()].sort((a, b) => a - b);
  if (sizes.length) {
    const steps = sizes.slice(1).map((v, i) => (v / sizes[i]).toFixed(2) + "x");
    L.push(pad("Type scale") + sizes.join(" / ") + "px" + (steps.length ? `   (steps ${steps.join(", ")})` : ""));
  } else {
    L.push(pad("Type scale") + "no explicit font sizes");
  }

  const cs = [...x.contentSizes.keys()];
  L.push(pad("Measures") + (cs.length ? cs.join(", ") + `   (${cs.length} section measure${cs.length > 1 ? "s" : ""})` : "none declared"));

  const rr = [...x.radii.keys()];
  L.push(pad("Radii") + (rr.length ? rr.join(", ") : "none"));

  const bgs = [...new Set(x.sections.map((s) => s.background).filter(Boolean))];
  L.push(pad("Backgrounds") + (bgs.length
    ? bgs.map((b) => { const l = lightness(b); return l === null ? b : `${b} (L${Math.round(l)})`; }).join("  ")
    : "none on sections"));

  const pct = x.textBlocks ? Math.round((x.centeredText / x.textBlocks) * 100) : 0;
  L.push(pad("Alignment") + `${x.centeredText} of ${x.textBlocks} page-level text blocks centred (${pct}%)`);

  L.push(pad("Imagery") + `${x.images} image block(s)` +
    (x.dynamicBlocks ? `, ${x.dynamicBlocks} dynamic block(s) that may render their own` : ""));

  /* The rendered line is the SHORTER of "what fits" and "how much text there is" — a 40-character
     sentence in a 1280px measure renders as a 40-character line, not a 142-character one. Reporting
     the measure alone overstated it, which would send an agent chasing a line that does not exist. */
  const lines = x.measures.map((m) => ({ ...m, actual: Math.min(m.chars, m.textLen) }));
  const worst = lines.sort((a, b) => b.actual - a.actual)[0];
  L.push(pad("Longest line") + (worst
    ? `~${worst.actual} chars ESTIMATED (${worst.size}px, measure fits ${worst.chars} at ${worst.width})`
    : "no measurable running prose"));
  if (worst) {
    L.push(pad("") + "^ generic glyph width — OPTIMISTIC on condensed faces (measured ~120 est. vs 153 real)");
  }

  const tally = new Map();
  for (const sec of x.sections) tally.set(sec.padding, (tally.get(sec.padding) || 0) + 1);
  L.push(pad("Sections") + `${x.sections.length}, ${tally.size} distinct padding value(s)`);

  const NL = `
`;
  return `Design system — ${name}${NL}${NL}` + L.join(NL);
}

/* ------------------------------------------------------------------------- reporting */
function report(name, findings) {
  const high = findings.filter((f) => f.severity === "high").length;
  const mark = findings.length === 0 ? "OK  " : high ? "WARN" : "note";
  let s = `  ${mark}  ${name}` + (findings.length ? ` — ${findings.length} finding(s)` : "");
  for (const f of findings) {
    s += `\n          ${f.severity === "high" ? "!" : "-"} ${f.message}`;
    s += `\n              -> ${f.evidence}`;
  }
  return s;
}

function auditFile(file) {
  return analyse(collect(fs.readFileSync(file, "utf8")));
}

function walkCorpus(root) {
  const out = [];
  if (!fs.existsSync(root)) return out;
  for (const cat of fs.readdirSync(root, { withFileTypes: true }).filter((d) => d.isDirectory())) {
    const cdir = path.join(root, cat.name);
    for (const ex of fs.readdirSync(cdir, { withFileTypes: true }).filter((d) => d.isDirectory())) {
      const f = path.join(cdir, ex.name, CONTENT_FILE);
      if (fs.existsSync(f)) out.push({ name: `${cat.name}/${ex.name}`, file: f });
    }
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const json = args.includes("--json");
  const strict = args.includes("--strict");
  const wantReport = args.includes("--report");   // NOT `report` — that name is the renderer below
  const target = args.find((a) => !a.startsWith("--"));

  const items =
    target && fs.existsSync(target) && fs.statSync(target).isFile()
      ? [{ name: path.basename(target), file: path.resolve(target) }]
      : walkCorpus(target ? path.resolve(target) : EXAMPLES_ROOT);

  const results = items.map((it) => ({ ...it, findings: auditFile(it.file) }));
  const high = results.reduce((a, r) => a + r.findings.filter((f) => f.severity === "high").length, 0);
  const total = results.reduce((a, r) => a + r.findings.length, 0);

  if (wantReport) {
    for (const r of results) {
      process.stdout.write(systemReport(r.name, collect(fs.readFileSync(r.file, "utf8"))) + `

`);
    }
    process.exit(0);
  }

  if (json) {
    process.stdout.write(JSON.stringify({
      tool: { name: "audit_design", version: "1.0.0" },
      advisory: true,
      count: results.length,
      findingCount: total,
      highCount: high,
      results: results.map((r) => ({ name: r.name, findings: r.findings })),
    }, null, 2) + "\n");
  } else {
    process.stdout.write("Design audit (ADVISORY — guidance, not a gate)\n\n");
    for (const r of results) process.stdout.write(report(r.name, r.findings) + "\n");
    process.stdout.write(`\n${total} finding(s) across ${results.length} file(s); ${high} high-severity.\n`);
    if (!strict) {
      process.stdout.write("Advisory only — exit 0. Pass --strict to fail on high-severity findings.\n");
    }
  }

  process.exit(strict && high > 0 ? 1 : 0);
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
