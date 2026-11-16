# The procedure in full

`SKILL.md` keeps one line per rule; this file is the long form behind it — the hard constraints, steps 0 to 6, the
verification checklist, the failure modes and the recovery strategies, with every measurement and correction. Moved
here verbatim from `SKILL.md` (14-11-2026) to keep that file inside its budget. Step numbers, (a) (b) (c), route 1 /
route 2 and rule numbers are the same in both. Where this file says "below" or "above", it means within this file.

## Hard constraints
- **Target the CURRENT WordPress release. Never write back-compatibility.** If a site wants what this
  skill produces, that site upgrades — we do not carry shims, and we do not choose an older
  serialization form on the grounds that it also works on an earlier release. A site on an older
  WordPress is out of policy, not a compatibility target; say so rather than degrading the pattern to
  fit it.
- **Check the active theme when you can.** Most routes can report it (a CodBrand storefront
  answers `GET /me` with the active `theme`). On a CodBrand storefront expect `codbrand`, the plugin's
  own theme: it styles no fonts, headings, buttons or colours, and `references/theme-tokens.md` says
  what it does and does not provide. If the theme is one you do not know, say so, then carry on.
  Another theme styles headings, buttons and body text itself, so some of what you emit may be
  overridden; treat it as unverified rather than wrong. *Corrected 21-09-2026: this line said support
  "will end with our own theme", as if Codbrand were still to come.*
- Native core blocks, plus the plugin's OWN dynamic blocks (the `cl/…` namespace)
  when the destination is a CodBrand storefront.
