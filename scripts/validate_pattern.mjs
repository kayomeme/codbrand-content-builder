#!/usr/bin/env node
/**
 * validate_pattern.mjs — deterministic validator for generated block markup.
 *
 * This is the HEURISTIC half of the gate: the conventions WordPress cannot know about. The other
 * half is WordPress's own check of every block — on the destination store's check page, or locally
 * with `validate_pattern_wp.cjs`, whichever can run (SKILL.md step 5 (c)). Neither supersedes the
 * other: markup is publishable only when this script AND that check are green. The reference
 * publisher runs both scripts itself — see references/headless-validation.md.
 *
 * Verifies:
 *   - Every <!-- wp:X --> has a matching <!-- /wp:X --> (self-closing /--> ok)
 *   - Block-comment attribute JSON parses as valid JSON
 *   - The outermost (root) block carries the `cod-brand` namespace className
 *   - wp:button blocks have "url" in JSON and href= in their HTML segment, and a button with an
 *     explicit style.typography.fontSize also carries has-custom-font-size
 *   - wp:separator <hr> carries has-alpha-channel-opacity
 *   - a named fragment link (href="#x") has a matching id/anchor in the same markup
 *   - wp:cover with dimRatio 50 (default) must NOT emit has-background-dim-50;
 *     non-default ratios must emit the matching suffix class
 *   - no key appears twice inside one object of a block-comment JSON (JSON.parse keeps the last)
 *   - no older block form WordPress rewrites on save: a numeric wp:button "width", a wp:cover dim
 *     <span> ahead of its background media, a wp:cover <img> alt that the JSON "alt" does not match
 *   - no HTML outside any block (WordPress silently makes it a Classic block)
 *
 * TWO MODES:
 *   node validate_pattern.mjs path/to/markup.html   validate ONE file — what an agent just made
 *   node validate_pattern.mjs                       validate the teaching corpus in ../examples/
 *
 * The corpus mode exists to keep the examples honest: they are what the next agent learns from, so
 * an example that would not itself pass the gate teaches a defect. It is NOT a publish step —
 * examples are read-only teaching material and are never published anywhere.
 *
 * Outputs a JSON report. Exit 0 when clean, 1 on any error.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// The teaching corpus lives INSIDE the skill so it ships with it — it is examples an agent learns
// from, not a publishing queue. Resolved relative to this script, not to cwd, so the validator works
// from anywhere.
const EXAMPLES_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "examples");
const CONTENT_FILE = "content.html";

// Our own taxonomy — what we actually build. NOT WordPress's 20 pattern categories: those existed
// only to make a pattern's `Categories:` header valid, and we no longer emit one.
const CATEGORIES = new Set([
  "full-page", "hero", "grid", "listing", "header", "footer",
]);

function readFileSafe(p) {
  try { return fs.readFileSync(p, "utf8"); } catch { return null; }
}

function existsFile(p) {
  try { return fs.statSync(p).isFile(); } catch { return false; }
}

function existsDir(p) {
  try { return fs.statSync(p).isDirectory(); } catch { return false; }
}

/**
 * Tokenize WP block-comment markers. Returns array of:
 *   { kind: "open"|"close"|"self", name, position, attrsRaw, attrs, attrsError }
 * attrsRaw is the raw JSON text ("" when none); attrs is the parsed object or
 * null; attrsError is a message when the JSON failed to parse.
 */
