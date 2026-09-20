# Ground-Truth Validation — running WordPress's REAL validator in Node

Our `scripts/validate_pattern.mjs` is a **heuristic** validator: it encodes bugs we have already been burned by. It cannot catch a serialization mistake nobody has hit yet.

There is a second, stronger option, **proven working in this project** (Aug 2026): run WordPress's own parser + `save()` implementations headlessly in Node and compare. That is not a heuristic — it is the same code the block editor runs, so it is the definition of correct.

**Status: ADOPTED.** Implemented as `scripts/validate_pattern_wp.cjs`.

**Since 15-09-2026 it is the strict check's LOCAL FALLBACK** (route 2 of the strict check, `SKILL.md` step 5 (c)). A COD Leads storefront runs the same check on its own wp-admin page — the site's real WordPress, in the merchant's logged-in browser, with nothing installed — documented at `cl-api/v1/docs/block_markup_validation`. This validator is for when no such browser is available and the toolbox is installed, and it remains the tool that checks this skill's own snippets and corpus. Side by side on WordPress 7.1 the page and this validator agreed on every block; they differ only on HTML outside any block, which the page (like the editor) reads as a Classic block and this harness reports as `core/missing`, because nothing registers a Classic block in Node.

```bash
# OPTIONAL (route 2 only). Copy the 3 files somewhere OUTSIDE the repo first -- see the warning below.
cd <a directory of your own> && npm ci                              # one time, ~400 packages, 1.6 GB
node .claude/skills/codbrand-content-builder/scripts/validate_pattern_wp.cjs [--verbose] [--json]
```

⚠️ **Never install it INSIDE the skill folder on a machine where that folder is a link into a repo.** `dev/link-skills.sh` installs `~/.claude/skills/<skill>` as a junction into the plugin repo, so `npm ci` there puts **1.6 GB / ~138,000 files inside the plugin** (measured 20-09-2026; it also made the skill publish copy and then delete all of it, adding ~6 minutes to every deploy). Copy `validate_pattern_wp.cjs`, `package.json` and `package-lock.json` into a directory OUTSIDE the repo and install there — Node resolves `@wordpress/*` by walking up from the script, so a copy works unchanged.

## Why it matters — the case that proved it

`services/services-3-col` passed our heuristic validator with 0 errors, yet WordPress showed "Block contains unexpected or invalid content" on all three images. The headless validator found it in one run and printed the exact byte difference:

```
--- WHAT WP save() PRODUCES ---
<img src="…" alt="…" class="has-border-color" style="border-color:#d4af37;…"/>
--- WHAT OUR PATTERN HAD ---
<img src="…" alt="…" style="border-color:#d4af37;…"/>
```

A single missing `class="has-border-color"`. No amount of eyeballing found it across three sessions; the real validator found it immediately.

## Proven recipe

```bash
npm install --no-save \
  @wordpress/blocks@15.23.0 \
  @wordpress/block-editor@15.23.0 \
  @wordpress/block-library@10.1.0 \
  jsdom@29.1.1
```

```js
// MUST be a .cjs file (or CommonJS project). See "Gotchas" #1.
const { JSDOM } = require("jsdom");
const dom = new JSDOM("<!doctype html><html><body></body></html>",
  { url: "http://localhost", pretendToBeVisual: true });
dom.window.matchMedia = dom.window.matchMedia || (() => ({
  matches: false, addListener(){}, removeListener(){},
  addEventListener(){}, removeEventListener(){}, dispatchEvent(){ return false; },
}));
globalThis.window = dom.window;
globalThis.document = dom.window.document;
Object.defineProperty(globalThis, "navigator",           // Node >=22: read-only getter
  { value: dom.window.navigator, configurable: true, writable: true });
for (const k of ["self","HTMLElement","Element","Node","getComputedStyle",
                 "CustomEvent","MutationObserver","matchMedia",
                 "requestAnimationFrame","cancelAnimationFrame"]) {
  if (globalThis[k] === undefined) globalThis[k] = k === "self" ? dom.window : dom.window[k];
}

require("@wordpress/block-editor");                       // FIRST — see Gotchas #2
const { registerCoreBlocks } = require("@wordpress/block-library");
const B = require("@wordpress/blocks");
registerCoreBlocks();                                     // ~113 core block types

const blocks = B.parse(fs.readFileSync("content.html", "utf8"));
// b.isValid === false  -> markup does not match save()
// B.validateBlock(b, b.name)[0] === false -> accepted only as an OLDER version of
//   the block and rewritten on the next save — check this too (Gotcha #7)
// b.name === "core/missing" -> block type unknown
// B.getSaveContent(B.getBlockType(b.name), b.attributes, b.innerBlocks)
//   -> the exact bytes WP expects; diff against b.originalContent
```

