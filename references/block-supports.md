# Native Block Supports — Cheat Sheet

What every common core block exposes via JSON attributes. Use these instead of inline CSS.

## Mental model: why serialization is so strict

Patterns are essentially **static-block markup with no `save()` function backing them**. WordPress's parser still applies the same byte-level strictness it uses for custom blocks: the saved HTML must match exactly what the block's `save()` would produce.

There is no flexibility:
- Properties NOT in JSON must NOT appear in HTML.
- Properties in JSON MUST appear in HTML.
- Order and class lists must match.

This is why "Block contains unexpected or invalid content" fires on minor differences. The fix is always to bring the rendered HTML into perfect alignment with the JSON — never the reverse.

**One known leniency — class ORDER is ignored.** WP's validator (`isEquivalentHTML`) compares the `class` attribute as an order-insensitive set: `"wp-block-group cod-brand alignfull"` equals `"wp-block-group alignfull cod-brand"`. Class *presence* is still strict (a missing or extra class fails), but you never need to worry about ordering when inserting a custom className like `cod-brand` into an existing class list. **The same leniency covers the order of properties inside `style=""` and the order of a tag's attributes** — corrected 15-09-2026: this line used to say style-property order is strict. Measured on the pinned packages: a button link with both its classes and its style properties reversed, and a `<ul>` with `class` before `style`, all validate. WordPress compares a `style` as a map of property → value (`getStyleProperties()`) and a tag's attributes by name. What stays strict is presence and value — with one lenient value: a zero, so `0` and `0px` compare equal. Writing WordPress's own order is still good house style, since it keeps a re-saved page's diff small, but no order rule in this file is a validity rule.

## Universal supports (most blocks)

| Attribute | Example |
|---|---|
| `align` | `"align":"full"` / `"wide"` / `"left"` / `"right"` / `"center"` |
| `anchor` | `"anchor":"my-section"` → renders `id="my-section"` |
| `className` | `"className":"is-style-outline"` (only for built-in style variations) |
| `style.spacing.padding` | `{"top":"var:preset|spacing|80","right":"40px","bottom":"var:preset|spacing|80","left":"40px"}` |
| `style.spacing.margin` | same shape as padding |
| `style.spacing.blockGap` | `"var:preset|spacing|40"` (gap between children) |
| `style.color.background` | `"#0d0d0d"` |
| `style.color.text` | `"#ffffff"` |
| `style.color.gradient` | `"linear-gradient(135deg,#abc,#def)"` |
| `backgroundColor` | `"primary"` (theme preset slug) |
| `textColor` | `"contrast"` (theme preset slug) |
| `style.border` | `{"radius":"8px","width":"1px","style":"solid","color":"#ccc"}` |
| `style.border.radius` | `"12px"` or `{"topLeft":"12px",...}` |
| `style.border.{top,right,bottom,left}` | per-side: `{"top":{"color":"#7a6e5a","width":"3px"},"right":{…},…}` — see the per-side rules below |
| `style.typography.fontSize` | `"clamp(2rem, 5vw, 4rem)"` (literal) |
| `fontSize` | `"large"` (theme preset slug) |
| `style.typography.fontWeight` | `"600"` |
| `style.typography.textTransform` | `"uppercase"` |
| `style.typography.letterSpacing` | `"0.05em"` |
| `style.typography.lineHeight` | `"1.2"` |
| `style.typography.textDecoration` | `"underline"` / `"none"` |
| `style.typography.fontStyle` | `"italic"` |
| `style.typography.fontFamily` | `"var:preset|font-family|heading"` or literal |
| `style.shadow` | `"var:preset|shadow|natural"` or `"0 4px 12px rgba(0,0,0,0.08)"` — **only on `wp:group`, `wp:button`, `wp:image`. NOT on `wp:cover`, `wp:column`, `wp:columns`** (parser error if added). For shadowed cover/column: wrap in a `wp:group` and put the shadow on the group. |

## Per-side borders (accent-top cards, accent-left callouts)

