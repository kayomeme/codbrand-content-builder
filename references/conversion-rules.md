# HTML/CSS → Native Block Mapping

Cheat sheet for translating source markup into native blocks. Use this top-down: pick the smallest block that captures the intent.

## CodBrand namespace marker (mandatory on every pattern)

Every pattern's outermost block carries `"className":"cod-brand"`. This namespace marker is what `patterns-global-codbrand.js` uses to scope editor-UX enhancements to our patterns only.

**Class-list ordering** on the rendered outermost element:
```
wp-block-{type}  →  cod-brand  →  align{full|wide}  →  has-background  →  has-text-color  →  ...
```

Examples by root block type:

```html
<!-- wp:group {"className":"cod-brand","align":"full","style":{"color":{"background":"#f5f4ec"}}} -->
<div class="wp-block-group cod-brand alignfull has-background" style="background-color:#f5f4ec">

<!-- wp:cover {"className":"cod-brand","url":"...","minHeight":480,"minHeightUnit":"px"} -->
<div class="wp-block-cover cod-brand" style="min-height:480px">

<!-- wp:columns {"className":"cod-brand"} -->
<div class="wp-block-columns cod-brand">
```

When merging with other classNames the user might want (e.g. `is-style-positionable` for legacy snippets), keep `cod-brand` first: `"className":"cod-brand is-style-positionable"`.

**Stamp it on the outermost root only, never on every block.** The marker is read by ancestor walk — anything asking "is this ours?" checks the block and every ancestor — so a `wp:cover` deep inside a `cod-brand`-marked `wp:group` is already covered. Repeating it down the tree adds noise and nothing else.

## Visual-fidelity audit (run before writing any markup)

### Step 0 — MANDATORY element inventory (write it out, never do it mentally)

Before generating ANY markup from a screenshot, write an inventory table in your response — one row per distinct element, and one row per repeated item type (card, list row, column):

| Element | Own container? (bg / border / shadow / radius) | Icon style (monochrome / colorful / none) | Typography (size / weight) | Spacing notes |
|---|---|---|---|---|

Rules for filling it:

- **"Own container?" is the single most-missed detail.** Repeated items often sit on subtle light-gray or slightly-off-white rounded cards that are easy to overlook against a white page. Look specifically at the item's corners and edges before answering. If the item has ANY background, border, shadow, or radius of its own in the source, it MUST become a styled `wp:group` wrapper (`style.color.background` + `style.border.radius` + `style.spacing.padding`). A conversion once shipped feature cards as bare columns because this question was never explicitly asked.
- Write "none" when the answer is genuinely none — an empty cell means you didn't check, and the conversion must not proceed.
- **Icon rule:** an OS emoji is never monochrome — if the design shows white/single-color line-art icons (e.g. on colored tiles), emoji are a fidelity mismatch, not just a placeholder. Prefer a placeholder image asset with explicit size. If emoji ARE used as placeholders, the pattern's `Description` header MUST say so and tell the user to replace them — the validator warns otherwise (`checkEmojiPlaceholders`).

Only after the table is written, map each row using the checklist below.

### Step 0b — WHEN YOU HAVE THE SOURCE HTML, diff it. Mandatory before delivery.

⚠️ **Step 0 above is scoped to a SCREENSHOT** ("Before generating ANY markup from a screenshot").
On the HTML path the source markup is right there and can be compared **mechanically** — and until
now nothing told you to. Two silent losses got through that way, both invisible to every validator.

**Neither validator can EVER catch this.** `validate_pattern_wp.cjs` checks the markup round-trips
through `save()`; `validate_pattern.mjs` checks conventions. **Neither has seen the source.** A
flattened heading and a dropped `max-width` are both perfectly valid markup.

Count these markers in the source and in your output, and compare:

| marker | how it vanishes silently |
|---|---|
| `<br>` inside a heading | flattened to a space — distinct from `<br><br>` in a paragraph, which correctly becomes two paragraphs |
| `max-width` | the container silently inherits full width |
| `position:absolute` | the element rejoins normal flow |
| fixed `height` / `width` on an embed | replaced by a "reasonable" value |
| `object-position` / `object-fit` | reverts to default centring |

**Counting is enough.** Source count vs output count, per marker. You do not need to match them up.

⚠️ **THE RULE IS *NAME IT*, NOT *PRESERVE IT*.** Every dropped marker gets one line in your
delivery report; the user decides. Do **not** write "always preserve" — that is a different error.

> Measured: three headings stacked with `<br>` were flattened silently. Told to match the original,
> the conversion restored them — and was then asked for single-line headings after all. **The defect
> was never "I changed it". It was "I changed it SILENTLY."** Both outcomes were acceptable; only the
> silence was not.

### Per-aspect checklist

Walk this for **every section** of the design. Skipping this is how patterns end up looking generic instead of matching the source.