// Exported so audit_design.mjs shares ONE block parser — two parsers would drift.
export function findBlockMarkers(text) {
  const markers = [];
  let i = 0;
  while (i < text.length) {
    const start = text.indexOf("<!--", i);
    if (start === -1) break;
    const end = text.indexOf("-->", start + 4);
    if (end === -1) break;
    const inner = text.slice(start + 4, end).trim();

    if (inner.startsWith("/wp:")) {
      const name = inner.slice(4).split(/\s/)[0];
      markers.push({ kind: "close", name, position: start, attrsRaw: "", attrs: null, attrsError: null });
    } else if (inner.startsWith("wp:")) {
      const isSelf = inner.endsWith("/");
      const stripped = isSelf ? inner.slice(0, -1).trim() : inner;
      const name = stripped.slice(3).split(/[\s{]/)[0];

      // Extract attribute JSON: everything from the first "{" to the end.
      let attrsRaw = "";
      let attrs = null;
      let attrsError = null;
      const braceIdx = stripped.indexOf("{");
      if (braceIdx !== -1) {
        attrsRaw = stripped.slice(braceIdx).trim();
        try {
          attrs = JSON.parse(attrsRaw);
        } catch (e) {
          attrsError = `wp:${name} at offset ${start}: attribute JSON does not parse (${e.message})`;
        }
      }
      markers.push({ kind: isSelf ? "self" : "open", name, position: start, attrsRaw, attrs, attrsError });
    }
    i = end + 3;
  }
  return markers;
}

function validateBalance(markers) {
  const stack = [];
  for (const m of markers) {
    if (m.kind === "open") {
      stack.push(m);
    } else if (m.kind === "close") {
      if (stack.length === 0) {
        return { ok: false, error: `unexpected closing /wp:${m.name} at offset ${m.position}` };
      }
      const top = stack.pop();
      if (top.name !== m.name) {
        return { ok: false, error: `mismatched: opened wp:${top.name} (offset ${top.position}) but closed /wp:${m.name} (offset ${m.position})` };
      }
    }
  }
  if (stack.length > 0) {
    return { ok: false, error: `unclosed: ${stack.map((s) => `wp:${s.name}@${s.position}`).join(", ")}` };
  }
  return { ok: true };
}

/**
 * Pair each "open" marker with its matching "close" so per-block segment
 * checks can inspect the HTML between them. Returns array of
 * { open, close } (close === null for self-closing).
 * Assumes balance has already been validated.
 */
function pairBlocks(markers) {
  const pairs = [];
  const stack = [];
  for (const m of markers) {
    if (m.kind === "open") {
      stack.push(m);
    } else if (m.kind === "self") {
      pairs.push({ open: m, close: null });
    } else if (m.kind === "close") {
      const top = stack.pop();
      if (top && top.name === m.name) pairs.push({ open: top, close: m });
    }
  }
  return pairs;
}

/**
 * Per-block serialization checks driven by the gotchas that have actually
 * broken patterns in this project. `text` is the full file content;
 * segment = text between the open marker and its close (or the next marker
 * for self-closing blocks — those have no HTML body to check).
 */
function checkBlockSerialization(text, markers) {
  const issues = [];
  const pairs = pairBlocks(markers);

  for (const { open, close } of pairs) {
    if (!close) continue; // self-closing (dynamic) blocks have no HTML to check
    const segment = text.slice(open.position, close.position);

    if (open.name === "button") {
      const attrs = open.attrs ?? {};
      if (!attrs.url) {
        issues.push(`wp:button at offset ${open.position}: missing "url" in JSON (mandatory — use "#" for decorative)`);
      }
      if (!/\shref=/.test(segment)) {
        issues.push(`wp:button at offset ${open.position}: rendered <a> has no href attribute`);
      }
      // Verified against WP's own getSaveContent(): a LITERAL font size on a button
      // adds has-custom-font-size to the <a>. Shipped missing from snippets.md #8
      // until 23-08-2026, because no pattern had ever set a button font size.
      if (attrs.style?.typography?.fontSize && !/class="[^"]*has-custom-font-size/.test(segment)) {
        issues.push(`wp:button at offset ${open.position}: style.typography.fontSize requires class "has-custom-font-size" on the <a> (WordPress writes: has-text-color has-background has-custom-font-size wp-element-button)`);
      }
      // A numeric `width` is how an OLDER core/button saved. WordPress 7.1's button has no `width`
      // attribute: parse() migrates it to style.dimensions.width and the next save rewrites the markup.
      // Found 15-09-2026 on two corpus buttons and snippets.md #8.
      if (typeof attrs.width === "number") {
        issues.push(`wp:button at offset ${open.position}: "width":${attrs.width} is the older form of a button width — WordPress accepts it only as an older version of the block and rewrites it on the next save. Write "style":{"dimensions":{"width":"${attrs.width}%"}} and drop has-custom-width / wp-block-button__width-* from the wrapper (references/snippets.md §8)`);
      }
    }

    if (open.name === "separator") {
      if (!segment.includes("has-alpha-channel-opacity")) {
        issues.push(`wp:separator at offset ${open.position}: <hr> missing required class has-alpha-channel-opacity`);
      }
    }

    if (open.name === "image") {
      const attrs = open.attrs ?? {};
      // Strip <?php ... ?> first: the "?>" inside PHP echoes (src/alt) would
      // otherwise truncate the tag match before the style attribute.
      const cleaned = segment.replace(/<\?php[\s\S]*?\?>/g, "PHP");
      const figureTag = (cleaned.match(/<figure[^>]*>/) ?? [""])[0];
      const imgTag = (cleaned.match(/<img[^>]*>/) ?? [""])[0];
      const figStyleMatch = figureTag.match(/\sstyle="([^"]*)"/);
      if (figStyleMatch) {
        // Only style.spacing.margin legitimately serializes onto the <figure>;
        // border/width/height/object-fit ALL belong on the <img>.
        const nonMargin = figStyleMatch[1]
          .split(";").map((s) => s.trim()).filter(Boolean)
          .filter((p) => !/^margin-/.test(p));
        if (nonMargin.length) {
          issues.push(`wp:image at offset ${open.position}: <figure> inline style may only contain margin-* (got: ${nonMargin.join(", ")}) — border/width/height/object-fit serialize onto the <img>`);
        }
      }
      if (attrs.style && attrs.style.border && !figureTag.includes("has-custom-border")) {
        issues.push(`wp:image at offset ${open.position}: style.border requires class "has-custom-border" on the <figure>`);
      }
      // Verified against WP's own getSaveContent(): border.color puts a SECOND,
      // different class on the <img> itself. Missing it shipped a parser error.
      if (attrs.style && attrs.style.border && attrs.style.border.color && !/class="[^"]*has-border-color/.test(imgTag)) {
        issues.push(`wp:image at offset ${open.position}: style.border.color requires class "has-border-color" on the <img> (distinct from the figure's "has-custom-border" — both are required)`);
      }
      if (/object-fit:/.test(imgTag) && !attrs.scale) {
        issues.push(`wp:image at offset ${open.position}: object-fit in img style requires "scale" in JSON`);
      }
      if (attrs.scale && !imgTag.includes(`object-fit:${attrs.scale}`)) {
        issues.push(`wp:image at offset ${open.position}: "scale":"${attrs.scale}" requires object-fit:${attrs.scale} in the img style`);
      }
      if (/border-style:/.test(imgTag) && !(attrs.style && attrs.style.border && attrs.style.border.style)) {
        issues.push(`wp:image at offset ${open.position}: border-style in img style has no style.border.style in JSON — omit both (WP injects border-style via global CSS when border-width is set)`);
      }
    }

    if (open.name === "cover") {
      const attrs = open.attrs ?? {};
      const ratio = attrs.dimRatio;
      const suffixMatch = segment.match(/has-background-dim-(\d+)/);
      if (ratio === undefined || ratio === 50 || ratio === 0) {
        if (suffixMatch) {
          issues.push(`wp:cover at offset ${open.position}: dimRatio ${ratio ?? "default"} must NOT emit has-background-dim-${suffixMatch[1]} (only has-background-dim)`);
        }
      } else {
        if (!segment.includes(`has-background-dim-${ratio}`)) {
          issues.push(`wp:cover at offset ${open.position}: dimRatio ${ratio} requires class has-background-dim-${ratio}`);
        }
      }
      if (attrs.style && attrs.style.shadow !== undefined) {
        issues.push(`wp:cover at offset ${open.position}: style.shadow is not supported on wp:cover (parser error) — wrap in a wp:group instead`);
      }
      // Two things changed in core/cover — both found 15-09-2026 on three corpus covers and
      // snippets.md #7. Only the cover's OWN background is inspected (everything before its inner
      // container), so a nested cover is judged by its own block, never by its parent's.
      const innerAt = segment.indexOf("wp-block-cover__inner-container");
      const head = innerAt === -1 ? "" : segment.slice(0, innerAt);
      const spanAt = head.indexOf("wp-block-cover__background");
      const mediaAt = head.search(/wp-block-cover__(?:image|video)-background/);
      if (spanAt !== -1 && mediaAt !== -1 && spanAt < mediaAt) {
        issues.push(`wp:cover at offset ${open.position}: the dim <span class="wp-block-cover__background"> comes before the background image/video — that is the older form of the block, which WordPress rewrites on the next save. Put the <img>/<video> first (references/snippets.md §7)`);
      }
      const bgImg = head.match(/<img\b[^>]*\bwp-block-cover__image-background\b[^>]*>/);
      if (bgImg) {
        const altAttr = bgImg[0].match(/\salt="([^"]*)"/);
        const htmlAlt = decodeHtmlAttr(altAttr ? altAttr[1] : "");
        const jsonAlt = typeof attrs.alt === "string" ? attrs.alt : "";
        if (htmlAlt !== jsonAlt) {
          issues.push(`wp:cover at offset ${open.position}: the background <img> has alt="${htmlAlt}" but the JSON "alt" is "${jsonAlt}" — the current core/cover writes alt from the JSON only, so the two must match (references/snippets.md §7)`);
        }
      }
    }
  }

  return issues;
}