- **Block settings first — the merchant must be able to change what you build.** Every colour, size,
  spacing, border, typeface and width is a setting of the block it belongs to (block-support JSON), so
  whoever opens the page or custom block in the block editor can change it from the sidebar. Only what
  no block setting can express — a hover (not a button's), an animation, a `::before`, a breakpoint of your own — is custom CSS or
  JavaScript, and it never goes INTO the content: you hand it over with the level it belongs on (step
  6), and the content carries only a class for it to find, set as the block's `className` (the
  editor's "Additional CSS class(es)"). So: **no hand-written `style=""`, no `<style>`, no `<script>`**
  in the content — step 5 (a) fails all three. A `wp:html` block has no settings at all, so it holds
  only what no core block can draw (an icon's `<svg>` — see "Icons") and never its look.
- **No** THIRD-PARTY plugin block namespaces.

  **On plugin (`cl/…`) blocks.** The original rule was "core blocks only, no plugin namespaces",
  written when the destination was a generic site where nothing else was guaranteed to exist. That
  still holds as the DEFAULT — core blocks work on any WordPress. What lifts it is CONFIRMATION: when
  the destination demonstrably ships its own dynamic blocks (a CodBrand storefront always has
  products / categories / reviews listings), those become available too. Two conditions, both
  required:
  1. **Only blocks you have CONFIRMED the destination provides.** Never a third-party namespace, and
     never a `cl/` block you have not seen in that site's own block list — discover it (step 0)
     rather than guessing a name. How you discover it depends on how you reach the site: a CodBrand
     storefront documents them under `/cl-api/v1/docs`; an MCP server or another API exposes its own
     registry. **If you cannot confirm a block exists on the destination, do not use it** — stay on
     core blocks.

     Which checks catch a name the destination does not have — measured on one store (WordPress
     7.1.3, 16-10-2026) with a misspelled `cl/` name: **the store's check page does** (`unknown_type`,
     `ok: false`); **the structural door warns** (`unknown_block_type` — step 5 (b) says to treat that
     warning as a failure); **the local ground-truth validator does not** — it registers any `cl/…`
     name it meets as a dynamic block, so a typo passes and it only prints the names it registered;
     and (a) does not know the destination's blocks at all. Whether the publish route catches it
     depends on the route (the reference publisher does, refusing a name absent from the API's docs;
     a raw API call will not). So an unconfirmed name costs you a failed check at best and a silently
     broken page at worst — confirm it and it costs you nothing. *(Corrected 16-10-2026: this said no
     validator catches it.)*
  2. **The form is decided by the DESTINATION SITE, not by preference.** Match what the site is
     actually built with:

     | The site builds pages with… | Use |
     |---|---|
     | Elementor | the Elementor widget (`cod-plist1`, `cod-catlist`, `cod-reviewlist`, `cod-newsletter`, `cod-slider`) |
     | Gutenberg / the block editor | the `cl/…` block |
     | Neither — classic editor, or unknown | the shortcode, inside `core/shortcode` |

     All three render the identical component against the same store data; only the container
     differs. The shortcode is the FALLBACK, not the default — reaching for it on a Gutenberg site
     produces a block-editor page whose content the merchant cannot edit visually, which is a worse
     result, not a safer one.

     **Establish which one before writing** (step 0), by whatever means your route offers — a COD
     Leads storefront reports it via `GET /me` in a `builders` block, where `recommended` is the
     answer and `ambiguous` says it could not decide. Do NOT guess from the theme name: a theme like
     Astra is used with Elementor and with the block editor alike, so `theme` tells you nothing here.

     **When you cannot establish it — or the site reports it as ambiguous — ASK THE USER** rather
     than picking. Both paths are live and only
     they know which editor they work in. Offer `recommended` as the default so accepting is one
     word. If no answer comes, use `recommended` and **state which form you used** — never leave the
     choice invisible.
- All design tokens go through native block supports (`style`, `fontSize`, `metadata`, `layout`).
- Slug is plain kebab-case and is the **update key** — re-publishing under the same slug edits that page instead of creating a second one.
- **Never embed `<script>` in generated markup** (step 5 (a) fails it). Besides the rule above, WordPress strips `<script>` from block content saved by anyone without `unfiltered_html`, so an inline tag is role-dependent and unreliable. JavaScript is handed over with the level it belongs on, like any CSS no setting can express (step 6). Editor-UX JavaScript remains out of scope for this skill by choice, not because a route could not deliver it.

## Procedure

### 0) Learn the DESTINATION before you author

What you write depends on where it lands, so settle the destination first — never at publish time.
Two questions, and **the answer to the first is the user's, not this skill's**:

1. **How will this reach the site?** An MCP server, the CodBrand plugin's `cl-api/v1` gateway,
   another REST API, WP-CLI, or a paste into the block editor. The skill's job ends at a validated
   file; delivery is step 6.
2. **What does that site provide?** Which dynamic blocks exist, what each needs from the store to show
   anything (a design, items to list — "Embedding a plugin (`cl/…`) block", rule 5), and where your
   content lands on each resource.

**If the destination exposes docs or a block registry, read it before analysing the source.** For a
CodBrand storefront, start at the docs index and follow it:

```
GET /cl-api/v1/docs    — the index. Skim the "Writing data" group, then follow it to
                         dynamic_components (what you can embed, and WHERE content lands)
                         and content_authoring (how content is stored, what is refused)
```

Its write responses also name the governing docs in an `X-CL-Docs` header. Other routes have their
own discovery — an MCP lists its tools, another API its own schema. **If nothing is discoverable,
author with core blocks only** and assume your content owns the whole page.

**Why FIRST and not at publish time:** where the content lands changes *what you should write*. On a
CodBrand `products` write, for example, the plugin renders its OWN product UI — gallery, price, quantity offers,
add-to-cart, sticky order bar — and your content is appended BELOW it. A pattern authored without
knowing that ships a second hero, a second price and a dead CTA button. That is a content mistake, and
by publish time it is already made.

**Never copy API facts into this skill.** Not the option tables, not the resource list, not the status
rules. They live in the API's docs because the API owns them and they change with it; a copy here goes
stale silently and the next session trusts it. Fetch them per run.

**The division of responsibility:** the API is deliberately format-agnostic — its write doors accept
plain HTML, Gutenberg or Elementor markup, store it byte-for-byte and validate **nothing** structural.
They will answer `200` to malformed block markup. Deciding that markup is sound before it is sent is
this skill's job, which is why step 5 is not optional. A destination may OFFER checks for that job — a
CodBrand storefront lists them under `block_markup_validation` in its docs — but it never runs them
for you.

### 1) Analyze source
- Identify dominant intent (hero / CTA / footer / services / testimonials / …) and pick ONE default WP category.
- Identify layout pattern (flex row, flex column, grid) and map to a native container.
- Inventory elements: heading levels, paragraphs, buttons, images, lists, columns, separators.
- **Run the visual-fidelity audit** — for each element in the source, note: typography weight, font size, vertical spacing, borders, button widths, icon style, alignment. If a UI primitive (form input, currency chip, custom dropdown) has no native equivalent, draw it with core blocks and their settings — a group with a border and a grey paragraph looks like an input (`references/conversion-rules.md` → "Non-native UI primitives") — never silently drop it. A `wp:html` holds only what no core block can draw, never its look.

Read:
- `references/categories.md` (auto-categorization heuristics)
- `references/conversion-rules.md` (HTML → native block decision tree + visual-fidelity checklist)

### 2) Decide title + slug + target
- Slug: short, kebab-case, descriptive (`hero-split`, `crepiere-landing`, `team-3-col`).
- Title: human-readable, e.g. "Hero Split with CTA".
- Target resource: `pages` | `products` | `custom_blocks` — see `references/output-format.md` → "Choosing the target".
- **A `custom_blocks` target is authored and checked exactly like a page** — one root with `cod-brand`,
  core blocks and their settings, every check in step 5, the 375px check. A custom block is not a lighter
  kind of content. Measured on one store (30-09-2026): four custom blocks written outside this procedure
  as hand-styled `wp:html` rows pass WordPress's own check (c) — it accepts anything inside a `wp:html`,
  and the structural check (b) does not look inside one either — and fail (a) with 7–15 findings each;
  one of them lost 72 of its 252px to the theme's block gap. Its forced CSS, if any, goes on the level
  that reaches every surface it is placed on (step 6).
  **It must render WITH the page.** WordPress prints the CSS behind layout settings — Block spacing, a
  row's wrap and alignment, a child's Fixed width — while it renders the page, so a block fetched after
  the page arrives without it. Measured on a WordPress 7.1 store, one custom block on a product page:
  rendered with the page, 0px from each divider to the next row; loaded after the page, 24px under every
  divider, rows wrapping, icons free to shrink, and no rule on the page for any of its layout classes. On
  a CodBrand storefront the choice is the placement's render mode — read `/docs/custom_block_placements`
  and use the mode that renders with the page (`immediate`) for anything built with layout settings. Say
  it in your hand-over when you do not place the block yourself.
- Write the markup to any working path you like; nothing depends on where.

Read:
- `references/naming.md` (slug rules + stability-of-saved-markup contract)

### 3) Write the block markup
- Wrap the pattern in ONE root container — usually `wp:group`, sometimes `wp:cover` or `wp:columns`. Set `align` (`full` / `wide` / none) appropriately.
- **Stamp the outermost block with `"className":"cod-brand"`** — this is the CodBrand namespace marker. It scopes editor-UX JS to our patterns and lets CSS target them. Mandatory on every pattern. The rendered class list places `cod-brand` immediately after the intrinsic `wp-block-{type}` class, before any `align*` / `has-*` modifiers. Example:
  ```html
  <!-- wp:group {"className":"cod-brand","align":"full","style":{...}} -->
  <div class="wp-block-group cod-brand alignfull has-background" style="...">
  ```
- **Add `metadata.name` labels** — the root block gets the section name (e.g. `{"metadata":{"name":"Verified Review Section"}}`) and major sub-sections (cards, repeated items) get names too. This is what makes List View readable for clients. JSON-only attribute, no HTML counterpart, no parser risk.
- **Client-safe delivery (opt-in):** when the user says a pattern is final/for a client, offer `templateLock:"contentOnly"` on the root group — clients then edit only text/media, layout untouchable. Not default during iteration. See `references/client-editing.md`.
- Use native block supports for spacing, typography, color, border. The inline `style=""` MUST contain exactly the CSS properties that correspond to JSON `style.*` keys — no more, no less.
- Use theme presets (`var:preset|...`) for theme-related values; literal CSS for one-offs.
- Responsive: lean on `core/columns` (auto-stacks), `wp:group` flex with `flexWrap:"wrap"`, and a block's own phone and tablet values — `"@mobile"` / `"@tablet"` in its `style`, which the merchant edits in the editor's Responsive styles mode (WordPress 7.1; sizes, markup and measurements in `references/responsive.md` → "A different value on phones or tablets"). **No media queries of your own.** A `blockGap` is a fixed length, never `clamp()`, `calc()` or `var()`: WordPress drops a gap holding "(" and the blocks fall back to the theme's default gap, past every other check ((a) errors on it; the ramp goes on the children's margins — `references/responsive.md` → "`clamp()` for a spacing step that ramps").
- **A block for phones only, or not on phones**, is WordPress's own per-device setting —
  `"metadata":{"blockVisibility":{"viewport":{"mobile":false}}}` hides a block on phones, `{"tablet":false,"desktop":false}`
  shows it on phones only — the same setting the merchant ticks in the block editor, so they can change it. Never
  two copies switched by CSS of your own. WordPress 7.0+, with sizes, limits and the canonical markup in
  `references/responsive.md` → "Phones only, or not on phones".
