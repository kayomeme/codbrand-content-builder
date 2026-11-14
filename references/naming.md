# Naming — Slugs, Titles, Folders

Consistent naming keeps slugs predictable, and the slug decides whether a publish creates or updates.

## Slug

Format: plain kebab-case, no prefix (`hero-split`). The slug is the **update key**: publishing the same slug again
updates that item, a new slug creates a second one (`output-format.md`).

Slug rules:
- kebab-case only (lowercase, words separated by `-`).
- 2-4 words, descriptive of the visual shape, not the page topic.
- No numbers unless they describe count (`team-3-col`, `pricing-2-col`).
- No category in the slug — the folder already encodes that.

### Good
- `hero-split`
- `hero-centered-heading`
- `services-3-col`
- `testimonials-quote-grid`
- `footer-4-col-with-newsletter`
- `cta-dark-band`
- `feature-icons-2-row`

### Bad
- `section-1` (not descriptive)
- `services_grid` (underscore — use kebab)
- `services-services-grid` (redundant)
- `about-us-page-services-section` (too long, includes context)
- `banner` (too generic — collisions inevitable)

## Title

Format: `Title Case With Spaces` matching the slug intent.

| Slug | Title |
|---|---|
| `hero-split` | `Hero Split` |
| `hero-centered-heading` | `Hero with Centered Heading` |
| `services-3-col` | `Services — 3 Columns` |
| `cta-dark-band` | `Call-to-Action Dark Band` |
| `footer-4-col-newsletter` | `Footer with Newsletter — 4 Columns` |

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

## Conflict avoidance

A slug names ONE item of its resource on the store, so a slug that is already taken there means an update, not a new
item. Before publishing something new, check the slug is not used by another item of that resource on the destination,
and pick a more specific one if it is. There is no need to add date or version suffixes — variations get distinct slugs (e.g. `hero-split-v2` is fine if the user wants a parallel variant, but only when explicitly asked).

## Stability of saved markup (treat as a stable contract)

Once a pattern is shipped and inserted onto a page, the saved block markup is **frozen**. WordPress validates each block by comparing its saved HTML to what the block's `save()` function would produce — if they diverge, the user sees "Block contains unexpected or invalid content" on every page that uses the pattern.

Custom blocks solve markup changes with `deprecated` versions and migration paths. **Patterns have no migration mechanism.** Treat shipped pattern markup as a stable contract.

| Type of change | Safe to apply in place? |
|---|---|
| Fix wrong serialization (attribute order, missing JSON key, extra HTML attribute) | **Yes** — old markup wasn't valid either; the fix can only improve things. |
| Adjust spacing/color values via JSON `style.*` | **Yes** — value changes don't break parser validation. |
| Add/remove a wrapper `wp:group`, swap `wp:columns` → grid, restructure card layout | **No** — every existing page using the old pattern will show "Invalid block". |
| Rename a block (e.g. `wp:heading` → `wp:paragraph`) | **No** — same reason. |

**When restructuring is necessary:** ship a new slug (`hero-split-v2`) instead of mutating the existing one. Leave the old one as it is, so the pages already using it stay valid.