The shape a design asks for constantly: a card with a coloured top edge and a neutral box, or a notice
with a thick coloured left edge. Verified byte-for-byte via `emit_block.cjs` 05-09-2026.

**Rule 1 — do not mix flat and per-side in one `border` object.** Use all four sides explicitly when
any side differs; that is what the editor itself saves.

**Rule 2 — a per-side border emits NO `has-border-color` class.** Only a flat `style.border.color`
does. Adding the class to a per-side block is a parser error. (`conversion-rules.md` said the opposite
until 05-09-2026 — corrected there.)

**Rule 3 — WordPress writes `color` then `width`, per side, in T→R→B→L order** (house style — validation ignores property order, see the top of this file):

```html
<!-- wp:group {"style":{"border":{"top":{"color":"#27ae60","width":"4px"},"right":{"color":"#2a2a2a","width":"1px"},"bottom":{"color":"#2a2a2a","width":"1px"},"left":{"color":"#2a2a2a","width":"1px"}},"color":{"background":"#1c1c1c"},"spacing":{"padding":{"top":"32px","right":"26px","bottom":"32px","left":"26px"}}},"layout":{"type":"default"}} -->
<div class="wp-block-group has-background" style="border-top-color:#27ae60;border-top-width:4px;border-right-color:#2a2a2a;border-right-width:1px;border-bottom-color:#2a2a2a;border-bottom-width:1px;border-left-color:#2a2a2a;border-left-width:1px;background-color:#1c1c1c;padding-top:32px;padding-right:26px;padding-bottom:32px;padding-left:26px">
```

**Full inline-style property order WordPress writes** (all supports present, confirmed on paragraph/heading/details — the order to copy, not a validity rule):

```
border-* → color → background-color → margin-* → padding-* →
font-family → font-size → font-weight → letter-spacing → line-height → text-transform
```

Class order that goes with it: `has-border-color` (flat only) → `has-text-color` → `has-background`.

## Layout (Group, Cover, Buttons, Columns)

```json
"layout":{"type":"constrained"}                       // default — content-width container
"layout":{"type":"flex","orientation":"horizontal"}   // row
"layout":{"type":"flex","orientation":"vertical"}     // column
"layout":{"type":"flex","flexWrap":"wrap"}            // wraps to next line on small screens
"layout":{"type":"flex","justifyContent":"space-between"}
"layout":{"type":"flex","verticalAlignment":"center"}
"layout":{"type":"grid","columnCount":3}              // CSS grid (WP 6.3+)
"layout":{"type":"grid","minimumColumnWidth":"20rem"} // auto-fit grid
```

**🔴 Layout NEVER serializes as inline CSS.** The `layout` JSON attribute produces generated `wp-container-*` classes in a `<style>` tag WP injects at render time — the block's own HTML gets NO `display:flex`, `flex-direction`, `justify-content`, `align-items`, or `gap` inline properties. Hand-writing any of these into `style=""` guarantees "Block contains unexpected or invalid content" (a session shipped exactly this bug). Same for `blockGap`: it flows through the generated class, never inline. The validator enforces this with a **whitelist**: only inline properties that block supports legitimately emit are allowed in any `style=""`; everything else errors (`checkInlineStyleWhitelist` / `INLINE_STYLE_WHITELIST` in `validate_pattern.mjs`). If WP genuinely emits a new property, add it to the whitelist deliberately.

**🔴 `constrained` CENTRES its content — it does not just narrow it.** `{"type":"constrained"}`
(optionally with `contentSize`) gives inner blocks `margin-left:auto; margin-right:auto`, so a
narrowed child is centred inside its parent, not left-aligned within it. Measured: FAQ answers
narrowed to `contentSize:"480px"` inside a wider section sat **119px indented** from their own
question, because the leftover 238px was split evenly on both sides. The change was reverted.

| You want | `constrained` is | Use instead |
|---|---|---|
| A centred reading column with nothing beside it | ✅ correct | — |
| A narrowed block that stays flush with a full-width sibling (a question above its answer, a caption under a heading) | ❌ **wrong — it will indent** | an inner `wp:column` with a `%` width, which starts at the parent's left edge |