## Gotchas (each cost a debugging cycle)

1. **Use the CommonJS build.** The ESM build (`build-module/`) does `import … from './i18n-block.json'` without an import attribute; Node ≥22 throws `ERR_IMPORT_ATTRIBUTE_MISSING`. A `.cjs` file with `require()` resolves `build/` instead and works.
2. **`require("@wordpress/block-editor")` before registering blocks.** Block *supports* (color, spacing, typography, border → the `has-*` classes and inline styles) are applied by filters registered as a side effect of importing `block-editor`. Without it, `save()` output silently omits them and you get **false VALIDs**.
3. **Drive it with `parse()`, not hand-built attribute objects.** `parse()` applies the block's attribute schema defaults and runs deprecations. Calling `getSaveContent()` with a partial attrs object skips defaults — e.g. `core/separator` renders to `""` because its `tagName` default (`hr`) was never applied. That's a harness artifact, not a WP bug.
4. **Pin all four packages to one consistent set.** Left unpinned, npm mixed `block-library@10.4` with `block-editor@16.2` and produced wrong output. The set above is the pin used by the production tool `humanmade/block-runner`.
5. **Version = a specific WordPress release.** These packages encode one WP version's `save()` functions. Output is only ground truth *for that version*. Pin to match the target site before acting on a diff (see next section).
6. **Mute the console around import/parse.** Registration and failed validation print large React/blocktype dumps to stdout.
7. **`parse()`'s `isValid` is NOT a strict verdict — also call `validateBlock()` on every block.** When markup matches an OLDER version of a block, `parse()` migrates it through the block's deprecations and reports it valid with no issue, and WordPress rewrites that markup the next time the page is saved — so what was published is not what stays. `B.validateBlock(block, block.name)` checks against the CURRENT block and catches it. Measured 15-09-2026 on the pinned packages, and live on WordPress 7.1: a paragraph with `"style":{"typography":{"fontSize":"18px"}}` in its JSON but no inline style in its HTML → `parse()` valid, `validateBlock()` invalid, and WordPress's own `save()` adds `style="font-size:18px"`. `validate_pattern_wp.cjs` trusted `isValid` until then and passed that markup; it now checks both, locked by `scripts/verify-ground-truth-validator.mjs`. Turning the check on surfaced 7 such blocks in 3 corpus pages, plus 2 snippets, all rewritten to the current form the same day: `core/cover` with the dim `<span>` before the `<img>` and a non-empty alt only on the `<img>` (the current `save()` puts the `<img>` first and reads alt from the JSON — fixing the order alone turns it into an outright failure); `core/button` with a numeric `"width":100` (current: `"style":{"dimensions":{"width":"100%"}}` on a plain `wp-block-button` wrapper); and a paragraph whose JSON repeated the `"margin"` key — JSON keeps only the last copy, so the `margin-right` in its HTML matched no current `save()`. *(The legacy text-alignment form below is not among them — it round-trips exactly, so it passes both checks.)* **One block is exempt from the second check: `core/html`.** WordPress's own `parse()` returns a Custom HTML block as valid before any check and keeps its markup exactly as written; on WordPress 7.1 its `save()` writes nothing, so `validateBlock()` would call every non-empty one outdated. The store's check page and `validate_pattern_wp.cjs` both skip it, as WordPress does — measured live on WordPress 7.1, 15-09-2026, where the page had been reporting every non-empty `wp:html` block as an older version.