/**
 * The outermost block of every pattern must carry the `cod-brand` namespace
 * marker in its className (JSON) and its rendered class list.
 */
function checkCodBrand(text, markers) {
  const issues = [];
  const root = markers.find((m) => m.kind === "open" || m.kind === "self");
  if (!root) {
    issues.push("no block markers found");
    return issues;
  }
  const className = (root.attrs && root.attrs.className) || "";
  if (!className.split(" ").filter(Boolean).includes("cod-brand")) {
    issues.push(`root block wp:${root.name}: JSON className must include "cod-brand" (namespace marker)`);
  }
  // Rendered class list: the first class="..." after the root marker must contain cod-brand.
  const afterRoot = text.slice(root.position);
  const classAttr = afterRoot.match(/class="([^"]*)"/);
  if (classAttr && !classAttr[1].split(" ").filter(Boolean).includes("cod-brand")) {
    issues.push(`root block wp:${root.name}: rendered class list missing "cod-brand" (got "${classAttr[1]}")`);
  }
  return issues;
}

/**
 * A named fragment link (`href="#commander"`) must have something to land on.
 *
 * Read from the block JSON's `"url"`, NOT from the rendered `href`. That is where the value the
 * editor round-trips actually lives; a rendered-href regex also matched escaped/templated forms and
 * missed real cases.
 *
 * A BARE `href="#"` is deliberately ignored — it is the documented placeholder for a decorative
 * button (snippets.md #8 requires `url` on every button, and `#` is what you use when there is
 * nowhere to go). Only a NAMED fragment with no target is an error.
 *
 * Found a real one: both CTAs of banner/hachoir-landing pointed at `#commander` while the library
 * contained no `id=` and no `"anchor"` at all — two dead buttons that passed both validators.
 */
function checkFragmentTargets(text, markers) {
  const issues = [];

  const wanted = new Map();
  for (const m of markers) {
    const url = m.attrs && typeof m.attrs.url === "string" ? m.attrs.url : "";
    if (url.length > 1 && url.startsWith("#")) {
      const frag = url.slice(1);
      wanted.set(frag, (wanted.get(frag) ?? 0) + 1);
    }
  }
  if (!wanted.size) return issues;

  // Two ways a pattern can offer a landing point: a literal id in the markup, or a block's
  // `anchor` attribute (which WP serializes INTO an id, so both are the same thing at render).
  const targets = new Set();
  for (const m of text.matchAll(/\sid="([^"]+)"/g)) {
    targets.add(m[1]);
  }
  for (const m of markers) {
    if (m.attrs && typeof m.attrs.anchor === "string" && m.attrs.anchor) {
      targets.add(m.attrs.anchor);
    }
  }

  for (const [frag, count] of wanted) {
    if (!targets.has(frag)) {
      issues.push(
        `dead fragment link: "#${frag}" (${count}×) has no target in this pattern — nothing carries id="${frag}" and no block sets "anchor":"${frag}". Point it at a real destination, add the anchor, or use a bare "#" if it is decorative.`
      );
    }
  }
  return issues;
}

