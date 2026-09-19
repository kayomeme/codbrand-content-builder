# Responsive Without Custom CSS

Native blocks already handle mobile. Use them correctly and the pattern is responsive by default.

## Core rules

1. **No media queries.** Patterns must not include `<style>` tags. If a design needs explicit breakpoints, that's a theme.json or custom-CSS concern — not a pattern concern.
2. **`wp:columns` auto-stacks** below 782px (default). Don't fight it. Don't set `isStackedOnMobile:false` unless the design specifically needs side-by-side at all sizes (rare).
3. **`wp:group` with flex + `flexWrap:"wrap"`** lets children wrap to new rows when horizontal space is tight. Use this for logo rows, badge rows, button rows.
4. **Padding: prefer a preset ONLY on a block theme.** `var:preset|spacing|XX` scales on mobile *when the theme defines it* — a block theme's `theme.json` typically does. On a **CLASSIC theme there are no presets**, so `var:preset|…` resolves to nothing and the padding silently vanishes; the plugin's own `codbrand` companion theme is classic. Discover which you are on first (`theme-tokens.md`), then use presets or literals accordingly. *(An earlier version of this rule said "prefer presets over fixed `px`" unconditionally — that is wrong on half of all destinations.)*
5. **Use `align:"full"` for full-width sections, `align:"wide"` or no align for content-width sections.** ⚠️ **On a COD Leads storefront `align:"full"` does NOT produce full-BLEED** — the store's width mode owns the page gutters and the theme's only rule is `.alignfull { max-width: none }`, which cannot escape a parent's padding. Measured: 80px gutters on desktop, 24px on mobile. Read `conversion-rules.md` → "`align:\"full\"` does NOT mean full-bleed" before promising an edge-to-edge design. *(An earlier version of this rule said "full-bleed"; the class is correct markup, the promise was not.)*

## Common responsive patterns

### Logo / badge row that wraps
```json
"layout": {
  "type": "flex",
  "flexWrap": "wrap",
  "justifyContent": "space-between"
}
```
Gap is controlled by `style.spacing.blockGap`.

### 3-column card grid → 1-column on mobile
Use `wp:columns` with three `wp:column` children. Auto-stacks. No extra config.

### Side-by-side that should stay side-by-side (e.g. icon + label)
```json
"layout": { "type": "flex", "verticalAlignment":"center" }
```
With `flexWrap:"nowrap"` if absolutely needed.

### Hero with image and text, image on left desktop / above on mobile
Use `wp:media-text`. `mediaPosition:"left"` or `"right"`. Stacks above 600px breakpoint automatically.

### `clamp()` for a spacing step — the ONLY way to express a media query in block supports

Block supports have **no media queries**. When the source's only mobile change is a spacing step,
`clamp()` is the answer, and it needs no custom CSS:

```json
"padding":{"top":"0","right":"clamp(20px, 3vw, 40px)","bottom":"clamp(44px, 5vw, 60px)","left":"clamp(20px, 3vw, 40px)"}
```

For a source with `padding: 0 40px 60px` and `0 20px 44px` under `@media (max-width:700px)`, this hits
**both authored states exactly** — measured 20/44 at 375px and 40/60 at 1440px.

⚠️ **It matches at the ENDPOINTS and RAMPS between them — it does not reproduce the media query.**
A media query switches at one width; two `clamp()`s cross over at their own widths, and not together:

| viewport | clamp gives | the source gives | |
|---|---|---|---|
| 375px | 20 / 44 | 20 / 44 | ✓ |
| 700px | 21 / 44 | 20 / 44 | ramping |
| **900px** | **27 / 45** | **40 / 60** | ← **13px and 15px apart** |
| 1440px | 40 / 60 | 40 / 60 | ✓ |

`clamp(20px,3vw,40px)` pins at its max only above **1333px** and at its min only below **667px**;
`clamp(44px,5vw,60px)` pins above **1200px** and below **880px**. So between roughly 667px and 1333px
the two paddings are mid-ramp and out of step with each other.

**That is usually an improvement** — a smooth ramp instead of a jump — but it is a DIFFERENT behaviour
from the source, so it is a change to name in the delivery report, not a silent substitution
(conversion-rules.md → Step 0b). **Verify at the widths that matter to the design, not only at the two
endpoints, where agreement is guaranteed by construction.**

ℹ️ An earlier write-up of this pattern called it an exact reproduction of the media query, on the
strength of two measurements taken at 375px and 1440px — the two widths where a correctly-fitted clamp
*must* agree. The table above is what the intermediate widths actually do.

⚠️ **On `font-size`, fit a clamp with the letter-spacing term included** — text width is
`k × fontSize + (charCount × letterSpacing)`, not `k × fontSize`. See SKILL.md → Failure modes.

## Block-by-block responsive notes