## Calibration — does the pin set match the target WordPress?

The pins encode ONE WordPress release. If the target site runs a different one, the validator can be confidently wrong. Check it:

```
node .claude/skills/codbrand-content-builder/scripts/calibrate_wp_version.cjs <path-to-wordpress-root>
```

It diffs the pinned packages against a real install's `wp-includes/blocks/*/block.json` and splits drift into *blocks we actually use* (matters) vs *dynamic/theme blocks* (safe to ignore).

**Result against a WordPress 7.0.4 reference install**, Aug 2026 — 107 core blocks compared:

| Drift | Verdict |
|---|---|
| `core/button` declares `width`, pinned package doesn't | **Not benign — this verdict was WRONG, corrected 15-09-2026.** It said `{"width":100}` with `has-custom-width wp-block-button__width-100` "validates correctly" and Snippet #8 was safe. That markup only *parses*: the pinned package accepts it as an older version of the button and moves the value to `style.dimensions.width`, which the validator could not see before Gotcha #7. WordPress 7.1 has no `width` attribute either. Snippet #8 now uses the current form, `"style":{"dimensions":{"width":"100%"}}` on a plain `wp-block-button` wrapper; WordPress adds the width classes when it renders the page. |
| `core/pullquote` declares `textAlign` | Benign — no pattern uses pullquote. |
| 8 dynamic blocks (`core/post-*`, `core/site-*`, `core/query-title`, `core/search`) | Irrelevant — patterns are static-only by design. |
| `core/legacy-widget`, `core/widget-group` unregistered | Irrelevant. |

**Conclusion: `validate_pattern_wp.cjs` verdicts are trustworthy for WordPress 7.0.4.** Re-run the calibration after any WordPress upgrade or version bump.

**Re-calibration for WordPress 7.1** (the same reference install, upgraded since) — 22-08-2026, 107 core blocks compared. `calibrate_wp_version.cjs` exits 1 and reports three drifted blocks we use. All three assessed BENIGN against this library:

| Drift reported | Verdict |
|---|---|
| `core/cover` declares `allowedVideoProviders`, pinned package does not | **Benign — verified by usage.** `cover` is used 15× across 5 patterns, but `allowedVideoProviders` appears **0 times** in the library. It governs which video providers a cover may embed; every cover here is a static image/colour cover. |
| `core/gallery` declares `dynamicContent` | Irrelevant — `gallery` is used **0 times**. |
| `core/video` declares `width, height` | Irrelevant — `video` is used **0 times**. |
| 8 blocks in WP but unregistered by the pin (`core/legacy-widget`, `core/playlist*`, `core/tab*`, `core/widget-group`) | Irrelevant — never used; `tabs`/`playlist` are new in 7.1 and outside the static-pattern vocabulary. |

## ⚠️ Calibrate against the WordPress you PUBLISH to

The pins encode ONE WordPress release. The destination runs whatever it runs, and the two are not the
same thing just because both are "WordPress". Establishing that gap is part of the job — and it is the
DESTINATION's version that matters, never whichever install happens to be convenient locally.

**Finding a live site's version** when you do not otherwise know it:

```
curl -s https://<site>/feed/ | grep generator
→ <generator>https://wordpress.org/?v=7.1</generator>
```

Many sites strip the `<meta name="generator">` tag from their HTML but leave the feed's, so the feed
is the more reliable probe. If both are stripped, ask the site owner rather than guessing.

**Which direction the gap runs decides what a PASS is worth:**

| Gap | Effect | Safe? |
|---|---|---|
| **Pins NEWER than the destination** | The validator can accept markup the destination's older `save()` rejects. Calibration can only UNDER-report risk. | ❌ the bad direction |
| **Pins OLDER than the destination** | A block or attribute new to the destination is unknown to the pins, so it fails locally while being fine live — a false alarm. Residual real risk is narrow: a `save()` that changed between the two releases. | ✅ fails loud |
| **Equal** | Verdicts mean exactly what they say. | ✅ |