The tell: if anything ABOVE or BELOW the narrowed block spans the full width, the eye will read the
indent as a mistake. `contentSize` is still the right tool for the page's ONE reading measure — just
not for realigning a single block inside a wider section.

**🔴 Vertical flex SHRINK-WRAPS its children.** `{"type":"flex","orientation":"vertical"}` renders children at their content width (`align-items:flex-start`), NOT full width. A card built this way collapses its inner colored bands/headers to narrow strips (shipped bug: a pastel card-top area rendered as a ~50px strip instead of spanning the card). Choose by what the children need:
- Children must span the container's full width (colored top areas, full-width rows, separators) → use `{"type":"default"}` (flow). Children are normal block-level divs; `blockGap` still works (emitted via generated class, no inline CSS).
- Children should shrink-wrap and be aligned (centered icon, centered image stack) → vertical flex is correct; `justifyContent` controls cross-axis alignment (`left`/`center`/`right`/`stretch`).
- Mixed needs → `{"type":"default"}` on the card, and wrap the row that needs flex in its own flex `wp:group`.

**Valid `justifyContent` / `verticalAlignment` values (flex layout):** `justifyContent` accepts `left`, `center`, `right`, `space-between` (horizontal orientation) or controls cross-axis alignment with `left`/`center`/`right`/`stretch` (vertical orientation). `verticalAlignment` accepts `top`, `center`, `bottom`, `space-between` (vertical orientation adds `stretch`). Raw CSS values like `flex-start`/`flex-end` are INVALID — WP ignores them silently in the editor and the markup drifts from what the UI would save.

## Per-block highlights

### `core/group`
Container of choice for sections. Accepts all universal supports + layout. Use this whenever the design has a colored background, padding, or constrained inner width.