| Block | Mobile behavior |
|---|---|
| `wp:columns` | Stacks to single column below 782px. Configurable via `isStackedOnMobile`. |
| `wp:group` (flex) | Children flow horizontally. Add `flexWrap:"wrap"` to allow wrap. |
| `wp:group` (grid, columnCount) | Grid keeps fixed column count — does NOT auto-stack. Prefer `wp:columns` if mobile-stack is required. |
| `wp:group` (grid, minimumColumnWidth) | Auto-fit grid — best for "as many columns as fit". |
| `wp:cover` | Min-height applies on all viewports. Padding scales with presets. |
| `wp:media-text` | Stacks with image above text below ~600px. |
| `wp:gallery` | Reflows to fewer columns on smaller widths. |

## Equal-height cards — USE GRID. Do not simulate it.

If the source was `display: grid`, **use `layout:{"type":"grid"}`**. CSS Grid stretches every item to
the row height for free — that stretching IS the property you are trying to recover, so reach for it
rather than approximate it with a height constraint.

```html
<!-- wp:group {"metadata":{"name":"Cards"},"className":"cod-brand","style":{"spacing":{"blockGap":"16px"}},"layout":{"type":"grid","minimumColumnWidth":"20rem"}} -->
<div class="wp-block-group cod-brand">
	<!-- the card wp:group blocks go here DIRECTLY — no wp:column wrappers, no minHeight -->
</div>
<!-- /wp:group -->
```

Measured on a live storefront, two different rows, **no tuned constants in either**:

| Row | `minimumColumnWidth` | 1440px | 1024px | 375px |
|---|---|---|---|---|
| 2-up | `20rem` | 376×2, heights **400/400** | 376×2, **400/400** | stacked, `min-height:auto` |
| 3-up | `220px` | 248×3, **205/205/205** | 248×3, **205/205/205** | stacked, `min-height:auto` |

Bottom-edge spread **0** at every desktop width, no horizontal overflow, and it self-stacks on mobile
with no constraint left behind.

**Two things to know before you use it:**

1. ⚠️ **The `blockGap` in that snippet is theme-gated — the GAP may not render.** WordPress emits
   `grid-template-columns` unconditionally (`layout.php` ~line 886) but gates `gap` behind
   `$has_block_gap_support` (~line 909). The two halves therefore fail apart: **where the destination
   has not opted in, the equal-height still works and the cards TOUCH.** Confirm the gap actually
   rendered; if it did not, the theme must opt into `spacing.blockGap`.
   ⚠️ **An earlier version of this line said that gap is what happens "on a classic theme".
   That premise was FALSE** — a classic theme with `add_theme_support('appearance-tools')` supports
   `blockGap` with no `theme.json` at all. Detect the destination; do not infer it from the theme
   being classic. See snippets.md → "blockGap renders ONLY if the destination theme opts in".
2. **Auto-fit drops a column EARLIER than `wp:columns` stacks.** Measured: a 2-up grid went to one
   column below ~856px, where `wp:columns` held two columns down to 782px. That is a real behaviour
   change, not a detail — in the measured case two cramped 277px cards were worse than stacking, so it
   was taken deliberately. Decide it, do not discover it.

### Fallback — `minHeight`, ONLY when a row must stay N-up below grid's auto-fit threshold

⛔ **Both forms of this recipe have now failed on a real store. Use it only when grid cannot, and
measure the result.**

**Form 1 — `clamp(0px, Nvw, Max)`** — fails when any ancestor caps the width. The cards stop growing,
their natural height becomes a **constant**, and `vw` keeps climbing away from it. Measured: body
capped at 760px needed **≥46vw** to hold at the 782px breakpoint but **≤31vw** to avoid dead space at
1152px. Empty range, by construction — one side is a ratio of a constant to a rising number.

**Form 2 — a fixed px `minHeight`** — fails for a *different* reason on this platform.

> ⚠️ **An earlier version of this file justified form 2 like this: _"once the columns stack, each card
> is narrower than it was on desktop … so its natural height is greater than the desktop value. The
> constraint is therefore inert exactly where you need it inert."_ THAT PREMISE IS INVERTED HERE, and
> it is corrected rather than deleted because markup was authored on it.**

Measured on the real store:

| Viewport | Layout | Container | Card width | Tallest card |
|---|---|---|---|---|
| 800px | 2-col | 585px | **277px** | **484px** |
| 375px | stacked | 327px | **287px** | **463px** |

The stacked mobile card is **WIDER** (287 > 277) and therefore **SHORTER** (463 < 484). Desktop needs
≥484px, mobile needs ≤463px: empty range again.

**Root cause, and it is a property of every COD Leads storefront:** the reasoning assumed horizontal
chrome is constant across viewports. **The store's gutters are not** — `full_width_padded_style` is
80px per side, `full_width_padded_mobile_style` is 24px. That **160px vs 48px** asymmetry shrinks the
desktop container faster than the viewport shrinks, so just above the stacking breakpoint two columns
are each narrower than one stacked card. Any rule that compares "desktop card width" with "mobile card
width" on this platform must account for the gutters — neither form of this recipe did.

**So if you must use `minHeight`: measure the tallest card at BOTH the width just above the breakpoint
AND at 375px, and only proceed if the mobile value is genuinely the larger one.** If it is not, the
range is empty and no constant exists — go back to grid.

