# Canonical Snippets — copy these exact bytes

**Purpose:** generation is far more reliable as *assembly* than as *derivation*. Every snippet below is byte-exact, validator-passing markup taken from validated patterns in this library. When a design contains one of these primitives, COPY the snippet and substitute only the marked slots — never re-derive the serialization from CSS knowledge (that's how the `display:flex` inline-style bug shipped).

**Substitution slots:** text content, colors (hex values), sizes (px values), URLs, `alt` text, `metadata.name` labels. Everything else — class lists, property order, structure — stays byte-identical. If you change a JSON style key, you MUST mirror the change in the inline style (see `block-supports.md` → universal serialization rule).


---

## 1. Section root (every pattern starts with this)

```html
<!-- wp:group {"metadata":{"name":"SECTION NAME"},"align":"full","className":"cod-brand","style":{"color":{"background":"#ffffff"},"spacing":{"padding":{"top":"60px","bottom":"60px","left":"40px","right":"40px"}}},"layout":{"type":"constrained"}} -->
<div class="wp-block-group cod-brand alignfull has-background" style="background-color:#ffffff;padding-top:60px;padding-right:40px;padding-bottom:60px;padding-left:40px">
	<!-- inner blocks -->
</div>
<!-- /wp:group -->
```

Slots: section name, background color, paddings. `cod-brand` and `metadata.name` are mandatory (validator enforces cod-brand).

⚠️ **This snippet sets NO `contentSize`, because it cannot know your destination** — the same reasoning as `blockGap` below, and the same fix: **detect first.**

A COD Leads storefront on the codbrand theme publishes its own content width, compiled from the merchant’s **Global Layout** settings. A section with no `contentSize` INHERITS it, and that is the whole point: one setting moves every section on the site.

Hardcoding a width here freezes the section at author time. The merchant then changes Global Layout and **nothing moves** — a block’s own `layout.contentSize` compiles to an explicit `max-width` that beats the inherited variable. Measured on a live store (09-09-2026): nine hardcoded values (2×1200px, 1×1280px, 3×1300px, 3 empty) sat against a 1240px setting and ignored it until they were removed; afterwards every section rendered at the merchant’s 1240px.

**Add a `contentSize` ONLY when the destination supplies no width of its own** — a theme with no `theme.json` `settings.layout.contentSize`. There, omitting it leaves the section full-bleed. Establish which case you are in during step 0; when the destination has a width, leave this out.

*(This is skill rule #1 — never hardcode one store’s choices — applied to width. An earlier version of this snippet shipped `"contentSize":"1280px"`, which was exactly the violation that rule describes.)*

⚠️ **Its HORIZONTAL padding is PROVISIONAL on a COD Leads storefront. Its vertical padding is not.**

`top` / `bottom` always survive and never conflict with anything — keep them.

`left` / `right` stay in this snippet because on a plain WordPress destination they are the only
gutter you have, and without them text touches the viewport edge on a phone. But on a COD Leads
storefront they are both **additive** and **removable**:

- **Additive** — the page's own width mode already insets the content. Measured on a live store:
  80px desktop, 24px mobile (see `conversion-rules.md` → "`align:\"full\"` does NOT mean
  full-bleed"). Your 40px lands on top of that, so the section sits ~120px in, not 40px.
- **Removable** — since plugin **v1.2.710** a merchant can set a width mode on an individual BLOCK
  (block inspector → Settings → Width mode). Doing so **deletes that block's left/right padding and
  hides the control**, because the store's gutter then owns the horizontal box. Whatever you authored
  there is gone the moment they use it — by design, not by accident.

**So detect the destination (step 0) and choose:** a COD Leads storefront → prefer leaving horizontal
padding OFF the section ROOT and let the store's gutter supply it; put insets on inner elements
(cards, badges, columns) instead, where nothing strips them. No width-mode system → keep the 40px.

*(Same rule as the two notes above, and the same reason: this snippet cannot know its destination.)*

⚠️ **This snippet sets NO `blockGap`, because it cannot know your destination.** That is a SAFE DEFAULT, not a prohibition — an earlier version of this line said "do not add one", which is wrong wherever the theme opts in. **Detect first** (see "blockGap renders ONLY if the destination theme opts in" below): support ON → `blockGap` is the better tool and adding child margins on top DOUBLE-SPACES; support OFF → space the children with explicit `margin` on the children themselves, as written here.

## 2. Pill badge, centered (colored pill with short label)

```html
<!-- wp:group {"metadata":{"name":"Badge"},"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-group">
	<!-- wp:group {"style":{"color":{"background":"#f5e0e5"},"border":{"radius":"9999px"},"spacing":{"padding":{"top":"10px","right":"24px","bottom":"10px","left":"24px"}}},"layout":{"type":"constrained"}} -->
	<div class="wp-block-group has-background" style="border-radius:9999px;background-color:#f5e0e5;padding-top:10px;padding-right:24px;padding-bottom:10px;padding-left:24px">
		<!-- wp:paragraph {"style":{"color":{"text":"#c41e3a"},"typography":{"fontSize":"13px","fontWeight":"700"},"spacing":{"margin":{"top":"0","bottom":"0"}}}} -->
		<p class="has-text-color" style="color:#c41e3a;margin-top:0;margin-bottom:0;font-size:13px;font-weight:700">BADGE TEXT</p>
		<!-- /wp:paragraph -->
	</div>
	<!-- /wp:group -->
</div>
<!-- /wp:group -->
```

Slots: pill background, text color, paddings, text. Inline style order on the pill: `border-radius` → `background-color` → paddings. Outer flex wrapper is what centers the pill (a constrained group can't shrink-wrap).

## 3. Section header pair (heading + description, centered)

```html
<!-- wp:heading {"textAlign":"center","level":2,"style":{"color":{"text":"#1a1a1a"},"typography":{"fontSize":"44px","fontWeight":"900"},"spacing":{"margin":{"top":"8px","bottom":"0"}}}} -->
<h2 class="wp-block-heading has-text-align-center has-text-color" style="color:#1a1a1a;margin-top:8px;margin-bottom:0;font-size:44px;font-weight:900">HEADING</h2>
<!-- /wp:heading -->

<!-- wp:paragraph {"align":"center","style":{"color":{"text":"#666666"},"typography":{"fontSize":"16px","lineHeight":"1.7"},"spacing":{"margin":{"top":"12px","bottom":"40px"}}}} -->
<p class="has-text-align-center has-text-color" style="color:#666666;margin-top:12px;margin-bottom:40px;font-size:16px;line-height:1.7">DESCRIPTION</p>
<!-- /wp:paragraph -->
```

Inline order: `color` → margins → `font-size` → `font-weight` (heading) / `line-height` (paragraph). Heading alignment class is `has-text-align-*`; paragraph uses `align` JSON key (not `textAlign`) with the same class.

## 4. Card container (repeated item with its own background)

```html
<!-- wp:group {"metadata":{"name":"CARD NAME"},"style":{"color":{"background":"#f6f7f9"},"border":{"radius":"16px"},"spacing":{"padding":{"top":"28px","right":"20px","bottom":"24px","left":"20px"}}},"layout":{"type":"flex","orientation":"vertical","justifyContent":"center"}} -->
<div class="wp-block-group has-background" style="border-radius:16px;background-color:#f6f7f9;padding-top:28px;padding-right:20px;padding-bottom:24px;padding-left:20px">
	<!-- inner blocks -->
</div>
<!-- /wp:group -->
```

Slots: name, background, radius, paddings, orientation. **`layout` NEVER emits inline CSS** — no `display:flex`, no `gap` in `style=""`. Valid `justifyContent`: `left` / `center` / `right` / `space-between` (never `flex-start`/`flex-end`).

⚠️ **Vertical flex shrink-wraps children** — only use it when card children should be aligned at content width (centered image/icon stacks). If any child must span the card's full width (colored top band, full-width row), use `"layout":{"type":"default"}` instead, and give inner rows that need flex their own flex `wp:group`. See `block-supports.md` → Layout.

## 5. Icon tile (colored rounded square with white line-art icon)

```html
<!-- wp:group {"metadata":{"name":"Icon Tile"},"style":{"color":{"background":"#d63d3d"},"border":{"radius":"14px"},"spacing":{"padding":{"top":"22px","right":"22px","bottom":"22px","left":"22px"}}},"layout":{"type":"flex","justifyContent":"center"}} -->
<div class="wp-block-group has-background" style="border-radius:14px;background-color:#d63d3d;padding-top:22px;padding-right:22px;padding-bottom:22px;padding-left:22px">
	<!-- wp:image {"width":"36px","height":"36px","sizeSlug":"large"} -->
	<figure class="wp-block-image size-large is-resized"><img src="https://api.iconify.design/lucide/ICON-NAME.svg?color=%23ffffff&amp;width=36" alt="ICON ALT" style="width:36px;height:36px"/></figure>
	<!-- /wp:image -->
</div>
<!-- /wp:group -->
```

Slots: tile color/radius/padding, iconify icon name (lucide set: `repeat`, `clock-3`, `map-pin`, `building-2`, …), icon color/size, alt. In the markup the `&` in the URL is escaped as `&amp;`. Use this instead of emoji whenever the design shows monochrome icons — an OS emoji is never monochrome.

## 6. Custom-color separator + footer line (card footer)

```html
<!-- wp:separator {"style":{"color":{"background":"#232f4a"},"spacing":{"margin":{"top":"10px","bottom":"6px"}}}} -->
<hr class="wp-block-separator has-text-color has-background has-alpha-channel-opacity" style="background-color:#232f4a;color:#232f4a;margin-top:10px;margin-bottom:6px"/>
<!-- /wp:separator -->

<!-- wp:paragraph {"align":"right","style":{"color":{"text":"#8b93a7"},"typography":{"fontSize":"14px"},"spacing":{"margin":{"top":"0","bottom":"0"}}}} -->
<p class="has-text-align-right has-text-color" style="color:#8b93a7;margin-top:0;margin-bottom:0;font-size:14px">FOOTER TEXT</p>
<!-- /wp:paragraph -->
```

Separator quirks are load-bearing: `has-alpha-channel-opacity` always; custom color emits BOTH `background-color` AND `color` (same value) inline from a single JSON key — the documented exception to the JSON↔style mirror rule.

## 7. Cover thumbnail with corner badge overlay (image + positioned content)

```html
<!-- wp:cover {"metadata":{"name":"Thumbnail"},"url":"IMAGE-URL","alt":"IMAGE ALT","dimRatio":50,"minHeight":220,"minHeightUnit":"px","contentPosition":"top left","style":{"spacing":{"padding":{"top":"12px","right":"12px","bottom":"12px","left":"12px"}},"border":{"radius":"12px"}},"layout":{"type":"constrained"}} -->
<div class="wp-block-cover has-custom-content-position is-position-top-left" style="border-radius:12px;padding-top:12px;padding-right:12px;padding-bottom:12px;padding-left:12px;min-height:220px"><img class="wp-block-cover__image-background" alt="IMAGE ALT" src="IMAGE-URL" data-object-fit="cover"/><span aria-hidden="true" class="wp-block-cover__background has-background-dim"></span>
	<div class="wp-block-cover__inner-container">
		<!-- wp:group {"layout":{"type":"flex","justifyContent":"left","flexWrap":"wrap"}} -->
		<div class="wp-block-group">
			<!-- wp:group {"style":{"color":{"background":"#f7c325"},"border":{"radius":"9999px"},"spacing":{"padding":{"top":"4px","right":"12px","bottom":"4px","left":"12px"}}},"layout":{"type":"constrained"}} -->
			<div class="wp-block-group has-background" style="border-radius:9999px;background-color:#f7c325;padding-top:4px;padding-right:12px;padding-bottom:4px;padding-left:12px">
				<!-- wp:paragraph {"style":{"color":{"text":"#111111"},"typography":{"fontSize":"14px","fontWeight":"800"},"spacing":{"margin":{"top":"0","bottom":"0"}}}} -->
				<p class="has-text-color" style="color:#111111;margin-top:0;margin-bottom:0;font-size:14px;font-weight:800">BADGE</p>
				<!-- /wp:paragraph -->
			</div>
			<!-- /wp:group -->
		</div>
		<!-- /wp:group -->
	</div>
</div>
<!-- /wp:cover -->
```

Slots: image URL (twice — JSON and `src` must match), alt (twice too — `"alt"` in JSON and `alt` on the `<img>` must match), minHeight, radius, contentPosition (+ matching `is-position-*` class), badge colors/text. `dimRatio:50` emits ONLY `has-background-dim` (no `-50` suffix). One positioned content region per cover — see `conversion-rules.md`.

⚠️ **Two things changed in `core/cover`, and this snippet had the older form of both** — corrected 15-09-2026. The `<img>` now goes BEFORE the dim `<span>`, and a non-empty alt is written in the JSON (`"alt":"…"`) as well as on the `<img>`, because the current block reads alt only from the JSON. The older form (span first, alt only on the `<img>`) is still accepted, but only as an older version of the block: it passes `parse()`, and WordPress rewrites the markup the next time the page is saved. `validate_pattern_wp.cjs` fails it with "accepted only as an older version of this block" (see `headless-validation.md` Gotcha #7). Fixing only the order is worse: the `<img>` first with alt only on the `<img>` fails outright (measured on WordPress 7.1). `validate_pattern.mjs` flags both halves too, with no toolbox installed.

## 8. Full-width styled button (high-risk block — copy, don't derive)

```html
<!-- wp:buttons -->
<div class="wp-block-buttons"><!-- wp:button {"url":"#","style":{"typography":{"fontSize":"12px","fontWeight":"600","textTransform":"uppercase","letterSpacing":"0.08em"},"color":{"background":"#111111","text":"#ffffff"},"border":{"radius":"0px"},"spacing":{"padding":{"top":"9px","bottom":"9px","left":"0","right":"0"}},"dimensions":{"width":"100%"}}} -->
<div class="wp-block-button"><a class="wp-block-button__link has-text-color has-background has-custom-font-size wp-element-button" href="#" style="border-radius:0px;color:#ffffff;background-color:#111111;padding-top:9px;padding-right:0;padding-bottom:9px;padding-left:0;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase">BUTTON TEXT</a></div>
<!-- /wp:button --></div>
<!-- /wp:buttons -->
```

Slots: colors, radius, paddings, typography values, text, href (`"url"` in JSON MUST match — both mandatory, `#` for placeholders). Style lands on the `<a>`, never the wrapper `<div>`. WordPress writes the properties in this order: `border-radius` → `color` → `background-color` → paddings → `font-size` → `font-weight` → `letter-spacing` → `text-transform` — copy it for tidy diffs; validation ignores property order (corrected 15-09-2026, see the top of `block-supports.md`).

⚠️ **Full width is `"dimensions":{"width":"100%"}` inside `style`, on a plain `<div class="wp-block-button">` wrapper** — corrected 15-09-2026. This snippet used a numeric `"width":100` with `has-custom-width wp-block-button__width-100` on the wrapper, which is how an older `core/button` saved. WordPress accepts that only as an older version of the block and rewrites it the next time the page is saved. The button still stretches: WordPress adds the width classes itself when it renders the page (`wp-includes/blocks/button.php`). Other widths are written the same way, e.g. `"50%"`. `validate_pattern.mjs` flags the numeric form too.

⚠️ **`has-custom-font-size` is REQUIRED on the `<a>` whenever `style.typography.fontSize` is set** — a LITERAL size (`"16px"`), not a preset slug. Corrected 23-08-2026: this snippet shipped without the class and without `"url"`, because until then no pattern in the library set a font size on a button, so neither validator had ever exercised the combination. The ground-truth validator flagged it on first use:

```
WP expects : class="wp-block-button__link has-text-color has-background has-custom-font-size wp-element-button"
we have    : class="wp-block-button__link has-text-color has-background wp-element-button"
```

WordPress writes the classes as `has-text-color` → `has-background` → `has-custom-font-size` → `wp-element-button`; the order is not validated, the presence is. `validate_pattern.mjs` now enforces that presence (`wp:button` branch), so the fast validator catches it without the heavy dependency.

Note the two validators fail DIFFERENTLY here and you need both: ground truth catches the missing class (WordPress's `save()` emits it), while the missing `"url"` passes ground truth entirely — `parse()` back-fills `url` from the `href` in the HTML, so the round-trip is self-consistent — and is caught only by the heuristic validator's project rule.

## 9. Circular image with colored border (avatar / service photo)

```html
<!-- wp:image {"width":"120px","height":"120px","scale":"cover","sizeSlug":"large","style":{"border":{"color":"#d4af37","width":"3px","radius":"50%"}}} -->
<figure class="wp-block-image size-large is-resized has-custom-border"><img src="IMAGE-URL" alt="IMAGE ALT" class="has-border-color" style="border-color:#d4af37;border-width:3px;border-radius:50%;object-fit:cover;width:120px;height:120px"/></figure>
<!-- /wp:image -->
```

Slots: size (JSON width/height AND img width/height must match), border color/width, URL, alt. Load-bearing rules (validator enforces all of them — `wp:image` branch):
- **Everything serializes on the `<img>`** — the `<figure>` never carries border/size/object-fit inline styles (only `margin-*` from `style.spacing.margin` may appear on the figure).
- `style.border` in JSON requires class **`has-custom-border`** on the **figure**.
- `style.border.color` ALSO requires class **`has-border-color`** on the **`<img>`** — two different classes on two different elements. Omitting the img one is invisible to eyeballing and was the actual cause of a shipped parser error.
- `object-fit` inline requires **`"scale"`** in JSON (and vice versa).
- Do NOT add `"style":"solid"` / `border-style:solid` — WP injects border-style via global CSS whenever a border-width is set.
- ✅ Verified byte-for-byte against WordPress's own `getSaveContent()` (see `headless-validation.md`), not just eyeballed.

---

## 10. FAQ accordion (`wp:details` — styled, and the weight trap)

An unstyled `wp:details` renders as a raw browser disclosure widget: measured live at `padding 0`,
`border-top-width 0`, `margin-bottom 0`, summary in the theme default face. Both validators passed it
and the owner named the FAQ first when saying the design was wrong. Copy this instead.

```html
<!-- wp:details {"summary":"Combien de temps dure la livraison ?","style":{"border":{"radius":"14px","width":"1px","color":"#e5e7eb"},"spacing":{"padding":{"top":"18px","right":"20px","bottom":"18px","left":"20px"},"margin":{"bottom":"12px"}},"typography":{"fontSize":"17px","fontWeight":"600"},"color":{"background":"#ffffff"}}} -->
<details class="wp-block-details has-border-color has-background" style="border-color:#e5e7eb;border-width:1px;border-radius:14px;background-color:#ffffff;margin-bottom:12px;padding-top:18px;padding-right:20px;padding-bottom:18px;padding-left:20px;font-size:17px;font-weight:600"><summary>Combien de temps dure la livraison ?</summary><!-- wp:paragraph {"style":{"typography":{"fontSize":"16px","fontWeight":"400","lineHeight":"1.7"},"color":{"text":"#555555"},"spacing":{"margin":{"top":"12px","bottom":"0"}}}} -->
<p class="has-text-color" style="color:#555555;margin-top:12px;margin-bottom:0;font-size:16px;font-weight:400;line-height:1.7">Entre 24 et 72 heures selon la ville.</p>
<!-- /wp:paragraph --></details>
<!-- /wp:details -->
```

Slots: summary text, border/background/radius, paddings, the answer paragraph. Repeat one `wp:details`
per question — `margin-bottom` on each is what separates them (there is no gap to rely on).

⚠️ **THE TRAP — `fontWeight` on `details` is inherited by the ANSWER.** Verified: the weight lands on
the `<details>` element itself (`…font-size:17px;font-weight:600`), so ordinary CSS inheritance hands
it to everything inside, and the answer renders bold. **The answer paragraph therefore needs an
explicit `"fontWeight":"400"`** — it is in the snippet above for exactly this reason, and removing it
as redundant reintroduces the bug.

Attribute shape and the "contains inner blocks" note live in `block-supports.md` → `core/details`;
this entry is the styled, copy-ready form.

## 11. Narrowed reading column that stays FLUSH LEFT (the `constrained` alternative)

`layout:{"type":"constrained"}` centres, so a narrowed answer sits indented from its own full-width
question — see `block-supports.md` → Layout. A lone `wp:column` at a `%` width starts at the parent's
left edge instead, and shrinks. Measured on a live store: **0px indent** from the question at both
375px and 1440px.

ℹ️ **This snippet DOES keep a `contentSize`, unlike §1 — deliberately.** 1100px here is a *reading measure*: FAQ prose is narrowed for legibility, which is a typographic decision that does not belong to the merchant's Global Layout. §1's width, by contrast, is the SECTION's width, which does. The test: are you narrowing text for line length (keep it), or setting how wide the section runs (leave it out and inherit)? See `block-supports.md` → Layout: *"`contentSize` is still the right tool for the page's ONE reading measure."*

```html
<!-- wp:group {"metadata":{"name":"FAQ"},"className":"cod-brand","style":{"typography":{"fontFamily":"var(\u002d\u002dcl-font1)"}},"layout":{"type":"constrained","contentSize":"1100px"}} -->
<div class="wp-block-group cod-brand" style="font-family:var(--cl-font1)"><!-- wp:heading {"level":3,"style":{"typography":{"fontSize":"22px","fontWeight":"600"},"spacing":{"margin":{"top":"0","bottom":"10px"}}}} -->
<h3 class="wp-block-heading" style="margin-top:0;margin-bottom:10px;font-size:22px;font-weight:600">Combien de temps dure la livraison ?</h3>
<!-- /wp:heading -->

<!-- wp:columns -->
<div class="wp-block-columns"><!-- wp:column {"width":"62%"} -->
<div class="wp-block-column" style="flex-basis:62%"><!-- wp:paragraph {"style":{"typography":{"fontSize":"16px","lineHeight":"1.7"},"spacing":{"margin":{"top":"0","bottom":"0"}}}} -->
<p style="margin-top:0;margin-bottom:0;font-size:16px;line-height:1.7">Entre 24 et 72 heures selon la ville, et le livreur vous appelle avant de passer.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:column --></div>
<!-- /wp:columns --></div>
<!-- /wp:group -->
```

Slots: the heading, the `%` width, the answer. **A lone `wp:column` needs no sibling** — never add an
empty partner to hold the measure (the validator warns; it costs a row-gap when stacked).

## 12. Equal-height card row — GRID, not columns

CSS Grid stretches every cell to the row height for free. Do not simulate it with `minHeight`: both
forms of that workaround have failed on a real store (`responsive.md` → "Equal-height cards").

```html
<!-- wp:group {"metadata":{"name":"Cards"},"className":"cod-brand","style":{"spacing":{"blockGap":"16px"},"typography":{"fontFamily":"var(\u002d\u002dcl-font1)"}},"layout":{"type":"grid","minimumColumnWidth":"20rem"}} -->
<div class="wp-block-group cod-brand" style="font-family:var(--cl-font1)"><!-- wp:group {"style":{"color":{"background":"#f6f7f9"},"spacing":{"padding":{"top":"24px","right":"20px","bottom":"24px","left":"20px"}}},"layout":{"type":"default"}} -->
<div class="wp-block-group has-background" style="background-color:#f6f7f9;padding-top:24px;padding-right:20px;padding-bottom:24px;padding-left:20px"><!-- wp:paragraph -->
<p>Card one</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group -->

<!-- wp:group {"style":{"color":{"background":"#f6f7f9"},"spacing":{"padding":{"top":"24px","right":"20px","bottom":"24px","left":"20px"}}},"layout":{"type":"default"}} -->
<div class="wp-block-group has-background" style="background-color:#f6f7f9;padding-top:24px;padding-right:20px;padding-bottom:24px;padding-left:20px"><!-- wp:paragraph -->
<p>Card two is longer so it would be taller without grid stretching it.</p>
<!-- /wp:paragraph --></div>
<!-- /wp:group --></div>
<!-- /wp:group -->
```

Cards go in **directly** — no `wp:column` wrappers, no `minHeight`. Measured: bottom-edge spread **0**
at 1440px and 1024px, self-stacking at 375px with `min-height:auto`.

⚠️ **The `blockGap` here is theme-gated and the GAP may not render** — WordPress emits
`grid-template-columns` unconditionally but gates `gap` behind theme support, so on a classic theme
the heights match and **the cards touch**. Confirm the gap rendered on the destination. The validator
warns about the `blockGap` for exactly this reason; the warning is correct, not noise.

⚠️ **Auto-fit drops a column EARLIER than `wp:columns` stacks** — measured ~856px for a 2-up grid
versus 782px for `wp:columns`. Choose it deliberately.

## ⚠️ blockGap renders ONLY if the destination theme opts in — DETECT it, never assume

`blockGap` emits **no CSS of its own**. WordPress turns it into real CSS only when the ACTIVE THEME
opts into `spacing.blockGap`:

```php
// wp-includes/block-supports/layout.php
$block_gap             = $global_settings['spacing']['blockGap'] ?? null;
$has_block_gap_support = isset( $block_gap );
```

**There are TWO routes to that opt-in, and the second needs no `theme.json` at all:**

| route | how |
|---|---|
| `theme.json` | `settings.spacing.blockGap` declared, or `appearanceTools: true` |
| **PHP, on a CLASSIC theme** | `add_theme_support('appearance-tools')` |

⚠️ **RETRACTION — an earlier version of this section said a classic theme "never opts in".
THAT IS FALSE**, and it was the headline claim here for two rounds. `add_theme_support('appearance-tools')`
sets `settings.appearanceTools = true` (`class-wp-theme-json-resolver.php`), which
`WP_Theme_JSON::do_opt_in_into_settings()` expands through `APPEARANCE_TOOLS_OPT_INS` — a list that
contains `array( 'spacing', 'blockGap' )` (`class-wp-theme-json.php`). `isset()` on the resulting `true`
returns true, so support is ON with no `theme.json` anywhere on the site.

**Do NOT flip the claim the other way either.** "Themes support it now" is the same error pointing in
the opposite direction. A destination you have never seen may have it on or off, and both states are
normal. **The rule is DETECT, then branch.**

### Detect it BEFORE you choose a spacing strategy

Either of these answers it:

- publish a probe (or inspect any existing page) and read `getComputedStyle(el).gap` against the value
  you authored; or
- check whether WP's emitted `.wp-container-*` rule contains `gap` **at all**. With support OFF one
  storefront emitted `{flex-direction: column; align-items: flex-start;}` — the container rule was
  emitted and `gap` was simply **absent**. That omission is the unambiguous tell.

### Branch on what you found

| detection | what to do |
|---|---|
| **support ON** | `blockGap` is the right tool. **Do not also set explicit child margins — they DOUBLE-SPACE.** |
| **support OFF** | space the children with explicit `margin`, which always emits inline CSS (below). |

⚠️ **Side effect of support being ON, worth knowing before you ask a merchant to enable it:**
containers that author *no* gap stop falling back to 0/8/32px and inherit WordPress's default instead.
Turning it on moves spacing on blocks that never asked for a gap.

### When support is OFF, one cause produces THREE different symptoms

This is why the bug is hard to recognise — the same missing opt-in looks different per container:

| container layout | rendered gap when support is OFF |
|---|---|
| **flow** (`is-layout-flow` — the default for a group with no `layout`, and for `wp:column` children) | **0px** — no `:where()` fallback exists at all; siblings touch |
| flex / grid | **8px** (`0.5em` fallback) |
| `wp:columns` | **32px** (`2em`, from `columns/block.json`’s `__experimentalDefault`) |

**Measured consequence.** A real page set `blockGap` on its sections and `margin-bottom:0` on the
headings inside, relying on the gap for separation. On the live site:

```
computed_gap:            "normal"
--wp--style--block-gap:  (NOT SET)
```

— literally 0px between a heading and its content, across several sections. Both validators passed;
the owner found it on a screenshot. `validate_pattern.mjs` warns whenever `blockGap` appears, because
it cannot know the destination — the warning means "confirm this", not "remove it".

**The OFF remedy — explicit margins, which DO emit inline CSS:**

```html
<!-- wp:heading {"level":2,"style":{"spacing":{"margin":{"top":"0","bottom":"18px"}}}} -->
<h2 class="wp-block-heading" style="margin-top:0;margin-bottom:18px">Section title</h2>
<!-- /wp:heading -->
```

Note the contrast: the margin lands in `style=""`, where nothing can discard it. `blockGap` never
appears in the markup at all — which is precisely why its absence is invisible until someone looks
at the rendered page.

*Evidence (one storefront, 07-09-2026 — EVIDENCE, not a fact about your destination): with support
OFF, 30 authored gaps rendered as 0/8/32px; after the theme added `appearance-tools`, the same
elements rendered their authored 10/16/20/24px. Both states measured on the same page.*

## Verified serialization facts

Each of these was confirmed against WordPress's own `save()` via `scripts/emit_block.cjs` or the
ground-truth validator. They are the ones that have actually cost a debugging cycle.

| Fact | Detail |
|---|---|
| **`wp:media-text` property order** | WordPress emits `grid-template-columns` **LAST**, after the paddings: `style="padding-top:20px;padding-bottom:20px;grid-template-columns:40% auto"`. Match it so diffs stay stable — but note the ground-truth validator does NOT enforce it (see the row below). |
| **`mediaId` must agree with the image class** | `mediaId` in JSON has to match the `wp-image-N` class on the `<img>`. Changing `src`/class without updating `mediaId` fails. |
| **`mediaWidth` must match the inline percentage** | The JSON value and the `grid-template-columns` percentage are two copies of one number. |
| **Stacking breakpoints differ per block** | `wp:media-text` with `isStackedOnMobile` stacks at **`max-width: 600px`**; `wp:columns` stacks at **`max-width: 781px`**. Do not assume one figure covers both. |
| **A lone `wp:column` is legal** | A single `wp:column` inside `wp:columns` keeps its own `width` and needs no sibling. Never add an empty partner column to hold a measure — it costs a row-gap when the columns stack (the validator warns). |
| **`isStackedOnMobile:false`** | On two 2-column rows this yields a 2×2 grid at every width, with no media query. |
| **What ground truth does NOT check** | It normalises **class order** AND **inline-style property order** — `alignfull cod-brand` vs `cod-brand alignfull`, and `padding…;grid-template-columns…` vs the reverse, all pass. So a PASS is not evidence your ordering matches WordPress's. It DOES enforce which classes and which properties are present, and their values. *(An earlier version of this table said writing `grid-template-columns` first "fails ground truth" — tested, it does not.)* |
| **`anchor` requires a matching `id`** | `{"anchor":"pricing"}` must emit `id="pricing"` in the HTML, or ground truth fails. **Class ORDER is NOT enforced** — `alignfull cod-brand` and `cod-brand alignfull` both validate, with or without an anchor, and `id` before `class` also validates. The ordering convention is house style, not a serialization constraint. |

## Adding a new snippet

When a conversion produces a NEW primitive that survived a real WP paste test, add it here **in the same turn** with: the byte-exact markup, the substitution slots, and any load-bearing quirks. A snippet that never passed a WP paste does not belong here.