- No `<script>`, no `<style>`, no hand-written `style=""` — inside a `wp:html` included (step 5 (a) fails all three). What no block setting can express — interactivity, a hover (not a button's or a navigation link's), an animation — is handed over with the level it belongs on (step 6).
- **A container whose rows draw their own dividers or carry their own padding sets its Block spacing on purpose** — `blockGap` `"0"` when the rows' padding and dividers ARE the spacing. A container that sets none does not get 0: on a theme with block-gap support every row after the first takes WordPress's default gap (measured on one store: 24px under each divider). Recipe: `references/snippets.md` #13; (a) warns on the divider case.

#### Embedding a plugin (`cl/…`) block

**Prefer the block to a copy.** When a page needs something the store renders itself — its reviews,
a product grid, its categories — embed that `cl/…` block; never rebuild its look in static markup. The
block takes its look from the store's design for that component, set once for every page, and its
data stays live. A hand-built copy freezes numbers and dates and drifts from the design: on one build,
typed review cards said "based on 247 reviews" while the store held 31.
That holds for a row that swipes on phones too: category tiles or products shown as a swipe row are
that listing with its slider (a setting of its design — the listing's docs say which), not columns made
to scroll. Measured on one store (01-11-2026): static category tiles turned into a swipe row by page CSS.
A swipe row of content the store does not render is `references/snippets.md` #14.

Two halves, and they deliberately live in different places:

| | Where | Why |
|---|---|---|
| **Which blocks exist, and what options each takes** | the destination site (step 0) — for a CodBrand storefront, under `/cl-api/v1/docs`; each option's exact type from the store's WordPress (rule 2 below), since the docs do not carry every one | Generated from that site's live block registry, so it cannot go stale — and it differs per site. **Never hardcode a block list or an option table in this skill.** |
| **How to place one in a composition** | here | Craft the API doc does not teach, and should not. |

The shape is the same for every one of them — a self-closing block inside an ordinary section group:

```html
<!-- wp:group {"metadata":{"name":"Nos produits"},"align":"full","className":"cod-brand","style":{...},"layout":{"type":"constrained"}} -->
<div class="wp-block-group cod-brand alignfull has-background" style="…">
	<!-- wp:heading {"textAlign":"center","level":2, …} -->
	<h2 class="wp-block-heading has-text-align-center …">Nos produits</h2>
	<!-- /wp:heading -->

	<!-- wp:cl/products-listing {"postsPerPage":8} /-->
</div>
<!-- /wp:group -->
```

Five rules, each with a real failure behind it:

1. **Self-closing `/-->`, always.** These are dynamic blocks — they render server-side and save no
   HTML. One carrying inner markup fails the ground-truth validator, because a dynamic block's
   expected save output is empty.
2. **Attribute types come from the store's WordPress, and they are not guessable.** `postsPerPage`
   and `categoryId` are *numbers*, but `number` on catlist/reviewlist is a *string* (`"inherit"`,
   `"6"`) and `productIds` a *string* (`"12,15"`). Write a number as a number — `"categoryId":3`,
   never `"3"`. A shortcode's values are always strings (`category_id="3"`), so never copy the
   shortcode form into a block. The docs do not carry every type — a listing's `categoryId` sits in a
   table with none — so read the store's own: on its check page (step 5 (c), route 1) this returns
   every registered block's declared types, core and plugin:
   ```js
   JSON.stringify(Object.fromEntries(wp.blocks.getBlockTypes().map((b) => [b.name, Object.fromEntries(Object.entries(b.attributes || {}).map(([k, v]) => [k, v.source ? { type: v.type, source: v.source } : v.type]))])))
   ```
   Save it to a file and pass it to step 5 (a) as `--block-types=<file>`: an attribute of the wrong
   type is then an error. **Why it matters:** WordPress's server still renders `"3"` (it only checks
   that the value is numeric), but the editor keeps a value only when its type matches and otherwise
   falls back to the default, so the next save writes the block without it. Measured on one store
   (13-10-2026): a category listing rendered right for two weeks, then showed every category's
   products once the page had been re-saved. None of WordPress's own checks flag it. Without
   `--block-types`, (a) still warns on a quoted number in a `cl/` attribute named `…Id` or `…PerPage`.
3. **Some routes check the block name before writing** (the reference publisher does, against the
   live docs — a raw API call does not), so a typo may cost you a failed publish or may reach the
   page. Confirm the name in step 0 rather than guessing it.