### `core/columns` + `core/column`
- Auto-stacks vertically below 782px (core's `@media (max-width: 781.98px)` breakpoint). Override with `{"isStackedOnMobile":false}` rarely.
- Per-column `"width":"30%"` or `"width":"320px"`.
- Vertical alignment: `{"verticalAlignment":"center"}` on the parent `wp:columns`.
- **`core/column` DOES support `border` (and background, padding, shadow) — styling a card directly on
  the column is legitimate.** Verified with `emit_block.cjs`:
  ```
  core/column {"style":{"border":{"width":"2px","color":"#e5e7eb","radius":"12px"},"color":{"background":"#f6f7f9"}}}
  → <div class="wp-block-column has-border-color has-background" style="border-color:#e5e7eb;border-width:2px;border-radius:12px;background-color:#f6f7f9">
  ```
  ⚠️ **Do NOT conclude otherwise from `block-library/build/column/block.json`** — its `supports` block
  genuinely has **no `border` key**, so reading the file alone says borders are unsupported. That is
  wrong: border reaches the block through the block-supports FILTER CHAIN, not its own block.json.
  This is the same mechanism `headless-validation.md` warns about when it says
  `@wordpress/block-editor` MUST be required before `save()` — without it those filters never
  register and the `has-*` classes silently disappear. **A round-2 review reported "core/column has
  `border: null`, so card styling on a column silently fails"; it is recorded here as FALSE because
  believing it would rule out a technique that works.** When a support looks absent, ask
  `emit_block.cjs` — it runs the real filter chain; block.json alone does not.

### `core/cover`
Full-width image/color background with overlaid content. **Best block for "image-as-background with overlay text" cards** because it gives the user a content-position picker in the editor.

```json
{"url":"...","dimRatio":50,"overlayColor":"contrast","minHeight":600,"minHeightUnit":"px","contentPosition":"bottom left"}
```

**`contentPosition`** is the killer feature: WP exposes a 9-cell grid in the Inspector sidebar so the user can place content at any of `top left`, `top center`, `top right`, `center left`, `center center`, `center right`, `bottom left`, `bottom center`, `bottom right`. The class on the wrapper div is `is-position-{slug}` (with hyphen, e.g. `is-position-bottom-left`), plus `has-custom-content-position` whenever the position is set.

Required structural markup (image-backed cover):
```html
<!-- wp:cover {"url":"...","dimRatio":30,"minHeight":480,"minHeightUnit":"px","contentPosition":"bottom left","layout":{"type":"constrained"}} -->
<div class="wp-block-cover has-custom-content-position is-position-bottom-left" style="min-height:480px"><img class="wp-block-cover__image-background" alt="" src="..." data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-background-dim has-background-dim-30"></span>
  <div class="wp-block-cover__inner-container">
    <!-- inner blocks -->
  </div>
</div>
<!-- /wp:cover -->
```

**Element order and `alt` — corrected 15-09-2026.** The `<img>` comes BEFORE the dim `<span>` (this example had them the other way round), and `alt` is a JSON attribute: a non-empty alt goes in BOTH places, `"alt":"…"` in the JSON and `alt="…"` on the `<img>`. The example leaves it out of the JSON only because its alt is empty, which is the default. The older form (span first, alt only on the `<img>`) is accepted only as an older version of the block and rewritten on the next save; putting the `<img>` first without adding `"alt"` to the JSON fails outright (measured on WordPress 7.1).

**Dim-overlay class rules (easy to miss — the `-50` rule has caused "Block contains unexpected or invalid content" in this project):**

- Class order does not matter — corrected 15-09-2026: this line said `has-background-dim` must come first, but WordPress itself writes `has-background-dim-{ratio}` first, and validation compares the class list as a set. What matters is which classes are present:
- The `has-background-dim-{ratio}` class is **omitted** when `dimRatio` is exactly `50` (the default) or `0`. Writing `has-background-dim has-background-dim-50` for `dimRatio:50` is INVALID — WP's save outputs only `has-background-dim`, so our markup mismatches.

| `dimRatio` value | Correct overlay class |
|---|---|
| Not set / `50` | `has-background-dim` (no ratio suffix) |
| `0` | `has-background-dim` only (overlay is invisible but class still emitted) |
| `30` | `has-background-dim has-background-dim-30` |
| `70` | `has-background-dim has-background-dim-70` |

So if you want a dimmer overlay, change `dimRatio` to something other than 50 (e.g. 30, 60, 70) AND emit the matching `has-background-dim-{N}` class. If you want default dim, use `dimRatio:50` and emit ONLY `has-background-dim`.

**⚠️ `wp:cover` does NOT support `style.shadow`.** Only `wp:group`, `wp:button`, and `wp:image` declare shadow block support. Including `"shadow":"..."` in `wp:cover`'s JSON (and the matching `box-shadow:...` in inline style) triggers "Block contains unexpected or invalid content" because WP strips the unsupported attribute on save → output has no `box-shadow` → mismatch with our HTML. Symptom in the editor: cover column collapses to a narrow strip while the content text wraps letter-by-letter, with the parser-error overlay covering the rest of the row. **Fix:** drop `style.shadow` from the JSON AND `box-shadow` from inline style. If you need a shadow on a cover-style card, wrap the `wp:cover` in a `wp:group` and put the shadow on the group, or use `wp:group` with a background image instead.

### `core/heading`
- `"level":1..6` for `<h1>`–`<h6>`.
- `"textAlign":"center"|"left"|"right"`.
- All typography supports.

### `core/paragraph`
- `"align":"center"|...`, `"dropCap":true`.
- All typography supports.

### `core/buttons` + `core/button`
- Wrapper supports flex layout for spacing.
- Per-button: `"text":"Click me"`, `"url":"..."`, `"linkTarget":"_blank"`, `"className":"is-style-outline"`.
- Width: `"style":{"dimensions":{"width":"50%"}}`, on a plain `<div class="wp-block-button">` wrapper — WordPress adds the width classes when it renders the page. Not the older numeric `"width":50`: WordPress accepts that only as an older version and rewrites it on the next save (corrected 15-09-2026; canonical markup in `snippets.md` §8).

**🔴 MANDATORY: every `wp:button` MUST have `"url"` in JSON AND `href` on the `<a>`.** No exceptions, even for decorative pill-style "badges" or labels. WP's button save() always renders an `<a href>`, so a button without these triggers the "Block contains unexpected or invalid content" parser error on every paste. If the button is purely decorative, use `"url":"#"` and `href="#"`. If you want a static label without click behavior, **don't use `wp:button`** — use a styled `wp:group` containing a `wp:paragraph` instead.

> ⚠️ **High-risk block.** `wp:button` with 3+ style sub-keys (color + border + typography + spacing) is the most parser-fragile block we've seen. Many things must align exactly: which classes are present (`has-text-color` / `has-background` / `has-custom-font-size`), which element carries each style, and every value with its unit (only a zero is lenient — `0` and `0px` compare equal). Class order and style-property order are not among them (corrected 15-09-2026). **For heavily-styled buttons, prefer Strategy B in `SKILL.md` (capture from WP's Code Editor view) instead of hand-writing the JSON↔HTML pair.** It saves multiple iteration rounds.