/**
 * Check for malformed HTML attribute boundaries (e.g. stray "" or '').
 * Strips block comments (and <?php ?> blocks for .php files) before searching,
 * so JSON inside block-comment markup and PHP code aren't falsely flagged.
 */
function checkHtmlCorruption(content, isPhpFile) {
  // Replace stripped sections with a placeholder character (X) instead of "":
  // PHP blocks often live INSIDE attribute values (e.g. href="<?php echo ...; ?>")
  // — collapsing them to empty would leave src="" and trigger false positives.
  let stripped = content.replace(/<!--[\s\S]*?-->/g, "X");
  if (isPhpFile) {
    stripped = stripped.replace(/<\?php[\s\S]*?\?>/g, "X");
  }
  const issues = [];
  // Negative lookbehind for `=` — `attr=""` is a legitimate empty attribute value (e.g. alt="")
  // and must not be flagged. Only flag when "" appears in non-empty-value contexts.
  const patterns = [
    { regex: /(?<!=)""/g, label: '""' },
    { regex: /(?<!=)''/g, label: "''" },
  ];
  for (const { regex, label } of patterns) {
    let m;
    while ((m = regex.exec(stripped)) !== null) {
      const start = Math.max(0, m.index - 24);
      const end = Math.min(stripped.length, m.index + 24);
      const ctx = stripped.slice(start, end).replace(/\s+/g, " ").trim();
      issues.push(`stray ${label} (likely malformed attribute boundary) near: "...${ctx}..."`);
    }
  }
  return issues;
}

/**
 * WHITELIST of inline CSS properties that WP block supports legitimately
 * serialize into style="". Anything outside this set is almost certainly a
 * hand-rolled invention (e.g. display:flex/gap from the `layout` attribute,
 * which serializes to generated classes, NEVER inline) and will trigger
 * "Block contains unexpected or invalid content" on paste.
 *
 * Grounded in a scan of every style="" across the validated library, plus
 * the remaining properties block supports can emit (per-side borders,
 * corner radii, gradients, font-family, object-position, text-decoration).
 * If WP legitimately emits a NEW property, add it here deliberately —
 * that's the point: unknown properties fail loud instead of shipping.
 */
const INLINE_STYLE_WHITELIST = new Set([
  "background", "background-color", "color",
  "font-size", "font-weight", "font-style", "font-family",
  "line-height", "letter-spacing", "text-transform", "text-decoration",
  "border-radius",
  "border-top-left-radius", "border-top-right-radius",
  "border-bottom-left-radius", "border-bottom-right-radius",
  "border-width", "border-style", "border-color",
  "border-top-width", "border-top-style", "border-top-color",
  "border-right-width", "border-right-style", "border-right-color",
  "border-bottom-width", "border-bottom-style", "border-bottom-color",
  "border-left-width", "border-left-style", "border-left-color",
  "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin-top", "margin-right", "margin-bottom", "margin-left",
  "min-height", "min-width", "max-width", "width", "height",
  "aspect-ratio", "object-fit", "object-position",
  "flex-basis", "box-shadow",
  // core/media-text emits this from its OWN save() (not from block supports):
  //   `grid-template-columns: <mediaWidth>% auto` / `auto <mediaWidth>%`.
  // Verified against WordPress itself via scripts/emit_block.cjs, and
  // validate_pattern_wp.cjs passes markup carrying it. Whitelisted deliberately,
  // per the guidance in this check's own failure message.
  "grid-template-columns",
]);

function checkInlineStyleWhitelist(content) {
  const issues = [];
  const re = /style="([^"]*)"/g;
  let m;
  while ((m = re.exec(content)) !== null) {
    const bad = [];
    for (const decl of m[1].split(";")) {
      const prop = decl.split(":")[0]?.trim().toLowerCase();
      if (prop && !INLINE_STYLE_WHITELIST.has(prop)) bad.push(prop);
    }
    if (bad.length) {
      const ctx = content.slice(Math.max(0, m.index - 40), m.index).replace(/\s+/g, " ").trim();
      issues.push(
        `inline style property NOT in the serialization whitelist (${bad.join(", ")}) near "...${ctx}" — WP block supports never emit this inline (layout/flex/gap serialize to generated classes); remove it, or if WP genuinely emits it, add it to INLINE_STYLE_WHITELIST deliberately`
      );
    }
  }
  return issues;
}

/**
 * Emoji used as icon placeholders must be a conscious, documented choice:
 * the accessibility rules (conversion-rules.md) require flagging them to the
 * user, and the pattern's Description header must tell the user to replace
 * them. Sessions have shipped emoji icons silently; this converts that prose
 * rule into an enforced one. Warning (not error) — emoji are legal, shipping
 * them UNDOCUMENTED is the bug.
 */
/**
 * Emoji used as icon placeholders.
 *
 * There is no Description header to document them in any more — that lived on the `.php` twin, which
 * is gone. So any emoji is simply reported: they are never monochrome, they render differently per
 * OS, and an icon asset (snippets.md #5) is almost always what the design actually wanted.
 * Warning, not error — an emoji is legal, shipping one unthinkingly is the bug.
 */