When they differ, calibrate against BOTH and treat the older as binding. And **never adopt a block
feature on the strength of the local install alone** — a feature that is real locally can be entirely
absent on the destination, where it is silently inert rather than erroring.

**A destination on an older WordPress is out of policy, not a compatibility target** to water the
markup down for. Say so plainly instead.

**Conclusion: verdicts remain trustworthy for WordPress 7.1 *for this library as it stands today*.** Both validators are green on all 12 patterns (399 blocks).

⚠️ **The scope of that conclusion is narrow — read before relying on it.** The calibration compares *declared attributes*, not `save()` implementations, so attribute parity is a proxy for serialization parity, not proof of it. It is evidence that today's markup is safe, not a licence to use new 7.1 surface. Concretely, the exemption dies the moment a pattern:

- adds a `core/gallery` or `core/video` block (both currently unused — the drift stops being theoretical), or
- sets `allowedVideoProviders` on a cover, or
- uses any block new in 7.1 (`core/tabs`, `core/playlist`) — the pinned package would report `core/missing` and the verdict would be meaningless.

In any of those cases, bump the four pins as a consistent set (see Maintenance below) before trusting a PASS.

## ✅ Text-alignment question — SETTLED, do not re-litigate

WordPress 7.0.4's own `heading/block.json` declares attributes `content, level, levelOptions, placeholder` — **no `textAlign`** — and `paragraph/block.json` has no `align`. Both carry `supports.typography.textAlign: true`. So the *canonical* modern form is `style.typography.textAlign`.

| Form | Used by our library | Validates on WP 7.0.4? |
|---|---|---|
| `"textAlign":"center"` (heading) / `"align":"center"` (paragraph) | ✅ yes | ✅ **yes** — via WP's deprecations |
| `"style":{"typography":{"textAlign":"center"}}` | no | ✅ yes — natively |

Both were tested through the validator; both PASS.

**Decision: keep the legacy form. Do NOT mass-rewrite the library.** Reasons:
1. It is valid on WP 7.0.4 today — WP's deprecations are effectively permanent, given core's backward-compatibility commitment.
2. It is the only form valid across the project's whole stated range (WP 6.7 → 7.0). The modern form would break on 6.7/6.8.
3. Rewriting ~40 blocks across 12 patterns carries real regression risk for zero functional gain.

Revisit only if the supported floor rises above the version where `style.typography.textAlign` became canonical.

### Re-examined under the "latest only" policy (23-08-2026) — conclusion UNCHANGED, basis narrower

`CLAUDE.md` now forbids back-compatibility and retires the 6.7 → 7.1 range. That **voids reason 2**,
which was the strongest of the three: "the only form valid across the project's whole stated range"
is no longer an argument for anything, because there is no range any more.

The decision still stands, on the two reasons that survive:

1. The legacy form **validates on the current release** — WP's deprecations are effectively
   permanent given core's backward-compatibility commitment. This was never a compatibility shim on
   our side; it is a form WordPress itself still accepts and round-trips.
3. Rewriting ~40 blocks across 15 patterns is real regression risk for **zero functional gain** —
   both forms produce identical rendered output.

So: not a back-compat exception, and not grandfathered. It survives because the policy is about not
*degrading* patterns for old versions, and this degrades nothing. **What WOULD violate the policy is
choosing the legacy form in NEW work for cross-version reasons** — that reasoning is now void. New
patterns may use either form; prefer whichever the canonical bytes come back as from
`emit_block.cjs`, which asks the pinned WordPress rather than guessing.

⚠️ If the pins are ever advanced to a WordPress that **drops** the deprecation, reason 1 dies too and
the library must be rewritten in one deliberate pass. That is the trigger to watch, not the release
number.

## `emit_block.cjs` — ask WordPress for the correct bytes