**Serialization gotchas (cause "Block contains unexpected or invalid content" if wrong):**
- `style.border.radius` ALWAYS serializes onto the inner `<a>` element, NEVER on the wrapper `<div>`. The wrapper div has no inline `style` attribute when border is set.
- WordPress writes the link's `style=""` in this order (when all are present — house style, not a cause of the error): `border-radius` → `color` → `background-color` → `padding-top/right/bottom/left` → `font-size` → `font-weight` → `letter-spacing` → `text-transform`.

Correct full markup for a 100%-width dark button with custom typography:
```html
<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"url":"#","style":{"typography":{"fontSize":"12px","fontWeight":"600","textTransform":"uppercase","letterSpacing":"0.08em"},"color":{"background":"#111111","text":"#ffffff"},"border":{"radius":"0px"},"spacing":{"padding":{"top":"9px","bottom":"9px","left":"0","right":"0"}},"dimensions":{"width":"100%"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-color has-background has-custom-font-size wp-element-button" href="#" style="border-radius:0px;color:#ffffff;background-color:#111111;padding-top:9px;padding-right:0;padding-bottom:9px;padding-left:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">Purchase Now</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
```

*Corrected 15-09-2026: this example used the older `"width":100` form and was also missing `has-custom-font-size` and `"url"`, so `validate_pattern_wp.cjs` failed it. It now matches `snippets.md` §8.*

## Edit safety: avoid stray characters when modifying HTML attributes

When modifying inline HTML attributes (e.g. removing a `style="..."` from an `<a>` tag), the match string MUST include the leading whitespace OR the surrounding quote/bracket context — otherwise you leave orphan characters that look benign to WP's parser but corrupt the next edit.

**Example of the bug** — stripping ` style="..."` from `rel="noreferrer noopener" style="...">Purchase Now`:

| Approach | Old string | New string | Result | Verdict |
|---|---|---|---|---|
| Wrong | ` style="...uppercase">Purchase Now` | `">Purchase Now` | `noopener"">Purchase Now` (stray `"`) | ❌ silently broken |
| Right | ` style="...uppercase"` | (empty) | `noopener">Purchase Now` | ✅ clean |
| Also right | `noopener" style="...uppercase">` | `noopener">` | `noopener">` | ✅ clean |

**Rule:** when removing one HTML attribute, match exactly the attribute (including its leading space) and replace with empty string. Never include the previous attribute's closing quote or the next character (`>`) in the match unless the replacement explicitly reproduces them. After any attribute-modification edit, run `validate_pattern.mjs` AND grep for `""` and `''` as a sanity check.

## Universal serialization rule (most important)

**The inline `style=""` AND every HTML attribute must correspond EXACTLY to keys in the block JSON — no more, no less.** WP does NOT auto-inject anything. If a property is not in the JSON, it must NOT appear in the rendered HTML. Adding "harmless" defaults like `font-style:normal;` or `target="_blank"` without their JSON counterparts causes parser failures.