function checkEmojiPlaceholders(text) {
  const found = [...new Set(text.match(/\p{Extended_Pictographic}/gu) ?? [])];
  if (found.length === 0) return [];
  return [
    `emoji glyph(s) ${found.join(" ")} in content — emoji are never monochrome and differ per OS. Prefer an icon asset (snippets.md #5) unless the design genuinely wants an emoji.`,
  ];
}

/**
 * Dead links. A CTA pointing at "#" or "" renders as a button that does nothing — the single most
 * visible way a page can look finished and be broken. Both validators used to pass a page whose
 * every call-to-action was dead, so this is an ERROR, not a warning.
 */
function checkDeadLinks(text) {
  const issues = [];
  for (const m of text.matchAll(/href="(#?)"/g)) {
    issues.push(`dead link href="${m[1]}" at offset ${m.index} — a CTA that goes nowhere. Give it a real destination, or a "#anchor" matching an id in this markup.`);
  }
  for (const m of text.matchAll(/"url":"(#?)"/g)) {
    issues.push(`dead "url":"${m[1]}" at offset ${m.index} — a button / navigation-link / social-link with no destination. Self-closing blocks render no HTML, so this is the only place the dead link is visible.`);
  }
  return issues;
}

/**
 * blockGap is THEME-DEPENDENT and emits no CSS of its own.
 *
 * WordPress only turns blockGap into real CSS when the active theme opts into `spacing.blockGap`
 * (wp-includes/block-supports/layout.php: `$has_block_gap_support = isset($block_gap)`).
 *
 * THERE ARE TWO ROUTES IN, and an earlier version of this comment knew only one. It said a classic
 * theme "never opts in" — FALSE. Besides theme.json, `add_theme_support('appearance-tools')` sets
 * settings.appearanceTools, which WP_Theme_JSON::do_opt_in_into_settings() expands through
 * APPEARANCE_TOOLS_OPT_INS — a list containing ['spacing','blockGap']. So a classic theme with no
 * theme.json anywhere can fully support it. Hence this warns rather than errors: the destination is
 * unknowable from the markup, so the message means "go and confirm", not "remove this".
 *
 * A real page authored against such a theme shipped with 0px between headings and their content,
 * because the markup set blockGap and zeroed the child margins. Both validators passed; a human
 * found it on a screenshot. File-level (not per-occurrence) so the message stays readable.
 */
function checkBlockGapReliance(text) {
  const n = (text.match(/"blockGap"/g) ?? []).length;
  if (n === 0) return [];
  return [
    `blockGap used ${n}× — it emits NO CSS by itself and is discarded entirely unless the DESTINATION theme opts into spacing.blockGap (EITHER via theme.json OR via add_theme_support('appearance-tools') on a classic theme — so you must DETECT it, not infer it from the theme being classic). Confirm the destination supports it, or set explicit margins on the children instead.`,
  ];
}

/**
 * No typeface anywhere. A file that sets no fontFamily inherits whatever the theme defaults to —
 * very often Inter, the most-defaulted face on the web — and reads as "unstyled" however careful
 * the layout is. Detectable in one line; was missed by a human review pass.
 */
function checkTypefaceSet(text) {
  if (/"fontFamily"/.test(text)) return [];
  return [
    `no fontFamily set anywhere in this file — every character will render in the destination theme's default face. Set style.typography.fontFamily (or a named font slug) on at least the headings, or confirm the theme's default is genuinely the design intent.`,
  ];
}

/**
 * An empty wp:column is not free. It collapses to height:0 as expected, but the parent columns
 * block still applies its row-gap BETWEEN the two children when they stack — leaving dead scroll on
 * mobile (measured: ~192px across six sections). A single wp:column inside wp:columns is legal and
 * takes its own width, so an empty partner is never needed to hold a narrower measure.
 */
function checkEmptyColumns(markers) {
  const issues = [];
  for (let i = 0; i < markers.length; i++) {
    const m = markers[i];
    if (m.name !== "column") continue;
    if (m.kind === "self") {
      issues.push(`empty wp:column at offset ${m.position} — it still costs a row-gap when the columns stack. Delete it; a lone wp:column keeps its own width.`);
      continue;
    }
    if (m.kind !== "open") continue;
    let depth = 0;
    let hasChild = false;
    for (let j = i + 1; j < markers.length; j++) {
      const n = markers[j];
      if (n.kind === "open") {
        if (depth === 0) hasChild = true;
        depth++;
      } else if (n.kind === "self") {
        if (depth === 0) hasChild = true;
      } else if (n.kind === "close") {
        if (depth === 0) break;
        depth--;
      }
    }
    if (!hasChild) {
      issues.push(`empty wp:column at offset ${m.position} — it still costs a row-gap when the columns stack. Delete it; a lone wp:column keeps its own width.`);
    }
  }
  return issues;
}

/**
 * Fixed px horizontal padding used to control text MEASURE.
 *
 * padding is a FIXED length: it does not shrink. Capping line length with it works at the width you
 * were looking at and fails at every narrower one. Measured failure: `padding-right: 260px` on a
 * <details> block consumed 260 of the ~327px usable inside a 375px phone (the store's mobile gutters
 * take 24px a side), so the questions rendered in a sliver and broke words mid-word. BOTH validators
 * passed, because both are static.
 *
 * ONLY px is judged. A `%`, `em`/`rem` or `var:preset|…` value shrinks with, or is owned by, its
 * container — none of them is the defect being caught here.
 *
 * Thresholds are grounded, not taste: the teaching corpus's own maximum is 80px (40+40 across 57
 * padding declarations), and a phone leaves ~327px. So >120px is already generous, and >=200px (or
 * >=150px on ONE side) cannot survive a phone under any layout. Below the error band it stays a
 * WARNING because the check cannot see the container width — see SKILL.md, "never enforce an
 * advisory rule as an error".
 */