| Aspect | What to check | Where it lands in the pattern |
|---|---|---|
| **Form inputs** (email, search, text) | Visible in design? | A `wp:group` with border + padding settings holding a grey paragraph — it looks like an input and the merchant can restyle it (see "Non-native UI primitives") — never drop |
| **Bordered chips** (country switcher, tag pill) | Subtle border + padding? | A `wp:group` (or `wp:button`) with `style.border` + padding settings — never a styled `wp:html` |
| **Typography weight** | Regular / semi-bold / bold per element? | Explicit `style.typography.fontWeight` (e.g. `"400"`, `"600"`, `"800"`) |
| **Font size** | Pixel-precise vs theme default? | Explicit `style.typography.fontSize` if design specifies |
| **Letter spacing** | Tight, normal, loose? Branding usually has tracking. | `style.typography.letterSpacing` (e.g. `"0.1em"`) |
| **Line height** | Tight (1.2) for headings, loose (1.6) for body? | `style.typography.lineHeight` |
| **Vertical rhythm** between repeating items (link lists, card grids) | Tight (12-14px) or generous (24-32px)? | Wrap items in `wp:group` with explicit `style.spacing.blockGap` |
| **Section padding** | Tight or generous? Asymmetric? | `style.spacing.padding` per side |
| **Borders / dividers** | Color, width, presence? | `style.border` on wrapper; `wp:separator` with custom color for dividers |
| **Button width** | Auto, partial, or full-width? | `width:25` / `50` / `75` / `100` JSON attribute |
| **Button shape** | Rounded, pill, or sharp? | `style.border.radius` (e.g. `"0px"`, `"9999px"`) |
| **Icon style** | Colorful brand vs monochrome vs filled? | Monochrome line icon: a bare `<svg>` coloured by its group's text colour (`SKILL.md` → "Icons"); colourful brand icon: an uploaded file in `wp:image` |
| **Image position in card** | Background, side, top, bottom? | `wp:cover` for background; `wp:image` inline for top/bottom; `wp:media-text` or `wp:columns` for side-by-side |
| **Content position over image** | Top/middle/bottom × left/center/right? | `wp:cover` with `contentPosition:"<v> <h>"` |
| **Min-heights for matched columns** | All columns same height in design? | Explicit `style.dimensions.minHeight` or `wp:cover` `minHeight` |

## Non-native UI primitives — draw them with core blocks, do NOT drop

If the design has any of these and there's no native equivalent or plugin available, draw a visual placeholder with core blocks and their settings, and name the limitation in your hand-over:

- **Form inputs** (`<input>`, `<textarea>`, `<select>`)
- **Currency / language switchers** with chevron arrows
- **Custom dropdowns** (mega-menus, filter bars)
- **Range sliders / interactive controls**

The look is block settings — a group's border, background, radius and padding, a paragraph's colour and size — so the merchant can restyle it in the block editor. An input is the group below ("The way to draw it"); a chip is the same group in flex layout with its label (and a chevron character) in the paragraph. What no setting can express is handed-over CSS (`SKILL.md` step 6).

Edge: a `wp:html` is opaque to the block editor — nothing in it is a setting, and the merchant can change it only as code. So it never carries the look: at most it holds what no core block can draw, such as an icon's `<svg>` (`SKILL.md` → "Icons"). `validate_pattern.mjs` errors on any `style=""` inside a `wp:html`. *(Changed 30-09-2026: this section shipped two styled-`wp:html` examples — an `<input>` and a chip — which the validator now fails.)*

### ⚠️ `wp:html` sanitization — the tag decides, not the user role

Content saved by users without the `unfiltered_html` capability (Editors, Authors, Contributors) is run through `wp_kses_post`. Whether content survives depends on the **tag**: decorative tags pass through for every role; interactive/executable tags are stripped. A `wp:html` block with an `<input>` that "works fine when I preview as admin" loses the input as soon as a non-admin saves the post — so `wp:html` for form inputs is fragile. See the allow/strip tables below for the exact rules.

**The way to draw it — block settings:** style a `wp:group` (with `style.color.background`, `style.border`, `style.spacing.padding`) to LOOK like an input field, with an inner `wp:paragraph` containing placeholder-styled text (gray color, e.g. `#9ca3af`). The rendered group looks identical to a real input in most contexts, but renders for every user role.

```html
<!-- wp:group {"style":{"color":{"background":"#ffffff"},"border":{"width":"1px","color":"#d4d4d4"},"spacing":{"padding":{"top":"14px","right":"16px","bottom":"14px","left":"16px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group has-border-color has-background" style="border-color:#d4d4d4;border-width:1px;background-color:#ffffff;padding-top:14px;padding-right:16px;padding-bottom:14px;padding-left:16px">
  <!-- wp:paragraph {"style":{"color":{"text":"#9ca3af"},"typography":{"fontSize":"15px"}}} -->
  <p class="has-text-color" style="color:#9ca3af;font-size:15px">Your email</p>
  <!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
```

### What `wp_kses_post` actually allows vs. strips

These tables are what WordPress's HTML filter lets through — **not what this skill uses**. Whatever kses
allows, any `style=""` inside a `wp:html` fails step 5 (a): the merchant cannot change it in the editor.