## Verifying at a narrow viewport (MANDATORY for width/padding/margin/contentSize changes)

**Both validators are static and browser-free.** They cannot see a layout that only breaks below a
certain width, so a fully green run is compatible with a page that is unusable on a phone. A real
page verified only at 1280px shipped its FAQ questions in a **5px-wide column** at 375px, breaking
words mid-word.

**The procedure:**

1. Look at the page at **375px** as well as desktop. 375px is the common small-phone width and it is
   below every stacking breakpoint that matters (`wp:media-text` stacks at 600px, `wp:columns` at
   781px), so it exercises the stacked layout too.
2. **Report MEASUREMENTS, not impressions.** "The question column computes to 5px wide and wraps
   mid-word" is a finding; "looks a bit tight on mobile" is not, and cannot be acted on.
3. Check the elements the change actually touched — computed width, the horizontal padding sum, and
   whether any text is breaking inside words.

**⚠️ Guard every measurement with a width assertion first.** If the browser reports
`window.innerWidth === 0` the pane is collapsed or hidden, and **every number derived from it is
garbage that looks exactly like a broken page** — zero-width columns, mid-word wrapping, elements
stacked at x=0. Assert a plausible width before you trust a single figure:

```js
if (window.innerWidth === 0) throw new Error('pane collapsed — re-open it and re-measure');
```

Re-measure rather than reporting. A false "the layout is broken" costs a rebuild of something that
was never wrong.

## ⛔ `Viewport Width` header — RETIRED, do not set it

**There is no pattern file to put it in.** The two-file `pattern.html` + `pattern.php` format is gone
and the WordPress pattern header went with it — `output-format.md` → "What is NOT in scope any more"
is the authority, and it names `Viewport Width:` explicitly. The deliverable is one markup file plus
a title, a slug and a target resource; nothing reads a `Viewport Width:` line.

*(An earlier version of this section told you to set `Viewport Width: 1400` for full-bleed sections,
`1200` for standard, `800` for narrow. Retired rather than deleted because the header may still
appear in older files — there it is inert, not harmful, and can simply be dropped.)*

**Nothing declarative replaced it, and that is the point.** The header only ever changed the
inserter's *preview iframe*, never the rendered output — so it never actually answered "does this
hold up at another width?", it only looked as if it did. That question is now answered by measuring:
see **"Verifying at a narrow viewport"** above — check at 375px as well as desktop, and report
numbers rather than impressions.

## Mobile-friendly navigation: `wp:navigation`

For nav menus that need to collapse into a hamburger on mobile, use the native `wp:navigation` block instead of stacking `wp:paragraph` blocks (which just wrap awkwardly on small screens). Its `overlayMenu` attribute controls when the hamburger overlay appears:

| Value | Behavior |
|---|---|
| `"never"` | Always horizontal — no collapse |
| `"mobile"` | Desktop horizontal, mobile hamburger (most common) |
| `"always"` | Always show hamburger button regardless of viewport |

`wp:navigation` is a **dynamic block** — its saved markup is just the comment with config + inner `wp:navigation-link` / `wp:navigation-submenu` blocks. The HTML wrapper (`<nav>`, `<ul>`, etc.) is generated server-side at render time, so the saved pattern is short:

```
<!-- wp:navigation {"overlayMenu":"mobile","style":{"color":{"text":"#ffffff"},"typography":{"fontSize":"15px","fontWeight":"600"}},"layout":{"type":"flex","justifyContent":"left","flexWrap":"wrap"}} -->
<!-- wp:navigation-link {"label":"Home","url":"/"} /-->
<!-- wp:navigation-link {"label":"Shop","url":"/shop"} /-->
<!-- wp:navigation-link {"label":"On Sale","url":"/sale","style":{"color":{"text":"#e8b923"}}} /-->
<!-- /wp:navigation -->
```

**Per-link styling:** each `wp:navigation-link` accepts its own `style.color.text` for highlighting (e.g. gold "ON SALE" link). Block-level typography on `wp:navigation` cascades to all children.

**Submenus:** for items with dropdown menus, wrap them in `wp:navigation-submenu` instead of `wp:navigation-link`. Submenus auto-render a chevron and the dropdown opens on hover/click.

**Overlay colors on mobile:** by default the overlay inherits the navigation's text/background colors. Override with `overlayBackgroundColor` / `overlayTextColor` (slugs) or `customOverlayBackgroundColor` / `customOverlayTextColor` (hex).

**Caveat — first paste behavior:** when a pattern with `wp:navigation` is pasted into a new site, WP creates a new `wp_navigation` post entry from the inner blocks. Different pages using the same pattern may end up with separate navigation entries unless the user manually unifies them via the Site Editor.

**When NOT to use `wp:navigation`:**
- Footer link lists where mobile collapse is unnecessary — stacked `wp:paragraph` blocks are simpler and editable per-item.
- Inline brand-style links with custom typography per-item (the navigation block applies uniform styling across all links).