4. **On a site that is not Gutenberg, use the shortcode instead** — same component, same options in
   snake_case. Which form to use is decided by what the SITE is built with, not by preference (see
   "Hard constraints").
5. **A dynamic block can render nothing, and no check of the markup sees it.** It shows what the store
   holds — a design for that component, and the items you ask for — and when one is missing it renders an
   empty box or nothing at all. Measured on one store (29-09-2026): with no listing design selected there,
   a categories listing rendered only an HTML comment and two product listings an empty box, while every
   check in step 5 was green. So before you embed one, read in the store's docs what it renders with
   (which design, and whether a store default stands in) and confirm it is there; after delivery, count
   what each one shows on the published page (verification checklist).

Worked example — all three blocks plus the shortcode fallback side by side:
`examples/listing/dynamic-blocks-showcase/content.html`.

#### Icons

**A line icon is a bare `<svg>` alone in a `wp:html`, inside a core group whose settings size and colour
it** — so the merchant changes the icon from the block editor like any other block:

- **the `<svg>`**: `width="1em" height="1em"`, a `viewBox`, `stroke` / `fill="currentColor"`,
  `aria-hidden="true" focusable="false"` — and no `style`, no `class`;
- **the group around it** (name it "Icon"): its **text colour** is the icon's colour and its **font
  size** is the icon's size — both editor settings. Where the icon sits in a row (a flex group), give
  that group **flex layout and a Fixed width of `1em`**
  (`"style":{"layout":{"selfStretch":"fixedNoShrink","flexSize":"1em"}}`): a bare svg next to long text
  SHRINKS — measured on a WordPress 7.1 store, 22px icons drawn 12.9px wide at desktop and 6.7px at
  375px; the Fixed width holds them at 22×22 at both;
- **several icons** (a list): set the colour and size once on the container that holds them, and give
  the text blocks their own — then one setting recolours or resizes every icon.

Measured on the same store: the icon took its group's font size and colour on the page, and in the
block editor — which shows a Custom HTML block as a live preview — changing the group's font size and
text colour changed the icon.

**Where the code comes from:** any icon set, at authoring time. Iconify returns an icon already in this
shape (`https://api.iconify.design/<set>/<name>.svg`, e.g. `lucide/truck`: `1em`, `currentColor`, no
style); add `aria-hidden` and `focusable`. The page never loads it.

**Not `wp:image` for a line icon:** an image's colour is fixed and cannot follow the text colour, and
WordPress refuses SVG uploads unless a site allows them (a store's upload doc says which types it
accepts). **A raster or multi-colour icon** — a brand logo — is a `wp:image` of an uploaded file, never
a URL on another site. Recipes: `references/snippets.md` #5 (icon tile), #13 (row list). Step 5 (a)
warns on an icon svg with a fixed size or colour.

Read:
- `references/snippets.md` (**canonical byte-exact building blocks — ALWAYS check here FIRST**; when a design primitive matches a snippet, copy it and substitute only the marked slots. Assembling from snippets is dramatically more reliable than deriving serialization from CSS knowledge.)
- `references/block-supports.md` (per-block native attributes + serialization gotchas)
- `references/theme-tokens.md` (preset vs literal value rules)
- `references/responsive.md` (mobile behavior without custom CSS)
- `references/client-editing.md` (metadata.name, locking levels, contentOnly, Block Types/Inserter headers)

### 4) Generate the markup file
One file. Raw block markup, literal text, no PHP and no escaping calls — the API stores it byte-for-byte.

Read:
- `references/output-format.md` (the deliverable + how the slug decides create-vs-update)

### 5) Save and verify

Three checks, in this order, before the markup is done: **(a)** the heuristic validator — always; **(b)** the
destination's structural check — when it is available to you; **(c)** a strict check of every block against WordPress's
own `save()` — always, by the first route that can run.

**(a) Heuristic validator — always, fast, no dependencies:**
```
node .claude/skills/codbrand-content-builder/scripts/validate_pattern.mjs <your-file.html> [--block-types=<store-types.json>] [--block-gap=supported] [--target=pages|pages-with-title|products|custom_blocks]
```
With `--block-types` — the store's own declared types, read on its check page ("Embedding a plugin
(`cl/…`) block", rule 2) — it also checks every attribute's type, core and plugin. It is the only check
that does: WordPress's check page does not count a wrongly typed attribute as an invalid block.
With `--block-gap=supported` — only once you have DETECTED that the destination renders Block spacing
(`references/snippets.md` → "Detect it BEFORE you choose a spacing strategy") — it stops asking you to
confirm that on every file.
With `--target` — the resource you chose in step 2, or `pages-with-title` for a page whose title the theme
shows — it also checks the content's `h1`: one on a page (the hero's), none under a product or in a custom
block (`references/conversion-rules.md` → Accessibility rules). Always pass it when you know the target.
Expect `errorCount: 0`. Checks conventions WordPress cannot know about: `cod-brand` marker, button `url` + `has-custom-font-size`, dead `#fragment` links, `wp:separator` alpha class, `wp:cover` dim-class rules, HTML outside any block (WordPress would silently make it a Classic block), inline `style=""` that block supports never write, anything hand-styled inside a `wp:html`, `<style>` and `<script>` elements, emoji documentation, a `blockGap` WordPress drops (one holding "(": `clamp()`, `calc()`, `var()`) — and warns on an icon svg with a fixed size or colour, on divider rows in a container with no Block spacing, on a heading that skips a level, on body text estimated over 80 characters per line, and on a `wp:details` padded at the top or bottom (with `--target`, a missing or extra `h1` is an error). **It is the only check that looks inside a `wp:html`:** WordPress's own check (c) accepts any HTML there, and the structural check (b) does not look inside one.

Run it with NO argument to validate the teaching corpus in `examples/` instead — useful after editing an example, never part of publishing.