**✅ Safe via `wp:html` (renders for every user role)** — these tags pass through `wp_kses_post`:

| Tag | Common use |
|---|---|
| `<div>`, `<span>` | Decorative wrappers, badges, chips, custom backgrounds, absolute-positioned decorations |
| `<svg>`, `<path>`, `<g>`, `<circle>`, `<rect>`, `<line>`, `<polygon>`, `<polyline>` | Inline icons (with `viewBox`, `fill`, `stroke`, `stroke-width`, `d`, `transform`, etc.) |
| `<sup>`, `<sub>`, `<mark>`, `<cite>`, `<small>`, `<strong>`, `<em>`, `<s>`, `<u>` | Inline text formatting |
| `<dl>`, `<dt>`, `<dd>`, `<table>`, `<thead>`, `<tbody>`, etc. | Structured content |
| `style` attribute on any allowed tag | Inline CSS — including `-webkit-text-stroke`, `position:absolute`, `display:flex`, `transform`, etc. |

**❌ Stripped by `wp_kses_post`** — these vanish or appear as escaped raw text:

| Tag | Why |
|---|---|
| `<input>`, `<form>`, `<button>`, `<select>`, `<textarea>`, `<option>` | Interactive form elements — security risk |
| `<script>`, `<style>` (block, not the attribute) | Code/CSS injection risk |
| `<iframe>` | Limited; only specific allowed sources |

**Decision rule:**

- **An icon?** → a bare `<svg>` in a `wp:html`, sized and coloured by the settings of its Icon group (`SKILL.md` → "Icons"). **A chip, a badge, a decorative box?** → a core group with border, background, radius and padding settings. **An effect no setting can express** (outlined text via `-webkit-text-stroke`, an absolute-positioned decoration)? → build the static version with settings and hand the CSS over with its level and a `className` (`SKILL.md` step 6) — never a styled `wp:html`, which the merchant could not change.
- **Need a real `<input>`, `<form>`, `<select>`, `<button type="submit">`, or `<script>`?** → DON'T use `wp:html`. Build a `wp:group` mimicking the visual with settings (see "The way to draw it" above) or use a real native block (`wp:search`, `wp:categories displayAsDropdown:true`, etc.).

### `wp:html` in the block editor — measured on WordPress 7.1

The block editor shows a Custom HTML block that is not being edited as a **live preview** (measured
30-09-2026, WordPress 7.1): an icon's `<svg>` inside one previews at the size and colour its group's
settings give it, and changing those settings in the editor changes the icon. *(An earlier version of
this section said the editor shows raw code by default and the preview needs a click, and used that to
recommend icons as images — neither holds on WordPress 7.1.)*

**⚠️ A data URI in `wp:image src` does NOT survive WP's pipeline.** While browsers render data URIs fine, WP's editor parses `<img src=...>` on paste and gets confused by HTML-special characters inside the data URI (`<`, `>`, `'` from inline SVG). The saved `wp:image` block ends up with an empty `url` attribute — broken image on frontend, even for admin users. Tested and confirmed.

**An icon is never an image URL** — the page would load it from another site on every view, and its
colour could not follow the text colour. Placeholder IMAGES are another matter:

| What you need | Use |
|---|---|
| **Line icons** (bolt, plus, arrows, delivery, payment) | a bare `<svg>` in a `wp:html` (`SKILL.md` → "Icons"). [Iconify](https://api.iconify.design/) is where its code comes from at authoring time — `https://api.iconify.design/<set>/<name>.svg` returns it already sized `1em` in `currentColor`; browse at [icones.js.org](https://icones.js.org/). The page never loads it. |
| **Brand / multi-colour logos** | a `wp:image` of an uploaded file |
| **Solid color rectangles** (dividers, accent bars) | block settings — a border or a `wp:separator` with its colour — not an image |
| **Image placeholders** (hero, photos) | `https://placehold.co/<W>x<H>/<bgHex>/<textHex>?text=Label` — meant to be replaced |


### 🔴 Asset URL rules — what a portable pattern may reference

| Source | Allowed? | Why |
|---|---|---|
| `placehold.co`, `ui-avatars.com` | ✅ | Stable placeholder services — the pattern's images are meant to be replaced by the user anyway. *(`api.iconify.design` was listed here until 30-09-2026; an icon is inline svg now, never a URL — `SKILL.md` → "Icons".)* |
| Gradients / solid `style.color.background` instead of an image | ✅ preferred | Zero external dependency (Automattic's official skill recommends this when no real asset exists) |
| Theme-shipped asset via `<?php echo esc_url( get_theme_file_uri( 'assets/images/x.jpg' ) ); ?>` | ✅ (php only) | Child-theme aware — preferred over `get_template_directory_uri()` |
| **Dev/staging/client site URLs** (`*.hostingersite.com`, `woo.test`, any project host) | ❌ NEVER | They rot, leak the environment, and break when the site moves. This bit us: `product-grid-4-col` shipped 10 live Hostinger URLs |
| Hotlinked stock photos (Unsplash page URLs, CDN links) | ❌ | Often fail to load in the editor iframe; licensing ambiguity |

Rule of thumb: if the URL contains a hostname you or the client control, it does not belong in a reusable pattern — swap it for a placeholder and note in the Description that images are placeholders.

### Accessibility rules (mandatory checks before finishing a pattern)

- **`Description` header is a screen-reader field** — it's read aloud when browsing the inserter. Write it as a factual description of the pattern's content and structure, not marketing copy.
- **Icon-only links/controls need an accessible name.** An `<a href="#">🛒</a>` announces as "cart emoji" at best, nothing at worst. Prefer icon + visible text label. If the design is strictly icon-only, note the limitation in the Description so the user adds labels when wiring real URLs (native paragraph links can't carry `aria-label` reliably through RichText).
- **Emoji as icons**: acceptable as placeholders, but flag them in the Description ("replace emoji icon placeholders with real icons") — screen readers read emoji names aloud, which is noisy in navigation.
- **`alt` text**: meaningful for content images (product photos: use the product name), empty `alt=""` for purely decorative images (background covers, ornaments). Never omit the attribute entirely.
- **Heading hierarchy**: one visual section = descending heading levels without gaps (h2 → h3, not h2 → h5).
- **Tap targets need 24px of height — WCAG 2.2 AA (2.5.8).** A bare `<li><a>` from a theme's nav, a
  `<summary>`, or a footer link renders at the line-box height and nothing else: measured live at
  **16px** for nav links and **20px** for a FAQ summary on markup this skill had just produced. No
  validator sees this — nothing in the markup is wrong; the height only exists once rendered. So it is
  yours to prevent at authoring time: give any link that is a standalone control its own
  `style.spacing.padding` (≥4px top and bottom on 16px text clears 24px), and prefer a `wp:button`
  over a bare paragraph link for anything the visitor is meant to tap.
- **This skill emits page content, not design-level CSS.** When a target is only reachable by styling
  the theme's own output (a nav `<li><a>` the theme prints itself), say so in the Description rather
  than assuming someone will notice — the fix belongs to whoever owns that CSS.
- **The page's ONE `<h1>` comes from its hero pattern, NOT from the theme.** This corrected an earlier
  line here that said *"patterns usually start at h2 (h1 is the page title)"* — that premise no longer
  holds. The codbrand theme does not print a page title by default: its **Show page title** page option
  is off, and the markup is never emitted (not hidden with CSS). So a page whose patterns all start at
  h2 ships with **zero** h1 — measured live 30-08-2026, an About page built this way rendered
  `h1s: []`, every heading an H2 or H3.
  So: the **first / hero pattern on a page uses `level:1`** — the *Centered hero* recipe below already
  does — and every pattern after it starts at h2. When you are producing a single pattern and cannot
  know whether it will be first on the page, say so in its `Description` so whoever assembles the page
  can promote its top heading.

**When to use `wp:html` vs `wp:image`:**
- A line icon → a bare `<svg>` in a `wp:html`, sized and coloured by its Icon group (`SKILL.md` → "Icons")
- A raster or multi-colour icon, or anything the merchant should swap with the toolbar's Replace → `wp:image` of an uploaded file
- Lines, dividers, bars → block settings (a border, a `wp:separator`), not an image
- Multi-element decorations → core groups with their settings; what no setting can express is handed-over CSS (`SKILL.md` step 6) — never a styled `wp:html`

### Badge/label overlaid on an image — `wp:cover` recipe (one overlay region only)

When the design shows an element floating ON an image (numbered badge, category label, price tag), the native mapping is `wp:cover` with `contentPosition`:

- Thumbnail/photo → cover's `url` background image.
- The floating element → cover's inner blocks, positioned via `contentPosition` (e.g. `"top left"` for a corner badge).
- The user can then reposition it with the editor's 9-cell picker — a feature, not a hack.

**Hard limitation: one positioned region per cover.** All inner blocks share the single `contentPosition`. A design with BOTH a corner badge AND a centered play button cannot be replicated natively — pick the element the client will edit (usually the badge), let the other come from the real image asset, and state the dropped element in the pattern's Description. Canonical serialized markup: see `block-supports.md` → `core/cover` (dim-class table, no-shadow rule).

### RTL sections (Arabic/Hebrew designs)

- **Set explicit `textAlign`/`align` on text that must stay edge-aligned** (`"textAlign":"right"` on card titles, `"align":"right"` on paragraphs). Relying on site direction breaks the preview on LTR test sites; explicit alignment holds everywhere.
- **Column order: write markup in logical reading order (1, 2, 3).** On an RTL site, `wp:columns` renders row-reversed automatically, so cards display 3-2-1 left-to-right — matching RTL screenshots. Do NOT pre-reverse the markup order to mimic the screenshot; that double-reverses on RTL sites.
- Centered content (headings, badges, descriptions) needs no special handling.
- Keep punctuation like `؟` inside the translatable string; never split Arabic strings mid-sentence across blocks (breaks translation and bidi rendering).

### Per-side borders on text blocks — Astra trap

⚠️ **Corrected 05-09-2026: a per-side border does NOT add `has-border-color`.** An earlier version of
this section said it did, and built workaround 3 on that premise. `emit_block.cjs` (WordPress's own
`save()`) disproves it — the class comes from a FLAT `style.border.color` only:

```
{"style":{"border":{"top":{"color":"#7a6e5a","width":"3px"},"right":{…},"bottom":{…},"left":{…}}, …}}
  -> <p class="has-background" style="border-top-color:#7a6e5a;border-top-width:3px;border-right-color:…">
     (NO has-border-color)

{"style":{"border":{"color":"#b8a87a","width":"1px"}, …}}
  -> <p class="has-border-color" style="border-color:#b8a87a;border-width:1px;…">
     (has-border-color)
```

So **writing `has-border-color` onto a per-side-bordered block is itself a parser error.** Verified on
a 116-block page (pov.ma return-policy, 05-09-2026) whose cards use per-side borders throughout and
pass both validators without the class.

**What remains true:** a theme rule on `.has-border-color` (Astra's) still bites blocks that set a
flat border colour. WordPress core's own `html :where(.has-border-color){border-style:solid}` is
`:where()`-wrapped, so it carries zero specificity and is not the trap — a theme's own unwrapped rule
is. The workarounds below apply to the FLAT-border case only.

**Workarounds:**
1. **Drop the border entirely** — use italic + padding-left for the quote indent. Works in any theme.
2. **Use a flex layout** — wrap the quote in a `wp:group` flex row containing a thin colored `wp:image` (data URI) + the paragraph. The image acts as the visible "border."
3. **Explicitly zero the other sides** — set `style.border.top/right/bottom.width:"0"` in JSON so the inline style overrides theme defaults. Verbose but precise.

For most patterns option 1 is cleanest. Italic quotes don't strictly need a colored bar; the typographic differentiation reads as a quote on its own.

## Categories dropdown — native vs WooCommerce

| Source design need | Native solution | Plugin needed |
|---|---|---|
| **Post categories `<select>`** | `wp:categories` with `"displayAsDropdown":true` ✅ | none |
| **Product categories `<select>`** (e-commerce) | ❌ no native equivalent | WooCommerce required |
| **Tag dropdown** | `wp:tag-cloud` (cloud UI, not real `<select>`) | none |
| **Filter-by-author dropdown** | ❌ no native | plugin |

The native `wp:categories displayAsDropdown:true` renders as a real `<form><select>` of post categories. Self-closing block:

```
<!-- wp:categories {"displayAsDropdown":true} /-->
```

When the design has a "category filter" inside a search bar, this can stand in as a placeholder — the visual won't perfectly match a tightly-integrated filter (it renders its own `<form>`), but it functions as a real categories dropdown for any user role (no `unfiltered_html` issue).

For e-commerce sites with **product** categories, **WooCommerce is required** — there is no pure-native equivalent. The closest options:

- WooCommerce `[product_categories]` shortcode in `wp:shortcode` block (lists categories, not a dropdown)
- WooCommerce's `wc_dropdown_product_cats()` function via a custom block or `wp:shortcode`
- WooCommerce filter widgets/blocks (in WooCommerce 8.0+)

If the project's brief is "no plugins" but the design clearly shows a product-category dropdown, flag the gap: ship `wp:categories` (post categories) as a placeholder OR a styled paragraph, and note in the pattern's `Description` that WooCommerce is needed for the product-categories functionality.

## ⚠️ `align:"full"` does NOT mean full-bleed on a COD Leads storefront

**The store owns page width, and a page cannot out-muscle it from block markup.** This is the single
most misleading thing you can carry over from generic WordPress knowledge, because the class is
present, the markup validates, and the effect is simply absent.

**The mechanism, verified in the companion theme's own stylesheet:**

```css
/* wp-content/themes/codbrand/style.css */
.alignwide,
.alignfull {
    max-width: none;
}
```

That is the whole rule. **Removing a `max-width` does nothing against a parent's `padding`** —
escaping padding needs negative margins, and nothing provides them. So on a storefront the root
`alignfull` block sits inside the store's width wrapper and is inset by that wrapper's gutters.

**Measured on a live store** (`pov.ma`, width mode `cl-full-width-padded`):

```
<main class="codbrand-content cl-full-width-padded">   padding: 80px left / 80px right
the alignfull root:  left: 80px, width: 1265px  — 80px gutters, site background showing
at 375px:            24px gutters
```

**There are four width modes** — `cl-full-width`, `cl-full-width-padded`, `cl-boxed-mode`,
`cl-boxed-mode-padded` — and a fifth value, **`none`**, meaning no wrapper at all. The gutter values
are store settings (`full_width_padded_style` ships `80px`, `full_width_padded_mobile_style` ships
`24px`), so **read the store's actual value rather than quoting the shipped one** — on
demo.codbrand.pro it is `32px`, not `80px`.

### ⚠️ Correction — a page's width IS settable at publish, and NO store setting controls it

An earlier version of this page said true bleed "needs a width-mode change the merchant makes in
Store settings — not something this markup can do." **Both halves are wrong**, and the expensive one
is the first: it sent readers looking for a setting that does not exist, and told them to stop.

**There is no store-level setting for an ordinary page's width.** The store's width settings are
per-SURFACE — `cart_width_mode`, `category_width_mode`, `checkout_width_mode`, `product_width_mode`,
`search_width_mode`, `thankyou_width_mode` — and not one of them touches a page you author. A page
takes the theme default (`codbrand_width_default()` → `cl-full-width-padded`) unless the page itself
overrides it.

**The override is a per-page plugin option, and it is one call at publish time:**

```
PATCH /cl-api/v1/pages/{id}/plugin      {"width_mode": "none"}
```

`""` inherits the theme default · `none` removes the wrapper entirely · or name one of the four
classes. **It is a fourth delivery fact alongside title / slug / target** — see `output-format.md`.

**Measured on demo.codbrand.pro, 18-09-2026.** A lookbook page published under the inherited default
put all 8 of its bands at `x=32, w=1344` in a 1408px viewport. The same page, same markup, with
`width_mode: "none"`: every band at `x=0, w=1408`, no horizontal overflow, a hero that actually
reaches both edges.

**Three consequences for how you author:**

1. **Decide the page's width and DELIVER it — do not design around not knowing.** A banded,
   full-bleed layout wants `none`. A prose page wants the padded default, which is the only thing
   keeping its text off the viewport edge. The markup still cannot set it, so hand the value over
   with the file; what you must not do is call the gutters unavoidable.
2. **A full-bleed dark design will show the SITE background in the gutters** on any page that is NOT
   published with `width_mode: "none"` — `alignfull` removes the `max-width` and leaves the
   wrapper's padding standing. Ship `none`, or put the background on the root block and accept the
   gutters. Both are real answers; "the merchant has to change a setting" is not.
   ⚠️ **Put the background on the root block and that block needs its OWN horizontal padding**
   — see the floor below. The wrapper's gutters inset the block *and its background together*, so
   they move the band inward without ever moving the text off the band's edge.
3. **Keep using `align:"full"`** — it is still correct markup and still removes the max-width. Just
   never promise "full-bleed" from it ALONE, and never verify a width change at desktop only (see
   the narrow-viewport item in SKILL.md's checklist).

## Backgrounds: decide WHO owns the page width, ONCE, before you paint anything

**Measured on a live store, 20-09-2026** (`snow-dotterel-624509.hostingersite.com`). Seven authored
pages, every one on the padded default, every one carrying a single root block styled
`background-color:#ffffff;padding-top:72px;padding-bottom:80px` — no horizontal padding, no radius,
7 to 15 text children sitting directly inside it. The store page is `#f6f6f9`, so each page rendered
a square white slab floating in grey with its text welded to both edges.

**The same agent, on the same pages, got a small callout right every single time:**
`background-color:#ebeaf3;padding:18px 22px;border-radius:3px`. It padded the SMALL painted element
and left the BIG one bare — because it was not thinking of the root block as a box at all. **It was
using a block background to set the PAGE background.** On a padded page that is not what a block
background does: the page's gutters inset the block, so what you get is a card you never designed.

### Three different jobs, three different doors

| You want | Do this | Never |
|---|---|---|
| the whole page a different colour | `PUT /pages/{id}/plugin {"background": "var(--cl-page-bg-color2)"}` — the **Page Backgrounds** palette category, slots 23–26; slot 24 is literally "white page surface" | paint the root block |
| full-width bands of alternating colour | publish the page `width_mode: "none"`, then each band paints its own background **and owns its horizontal padding** | `alignfull` + a background on a padded page — the band cannot reach the edges |
| a card or callout | background **+ horizontal padding + a radius**, on that one block | a bare background |

### The rule — ONE owner of the width per page

- **The PAGE owns it** (the padded default; the right choice for prose — FAQ, legal, about, contact).
  Root-level blocks then paint **NO** background and inherit the page's. Only a deliberate card
  paints, and it carries padding and a radius so it reads as a card on purpose.
- **The BLOCKS own it** (`width_mode: "none"`). Every band then paints its own background edge to
  edge and owns its horizontal padding, because nothing else insets its text.

Mixing the two is the defect above, and it is **silent**: every call returned `200`, and the page
looks deliberate in a screenshot until you notice the text touching the slab.

**The tell when reviewing generated markup:** a root-level block with a background, **radius 0**, and
no horizontal padding is band markup that landed on a padded page. A real card has a radius.

### Spacing has to ENCODE the grouping — and a default is not spacing

Same pages, measured: inside a Q&A pair (`h2` → its answer) the gap was **0px**; between one pair and
the next, **16px**. Both are browser defaults — the agent set no vertical spacing at all. It reads as
one undifferentiated wall, with nothing showing where an answer ends and the next question begins.

A group is legible when the gap INSIDE it is visibly smaller than the gap BETWEEN it and its
neighbour, **and neither is zero**. Set both on purpose.

**`blockGap` DOES work on the codbrand theme** — its `theme.json` declares `"appearanceTools": true`,
which switches on `spacing.blockGap`. But it also declares `"defaultSpacingSizes": false`, so a
`var:preset|spacing|N` value resolves to nothing and vanishes silently. **Give `blockGap` a literal**
(`"24px"`), never a preset token. Both halves are already flagged by the validator —
`checkBlockGapReliance` and `checkPresetTokens`.

## ⚠️ Horizontal padding has a CEILING and a FLOOR — never use it to control text measure, never leave it at zero under a background

*(This section was headed "NEVER use fixed px horizontal padding to control text measure" until
20-09-2026. Everything it said was true and it is kept below — but it was the only rule in the skill
about horizontal padding, and it only ever pushed the value DOWN. A build followed it, set
`{"top","bottom"}` and nothing else, and shipped three pages with the text welded to a visible card
edge. A one-directional rule reads as "less is safer". It is not.)*

**Page width and block padding answer DIFFERENT questions, and they are not substitutes:**

| | decides |
|---|---|
| the page's width mode | where the block's **outer edge** lands |
| the block's own padding | where the **text** lands inside that edge |

A block with no background is invisible, so zero horizontal padding is harmless — the page gutters
are the only inset anyone can see. **The moment the block paints a background or a border, its own
edge becomes visible**, and zero horizontal padding becomes text sitting exactly ON that edge. The
page's gutters cannot rescue it, because they inset the background too.

**Measured on a live store, 20-09-2026** (`snow-dotterel-624509.hostingersite.com`): the FAQ,
delivery and contact pages each shipped one root block styled
`background-color:#ffffff;padding-top:72px;padding-bottom:80px`. The page background is `#f6f6f9`,
so the white card was plainly visible, 1248px wide — and the measured gap between the card's edge
and the first character was **0px**, on every page, both sides. `validate_pattern.mjs` now ERRORS on
this: a `group`/`column` that paints a background or border, holds text directly, and leaves both
horizontal sides at zero.

### The ceiling

`padding` is a **fixed length: it does not shrink**. Using it to cap line length works at the width
you were looking at and fails catastrophically at every narrower one.

**Measured failure:** `padding-right: 260px` was added to `<details>` blocks to shorten lines. At
375px the usable width inside the store's 24px mobile gutters is ~327px, so that single declaration
consumed **260 of 327 pixels** and the questions rendered in a sliver, breaking words mid-word. Both
validators passed.

**Use a mechanism that SHRINKS:**

| Want | Use | Why it survives a phone |
|---|---|---|
| A narrower reading column, centred | `layout.type:"constrained"` + `contentSize` on the wrapper | `contentSize` is a max, not a floor — it yields below it. **But it CENTRES — see `block-supports.md` → Layout before choosing it.** |
| A narrower column that stays LEFT-aligned with its neighbours | an inner `wp:column` with a `%` width | percentages shrink with the parent |
| Breathing room at the edges | small symmetric padding (the corpus norm is 40px per side) | small enough to survive 327px |

`validate_pattern.mjs` warns above a 120px horizontal padding sum and errors at 200px — see its
`checkHorizontalPadding`. The corpus's own maximum is 80px (40+40), so the check cannot fire on
house-style markup. **The same function carries the floor**: zero horizontal padding on a painted
container that holds text directly is an error. A block whose children are all CONTAINERS is not
flagged — those own their own inset and are each checked in their own right.

## Container mapping

| Source | Native block | Notes |
|---|---|---|
| `<section>` / `<div>` with background, padding | `wp:group` with `align:"full"` and `style.spacing.padding` | Default container. |
| `<div>` with background image + overlay text | `wp:cover` | Use `dimRatio` for overlay opacity. |
| `<div>` with display:flex row (2-N children) | `wp:columns` | Auto-stacks on mobile. |
| `<div>` with display:flex (justify/align) on small inner items | `wp:group` with `layout.type:"flex"` | For button rows, icon+text pairs. |
| `<div>` with display:grid | **`wp:group` with `layout.type:"grid"` — FIRST CHOICE.** `wp:columns` only when a row must stay N-up below grid's auto-fit threshold. | Grid keeps the property `display:grid` had: it stretches every cell to the row height for free. ⚠️ **`wp:columns` silently LOSES that** — it stretches the COLUMN but NOT the inner card `wp:group`, so a shorter card leaves a gap inside its own full-height column and the painted backgrounds misalign (measured: cards 350px vs 358px, bottom edges **9px apart**, both columns 358px). The `minHeight` workarounds for that have BOTH failed on a real store. Read `responsive.md` → "Equal-height cards — USE GRID" before choosing, including the blockGap-gap caveat and the earlier auto-fit stacking threshold. |
| Fragment of inline elements | Inline within parent block | Don't wrap unnecessarily. |

## Text mapping

| Source | Native block |
|---|---|
| `<h1>`–`<h6>` | `wp:heading` with `level:N` |
| `<p>` | `wp:paragraph` |
| `<blockquote>` | `wp:quote` |
| Pullquote with citation | `wp:pullquote` |
| `<ul>` / `<ol>` | `wp:list` (`ordered:true` for `<ol>`) with `wp:list-item` children |
| `<details>` / accordion | `wp:details` (WP 6.5+) |

## Media mapping

| Source | Native block |
|---|---|
| `<img>` standalone | `wp:image` |
| `<img>` + caption | `wp:image` with inner `<figcaption>` |
| Multiple images grid | `wp:gallery` |
| Image left + text right | `wp:media-text` |
| `<iframe src="youtube...">` | `wp:embed` with `providerNameSlug:"youtube"` |
| Inline SVG (an icon) | A bare `<svg>` in a `wp:html` inside an Icon group — `SKILL.md` → "Icons". A multi-colour logo: `wp:image` of an uploaded file. |

## Interactive elements

| Source | Native block |
|---|---|
| `<a class="button">` solo | `wp:buttons` (wrapper) → `wp:button` |
| Multiple buttons in a row | one `wp:buttons` wrapper, multiple `wp:button` children, set `layout.justifyContent` on the wrapper |
| `<a>` plain text link | inline within `wp:paragraph` (use rich-text `<a>` tag) |
| `<form>` | NOT supported natively. Escalate to user. |

## CSS → block-attribute mapping

| CSS | Block JSON | Example |
|---|---|---|
| `padding: 80px 40px;` | `style.spacing.padding` | `{"top":"80px","right":"40px","bottom":"80px","left":"40px"}` |
| `margin: 0 auto;` (container) | `layout.type:"constrained"` | n/a — handled automatically |
| `gap: 24px;` (flex/grid) | `style.spacing.blockGap` | `"24px"` or `"var:preset|spacing|40"` |
| `background: #0d0d0d;` | `style.color.background` | `"#0d0d0d"` |
| `color: #fff;` | `style.color.text` | `"#ffffff"` |
| `background: linear-gradient(...);` | `style.color.gradient` | full CSS string |
| `border-radius: 12px;` | `style.border.radius` | `"12px"` |
| `border: 1px solid #ccc;` | `style.border` | `{"width":"1px","style":"solid","color":"#cccccc"}` |
| `font-size: 1.5rem;` | `style.typography.fontSize` or `fontSize` | literal `"1.5rem"` or preset slug `"large"` |
| `font-weight: 600;` | `style.typography.fontWeight` | `"600"` |
| `text-transform: uppercase;` | `style.typography.textTransform` | `"uppercase"` |
| `letter-spacing: 0.05em;` | `style.typography.letterSpacing` | `"0.05em"` |
| `line-height: 1.2;` | `style.typography.lineHeight` | `"1.2"` |
| `text-align: center;` | `textAlign` (heading) or `align` (paragraph) | `"center"` |
| `box-shadow: ...;` | `style.shadow` | preset or literal CSS string |

## Layout decision tree

```
Is the source a full-width section with background/padding?
  → wp:group { align:"full", style.spacing.padding, layout.type:"constrained" }

Does it have an image background with overlaid text?
  → wp:cover

Are children laid out side-by-side AND should stack on mobile?
  → wp:columns

Are children small inline items (icons, buttons, badges)?
  → wp:group { layout.type:"flex" }

Are children a uniform grid (cards) of 2-6 items?
  → wp:columns (most common — best authoring UX)
  → OR wp:group { layout.type:"grid", columnCount:N } if the design needs strict equal sizing

Otherwise (single column of stacked content)
  → wp:group { layout.type:"constrained" }
```

## Common pattern shapes (quick recipes)

### Centered hero
`wp:group(align:full, padding) → wp:group(layout:constrained, align:wide, blockGap) → wp:heading(center, level:1, xx-large) + wp:paragraph(center) + wp:buttons(layout:flex, justify:center) → wp:button`

### Service / feature card row
`wp:group(align:full, padding) → wp:heading(center, level:2) + wp:columns → 3× wp:column → wp:image + wp:heading(level:3) + wp:paragraph`

### Split media + text
`wp:group(align:full, padding) → wp:media-text(mediaPosition:left, mediaWidth:50) → inner: wp:heading + wp:paragraph + wp:buttons`

### Logo strip
`wp:group(align:full, padding) → wp:group(layout:flex, justify:space-between, flexWrap:wrap) → 5× wp:image`

### Footer with columns
`wp:group(align:full, padding, background) → wp:columns → 4× wp:column → wp:heading(level:4) + wp:list + wp:list-item …`

### CTA banner
`wp:group(align:full, padding, background:dark) → wp:group(layout:constrained, align:wide) → wp:heading(center, level:2) + wp:paragraph(center) + wp:buttons(layout:flex, justify:center)`