const PX_ONLY = /^(-?[\d.]+)px$/;
function paddingPx(v) {
  const m = typeof v === "string" && v.match(PX_ONLY);
  return m ? parseFloat(m[1]) : null;   // null = not px = shrinks or theme-owned = not our business
}

function checkHorizontalPadding(markers) {
  const errs = [];
  const warns = [];
  for (const m of markers) {
    if (m.kind === "close" || !m.attrs) continue;
    const pad = ((m.attrs.style || {}).spacing || {}).padding;
    if (!pad || typeof pad !== "object") continue;
    const left = paddingPx(pad.left);
    const right = paddingPx(pad.right);
    if (left === null && right === null) continue;
    const sum = (left ?? 0) + (right ?? 0);
    const worst = Math.max(left ?? 0, right ?? 0);
    const where = `wp:${m.name} at offset ${m.position}`;
    if (sum >= 200 || worst >= 150) {
      errs.push(`${where}: horizontal padding ${left ?? 0}px + ${right ?? 0}px = ${sum}px. A 375px phone leaves ~327px inside the store's gutters, so this leaves ~${Math.max(0, 327 - sum)}px for content. Padding does NOT shrink — never use it to control line length. Use a constrained contentSize or a % column width instead (conversion-rules.md).`);
    } else if (sum > 120) {
      warns.push(`${where}: horizontal padding ${left ?? 0}px + ${right ?? 0}px = ${sum}px — fixed px padding does not shrink, and this leaves ~${327 - sum}px on a 375px phone. Verify at a narrow viewport, or use a mechanism that shrinks (conversion-rules.md).`);
    }
  }
  return { errs, warns };
}

/**
 * `var:preset|…` on a theme that has no presets.
 *
 * A preset string resolves through a preset SCALE in the theme's theme.json
 * (`settings.color.palette`, `typography.fontSizes`, `spacing.spacingSizes`). A theme that declares
 * none has no presets, so the value resolves to nothing and the padding/colour/size SILENTLY
 * VANISHES. Nothing errors; the design just quietly loses it.
 *
 * ⚠️ CORRECTED 19-09-2026: this said "the plugin's own `codbrand` companion theme ships no
 * theme.json at all". It ships one. The verdict for codbrand is unchanged — that file sets
 * default{Palette,FontSizes,SpacingSizes} to false and declares no scales, so presets still resolve
 * to nothing — but "has a theme.json" was never the right test, and reading it as one also implies
 * codbrand discards `blockGap`, which is false (`appearanceTools: true`).
 *
 * WARNING, not an error, and deliberately so: the same string is CORRECT on a block theme. The check
 * cannot know the destination, so it surfaces the dependency rather than forbidding it — see
 * references/theme-tokens.md, which makes discovering the theme step one.
 *
 * Safe by measurement: the teaching corpus contains ZERO `var:preset|` occurrences, so this cannot
 * fire on house-style markup.
 */
function checkPresetTokens(text) {
  const found = [...new Set(text.match(/var:preset\|[a-z-]+\|[a-zA-Z0-9-]+/g) ?? [])];
  if (found.length === 0) return [];
  return [
    `${found.length} theme-preset token(s) used (${found.slice(0, 3).join(", ")}${found.length > 3 ? ", …" : ""}) — these resolve ONLY where the theme declares a preset SCALE (settings.color.palette / typography.fontSizes / spacing.spacingSizes). A theme.json alone is not enough — the plugin's own codbrand has one but declares no scales, so they resolve to nothing there and the value silently vanishes. Confirm the destination's theme, or use literals — see references/theme-tokens.md.`,
  ];
}

/**
 * Six sequences must be \uXXXX-escaped inside block-comment JSON, because WordPress escapes them when
 * it serializes attributes (`serialize_block_attributes`, wp-includes/blocks.php).
 *
 * This defect is invisible to BOTH validators by construction: plain "--" still PARSES, so ground
 * truth passes and the page renders correctly today. It diverges only when the editor next re-saves
 * the post — long after delivery, with no error anywhere. A page using CSS custom properties hits it
 * on EVERY occurrence (22-27 in real conversions), which is exactly the kind of counting a human does
 * not do reliably. Hence a check rather than a paragraph.
 *
 * "--" errors because it is the one that can end the comment early: a "}" followed by a space and
 * "-->" inside a string value closes the comment there, and WordPress drops every attribute of that
 * block (measured on WordPress 7.1's parser, 15-09-2026; a lone "--" or "-->" still parses). The rest
 * warn because they only diverge. Each `esc` below is what the author must TYPE, so its backslash is
 * written twice: with one, JavaScript turns the escape into the very characters the message flags.
 * \" and \ are also escaped by WP but are not checked here — they are rare and hard to distinguish
 * from ordinary JSON escaping, so they stay documented rather than enforced.
 */