**(b) Structural check — when it is available to you.** A CodBrand storefront whose docs list
`block_markup_validation` has a door that checks structure with nothing installed: attribute JSON that does not
parse, blocks that never close, comments WordPress does not recognise, HTML outside any block. It needs the store's
API key with that door's read grant (the docs themselves are readable without a key); read that doc for the call.
Fix every error, and treat its warnings about HTML outside any block or an unknown block type as failures unless you
meant them. With no key holding that grant, (b) is not available to you: continue with (c) — (a) already catches
attribute JSON that does not parse, blocks that do not balance and HTML outside any block — and say in your report that the structural check
did not run. It never compares anything against `save()`, so it never replaces (c).

**(c) The strict check — take the FIRST route that can run:**

1. **The destination's own check page, in the user's logged-in browser.** The same doc names the wp-admin page
   and the JavaScript call that returns the verdict — no API key, just a browser someone is logged into. It runs
   the block code that site actually runs, so for that site it beats a pinned local copy: when the two disagree on a
   block, the page is right. Read the verdict through the call, never from the screen. **A page too large to
   pass through your tool's arguments:** put it on the store unpublished (a draft, where your route offers one,
   and only once the user has agreed to writes — step 6), then on the check page read the stored bytes back and
   check those —
   `await window.clBlockMarkupCheck.validate((await wp.apiFetch({ path: '/wp/v2/pages/<id>?context=edit' })).content.raw)`
   (a post: `/wp/v2/posts/<id>`). That checks exactly what the store holds; measured on one store (16-10-2026):
   a 173 KB draft of 348 blocks in one call. The verdict also names
   `wordpressVersion`: older than 7.1 — the release this skill's block forms were verified against (15-09-2026)
   — means the store is out of policy. Tell the user before delivering and say what will not work there (a 7.0
   store flags, and does not render, a button width written as `style.dimensions.width`), and do not rewrite
   the markup into an older block form to make it pass.
2. **The local ground-truth validator below** — when route 1 cannot run (no browser you can drive, nobody logged
   in, or the page reports it cannot run) AND its toolbox is already installed. Do not install the toolbox
   yourself: it is ~400 packages, so that is the user's call. If the page could not run because that WordPress is
   too old, the site is also outside this skill's latest-WordPress policy — say so, and remember the local verdict
   describes a newer WordPress than the site runs.
3. **Neither can run → pause and ask.** Publish nothing. Tell the user exactly what would unblock it — "open your
   store's wp-admin in a browser I can use, and log in", or "install the validator toolbox" — then check again.
   Never type a password for them, and never skip the check to finish the job.

Why this order: route 1 needs nothing installed and judges against the destination's real WordPress, while
route 2 needs a ~400-package toolbox and knows one pinned WordPress release. In a side-by-side run on WordPress 7.1
(15-09-2026) the page and the local validator agreed on every block. They differ on HTML outside any block,
which the page reads as a Classic block exactly as the editor does — which is why (a) fails it and (b) warns about it —
and on a block name the site does not have, which the page reports and the local validator passes (16-10-2026,
"Hard constraints" → plugin blocks).

**Route 2 — the ground-truth validator: WordPress's OWN parser and `save()`, run locally:**
```
node .claude/skills/codbrand-content-builder/scripts/validate_pattern_wp.cjs <your-file.html>
```
Expect `OK` and exit code 0. This answers the one question the heuristic validator cannot: *will this paste into the block editor without "Block contains unexpected or invalid content" — and stay exactly as written the next time the page is saved?* The second half is not a formality: WordPress silently accepts markup that matches an OLDER version of a block and rewrites it on save, and the validator fails that too ("accepted only as an older version of this block"). On failure it prints the exact expected-vs-actual bytes; `--verbose` prints the full markup, `--json` emits a machine-readable report.

- **The toolbox is OPTIONAL and installing it is the USER'S CALL** — see route 2 above, which says so. It is the
  FALLBACK; route 1, the store's own check page, needs nothing installed and beats it on that store. This bullet
  used to read "One-time setup: `cd ~/.claude/skills/.../scripts && npm install`", which contradicted route 2 in
  the same file, and an agent followed it. If the user does want it: `npm ci` (not `npm install` — the four
  `@wordpress/*` packages are pinned as a set) beside a COPY of the script. ⚠️ **Install it in a directory of your own, never INSIDE the skill folder.** The toolbox is ~400 packages / ~1.6 GB, and if the skill folder is a link into a git repository, `npm ci` there puts all of it **inside that repository**. Copy `validate_pattern_wp.cjs`, `package.json` and `package-lock.json` into a directory outside the skill folder and install there — Node resolves `@wordpress/*` by walking up from the script, so a copy works unchanged.
- **Neither validator supersedes the other** — (a) caught missing `cod-brand` markers and two dead `#anchor` CTAs that the ground-truth validator cannot see; the ground-truth validator caught a missing `has-border-color` class that (a) passed for three sessions. Markup is done only when (a), (b) where it is available to you, and (c) are all green. The reference publisher — a development tool that lives outside this skill — runs (a) and this local validator itself, with no skip flag, so it needs the toolbox and refuses anything this local validator fails. On a machine without the toolbox, or when the check page passed and this local validator did not, deliver by another route in step 6 once (c) has passed on the check page — and report the disagreement, which usually means the local pins trail the site's WordPress.
- **Text alignment — the EXISTING library keeps `"textAlign":"center"` (heading) / `"align":"center"` (paragraph); do not mass-rewrite it.** Not a back-compat exception: WordPress itself still accepts and round-trips that form on the current release, and both forms render identically, so rewriting ~40 blocks buys nothing. The old cross-version justification ("only form valid across 6.7→7.0") is VOID under the latest-only policy — do not repeat it as a reason in new work. For a NEW pattern either form is fine; take whichever `emit_block.cjs` returns. See `references/headless-validation.md` → "Re-examined under the latest-only policy".
- The pinned packages are calibrated against WordPress 7.0.4 (Aug 2026) and re-verified against
  WordPress 7.1 (22-08-2026 — three benign drifts, see `references/headless-validation.md`). If this
  validator and the store's own check page disagree, the site is right and these pins trail it.