When you write a styled block, walk the JSON keys directly:
- `style.spacing.padding.top:"9px"` → `padding-top:9px`
- `style.color.background:"#111"` → `background-color:#111`
- `style.typography.fontSize:"12px"` → `font-size:12px`
- `linkTarget:"_blank"` → `target="_blank"` on the link
- `rel:"noreferrer noopener"` → `rel="noreferrer noopener"` on the link
- (no `fontStyle` in JSON → no `font-style` in CSS; no `linkTarget` in JSON → no `target` in HTML)

### ⚠️ Six sequences MUST be `\uXXXX`-escaped inside block-comment JSON

WordPress escapes these when it serializes block attributes, because a raw `-->` would terminate the
comment. `serialize_block_attributes()`, `wp-includes/blocks.php`:

| in the JSON you write | WP serializes as | hit by |
|---|---|---|
| `--` | `\u002d\u002d` | **every CSS custom property** — `var(--x)` |
| `&` | `\u0026` | any text with an ampersand ("Terms & Conditions") |
| `<` | `\u003c` | text or markup inside an attribute value |
| `>` | `\u003e` | same |
| `\"` | `\u0022` | a quote inside a string value |
| `\` | `\u005c` | a literal backslash |

**The comment JSON and the inline style disagree on purpose — this is correct, not a typo:**

```
comment JSON : "fontFamily":"var(\u002d\u002dcl-fontN)"      <- escaped
inline style : font-family:var(--cl-fontN)                   <- plain
```

⚠️ **NEITHER VALIDATOR CATCHES A MISSED ESCAPE.** Plain `--` in the JSON still parses, so ground
truth passes and the page renders correctly today. It diverges only when the editor next re-saves the
post — long after delivery, with no error anywhere. A page using CSS custom properties hits this on
**every occurrence**; real conversions have needed 22-27 in a single page.

`validate_pattern.mjs` checks this mechanically (`checkCommentJsonEscaping`) precisely because nobody
catches 27 of them by eye.

**Write a SHAPE, never a real id.** `var(\u002d\u002dcl-fontN)` — a specific slot number is one
store's choice, and this file ships to stores we have never seen.

### `wp:button` link-attribute requirements

If the rendered `<a>` has any of these HTML attributes, the JSON MUST include the matching key:

| HTML attribute | Required JSON key |
|---|---|
| `target="_blank"` | `"linkTarget":"_blank"` |
| `rel="noreferrer noopener"` | `"rel":"noreferrer noopener"` |
| `title="..."` | `"title":"..."` |

For external links opening in a new tab, the canonical JSON is:
```json
{"linkTarget":"_blank","rel":"noreferrer noopener","style":{...}}
```

### `core/image`
- `"sizeSlug":"large"`, `"width":"480px"`, `"height":"auto"`, `"aspectRatio":"4/3"`, `"scale":"cover"`.
- `"linkDestination":"none"|"media"|"attachment"|"custom"`, `"href":"..."`.

**Serialization rules (validator-enforced — these caused "invalid content" in this project):**
- **All visual styles land on the `<img>`, never the `<figure>`**: border (color/width/radius), `width`/`height`, `aspect-ratio`, `object-fit`. The ONLY inline style the `<figure>` legitimately carries is `margin-*` (from `style.spacing.margin`).
- `style.border` in JSON → figure class list gains **`has-custom-border`** (alongside `is-resized` when width/height set).
- `style.border.color` in JSON → the **`<img>`** gains `class="has-border-color"` (separate from the figure's `has-custom-border` — BOTH are required, on different elements). This one is easy to miss and produced a real "invalid content" error in this project; confirmed against WP's own `getSaveContent()`.
- `"scale":"cover"` in JSON ↔ `object-fit:cover` on the img — both or neither.
- Never write `border-style:solid`: WP's global CSS applies border-style automatically when a border-width is present; adding it inline (or `"style":"solid"` in JSON) drifts from canonical output.

Canonical circular bordered image: see `snippets.md` #9.

### `core/list` + `core/list-item`
- `"ordered":true` for `<ol>`.
- Each `wp:list-item` holds rich text.
- ⚠️ **WordPress writes `style` BEFORE `class` on the `<ul>`/`<ol>` tag — the opposite of `core/paragraph` and `core/heading`, which put `class` first.** With `style.color.text` set, WP's `save()` emits `<ul style="color:#2e2c2a;…" class="wp-block-list has-text-color">`, not `<ul class="has-text-color" style="…">`. The class itself is still `has-text-color` (present, not omitted) — only the attribute order differs, and that order is not validated: the same markup with `class` first validates too (measured on the pinned packages, 15-09-2026 — this note used to say attribute order is enforced and caught by the ground-truth validator). Copy WordPress's order for tidy diffs; no validator will catch it.
  ```html
  <!-- wp:list {"style":{"typography":{"fontSize":"16px","lineHeight":"1.8"},"color":{"text":"#2e2c2a"}}} -->
  <ul style="color:#2e2c2a;font-size:16px;line-height:1.8" class="wp-block-list has-text-color">
  <!-- wp:list-item -->
  <li>…</li>
  <!-- /wp:list-item -->
  </ul>
  <!-- /wp:list -->
  ```

### `core/separator`
- Style variations: `{"className":"is-style-default"|"is-style-wide"|"is-style-dots"}`.

**Required class — easy to forget:** every `wp:separator` saves with `has-alpha-channel-opacity` on the `<hr>`, regardless of styling. Without it, the parser flags "Block contains unexpected or invalid content" on the next paste even if everything else is correct. When custom color is set, both `has-text-color` AND `has-background` are also added (the `<hr>` uses both `color` and `background-color` for cross-browser line rendering).

Canonical markup with custom color and margin:
```html
<!-- wp:separator {"style":{"color":{"background":"#C14436"},"spacing":{"margin":{"top":"16px","bottom":"32px"}}}} -->
<hr class="wp-block-separator has-text-color has-background has-alpha-channel-opacity" style="background-color:#C14436;color:#C14436;margin-top:16px;margin-bottom:32px"/>
<!-- /wp:separator -->
```

Without custom color (theme default):
```html
<!-- wp:separator -->
<hr class="wp-block-separator has-alpha-channel-opacity"/>
<!-- /wp:separator -->
```

Note: when custom color is set, the inline `style` includes BOTH `background-color` and `color` (same value) — even though only `style.color.background` is in the JSON. This is one of the rare exceptions to the "inline style must mirror JSON exactly" rule, because WP's separator save deliberately mirrors the color into both CSS properties for `<hr>` cross-browser compatibility.

### `core/spacer`
- `{"height":"var:preset|spacing|60"}` — prefer this over empty padding when inserting flexible space between blocks.

### `core/media-text`
- `{"mediaPosition":"left"|"right","mediaWidth":50,"verticalAlignment":"center"}` for image+text side-by-side.

### `core/quote` and `core/pullquote`
- `{"citation":"Person, Role"}` not always needed; use inner `<cite>` for richer formatting.

### `core/gallery`
- `{"columns":3,"linkTo":"none","sizeSlug":"medium","imageCrop":true}`.

### `core/table`
- `{"hasFixedLayout":true}`. Use only for tabular data, not layout.

### `core/details` (WP 6.5+)
Collapsible content. Use for FAQs.
```json
{"summary":"Question?"}
```
Contains inner blocks for the answer.

### `core/embed`
For YouTube, Vimeo, Twitter, etc. Specify `"providerNameSlug":"youtube"` and `"url":"..."`.

## What you CANNOT do natively (forces `wp:html` or graceful drop)

- Hover-only style changes (color shift on `:hover`).
- CSS animations / transitions.
- `:before`/`:after` pseudo-elements with content.
- Sticky positioning beyond what `wp:cover` provides.
- Inline SVG with custom paths (use `wp:image` with an SVG file).
- Forms (no native form block — escalate to user).