const JSON_COMMENT_ESCAPES = [
  { seq: "--", esc: "\\u002d\\u002d", hard: true,  why: 'a "} -->" inside a value ends the comment early' },
  { seq: "&",  esc: "\\u0026",        hard: false, why: "WP rewrites it on the next save" },
  { seq: "<",  esc: "\\u003c",        hard: false, why: "WP rewrites it on the next save" },
  { seq: ">",  esc: "\\u003e",        hard: false, why: "WP rewrites it on the next save" },
];

function checkCommentJsonEscaping(markers) {
  const errs = [];
  const warns = [];
  for (const m of markers) {
    if (!m.attrsRaw) continue;
    for (const { seq, esc, hard, why } of JSON_COMMENT_ESCAPES) {
      const n = m.attrsRaw.split(seq).length - 1;
      if (n === 0) continue;
      const msg =
        `wp:${m.name} at offset ${m.position}: ${n} unescaped "${seq}" inside the block-comment JSON — ` +
        `write "${esc}" instead. WordPress escapes it when it serializes (${why}), so this parses and ` +
        `renders correctly NOW but diverges the next time the editor saves the post. See ` +
        `references/block-supports.md → "Six sequences MUST be escaped inside block-comment JSON".`;
      (hard ? errs : warns).push(msg);
    }
  }
  return { errs, warns };
}

/**
 * Text outside every block. WordPress reads it as a Classic (freeform) block, and both the block editor and
 * WordPress's own validation accept that without a word — so a store's check page passes it too. In block
 * markup it is always a slip: a stray wrapper, a <style>, a paragraph left outside the root block.
 * Found 15-09-2026 by the side-by-side test behind SKILL.md step 5: the one case where the check page and the
 * local ground-truth validator disagree. Runs only on balanced markup, where the depth count means something.
 */
function checkHtmlOutsideBlocks(text, markers) {
  const issues = [];
  const report = (from, gap) => {
    const at = gap.search(/\S/);
    if (at !== -1) {
      issues.push(`HTML outside any block at offset ${from + at}: WordPress reads it as a Classic block, and the editor and a store's check page accept that silently — put it inside a block or remove it (starts: ${JSON.stringify(gap.trim().slice(0, 60))})`);
    }
  };
  let depth = 0;
  let cursor = 0;
  for (const m of markers) {
    if (depth === 0) {
      report(cursor, text.slice(cursor, m.position));
    }
    if (m.kind === "open") {
      depth++;
    } else if (m.kind === "close") {
      depth--;
    }
    cursor = text.indexOf("-->", m.position) + 3;
  }
  report(cursor, text.slice(cursor));
  return issues;
}

/**
 * A key written twice inside ONE object of a block-comment JSON. JSON.parse keeps only the LAST copy
 * and says nothing, so the first copy's values are silently lost. Found 15-09-2026 on a corpus
 * paragraph whose "margin" appeared twice: its margin-right vanished from the block's attributes, and
 * WordPress rewrote the block on the next save. findBlockMarkers() cannot see it — it parses.
 */
function duplicateKeysIn(raw) {
  const dups = [];
  const stack = []; // one Set of seen keys per open object, null per open array
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === '"') {
      let j = i + 1;
      while (j < raw.length && raw[j] !== '"') {
        j += raw[j] === "\\" ? 2 : 1;
      }
      let k = j + 1;
      while (k < raw.length && /\s/.test(raw[k])) {
        k++;
      }
      const top = stack[stack.length - 1];
      if (top instanceof Set && raw[k] === ":") {
        const key = raw.slice(i + 1, j);
        if (top.has(key)) {
          dups.push(key);
        } else {
          top.add(key);
        }
      }
      i = j;
    } else if (ch === "{") {
      stack.push(new Set());
    } else if (ch === "[") {
      stack.push(null);
    } else if (ch === "}" || ch === "]") {
      stack.pop();
    }
  }
  return dups;
}

function checkDuplicateJsonKeys(markers) {
  const issues = [];
  for (const m of markers) {
    if (!m.attrs) continue; // no JSON, or JSON that does not parse (already reported)
    for (const key of duplicateKeysIn(m.attrsRaw)) {
      issues.push(`wp:${m.name} at offset ${m.position}: key "${key}" appears twice in the same object of the block-comment JSON — JSON keeps only the last copy, so the first one's values are silently lost. Merge the two.`);
    }
  }
  return issues;
}

