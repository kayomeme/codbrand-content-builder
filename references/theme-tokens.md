# Theme Tokens — which token layer the DESTINATION actually has

**⚠️ FIRST: decide which of two modes you are in. They are materially different, and most of this
file only applies to one of them.**

| Destination | Token layer | What you write |
|---|---|---|
| A **block theme** with `theme.json` (Astra, TT4, …) | `theme.json` presets | `var:preset\|<group>\|<slug>` — the rest of this file |
| A theme that declares **no preset scales** — including the plugin's own `codbrand` companion theme | **there are no presets at all** | **literals for everything**, plus the plugin's own CSS vars |

**How to tell:** presets come from preset SCALES in `theme.json`
(`settings.color.palette`, `typography.fontSizes`, `spacing.spacingSizes`). No scales, no presets —
so `var:preset|spacing|80` resolves to nothing and the spacing silently vanishes.

⚠️ **CORRECTED 19-09-2026 — "no `theme.json`" was the wrong test, and codbrand was the wrong
example of it.** This block used to read *"a theme with no `theme.json`… Verified:
`wp-content/themes/codbrand/` contains **no `theme.json`**"*. It contains one, and has for a
while. **The verdict for codbrand does not change** — the file sets
`defaultPalette`/`defaultFontSizes`/`defaultSpacingSizes` all to `false` and declares no scales of
its own, so there are still zero presets and literals are still the only thing that resolves. But
the test above is the accurate one, and the old phrasing led to two WRONG conclusions elsewhere:

| because it "has no theme.json"… | actually |
|---|---|
| `blockGap` is discarded | **it renders** — `appearanceTools: true` |
| the theme supplies no width, so set your own `contentSize` | **it supplies 1440px** — `layout.contentSize`. Hardcoding one freezes the section against the merchant's Global Layout (`snippets.md` §1) |

**A `theme.json` does NOT make a theme a block theme.** codbrand is still classic — PHP templates,
classic `style.css` header — and it ships a `theme.json` purely to turn on `appearanceTools` and
publish a width. Judge each capability separately; never infer one from the file's presence.

If you cannot inspect the theme, prefer literals: they render correctly either way, while a preset
renders on only one.

## Classic theme + the plugin's design system — the codbrand case

On a classic theme there is no preset layer, so **every spacing, size and radius is a literal**
(`"40px"`, `"14px"`, `"clamp(2rem, 5vw, 4rem)"`). That is not a compromise; it is the only thing that
resolves.

But "literals for everything" is not quite the whole rule, because the **plugin** supplies a token
layer of its own, and it IS the correct one to use here:

| Plugin token | Looks like | Comes from |
|---|---|---|
| Fonts | `var(--cl-font1)`, `var(--cl-font2)` … | the font manager (below) |
| Palette colours | `var(--cl-bg-color1)`, `var(--cl-txt-color1)`, `var(--cl-border-color1)` … | the colour palette. `var(--cl-page-bg-colorN)` (since 06-09-2026) is a PAGE surface (the store's page, or since 07-09-2026 one page's own content area — the chrome keeps the store colour) — the store's page background and a page's own override; a pattern never references it, a section stays on `bg-color` — the store keeps that category for page surfaces (its `design_tokens` doc), so a merchant who restyles them would restyle your section with them. **When the design paints a SECTION in a page-background colour** (a hero on the page's dark tone, say), use a `bg-color` slot holding that colour; with none, use the nearest `bg-color` and name the deviation in the hand-over — a `bg-color` slot with that colour would remove it (added 16-10-2026, from a build whose approved design did exactly that). And the inverse holds too: **never fake a page background with a section background.** There is a door for it, `PUT /pages/{id}/plugin {"background": …}`; painting the root block instead produces a card inset by the page gutters. See `conversion-rules.md` → "Backgrounds: decide WHO owns the page width" |

These are real, merchant-editable, and shared across the whole storefront — so a page that uses them
restyles with the store instead of fighting it. Use them for anything the store owns (brand colour,
body face); use a literal for a genuine one-off the store has no opinion about.

## Fonts come from the plugin's FONT MANAGER — never an `@import`, never a hardcoded name

**Do NOT write `@import url(https://fonts.googleapis.com/...)` into a page's custom CSS.** It was
tried and rejected: an `@import` is invisible to the manager's usage tracking, is not reusable by any
other page, and is duplicated on every page that needs the face. **The plugin owns fonts.**

**The door:** resource `design_controls/font_manager` — operations `list`, `apply`, `update`,
`set_active`, `set_default`. Reference a font in markup by its **`css_var`**, which the door hands you
ready to paste — except inside block-comment JSON, where WordPress writes the two dashes as
`\u002d\u002d` and `validate_pattern.mjs` refuses a raw `--` (block-supports.md → the six escaped sequences):

```json
"style":{"typography":{"fontFamily":"var(\u002d\u002dcl-font1)"}}
```

In the block's HTML it stays as the door gives it: `style="font-family:var(--cl-font1)"`.

**A store typography preset can set the face too.** Text whose block carries one of the store's typography presets — its
`cl-preset-N` class in the block's `className`; on a group it reaches every block inside — takes the face that preset
sets, and the merchant restyles every block using it in one place. A typography preset may set only a size or a colour,
though: read it (`GET design_controls/presets/{id}`, its `css_default`) and confirm it holds `font-family` before
relying on it. `validate_pattern.mjs` counts the class as a font; it cannot see inside the preset. Seen on one store
(19-11-2026): two custom blocks styled only by a body-text preset that sets `font-family`.

Useful fields on a `list` (verified against the door's own schema):

| Field | Meaning |
|---|---|
| `css_var` | **The one you want** — "ready to paste into any style setting, e.g. `var(--cl-font1)`" |
| `name` | the css-var stem. **READ-ONLY** — saved settings across the plugin reference it |
| `title` | the human label in the font picker |
| `font_family` | the actual CSS value, e.g. `'Inter', sans-serif` |
| `is_active` | `yes` = loaded on the storefront |
| `is_default` | `yes` on exactly one row — the site-wide default |

⚠️ **`is_active` and `is_default` are REFUSED by `apply`/`update`** — they have their own operations
(`set_active`, `set_default`). Trying to set them through a write returns an error by design.

### Two constraints, both explicit owner instructions

**(a) NEVER hardcode a specific font name in this skill or in generated markup.** Which faces a store
uses is the admin's or the managing agent's decision, per store. **DISCOVER what is registered and
active at runtime** (`list`), use that, and only if a face the design genuinely needs is missing do
you register it through the font manager. A font name written into this skill is a decision taken
away from every store that installs it — see SKILL.md → "This skill ships to MANY stores".

**(b) ~5 active fonts site-wide is an ADVISORY performance note, not a limit.** The admin or agent
activates as many as they need. **There is deliberately NO validator for this**, and adding one would
be a mistake twice over:

1. A hard check on a soft rule trains people to ignore validators — including the hard ones.
2. **A markup validator is the wrong instrument entirely.** The number that matters is the store's
   ACTIVE font count, which lives in the font manager — not the count of distinct `fontFamily` values
   in one page's markup. A page legitimately using 3 of the store's 5 active faces is not over
   budget, and a page using 1 face on a store with 12 active is over budget while looking innocent.

## Spacing comes from the store's Spacing designs — read them, write their px

A store's spacing steps are its **Spacing designs** (a design preset type): each is one space, with one value on
computers and one on phones (a store's phone is narrower than 768px). Read them before you set any space —
`GET design_controls/presets?type=spacing`, every page; what they are: the api's `/docs/settings_vs_presets` →
"Spacing presets hold a space, not a class". Each has a `category` (what it spaces) and a `title`; its px are in
`css_default` (`gap:<n>px;`) and `css_mobile` (empty = the same on phones). Find a step by its category and title,
never by an id remembered from another store.

**A Spacing design prints no class and no variable** — the plugin writes its px into the designs that use it. So page
content writes the px itself: the computer value as the value, the phone value in `"@mobile"` and `"@tablet"`
(`responsive.md` → "A different value on phones or tablets"). **Never `var(--cl-spacing-N)`**: that is the name a design
system gives the design, and no storefront defines it — the space renders as nothing (measured on a store, 25-11-2026:
padding 0px; (a) warns). Content written this way does not follow a later edit of the design: say so in the hand-over.

Which step a space takes, by its role:

| The space | The design (category → title) |
|---|---|
| items of one group, one under the other or side by side: list rows, links, the blocks of one section | between vertical / horizontal → **Item** |
| a heading → what it labels; between groups inside a section | → **Group** |
| cards in a grid | → **Grid** |
| between sections | space above → **Above section** |
| a box's padding: a card, a panel, a row | inside → **Inside** (small, large) |
| the page's sides | the store's **page edge** — the page's width mode owns it; never pad a section to imitate it (`conversion-rules.md` → "Backgrounds: decide WHO owns the page width") |

What no design covers follows the scale by role: **tight 4px** (a label → its value, a title → its subline), a
control's inside **12 × 16px**. Every value is on the 4px scale: 0, 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 56, 64, 80,
96. **Converting a design whose space is off the scale:** take the step of the role it plays, else the nearer step (a
tie to the larger), and name each value that moved in the hand-over ("14px gap → 16px"). (a) warns on a value off the
scale and on children that make a second gap in one container.

The laws these steps serve — proximity (L3), the scale (L6), one gap per container set on the parent (L7) — are the
sibling skill's: `codbrand-store-blueprint` → `references/spacing.md`, at the same `version_tag`
(`https://github.com/kayomeme/codbrand-store-blueprint/blob/<version_tag>/references/spacing.md`). No `spacing` type
on the presets door: the plugin is older than this skill — use the scale by role above and say so.

## When to use a preset — BLOCK THEMES ONLY (skip this section on a classic theme)

Use `var:preset|...` when the design intent is "use the theme's value", so the pattern adapts to user customizations of Astra.

| Token group | Example string | Use for |
|---|---|---|
| `spacing` | `var:preset|spacing|80` | All padding, margin, gap. |
| `color` | `var:preset|color|primary` | Brand / theme colors. |
| `font-size` | `var:preset|font-size|large` | Standard text sizes. |
| `font-family` | `var:preset|font-family|heading` | Heading vs body fonts. |
| `shadow` | `var:preset|shadow|natural` | Card / floating-element shadows. |

In the rendered HTML, presets become `var(--wp--preset--spacing--80)` etc. — show both forms in the markup as the example below.

```json
"style": {
  "spacing": {
    "padding": {
      "top": "var:preset|spacing|80",
      "bottom": "var:preset|spacing|80",
      "left": "var:preset|spacing|50",
      "right": "var:preset|spacing|50"
    }
  }
}
```

```html
<div class="wp-block-group" style="padding-top:var(--wp--preset--spacing--80);padding-right:var(--wp--preset--spacing--50);padding-bottom:var(--wp--preset--spacing--80);padding-left:var(--wp--preset--spacing--50)">
```

Both the JSON `var:preset|...` and the inline `style="...var(--wp--...)..."` must be present in the rendered markup. The block editor produces both automatically — patterns must do the same to render correctly without the editor.

## When to use a literal value

Use literal CSS values (`px`, `rem`, hex, etc.) when:
- The design specifies an exact pixel/hex that is unlikely to be in `theme.json`.
- The value is a one-off (e.g. `border-radius: 14px`).
- A preset of that value doesn't exist.

```json
"style": {
  "border": { "radius": "14px" },
  "typography": { "fontSize": "clamp(2rem, 5vw, 4rem)" }
}
```

## Color: preset vs literal

| Form | Output |
|---|---|
| `"backgroundColor":"primary"` | applies CSS class `has-primary-background-color` + `has-background` |
| `"style":{"color":{"background":"#0d0d0d"}}` | literal hex in inline `style` |

Prefer the slug form (`backgroundColor:"primary"`) for theme-aware colors. Use the literal form for off-palette one-offs.

## Block-theme presets you may usually assume exist (Astra) — NOT on a classic theme

Astra's customizer + `theme.json` typically expose:
- Colors: `primary`, `secondary`, `accent`, `text`, `heading`, `link`, `background`, `surface`, `contrast`.
- Spacing: numeric scale, often `20`, `30`, `40`, `50`, `60`, `70`, `80` (or `xs` `s` `m` `l` `xl`).
- Font sizes: `small`, `medium`, `large`, `x-large`, `xx-large` (core defaults) plus theme additions.

If unsure whether a preset exists, **fall back to a literal value** — patterns must render correctly even when a preset is missing.

## Rule of thumb

> Theme-related concept (brand color, vertical rhythm, body font) → preset.
> Design-specific one-off (a custom radius, a one-time hex) → literal.