```
node .claude/skills/codbrand-content-builder/scripts/emit_block.cjs core/heading '{"level":2,"style":{...}}' --content "Hello"
echo '[{"name":"core/paragraph","attributes":{...},"content":"Hi"}]' | node emit_block.cjs --stdin
```

Prints exactly what `save()` produces — every `has-*` class, exact inline-style property order. Use it instead of deriving markup from CSS knowledge; it beats guessing and then iterating on validator errors.

**Three limitations — know them or you will copy something wrong:**

1. **Container blocks emit empty.** `core/group`, `core/columns`, `core/column` render their inner blocks; with none passed you get an empty shell. Use `snippets.md` for containers, this tool for leaf blocks (heading, paragraph, image, button, separator).
2. **Schema defaults are NOT applied** (gotcha #3). Example: `core/columns` with no attributes emits `is-not-stacked-on-mobile`, because `isStackedOnMobile`'s default (`true`) is only applied by `parse()`. Real patterns correctly use a bare `<div class="wp-block-columns">`. **Never copy that class from this tool's output.**
3. **Alignment output reflects the newer package, not our settled convention.** It will NOT emit `has-text-align-center` for `"textAlign":"center"` / `"align":"center"`, because those attributes no longer exist in the pinned version. Our legacy form plus the class is correct and validates — see the settled decision above. Ignore this tool on alignment.

## Rejected approach: loading WordPress's own bundled JS

Tempting idea — point the validator at `wp-includes/js/dist/*.min.js` so it self-calibrates to whatever WP is installed. **Attempted and abandoned.** Those bundles are webpack builds expecting a full set of browser globals wired as externals; `react-jsx-runtime.min.js` never registers `window.ReactJSXRuntime` under plain jsdom evaluation, so `components`/`blocks`/`block-library` all fail to initialise (`(0, Z1.jsx) is not a function`). Making it work needs a real externals shim, not a load-order fix. The npm pin set plus `calibrate_wp_version.cjs` achieves the same confidence for far less complexity.

## How the two validators divide the work

Neither supersedes the other — each catches what the other structurally cannot.

| | `validate_pattern.mjs` | `validate_pattern_wp.cjs` |
|---|---|---|
| Speed / deps | instant, zero deps | seconds, ~400 packages |
| `cod-brand` marker, button `url` + `has-custom-font-size`, dead fragment links, emoji docs | ✅ | ❌ (WP knows nothing of our conventions) |
| A key written twice in one object of a block JSON | ✅ | only when the lost value shows in the HTML — `JSON.parse` keeps the last copy silently |
| HTML outside any block | ✅ | reports it as `core/missing` — nothing registers a Classic block in Node (a store's check page reads it as a Classic block and passes it) |
| Older block forms WordPress rewrites on save | ✅ the three this library has hit (numeric button `width`, cover `<span>` before its image, cover alt only on the `<img>`) | ✅ every block, via `validateBlock()` (Gotcha #7) |
| Unknown-to-us serialization bugs | ❌ | ✅ (it *is* WP) |
| Proof it matters | caught missing `cod-brand` on 7 patterns; caught two dead `#anchor` CTAs the library had shipped for months | caught the missing `has-border-color` that the heuristic passed for three sessions |

**A pattern is done only when both are green.**

### The learning loop

When the ground-truth validator reports a diff, it prints WP's exact expected bytes. Do not just patch the pattern — **promote the rule**: add the canonical markup to `snippets.md` / `block-supports.md`, then add a check to `validate_pattern.mjs` so the fast validator catches it next time. That is how heavy, slow ground truth gets compiled down into cheap, fast, dependency-free rules.

### Maintenance

Bump the four pinned versions together, deliberately, when the target WordPress release moves — never individually, and never unpinned (npm will mix incompatible versions and silently produce wrong `save()` output).

Off-the-shelf alternative if we ever drop our own harness: `humanmade/block-runner` (GPL-2.0, `npx block-runner validate`) wraps the same approach behind a CLI.

Off-the-shelf alternative: `humanmade/block-runner` (GPL-2.0, `npx block-runner validate`) wraps the same approach with a CLI.