/** The entities an HTML attribute value realistically carries, decoded so it can be compared with JSON. */
function decodeHtmlAttr(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

/**
 * THE VALIDATOR. Takes MARKUP, not a path — so an agent can check what it just generated without
 * writing a file first, which is the whole point of the corpus/output split: what the agent produces
 * is its own business, and this skill only has to be able to tell it whether the markup is sound.
 * Everything below this function is file plumbing over the top of it.
 */
export function validateMarkup(markup) {
  const errors = [];
  const warnings = [];

  const markers = findBlockMarkers(markup);
  for (const m of markers) {
    if (m.attrsError) errors.push(m.attrsError);
  }
  for (const issue of checkDuplicateJsonKeys(markers)) errors.push(issue);

  const balance = validateBalance(markers);
  if (!balance.ok) {
    errors.push(balance.error);
  } else {
    for (const issue of checkBlockSerialization(markup, markers)) errors.push(issue);
    for (const issue of checkCodBrand(markup, markers)) errors.push(issue);
    for (const issue of checkFragmentTargets(markup, markers)) errors.push(issue);
    for (const issue of checkHtmlOutsideBlocks(markup, markers)) errors.push(issue);
  }

  for (const issue of checkHtmlCorruption(markup, false)) errors.push(issue);
  for (const issue of checkInlineStyleWhitelist(markup)) errors.push(issue);
  for (const issue of checkDeadLinks(markup)) errors.push(issue);
  for (const issue of checkEmojiPlaceholders(markup)) warnings.push(issue);
  for (const issue of checkBlockGapReliance(markup)) warnings.push(issue);
  for (const issue of checkTypefaceSet(markup)) warnings.push(issue);
  for (const issue of checkEmptyColumns(markers)) warnings.push(issue);
  for (const issue of checkPresetTokens(markup)) warnings.push(issue);
  const hpad = checkHorizontalPadding(markers);
  const esc = checkCommentJsonEscaping(markers);
  for (const issue of esc.errs) errors.push(issue);
  for (const issue of esc.warns) warnings.push(issue);
  for (const issue of hpad.errs) errors.push(issue);
  for (const issue of hpad.warns) warnings.push(issue);

  return { errors, warnings };
}

/** One example folder: <category>/<name>/content.html */
function validateExample(folderPath) {
  const name = path.basename(folderPath);
  const category = path.basename(path.dirname(folderPath));
  const rel = `${category}/${name}`;
  const file = path.join(folderPath, CONTENT_FILE);

  const errors = [];
  const warnings = [];

  if (!CATEGORIES.has(category)) {
    errors.push(`category "${category}" is not one of: ${[...CATEGORIES].join(", ")}`);
  }
  if (!existsFile(file)) {
    errors.push(`missing ${CONTENT_FILE}`);
    return { path: rel, category, name, status: "error", errors, warnings };
  }

  const r = validateMarkup(readFileSafe(file) ?? "");
  errors.push(...r.errors);
  warnings.push(...r.warnings);

  return { path: rel, category, name, status: errors.length === 0 ? "ok" : "error", errors, warnings };
}

function walkExamples(root) {
  const out = [];
  if (!existsDir(root)) return out;
  for (const category of fs.readdirSync(root).sort()) {
    if (category.startsWith(".") || category.startsWith("_")) continue;
    const catPath = path.join(root, category);
    if (!existsDir(catPath)) continue;
    for (const name of fs.readdirSync(catPath).sort()) {
      if (name.startsWith(".")) continue;
      const p = path.join(catPath, name);
      if (existsDir(p)) out.push(p);
    }
  }
  return out;
}

/**
 * The design audit is ADVISORY, and until now NOTHING ran it — only a sentence in SKILL.md asked
 * the agent to. Prose has already failed this project three times (blockGap, the typeface rule,
 * the boundary rule), so the findings ride along in THIS output instead: every publish route must
 * run this validator, so the agent sees them without being asked.
 *
 * They never touch errorCount and never change the exit code — a design opinion must not block a
 * publish. Imported lazily because a static import would be circular (audit_design.mjs imports
 * findBlockMarkers from this file), and wrapped so an audit failure can never break validation.
 */
async function designFindings(markup) {
  try {
    const audit = await import("./audit_design.mjs");
    return audit.analyse(audit.collect(markup)).map((f) => `[${f.severity}] ${f.message}`);
  } catch {
    return [];
  }
}

async function main() {
  const arg = process.argv.slice(2).find((a) => !a.startsWith("--"));

  // SINGLE-FILE MODE — validate one markup file (what an agent just generated).
  if (arg && existsFile(path.resolve(process.cwd(), arg))) {
    const file = path.resolve(process.cwd(), arg);
    const markup = readFileSafe(file) ?? "";
    const r = validateMarkup(markup);
    const design = await designFindings(markup);
    process.stdout.write(JSON.stringify({
      tool: { name: "validate_pattern", version: "1.0.0" },
      mode: "file",
      file,
      errorCount: r.errors.length,
      warningCount: r.warnings.length,
      errors: r.errors,
      warnings: r.warnings,
      designAdvisory: design,
    }, null, 2) + "\n");
    process.exit(r.errors.length > 0 ? 1 : 0);
  }

  // CORPUS MODE — validate the teaching examples that ship with the skill.
  const root = arg ? path.resolve(process.cwd(), arg) : EXAMPLES_ROOT;
  if (!existsDir(root)) {
    process.stdout.write(JSON.stringify({
      tool: { name: "validate_pattern", version: "1.0.0" },
      error: `examples root not found at ${root}. Pass a markup file, or a directory of <category>/<name>/${CONTENT_FILE}.`,
    }, null, 2) + "\n");
    process.exit(1);
  }

  const results = walkExamples(root).map(validateExample);
  for (const r of results) {
    const f = path.join(root, r.path.split("/").join(path.sep), CONTENT_FILE);
    r.designAdvisory = await designFindings(readFileSafe(f) ?? "");
  }
  const errorCount = results.filter((r) => r.status === "error").length;
  const warningCount = results.reduce((a, r) => a + r.warnings.length, 0);

  process.stdout.write(JSON.stringify({
    tool: { name: "validate_pattern", version: "1.0.0" },
    mode: "corpus",
    root,
    count: results.length,
    errorCount,
    warningCount,
    examples: results,
  }, null, 2) + "\n");
  process.exit(errorCount > 0 ? 1 : 0);
}
// Run only when invoked directly. Without this guard, `import`ing this module (audit_design.mjs
// reuses findBlockMarkers) would execute a full corpus validation as a side effect.
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main();
}
