# Naming — Slugs, Titles, Folders

Consistent naming makes the library searchable and the registration unambiguous.

## Slug

Format: `cb/<slug-suffix>`

Slug suffix rules:
- kebab-case only (lowercase, words separated by `-`).
- 2-4 words, descriptive of the visual shape, not the page topic.
- No numbers unless they describe count (`team-3-col`, `pricing-2-col`).
- No category in the slug — the folder already encodes that.

### Good
- `cb/hero-split`
- `cb/hero-centered-heading`
- `cb/services-3-col`
- `cb/testimonials-quote-grid`
- `cb/footer-4-col-with-newsletter`
- `cb/cta-dark-band`
- `cb/feature-icons-2-row`

### Bad
- `cb/section-1` (not descriptive)
- `cb/services_grid` (underscore — use kebab)
- `cb/services-services-grid` (redundant)
- `cb/about-us-page-services-section` (too long, includes context)
- `cb/banner` (too generic — collisions inevitable)

## Title

Format: `Title Case With Spaces` matching the slug intent.

| Slug | Title |
|---|---|
| `cb/hero-split` | `Hero Split` |
| `cb/hero-centered-heading` | `Hero with Centered Heading` |
| `cb/services-3-col` | `Services — 3 Columns` |
| `cb/cta-dark-band` | `Call-to-Action Dark Band` |
| `cb/footer-4-col-newsletter` | `Footer with Newsletter — 4 Columns` |

Titles can include em-dashes and "with" connectors for readability. Keep under ~50 chars.

## Folder layout

There is no output folder layout to honour: you write ONE markup file wherever you like and pass its
path to the publisher (see `output-format.md`). The slug is passed on the command line, not encoded
in a path.

The only folder convention left is the **teaching corpus** that ships inside the skill, which you
read from and do not write to:

```
.claude/skills/codbrand-content-builder/examples/
└── <category>/          full-page | hero | grid | listing | header | footer
    └── <name>/
        └── content.html
```

## Description (file header field)

Format: one short sentence, ends with a period, fewer than 120 chars.

### Good
- `Full-width hero with one centered headline and a single CTA button.`
- `Three-column services block with image, title and short description.`
- `Footer with four columns: brand, links, contact, and newsletter signup.`

### Bad
- `Hero pattern.` (uninformative)
- `A really nice hero pattern that looks great on the homepage and works for any kind of business...` (too long)

## Keywords

3-6 lowercase keywords, comma-separated, used by inserter search. Pick terms a user would actually type.

Example for a hero: `hero, banner, headline, cta, intro`

Example for a footer: `footer, links, newsletter, contact, brand`

## Conflict avoidance

The `cb/` prefix protects against collisions with core / theme / plugin patterns. There is no need to add date or version suffixes — variations get distinct slugs (e.g. `hero-split-v2` is fine if the user wants a parallel variant, but only when explicitly asked).

## Stability of saved markup (treat as a stable contract)

Once a pattern is shipped and inserted onto a page, the saved block markup is **frozen**. WordPress validates each block by comparing its saved HTML to what the block's `save()` function would produce — if they diverge, the user sees "Block contains unexpected or invalid content" on every page that uses the pattern.

Custom blocks solve markup changes with `deprecated` versions and migration paths. **Patterns have no migration mechanism.** Treat shipped pattern markup as a stable contract.

| Type of change | Safe to apply in place? |
|---|---|
| Fix wrong serialization (attribute order, missing JSON key, extra HTML attribute) | **Yes** — old markup wasn't valid either; the fix can only improve things. |
| Adjust spacing/color values via JSON `style.*` | **Yes** — value changes don't break parser validation. |
| Add/remove a wrapper `wp:group`, swap `wp:columns` → grid, restructure card layout | **No** — every existing page using the old pattern will show "Invalid block". |
| Rename a block (e.g. `wp:heading` → `wp:paragraph`) | **No** — same reason. |

**When restructuring is necessary:** ship a new slug (`hero-split-v2`) instead of mutating the existing one. Mark the old one with `Inserter: false` in its file header to hide it from the picker but keep existing pages valid.