- Walk the verification checklist below.
- Report to the user: category chosen, slug, folder path, and a 3-5 line preview of the markup head.

**Then run the design audit — ADVISORY, and it answers a different question:**

```
node .claude/skills/codbrand-content-builder/scripts/audit_design.mjs <your-file.html>
```

Step 5's checks ask *"is this markup valid?"*. This asks *"is this markup DESIGNED?"* — type-scale
coherence, how many content measures, section rhythm, background separation, centred-vs-left balance,
imagery, line length. It exists because a real page passed BOTH validators on all eight publishes and
was still rejected three times on looks: every one of those defects was valid markup that rendered
badly.

**It is not a gate.** It exits 0 (use `--strict` to fail on high-severity findings), it has no
dependencies, and each finding prints the measurement behind its threshold so you can disagree with a
number rather than guess at it. A finding can be the right call deliberately made — say so and move on.

**You no longer have to remember to run it: its findings ride along in `validate_pattern.mjs`'s own
output** under `designAdvisory`, on every route, and they never affect that validator's exit code.

**Before publishing, read your own design system back:**

```
node .claude/skills/codbrand-content-builder/scripts/audit_design.mjs <your-file.html> --report
```

It states what you actually built — typeface, type scale and its steps, section measures, radii,
background lightness, centred ratio, imagery, longest rendered line — with no judgement attached.
Nothing else in this procedure asks you to CHOOSE those before writing, and two full rebuilds of a
real page were rejected on design while the markup was valid every time. Reading the system back is
the cheapest way to notice you never chose one: that page's first rejection is visible in a single
line, `Typeface: NONE SET`.

**If you converted from SOURCE HTML, diff it — the validators cannot.**

```
node .claude/skills/codbrand-content-builder/scripts/diff_source_fidelity.mjs <source.html> <your-file.html>
```

**The validators check CORRECTNESS; this checks FIDELITY.** Neither validator has seen the source, so
a flattened `<br>` in a heading and a dropped `max-width` both pass everything — they are perfectly
valid markup. Both have already shipped that way; one was caught only by luck, when an unrelated
line-length advisory happened to fire.

It **reports and never fails** (always exit 0), because it cannot judge intent: dropping a `max-width`
is exactly right on a destination whose width mode already owns the measure. **Put one line per
reduced marker in the delivery report and let the user decide** — conversion-rules.md → Step 0b.
The rule is NAME IT, not preserve it.

### 6) Deliver the file

The deliverable is the validated markup file plus four facts: title, slug, which resource it belongs
on, and **the width the page should render at** — `""` to inherit, `none` for true edge-to-edge, or
one of the four store width classes. A banded full-bleed layout needs `none`, because `align:"full"`
cannot escape the page wrapper's padding and no store setting governs an ordinary page's width;
`references/output-format.md` has the table. A fifth only when something could not be a block setting:
**the forced CSS or JavaScript** (below). **How it reaches the site is the user's setup, not this
skill's.** Use whatever tool you
have for that site:

- **An MCP server** for the site, if one is connected.
- **The CodBrand plugin's `cl-api/v1` gateway**, if the site runs it. Start at `GET /cl-api/v1/docs`
  and follow the "Writing data" group for the write doors, their resources and their rules. A
  reference publisher lives OUTSIDE this skill, in the sub-project that ships it.
- **Any other REST API, WP-CLI, or a paste into the block editor's code view.** The markup is
  literal text and needs no transformation on the way in.

Whatever the route, three rules hold:

- **Never publish markup that has not passed step 5's checks.** Nothing downstream runs them
  for you — an API will typically store malformed markup and answer `200`. This gate is the only thing
  between a generation slip and a broken live page. If no strict check could run, you are at step 5's
  "pause and ask", not at delivery.
- **Do not write unless asked.** Prefer a dry run or preview first; commit only when the user has
  asked to publish.
- **On slugs:** most routes treat the slug as the identity — publishing the same slug again updates
  that row, while a new slug creates a second one. Confirm the rule for YOUR route before relying on
  it; a CodBrand storefront documents it under `/cl-api/v1/docs`.

**Forced CSS or JavaScript is handed over with its level, never written into the markup.** What no
block setting can express (step 3) travels beside the markup as three things:

- **the code**, its selectors written against a class of your own, set on the block as `className`
  (the editor's "Additional CSS class(es)") and specific enough to match nothing else;
- **the level it goes on — the narrowest one that reaches every place the content shows**: a page →
  that page; a product's own content → that product; a custom block placed on one surface → that
  surface's design; on several surfaces → the store. A CodBrand storefront names its levels and what
  each reaches in `/cl-api/v1/docs/custom_code_css_js`; another destination has its own (a site-wide
  "Additional CSS" at least);
- **merge, never overwrite**: a level may already hold code, and a write usually replaces the whole
  field — read what is there first.

Never put it in a block's own "Custom CSS" field (`style.css`, WordPress 7.0+): WordPress removes it
on save for anyone without the `edit_css` right, and content sent through an API has no such user —
measured through a store's API save path on WordPress 7.1, the block came back without it, silently.

**Credentials never live in this skill**, in generated markup, or in a commit. They belong in the
environment or config of whichever tool does the publishing.

## Verification checklist
Before declaring done, confirm ALL of:
- [ ] Step 5's checks pass on the generated file: the heuristic validator, the destination's structural check when it is available to you, and a strict check by the first route that could run.
- [ ] Root block carries `className":"cod-brand"`.
- [ ] Markup uses core blocks plus, where a dynamic component is wanted, ONLY blocks confirmed present on the destination (step 0), in the form that site supports. No unconfirmed plugin namespaces, no theme-specific blocks.
- [ ] **One `h1` on a page — the hero's;** none in a product's content or a custom block. Step 5 (a) checks it with `--target`. Measured on one store (01-11-2026): its Home and Shop shipped with no `h1` at all.
- [ ] **Body text at 80 characters per line or fewer, measured on the rendered page at desktop width.** Step 5 (a) warns from an estimate (a generic glyph width — it ran about 10% low on one store's face); the rendered line is the proof. Over 80, narrow the measure or raise the size. Measured on one store (01-11-2026): 105–119 characters on seven pages.
- [ ] **Every embedded dynamic block shows something on the published page** — count its cards, tiles or items and report the number. An empty box, or a bare HTML comment where a listing should be, passes every check in step 5 ("Embedding a plugin (`cl/…`) block", rule 5). With no browser to look, say the count was not taken — never report it as passed.
- [ ] No `<style>` tags. Inline HTML `style="..."` attributes are allowed ONLY when WP's own block serialization produces them (e.g. `style.spacing.padding` on `wp:group` produces `style="padding-top:..."` — that's expected). Never write hand-rolled `style=""` for design — always go through block-support JSON, so the merchant can change it in the block editor; inside a `wp:html` there are no settings, so nothing there is styled at all. Forced CSS is handed over with its level (step 6). (a) enforces all of this.
- [ ] No `<script>` tags inside the markup — JavaScript is handed over with its level too (step 6).
- [ ] Markup parses cleanly: every opener `<!-- wp:X -->` has a matching `<!-- /wp:X -->`.
- [ ] **Serialization sanity** — when block-support attributes generate inline styles, they appear on the correct element and in WP's expected order. Inline `style=""` contains EXACTLY the properties present in the JSON — never inject "default" properties like `font-style:normal` if `fontStyle` is not in the JSON. Common pitfall: `wp:button` `border.radius` goes on `<a>` not `<div>`. See `references/block-supports.md` per-block notes.
- [ ] **RE-MEASURED AFTER THE LAST LAYOUT-AFFECTING CHANGE.** Any change to **font, font-size, copy
  length, padding, or container width re-opens EVERY equal-height and line-length question on the
  page.** These are not independent checks — the first is an input to the second. Measure AFTER the
  last such change, never before it, and **never restate an earlier measurement as a current fact**.
  ⚠️ **A FONT SWAP IS A LAYOUT CHANGE**, and it is the one that does not look like one: it alters no
  width, no padding and no structure, and every step-5 check passes either way. Measured: swapping a body
  face from Barlow Condensed to Inter (~36% wider per character) pushed one card's description from
  four lines to five and turned an equal 184/184/184 row into **226/205/205** — a 21px misalignment in
  a row that was correct before the swap. The stale "184/184/184" was written into a QA report as a
  current fact after the change that invalidated it.
- [ ] **CHECKED AT A NARROW VIEWPORT (375px), not only at desktop** — MANDATORY for any change that
  touches `width`, `padding`, `margin` or `contentSize`. **Every step-5 check judges markup,
  never rendering: a fully green run is compatible with a page that is unusable on a phone.** State
  MEASUREMENTS, not impressions ("the FAQ column is 5px wide and wraps mid-word", not "looks tight").
  A real page shipped this way — verified only at 1280px — put its FAQ questions in a 5px-wide column
  on a 375px phone and broke words mid-word. See `references/responsive.md` → "Verifying at a narrow
  viewport". Say which way you looked: a narrow window or frame changes the CSS only, never what the store
  renders for a phone's user agent (same section). **With per-device visibility or `wp:columns` on the page,
  look at 600 and 768 too:** between 481 and 781 WordPress hides nothing as a phone while columns already
  stack (`references/responsive.md` → "Phones only, or not on phones").
  **When it runs, and what it blocks:** it needs the page rendered with the destination's theme, so it
  runs on a draft or preview where the delivery route offers one (step 6), after the last
  layout-affecting change. A failure blocks the page going live and the work being reported done: fix
  the markup, re-run step 5, re-deliver and measure again. Where a route can only publish live, measure
  straight after publishing and fix before reporting. With no browser you can drive at 375px, say the
  check did not run — never report it as passed.

## Failure modes & mitigations
- **Hover effects / CSS animations** — a button's or a navigation link's hover is a block setting on WordPress 7.1 (`style[":hover"]`, which the merchant edits through the block card's Pseudo state menu: `references/block-supports.md` → "A button's hover"). For any other block no setting expresses them: build the static version with settings, and hand the hover or animation CSS over with its level and the `className` it hooks (step 6).
- **A face the design needs is not registered on the store** — do NOT reach for an `@import` in page
  CSS, and do NOT invent a literal font stack. **The plugin owns fonts**: register the face through
  the font manager and reference it by its `css_var`. See `references/theme-tokens.md` → "Fonts come
  from the plugin's font manager". *(An earlier version of this line said "use a literal
  `style.typography.fontFamily` and warn the user" — that approach is wrong, and it
  is corrected here rather than deleted because a page may already have been built on it.)*
- **CSS Grid with unequal columns** — use `wp:columns` with explicit `width` per `wp:column`.
- **Icons** — a bare `<svg>` in a `wp:html`, sized and coloured by the settings of the Icon group around it; a raster or multi-colour logo is a `wp:image` of an uploaded file. See "Icons" (step 3).
- **Background video / parallax** — use `wp:cover` for static background; flag video/parallax as out of scope.
- **Forms** — a form needs something on the destination that receives what is sent. Use only a form component the destination documents (a CodBrand storefront lists what it has in `/cl-api/v1/docs/dynamic_components`). Never a hand-written `<form>` in a `wp:html`: it looks real, and every submission is lost with no error anywhere. For any other form in the design (a contact form, say), draw its look with core blocks as step 1 says, and name it in the hand-over as not connected — how it receives submissions is the user's decision. *(Corrected 16-10-2026: this line named one theme's form support.)*

### ⚠️ NEVER extrapolate a measurement into a different geometry

