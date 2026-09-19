# Output Format

What you produce is **one file of block markup** and four facts about it: a title, a slug, which
resource it belongs on, and the width the page should render at. That is the whole deliverable. There
is no pattern header, no `.php` twin, no folder convention, and no library to add it to.

The file plus those four facts is everything a publish needs, whatever route does the publishing:

```
content     →  out/crepiere-landing.html          (the markup file, read by path)
title       →  "Crêpière Électrique 6 Baghrir"
slug        →  crepiere-electrique-landing
target      →  pages
width_mode  →  none                               (full-bleed; "" inherits the theme default)
```

How they are handed over is route-specific — an MCP tool call, a REST request body, WP-CLI flags, or
the editor's own fields. The reference publisher that ships alongside this skill takes all four, as
`--content` / `--title` / `--slug` / `--target` / `--width-mode`. *(An earlier version of this page
said it had no width flag and that the width was a manual second call on that route; the flag was
added 19-09-2026 and the publisher now makes the `PATCH {id}/plugin` call itself.)* On a route with
no width of its own, it stays a second call: `PATCH pages/{id}/plugin {"width_mode": "…"}`. State
the value in your report either way — an unstated width is the one that silently comes back inset.

## The markup file

Raw block markup. Literal text. No PHP, no escaping calls, no header comment. It is exactly what you
would paste into the block editor's code view, and exactly what the API stores byte-for-byte.

```html
<!-- wp:group {"className":"cod-brand","align":"full","style":{"spacing":{"padding":{"top":"var:preset|spacing|80","bottom":"var:preset|spacing|80","left":"var:preset|spacing|50","right":"var:preset|spacing|50"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group cod-brand alignfull" style="padding-top:var(--wp--preset--spacing--80);padding-right:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--80);padding-left:var(--wp--preset--spacing--50)">
  <!-- wp:heading {"textAlign":"center","level":1,"fontSize":"xx-large"} -->
  <h1 class="wp-block-heading has-text-align-center has-xx-large-font-size">Big bold headline</h1>
  <!-- /wp:heading -->

  <!-- wp:paragraph {"align":"center"} -->
  <p class="has-text-align-center">A single supporting line that pitches the page.</p>
  <!-- /wp:paragraph -->
</div>
<!-- /wp:group -->
```

**Where you keep that file is your own business.** A scratch directory, a temp path, wherever — it is
read by path and nothing looks for it in any particular place. This skill commits it nowhere, and once
published the site's own revision history is the durable copy.

## The four facts

| | | |
|---|---|---|
| **title** | The human-readable name. | Shown in the site's admin list. |
| **slug** | **The identity.** | Most routes look this slug up on the live site: found → UPDATE that row, absent → CREATE. That is the entire mechanism behind "re-publishing updates instead of duplicating", so a changed slug creates a second page rather than editing the first. Usually defaults to the slugified title — confirm it for your route. |
| **target** | Which resource the content lands on. | The names below are a COD Leads storefront's; another destination will have its own set. |
| **width_mode** | How wide the content renders. | `""` inherits the theme default (`cl-full-width-padded` on codbrand — a gutter on both sides), **`none`** removes the wrapper for true edge-to-edge, or name one of the four store width classes. **A banded, full-bleed layout needs `none`** — `align:"full"` alone cannot escape the wrapper's padding, and **no store setting controls an ordinary page's width**, so if you do not deliver this value nobody else will. See `conversion-rules.md` → "`align:\"full\"` does NOT mean full-bleed". A destination without per-page width simply ignores it. |

## Choosing the target

**Where content lands is the DESTINATION's fact, not this skill's** — get it from the destination
(step 0), because it changes with that site. On a COD Leads storefront the answer lives under
`/cl-api/v1/docs` → "Where your content is rendered"; the short version is:

- **`pages`** — your markup IS the page. You own everything on it.
- **`products`** — the plugin renders its own product UI (gallery, price, quantity offers,
  add-to-cart) and your content is appended **BELOW** it. Do not write a second hero, a second price,
  or your own order button; use the plugin's real one.
- **`custom_blocks`** — a reusable fragment the merchant places from the plugin's admin.

On any other destination, establish the equivalent before authoring. If you cannot, assume your
content owns the whole page and has to say everything itself.

## What is NOT in scope any more

The two-file `pattern.html` + `pattern.php` format is retired, along with the WordPress pattern file
header (`Title:` / `Slug:` / `Categories:` / `Viewport Width:` …) and the `esc_html_e()` translation
wrapping that went with it.

**Why:** those existed to make a file that a *theme* could auto-register from its `/patterns` folder.
Delivery is now the API, and **the API cannot register a theme pattern** — theme patterns are PHP
files read off disk by the theme, so writing one requires filesystem access to the active theme,
which no REST endpoint of ours (or WordPress core's) offers. Keeping a `.php` twin meant maintaining
a second copy of every byte, kept in step by a drift check, for a delivery route we do not use.

If a theme-registered pattern is ever genuinely wanted, that is a file dropped into a theme by hand —
a different job from this skill, not a variant of it.