Two "verified" results were wrong in one session, both from scaling a real measurement instead of
taking a new one. This is the failure mode that survives a green toolchain, because the number *looks*
measured.

1. **Measure at the box you will SHIP.** If the geometry changes, re-measure — never multiply.
2. **Before scaling, name the fixed-unit terms** — letter-spacing, borders, padding, a vendor's fixed
   offsets. If any exist, the relation is `a·x + b`, never `a·x`. Take two samples and solve for both.
   ```
   WRONG   width = k × fontSize
   RIGHT   width = k × fontSize + (charCount × letterSpacing)
   ```
   Letter-spacing is a **constant per character**, so it does not shrink with the font. Measured: a
   heading fitted at 100px and scaled down wrapped anyway — the linear model predicted a 9px surplus
   where there was a 9px deficit. **The error is worst at the smallest clamp value**, which is exactly
   the one that ships to phones.
3. **Cross-origin content CAN still be measured** — load the embed URL directly at the exact target
   width AND height. *"I can't inspect it from the parent page"* is not a licence to extrapolate.
   Measured on one embed, scaling would have been badly wrong in both directions:

   | iframe box | inner video width | details block starts at |
   |---|---|---|
   | 340 × 1000 | 323 | **619** |
   | 432 × 1200 | **211** | **619** |

   The details offset was **fixed at every size**, and the *wider* iframe produced a *smaller* video. A
   crop built on the scaled numbers exposed content that was meant to be hidden.
4. **Sample over TIME, not just once.** One embed rendered `323×574` for ~3 seconds, then switched to
   `211×280` with wide letterboxing when its provider's promo layout took over. A sample at t=1s and
   one at t=5s disagree. **A third-party embed's internal layout is not a contract** — stable neither
   across sizes nor over time. Never build a crop or a fill on it without checking both.
5. **"Inside the valid range" is not "matches the source."** Given a valid window, a self-chosen value
   inside it is still a change. **When the source states a number, use the source's number** — and if
   you deviate, name it (conversion-rules.md → Step 0b).

### ℹ️ Trace a rendering defect to the LAYER THAT OWNS IT before filing it against this skill

A missing-gap defect was blamed on the pattern generator across three separate QA reports. It was a
one-line theme setting the whole time (`add_theme_support('appearance-tools')`). The layers are: the
markup you wrote → WordPress's block supports → **the destination's theme** → the plugin's own CSS.
Name which one owns the symptom before rewriting markup that was already correct.

### Visual symptom: "column collapsed to a narrow strip with letter-by-letter text wrap"
When you see a column rendered ~15px wide with overlay text wrapping vertically (one character per line), and an "Attempt recovery" prompt floating beside it — that's not a layout bug, that's the **"Block contains unexpected or invalid content"** parser error rendering its broken state. The fix is always serialization-alignment, never CSS. Common culprits ranked by frequency in this project:

1. **`wp:cover` with `style.shadow`** — cover doesn't support shadow. Drop the JSON key + `box-shadow` from inline style, or wrap the cover in a `wp:group` and put the shadow on the group.
2. **`wp:cover` emitting `has-background-dim-50`** — when `dimRatio:50` (default), only `has-background-dim` is emitted. See `references/block-supports.md` cover section.
3. **`wp:button` missing `url`/`href`** — every button needs both. See `references/block-supports.md`.
4. **`wp:separator` missing `has-alpha-channel-opacity` class** — required on every separator regardless of styling.
5. **Inline `style=""` containing properties not in the JSON** (e.g. `font-style:normal` injected "for safety"). Walk the JSON keys directly — never add or omit.

## Recovery: when a styled block keeps showing "Block contains unexpected or invalid content"

### Strategy A — Incremental layering (preferred for moderate styling)

When a heavily-styled block fails to parse, don't keep guessing at WP's serialization. Instead:

1. **Strip to bare minimum** — keep the block + only the structural JSON (`linkTarget`, `width`, etc.). Drop all `style.*` keys and corresponding inline styles.
2. **Paste into WP and verify clean parse.** This is the baseline.
3. **Add ONE style layer at a time**, in this order: `color` → `border` → `typography` → `spacing`. After each addition, run the validator and re-paste into WP.
4. **The first layer that breaks parsing is the suspect.** Compare the JSON↔HTML for that property only — much smaller diff to debug.

### Strategy B — Capture from WP (when Strategy A still fails)

When even per-property layering keeps producing parser errors, stop hand-writing the markup and let WP itself produce the canonical bytes:

1. In the WP block editor, insert one instance of the block.
2. In the right sidebar (block Inspector), set every style property by hand — colors, borders, typography, spacing.
3. Switch to **Code Editor** view (top-right `⋮` menu → Code editor, or Ctrl+Shift+Alt+M).
4. Copy the entire `<!-- wp:X ... -->` ... `<!-- /wp:X -->` block. **This is WP's byte-perfect canonical output.**
5. Use it as the template — replicate to other instances of the same block in your markup, varying only content (text, URL, src) and keeping every byte of the structural/style markup identical.

This sidesteps every guessing game about class order, style property order, value units, and class lists. WP becomes the source of truth for serialization.

**When to reach for Strategy B:** any block where the design needs 3+ style sub-keys at once (e.g. custom button with color + border + typography + spacing). Hand-writing these is fragile; capturing once from WP is faster end-to-end.

## Escalation

For canonical, up-to-date specifications on the block API surface, consult:

- Block patterns API: https://developer.wordpress.org/block-editor/reference-guides/block-api/block-patterns/
- Pattern file headers: https://developer.wordpress.org/themes/patterns/registering-patterns/
- Block metadata (block.json): https://developer.wordpress.org/block-editor/reference-guides/block-api/block-metadata/
- Block supports: https://developer.wordpress.org/block-editor/reference-guides/block-api/block-supports/
- Block schema (machine-readable): https://schemas.wp.org/

If a behavior contradicts what's in `references/`, trust the canonical source and update the reference accordingly.
